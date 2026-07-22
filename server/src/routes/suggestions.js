// GET /api/suggestions — AI-ranked "what to work on next"
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { generateSuggestions } from '../services/ai/suggestionsService.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { group_id } = req.query

    // Get user context (profession, vocabulary) for AI hints
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('profession, vocabulary')
      .eq('id', userId)
      .single()

    const suggestions = await generateSuggestions(userId, {
      profession: profile?.profession,
      vocabulary: profile?.vocabulary,
      groupId: group_id && group_id !== 'personal' ? group_id : null,
      personalOnly: group_id === 'personal',
    })

    res.json({ data: suggestions })
  } catch (err) {
    console.error('[suggestions] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
