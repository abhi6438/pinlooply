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
// Free upgrades (personal ↔ group) allowed for everyone.
// Paid upgrades (team / org) allowed for admin email only — others must contact support.
router.post('/upgrade', requireAuth, async (req, res) => {
  try {
    const userId    = req.user.id
    const userEmail = req.user.email
    const { mode }  = req.body

    const paidModes  = ['team', 'org']
    const freeModes  = ['personal', 'group']
    const adminEmail = process.env.ADMIN_EMAIL

    if (paidModes.includes(mode)) {
      // Only the admin (app owner) can self-activate paid plans
      if (userEmail !== adminEmail) {
        return res.status(403).json({ error: 'Paid upgrades require manual activation. Contact support after donating.' })
      }
    } else if (!freeModes.includes(mode)) {
      return res.status(400).json({ error: 'Invalid plan mode' })
    }

    const plan = paidModes.includes(mode) ? 'paid' : 'free'
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ mode, plan })
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
