import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { getUserPlanInfo, PLAN_LIMITS } from '../middleware/planCheck.js'

const router = Router()

// ── GET /api/plan — current user plan info ────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const info = await getUserPlanInfo(req.user.id)
    res.json({ success: true, data: { ...info, allPlans: PLAN_LIMITS } })
  } catch (err) {
    console.error('Plan info error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/plan/upgrade — upgrade mode ────────────────────
// Free-tier switches (personal ↔ group) are self-serve.
// Paid plans (team / org) can ONLY be activated by an admin via the Admin Panel.
router.post('/upgrade', requireAuth, async (req, res) => {
  try {
    const userId   = req.user.id
    const { mode } = req.body

    const paidModes = ['team', 'org']
    const freeModes = ['personal', 'group']

    if (paidModes.includes(mode)) {
      // Paid plan activation is admin-only — users must contact support
      return res.status(403).json({
        error: 'Paid plan activation requires manual review. Please contact support@pinlooply.com with your payment receipt.',
      })
    }

    if (!freeModes.includes(mode)) {
      return res.status(400).json({ error: 'Invalid plan' })
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ mode, plan: 'free' })
      .eq('id', userId)
      .select('id, mode, plan')
      .single()

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data })
  } catch (err) {
    console.error('Upgrade error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
