import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { processDiscussion, saveDiscussion } from '../services/ai/aiService.js'
import { RateLimitError } from '../services/ai/groqService.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// POST /api/discussions/process
// Runs AI on raw text and returns structured data — does NOT save yet
router.post('/process', requireAuth, async (req, res) => {
  const { rawText, projectId, source } = req.body
  const userId = req.user.id

  if (!rawText?.trim()) {
    return res.status(400).json({ error: 'rawText is required' })
  }
  if (!projectId) {
    return res.status(400).json({ error: 'projectId is required' })
  }

  // Verify user has access to this project (owner or member)
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('id, name, user_id')
    .eq('id', projectId)
    .single()

  if (!project) {
    return res.status(403).json({ error: 'Project not found' })
  }

  const { data: membership } = await supabaseAdmin
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  const isOwner = project.user_id === userId
  if (!isOwner && !membership) {
    return res.status(403).json({ error: 'Access denied' })
  }

  try {
    const result = await processDiscussion(rawText, projectId, userId)
    return res.json({ success: true, data: result })
  } catch (err) {
    if (err instanceof RateLimitError) {
      return res.status(429).json({ error: err.message })
    }
    console.error('[/process] AI error:', err)
    return res.status(500).json({ error: err.message || 'AI processing failed' })
  }
})

// POST /api/discussions/save
// Saves the confirmed discussion + all extracted data to DB
router.post('/save', requireAuth, async (req, res) => {
  const { rawText, projectId, source, aiResult } = req.body
  const userId = req.user.id

  if (!rawText?.trim() || !projectId || !aiResult) {
    return res.status(400).json({ error: 'rawText, projectId, and aiResult are required' })
  }

  // Verify access
  const { data: project, error: projErr } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()

  if (projErr || !project) {
    return res.status(403).json({ error: 'Project not found or access denied' })
  }

  try {
    const discussion = await saveDiscussion({ rawText, projectId, userId, source, aiResult })
    return res.json({ success: true, discussionId: discussion.id })
  } catch (err) {
    console.error('[/save] DB error:', err)
    return res.status(500).json({ error: err.message || 'Failed to save discussion' })
  }
})

// GET /api/discussions/:projectId
// List discussions for a project
router.get('/:projectId', requireAuth, async (req, res) => {
  const { projectId } = req.params
  const userId = req.user.id

  const { data, error } = await supabaseAdmin
    .from('discussions')
    .select('id, raw_text, ai_summary, source, processed, created_at, users(name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true, data })
})

export default router
