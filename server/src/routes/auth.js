// ── Auth helper routes ─────────────────────────────────────────
// POST /api/auth/check-email  — check if an email is registered

import { Router } from 'express'
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

export default router
