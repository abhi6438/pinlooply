// ── Automations Routes ────────────────────────────────────────
// GET    /api/automations            list user's rules
// POST   /api/automations            create rule
// PATCH  /api/automations/:id        update rule (name, active, config)
// DELETE /api/automations/:id        delete rule
// POST   /api/automations/run-overdue  manually trigger overdue check

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { runOverdueCheck } from '../services/automationEngine.js'

const router = Router()
router.use(requireAuth)

// GET /api/automations
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json({ data: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/automations
router.post('/', async (req, res) => {
  const { name, trigger_type, trigger_config, action_type, action_config, project_id } = req.body
  if (!name || !trigger_type || !action_type) {
    return res.status(400).json({ error: 'name, trigger_type, action_type are required' })
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .insert({
        user_id:        req.user.id,
        name,
        trigger_type,
        trigger_config: trigger_config || {},
        action_type,
        action_config:  action_config || {},
        project_id:     project_id || null,
        is_active:      true,
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json({ data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/automations/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params
  const allowed = ['name', 'is_active', 'trigger_config', 'action_config', 'project_id']
  const patch = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (req.body[k] !== undefined) patch[k] = req.body[k]
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('automation_rules')
      .update(patch)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Rule not found' })
    res.json({ data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/automations/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { error } = await supabaseAdmin
      .from('automation_rules')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/automations/run-overdue — manually trigger overdue check
router.post('/run-overdue', async (req, res) => {
  try {
    const result = await runOverdueCheck(req.user.id)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
