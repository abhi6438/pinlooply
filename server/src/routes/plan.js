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

// ── POST /api/plan/upgrade — switch mode (all free) ──────────
router.post('/upgrade', requireAuth, async (req, res) => {
  try {
    const userId   = req.user.id
    const { mode } = req.body

    const validModes = ['personal', 'group', 'team', 'org']
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' })
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
