import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// ── Helper: get all project IDs the user owns or is a member of ──
async function getUserProjectIds(userId) {
  const { data: owned } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('user_id', userId)

  const { data: membered } = await supabaseAdmin
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)

  const ids = new Set([
    ...(owned || []).map(p => p.id),
    ...(membered || []).map(m => m.project_id),
  ])
  return [...ids]
}

// ── Helper: verify user can access a task ───────────────────────
async function canAccessTask(taskId, userId) {
  const projectIds = await getUserProjectIds(userId)
  if (!projectIds.length) return false
  const { data } = await supabaseAdmin
    .from('tasks')
    .select('id')
    .eq('id', taskId)
    .in('project_id', projectIds)
    .single()
  return !!data
}

// ── GET /api/tasks — all tasks for user with optional filters ───
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { type, status, project_id, priority, assignee, show_done } = req.query

  const projectIds = await getUserProjectIds(userId)
  if (!projectIds.length) return res.json({ success: true, data: [] })

  let query = supabaseAdmin
    .from('tasks')
    .select(`
      id, title, description, type, status, priority,
      due_date, created_at, updated_at,
      project_id, topic_id, discussion_id,
      projects(id, name, color),
      topics(id, title),
      assigned_user:assigned_to(id, name, avatar_url)
    `)
    .in('project_id', project_id ? [project_id] : projectIds)
    .order('created_at', { ascending: false })

  if (type)     query = query.eq('type', type)
  if (priority) query = query.eq('priority', priority)
  if (assignee) query = query.eq('assigned_to', assignee)

  // Default: hide done tasks unless show_done=true
  if (show_done !== 'true') {
    query = query.neq('status', 'done')
  }
  if (status && show_done === 'true') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true, data: data || [] })
})

// ── POST /api/tasks — create a task manually ────────────────────
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { title, type = 'task', priority = 'medium', project_id, due_date, description } = req.body

  if (!title?.trim()) return res.status(400).json({ error: 'title is required' })
  if (!project_id)    return res.status(400).json({ error: 'project_id is required' })

  // Verify access
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
      assigned_by: userId,
      status: 'pending',
    })
    .select(`
      id, title, description, type, status, priority,
      due_date, created_at, updated_at,
      project_id, topic_id,
      projects(id, name, color),
      topics(id, title),
      assigned_user:assigned_to(id, name, avatar_url)
    `)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ success: true, data })
})

// ── PATCH /api/tasks/bulk — bulk update ─────────────────────────
// Must come BEFORE /:taskId to avoid param capture
router.patch('/bulk', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { task_ids, updates } = req.body

  if (!Array.isArray(task_ids) || !task_ids.length) {
    return res.status(400).json({ error: 'task_ids array required' })
  }
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates object required' })
  }

  // Whitelist updatable fields for bulk
  const allowed = ['status', 'priority', 'assigned_to']
  const patch = {}
  for (const k of allowed) {
    if (updates[k] !== undefined) patch[k] = updates[k]
  }
  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  // Verify user owns all tasks via project membership
  const projectIds = await getUserProjectIds(userId)
  if (!projectIds.length) return res.status(403).json({ error: 'Access denied' })

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .in('id', task_ids)
    .in('project_id', projectIds)
    .select('id, status, priority')

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true, data, updated: data?.length ?? 0 })
})

// ── PATCH /api/tasks/:taskId — update single task ───────────────
router.patch('/:taskId', requireAuth, async (req, res) => {
  const { taskId } = req.params
  const userId = req.user.id

  const allowed = ['status', 'priority', 'assigned_to', 'title', 'description', 'due_date']
  const patch = {}
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k]
  }

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  if (!(await canAccessTask(taskId, userId))) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select(`
      id, title, description, type, status, priority,
      due_date, created_at, updated_at,
      project_id, topic_id,
      projects(id, name, color),
      topics(id, title),
      assigned_user:assigned_to(id, name, avatar_url)
    `)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true, data })
})

// ── DELETE /api/tasks/:taskId ────────────────────────────────────
router.delete('/:taskId', requireAuth, async (req, res) => {
  const { taskId } = req.params
  const userId = req.user.id

  if (!(await canAccessTask(taskId, userId))) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true })
})

export default router
