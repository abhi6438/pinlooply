// ── Automation Engine ─────────────────────────────────────────
// Called by route handlers when trigger events occur.
// Loads matching rules for the user/project and fires actions.

import { supabaseAdmin } from '../config/supabase.js'

// ── Helper: create notification ───────────────────────────────
async function notify(userId, title, body, relatedTaskId = null) {
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'automation',
      title,
      body: body || null,
      related_task_id: relatedTaskId || null,
    })
  } catch (err) {
    console.error('[Automation] notify error:', err.message)
  }
}

// ── Helper: get workspace owner for a project ─────────────────
async function getProjectOwner(projectId) {
  const { data } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()
  return data?.user_id || null
}

// ── Helper: get active rules for a user + optional project ────
async function getActiveRules(userId, triggerType, projectId = null) {
  let q = supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('trigger_type', triggerType)
    .eq('is_active', true)

  // Match rules scoped to this project OR workspace-wide (null project)
  if (projectId) {
    q = q.or(`project_id.is.null,project_id.eq.${projectId}`)
  } else {
    q = q.is('project_id', null)
  }

  const { data } = await q
  return data || []
}

// ── Trigger: status_change ────────────────────────────────────
// Called from PATCH /api/tasks/:id when status changes
export async function onStatusChange({ userId, task, fromStatus, toStatus }) {
  try {
    const rules = await getActiveRules(userId, 'status_change', task.project_id)
    for (const rule of rules) {
      const cfg = rule.trigger_config || {}
      // Match if rule specifies a to_status and it matches
      if (cfg.to_status && cfg.to_status !== toStatus) continue
      // Match if rule specifies a from_status and it matches
      if (cfg.from_status && cfg.from_status !== fromStatus) continue

      if (rule.action_type === 'notify') {
        const acfg     = rule.action_config || {}
        const recipient = acfg.notify_user_id || userId
        await notify(
          recipient,
          acfg.message || `Task "${task.title}" moved to ${toStatus}`,
          `Rule: ${rule.name}`,
          task.id
        )
      }
    }
  } catch (err) {
    console.error('[Automation] onStatusChange error:', err.message)
  }
}

// ── Trigger: discussion_saved ─────────────────────────────────
// Called from POST /api/discussions/save when a discussion is stored
export async function onDiscussionSaved({ userId, projectId, tasks: extractedTasks, discussionId }) {
  try {
    const rules = await getActiveRules(userId, 'discussion_saved', projectId)
    for (const rule of rules) {
      if (rule.action_type === 'create_tasks' && extractedTasks?.length) {
        const acfg = rule.action_config || {}
        if (acfg.auto_create === true) {
          // Auto-create tasks without user confirmation
          for (const t of extractedTasks) {
            try {
              await supabaseAdmin.from('tasks').insert({
                title:         t.title || t,
                project_id:    projectId,
                priority:      t.priority || 'medium',
                status:        'pending',
                discussion_id: discussionId || null,
              })
            } catch (e) {
              console.error('[Automation] create_task error:', e.message)
            }
          }
          // Notify user
          await notify(
            userId,
            `${extractedTasks.length} task${extractedTasks.length !== 1 ? 's' : ''} auto-created from discussion`,
            `Rule: ${rule.name}`
          )
        }
      }
    }
  } catch (err) {
    console.error('[Automation] onDiscussionSaved error:', err.message)
  }
}

// ── Trigger: overdue check ────────────────────────────────────
// Called periodically (from /api/automations/run-overdue or a cron endpoint)
export async function runOverdueCheck(userId) {
  try {
    const rules = await getActiveRules(userId, 'overdue')
    if (!rules.length) return { marked: 0, notified: 0 }

    const now = new Date().toISOString()

    // Find user's overdue tasks
    const projectIds = await getUserProjectIds(userId)
    if (!projectIds.length) return { marked: 0, notified: 0 }

    const { data: overdueTasks } = await supabaseAdmin
      .from('tasks')
      .select('id, title, assigned_to, project_id, status, due_date')
      .in('project_id', projectIds)
      .lt('due_date', now)
      .not('status', 'in', '("done","resolved","closed","released")')
      .neq('status', 'overdue')

    if (!overdueTasks?.length) return { marked: 0, notified: 0 }

    let marked = 0, notified = 0

    for (const rule of rules) {
      const acfg = rule.action_config || {}

      for (const task of overdueTasks) {
        // Skip if scoped to a specific project and this task isn't in it
        if (rule.project_id && rule.project_id !== task.project_id) continue

        if (acfg.mark_overdue !== false) {
          await supabaseAdmin.from('tasks').update({ status: 'overdue' }).eq('id', task.id)
          marked++
        }

        if (acfg.notify_assignee && task.assigned_to) {
          await notify(
            task.assigned_to,
            `Task overdue: "${task.title}"`,
            `This task's due date has passed.`,
            task.id
          )
          notified++
        }
        if (acfg.notify_owner) {
          await notify(
            userId,
            `Task overdue: "${task.title}"`,
            null,
            task.id
          )
        }
      }
    }

    return { marked, notified }
  } catch (err) {
    console.error('[Automation] runOverdueCheck error:', err.message)
    return { marked: 0, notified: 0, error: err.message }
  }
}

// ── Recurring task spawner ────────────────────────────────────
// Called when a task with recurrence_rule is marked done
export async function spawnRecurringTask(completedTask) {
  try {
    if (!completedTask.recurrence_rule || completedTask.recurrence_rule === 'none') return null

    const today = new Date()

    // Check recurrence_end
    if (completedTask.recurrence_end && new Date(completedTask.recurrence_end) < today) return null

    // Compute next due date
    let nextDue = completedTask.due_date ? new Date(completedTask.due_date) : new Date()
    switch (completedTask.recurrence_rule) {
      case 'daily':   nextDue.setDate(nextDue.getDate() + 1);    break
      case 'weekly':  nextDue.setDate(nextDue.getDate() + 7);    break
      case 'monthly': nextDue.setMonth(nextDue.getMonth() + 1);  break
      default: return null
    }

    // Don't spawn if next due is past recurrence_end
    if (completedTask.recurrence_end && nextDue > new Date(completedTask.recurrence_end)) return null

    const { data: newTask } = await supabaseAdmin
      .from('tasks')
      .insert({
        title:            completedTask.title,
        description:      completedTask.description,
        project_id:       completedTask.project_id,
        priority:         completedTask.priority,
        type:             completedTask.type,
        status:           'pending',
        assigned_to:      completedTask.assigned_to,
        assigned_by:      completedTask.assigned_by,
        recurrence_rule:  completedTask.recurrence_rule,
        recurrence_end:   completedTask.recurrence_end,
        parent_task_id:   completedTask.id,
        due_date:         nextDue.toISOString().slice(0, 10),
      })
      .select()
      .single()

    return newTask
  } catch (err) {
    console.error('[Automation] spawnRecurringTask error:', err.message)
    return null
  }
}

// ── Internal helper ───────────────────────────────────────────
async function getUserProjectIds(userId) {
  const [{ data: owned }, { data: membered }] = await Promise.all([
    supabaseAdmin.from('projects').select('id').eq('user_id', userId),
    supabaseAdmin.from('project_members').select('project_id').eq('user_id', userId),
  ])
  const ids = new Set([
    ...(owned    || []).map(p => p.id),
    ...(membered || []).map(m => m.project_id),
  ])
  return [...ids]
}
