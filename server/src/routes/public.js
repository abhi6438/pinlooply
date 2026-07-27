import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'

// ── Helper: send in-app notification to a user ────────────────
async function notifyUser(userId, { type, title, body, relatedFeedbackId }) {
  if (!userId) return
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id:             userId,
      type,
      title,
      body:                body || null,
      related_feedback_id: relatedFeedbackId || null,
    })
  } catch (e) {
    console.error('[notify] failed:', e.message)
  }
}

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
      .limit(20),

    supabaseAdmin
      .from('discussions')
      .select('id, ai_summary, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10),
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

  const openItems = pendingTasks.slice(0, 50).map(t => ({
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

// ── POST /api/public/feedback — submit user feedback ─────────────────
router.post('/feedback', async (req, res) => {
  try {
    const { name, email, category = 'general', rating, message, user_id } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' })

    // 1. Save feedback
    const { data: fb, error } = await supabaseAdmin
      .from('feedback')
      .insert({
        user_id: user_id || null,
        name:    name?.trim()  || null,
        email:   email?.trim() || null,
        category,
        rating:  rating ? Number(rating) : null,
        message: message.trim(),
      })
      .select('id')
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // 2. Auto-generated system acknowledgment reply
    const ackMsg = 'Thanks for reaching out! Our team has received your message and will review it shortly. We\'ll reply here in your notifications.'
    await supabaseAdmin.from('feedback_replies').insert({
      feedback_id: fb.id,
      sender:      'system',
      message:     ackMsg,
    })

    // 3. Send in-app notification to the user (if logged in)
    if (user_id) {
      await notifyUser(user_id, {
        type:              'system_message',
        title:             '✅ Feedback received!',
        body:              ackMsg,
        relatedFeedbackId: fb.id,
      })
    }

    res.json({ success: true, feedbackId: fb.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/public/donor-notify — donor submits their details ───────
router.post('/donor-notify', async (req, res) => {
  try {
    const { name, email, method = 'upi', amount, message, user_id } = req.body
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name and email are required' })
    }

    const { error } = await supabaseAdmin
      .from('donor_details')
      .insert({
        user_id: user_id || null,
        name:    name.trim(),
        email:   email.trim(),
        method,
        amount:  amount?.trim() || null,
        message: message?.trim() || null,
      })

    if (error) return res.status(500).json({ error: error.message })

    // Send in-app notification to the user (if logged in)
    if (user_id) {
      await notifyUser(user_id, {
        type:  'system_message',
        title: '💖 Thank you for your donation!',
        body:  'We\'ve received your details and will personally send you a thank-you message soon.',
      })
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/public/donate-config — donate settings (no auth) ────────
router.get('/donate-config', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('site_config')
      .select('value')
      .eq('key', 'donate')
      .maybeSingle()

    // Only return enabled methods
    const cfg = data?.value || {}
    const result = {}
    if (cfg.upi?.enabled)          result.upi          = { id: cfg.upi.id,   name: cfg.upi.name }
    if (cfg.paypal?.enabled)       result.paypal       = { url: cfg.paypal.url }
    if (cfg.buymeacoffee?.enabled) result.buymeacoffee = { url: cfg.buymeacoffee.url }

    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

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

// ── GET /api/public/module-config — global module config (no auth needed) ──
// Any logged-in OR anonymous user can call this so nav filters correctly.
router.get('/module-config', async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('site_config')
      .select('value')
      .eq('key', 'global_modules')
      .maybeSingle()

    const ALL = ['projects', 'tasks', 'timeline', 'topics', 'standup', 'summary', 'testcases']
    res.json({ success: true, data: data?.value || ALL })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
