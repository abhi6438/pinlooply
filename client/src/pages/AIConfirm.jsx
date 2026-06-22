import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { discussionsApi, groupsApi } from '../services/api'
import { supabase } from '../config/supabase'
import {
  CheckCircle2, Tag, ListChecks, AlertTriangle, FileText,
  Trash2, ChevronDown, ArrowLeft, Save, Loader2, Pencil, X, Check,
  UserCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

const TASK_TYPES = {
  task:             { label: 'Task',          color: 'bg-blue-100 text-blue-700' },
  test_case:        { label: 'Test Case',     color: 'bg-purple-100 text-purple-700' },
  deployment_check: { label: 'Deploy Check',  color: 'bg-orange-100 text-orange-700' },
  backlog:          { label: 'Backlog',       color: 'bg-gray-100 text-gray-600' },
}
const PRIORITIES = ['high', 'medium', 'low']
const PRIORITY_COLORS = {
  high:   'text-red-600 bg-red-50',
  medium: 'text-yellow-600 bg-yellow-50',
  low:    'text-gray-500 bg-gray-100',
}

function Section({ icon: Icon, title, count, color = 'text-gray-700', children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <Icon className={`w-4 h-4 ${color}`} />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {count !== undefined && (
          <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Editable task row with assignee picker ────────────────────
function TaskRow({ task, index, groupMembers, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ ...task })
  const typeInfo = TASK_TYPES[task.type] || TASK_TYPES.task

  function save() { onUpdate(index, draft); setEditing(false) }

  const assignedMember = groupMembers.find(m => {
    const u = m.users || m
    return u.id === task.assigned_to
  })
  const assignedName = assignedMember
    ? (assignedMember.users || assignedMember).name
    : task.assigned_to_name

  if (editing) {
    return (
      <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50/30 space-y-2">
        <input
          value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <div className="flex gap-2 flex-wrap">
          <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
            {Object.entries(TASK_TYPES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="date" value={draft.due_date || ''}
            onChange={e => setDraft(d => ({ ...d, due_date: e.target.value || null }))}
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white" />
          {groupMembers.length > 0 && (
            <select value={draft.assigned_to || ''}
              onChange={e => setDraft(d => ({ ...d, assigned_to: e.target.value || null }))}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white">
              <option value="">Unassigned</option>
              {groupMembers.map(m => {
                const u = m.users || m
                return <option key={u.id} value={u.id}>{u.name || u.email}</option>
              })}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={save}
            className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded hover:bg-indigo-700">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={() => setEditing(false)}
            className="flex items-center gap-1 text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0 group">
      <ListChecks className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">{task.title}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
          {task.due_date && <span className="text-xs text-gray-400 flex items-center gap-0.5">📅 {task.due_date}</span>}
          {assignedName && (
            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
              assignedMember ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <UserCircle className="w-3 h-3" />
              {assignedName}
              {!assignedMember && task.assigned_to_name && (
                <span className="opacity-60 ml-0.5">· unresolved</span>
              )}
            </span>
          )}
        </div>
        {/* Prompt to resolve unresolved assignee */}
        {task.assigned_to_name && !task.assigned_to && groupMembers.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs text-amber-600">Assign to:</span>
            <select
              defaultValue=""
              onChange={e => onUpdate(index, { ...task, assigned_to: e.target.value || null })}
              className="text-xs border border-amber-200 bg-amber-50 rounded px-2 py-0.5 text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="">— pick member —</option>
              {groupMembers.map(m => {
                const u = m.users || m
                return <option key={u.id} value={u.id}>{u.name || u.email}</option>
              })}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => setEditing(true)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(index)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function TopicRow({ topic, onDelete, index }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0 group">
      <Tag className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800">{topic.title}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${topic.is_new ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {topic.is_new ? 'New' : 'Updated'}
          </span>
        </div>
        {topic.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{topic.summary}</p>}
      </div>
      <button onClick={() => onDelete(index)}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function AIConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const state = location.state

  if (!state?.aiResult) { navigate('/log'); return null }

  const { rawText, projectId, source, aiResult } = state

  const [topics, setTopics]         = useState(aiResult.topics || [])
  const [tasks, setTasks]           = useState(aiResult.tasks || [])
  const [conflicts]                 = useState(aiResult.conflicts || [])
  const [saving, setSaving]         = useState(false)
  const [groupMembers, setGroupMembers] = useState([])

  // Load group members for assignee resolution
  useEffect(() => {
    if (!user) return
    async function loadMembers() {
      try {
        const { data: profile } = await supabase.from('users').select('mode').eq('id', user.id).single()
        if (profile?.mode === 'team' || profile?.mode === 'org') {
          const res = await groupsApi.list()
          const groups = res.data.data || []
          if (groups.length > 0) {
            const groupRes = await groupsApi.getGroupMembers(groups[0].id)
            setGroupMembers(groupRes.data.data?.members || [])
          }
        }
      } catch { /* non-fatal */ }
    }
    loadMembers()
  }, [user]) // eslint-disable-line

  function deleteTask(i)  { setTasks(t => t.filter((_, idx) => idx !== i)) }
  function updateTask(i, updated) { setTasks(t => t.map((item, idx) => idx === i ? updated : item)) }
  function deleteTopic(i) { setTopics(t => t.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    setSaving(true)
    try {
      await discussionsApi.save(rawText, projectId, source, { ...aiResult, topics, tasks, conflicts })
      toast.success('Discussion saved!')
      navigate(`/projects/${projectId}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false) }
  }

  const unresolvedCount = tasks.filter(t => t.assigned_to_name && !t.assigned_to && groupMembers.length > 0).length

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review AI Extraction</h1>
          <p className="text-sm text-gray-500 mt-1">Remove or edit anything before saving.</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
          via {aiResult.provider || 'AI'}
        </span>
      </div>

      {unresolvedCount > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm text-amber-800">
          <UserCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>AI detected {unresolvedCount} suggested assignee{unresolvedCount > 1 ? 's' : ''}. Pick a team member below to confirm.</span>
        </div>
      )}

      <div className="space-y-4">
        {aiResult.overall_summary && (
          <Section icon={FileText} title="Summary">
            <p className="text-sm text-gray-700 leading-relaxed">{aiResult.overall_summary}</p>
          </Section>
        )}

        <Section icon={Tag} title="Topics Found" count={topics.length} color="text-indigo-500">
          {topics.length > 0
            ? topics.map((t, i) => <TopicRow key={i} topic={t} index={i} onDelete={deleteTopic} />)
            : <p className="text-sm text-gray-400 text-center py-3">No topics found</p>
          }
        </Section>

        <Section icon={ListChecks} title="Tasks Extracted" count={tasks.length} color="text-blue-500">
          {tasks.length > 0
            ? tasks.map((t, i) => (
                <TaskRow key={i} task={t} index={i} groupMembers={groupMembers} onUpdate={updateTask} onDelete={deleteTask} />
              ))
            : <p className="text-sm text-gray-400 text-center py-3">No tasks found</p>
          }
        </Section>

        {conflicts.length > 0 && (
          <Section icon={AlertTriangle} title="Conflicts Detected" count={conflicts.length} color="text-orange-500">
            <div className="space-y-3">
              {conflicts.map((c, i) => (
                <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-orange-800 mb-2">{c.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white rounded p-2"><p className="text-gray-500 mb-1">Before</p><p className="text-gray-700">{c.old_value}</p></div>
                    <div className="bg-white rounded p-2"><p className="text-gray-500 mb-1">Now</p><p className="text-gray-700">{c.new_value}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      <div className="flex gap-3 mt-6 sticky bottom-4">
        <button
          onClick={() => navigate('/log', { state: { prefilledText: rawText, projectId } })}
          className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 bg-white shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : `Save Everything (${topics.length + tasks.length} items)`}
        </button>
      </div>
    </div>
  )
}
