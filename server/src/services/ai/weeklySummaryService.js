import { supabaseAdmin } from '../../config/supabase.js'
import { callGroq } from './groqService.js'
import { callClaude } from './claudeService.js'

// ── Parse ISO week string "2026-W25" → { start, end } ─────────
export function parseWeek(weekStr) {
  // weekStr: "YYYY-Www"
  const [yearStr, wStr] = weekStr.split('-W')
  const year = parseInt(yearStr, 10)
  const week = parseInt(wStr, 10)

  // ISO week 1 = the week containing the first Thursday of the year
  // Simple calculation: Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7 // Mon=1..Sun=7
  const weekStart = new Date(jan4)
  weekStart.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return { start: weekStart, end: weekEnd }
}

// ── Get current ISO week string ────────────────────────────────
export function currentWeekStr() {
  const now = new Date()
  const year = now.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const weekOneStart = new Date(jan4)
  weekOneStart.setDate(jan4.getDate() - (jan4Day - 1))
  const diff = now - weekOneStart
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

// ── Fetch all data for the week ────────────────────────────────
async function fetchWeekData(userId, start, end) {
  const startISO = start.toISOString()
  const endISO   = end.toISOString()

  // 1. User's projects
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

  if (!projectIds.length) {
    return { projects: [], completed: [], discussions: [], topicChanges: [], conflicts: [] }
  }

  // 2. Tasks completed during the week
  const { data: completed } = await supabaseAdmin
    .from('tasks')
    .select('id, title, type, priority, due_date, updated_at, project_id, projects(name)')
    .in('project_id', projectIds)
    .eq('status', 'done')
    .gte('updated_at', startISO)
    .lte('updated_at', endISO)
    .order('updated_at', { ascending: false })

  // 3. Pending tasks (end of week snapshot)
  const { data: pending } = await supabaseAdmin
    .from('tasks')
    .select('id, title, type, priority, due_date, project_id, projects(name)')
    .in('project_id', projectIds)
    .neq('status', 'done')
    .order('priority', { ascending: true })

  // 4. Discussions logged this week
  const { data: discussions } = await supabaseAdmin
    .from('discussions')
    .select('id, raw_text, ai_summary, source, created_at, project_id, projects(name)')
    .in('project_id', projectIds)
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false })

  // 5. Topic version changes this week
  const { data: topicChanges } = await supabaseAdmin
    .from('topic_versions')
    .select('id, summary, version_number, created_at, topic_id, topics(title, project_id, projects(name))')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: false })

  // Filter to only user's projects
  const filteredTopicChanges = (topicChanges || []).filter(tv =>
    projectIds.includes(tv.topics?.project_id)
  )

  // 6. Conflicts detected this week
  const { data: conflicts } = await supabaseAdmin
    .from('conflicts')
    .select('id, description, old_value, new_value, detected_at, project_id, projects(name)')
    .in('project_id', projectIds)
    .gte('detected_at', startISO)
    .lte('detected_at', endISO)

  return {
    projects,
    completed: completed || [],
    pending: pending || [],
    discussions: discussions || [],
    topicChanges: filteredTopicChanges,
    conflicts: conflicts || [],
  }
}

// ── Build per-project summary ─────────────────────────────────
function groupByProject(data) {
  const { projects, completed, pending, discussions, topicChanges, conflicts } = data
  const map = {}

  // Initialize from project list
  for (const p of projects) {
    map[p.id] = {
      id: p.id,
      name: p.name,
      color: p.color,
      completed: [],
      pending: [],
      discussions: [],
      topicChanges: [],
      conflicts: [],
    }
  }

  for (const t of completed) {
    if (map[t.project_id]) map[t.project_id].completed.push(t)
  }
  for (const t of pending) {
    if (map[t.project_id]) map[t.project_id].pending.push(t)
  }
  for (const d of discussions) {
    if (map[d.project_id]) map[d.project_id].discussions.push(d)
  }
  for (const tv of topicChanges) {
    const pid = tv.topics?.project_id
    if (pid && map[pid]) map[pid].topicChanges.push(tv)
  }
  for (const c of conflicts) {
    if (map[c.project_id]) map[c.project_id].conflicts.push(c)
  }

  // Only return projects that had any activity
  return Object.values(map).filter(p =>
    p.completed.length || p.discussions.length || p.topicChanges.length || p.conflicts.length || p.pending.length
  )
}

