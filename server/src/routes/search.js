// ── Search Route ──────────────────────────────────────────────
// GET /api/search?q=&limit=20
// Full-text search across tasks, projects, discussions, topics

import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

async function getUserProjectIds(userId) {
  const [{ data: owned }, { data: membered }] = await Promise.all([
    supabaseAdmin.from('projects').select('id').eq('user_id', userId),
    supabaseAdmin.from('project_members').select('project_id').eq('user_id', userId),
  ])
  return [
    ...(owned    || []).map(p => p.id),
    ...(membered || []).map(m => m.project_id),
  ]
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const q      = (req.query.q || '').trim()
    const limit  = Math.min(parseInt(req.query.limit) || 20, 50)

    if (!q || q.length < 2) {
      return res.json({ data: { tasks: [], projects: [], topics: [], discussions: [] } })
    }

    const projectIds = await getUserProjectIds(userId)

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

      // Projects — search name
      supabaseAdmin
        .from('projects')
        .select('id, name, color, created_at')
        .eq('user_id', userId)
        .ilike('name', pattern)
        .limit(limit),

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
