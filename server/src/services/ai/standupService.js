import { supabaseAdmin } from '../../config/supabase.js'
import { callGroq } from './groqService.js'
import { callClaude } from './claudeService.js'

// ── Fetch data needed for standup ─────────────────────────────
async function fetchStandupData(userId) {
  // 1. User's projects (owned + member)
  const { data: ownedProjects } = await supabaseAdmin
    .from('projects')
    .select('id, name, color')
    .eq('user_id', userId)

  const { data: memberedProjects } = await supabaseAdmin
    .from('project_members')
    .select('project_id, projects(id, name, color)')
    .eq('user_id', userId)

  const projectMap = new Map()
  for (const p of ownedProjects || []) projectMap.set(p.id, p)
  for (const m of memberedProjects || []) {
    if (m.projects) projectMap.set(m.projects.id, m.projects)
  }
  const projects = [...projectMap.values()]
  const projectIds = projects.map(p => p.id)

  if (!projectIds.length) return { projects: [], recentDone: [], pending: [] }

  // 2. Tasks completed in the last 48h (cast wider net for weekends/gaps)
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: recentDone } = await supabaseAdmin
    .from('tasks')
    .select('id, title, type, priority, updated_at, project_id, projects(name)')
    .in('project_id', projectIds)
    .eq('status', 'done')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })

  // 3. Pending tasks (not done, assigned to user or unassigned in their projects)
  const { data: pending } = await supabaseAdmin
    .from('tasks')
    .select('id, title, type, priority, due_date, project_id, projects(name), assigned_user:assigned_to(name)')
    .in('project_id', projectIds)
    .neq('status', 'done')
    .order('priority', { ascending: true })
    .limit(50)

  return { projects, recentDone: recentDone || [], pending: pending || [] }
}

// ── Build AI prompt ───────────────────────────────────────────
function buildPrompt(projects, recentDone, pending, userName) {
  const byProject = {}

  // Group completed tasks by project
  for (const t of recentDone) {
    const name = t.projects?.name || 'Unknown'
    if (!byProject[name]) byProject[name] = { done: [], pending: [] }
    byProject[name].done.push(t.title)
  }

  // Group pending tasks by project
  for (const t of pending) {
    const name = t.projects?.name || 'Unknown'
    if (!byProject[name]) byProject[name] = { done: [], pending: [] }
    const overdue = t.due_date && new Date(t.due_date) < new Date()
    byProject[name].pending.push({ title: t.title, overdue, priority: t.priority })
  }

  const projectSummaries = Object.entries(byProject).map(([pName, data]) => {
    const doneList = data.done.length
      ? data.done.map(t => `  - ${t}`).join('\n')
      : '  - (nothing completed recently)'
    const pendingList = data.pending.length
      ? data.pending.map(t => `  - ${t.title}${t.overdue ? ' [OVERDUE]' : ''}${t.priority === 'high' ? ' [HIGH]' : ''}`).join('\n')
      : '  - (no pending tasks)'
    return `Project: ${pName}\n  Completed recently:\n${doneList}\n  Pending:\n${pendingList}`
  }).join('\n\n')

  const allProjectNames = projects.map(p => p.name).join(', ')

  return `You are Pinlooply AI. Generate a clear, specific daily standup for developer ${userName}.

Active projects: ${allProjectNames || 'none'}

Activity data:
${projectSummaries || 'No recent activity found.'}

Rules:
- Do NOT invent tasks. Only reference tasks explicitly listed above.
- Keep items short (5-10 words each). No full sentences — just task names or short phrases.
- "yesterday" = tasks that appear in "Completed recently". If empty, return [].
- "today" = top 3-5 tasks from "Pending" (prefer HIGH priority and OVERDUE first).
- "blockers" = ONLY items marked [OVERDUE] or that have a clear dependency. If none, return [].
- "focus" = one short phrase describing the day's theme (e.g. "Auth bug fixes", "API integration").

Return ONLY valid JSON (no markdown, no extra text):
{
  "projects": [
    {
      "project_name": "exact project name from above",
      "focus": "short theme for today",
      "yesterday": ["Task title 1", "Task title 2"],
      "today": ["Task title A", "Task title B", "Task title C"],
      "blockers": ["Specific blocker description"]
    }
  ],
  "summary": "One sentence: what ${userName} is focused on today across all projects"
}`
}

// ── Main: generate standup ────────────────────────────────────
export async function generateStandup(userId, userName) {
  // 1. Get AI config
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = userData?.plan || 'free'

  const { data: aiConfig } = await supabaseAdmin
    .from('ai_config')
    .select('provider, model_name')
    .eq('plan_type', plan)
    .single()

  const provider = aiConfig?.provider || 'groq'
  const model = aiConfig?.model_name

  // 2. Fetch data
  const { projects, recentDone, pending } = await fetchStandupData(userId)

  // 3. Build prompt + call AI
  const prompt = buildPrompt(projects, recentDone, pending, userName)

  let result
  try {
    if (provider === 'claude') {
      result = await callClaude(prompt, model)
    } else {
      result = await callGroq(prompt, model)
    }
  } catch (err) {
    // Fallback: build basic standup from raw data without AI
    result = buildFallbackStandup(projects, recentDone, pending)
  }

  return {
    provider,
    projects: Array.isArray(result.projects) ? result.projects : [],
    summary: result.summary || '',
    meta: {
      recentDoneCount: recentDone.length,
      pendingCount: pending.length,
      projectCount: projects.length,
      generatedAt: new Date().toISOString(),
    },
  }
}

// ── Fallback: build standup without AI (rule-based) ───────────
function buildFallbackStandup(projects, recentDone, pending) {
  const projectMap = new Map(projects.map(p => [p.id, p.name]))

  // Group by project
  const byProject = {}
  for (const t of recentDone) {
    const name = t.projects?.name || 'General'
    if (!byProject[name]) byProject[name] = { done: [], pending: [] }
    byProject[name].done.push(t.title)
  }
  for (const t of pending) {
    const name = t.projects?.name || 'General'
    if (!byProject[name]) byProject[name] = { done: [], pending: [] }
    byProject[name].pending.push({ title: t.title, overdue: t.due_date && new Date(t.due_date) < new Date() })
  }

  const result = Object.entries(byProject).map(([name, data]) => {
    const overdue = data.pending.filter(t => t.overdue).map(t => t.title)
    const topToday = [...data.pending.filter(t => t.overdue), ...data.pending.filter(t => !t.overdue)]
      .slice(0, 5).map(t => t.title)
    return {
      project_name: name,
      focus: data.done.length ? 'Completing recent work' : 'Working through pending tasks',
      yesterday: data.done.slice(0, 5).map(t => t),
      today: topToday,
      blockers: overdue,
    }
  })

  return { projects: result, summary: `${result.length} project${result.length !== 1 ? 's' : ''} active today` }
}
