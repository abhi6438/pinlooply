// ── Time Entries Routes ───────────────────────────────────────
// GET    /api/time-entries?task_id=&project_id=&from=&to=
// POST   /api/time-entries
// PATCH  /api/time-entries/:id
// DELETE /api/time-entries/:id
// GET    /api/time-entries/report?project_id=&from=&to=

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()
router.use(requireAuth)

// ── Helper: get project IDs the user can access ───────────────
async function getUserProjectIds(userId) {
  const [{ data: owned }, { data: membered }] = await Promise.all([
    supabaseAdmin.from('projects').select('id').eq('user_id', userId),
    supabaseAdmin.from('project_members').select('project_id').eq('user_id', userId),
  ])
  return [
    ...(owned    || []).map(p => p.id),
    ...(membered || []).map(m => m.project_id),
  ]
}

// GET /api/time-entries — list entries for the user
// Optional filters: task_id, project_id, from (YYYY-MM-DD), to (YYYY-MM-DD)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id
    const { task_id, project_id, from, to } = req.query

    let query = supabaseAdmin
      .from('time_entries')
      .select(`
        id, task_id, user_id, duration_mins, notes, logged_at, created_at,
        task:tasks(id, title, project_id, projects(id, name, color))
      `)
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (task_id)   query = query.eq('task_id', task_id)
    if (from)      query = query.gte('logged_at', from)
    if (to)        query = query.lte('logged_at', to)

    // Filter by project: get task_ids in that project first
    if (project_id) {
      const { data: tasks } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('project_id', project_id)
      const taskIds = (tasks || []).map(t => t.id)
      if (!taskIds.length) return res.json({ data: [] })
      query = query.in('task_id', taskIds)
    }

    const { data, error } = await query
    if (error) throw error
    res.json({ data: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/time-entries/report — aggregate time per project/task/user
router.get('/report', async (req, res) => {
  try {
    const userId = req.user.id
    const { project_id, from, to } = req.query

    // Get all accessible project IDs if no specific project
    let projectIds = project_id ? [project_id] : await getUserProjectIds(userId)
    if (!projectIds.length) return res.json({ data: { total_mins: 0, by_project: [], by_task: [] } })

    // Get all tasks in scope
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('id, title, project_id, projects(id, name, color)')
      .in('project_id', projectIds)

    const taskIds = (tasks || []).map(t => t.id)
    if (!taskIds.length) return res.json({ data: { total_mins: 0, by_project: [], by_task: [] } })

    const taskMap = Object.fromEntries((tasks || []).map(t => [t.id, t]))

    // Get time entries for those tasks (this user's entries)
    let q = supabaseAdmin
      .from('time_entries')
      .select('task_id, duration_mins, logged_at')
      .eq('user_id', userId)
      .in('task_id', taskIds)

    if (from) q = q.gte('logged_at', from)
    if (to)   q = q.lte('logged_at', to)

    const { data: entries, error } = await q
    if (error) throw error

    // Aggregate
    const byTask    = {}
    const byProject = {}
    let total = 0

    for (const e of (entries || [])) {
      total += e.duration_mins
      const task = taskMap[e.task_id]
      if (!task) continue
      const pid = task.project_id

      if (!byTask[e.task_id]) byTask[e.task_id] = { task_id: e.task_id, title: task.title, project_id: pid, total_mins: 0 }
      byTask[e.task_id].total_mins += e.duration_mins

      if (!byProject[pid]) byProject[pid] = { project_id: pid, project: task.projects, total_mins: 0, task_count: new Set() }
      byProject[pid].total_mins += e.duration_mins
      byProject[pid].task_count.add(e.task_id)
    }

    // Serialize sets
    const by_project = Object.values(byProject).map(p => ({ ...p, task_count: p.task_count.size }))
      .sort((a, b) => b.total_mins - a.total_mins)
    const by_task = Object.values(byTask).sort((a, b) => b.total_mins - a.total_mins)

    res.json({ data: { total_mins: total, by_project, by_task } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/time-entries — log time
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id
    const { task_id, duration_mins, notes, logged_at } = req.body

    if (!task_id)                                  return res.status(400).json({ error: 'task_id is required' })
    if (!duration_mins || duration_mins <= 0)      return res.status(400).json({ error: 'duration_mins must be > 0' })

    // Verify task access
    const projectIds = await getUserProjectIds(userId)
    const { data: task } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('id', task_id)
      .in('project_id', projectIds)
      .maybeSingle()

    if (!task) return res.status(403).json({ error: 'Task not found or access denied' })

    const { data, error } = await supabaseAdmin
      .from('time_entries')
      .insert({
        task_id,
        user_id:      userId,
        duration_mins: parseInt(duration_mins),
        notes:        notes || null,
        logged_at:    logged_at || new Date().toISOString().slice(0, 10),
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/time-entries/:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const { duration_mins, notes, logged_at } = req.body

    const patch = {}
    if (duration_mins !== undefined) patch.duration_mins = parseInt(duration_mins)
    if (notes         !== undefined) patch.notes         = notes || null
    if (logged_at     !== undefined) patch.logged_at     = logged_at

    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update' })

    const { data, error } = await supabaseAdmin
      .from('time_entries')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Entry not found' })
    res.json({ data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/time-entries/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { error } = await supabaseAdmin
      .from('time_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
