import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { discussionsApi, groupsApi } from '../services/api'
import { supabase } from '../config/supabase'
import {
  CheckCircle2, Tag, ListChecks, AlertTriangle, FileText,
  Trash2, ArrowLeft, Save, Loader2, Pencil, X, Check,
  UserCircle, FlaskConical, Zap,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, PageHeader } from '../components/ui'

const TASK_TYPES = {
  task:             { label: 'Task',          color: 'bg-blue-100 text-blue-700' },
  test_case:        { label: 'Test Case',     color: 'bg-purple-100 text-purple-700' },
  deployment_check: { label: 'Deploy Check',  color: 'bg-amber-100 text-amber-700' },
  backlog:          { label: 'Backlog',       color: 'bg-warm-100 text-warm-600' },
}
const PRIORITIES = ['high', 'medium', 'low']

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
      <div className="border border-primary-200 rounded-xl p-3 bg-primary-50/30 space-y-2 animate-fade-in">
        <input
          value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          className="input text-sm py-1.5"
        />
        <div className="flex gap-2 flex-wrap">
          <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1 bg-white text-warm-700 focus:outline-none focus:ring-1 focus:ring-primary-400">
            {Object.entries(TASK_TYPES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <select value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1 bg-white text-warm-700 focus:outline-none focus:ring-1 focus:ring-primary-400">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input type="date" value={draft.due_date || ''}
            onChange={e => setDraft(d => ({ ...d, due_date: e.target.value || null }))}
            className="text-xs border border-warm-200 rounded-lg px-2 py-1 bg-white text-warm-700 focus:outline-none focus:ring-1 focus:ring-primary-400" />
          {groupMembers.length > 0 && (
            <select value={draft.assigned_to || ''}
              onChange={e => setDraft(d => ({ ...d, assigned_to: e.target.value || null }))}
              className="text-xs border border-warm-200 rounded-lg px-2 py-1 bg-white text-warm-700 focus:outline-none focus:ring-1 focus:ring-primary-400">
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
            className="flex items-center gap-1 text-xs bg-primary-600 text-white px-2.5 py-1 rounded-lg hover:bg-primary-700">
            <Check className="w-3 h-3" /> Save
          </button>
          <button onClick={() => setEditing(false)}
            className="flex items-center gap-1 text-xs text-warm-500 px-2 py-1 rounded-lg hover:bg-warm-100">
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 p-3 border-l-4 border-amber-400 bg-white rounded-xl shadow-sm mb-2 last:mb-0 group animate-fade-in">
      <input
        type="checkbox"
        defaultChecked
        className="w-5 h-5 rounded text-primary-600 accent-primary-600 mt-0.5 flex-shrink-0"
        readOnly
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-warm-900">{task.title}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
          <span className={`badge ${
            task.priority === 'high' ? 'badge-high' : task.priority === 'medium' ? 'badge-medium' : 'badge-low'
          }`}>{task.priority}</span>
          {task.due_date && <span className="text-xs text-warm-400 flex items-center gap-0.5">📅 {task.due_date}</span>}
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
              className="text-xs border border-amber-200 bg-amber-50 rounded-lg px-2 py-0.5 text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
        <button onClick={() => setEditing(true)} className="p-1 hover:bg-warm-100 rounded-lg text-warm-400 hover:text-warm-600">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(index)} className="p-1 hover:bg-red-50 rounded-lg text-warm-400 hover:text-red-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function TopicRow({ topic, onDelete, index }) {
  return (
    <div className="flex items-start gap-3 p-3 border-l-4 border-primary-500 bg-white rounded-xl shadow-sm mb-2 last:mb-0 group animate-fade-in">
      <input
        type="checkbox"
        defaultChecked
        className="w-5 h-5 rounded text-primary-600 accent-primary-600 mt-0.5 flex-shrink-0"
        readOnly
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-warm-900">{topic.title}</p>
          <span className={`badge ${topic.is_new ? 'bg-green-100 text-green-700 border-green-200' : 'badge-gray'}`}>
            {topic.is_new ? 'New' : 'Updated'}
          </span>
        </div>
        {topic.summary && <p className="text-xs text-warm-500 mt-0.5 line-clamp-2">{topic.summary}</p>}
      </div>
      <button onClick={() => onDelete(index)}
        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded-lg text-warm-400 hover:text-red-500 transition-opacity flex-shrink-0">
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
      toast.success('Saved! Test cases generating in background…')
      navigate(`/projects/${projectId}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const unresolvedCount = tasks.filter(t => t.assigned_to_name && !t.assigned_to && groupMembers.length > 0).length
  const selectedCount = topics.length + tasks.length

  return (
    <PageShell>
      <PageHeader
        title="Review AI Results"
        subtitle="Select what you want to save to your project."
        actions={
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs bg-primary-100 text-primary-700 font-semibold px-3 py-1.5 rounded-full">
              {topics.length} topic{topics.length !== 1 ? 's' : ''} · {tasks.length} task{tasks.length !== 1 ? 's' : ''} selected
            </span>
            <span className="text-xs text-warm-400 bg-warm-100 px-2.5 py-1.5 rounded-full border border-warm-200">
              via Pinlooply AI
            </span>
          </div>
        }
      />

      {unresolvedCount > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2.5 text-sm text-amber-800">
          <UserCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>AI detected {unresolvedCount} suggested assignee{unresolvedCount > 1 ? 's' : ''}. Pick a team member below to confirm.</span>
        </div>
      )}

      <div className="space-y-5">
        {/* Summary */}
        {aiResult.overall_summary && (
          <div className="card animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-warm-400" />
              <h2 className="section-title">Summary</h2>
            </div>
            <p className="text-sm text-warm-700 leading-relaxed">{aiResult.overall_summary}</p>
          </div>
        )}

        {/* Topics */}
        <div className="card animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="section-title">📌 Topics</h2>
            <span className="ml-auto text-xs text-warm-400 bg-warm-100 px-2 py-0.5 rounded-full">{topics.length}</span>
          </div>
          {topics.length > 0
            ? topics.map((t, i) => <TopicRow key={i} topic={t} index={i} onDelete={deleteTopic} />)
            : (
              <div className="empty-state py-6">
                <Tag className="empty-state-icon w-8 h-8 mx-auto mb-2" />
                <p className="empty-state-title">No topics found</p>
              </div>
            )
          }
        </div>

        {/* Tasks */}
        <div className="card animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="section-title">✅ Tasks</h2>
            <span className="ml-auto text-xs text-warm-400 bg-warm-100 px-2 py-0.5 rounded-full">{tasks.length}</span>
          </div>
          {tasks.length > 0
            ? tasks.map((t, i) => (
                <TaskRow key={i} task={t} index={i} groupMembers={groupMembers} onUpdate={updateTask} onDelete={deleteTask} />
              ))
            : (
              <div className="empty-state py-6">
                <ListChecks className="empty-state-icon w-8 h-8 mx-auto mb-2" />
                <p className="empty-state-title">No tasks found</p>
              </div>
            )
          }
        </div>

        {/* Test Cases — auto-generated after save */}
        {tasks.length > 0 && (
          <div className="card animate-fade-in border border-purple-100">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="section-title">🧪 Test Cases</h2>
              <span className="ml-auto text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Auto-generated
              </span>
            </div>
            <div className="bg-purple-50/60 rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-900">
                  {tasks.length * 8}+ test cases will be generated automatically
                </p>
                <p className="text-xs text-purple-600 mt-1 leading-relaxed">
                  After saving, AI will generate happy path, edge case, negative, and UI/UX tests for each of your {tasks.length} task{tasks.length !== 1 ? 's' : ''}. Find them in the <strong>Test Cases</strong> page.
                </p>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  {['Happy path', 'Edge cases', 'Negative', 'UI/UX'].map(label => (
                    <span key={label} className="text-xs bg-white border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="card animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="section-title">⚠️ Conflicts</h2>
              <span className="ml-auto text-xs text-warm-400 bg-warm-100 px-2 py-0.5 rounded-full">{conflicts.length}</span>
            </div>
            <div className="space-y-3">
              {conflicts.map((c, i) => (
                <div key={i} className="border-l-4 border-red-400 bg-red-50 rounded-xl p-4 animate-fade-in">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium text-red-800">{c.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white rounded-lg p-2.5 border border-red-100">
                      <p className="text-warm-400 mb-1 font-medium">Before</p>
                      <p className="text-warm-700">{c.old_value}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-red-100">
                      <p className="text-warm-400 mb-1 font-medium">Now</p>
                      <p className="text-warm-700">{c.new_value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex gap-3 mt-7 sticky bottom-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-ghost flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
        <button
          onClick={handleSave}
          disabled={saving || selectedCount === 0}
          className="btn-primary btn-lg flex-1 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : `Save Selected (${selectedCount} item${selectedCount !== 1 ? 's' : ''})`}
        </button>
      </div>
    </PageShell>
  )
}
