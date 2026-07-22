import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import {
  generateWeeklySummary, currentWeekStr,
  generateMonthlySummary, currentMonthStr,
} from '../services/ai/weeklySummaryService.js'

const router = Router()

// ── GET /api/summary/weekly?week=2026-W25 ─────────────────────
router.get('/weekly', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { week, group_id } = req.query
    const weekStr = week || currentWeekStr()

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

    const result = await generateWeeklySummary(userId, userName, weekStr, group_id || null)
    return res.json({ success: true, data: result })
  } catch (err) {
    console.error('Weekly summary error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate weekly summary' })
  }
})

// ── GET /api/summary/monthly?month=2026-06 ────────────────────
router.get('/monthly', requireAuth, async (req, res) => {
  try {
    const userId   = req.user.id
    const { month, group_id } = req.query
    const monthStr = month || currentMonthStr()

    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM (e.g. 2026-06)' })
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('id', userId)
      .single()

    const userName = profile?.name || req.user.email || 'Developer'

    const result = await generateMonthlySummary(userId, userName, monthStr, group_id || null)
    return res.json({ success: true, data: result })
  } catch (err) {
    console.error('Monthly summary error:', err)
    return res.status(500).json({ error: err.message || 'Failed to generate monthly summary' })
  }
})

export default router
