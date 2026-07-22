// ── Search Route ──────────────────────────────────────────────
// GET /api/search?q=&limit=20
// Full-text search across tasks, projects, discussions, topics

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

async function getScopedProjectIds(userId, groupId = null, personalOnly = false) {
  const [{ data: owned }, { data: membered }, { data: groupMemberships }] = await Promise.all([
    supabaseAdmin.from('projects').select('id').eq('user_id', userId),
    supabaseAdmin.from('project_members').select('project_id').eq('user_id', userId),
    supabaseAdmin.from('group_members').select('group_id').eq('user_id', userId),
  ])
  const allIds = new Set([
    ...(owned    || []).map(p => p.id),
    ...(membered || []).map(m => m.project_id),
  ])
  const userGroupIds = (groupMemberships || []).map(g => g.group_id)
  if (userGroupIds.length) {
    const { data: gp } = await supabaseAdmin.from('projects').select('id').in('group_id', userGroupIds)
    ;(gp || []).forEach(p => allIds.add(p.id))
  }

  let projectIds = [...allIds]
  if (groupId && groupId !== 'personal') {
    const { data: gp } = await supabaseAdmin.from('projects').select('id').eq('group_id', groupId).in('id', projectIds)
    projectIds = (gp || []).map(p => p.id)
  } else if (personalOnly) {
    const { data: pp } = await supabaseAdmin.from('projects').select('id').is('group_id', null).in('id', projectIds)
    projectIds = (pp || []).map(p => p.id)
  }
  return projectIds
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const q        = (req.query.q || '').trim()
    const limit    = Math.min(parseInt(req.query.limit) || 20, 50)
    const group_id = req.query.group_id

    if (!q || q.length < 2) {
      return res.json({ data: { tasks: [], projects: [], topics: [], discussions: [] } })
    }

    const isPersonal = group_id === 'personal'
    const teamGroupId = group_id && group_id !== 'personal' ? group_id : null
    const projectIds = await getScopedProjectIds(userId, teamGroupId, isPersonal)

    const pattern = `%${q}%`

    // Run all searches in parallel
    const [tasksRes, projectsRes, topicsRes, discussionsRes] = await Promise.all([
      // Tasks — search title + description
      projectIds.length
        ? supabaseAdmin
            .from('tasks')
            .select('id, title, status, priority, due_date, projects(id, name, color)')
            .in('project_id', projectIds)
            .or(`title.ilike.${pattern},description.ilike.${pattern}`)
            .neq('status', 'done')
            .limit(limit)
        : Promise.resolve({ data: [] }),

      // Projects — search name, scoped to the same project set
      projectIds.length
        ? supabaseAdmin
            .from('projects')
            .select('id, name, color, created_at')
            .in('id', projectIds)
            .ilike('name', pattern)
            .limit(limit)
        : Promise.resolve({ data: [] }),

      // Topics — search title + content
      projectIds.length
        ? supabaseAdmin
            .from('topics')
            .select('id, title, status, project_id, projects(id, name)')
            .in('project_id', projectIds)
            .or(`title.ilike.${pattern},content.ilike.${pattern}`)
            .limit(limit)
        : Promise.resolve({ data: [] }),

      // Discussions — search raw_text + summary
      projectIds.length
        ? supabaseAdmin
            .from('discussions')
            .select('id, raw_text, created_at, project_id, projects(id, name)')
            .in('project_id', projectIds)
            .or(`raw_text.ilike.${pattern},summary.ilike.${pattern}`)
            .order('created_at', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: [] }),
    ])

    res.json({
      data: {
        tasks:       tasksRes.data       || [],
        projects:    projectsRes.data    || [],
        topics:      topicsRes.data      || [],
        discussions: discussionsRes.data || [],
      }
    })
  } catch (err) {
    console.error('[search] error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
