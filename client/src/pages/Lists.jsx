import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { tasksApi, groupsApi } from '../services/api'
import { supabase } from '../config/supabase'
import {
  CheckSquare, FlaskConical, Rocket, Archive, ListChecks,
  Plus, Trash2, ChevronDown, Search, Loader2,
  Tag, Calendar, AlertTriangle, Square, CheckSquare2,
  ArrowUpDown, X, RefreshCw, Pencil, Check, UserCircle, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import GenerateTestCasesButton from '../components/shared/GenerateTestCasesButton'
import {
  PageShell, PageHeader, PageToolbar, SearchInput,
  FilterPills, SortSelect, ProjectSelect, PageLoader, EmptyState,
} from '../components/ui'

// ── Constants ─────────────────────────────────────────────────
const TABS = [
  { key: 'task',             label: 'Pending Tasks',   icon: CheckSquare,  emptyMsg: "No pending tasks! You're all caught up 🎉" },
  { key: 'test_case',        label: 'Test Cases',      icon: FlaskConical, emptyMsg: 'No test cases yet.' },
  { key: 'deployment_check', label: 'Post Deployment', icon: Rocket,       emptyMsg: 'No post-deployment checks.' },
  { key: 'backlog',          label: 'Backlog',         icon: Archive,      emptyMsg: 'Backlog is empty.' },
]

const PRIORITY_META = {
  high:   { label: 'High',   color: 'text-red-600 bg-red-50 border-red-200' },
  medium: { label: 'Medium', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  low:    { label: 'Low',    color: 'text-warm-500 bg-warm-100 border-warm-200' },
}

const PRIORITY_DOT = {
  high:   'bg-red-500',
  medium: 'bg-yellow-400',
  low:    'bg-warm-300',
}

const SORT_OPTIONS = [
  { value: 'due_date:asc',    label: 'Due date (soonest)' },
  { value: 'due_date:desc',   label: 'Due date (latest)' },
  { value: 'priority:desc',   label: 'Priority (high first)' },
  { value: 'created_at:desc', label: 'Newest first' },
  { value: 'created_at:asc',  label: 'Oldest first' },
]

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function isOverdue(due_date) {
  if (!due_date) return false
  return new Date(due_date) < new Date(new Date().toDateString())
}

function formatDue(due_date) {
  if (!due_date) return null
  const d = new Date(due_date)
  const today = new Date(new Date().toDateString())
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < -1) return `${Math.abs(diff)}d overdue`
  if (diff < 7) return `${diff}d`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Member avatar ─────────────────────────────────────────────
function MemberAvatar({ member, size = 6 }) {
  if (!member) return null
  const name = member.name || member.users?.name || '?'
  const avatarUrl = member.avatar_url || member.users?.avatar_url
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const sz = `w-${size} h-${size}`
  if (avatarUrl) {
    return <img src={avatarUrl} className={`${sz} rounded-full object-cover flex-shrink-0`} alt={name} title={name} />
  }
  return (
    <div className={`${sz} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold flex-shrink-0`} title={name}>
      {initials}
    </div>
  )
}

// ── Assignee cell with dropdown ───────────────────────────────
function AssigneeCell({ task, groupMembers, onAssign }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const assignedUser = task.assigned_user
  const hasMembers = groupMembers && groupMembers.length > 0

  async function pick(memberId) {
    setOpen(false)
    if (memberId === (assignedUser?.id || null)) return
    setSaving(true)
    try {
      await onAssign(task.id, memberId)
    } finally {
      setSaving(false)
    }
  }

  if (!hasMembers) {
    if (!assignedUser) return <span className="text-xs text-warm-300">—</span>
    return (
      <div className="flex items-center gap-1.5">
        <MemberAvatar member={assignedUser} size={5} />
        <span className="text-xs text-warm-500 truncate max-w-[80px]">{assignedUser.name}</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="flex items-center gap-1.5 group hover:bg-warm-100 rounded-lg px-1.5 py-1 transition-colors"
        title="Assign member"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 text-primary-500 animate-spin" />
        ) : assignedUser ? (
          <>
            <MemberAvatar member={assignedUser} size={5} />
            <span className="text-xs text-warm-500 truncate max-w-[80px] hidden lg:block">{assignedUser.name}</span>
          </>
        ) : (
          <>
            <UserCircle className="w-5 h-5 text-warm-300 group-hover:text-warm-400" />
            <span className="text-xs text-warm-300 hidden lg:block">Assign</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 text-warm-300 opacity-0 group-hover:opacity-100" />
      </button>

      {open && (
        <div className="absolute left-0 top-8 bg-white border border-warm-200 rounded-xl shadow-xl z-30 min-w-[180px] py-1">
          <button
            onClick={() => pick(null)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-warm-500 hover:bg-warm-50"
          >
            <UserCircle className="w-5 h-5 text-warm-300" />
            Unassigned
          </button>
          <div className="border-t border-warm-100 my-1" />
          {groupMembers.map(m => {
            const u = m.users || m
            return (
              <button
                key={u.id}
                onClick={() => pick(u.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-primary-50 ${
                  assignedUser?.id === u.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-warm-900'
                }`}
              >
                <MemberAvatar member={u} size={5} />
                <span className="truncate">{u.name || u.email}</span>
                {assignedUser?.id === u.id && <Check className="w-3.5 h-3.5 ml-auto text-primary-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Priority badge ────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium
  const dot = PRIORITY_DOT[priority] || PRIORITY_DOT.medium
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded border font-medium ${m.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {m.label}
    </span>
  )
}

// ── Quick Add Form ────────────────────────────────────────────
function QuickAddRow({ projects, activeType, groupMembers, onAdd, onCancel }) {
  const [title, setTitle]         = useState('')
  const [priority, setPriority]   = useState('medium')
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [dueDate, setDueDate]     = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [saving, setSaving]       = useState(false)
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  async function submit(e) {
    e?.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await tasksApi.create({
        title: title.trim(), type: activeType, priority,
        project_id: projectId, due_date: dueDate || null,
        assigned_to: assignedTo || null,
      })
      toast.success('Task added!')
      onAdd()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') submit()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <tr className="bg-primary-50/50 border-t-2 border-primary-200">
      <td className="pl-4 py-2.5 w-8" />
      <td className="px-3 py-2.5" colSpan={2}>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={onKey}
          placeholder="Task title…"
          className="input w-full text-sm py-1.5"
        />
      </td>
      <td className="px-2 py-2.5 w-28 hidden sm:table-cell">
        <select value={priority} onChange={e => setPriority(e.target.value)}
          className="input text-xs py-1 w-full">
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </td>
      <td className="px-2 py-2.5 w-32 hidden md:table-cell">
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          className="input text-xs py-1 w-full">
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </td>
      {groupMembers.length > 0 && (
        <td className="px-2 py-2.5 w-32 hidden lg:table-cell">
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
            className="input text-xs py-1 w-full">
            <option value="">Unassigned</option>
            {groupMembers.map(m => {
              const u = m.users || m
              return <option key={u.id} value={u.id}>{u.name || u.email}</option>
            })}
          </select>
        </td>
      )}
      <td className="px-2 py-2.5 w-28 hidden lg:table-cell">
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          onClick={e => e.target.showPicker?.()}
          className="input text-xs py-1 w-full cursor-pointer" />
      </td>
      <td className="pr-4 py-2.5 w-20">
        <div className="flex gap-1">
          <button onClick={submit} disabled={!title.trim() || saving}
            className="btn-primary btn-sm">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Add
          </button>
          <button onClick={onCancel} className="p-1 text-warm-400 hover:text-warm-900 hover:bg-warm-100 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Task Row ──────────────────────────────────────────────────
function TaskRow({ task, selected, onSelect, onToggleDone, onDelete, onUpdate, onAssign, onNavigateTopic, groupMembers }) {
  const overdue = isOverdue(task.due_date)
  const dueLabel = formatDue(task.due_date)
  const done = task.status === 'done'

  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState({ title: task.title, priority: task.priority, due_date: task.due_date || '' })
  const [saving, setSaving]   = useState(false)
  const editRef = useRef()

  useEffect(() => { if (editing) editRef.current?.focus() }, [editing])

  async function saveEdit() {
    if (!draft.title.trim()) return
    setSaving(true)
    try {
      await onUpdate(task.id, { title: draft.title.trim(), priority: draft.priority, due_date: draft.due_date || null })
      setEditing(false)
    } finally { setSaving(false) }
  }

  function cancelEdit() {
    setDraft({ title: task.title, priority: task.priority, due_date: task.due_date || '' })
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="bg-primary-50/40 border-l-2 border-primary-400">
        <td className="pl-4 pr-2 py-2.5 w-10" />
        <td className="px-3 py-2.5" colSpan={2}>
          <input ref={editRef} value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
            className="input w-full text-sm py-1.5" />
        </td>
        <td className="px-2 py-2.5 w-28 hidden md:table-cell">
          <select value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))}
            className="input text-xs py-1 w-full">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </td>
        <td className="px-2 py-2.5 w-28 hidden lg:table-cell">
          <input type="date" value={draft.due_date} onChange={e => setDraft(d => ({ ...d, due_date: e.target.value }))}
            onClick={e => e.target.showPicker?.()}
            className="input text-xs py-1 w-full cursor-pointer" />
        </td>
        {groupMembers.length > 0 && <td className="px-2 py-2.5 hidden xl:table-cell" />}
        <td className="px-2 py-2.5 hidden xl:table-cell" />
        <td className="pr-4 py-2.5">
          <div className="flex gap-1">
            <button onClick={saveEdit} disabled={!draft.title.trim() || saving}
              className="btn-primary btn-sm">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button onClick={cancelEdit} className="text-xs text-warm-500 px-2 py-1 rounded hover:bg-warm-100">Cancel</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`group transition-colors ${overdue && !done ? 'border-l-4 border-red-400' : ''} ${done ? 'bg-warm-50/50' : 'hover:bg-warm-50'}`}>
      {/* Checkbox */}
      <td className="pl-4 pr-2 py-3 w-10">
        {selected ? (
          <button onClick={() => onSelect(task.id)} title="Deselect">
            <CheckSquare2 className="w-5 h-5 rounded accent-primary-600 cursor-pointer text-primary-600" />
          </button>
        ) : (
          <div className="relative w-5 h-5">
            <button onClick={() => onToggleDone(task)} title={done ? 'Mark pending' : 'Mark done'}
              className="absolute inset-0 transition-opacity group-hover:opacity-0">
              {done ? <CheckSquare2 className="w-5 h-5 rounded accent-primary-600 cursor-pointer text-green-500" /> : <Square className="w-5 h-5 rounded accent-primary-600 cursor-pointer text-warm-300" />}
            </button>
            <button onClick={() => onSelect(task.id)} title="Select for bulk action"
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Square className="w-5 h-5 rounded accent-primary-600 cursor-pointer text-primary-400 hover:text-primary-600" />
            </button>
          </div>
        )}
      </td>

      {/* Title */}
      <td className="px-3 py-3">
        <div className="min-w-0">
          <span className={`text-sm leading-snug ${done ? 'line-through text-warm-400' : 'text-warm-900'}`}>
            {task.title}
          </span>
          {task.assigned_to_name && !task.assigned_user && (
            <span className="ml-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              → {task.assigned_to_name}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1 sm:hidden">
            <PriorityBadge priority={task.priority} />
            {task.projects && <span className="text-xs text-warm-400">{task.projects.name}</span>}
          </div>
        </div>
      </td>

      {/* Priority */}
      <td className="px-3 py-3 w-24 hidden sm:table-cell">
        <PriorityBadge priority={task.priority} />
      </td>

      {/* Project */}
      <td className="px-3 py-3 w-32 hidden md:table-cell">
        {task.projects && (
          <span className="text-xs text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full line-clamp-1">
            {task.projects.name}
          </span>
        )}
      </td>

      {/* Assignee (team mode) */}
      {groupMembers.length > 0 && (
        <td className="px-2 py-3 w-32 hidden lg:table-cell">
          <AssigneeCell task={task} groupMembers={groupMembers} onAssign={onAssign} />
        </td>
      )}

      {/* Due date */}
      <td className="px-3 py-3 w-28 hidden lg:table-cell">
        {dueLabel ? (
          <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-warm-400'}`}>
            {overdue && <AlertTriangle className="w-3 h-3" />}
            {dueLabel}
          </span>
        ) : (
          <span className="text-xs text-warm-300">—</span>
        )}
      </td>

      {/* Topic */}
      <td className="px-3 py-3 w-28 hidden xl:table-cell">
        {task.topics ? (
          <button onClick={() => onNavigateTopic(task.topics.id)}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline truncate max-w-[100px]">
            <Tag className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{task.topics.title}</span>
          </button>
        ) : (
          <span className="text-xs text-warm-300">—</span>
        )}
      </td>

      {/* Edit + Delete + Generate Tests */}
      <td className="pr-4 py-3 w-32">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          {task.type !== 'test_case' && (
            <GenerateTestCasesButton taskId={task.id} label="" size="sm" variant="ghost" />
          )}
          <button onClick={() => setEditing(true)} title="Edit task"
            className="p-1 text-warm-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(task.id)} title="Delete task"
            className="p-1 text-warm-400 hover:text-red-400 hover:bg-red-50 rounded transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Bulk action bar ───────────────────────────────────────────
function BulkBar({ count, onMarkDone, onPriority, onClear }) {
  const [priorityOpen, setPriorityOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setPriorityOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary-600 text-white text-sm rounded-2xl mb-3">
      <span className="font-medium">{count} selected</span>
      <div className="flex gap-2 ml-auto">
        <button onClick={onMarkDone}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium">
          <CheckSquare2 className="w-3.5 h-3.5" /> Mark Done
        </button>
        <div className="relative" ref={ref}>
          <button onClick={() => setPriorityOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium">
            Priority <ChevronDown className={`w-3 h-3 transition-transform ${priorityOpen ? 'rotate-180' : ''}`} />
          </button>
          {priorityOpen && (
            <div className="absolute right-0 top-9 bg-white rounded-xl shadow-xl border border-warm-200 py-1 z-30 min-w-[110px]">
              {[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }].map(p => (
                <button key={p.value} onClick={() => { onPriority(p.value); setPriorityOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-warm-900 hover:bg-primary-50 hover:text-primary-700">
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onClear} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Lists() {
  const { user } = useAuth()
  const { projects, fetchProjects } = useProjectStore()
  const navigate = useNavigate()

  const [activeTab, setActiveTab]     = useState('task')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [tasks, setTasks]             = useState([])
  const [loading, setLoading]         = useState(false)
  const [filterProject, setFilterProject] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [sort, setSort]               = useState('priority:desc')
  const [search, setSearch]           = useState('')
  const [showDone, setShowDone]       = useState(false)
  const [selected, setSelected]       = useState(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [groupMembers, setGroupMembers] = useState([])
  const [userMode, setUserMode]       = useState(null)

  useEffect(() => {
    if (!user) return
    if (!projects.length) fetchProjects(user.id)

    async function loadGroupContext() {
      const { data: profile } = await supabase
        .from('users').select('mode').eq('id', user.id).single()
      setUserMode(profile?.mode)

      if (profile?.mode === 'team' || profile?.mode === 'org') {
        try {
          const res = await groupsApi.list()
          const groups = res.data.data || []
          if (groups.length > 0) {
            const groupRes = await groupsApi.getGroupMembers(groups[0].id)
            const members = groupRes.data.data?.members || []
            setGroupMembers(members)
          }
        } catch { /* non-fatal */ }
      }
    }
    loadGroupContext()
  }, [user]) // eslint-disable-line

  useEffect(() => { loadTasks() }, [activeTab, filterProject, showDone, assigneeFilter]) // eslint-disable-line

  async function loadTasks() {
    setLoading(true)
    setSelected(new Set())
    setShowAddForm(false)
    try {
      const params = { type: activeTab, show_done: showDone ? 'true' : 'false' }
      if (filterProject) params.project_id = filterProject
      if (assigneeFilter === 'mine')  params.mine = 'true'
      if (assigneeFilter === 'by_me') params.assigned_by_me = 'true'
      const res = await tasksApi.list(params)
      setTasks(res.data.data || [])
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  const displayed = useMemo(() => {
    let list = tasks.filter(t => {
      if (filterPriority && t.priority !== filterPriority) return false
      if (search) {
        const q = search.toLowerCase()
        return t.title.toLowerCase().includes(q) || t.projects?.name.toLowerCase().includes(q)
      }
      return true
    })
    const [field, dir] = sort.split(':')
    list = [...list].sort((a, b) => {
      let av = field === 'priority' ? PRIORITY_ORDER[a.priority] ?? 1 : a[field]
      let bv = field === 'priority' ? PRIORITY_ORDER[b.priority] ?? 1 : b[field]
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [tasks, filterPriority, search, sort])

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll() {
    if (selected.size === displayed.length) setSelected(new Set())
    else setSelected(new Set(displayed.map(t => t.id)))
  }

  async function toggleDone(task) {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    try {
      await tasksApi.update(task.id, { status: newStatus })
      if (!showDone && newStatus === 'done') setTasks(ts => ts.filter(t => t.id !== task.id))
      else setTasks(ts => ts.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    } catch { toast.error('Failed to update task') }
  }

  async function deleteTask(id) {
    try {
      await tasksApi.delete(id)
      setTasks(ts => ts.filter(t => t.id !== id))
      setSelected(s => { const n = new Set(s); n.delete(id); return n })
      toast.success('Task deleted')
    } catch { toast.error('Failed to delete task') }
  }

  async function updateTask(taskId, patch) {
    try {
      const res = await tasksApi.update(taskId, patch)
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...res.data.data } : t))
      toast.success('Task updated')
    } catch {
      toast.error('Failed to update task')
      throw new Error('update failed')
    }
  }

  async function assignTask(taskId, memberId) {
    try {
      const res = await tasksApi.assign(taskId, memberId)
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...res.data.data } : t))
      toast.success(memberId ? 'Task assigned' : 'Assignee removed')
    } catch { toast.error('Failed to assign task') }
  }

  async function bulkMarkDone() {
    const ids = [...selected]
    try {
      await tasksApi.bulk({ task_ids: ids, updates: { status: 'done' } })
      toast.success(`${ids.length} tasks marked done`)
      if (!showDone) setTasks(ts => ts.filter(t => !ids.includes(t.id)))
      else setTasks(ts => ts.map(t => ids.includes(t.id) ? { ...t, status: 'done' } : t))
      setSelected(new Set())
    } catch { toast.error('Bulk update failed') }
  }

  async function bulkPriority(priority) {
    const ids = [...selected]
    try {
      await tasksApi.bulk({ task_ids: ids, updates: { priority } })
      setTasks(ts => ts.map(t => ids.includes(t.id) ? { ...t, priority } : t))
      toast.success(`Updated ${ids.length} tasks to ${priority} priority`)
      setSelected(new Set())
    } catch { toast.error('Bulk update failed') }
  }

  const pendingCount = tasks.filter(t => t.status !== 'done').length
  const overdueCount = tasks.filter(t => isOverdue(t.due_date) && t.status !== 'done').length
  const isTeamMode = userMode === 'team' || userMode === 'org'

  return (
    <PageShell>
      <PageHeader
        title="Task Lists"
        subtitle={
          <>
            {pendingCount} pending
            {overdueCount > 0 && <span className="text-red-500 ml-2">· {overdueCount} overdue</span>}
          </>
        }
        actions={
          <>
            <button onClick={loadTasks} disabled={loading} className="btn-secondary btn-sm">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => setShowAddForm(true)} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </>
        }
      />

      <FilterPills
        value={activeTab}
        onChange={key => { setActiveTab(key); setSearch('') }}
        options={TABS.map(t => ({
          value: t.key,
          label: t.label,
          icon: t.icon,
          count: tasks.filter(t2 => t2.type === t.key && t2.status !== 'done').length,
        }))}
        className="mb-6"
      />

      {isTeamMode && (
        <div className="mb-4">
          <FilterPills
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            options={[
              { value: 'all',   label: 'All Tasks',     icon: ListChecks },
              { value: 'mine',  label: 'My Tasks',      icon: UserCircle },
              { value: 'by_me', label: 'Assigned by Me', icon: Users },
            ]}
          />
        </div>
      )}

      <PageToolbar className="mb-4">
        <ProjectSelect
          value={filterProject}
          onChange={setFilterProject}
          projects={projects}
          showAll
        />
        <FilterPills
          value={filterPriority}
          onChange={setFilterPriority}
          options={[
            { value: '', label: 'All' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Med' },
            { value: 'low', label: 'Low' },
          ]}
        />
        <SortSelect value={sort} onChange={setSort} options={SORT_OPTIONS} />
        <button onClick={() => setShowDone(d => !d)}
          className={`tab-pill ${showDone ? 'active' : 'inactive'}`}>
          <CheckSquare2 className="w-3.5 h-3.5" /> Show Done
        </button>
        <SearchInput value={search} onChange={setSearch} placeholder="Search tasks…" className="w-64 flex-none" />
      </PageToolbar>

      {selected.size > 0 && (
        <BulkBar count={selected.size} onMarkDone={bulkMarkDone} onPriority={bulkPriority} onClear={() => setSelected(new Set())} />
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden shadow-sm">
        {loading ? (
          <PageLoader className="py-16" />
        ) : displayed.length === 0 && !showAddForm ? (
          (() => { const T = TABS.find(t => t.key === activeTab); const Icon = T.icon; return (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon className="w-8 h-8" /></div>
              <p className="empty-state-title">{T.emptyMsg}</p>
              <button onClick={() => setShowAddForm(true)}
                className="btn-primary btn-sm mt-4">
                <Plus className="w-3.5 h-3.5" /> Add one manually
              </button>
            </div>
          )})()
        ) : (
          <table className="w-full">
            <thead className="bg-warm-50 border-b border-warm-200">
              <tr>
                <th className="pl-4 pr-2 py-2.5 w-10">
                  <button onClick={toggleSelectAll} className="text-warm-300 hover:text-primary-600">
                    {selected.size === displayed.length && displayed.length > 0
                      ? <CheckSquare2 className="w-4 h-4 text-primary-600" />
                      : <Square className="w-4 h-4" />
                    }
                  </button>
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-warm-500">Task</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-warm-500 w-24 hidden sm:table-cell">Priority</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-warm-500 w-32 hidden md:table-cell">Project</th>
                {isTeamMode && <th className="px-3 py-2.5 text-left text-xs font-medium text-warm-500 w-32 hidden lg:table-cell">Assignee</th>}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-warm-500 w-28 hidden lg:table-cell">Due</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-warm-500 w-28 hidden xl:table-cell">Topic</th>
                <th className="pr-4 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {displayed.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  selected={selected.has(task.id)}
                  groupMembers={groupMembers}
                  onSelect={toggleSelect}
                  onToggleDone={toggleDone}
                  onDelete={deleteTask}
                  onUpdate={updateTask}
                  onAssign={assignTask}
                  onNavigateTopic={id => navigate(`/topics/${id}`)}
                />
              ))}
              {showAddForm && (
                <QuickAddRow
                  projects={projects}
                  activeType={activeTab}
                  groupMembers={groupMembers}
                  onAdd={() => { setShowAddForm(false); loadTasks() }}
                  onCancel={() => setShowAddForm(false)}
                />
              )}
            </tbody>
          </table>
        )}

        {!loading && displayed.length > 0 && (
          <div className="px-4 py-2.5 border-t border-warm-100 bg-warm-50 text-xs text-warm-400 flex items-center justify-between">
            <span>
              {displayed.length} task{displayed.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
              {overdueCount > 0 && <span className="text-red-500 ml-2">· {overdueCount} overdue</span>}
            </span>
            {showAddForm ? (
              <button onClick={() => setShowAddForm(false)} className="text-warm-400 hover:text-warm-900 flex items-center gap-1">
                <X className="w-3 h-3" /> Cancel add
              </button>
            ) : (
              <button onClick={() => setShowAddForm(true)} className="text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add task
              </button>
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}
