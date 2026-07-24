import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// ── Shared helper: fetch and compute project status data ──────────────
async function fetchProjectData(projectId) {
  const now      = new Date().toISOString()
  const in3days  = new Date(Date.now() + 3 * 86400000).toISOString()

  const [
    { data: project, error: projectErr },
    { data: tasks },
    { data: topics },
    { data: discussions },
  ] = await Promise.all([
    supabaseAdmin
      .from('projects')
      .select('id, name, description, color, created_at')
      .eq('id', projectId)
      .maybeSingle(),

    supabaseAdmin
      .from('tasks')
      .select('id, title, type, status, priority, due_date')
      .eq('project_id', projectId)
      .order('priority', { ascending: true })
      .limit(100),

    supabaseAdmin
      .from('topics')
      .select('id, title, summary, status, updated_at')
      .eq('project_id', projectId)
      .eq('status', 'open')
      .order('updated_at', { ascending: false })
      .limit(5),

    supabaseAdmin
      .from('discussions')
      .select('id, ai_summary, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (projectErr) console.error('[public] project query error:', JSON.stringify(projectErr))
  if (!project)   return null

  const allTasks     = (tasks || []).filter(t => t.type !== 'test_case')
  const doneTasks    = allTasks.filter(t => ['done','resolved','closed','completed'].includes(t.status))
  const pendingTasks = allTasks.filter(t => !doneTasks.includes(t))
  const overdueTasks = pendingTasks.filter(t => t.due_date && t.due_date < now)
  const deadlineSoon = pendingTasks.some(t => t.due_date && t.due_date >= now && t.due_date <= in3days)
  const testCases    = (tasks || []).filter(t => t.type === 'test_case')
  const taskProgress = {
    total:   allTasks.length,
    done:    doneTasks.length,
    open:    pendingTasks.length,
    overdue: overdueTasks.length,
    pct:     allTasks.length > 0 ? Math.round((doneTasks.length / allTasks.length) * 100) : 0,
  }

  let health = 'on_track'
  if (overdueTasks.length >= 4) health = 'behind'
  else if (overdueTasks.length >= 1 || deadlineSoon) health = 'at_risk'

  const latestSummary = (discussions || []).find(d => d.ai_summary)?.ai_summary || null
  const recentUpdates = (discussions || [])
    .filter(d => d.ai_summary)
    .map(d => ({ summary: d.ai_summary, created_at: d.created_at }))

  const openItems = pendingTasks.slice(0, 15).map(t => ({
    title:    t.title,
    priority: t.priority,
    type:     t.type,
    due_date: t.due_date,
    overdue:  t.due_date ? t.due_date < now : false,
  }))

  return {
    project: {
      name:        project.name,
      description: project.description,
      color:       project.color,
      updated_at:  project.created_at,
    },
    health,
    taskProgress,
    latestSummary,
    openItems,
    recentUpdates,
    topics: (topics || []).map(t => ({ title: t.title, summary: t.summary, updated_at: t.updated_at })),
    testStatus: {
      total:   testCases.length,
      pending: testCases.filter(t => t.status === 'pending').length,
      passing: testCases.filter(t => t.status === 'done').length,
    },
  }
}

// ── GET /api/public/collection/:slug — multi-project collection ───────
router.get('/collection/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    const { data: rows } = await supabaseAdmin
      .from('publish_collections')
      .select('id, slug, project_ids, title, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .limit(1)

    const collection = rows?.[0] || null
    if (!collection || !collection.project_ids?.length) {
      return res.status(404).json({ error: 'Collection not found or unpublished' })
    }

    const results = await Promise.allSettled(
      collection.project_ids.map(pid => fetchProjectData(pid))
    )

    const projects = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value)

    return res.json({
      success: true,
      data: {
        title:    collection.title || 'Projects Status',
        projects,
        meta: { slug, fetchedAt: new Date().toISOString() },
      },
    })
  } catch (err) {
    console.error('Public collection error:', err)
    res.status(500).json({ error: 'Failed to load collection' })
  }
})

// ── GET /api/public/:slug — single project status page ────────────────
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    const { data: pages } = await supabaseAdmin
      .from('publish_pages')
      .select('id, slug, project_id, is_active')
      .eq('slug', slug)
      .eq('is_active', true)
      .limit(1)

    const page = pages?.[0] || null
    if (!page) {
      return res.status(404).json({ error: 'Page not found or unpublished' })
    }

    const data = await fetchProjectData(page.project_id)
    if (!data) {
      return res.status(404).json({ error: 'Project not found', projectId: page.project_id })
    }

    return res.json({
      success: true,
      data: {
        ...data,
        meta: { slug, fetchedAt: new Date().toISOString() },
      },
    })
  } catch (err) {
    console.error('Public page error:', err)
    res.status(500).json({ error: 'Failed to load page' })
  }
})

export default router
