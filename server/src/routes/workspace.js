import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import {
  getEffectiveMenuKeys,
  getMenuConfigForUser,
  saveMenuAccess,
  ALL_MODULE_KEYS,
} from '../utils/menuAccess.js'

const router = Router()
router.use(requireAuth)

const VALID_MODULES = ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary', 'testcases', 'conflicts']

// ── GET /api/workspace — fetch workspace settings + effective menus ──
// Pass ?group_id=xxx to include that group's module restrictions.
router.get('/', async (req, res) => {
  try {
    const { group_id } = req.query
    const userId = req.user.id

    // Fetch user workspace + global module config in parallel
    const [userRes, configRes] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('profession, vocabulary, enabled_modules, custom_statuses, workspace_name, workspace_logo_url, accent_color')
        .eq('id', userId)
        .single(),
      supabaseAdmin
        .from('site_config')
        .select('value')
        .eq('key', 'global_modules')
        .maybeSingle(),
    ])

    if (userRes.error) return res.status(500).json({ error: userRes.error.message })

    // Legacy: global_modules array from site_config (backward compat)
    const global_modules = configRes.data?.value || ALL_MODULE_KEYS

    // Legacy: group-level modules from groups table
    let group_modules = null
    if (group_id) {
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('id')
        .eq('group_id', group_id)
        .eq('user_id', userId)
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

    // New: DB-driven effective menus (null if menu_access table not yet migrated)
    const effective_menus = await getEffectiveMenuKeys(userId, group_id || null)

    res.json({
      success: true,
      data: {
        ...(userRes.data || {}),
        global_modules,
        group_modules,
        effective_menus,  // authoritative list when non-null
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/workspace — save workspace settings ────────────────
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
      const valid = (enabled_modules || []).filter(m => VALID_MODULES.includes(m))
      patch.enabled_modules = valid.length ? valid : VALID_MODULES
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'Nothing to update' })
    }

    const { error: upsertErr } = await supabaseAdmin
      .from('users')
      .upsert(
        { id: req.user.id, email: req.user.email, ...patch },
        { onConflict: 'id' }
      )

    if (upsertErr) return res.status(500).json({ error: upsertErr.message })

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

// ── GET /api/workspace/menus — personal menu config with lock status ─
// Returns configurable menus with disabled_global, disabled_group, disabled_user flags.
// Pass ?group_id=xxx for group context.
router.get('/menus', async (req, res) => {
  try {
    const { group_id } = req.query
    const data = await getMenuConfigForUser(req.user.id, group_id || null)
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/workspace/menus — save personal menu disabled keys ───────
// Body: { disabled_keys: ['timeline', 'standup'] }
router.put('/menus', async (req, res) => {
  try {
    const { disabled_keys = [] } = req.body
    if (!Array.isArray(disabled_keys)) {
      return res.status(400).json({ error: 'disabled_keys must be an array' })
    }
    // Only allow disabling real configurable menus
    const valid = disabled_keys.filter(k => ALL_MODULE_KEYS.includes(k))
    await saveMenuAccess('user', req.user.id, valid, req.user.id)
    res.json({ success: true, data: { disabled_keys: valid } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