// ── Build AI prompt ───────────────────────────────────────────
function buildPrompt(weekData, userName, start, end) {
  const dateRange = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const projectGroups = groupByProject(weekData)

  const projectSummaries = projectGroups.map(p => {
    const lines = [`Project: ${p.name}`]
    if (p.completed.length) lines.push(`  Completed (${p.completed.length}): ${p.completed.map(t => t.title).join(', ')}`)
    if (p.pending.length) lines.push(`  Still pending: ${p.pending.slice(0, 5).map(t => t.title).join(', ')}`)
    if (p.discussions.length) lines.push(`  Discussions logged: ${p.discussions.length}`)
    if (p.topicChanges.length) lines.push(`  Topic changes: ${p.topicChanges.map(tv => tv.topics?.title || 'unknown').join(', ')}`)
    if (p.conflicts.length) lines.push(`  Conflicts detected: ${p.conflicts.map(c => c.description).join('; ')}`)
    return lines.join('\n')
  }).join('\n\n')

  return `You are Pinlooply AI. Generate a weekly summary for developer ${userName} for the week of ${dateRange}.

Data:
${projectSummaries || 'No activity this week.'}

Return ONLY valid JSON, no markdown:
{
  "projects": [
    {
      "project_name": "exact project name",
      "completed": ["list of completed task titles"],
      "changed": ["list of topic changes with brief description"],
      "pending": ["list of still-pending task titles"],
      "conflicts": ["list of conflict descriptions"],
      "summary": "1-2 sentence project summary for the week"
    }
  ],
  "overall_summary": "2-3 sentence overview of the whole week",
  "highlights": ["top 3 achievements or notable events as short strings"]
}`
}

// ── Fallback: build summary without AI ───────────────────────
function buildFallback(weekData, start, end) {
  const projectGroups = groupByProject(weekData)

  const projects = projectGroups.map(p => ({
    project_name: p.name,
    completed: p.completed.map(t => t.title),
    changed: p.topicChanges.map(tv => `${tv.topics?.title || 'Topic'} updated`),
    pending: p.pending.slice(0, 5).map(t => t.title),
    conflicts: p.conflicts.map(c => c.description || 'Conflict detected'),
    summary: `${p.completed.length} tasks completed, ${p.pending.length} pending.`,
    _raw: p,
  }))

  const totalDone = weekData.completed.length
  const totalDiscussions = weekData.discussions.length
  const totalConflicts = weekData.conflicts.length
  const highlights = []
  if (totalDone > 0) highlights.push(`${totalDone} task${totalDone > 1 ? 's' : ''} completed`)
  if (totalDiscussions > 0) highlights.push(`${totalDiscussions} discussion${totalDiscussions > 1 ? 's' : ''} logged`)
  if (totalConflicts > 0) highlights.push(`${totalConflicts} conflict${totalConflicts > 1 ? 's' : ''} detected`)

  return {
    projects,
    overall_summary: `${projects.length} project${projects.length !== 1 ? 's' : ''} active this week with ${totalDone} tasks completed.`,
    highlights,
  }
}

// ── Main: generate weekly summary ────────────────────────────
export async function generateWeeklySummary(userId, userName, weekStr) {
  const { start, end } = parseWeek(weekStr)

  // AI config
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
  const model    = aiConfig?.model_name

  // Fetch data
  const weekData = await fetchWeekData(userId, start, end)
  const projectGroups = groupByProject(weekData)

  // Build prompt + call AI
  const prompt = buildPrompt(weekData, userName, start, end)

  let result
  try {
    if (provider === 'claude') {
      result = await callClaude(prompt, model)
    } else {
      result = await callGroq(prompt, model)
    }
    // Merge raw data back in for frontend use
    if (Array.isArray(result.projects)) {
      result.projects = result.projects.map(rp => {
        const raw = projectGroups.find(pg => pg.name === rp.project_name)
        return { ...rp, _raw: raw }
      })
    }
  } catch (err) {
    console.error('Weekly summary AI error, using fallback:', err.message)
    result = buildFallback(weekData, start, end)
  }

  // Overall stats (always computed from DB, not AI)
  const mostActive = projectGroups.sort((a, b) =>
    (b.completed.length + b.discussions.length) - (a.completed.length + a.discussions.length)
  )[0]

  return {
    provider,
    week: weekStr,
    dateRange: {
      start: start.toISOString(),
      end:   end.toISOString(),
    },
    projects: Array.isArray(result.projects) ? result.projects : [],
    overall_summary: result.overall_summary || '',
    highlights: Array.isArray(result.highlights) ? result.highlights : [],
    stats: {
      totalCompleted:   weekData.completed.length,
      totalDiscussions: weekData.discussions.length,
      totalConflicts:   weekData.conflicts.length,
      totalPending:     weekData.pending.length,
      projectCount:     projectGroups.length,
      mostActiveProject: mostActive?.name || null,
    },
    generatedAt: new Date().toISOString(),
  }
}
