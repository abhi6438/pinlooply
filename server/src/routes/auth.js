// ── Auth helper routes ─────────────────────────────────────────
// POST  /api/auth/check-email  — check if an email is registered
// PATCH /api/auth/profile      — save onboarding / profile fields (bypasses RLS)

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// POST /api/auth/check-email
// Body: { email }
// Returns: { exists: boolean }
// Used by login page to distinguish "no account" vs "wrong password"
router.post('/check-email', async (req, res) => {
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email required' })

  try {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    res.json({ exists: !!data })
  } catch (err) {
    // Fail safe — return exists:true so login shows "wrong password" (safer UX)
    res.json({ exists: true })
  }
})

// PATCH /api/auth/profile
// Saves onboarding / profile fields using supabaseAdmin (bypasses RLS).
// Allowed fields: name, mode, profession, onboarding_step, onboarding_complete
router.patch('/profile', requireAuth, async (req, res) => {
  const userId = req.user.id
  const ALLOWED = ['name', 'mode', 'profession', 'onboarding_step', 'onboarding_complete']

  const patch = {}
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) patch[key] = req.body[key]
  }

  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'Nothing to update' })
  }

  try {
    const { error } = await supabaseAdmin
      .from('users')
      .update(patch)
      .eq('id', userId)

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
