import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { generateWeeklySummary, currentWeekStr } from '../services/ai/weeklySummaryService.js'

const router = Router()

// ── GET /api/summary/weekly?week=2026-W25 ─────────────────────
router.get('/weekly', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const weekStr = req.query.week || currentWeekStr()

    // Validate format
    if (!/^\d{4}-W\d{1,2}$/.test(weekStr)) {
      return res.status(400).json({ error: 'Invalid week format. Use YYYY-Www (e.g. 2026-W25)' })
    }

    // Get user name
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', userId)
      .single()

    const userName = profile?.name || req.user.email || 'Developer'

    const result = await generateWeeklySummary(userId, userName, weekStr)
    return res.json({ success: true, data: result })
  } catch (err) {
    console.error('Weekly summary error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate weekly summary' })
  }
})

export default router
