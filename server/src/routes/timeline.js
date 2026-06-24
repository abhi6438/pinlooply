import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// ── Helper: get user's project IDs ────────────────────────────
async function getUserProjectIds(userId) {
  const [{ data: owned }, { data: membered }] = await Promise.all([
    supabaseAdmin.from('projects').select('id').eq('user_id', userId),
    supabaseAdmin.from('project_members').select('project_id').eq('user_id', userId),
  ])
  const ids = new Set([
    ...(owned    || []).map(p => p.id),
    ...(membered || []).map(m => m.project_id),
  ])
  return [...ids]
}

// ── GET /api/timeline — assembled event feed ──────────────────
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { project_id, type, from, to, limit = 100 } = req.query

  const projectIds = await getUserProjectIds(userId)
  if (!projectIds.length) return res.json({ success: true, data: [] })

  const targetProjectIds = project_id ? [project_id] : projectIds
  const fromDate = from ? new Date(from).toISOString() : null
  const toDate   = to   ? new Date(to + 'T23:59:59').toISOString() : null

  function applyDateFilter(query, col = 'created_at') {
    if (fromDate) query = query.gte(col, fromDate)
    if (toDate)   query = query.lte(col, toDate)
    return query
  }

  const events = []

  // ── 1. Discussions ───────────────────────────────────────
  if (!type || type === 'discussion') {
    let q = supabaseAdmin
      .from('discussions')
      .select('id, created_at, raw_text, ai_summary, source, project_id, projects(id,name,color), users(id,name,avatar_url)')
      .in('project_id', targetProjectIds)
      .order('created_at', { ascending: false })
      .limit(Number(limit))
    q = applyDateFilter(q)
    const { data } = await q
    ;(data || []).forEach(d => {
      events.push({
        id:          `disc-${d.id}`,
        type:        'discussion',
        timestamp:   d.created_at,
        title:       `Discussion logged`,
        description: d.ai_summary || d.raw_text?.slice(0, 120) || 'No summary',
        project_id:  d.project_id,
        project_name: d.projects?.name,
        project_color: d.projects?.color || '#6366f1',
        user_name:   d.users?.name || 'Unknown',
        user_avatar: d.users?.avatar_url,
        source:      d.source,
        meta:        { id: d.id, summary: d.ai_summary, raw_text: d.raw_text },
      })
    })
  }

  // ── 2. Tasks created ─────────────────────────────────────
  if (!type || type === 'task') {
    let q = supabaseAdmin
      .from('tasks')
      .select('id, title, type, priority, status, created_at, updated_at, project_id, projects(id,name,color), assigned_user:assigned_to(id,name,avatar_url)')
      .in('project_id', targetProjectIds)
      .order('created_at', { ascending: false })
      .limit(Number(limit))
    q = applyDateFilter(q)
    const { data } = await q
    ;(data || []).forEach(t => {
      events.push({
        id:           `task-created-${t.id}`,
        type:         'task_created',
        timestamp:    t.created_at,
        title:        'Task created',
        description:  t.title,
        project_id:   t.project_id,
        project_name: t.projects?.name,
        project_color: t.projects?.color || '#6366f1',
        user_name:    t.assigned_user?.name || 'Unassigned',
        user_avatar:  t.assigned_user?.avatar_url,
        meta:         { id: t.id, priority: t.priority, task_type: t.type, status: t.status },
      })

      // If task is done, also emit a completion event (use updated_at as timestamp)
      if (t.status === 'done') {
        const completedAt = t.updated_at
        if (!fromDate || completedAt >= fromDate) {
          if (!toDate   || completedAt <= toDate) {
            events.push({
              id:           `task-done-${t.id}`,
              type:         'task_completed',
              timestamp:    completedAt,
              title:        'Task completed',
              description:  t.title,
              project_id:   t.project_id,
              project_name: t.projects?.name,
              project_color: t.projects?.color || '#6366f1',
              user_name:    t.assigned_user?.name || 'Unknown',
              user_avatar:  t.assigned_user?.avatar_url,
              meta:         { id: t.id, priority: t.priority, task_type: t.type },
            })
          }
        }
      }
    })
  }

  // ── 3. Topic versions (topic updated) ────────────────────
  if (!type || type === 'topic') {
    let q = supabaseAdmin
      .from('topic_versions')
      .select('id, summary, version_number, created_at, topic_id, topics(id,title,project_id,projects(id,name,color)), users(id,name,avatar_url)')
      .order('created_at', { ascending: false })
      .limit(Number(limit))
    q = applyDateFilter(q)
    const { data } = await q
    ;(data || []).forEach(v => {
      const proj = v.topics?.projects
      if (!proj || !targetProjectIds.includes(proj.id)) return
      events.push({
        id:           `topicver-${v.id}`,
        type:         'topic_updated',
        timestamp:    v.created_at,
        title:        `Topic updated`,
        description:  `"${v.topics?.title}" — v${v.version_number}: ${v.summary?.slice(0, 100) || ''}`,
        project_id:   proj.id,
        project_name: proj.name,
        project_color: proj.color || '#6366f1',
        user_name:    v.users?.name || 'Unknown',
        user_avatar:  v.users?.avatar_url,
        meta:         { topic_id: v.topic_id, topic_title: v.topics?.title, version: v.version_number, summary: v.summary },
      })
    })
  }

  // ── 4. Conflicts ─────────────────────────────────────────
  if (!type || type === 'conflict') {
    let q = supabaseAdmin
      .from('conflicts')
      .select('id, description, old_value, new_value, detected_at, project_id, projects(id,name,color), topics(id,title)')
      .in('project_id', targetProjectIds)
      .order('detected_at', { ascending: false })
      .limit(Number(limit))
    q = applyDateFilter(q, 'detected_at')
    const { data } = await q
    ;(data || []).forEach(c => {
      events.push({
        id:           `conflict-${c.id}`,
        type:         'conflict',
        timestamp:    c.detected_at,
        title:        'Conflict detected',
        description:  c.description || 'A conflict was detected in a topic',
        project_id:   c.project_id,
        project_name: c.projects?.name,
        project_color: c.projects?.color || '#6366f1',
        user_name:    'System',
        meta:         { id: c.id, old_value: c.old_value, new_value: c.new_value, topic: c.topics?.title },
      })
    })
  }

  // ── 5. Group member joins ────────────────────────────────
  if (!type || type === 'member') {
    const { data: groupData } = await supabaseAdmin
      .from('group_members')
      .select('id, joined_at, role, users(id,name,avatar_url), groups(id,name)')
      .order('joined_at', { ascending: false })
      .limit(50)
    ;(groupData || []).forEach(m => {
      if (fromDate && m.joined_at < fromDate) return
      if (toDate   && m.joined_at > toDate)   return
      events.push({
        id:           `member-${m.id}`,
        type:         'member_joined',
        timestamp:    m.joined_at,
        title:        'Member joined',
        description:  `${m.users?.name || 'Someone'} joined ${m.groups?.name || 'a group'} as ${m.role}`,
        project_id:   null,
        project_name: m.groups?.name,
        project_color: '#14b8a6',
        user_name:    m.users?.name || 'Unknown',
        user_avatar:  m.users?.avatar_url,
        meta:         { role: m.role, group: m.groups?.name },
      })
    })
  }

  // ── Sort all events newest first, apply limit ─────────────
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  const sliced = events.slice(0, Number(limit))

  return res.json({ success: true, data: sliced, total: events.length })
})

export default router
