import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// ── GET /api/notifications — current user's notifications ─────
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select(`
        id, type, title, body, is_read, created_at,
        related_task:related_task_id(id, title, status)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    // If table doesn't exist yet (migration not run), return empty gracefully
    if (error) {
      if (error.code === '42P01') return res.json({ success: true, data: [] })
      return res.status(500).json({ error: error.message })
    }
    return res.json({ success: true, data: data || [] })
  } catch (err) {
    console.error('Get notifications error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/notifications/read-all — mark all read ─────────
// MUST be before /:id/read to avoid param capture
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  } catch (err) {
    console.error('Mark all read error:', err)
    return res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/notifications/:id/read — mark one read ─────────
router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ success: true })
  } catch (err) {
    console.error('Mark read error:', err)
    return res.status(500).json({ error: err.message })
  }
})

export default router
