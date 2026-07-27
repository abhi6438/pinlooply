import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()
router.use(requireAuth)

const VALID_MODULES = ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary', 'testcases', 'conflicts']

const ALL_MODULE_KEYS = ['projects', 'tasks', 'timeline', 'topics', 'standup', 'summary', 'testcases']

// ── GET /api/workspace — fetch workspace settings ─────────────
// Also returns global_modules (admin config) and group_modules (team config).
// Pass ?group_id=xxx to include that group's module restrictions.
router.get('/', async (req, res) => {
  try {
    const { group_id } = req.query

    // Fetch user workspace + global module config in parallel
    const [userRes, configRes] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('profession, vocabulary, enabled_modules, custom_statuses, workspace_name, workspace_logo_url, accent_color')
        .eq('id', req.user.id)
        .single(),
      supabaseAdmin
        .from('site_config')
        .select('value')
        .eq('key', 'global_modules')
        .maybeSingle(),
    ])

    if (userRes.error) return res.status(500).json({ error: userRes.error.message })

    const global_modules = configRes.data?.value || ALL_MODULE_KEYS

    // Optionally fetch group-level modules
    let group_modules = null
    if (group_id) {
      // Verify user is a member of this group first
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('id')
        .eq('group_id', group_id)
        .eq('user_id', req.user.id)
        .maybeSingle()

      if (membership) {
        const { data: grp } = await supabaseAdmin
          .from('groups')
          .select('enabled_modules')
          .eq('id', group_id)
          .maybeSingle()
        group_modules = grp?.enabled_modules ?? null
      }
    }

    res.json({
      success: true,
      data: {
        ...(userRes.data || {}),
        global_modules,
        group_modules,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/workspace — save workspace settings ────────────
router.patch('/', async (req, res) => {
  try {
    const { profession, vocabulary, enabled_modules, custom_statuses, workspace_name, accent_color } = req.body

    const patch = {}

    if (profession !== undefined)      patch.profession      = profession
    if (vocabulary !== undefined)      patch.vocabulary      = vocabulary
    if (workspace_name !== undefined)  patch.workspace_name  = workspace_name || null
    if (custom_statuses !== undefined) patch.custom_statuses = custom_statuses
    if (accent_color !== undefined)    patch.accent_color    = accent_color || null

    if (enabled_modules !== undefined) {
      // Validate modules
      const valid = (enabled_modules || []).filter(m => VALID_MODULES.includes(m))
      patch.enabled_modules = valid.length ? valid : VALID_MODULES
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    // upsert: if the row was deleted (e.g. Reset All Data) but auth session persists,
    // plain update() silently does nothing. upsert creates the row if missing.
    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert(
        { id: req.user.id, email: req.user.email, ...patch },
        { onConflict: 'id' }
      )

    if (upsertErr) return res.status(500).json({ error: upsertErr.message })

    // Re-fetch so we return the current row state
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('profession, vocabulary, enabled_modules, custom_statuses, workspace_name, workspace_logo_url, accent_color')
      .eq('id', req.user.id)
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
