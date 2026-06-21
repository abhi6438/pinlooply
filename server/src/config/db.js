import { supabaseAdmin } from './supabase.js'

// ── Users ────────────────────────────────────────────────────

export async function getUserById(id) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function upsertUser({ id, email, name, avatar_url }) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert({ id, email, name, avatar_url }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Projects ─────────────────────────────────────────────────

export async function getProjectsByUser(userId) {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getProjectById(projectId) {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*, users(name, email, avatar_url)')
    .eq('id', projectId)
    .single()
  if (error) throw error
  return data
}

export async function createProject({ userId, name, description, color, groupId }) {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({ user_id: userId, name, description, color, group_id: groupId ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Discussions ───────────────────────────────────────────────

export async function createDiscussion({ projectId, userId, rawText, source = 'manual' }) {
  const { data, error } = await supabaseAdmin
    .from('discussions')
    .insert({ project_id: projectId, user_id: userId, raw_text: rawText, source })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markDiscussionProcessed(discussionId, aiSummary) {
  const { data, error } = await supabaseAdmin
    .from('discussions')
    .update({ processed: true, ai_summary: aiSummary })
    .eq('id', discussionId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getDiscussionsByProject(projectId) {
  const { data, error } = await supabaseAdmin
    .from('discussions')
    .select('*, users(name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// ── Topics ───────────────────────────────────────────────────

export async function getTopicsByProject(projectId) {
  const { data, error } = await supabaseAdmin
    .from('topics')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function upsertTopic({ projectId, title, summary, status = 'open' }) {
  const { data, error } = await supabaseAdmin
    .from('topics')
    .upsert({ project_id: projectId, title, summary, status }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function insertTopicVersion({ topicId, summary, changedBy, versionNumber }) {
  const { error } = await supabaseAdmin
    .from('topic_versions')
    .insert({ topic_id: topicId, summary, changed_by: changedBy, version_number: versionNumber })
  if (error) throw error
}

// ── Tasks ────────────────────────────────────────────────────

export async function getTasksByProject(projectId) {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .select('*, users!tasks_assigned_to_fkey(name, avatar_url)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createTask({ projectId, topicId, discussionId, title, description, type, priority, assignedTo, assignedBy, dueDate }) {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .insert({
      project_id:    projectId,
      topic_id:      topicId      ?? null,
      discussion_id: discussionId ?? null,
      title,
      description,
      type:        type      ?? 'task',
      priority:    priority  ?? 'medium',
      assigned_to: assignedTo ?? null,
      assigned_by: assignedBy ?? null,
      due_date:    dueDate    ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTaskStatus(taskId, status) {
  const { data, error } = await supabaseAdmin
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── AI Config ─────────────────────────────────────────────────

export async function getAiConfig(planType) {
  const { data, error } = await supabaseAdmin
    .from('ai_config')
    .select('provider, model_name')
    .eq('plan_type', planType)
    .single()
  if (error) throw error
  return data
}

// ── Discussion-Topic Map ──────────────────────────────────────

export async function linkDiscussionToTopic(discussionId, topicId) {
  const { error } = await supabaseAdmin
    .from('discussion_topic_map')
    .upsert({ discussion_id: discussionId, topic_id: topicId }, { onConflict: 'discussion_id,topic_id' })
  if (error) throw error
}
