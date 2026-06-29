// ── Custom Fields Routes ──────────────────────────────────────
// GET    /api/custom-fields          list workspace fields
// POST   /api/custom-fields          create field
// PATCH  /api/custom-fields/:id      update field (label / options / position)
// DELETE /api/custom-fields/:id      delete field
//
// GET    /api/tasks/:taskId/field-values           get values for a task
// PATCH  /api/tasks/:taskId/field-values           upsert values for a task

import express from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import { requireAuth } from '../middleware/auth.js'

const router = express.Router()

// ── Field definitions ─────────────────────────────────────────

// GET /api/custom-fields
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workspace_custom_fields')
      .select('*')
      .eq('user_id', req.user.id)
      .order('position', { ascending: true })

    if (error) throw error
    res.json({ data: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/custom-fields
router.post('/', requireAuth, async (req, res) => {
  const { key, label, field_type = 'text', options = null, position = 0 } = req.body
  if (!key || !label) return res.status(400).json({ error: 'key and label are required' })

  // Sanitize key to snake_case
  const safeKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/__+/g, '_')

  try {
    const { data, error } = await supabaseAdmin
      .from('workspace_custom_fields')
      .insert({ user_id: req.user.id, key: safeKey, label, field_type, options, position })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ data })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A field with that key already exists' })
    }
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/custom-fields/:id
router.patch('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const allowed = ['label', 'options', 'position', 'field_type']
  const patch = {}
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k]
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('workspace_custom_fields')
      .update(patch)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Field not found' })
    res.json({ data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/custom-fields/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  try {
    // Cascade deletes task values via FK in migration
    const { error } = await supabaseAdmin
      .from('workspace_custom_fields')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Task field values ─────────────────────────────────────────

// GET /api/tasks/:taskId/field-values
router.get('/task-values/:taskId', requireAuth, async (req, res) => {
  const { taskId } = req.params
  try {
    const { data, error } = await supabaseAdmin
      .from('task_custom_values')
      .select('field_key, value')
      .eq('task_id', taskId)

    if (error) throw error
    // Return as { fieldKey: value } map for easy consumption
    const map = {}
    for (const row of data || []) map[row.field_key] = row.value
    res.json({ data: map })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/tasks/:taskId/field-values  — body: { values: { key: value, ... } }
router.patch('/task-values/:taskId', requireAuth, async (req, res) => {
  const { taskId } = req.params
  const { values } = req.body
  if (!values || typeof values !== 'object') {
    return res.status(400).json({ error: 'values object required' })
  }

  try {
    const rows = Object.entries(values).map(([field_key, value]) => ({
      task_id: taskId,
      field_key,
      value: value === null || value === undefined ? null : String(value),
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabaseAdmin
      .from('task_custom_values')
      .upsert(rows, { onConflict: 'task_id,field_key' })

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
