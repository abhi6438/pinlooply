import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/adminAuth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { getMenuConfigForAdmin, saveMenuAccess } from '../utils/menuAccess.js'
// ── Helper: send in-app notification ─────────────────────────
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
    console.error('[admin notify] failed:', e.message)
  }
}

const router = Router()

// All admin routes require auth + admin check
router.use(requireAuth, requireAdmin)

// ── Available providers / models ─────────────────────────────
const PROVIDERS = {
  groq: {
    label:  'Groq',
    models: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
  claude: {
    label:  'Claude (Anthropic)',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8'],
  },
  gemini: {
    label:  'Gemini (Google)',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
  },
  openai: {
    label:  'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  },
}

// ── GET /api/admin/ai-config ──────────────────────────────────
router.get('/ai-config', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('ai_config')
      .select('*')
      .order('plan_type')

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data: { configs: data, providers: PROVIDERS } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/admin/ai-config ──────────────────────────────────
router.put('/ai-config', async (req, res) => {
  try {
    const { configs } = req.body // array of { plan_type, provider, model_name }
    if (!Array.isArray(configs)) return res.status(400).json({ error: 'configs array required' })

    const userId = req.user.id
    const results = []

    for (const cfg of configs) {
      const { plan_type, provider, model_name } = cfg
      if (!plan_type || !provider || !model_name) continue

      const { data, error } = await supabaseAdmin
        .from('ai_config')
        .upsert({
          plan_type,
          provider,
          model_name,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'plan_type' })
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      results.push(data)
    }

    res.json({ success: true, data: results })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    // Run all counts in parallel
    const [
      { count: totalUsers },
      { data: usersByMode },
      { count: totalProjects },
      { count: totalDiscussions },
      { count: totalTasks },
      { count: totalTopics },
      { count: totalConflicts },
      { data: recentUsers },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('mode, plan').order('created_at', { ascending: false }),
      supabaseAdmin.from('projects').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('discussions').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('topics').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('conflicts').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('id, email, name, mode, plan, created_at').order('created_at', { ascending: false }).limit(10),
    ])

    // Users by mode breakdown
    const modeBreakdown = { personal: 0, group: 0, team: 0, org: 0 }
    const planBreakdown = { free: 0, paid: 0 }
    for (const u of usersByMode || []) {
      if (modeBreakdown[u.mode] !== undefined) modeBreakdown[u.mode]++
      if (planBreakdown[u.plan] !== undefined) planBreakdown[u.plan]++
    }

    // New users this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const newThisWeek = (usersByMode || []).filter(u => {
      // created_at isn't in this query — approximate from recentUsers
      return false
    }).length
    // More accurate: count from recentUsers with date check
    const { count: newUsersWeek } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo)

    res.json({
      success: true,
      data: {
        users: {
          total:      totalUsers || 0,
          byMode:     modeBreakdown,
          byPlan:     planBreakdown,
          newThisWeek: newUsersWeek || 0,
          recent:     recentUsers || [],
        },
        content: {
          projects:    totalProjects    || 0,
          discussions: totalDiscussions || 0,
          tasks:       totalTasks       || 0,
          topics:      totalTopics      || 0,
          conflicts:   totalConflicts   || 0,
        },
      },
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/usage-detail ──────────────────────────────
router.get('/usage-detail', async (req, res) => {
  try {
    const weeksBack = 8
    const since = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch raw data in parallel
    // NOTE: tasks use `assigned_by` for creator; discussions use `user_id`; topics have no creator column
    const [
      { data: tasks },
      { data: discussions },
      { data: topics },
      { data: topicVersions },
      { data: users },
      { data: projects },
    ] = await Promise.all([
      supabaseAdmin.from('tasks').select('id, assigned_by, project_id, type, created_at').gte('created_at', since),
      supabaseAdmin.from('discussions').select('id, user_id, project_id, created_at').gte('created_at', since),
      supabaseAdmin.from('topics').select('id, project_id, created_at').gte('created_at', since),
      supabaseAdmin.from('topic_versions').select('topic_id, changed_by, created_at').gte('created_at', since).eq('version_number', 1),
      supabaseAdmin.from('users').select('id, name, email, mode, plan'),
      supabaseAdmin.from('projects').select('id, name'),
    ])

    // Build topic → creator map from version_number=1 entries
    const topicCreatorMap = {}
    for (const tv of topicVersions || []) {
      if (!topicCreatorMap[tv.topic_id]) topicCreatorMap[tv.topic_id] = tv.changed_by
    }

    const userMap    = {}
    const projectMap = {}

    for (const u of users    || []) userMap[u.id]    = u
    for (const p of projects || []) projectMap[p.id] = p

    // ── By User ─────────────────────────────────────────────
    const userStats = {}

    function ensureUser(id) {
      if (!id) return
      if (!userStats[id]) {
        const u = userMap[id] || {}
        userStats[id] = { userId: id, name: u.name || u.email || id, email: u.email || '', mode: u.mode || 'personal', tasks: 0, discussions: 0, topics: 0 }
      }
    }

    for (const t of tasks || []) {
      if (t.type === 'test_case') continue
      ensureUser(t.assigned_by)
      if (t.assigned_by) userStats[t.assigned_by].tasks++
    }
    for (const d of discussions || []) {
      ensureUser(d.user_id)
      if (d.user_id) userStats[d.user_id].discussions++
    }
    for (const t of topics || []) {
      const creator = topicCreatorMap[t.id]
      ensureUser(creator)
      if (creator) userStats[creator].topics++
    }

    const byUser = Object.values(userStats)
      .map(u => ({ ...u, total: u.tasks + u.discussions + u.topics }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)

    // ── By Project ──────────────────────────────────────────
    const projStats = {}

    function ensureProject(id) {
      if (!id) return
      if (!projStats[id]) {
        const p = projectMap[id] || {}
        projStats[id] = { projectId: id, name: p.name || `Project ${id.slice(0,8)}`, tasks: 0, discussions: 0, topics: 0 }
      }
    }

    for (const t of tasks || []) {
      if (t.type === 'test_case') continue
      ensureProject(t.project_id)
      if (t.project_id) projStats[t.project_id].tasks++
    }
    for (const d of discussions || []) {
      ensureProject(d.project_id)
      if (d.project_id) projStats[d.project_id].discussions++
    }
    for (const t of topics || []) {
      ensureProject(t.project_id)
      if (t.project_id) projStats[t.project_id].topics++
    }

    const byProject = Object.values(projStats)
      .map(p => ({ ...p, total: p.tasks + p.discussions + p.topics }))
      .sort((a, b) => b.total - a.total)

    // ── By Mode ──────────────────────────────────────────────
    const byMode = { personal: { tasks: 0, discussions: 0, topics: 0 }, group: { tasks: 0, discussions: 0, topics: 0 }, team: { tasks: 0, discussions: 0, topics: 0 }, org: { tasks: 0, discussions: 0, topics: 0 } }

    function modeOf(createdBy) {
      const u = userMap[createdBy]
      return u?.mode || 'personal'
    }

    for (const t of tasks || []) {
      if (t.type === 'test_case') continue
      const m = modeOf(t.assigned_by)
      if (byMode[m]) byMode[m].tasks++
    }
    for (const d of discussions || []) {
      const m = modeOf(d.user_id)
      if (byMode[m]) byMode[m].discussions++
    }
    for (const t of topics || []) {
      const m = modeOf(topicCreatorMap[t.id])
      if (byMode[m]) byMode[m].topics++
    }

    // ── Weekly Trend ─────────────────────────────────────────
    // Build 8 week buckets (Mon–Sun)
    const weekBuckets = []
    const now = new Date()
    for (let i = weeksBack - 1; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay() - i * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)
      weekBuckets.push({ label: `W${weeksBack - i}`, start: weekStart, end: weekEnd, tasks: 0, discussions: 0, topics: 0 })
    }

    function bucketDate(iso) {
      const d = new Date(iso)
      for (const b of weekBuckets) {
        if (d >= b.start && d < b.end) return b
      }
      return null
    }

    for (const t of tasks || [])       { if (t.type !== 'test_case') { const b = bucketDate(t.created_at); if (b) b.tasks++ } }
    for (const d of discussions || []) { const b = bucketDate(d.created_at); if (b) b.discussions++ }
    for (const t of topics || [])      { const b = bucketDate(t.created_at); if (b) b.topics++ }

    const trend = weekBuckets.map(b => ({ label: b.label, tasks: b.tasks, discussions: b.discussions, topics: b.topics }))

    res.json({ success: true, data: { byUser, byProject, byMode, trend, since } })
  } catch (err) {
    console.error('Admin usage-detail error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/users ──────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { search, plan, mode, limit = 50, offset = 0 } = req.query

    let query = supabaseAdmin
      .from('users')
      .select('id, email, name, mode, plan, created_at')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (search) query = query.ilike('email', `%${search}%`)
    if (plan)   query = query.eq('plan', plan)
    if (mode)   query = query.eq('mode', mode)

    const { data, error, count } = await query

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data: data || [], total: count })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/users/:userId/plan ───────────────────────
router.patch('/users/:userId/plan', async (req, res) => {
  try {
    const { userId } = req.params
    const { plan, mode } = req.body

    const validPlans = ['free', 'paid']
    const validModes = ['personal', 'group', 'team', 'org']

    if (plan && !validPlans.includes(plan))
      return res.status(400).json({ error: `Invalid plan: ${plan}` })
    if (mode && !validModes.includes(mode))
      return res.status(400).json({ error: `Invalid mode: ${mode}` })

    const patch = {}
    if (plan) patch.plan = plan
    if (mode) patch.mode = mode

    if (!Object.keys(patch).length)
      return res.status(400).json({ error: 'plan or mode required' })

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select('id, email, name, mode, plan')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/feedback ──────────────────────────────────
router.get('/feedback', async (req, res) => {
  try {
    const { category, limit = 50, offset = 0 } = req.query
    let query = supabaseAdmin
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (category) query = query.eq('category', category)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/donors ────────────────────────────────────
router.get('/donors', async (req, res) => {
  try {
    const { thanked, limit = 50, offset = 0 } = req.query
    let query = supabaseAdmin
      .from('donor_details')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1)

    if (thanked !== undefined) query = query.eq('thanked', thanked === 'true')

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/admin/donors/:id/thanked ──────────────────────
router.patch('/donors/:id/thanked', async (req, res) => {
  try {
    const { id } = req.params
    const { error } = await supabaseAdmin
      .from('donor_details')
      .update({ thanked: true })
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/feedback/:id/replies ──────────────────────
router.get('/feedback/:id/replies', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('feedback_replies')
      .select('*')
      .eq('feedback_id', req.params.id)
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/feedback/:id/reply ───────────────────────
router.post('/feedback/:id/reply', async (req, res) => {
  try {
    const { id } = req.params
    const { replyText } = req.body
    if (!replyText?.trim()) return res.status(400).json({ error: 'Reply text required' })

    // Get original feedback to find user_id
    const { data: fb, error } = await supabaseAdmin
      .from('feedback')
      .select('id, user_id, name')
      .eq('id', id)
      .maybeSingle()

    if (error || !fb) return res.status(404).json({ error: 'Feedback not found' })

    // 1. Store reply in feedback_replies thread
    const { data: reply, error: replyErr } = await supabaseAdmin
      .from('feedback_replies')
      .insert({ feedback_id: id, sender: 'admin', message: replyText.trim() })
      .select('id, created_at')
      .single()

    if (replyErr) return res.status(500).json({ error: replyErr.message })

    // 2. Send in-app notification to user (if they were logged in when they submitted)
    if (fb.user_id) {
      await notifyUser(fb.user_id, {
        type:              'feedback_reply',
        title:             '💬 New reply from the team',
        body:              replyText.trim().slice(0, 120),
        relatedFeedbackId: id,
      })
    }

    res.json({ success: true, data: reply })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/donors/:id/reply ─────────────────────────
router.post('/donors/:id/reply', async (req, res) => {
  try {
    const { id } = req.params
    const { replyText } = req.body
    if (!replyText?.trim()) return res.status(400).json({ error: 'Reply text required' })

    const { data: donor, error } = await supabaseAdmin
      .from('donor_details')
      .select('id, user_id, name')
      .eq('id', id)
      .maybeSingle()

    if (error || !donor) return res.status(404).json({ error: 'Donor not found' })

    // 1. Mark as thanked
    await supabaseAdmin.from('donor_details').update({ thanked: true }).eq('id', id)

    // 2. Send in-app notification to user (if logged in)
    if (donor.user_id) {
      await notifyUser(donor.user_id, {
        type:  'feedback_reply',
        title: '💖 A personal message from us',
        body:  replyText.trim().slice(0, 120),
      })
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/donate-config ─────────────────────────────
router.get('/donate-config', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_config')
      .select('value')
      .eq('key', 'donate')
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })

    const defaults = {
      upi:          { enabled: true,  id: '',   name: '' },
      paypal:       { enabled: false, url: '' },
      buymeacoffee: { enabled: false, url: '' },
    }
    res.json({ success: true, data: data?.value || defaults })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/admin/donate-config ─────────────────────────────
router.put('/donate-config', async (req, res) => {
  try {
    const config = req.body // { upi: {...}, paypal: {...}, buymeacoffee: {...} }

    const { error } = await supabaseAdmin
      .from('site_config')
      .upsert({ key: 'donate', value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/menus — DB-driven menu config ─────────────
// Returns all menus with always_on flag and global disabled status.
router.get('/menus', async (req, res) => {
  try {
    const data = await getMenuConfigForAdmin()
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/admin/menus — save global disabled keys ─────────
// Body: { disabled_keys: ['timeline', 'testcases'] }
router.put('/menus', async (req, res) => {
  try {
    const { disabled_keys = [] } = req.body
    if (!Array.isArray(disabled_keys)) {
      return res.status(400).json({ error: 'disabled_keys must be an array' })
    }
    await saveMenuAccess('global', null, disabled_keys, req.user.id)
    res.json({ success: true, data: { disabled_keys } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/admin/module-config ─────────────────────────────
// Returns global allowed modules (what admin has enabled platform-wide)
router.get('/module-config', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('site_config')
      .select('value')
      .eq('key', 'global_modules')
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })

    // Default: all modules enabled
    const defaultModules = ['projects', 'tasks', 'timeline', 'topics', 'standup', 'summary', 'testcases']
    res.json({ success: true, data: data?.value || defaultModules })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/admin/module-config ─────────────────────────────
// Save which modules are globally available
router.put('/module-config', async (req, res) => {
  try {
    const { modules } = req.body
    if (!Array.isArray(modules)) return res.status(400).json({ error: 'modules must be an array' })

    const { error } = await supabaseAdmin
      .from('site_config')
      .upsert({ key: 'global_modules', value: modules, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data: modules })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/admin/backfill-task-numbers ─────────────────────
// Assigns task_number to every task that doesn't have one yet.
// Safe to run multiple times — only touches NULL rows.
router.post('/backfill-task-numbers', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Ensure sequence exists (ignore errors — it likely already exists from the migration)
    try {
      await supabaseAdmin.rpc('exec_sql', { sql: `CREATE SEQUENCE IF NOT EXISTS tasks_task_number_seq;` })
    } catch (_) { /* non-fatal */ }

    // Find tasks with no task_number, ordered by created_at
    const { data: unNumbered, error } = await supabaseAdmin
      .from('tasks')
      .select('id, created_at')
      .is('task_number', null)
      .order('created_at', { ascending: true })

    if (error) throw error

    if (!unNumbered || unNumbered.length === 0) {
      return res.json({ success: true, updated: 0, message: 'All tasks already have numbers' })
    }

    // Get current max task_number
    const { data: maxRow } = await supabaseAdmin
      .from('tasks')
      .select('task_number')
      .not('task_number', 'is', null)
      .order('task_number', { ascending: false })
      .limit(1)
      .single()

    let counter = (maxRow?.task_number || 0) + 1

    // Assign numbers in batches
    const updates = unNumbered.map(t => ({ id: t.id, task_number: counter++ }))

    // Update in chunks of 100
    const chunkSize = 100
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(u =>
          supabaseAdmin.from('tasks').update({ task_number: u.task_number }).eq('id', u.id)
        )
      )
    }

    return res.json({ success: true, updated: updates.length, message: `Assigned numbers to ${updates.length} task(s)` })
  } catch (err) {
    console.error('Backfill task numbers error:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
