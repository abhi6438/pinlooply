import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// ── GET /api/public/:slug — public project status page data ───────
// No auth required. Returns only safe, public-facing data.
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    // 1. Find active publish page
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

    const projectId = page.project_id
    const now = new Date().toISOString()
    const in3days = new Date(Date.now() + 3 * 86400000).toISOString()

    // 2. Fetch all data in parallel — omit sensitive fields
    const [
      { data: project },
      { data: tasks },
      { data: topics },
      { data: discussions },
    ] = await Promise.all([
      supabaseAdmin
        .from('projects')
        .select('id, name, description, color, updated_at')
        .eq('id', projectId)
        .single(),

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
        .select('id, ai_summary, created_at')  // only ai_summary, NOT raw_text
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (!project) return res.status(404).json({ error: 'Project not found' })

    // 3. Compute health
    const allTasks      = (tasks || []).filter(t => t.type !== 'test_case')
    const doneTasks     = allTasks.filter(t => t.status === 'done' || t.status === 'resolved' || t.status === 'closed' || t.status === 'completed')
    const pendingTasks  = allTasks.filter(t => !doneTasks.includes(t))
    const overdueTasks  = pendingTasks.filter(t => t.due_date && t.due_date < now)
    const deadlineSoon  = pendingTasks.some(t => t.due_date && t.due_date >= now && t.due_date <= in3days)
    const testCases     = (tasks || []).filter(t => t.type === 'test_case')
    const taskProgress  = {
      total:    allTasks.length,
      done:     doneTasks.length,
      open:     pendingTasks.length,
      overdue:  overdueTasks.length,
      pct:      allTasks.length > 0 ? Math.round((doneTasks.length / allTasks.length) * 100) : 0,
    }

    let health = 'on_track'
    if (overdueTasks.length >= 4) health = 'behind'
    else if (overdueTasks.length >= 1 || deadlineSoon) health = 'at_risk'

    // 4. Latest AI summary (from most recent discussion)
    const latestSummary = (discussions || []).find(d => d.ai_summary)?.ai_summary || null

    // 5. Recent updates — sanitized discussion summaries only
    const recentUpdates = (discussions || [])
      .filter(d => d.ai_summary)
      .map(d => ({
        summary:    d.ai_summary,
        created_at: d.created_at,
      }))

    // 6. Open tasks — omit assigned_to / discussion_id / internal details
    const openItems = pendingTasks.slice(0, 15).map(t => ({
      title:    t.title,
      priority: t.priority,
      type:     t.type,
      due_date: t.due_date,
      overdue:  t.due_date ? t.due_date < now : false,
    }))

    return res.json({
      success: true,
      data: {
        project: {
          name:        project.name,
          description: project.description,
          color:       project.color,
          updated_at:  project.updated_at,
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
        meta: {
          slug,
          fetchedAt: new Date().toISOString(),
        },
      },
    })
  } catch (err) {
    console.error('Public page error:', err)
    res.status(500).json({ error: 'Failed to load page' })
  }
})

export default router
