import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { onStatusChange, spawnRecurringTask } from '../services/automationEngine.js'

const router = Router()

// ── Helper: get all project IDs the user can access ──────────────
// Includes: projects the user owns, projects they're a member of,
// and ALL projects belonging to any group the user is in.
async function getUserProjectIds(userId) {
  const [{ data: owned }, { data: membered }, { data: groupMemberships }] = await Promise.all([
    supabaseAdmin.from('projects').select('id').eq('user_id', userId),
    supabaseAdmin.from('project_members').select('project_id').eq('user_id', userId),
    supabaseAdmin.from('group_members').select('group_id').eq('user_id', userId),
  ])

  const ids = new Set([
    ...(owned    || []).map(p => p.id),
    ...(membered || []).map(m => m.project_id),
  ])

  // Add all projects that belong to any group the user is a member of
  const groupIds = (groupMemberships || []).map(g => g.group_id)
  if (groupIds.length) {
    const { data: groupProjects } = await supabaseAdmin
      .from('projects')
      .select('id')
      .in('group_id', groupIds)
    ;(groupProjects || []).forEach(p => ids.add(p.id))
  }

  return [...ids]
}

// ── Helper: verify user can access a task ───────────────────────
async function canAccessTask(taskId, userId) {
  const projectIds = await getUserProjectIds(userId)
  if (!projectIds.length) return null
  const { data } = await supabaseAdmin
    .from('tasks')
    .select('id, title, assigned_to, assigned_by, status')
    .eq('id', taskId)
    .in('project_id', projectIds)
    .maybeSingle()
  return data  // returns task data or null
}

// ── Helper: create a notification ───────────────────────────────
async function createNotification({ userId, type, title, body, relatedTaskId }) {
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body: body || null,
      related_task_id: relatedTaskId || null,
    })
  } catch (err) {
    // Non-fatal — log but don't break the request
    console.error('Create notification error:', err.message)
  }
}

const TASK_SELECT = `
  id, title, description, type, status, priority,
  due_date, created_at, updated_at, assigned_to_name,
  project_id, topic_id, discussion_id,
  projects(id, name, color),
  topics(id, title),
  assigned_user:assigned_to(id, name, avatar_url),
  assigner:assigned_by(id, name)
`

