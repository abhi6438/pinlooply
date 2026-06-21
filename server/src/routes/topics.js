import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// ── Helper: verify user has access to project ─────────────────
async function getProject(projectId, userId) {
  const { data } = await supabaseAdmin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single()
  return data
}

// GET /api/topics/:projectId — all topics for a project
router.get('/:projectId', requireAuth, async (req, res) => {
  const { projectId } = req.params
  const userId = req.user.id

  const project = await getProject(projectId, userId)
  if (!project) return res.status(403).json({ error: 'Access denied' })

  const { data, error } = await supabaseAdmin
    .from('topics')
    .select(`
      id, title, summary, status, created_at, updated_at,
      discussion_topic_map(count),
      conflicts(count)
    `)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  // Flatten counts
  const topics = (data || []).map(t => ({
    ...t,
    discussion_count: t.discussion_topic_map?.[0]?.count ?? 0,
    conflict_count:   t.conflicts?.[0]?.count ?? 0,
    discussion_topic_map: undefined,
    conflicts: undefined,
  }))

  return res.json({ success: true, data: topics })
})

// GET /api/topics/detail/:topicId — full topic detail
router.get('/detail/:topicId', requireAuth, async (req, res) => {
  const { topicId } = req.params
  const userId = req.user.id

  // Get topic + verify access via project
  const { data: topic, error: topicErr } = await supabaseAdmin
    .from('topics')
    .select('*, projects(id, user_id)')
    .eq('id', topicId)
    .single()

  if (topicErr || !topic) return res.status(404).json({ error: 'Topic not found' })
  if (topic.projects.user_id !== userId) return res.status(403).json({ error: 'Access denied' })

  // Versions
  const { data: versions } = await supabaseAdmin
    .from('topic_versions')
    .select('id, summary, version_number, created_at, users(name, avatar_url)')
    .eq('topic_id', topicId)
    .order('version_number', { ascending: false })

  // Linked discussions (with full detail)
  const { data: maps } = await supabaseAdmin
    .from('discussion_topic_map')
    .select(`
      discussions(
        id, raw_text, ai_summary, source, created_at,
        users(name, avatar_url)
      )
    `)
    .eq('topic_id', topicId)

  const discussions = (maps || [])
    .map(m => m.discussions)
    .filter(Boolean)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  // Conflicts
  const { data: conflicts } = await supabaseAdmin
    .from('conflicts')
    .select(`
      id, description, old_value, new_value, detected_at,
      disc_old:discussion_id_old(created_at),
      disc_new:discussion_id_new(created_at)
    `)
    .eq('topic_id', topicId)
    .order('detected_at', { ascending: false })

  return res.json({
    success: true,
    data: {
      topic: { ...topic, projects: undefined },
      versions: versions || [],
      discussions,
      conflicts: conflicts || [],
    },
  })
})

// PATCH /api/topics/:topicId/status — toggle open/resolved
router.patch('/:topicId/status', requireAuth, async (req, res) => {
  const { topicId } = req.params
  const { status } = req.body
  const userId = req.user.id

  if (!['open', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'status must be open or resolved' })
  }

  // Verify access
  const { data: topic } = await supabaseAdmin
    .from('topics')
    .select('project_id, projects(user_id)')
    .eq('id', topicId)
    .single()

  if (!topic || topic.projects.user_id !== userId) {
    return res.status(403).json({ error: 'Access denied' })
  }

  const { data, error } = await supabaseAdmin
    .from('topics')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', topicId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true, data })
})

// GET /api/topics/:topicId/versions — version list only
router.get('/:topicId/versions', requireAuth, async (req, res) => {
  const { topicId } = req.params

  const { data, error } = await supabaseAdmin
    .from('topic_versions')
    .select('id, summary, version_number, created_at, users(name, avatar_url)')
    .eq('topic_id', topicId)
    .order('version_number', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ success: true, data })
})

export default router
