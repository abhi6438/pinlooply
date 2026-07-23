import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { processDiscussion, saveDiscussion } from '../services/ai/aiService.js'
import { RateLimitError } from '../services/ai/groqService.js'
import { supabaseAdmin } from '../config/supabase.js'
import { onDiscussionSaved } from '../services/automationEngine.js'

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

  // Verify user has access to this project (owner, member, or group member)
  const { data: project } = await supabaseAdmin
    .from('projects').select('id, name, user_id, group_id').eq('id', projectId).single()

  if (!project) return res.status(403).json({ error: 'Project not found' })

  const isOwner = project.user_id === userId
  if (!isOwner) {
    const { data: pm } = await supabaseAdmin
      .from('project_members').select('id').eq('project_id', projectId).eq('user_id', userId).maybeSingle()
    const hasProjectMembership = !!pm
    let hasGroupMembership = false
    if (!hasProjectMembership && project.group_id) {
      const { data: gm } = await supabaseAdmin
        .from('group_members').select('id').eq('group_id', project.group_id).eq('user_id', userId).maybeSingle()
      hasGroupMembership = !!gm
    }
    if (!hasProjectMembership && !hasGroupMembership) {
      return res.status(403).json({ error: 'Access denied' })
    }
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

  // Verify access (owner, project member, or group member)
  const { data: saveProj } = await supabaseAdmin
    .from('projects').select('id, user_id, group_id').eq('id', projectId).single()

  if (!saveProj) return res.status(403).json({ error: 'Project not found or access denied' })

  const isSaveOwner = saveProj.user_id === userId
  if (!isSaveOwner) {
    const { data: spm } = await supabaseAdmin
      .from('project_members').select('id').eq('project_id', projectId).eq('user_id', userId).maybeSingle()
    let canSave = !!spm
    if (!canSave && saveProj.group_id) {
      const { data: sgm } = await supabaseAdmin
        .from('group_members').select('id').eq('group_id', saveProj.group_id).eq('user_id', userId).maybeSingle()
      canSave = !!sgm
    }
    if (!canSave) return res.status(403).json({ error: 'Project not found or access denied' })
  }

  try {
    const discussion = await saveDiscussion({ rawText, projectId, userId, source, aiResult })

    // Automation: fire discussion_saved trigger (non-blocking)
    const extractedTasks = aiResult?.tasks || aiResult?.action_items || []
    onDiscussionSaved({
      userId,
      projectId,
      tasks: extractedTasks,
      discussionId: discussion.id,
    }).catch(() => {})

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