// ── GET /api/tasks ───────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { type, status, project_id, priority, assignee, show_done, mine, assigned_by_me } = req.query

    const projectIds = await getUserProjectIds(userId)
    if (!projectIds.length) return res.json({ success: true, data: [] })

    let query = supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .in('project_id', project_id ? [project_id] : projectIds)
      .order('created_at', { ascending: false })

    if (type)          query = query.eq('type', type)
    if (priority)      query = query.eq('priority', priority)
    if (assignee)      query = query.eq('assigned_to', assignee)
    if (mine === 'true')           query = query.eq('assigned_to', userId)
    if (assigned_by_me === 'true') query = query.eq('assigned_by', userId)

    if (show_done !== 'true') {
      query = query.neq('status', 'done')
    }
    if (status && show_done === 'true') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('List tasks error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── POST /api/tasks ──────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { title, type = 'task', priority = 'medium', project_id, due_date, description, assigned_to } = req.body

    if (!title?.trim()) return res.status(400).json({ error: 'title is required' })
    if (!project_id)    return res.status(400).json({ error: 'project_id is required' })

    const projectIds = await getUserProjectIds(userId)
    if (!projectIds.includes(project_id)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        title: title.trim(),
        type,
        priority,
        project_id,
        due_date: due_date || null,
        description: description || null,
        assigned_to: assigned_to || null,
        assigned_by: userId,
        status: 'pending',
      })
      .select(TASK_SELECT)
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Notify assignee if assigning to someone else
    if (assigned_to && assigned_to !== userId) {
      await createNotification({
        userId: assigned_to,
        type: 'task_assigned',
        title: 'New task assigned to you',
        body: `"${title.trim()}"`,
        relatedTaskId: data.id,
      })
    }

    return res.status(201).json({ success: true, data })
  } catch (err) {
    console.error('Create task error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/tasks/bulk ────────────────────────────────────
router.patch('/bulk', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { task_ids, updates } = req.body

    if (!Array.isArray(task_ids) || !task_ids.length) {
      return res.status(400).json({ error: 'task_ids array required' })
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'updates object required' })
    }

    const allowed = ['status', 'priority', 'assigned_to']
    const patch = {}
    for (const k of allowed) {
      if (updates[k] !== undefined) patch[k] = updates[k]
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const projectIds = await getUserProjectIds(userId)
    if (!projectIds.length) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .in('id', task_ids)
      .in('project_id', projectIds)
      .select('id, status, priority, title')

    if (error) return res.status(500).json({ error: error.message })

    // Notify assignee for bulk assignment
    if (patch.assigned_to && patch.assigned_to !== userId && data?.length) {
      for (const task of data) {
        await createNotification({
          userId: patch.assigned_to,
          type: 'task_assigned',
          title: 'Task assigned to you',
          body: `"${task.title}"`,
          relatedTaskId: task.id,
        })
      }
    }

    return res.json({ success: true, data, updated: data?.length ?? 0 })
  } catch (err) {
    console.error('Bulk update error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/tasks/:taskId/assign — dedicated assign + notify
router.patch('/:taskId/assign', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params
    const userId = req.user.id
    const { assigned_to } = req.body || {}

    const existing = await canAccessTask(taskId, userId)
    if (!existing) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update({ assigned_to: assigned_to || null, assigned_by: userId, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select(TASK_SELECT)
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Notify if assigned to someone other than the assigner
    if (assigned_to && assigned_to !== userId) {
      const assignerName = data.assigner?.name || 'Someone'
      await createNotification({
        userId: assigned_to,
        type: 'task_assigned',
        title: 'Task assigned to you',
        body: `${assignerName} assigned "${existing.title}" to you`,
        relatedTaskId: taskId,
      })
    }

    return res.json({ success: true, data })
  } catch (err) {
    console.error('Assign task error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── GET /api/tasks/:taskId ───────────────────────────────────
router.get('/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params
    const userId = req.user.id

    const existing = await canAccessTask(taskId, userId)
    if (!existing) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', taskId)
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true, data })
  } catch (err) {
    console.error('Get task error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/tasks/:taskId ─────────────────────────────────
router.patch('/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params
    const userId = req.user.id

    const allowed = ['status', 'priority', 'assigned_to', 'title', 'description', 'due_date', 'recurrence_rule', 'recurrence_end']
    const patch = {}
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k]
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const existing = await canAccessTask(taskId, userId)
    if (!existing) return res.status(403).json({ error: 'Access denied' })

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select(TASK_SELECT)
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Notification: task assigned to a new person
    if (patch.assigned_to && patch.assigned_to !== existing.assigned_to && patch.assigned_to !== userId) {
      const assignerName = data.assigner?.name || 'Someone'
      await createNotification({
        userId: patch.assigned_to,
        type: 'task_assigned',
        title: 'Task assigned to you',
        body: `${assignerName} assigned "${existing.title}" to you`,
        relatedTaskId: taskId,
      })
    }

    // Notification: task completed — notify assigner
    if (patch.status === 'done' && existing.status !== 'done' && existing.assigned_by && existing.assigned_by !== userId) {
      await createNotification({
        userId: existing.assigned_by,
        type: 'task_completed',
        title: 'Task completed',
        body: `"${existing.title}" has been marked as done`,
        relatedTaskId: taskId,
      })
    }

    // Automation: fire status_change trigger (non-blocking)
    if (patch.status && patch.status !== existing.status) {
      onStatusChange({
        userId,
        task: { id: taskId, title: existing.title, project_id: data.project_id },
        fromStatus: existing.status,
        toStatus: patch.status,
      }).catch(() => {})

      // Recurring task: spawn next instance when marked done
      if (patch.status === 'done' && data.recurrence_rule && data.recurrence_rule !== 'none') {
        spawnRecurringTask(data).catch(() => {})
      }
    }

    return res.json({ success: true, data })
  } catch (err) {
    console.error('Update task error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/tasks/:taskId ────────────────────────────────
router.delete('/:taskId', requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params
    const userId = req.user.id

    const existing = await canAccessTask(taskId, userId)
    if (!existing) return res.status(403).json({ error: 'Access denied' })

    const { error } = await supabaseAdmin.from('tasks').delete().eq('id', taskId)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  } catch (err) {
    console.error('Delete task error:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
