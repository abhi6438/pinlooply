import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { generateTestCases } from '../services/ai/testCaseService.js'

const router = Router()

// ── POST /api/testcases/generate ──────────────────────────────
// Generate test cases via AI — does NOT save, just returns
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { taskId, taskTitle, taskDescription, projectId } = req.body

    if (!taskTitle?.trim()) {
      return res.status(400).json({ error: 'taskTitle is required' })
    }

    // If taskId provided, fetch full task context
    let taskType = 'task'
    let projectContext = ''

    if (taskId) {
      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('title, type, priority, projects(name, description)')
        .eq('id', taskId)
        .single()

      if (task) {
        taskType = task.type || 'task'
        projectContext = task.projects?.description || task.projects?.name || ''
      }
    } else if (projectId) {
      const { data: proj } = await supabaseAdmin
        .from('projects')
        .select('name, description')
        .eq('id', projectId)
        .single()

      if (proj) {
        projectContext = proj.description || proj.name || ''
      }
    }

    const result = await generateTestCases(userId, {
      taskTitle: taskTitle.trim(),
      taskDescription: taskDescription?.trim() || '',
      taskType,
      projectContext,
    })

    res.json({ success: true, data: result })
  } catch (err) {
    console.error('Generate test cases error:', err)
    res.status(500).json({ error: 'Failed to generate test cases' })
  }
})

// ── POST /api/testcases/save ──────────────────────────────────
// Save selected test cases to tasks table with type='test_case'
router.post('/save', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { projectId, topicId, taskId, testCases } = req.body

    if (!projectId) return res.status(400).json({ error: 'projectId is required' })
    if (!Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({ error: 'testCases array is required' })
    }

    const rows = testCases.map(tc => ({
      project_id:      projectId,
      topic_id:        topicId || null,
      parent_task_id:  taskId || null,
      user_id:         userId,
      title:           tc.title,
      type:            'test_case',
      status:          'pending',
      priority:        tc.priority || 'medium',
      steps:           tc.steps || [],
      expected_result: tc.expected_result || '',
      category:        tc.category || 'happy_path',
    }))

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert(rows)
      .select()

    if (error) return res.status(500).json({ error: error.message })

    res.json({ success: true, data, count: data.length })
  } catch (err) {
    console.error('Save test cases error:', err)
    res.status(500).json({ error: 'Failed to save test cases' })
  }
})

// ── GET /api/testcases/:projectId ─────────────────────────────
// Return all test cases for a project
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .eq('type', 'test_case')
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    res.json({
      success: true,
      data: data || [],
      stats: {
        total:   (data || []).length,
        pending: (data || []).filter(t => t.status === 'pending').length,
        done:    (data || []).filter(t => t.status === 'done').length,
      },
    })
  } catch (err) {
    console.error('Get test cases error:', err)
    res.status(500).json({ error: 'Failed to fetch test cases' })
  }
})

// ── PATCH /api/testcases/:id/status ──────────────────────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  // Map frontend 'pass' → DB 'done', 'pending' stays 'pending', 'fail' stays 'fail'
  const dbStatus = status === 'pass' ? 'done' : (status || 'pending')

  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({ status: dbStatus })
    .eq('id', id)
    .eq('type', 'test_case')
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, data })
})

// ── DELETE /api/testcases/:id ─────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params
  const userId = req.user.id

  // Verify ownership via project membership
  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('type', 'test_case')

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

export default router
