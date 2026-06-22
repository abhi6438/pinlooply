import { supabaseAdmin } from '../../config/supabase.js'
import { callGroq } from './groqService.js'
import { callClaude } from './claudeService.js'

// ── Prompt builder ────────────────────────────────────────────
function buildPrompt(rawText, existingTopics) {
  const topicsStr = existingTopics.length
    ? existingTopics.map(t => `- [${t.id}] ${t.title}: ${t.summary || 'no summary'}`).join('\n')
    : 'No existing topics yet.'

  return `You are Pinlooply AI — a smart team memory assistant for developers.

A developer just logged this discussion:
"${rawText}"

Existing topics in this project:
${topicsStr}

Extract ALL information and return ONLY valid JSON with no explanation or markdown:
{
  "project_match": "project name if mentioned or null",
  "topics": [
    {
      "title": "short topic title",
      "is_new": true,
      "existing_topic_id": null,
      "summary": "2-3 sentence summary"
    }
  ],
  "tasks": [
    {
      "title": "task title",
      "type": "task|test_case|deployment_check|backlog",
      "priority": "high|medium|low",
      "due_date": "YYYY-MM-DD or null",
      "assigned_to_name": "person name or null"
    }
  ],
  "conflicts": [
    {
      "description": "what changed",
      "old_value": "what was said before",
      "new_value": "what it changed to"
    }
  ],
  "overall_summary": "2-3 line summary of entire discussion"
}`
}

// ── Main processing function ──────────────────────────────────
export async function processDiscussion(rawText, projectId, userId) {
  // 1. Get user plan to determine which AI to use
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = userData?.plan || 'free'

  // 2. Get AI config for this plan
  const { data: aiConfig } = await supabaseAdmin
    .from('ai_config')
    .select('provider, model_name')
    .eq('plan_type', plan)
    .single()

  const provider = aiConfig?.provider || 'groq'
  const model = aiConfig?.model_name

  // 3. Get existing topics for context
  const { data: existingTopics } = await supabaseAdmin
    .from('topics')
    .select('id, title, summary')
    .eq('project_id', projectId)
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(20)

  // 4. Build prompt
  const prompt = buildPrompt(rawText, existingTopics || [])

  // 5. Call AI
  let result
  if (provider === 'claude') {
    result = await callClaude(prompt, model)
  } else {
    result = await callGroq(prompt, model)
  }

  // 6. Normalize and return
  return {
    provider,
    model: model || provider,
    project_match: result.project_match || null,
    topics: Array.isArray(result.topics) ? result.topics : [],
    tasks: Array.isArray(result.tasks) ? result.tasks : [],
    conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
    overall_summary: result.overall_summary || '',
  }
}

// ── Save everything to DB ─────────────────────────────────────
export async function saveDiscussion({ rawText, projectId, userId, source, aiResult }) {
  // 1. Save the discussion
  const { data: discussion, error: discErr } = await supabaseAdmin
    .from('discussions')
    .insert({
      project_id: projectId,
      user_id: userId,
      raw_text: rawText,
      source: source || 'manual',
      ai_summary: aiResult.overall_summary,
      processed: true,
    })
    .select()
    .single()

  if (discErr) throw discErr

  // 2. Create / update topics
  const topicIds = []
  for (const t of aiResult.topics || []) {
    if (!t.is_new && t.existing_topic_id) {
      // Update existing topic
      const { data: existing } = await supabaseAdmin
        .from('topics')
        .select('version_number')
        .eq('id', t.existing_topic_id)
        .single()

      await supabaseAdmin
        .from('topics')
        .update({ summary: t.summary, updated_at: new Date().toISOString() })
        .eq('id', t.existing_topic_id)

      // Save version
      await supabaseAdmin.from('topic_versions').insert({
        topic_id: t.existing_topic_id,
        summary: t.summary,
        changed_by: userId,
        version_number: (existing?.version_number || 0) + 1,
      })

      topicIds.push(t.existing_topic_id)
    } else {
      // Create new topic
      const { data: newTopic } = await supabaseAdmin
        .from('topics')
        .insert({ project_id: projectId, title: t.title, summary: t.summary })
        .select()
        .single()

      if (newTopic) {
        await supabaseAdmin.from('topic_versions').insert({
          topic_id: newTopic.id,
          summary: t.summary,
          changed_by: userId,
          version_number: 1,
        })
        topicIds.push(newTopic.id)
      }
    }
  }

  // 3. Link discussion → topics
  for (const topicId of topicIds) {
    await supabaseAdmin
      .from('discussion_topic_map')
      .upsert({ discussion_id: discussion.id, topic_id: topicId }, { onConflict: 'discussion_id,topic_id' })
  }

  // 4. Create tasks (with optional assignee resolution)
  for (const task of aiResult.tasks || []) {
    // Try to resolve assigned_to_name → user UUID via public.users within the project's group
    let assignedTo = null
    if (task.assigned_to_name) {
      const nameLower = task.assigned_to_name.toLowerCase().trim()
      const { data: matched } = await supabaseAdmin
        .from('users')
        .select('id, name')
        .ilike('name', `%${nameLower}%`)
        .limit(5)
      // Pick the first match (fuzzy by first name)
      if (matched?.length) assignedTo = matched[0].id
    }

    await supabaseAdmin.from('tasks').insert({
      project_id: projectId,
      discussion_id: discussion.id,
      topic_id: topicIds[0] || null,
      title: task.title,
      type: task.type || 'task',
      priority: task.priority || 'medium',
      due_date: task.due_date || null,
      assigned_to_name: task.assigned_to_name || null,
      assigned_to: assignedTo,
      assigned_by: userId,
    })
  }

  // 5. Save conflicts
  for (const conflict of aiResult.conflicts || []) {
    if (topicIds[0]) {
      await supabaseAdmin.from('conflicts').insert({
        project_id: projectId,
        topic_id: topicIds[0],
        description: conflict.description,
        old_value: conflict.old_value,
        new_value: conflict.new_value,
        discussion_id_new: discussion.id,
      })
    }
  }

  return discussion
}
