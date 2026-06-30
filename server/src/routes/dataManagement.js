// ── Data Management Routes ────────────────────────────────────
// Accessible to group owners and admins
//
// GET  /api/data-management/projects          — list all projects
// GET  /api/data-management/tasks             — list all tasks
// GET  /api/data-management/members           — list all group members
// GET  /api/data-management/groups            — list all groups user owns/admins
// DELETE /api/data-management/projects/:id   — delete a project + its tasks/discussions
// DELETE /api/data-management/tasks/:id      — delete a task
// DELETE /api/data-management/members/:id    — remove a member from a group
// DELETE /api/data-management/groups/:id     — delete an entire group
// POST  /api/data-management/groups/merge    — merge source group into target group

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()
router.use(requireAuth)

// ── Helper: get groups where user is owner or admin ───────────
async function getAdminGroupIds(userId) {
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
  return (data || []).map(r => r.group_id)
}

// ── GET /api/data-management/projects ────────────────────────
router.get('/projects', async (req, res) => {
  const userId = req.user.id
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('id, name, description, color, created_at, owner_id, users(name, email)')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error

    // attach task counts
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id, project_id')
      .in('project_id', (data || []).map(p => p.id))

    const countMap = {}
    for (const t of tasks || []) {
      countMap[t.project_id] = (countMap[t.project_id] || 0) + 1
    }

    res.json({ success: true, data: (data || []).map(p => ({ ...p, task_count: countMap[p.id] || 0 })) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/data-management/tasks ────────────────────────────
router.get('/tasks', async (req, res) => {
  const userId = req.user.id
  const { project_id } = req.query
  try {
    // Get projects owned by user
    const { data: projects } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('owner_id', userId)
    const projectIds = (projects || []).map(p => p.id)
    if (!projectIds.length) return res.json({ success: true, data: [] })

    let query = supabaseAdmin
      .from('tasks')
      .select('id, title, status, priority, due_date, created_at, project_id, projects(id, name, color)')
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })

    if (project_id) query = query.eq('project_id', project_id)

    const { data, error } = await query
    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/data-management/members ─────────────────────────
router.get('/members', async (req, res) => {
  const userId = req.user.id
  try {
    const groupIds = await getAdminGroupIds(userId)
    if (!groupIds.length) return res.json({ success: true, data: [] })

    const { data, error } = await supabaseAdmin
      .from('group_members')
      .select('id, role, joined_at, group_id, user_id, groups(id, name), users(id, name, email, avatar_url)')
      .in('group_id', groupIds)
      .neq('user_id', userId) // don't list yourself
      .order('joined_at', { ascending: false })
    if (error) throw error
    res.json({ success: true, data: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/data-management/groups ──────────────────────────
router.get('/groups', async (req, res) => {
  const userId = req.user.id
  try {
    const groupIds = await getAdminGroupIds(userId)
    if (!groupIds.length) return res.json({ success: true, data: [] })

    const { data, error } = await supabaseAdmin
      .from('groups')
      .select('id, name, created_at, invite_code, owner_id')
      .in('id', groupIds)
      .order('created_at', { ascending: false })
    if (error) throw error

    // attach member counts
    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .in('group_id', groupIds)

    const countMap = {}
    for (const m of members || []) {
      countMap[m.group_id] = (countMap[m.group_id] || 0) + 1
    }

    res.json({ success: true, data: (data || []).map(g => ({ ...g, member_count: countMap[g.id] || 0 })) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/data-management/projects/:id ─────────────────
router.delete('/projects/:id', async (req, res) => {
  const userId = req.user.id
  const { id } = req.params
  try {
    // Only owner can delete
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, owner_id')
      .eq('id', id)
      .maybeSingle()
    if (!project) return res.status(404).json({ error: 'Project not found' })
    if (project.owner_id !== userId) return res.status(403).json({ error: 'Only the project owner can delete it' })

    // Cascade: delete tasks, discussions, topics first (FK constraints)
    await supabaseAdmin.from('tasks').delete().eq('project_id', id)
    await supabaseAdmin.from('discussions').delete().eq('project_id', id)
    await supabaseAdmin.from('topics').delete().eq('project_id', id)
    const { error } = await supabaseAdmin.from('projects').delete().eq('id', id)
    if (error) throw error

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/data-management/tasks/:id ────────────────────
router.delete('/tasks/:id', async (req, res) => {
  const userId = req.user.id
  const { id } = req.params
  try {
    // Verify task belongs to a project the user owns
    const { data: task } = await supabaseAdmin
      .from('tasks')
      .select('id, project_id, projects(owner_id)')
      .eq('id', id)
      .maybeSingle()
    if (!task) return res.status(404).json({ error: 'Task not found' })
    if (task.projects?.owner_id !== userId) return res.status(403).json({ error: 'Not authorized' })

    const { error } = await supabaseAdmin.from('tasks').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/data-management/members/:id ──────────────────
// :id is the group_members row id
router.delete('/members/:id', async (req, res) => {
  const userId = req.user.id
  const { id } = req.params
  try {
    const { data: member } = await supabaseAdmin
      .from('group_members')
      .select('id, group_id, user_id, role')
      .eq('id', id)
      .maybeSingle()
    if (!member) return res.status(404).json({ error: 'Member not found' })

    // Must be admin/owner of that group
    const { data: myRole } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', member.group_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (!myRole || !['owner', 'admin'].includes(myRole.role)) {
      return res.status(403).json({ error: 'Not authorized' })
    }
    // Can't remove the owner
    if (member.role === 'owner') return res.status(400).json({ error: 'Cannot remove the group owner' })

    const { error } = await supabaseAdmin.from('group_members').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/data-management/groups/:id ───────────────────
router.delete('/groups/:id', async (req, res) => {
  const userId = req.user.id
  const { id } = req.params
  try {
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('id, owner_id')
      .eq('id', id)
      .maybeSingle()
    if (!group) return res.status(404).json({ error: 'Group not found' })
    if (group.owner_id !== userId) return res.status(403).json({ error: 'Only the group owner can delete it' })

    // Remove all members first, then the group
    await supabaseAdmin.from('group_members').delete().eq('group_id', id)
    const { error } = await supabaseAdmin.from('groups').delete().eq('id', id)
    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/data-management/groups/merge ───────────────────
// Merges source_group_id into target_group_id.
// All members of source are added to target; source is deleted.
// Requester must be owner of BOTH groups.
router.post('/groups/merge', async (req, res) => {
  const userId = req.user.id
  const { target_group_id, source_group_id } = req.body || {}

  if (!target_group_id || !source_group_id) {
    return res.status(400).json({ error: 'target_group_id and source_group_id are required' })
  }
  if (target_group_id === source_group_id) {
    return res.status(400).json({ error: 'Cannot merge a group into itself' })
  }

  try {
    // Verify user is admin/owner of both groups
    const adminGroupIds = await getAdminGroupIds(userId)
    if (!adminGroupIds.includes(target_group_id) || !adminGroupIds.includes(source_group_id)) {
      return res.status(403).json({ error: 'You must be admin or owner of both groups' })
    }

    // Get all members of source group
    const { data: sourceMembers } = await supabaseAdmin
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', source_group_id)

    // Get existing members of target group (to avoid duplicates)
    const { data: targetMembers } = await supabaseAdmin
      .from('group_members')
      .select('user_id')
      .eq('group_id', target_group_id)
    const existingUserIds = new Set((targetMembers || []).map(m => m.user_id))

    // Add source members that aren't already in target (demote owners to member)
    const toInsert = (sourceMembers || [])
      .filter(m => !existingUserIds.has(m.user_id))
      .map(m => ({
        group_id: target_group_id,
        user_id:  m.user_id,
        role:     m.role === 'owner' ? 'member' : m.role,
      }))

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabaseAdmin
        .from('group_members')
        .insert(toInsert)
      if (insertErr) throw insertErr
    }

    // Delete the source group members then the group itself
    await supabaseAdmin.from('group_members').delete().eq('group_id', source_group_id)
    const { error: deleteErr } = await supabaseAdmin.from('groups').delete().eq('id', source_group_id)
    if (deleteErr) throw deleteErr

    res.json({ success: true, merged_members: toInsert.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
