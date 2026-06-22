import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { generateStandup } from '../services/ai/standupService.js'

const router = Router()

// ── POST /api/standup/generate ────────────────────────────────
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id

    // Get user name
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', userId)
      .single()

    const userName = profile?.name || req.user.email || 'Developer'

    const result = await generateStandup(userId, userName)
    return res.json({ success: true, data: result })
  } catch (err) {
    console.error('Standup generate error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate standup' })
  }
})

export default router
