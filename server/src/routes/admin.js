import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/adminAuth.js'
import { supabaseAdmin } from '../config/supabase.js'

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

export default router
