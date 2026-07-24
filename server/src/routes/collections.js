import { Router } from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
router.use(requireAuth)

function makeSlug() {
  const suffix = Math.random().toString(36).slice(2, 9)
  return `projects-${suffix}`
}

// ── GET /api/collections — fetch user's active collection ──────────────
router.get('/', async (req, res) => {
  try {
    const userId  = req.user.id
    const groupId = req.headers['x-group-id'] || null

    let q = supabaseAdmin
      .from('publish_collections')
      .select('id, slug, project_ids, title, is_active, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (groupId) q = q.eq('group_id', groupId)
    else         q = q.is('group_id', null)

    const { data } = await q.limit(1).maybeSingle()
    res.json({ success: true, data })
  } catch (err) {
    console.error('GET collection error:', err)
    res.status(500).json({ error: 'Failed to fetch collection' })
  }
})

// ── POST /api/collections — create or update collection ───────────────
router.post('/', async (req, res) => {
  try {
    const userId  = req.user.id
    const { project_ids, group_id = null, title = null } = req.body

    if (!Array.isArray(project_ids) || project_ids.length === 0) {
      return res.status(400).json({ error: 'project_ids must be a non-empty array' })
    }

    // Look for existing
    let q = supabaseAdmin
      .from('publish_collections')
      .select('id, slug')
      .eq('user_id', userId)

    if (group_id) q = q.eq('group_id', group_id)
    else          q = q.is('group_id', null)

    const { data: existing } = await q.limit(1).maybeSingle()

    let result
    if (existing) {
      const { data } = await supabaseAdmin
        .from('publish_collections')
        .update({ project_ids, title, is_active: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select().single()
      result = data
    } else {
      const { data } = await supabaseAdmin
        .from('publish_collections')
        .insert({ user_id: userId, group_id, project_ids, title, slug: makeSlug(), is_active: true })
        .select().single()
      result = data
    }

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('POST collection error:', err)
    res.status(500).json({ error: 'Failed to save collection' })
  }
})

// ── DELETE /api/collections — unpublish ───────────────────────────────
router.delete('/', async (req, res) => {
  try {
    const userId  = req.user.id
    const groupId = req.headers['x-group-id'] || null

    let q = supabaseAdmin
      .from('publish_collections')
      .update({ is_active: false })
      .eq('user_id', userId)

    if (groupId) q = q.eq('group_id', groupId)
    else         q = q.is('group_id', null)

    await q
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete collection' })
  }
})

export default router
