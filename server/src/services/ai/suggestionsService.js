// ── AI Task Suggestions Service ───────────────────────────────
// Ranks a user's open tasks and returns the top 5 "what to work on next"
// using a scoring model + short AI-generated rationale per suggestion.

import { supabaseAdmin } from '../../config/supabase.js'
import { callGroq } from './groqService.js'

// ── Fetch open tasks for the user ─────────────────────────────
async function fetchOpenTasks(userId) {
  const [{ data: owned }, { data: membered }] = await Promise.all([
    supabaseAdmin.from('projects').select('id').eq('user_id', userId),
    supabaseAdmin.from('project_members').select('project_id').eq('user_id', userId),
  ])
  const projectIds = [
    ...(owned    || []).map(p => p.id),
    ...(membered || []).map(m => m.project_id),
  ]
  if (!projectIds.length) return []

  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, title, description, status, priority, due_date, assigned_to, project_id, created_at, projects(id, name)')
    .in('project_id', projectIds)
    .not('status', 'in', '("done","resolved","closed","released")')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(50)

  return tasks || []
}

// ── Score each task (higher = more urgent) ────────────────────
function scoreTasks(tasks) {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  return tasks.map(task => {
    let score = 0
    const due = task.due_date ? new Date(task.due_date) : null
    const daysUntilDue = due ? Math.ceil((due - now) / 86400000) : null

    // Overdue
    if (task.status === 'overdue' || (due && due < now)) score += 100

    // Due today
    if (task.due_date === today) score += 60

    // Due within 3 days
    if (daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue >= 0) score += 40

    // Due within a week
    if (daysUntilDue !== null && daysUntilDue <= 7 && daysUntilDue >= 0) score += 20

    // Priority
    if (task.priority === 'urgent')   score += 50
    if (task.priority === 'high')     score += 30
    if (task.priority === 'medium')   score += 10

    // Blocked tasks — lower priority (they need something first)
    if (task.status === 'blocked') score -= 20

    // In progress — boost (already started)
    if (task.status === 'in_progress') score += 15

    return { ...task, _score: score, _daysUntilDue: daysUntilDue }
  }).sort((a, b) => b._score - a._score)
}

// ── Generate AI rationale for top tasks ──────────────────────
async function generateRationale(tasks, userContext = {}) {
  if (!tasks.length) return tasks

  const professionHint = userContext.profession
    ? `The user is a ${userContext.profession}.`
    : ''

  const taskList = tasks.map((t, i) =>
    `${i + 1}. "${t.title}" — status: ${t.status}, priority: ${t.priority}` +
    (t.due_date ? `, due: ${t.due_date}` : '') +
    (t._daysUntilDue !== null ? ` (${t._daysUntilDue <= 0 ? 'OVERDUE' : `${t._daysUntilDue}d left`})` : '') +
    (t.projects?.name ? `, project: ${t.projects.name}` : '')
  ).join('\n')

  const prompt = `${professionHint} You are a smart work assistant. Based on these top tasks ranked by urgency, write ONE short sentence (max 12 words) for each explaining why it should be worked on next. Be direct and practical.

Tasks:
${taskList}

Respond with a JSON array of strings (one sentence per task, same order):
["reason 1", "reason 2", ...]`

  try {
    const raw = await callGroq(prompt, 'llama3-8b-8192')
    const match = raw.match(/\[[\s\S]*\]/)
    if (match) {
      const reasons = JSON.parse(match[0])
      return tasks.map((t, i) => ({ ...t, reason: reasons[i] || null }))
    }
  } catch {
    // Non-fatal — return without reasons
  }
  return tasks
}

// ── Main export ───────────────────────────────────────────────
export async function generateSuggestions(userId, userContext = {}) {
  const allTasks = await fetchOpenTasks(userId)
  if (!allTasks.length) return []

  const ranked = scoreTasks(allTasks)
  const top5   = ranked.slice(0, 5)
  const withReasons = await generateRationale(top5, userContext)

  return withReasons.map(t => ({
    id:            t.id,
    title:         t.title,
    status:        t.status,
    priority:      t.priority,
    due_date:      t.due_date,
    days_until_due: t._daysUntilDue,
    score:         t._score,
    project:       t.projects,
    reason:        t.reason || null,
  }))
}
