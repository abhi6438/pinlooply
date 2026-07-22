import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()
router.use(requireAuth)

const VALID_MODULES = ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary', 'testcases', 'conflicts']

// ── GET /api/workspace — fetch workspace settings ─────────────
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('profession, vocabulary, enabled_modules, custom_statuses, workspace_name, workspace_logo_url, accent_color')
      .eq('id', req.user.id)
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data: data || {} })
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
