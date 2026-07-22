// ── Manager Routes ────────────────────────────────────────────
// GET  /api/manager/overview   — team task stats (owner only)
// GET  /api/manager/member/:userId — single member's task detail

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()
router.use(requireAuth)

// ── Helper: get group where current user is owner ─────────────
async function getOwnedGroup(userId) {
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('group_id, groups(id, name)')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .maybeSingle()
  return data?.groups || null
}

// ── GET /api/manager/overview ─────────────────────────────────
// Returns per-member task stats for the owner's group
router.get('/overview', async (req, res) => {
  const userId = req.user.id
  const { group_id } = req.query

  try {
    let groupId = null
    let groupName = ''

    if (group_id && group_id !== 'personal') {
      // Verify user is owner/admin of the requested group
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('group_id, groups(id, name)')
        .eq('user_id', userId)
        .eq('group_id', group_id)
        .in('role', ['owner', 'admin'])
        .maybeSingle()
      if (!membership) {
        return res.status(403).json({ error: 'Manager access requires owner or admin role' })
      }
      groupId = membership.group_id
      groupName = membership.groups?.name || ''
    } else {
      // Personal workspace — no team group; fall back to auto-detect
      const group = await getOwnedGroup(userId)
      groupId = group?.id
      groupName = group?.name || ''
      if (!groupId) {
        const { data: adminMembership } = await supabaseAdmin
          .from('group_members')
          .select('group_id, groups(id, name)')
          .eq('user_id', userId)
          .in('role', ['owner', 'admin'])
          .maybeSingle()
        if (!adminMembership) {
          return res.status(403).json({ error: 'Manager access requires owner or admin role' })
        }
        groupId = adminMembership.group_id
        groupName = adminMembership.groups?.name || ''
      }
    }

    // Get all members of this group
    const { data: members, error: membErr } = await supabaseAdmin
      .from('group_members')
      .select('user_id, role, joined_at, users(id, name, email, avatar_url)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })

    if (membErr) throw membErr

    // Get projects belonging to this group, then fetch tasks in those projects
    const { data: groupProjects } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('group_id', groupId)
    const groupProjectIds = (groupProjects || []).map(p => p.id)

    let tasksQuery = supabaseAdmin
      .from('tasks')
      .select('id, title, status, priority, due_date, assigned_to, project_id, projects(id, name, color)')
    if (groupProjectIds.length) {
      tasksQuery = tasksQuery.in('project_id', groupProjectIds)
    } else {
      // No projects in this group — return empty
      tasksQuery = tasksQuery.eq('project_id', '__none__')
    }
    const { data: tasks, error: taskErr } = await tasksQuery

    if (taskErr) throw taskErr

    const now = new Date()

    // Build per-member stats
    const memberStats = (members || []).map(m => {
      const u = m.users || {}
      const memberTasks = (tasks || []).filter(t => t.assigned_to === u.id)

      const total    = memberTasks.length
      const done     = memberTasks.filter(t => t.status === 'done' || t.status === 'resolved' || t.status === 'closed' || t.status === 'graded' || t.status === 'won').length
      const overdue  = memberTasks.filter(t => {
        if (!t.due_date) return false
        const isDone = t.status === 'done' || t.status === 'resolved' || t.status === 'closed'
        return !isDone && new Date(t.due_date) < now
      }).length
      const inProgress = memberTasks.filter(t =>
        t.status === 'in_progress' || t.status === 'in_review' || t.status === 'under_review'
      ).length
      const blocked = memberTasks.filter(t => t.status === 'blocked').length
      const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

      // Recent tasks (top 3 in-progress or overdue)
      const activeTasks = memberTasks
        .filter(t => t.status !== 'done' && t.status !== 'resolved' && t.status !== 'closed')
        .sort((a, b) => {
          // Overdue first, then by due_date
          const aOverdue = a.due_date && new Date(a.due_date) < now
          const bOverdue = b.due_date && new Date(b.due_date) < now
          if (aOverdue && !bOverdue) return -1
          if (!aOverdue && bOverdue) return 1
          if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date)
          return 0
        })
        .slice(0, 5)

      return {
        user: {
          id:         u.id,
          name:       u.name || u.email || 'Unknown',
          email:      u.email,
          avatar_url: u.avatar_url,
        },
        role:           m.role,
        joined_at:      m.joined_at,
        stats: {
          total,
          done,
          overdue,
          in_progress: inProgress,
          blocked,
          completion_rate: completionRate,
        },
        active_tasks: activeTasks.map(t => ({
          id:         t.id,
          title:      t.title,
          status:     t.status,
          priority:   t.priority,
          due_date:   t.due_date,
          project:    t.projects,
          is_overdue: t.due_date && new Date(t.due_date) < now,
        })),
      }
    })

    // Group-level summary
    const allAssigned = (tasks || []).filter(t =>
      (members || []).some(m => m.users?.id === t.assigned_to)
    )
    const groupSummary = {
      group_id:         groupId,
      group_name:       groupName,
      member_count:     members?.length || 0,
      total_tasks:      allAssigned.length,
      done_tasks:       allAssigned.filter(t => t.status === 'done' || t.status === 'resolved' || t.status === 'closed').length,
      overdue_tasks:    allAssigned.filter(t => {
        if (!t.due_date) return false
        const isDone = t.status === 'done' || t.status === 'resolved' || t.status === 'closed'
        return !isDone && new Date(t.due_date) < now
      }).length,
      blocked_tasks:    allAssigned.filter(t => t.status === 'blocked').length,
    }

    res.json({ success: true, data: { summary: groupSummary, members: memberStats } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/manager/member/:memberId/tasks ───────────────────
// Full task list for one member (for drill-down)
router.get('/member/:memberId/tasks', async (req, res) => {
  const userId   = req.user.id
  const { memberId } = req.params

  try {
    // Verify requester is owner/admin of a shared group
    const { data: sharedGroups } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin'])

    if (!sharedGroups?.length) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const { data: tasks, error } = await supabaseAdmin
      .from('tasks')
      .select('id, title, status, priority, due_date, created_at, project_id, projects(id, name, color)')
      .eq('assigned_to', memberId)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (error) throw error
    res.json({ success: true, data: tasks || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
