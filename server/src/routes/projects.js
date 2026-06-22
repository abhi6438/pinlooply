import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { checkProjectLimit } from '../middleware/planCheck.js'

const router = Router()

// ── Helper: health from overdue task count ────────────────────────
function calcHealth(overdueCount, deadlineSoon) {
  if (overdueCount >= 4) return 'behind'
  if (overdueCount >= 1 || deadlineSoon) return 'at_risk'
  return 'good'
}

// ── GET /api/projects — all projects for user ─────────────────────
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id
  const now = new Date().toISOString()
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString()

  // Owned + membered projects
  const { data: owned } = await supabaseAdmin
    .from('projects')
    .select('id, name, description, color, created_at, user_id')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  const { data: membered } = await supabaseAdmin
    .from('project_members')
    .select('project_id, projects(id, name, description, color, created_at, user_id, archived)')
    .eq('user_id', userId)

  const memberProjects = (membered || [])
    .map(m => m.projects)
    .filter(p => p && p.status !== 'archived')

  // Merge, deduplicate
  const allProjects = [...(owned || []), ...memberProjects]
  const seen = new Set()
  const projects = allProjects.filter(p => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  if (!projects.length) return res.json({ success: true, data: [] })

  const projectIds = projects.map(p => p.id)

  // Tasks per project
  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, project_id, type, status, due_date')
    .in('project_id', projectIds)

  // Topics per project
  const { data: topics } = await supabaseAdmin
    .from('topics')
    .select('id, project_id, updated_at')
    .in('project_id', projectIds)

  // Discussions per project (for last activity)
  const { data: discs } = await supabaseAdmin
    .from('discussions')
    .select('id, project_id, created_at')
    .in('project_id', projectIds)
    .order('created_at', { ascending: false })

  const result = projects.map(p => {
    const pTasks   = (tasks  || []).filter(t => t.project_id === p.id)
    const pTopics  = (topics || []).filter(t => t.project_id === p.id)
    const pDiscs   = (discs  || []).filter(d => d.project_id === p.id)

    const pendingTasks    = pTasks.filter(t => t.status !== 'done' && t.type !== 'test_case')
    const testCases       = pTasks.filter(t => t.type === 'test_case')
    const overdueTasks    = pendingTasks.filter(t => t.due_date && t.due_date < now)
    const deadlineSoon    = pendingTasks.some(t => t.due_date && t.due_date >= now && t.due_date <= in3days)

    // Last activity: max of latest discussion, topic update, task update
    const dates = [
      pDiscs[0]?.created_at,
      ...pTopics.map(t => t.updated_at),
    ].filter(Boolean)
    const lastActivity = dates.length ? dates.sort().reverse()[0] : p.created_at

    return {
      id:            p.id,
      name:          p.name,
      description:   p.description,
      color:         p.color || '#6366f1',
      health:        calcHealth(overdueTasks.length, deadlineSoon),
      pending_tasks: pendingTasks.length,
      test_cases:    testCases.length,
      topics_count:  pTopics.length,
      last_activity: lastActivity,
      created_at:    p.created_at,
    }
  })

  res.json({ success: true, data: result })
})

// ── POST /api/projects — create project ───────────────────────────
router.post('/', requireAuth, checkProjectLimit, async (req, res) => {
  const userId = req.user.id
  const { name, description, color } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })

  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({ name: name.trim(), description: description?.trim() || null, color: color || '#6366f1', user_id: userId })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, data })
})

// ── PATCH /api/projects/:projectId — update project ───────────────
router.patch('/:projectId', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { projectId } = req.params
  const { name, description, color } = req.body

  // Only owner can edit
  const { data: proj } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (!proj || proj.user_id !== userId)
    return res.status(403).json({ error: 'Forbidden' })

  const patch = {}
  if (name !== undefined)        patch.name        = name.trim()
  if (description !== undefined) patch.description = description?.trim() || null
  if (color !== undefined)       patch.color       = color

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(patch)
    .eq('id', projectId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, data })
})

// ── DELETE /api/projects/:projectId — archive project ─────────────
router.delete('/:projectId', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { projectId } = req.params

  const { data: proj } = await supabaseAdmin
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (!proj || proj.user_id !== userId)
    return res.status(403).json({ error: 'Forbidden' })

  const { error } = await supabaseAdmin
    .from('projects')
    .update({ status: 'archived' })
    .eq('id', projectId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// ── GET /api/projects/:projectId/stats — health stats ─────────────
router.get('/:projectId/stats', requireAuth, async (req, res) => {
  const { projectId } = req.params
  const now = new Date().toISOString()
  const in3days = new Date(Date.now() + 3 * 86400000).toISOString()

  const [
    { data: tasks },
    { data: topics },
    { data: conflicts },
    { data: discs },
    { data: members },
  ] = await Promise.all([
    supabaseAdmin.from('tasks').select('id, type, status, due_date, priority, title, updated_at').eq('project_id', projectId),
    supabaseAdmin.from('topics').select('id, title, status, updated_at').eq('project_id', projectId),
    supabaseAdmin.from('conflicts').select('id, description, detected_at').eq('project_id', projectId).order('detected_at', { ascending: false }).limit(5),
    supabaseAdmin.from('discussions').select('id, ai_summary, raw_text, created_at, users(name)').eq('project_id', projectId).order('created_at', { ascending: false }).limit(5),
    supabaseAdmin.from('project_members').select('id, role, users(id, name, avatar_url)').eq('project_id', projectId),
  ])

  const pendingTasks = (tasks || []).filter(t => t.status !== 'done' && t.type !== 'test_case')
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < now)
  const deadlineSoon = pendingTasks.some(t => t.due_date && t.due_date >= now && t.due_date <= in3days)

  res.json({
    success: true,
    data: {
      health:         calcHealth(overdueTasks.length, deadlineSoon),
      tasks_total:    (tasks || []).length,
      tasks_pending:  pendingTasks.length,
      tasks_done:     (tasks || []).filter(t => t.status === 'done').length,
      tasks_overdue:  overdueTasks.length,
      test_cases:     (tasks || []).filter(t => t.type === 'test_case').length,
      topics_total:   (topics || []).length,
      topics_open:    (topics || []).filter(t => t.status !== 'resolved').length,
      conflicts_open: (conflicts || []).length,
      members:        members || [],
      recent_discussions: discs || [],
      recent_conflicts:   conflicts || [],
      high_priority_tasks: (tasks || []).filter(t => t.priority === 'high' && t.status !== 'done'),
    }
  })
})

export default router
