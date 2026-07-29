import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useProjectStore } from '../stores/useProjectStore'
import { tasksApi, groupsApi, customFieldsApi, timeEntriesApi, taskUpdatesApi, taskLinksApi } from '../services/api'
import { STATUS_COLORS } from '../config/statuses'
import {
  LayoutGrid, List, Plus, ChevronDown, X, Loader2,
  RefreshCw, Calendar, Tag, UserCircle, Trash2, Check,
  AlertTriangle, Clock, UserPlus, Play, Square, Timer, Pencil,
  MessageSquare, ShieldAlert, Lightbulb, CheckCheck, Send, Sparkles,
  Link2, Unlink, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import TaskIdBadge, { getProjectPrefix } from '../components/shared/TaskIdBadge'

// ── Workflow statuses ─────────────────────────────────────────
const WORKFLOW = [
  { key: 'backlog',      label: 'Backlog',      headerBg: 'bg-warm-100',    dotColor: 'bg-warm-300',   textColor: 'text-warm-500',   badgeBg: 'bg-warm-100 text-warm-500'     },
  { key: 'todo',         label: 'To Do',        headerBg: 'bg-warm-100',    dotColor: 'bg-warm-400',   textColor: 'text-warm-600',   badgeBg: 'bg-warm-100 text-warm-600'     },
  { key: 'in_progress',  label: 'In Progress',  headerBg: 'bg-blue-100',    dotColor: 'bg-blue-500',   textColor: 'text-blue-700',   badgeBg: 'bg-blue-100 text-blue-700'     },
  { key: 'blocked',      label: 'Blocked',      headerBg: 'bg-red-100',     dotColor: 'bg-red-500',    textColor: 'text-red-700',    badgeBg: 'bg-red-100 text-red-700'       },
  { key: 'in_review',    label: 'In Review',    headerBg: 'bg-violet-100',  dotColor: 'bg-violet-500', textColor: 'text-violet-700', badgeBg: 'bg-violet-100 text-violet-700' },
  { key: 'qa_testing',   label: 'QA Testing',   headerBg: 'bg-amber-100',   dotColor: 'bg-amber-500',  textColor: 'text-amber-700',  badgeBg: 'bg-amber-100 text-amber-700'   },
  { key: 'uat',          label: 'UAT',          headerBg: 'bg-orange-100',  dotColor: 'bg-orange-500', textColor: 'text-orange-700', badgeBg: 'bg-orange-100 text-orange-700' },
  { key: 'deployment',   label: 'Deployment',   headerBg: 'bg-teal-100',    dotColor: 'bg-teal-500',   textColor: 'text-teal-700',   badgeBg: 'bg-teal-100 text-teal-700'     },
  { key: 'pilot',        label: 'Pilot',        headerBg: 'bg-pink-100',    dotColor: 'bg-pink-500',   textColor: 'text-pink-700',   badgeBg: 'bg-pink-100 text-pink-700'     },
  { key: 'done',         label: 'Done / Prod',  headerBg: 'bg-green-100',   dotColor: 'bg-green-500',  textColor: 'text-green-700',  badgeBg: 'bg-green-100 text-green-700'   },
  // Legacy keys — kept so old tasks still render
  { key: 'pending_uat',  label: 'Pending UAT',  headerBg: 'bg-amber-100',   dotColor: 'bg-amber-500',  textColor: 'text-amber-700',  badgeBg: 'bg-amber-100 text-amber-700'   },
  { key: 'pending_prod', label: 'Pending Prod', headerBg: 'bg-orange-100',  dotColor: 'bg-orange-500', textColor: 'text-orange-700', badgeBg: 'bg-orange-100 text-orange-700' },
  { key: 'released',     label: 'Released',     headerBg: 'bg-teal-100',    dotColor: 'bg-teal-500',   textColor: 'text-teal-700',   badgeBg: 'bg-teal-100 text-teal-700'     },
]

const WORKFLOW_MAP = Object.fromEntries(WORKFLOW.map(w => [w.key, w]))

function normalizeStatus(s) {
  if (s === 'pending') return 'todo'
  return s || 'todo'
}

// ── Convert statuses config → workflow format ─────────────────
function workflowFromStatuses(statuses) {
  if (!statuses?.length) return WORKFLOW
  return statuses.map(s => {
    const colors = STATUS_COLORS[s.color] || STATUS_COLORS.warm
    return {
      key:      s.key,
      label:    s.label,
      is_done:  s.is_done,
      headerBg: colors.header,
      dotColor: colors.dot,
      textColor:colors.text,
      badgeBg:  colors.badge,
    }
  })
}

// ── Map a raw DB status key to the nearest key in the workflow ─
function normalizeToWorkflow(raw, workflow) {
  if (!raw || !workflow?.length) return workflow?.[0]?.key || 'todo'
  const val = raw === 'pending' ? 'todo' : raw
  if (workflow.find(w => w.key === val)) return val
  // Legacy done/released → first is_done status in pipeline
  if (val === 'done' || val === 'released') {
    return workflow.find(w => w.is_done)?.key || workflow[workflow.length - 1]?.key || val
  }
  // Unknown key → first status
  return workflow[0]?.key || val
}

// ── Priority meta ─────────────────────────────────────────────
const PRIORITY_META = {
  high:   { label: 'High',   dot: 'bg-red-500',    badge: 'bg-red-50 text-red-600 border border-red-200'       },
  medium: { label: 'Med',    dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-600 border border-yellow-200' },
  low:    { label: 'Low',    dot: 'bg-warm-300',   badge: 'bg-warm-100 text-warm-500 border border-warm-200'   },
}

// ── Helpers ───────────────────────────────────────────────────
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

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name, size = 6 }) {
  const sz = `w-${size} h-${size}`
  return (
    <div className={`${sz} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold flex-shrink-0`} title={name}>
      {getInitials(name)}
    </div>
  )
}

// TaskIdBadge is imported from components/shared/TaskIdBadge

// ── Portal Dropdown — renders above overflow:hidden containers ─
function PortalDropdown({ anchorRef, open, minWidth = 160, children }) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom
      const dropH = 320 // max estimated height
      const top = spaceBelow > dropH ? r.bottom + 4 : r.top - dropH - 4
      setPos({ top, left: r.left })
    }
  }, [open, anchorRef])

  if (!open) return null
  return createPortal(
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth, zIndex: 9999 }}
      className="bg-white border border-warm-200 rounded-xl shadow-xl py-1"
    >
      {children}
    </div>,
    document.body
  )
}

function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return { open, setOpen, ref }
}

// ── Status Badge (clickable dropdown) ────────────────────────
function StatusBadge({ status, onChange, disabled, workflow = WORKFLOW }) {
  const { open, setOpen, ref } = useDropdown()
  const workflowMap = Object.fromEntries(workflow.map(w => [w.key, w]))
  const currentKey = normalizeToWorkflow(status, workflow)
  const wf = workflowMap[currentKey] || workflow[0] || WORKFLOW_MAP.todo

  return (
    <div ref={ref}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${wf.badgeBg} ${disabled ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${wf.dotColor}`} />
        {wf.label}
        {!disabled && <ChevronDown className="w-3 h-3 opacity-60" />}
      </button>
      <PortalDropdown anchorRef={ref} open={open} minWidth={160}>
        {workflow.map(w => (
          <button
            key={w.key}
            onClick={() => { onChange(w.key); setOpen(false) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-warm-50 ${w.key === currentKey ? 'bg-warm-50 font-medium' : 'text-warm-800'}`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${w.dotColor}`} />
            <span className={w.textColor}>{w.label}</span>
            {w.key === currentKey && <Check className="w-3.5 h-3.5 ml-auto text-primary-600" />}
          </button>
        ))}
      </PortalDropdown>
    </div>
  )
}

// ── Priority Badge (static) ───────────────────────────────────
function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.medium
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  )
}

// ── Priority Select (inline editable) ────────────────────────
function PrioritySelect({ priority, onChange }) {
  const { open, setOpen, ref } = useDropdown()
  const m = PRIORITY_META[priority] || PRIORITY_META.medium

  return (
    <div ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${m.badge}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
        {m.label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      <PortalDropdown anchorRef={ref} open={open} minWidth={130}>
        {Object.entries(PRIORITY_META).map(([key, pm]) => (
          <button
            key={key}
            onClick={() => { onChange(key); setOpen(false) }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-warm-50 ${key === priority ? 'bg-warm-50 font-medium' : 'text-warm-800'}`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pm.dot}`} />
            <span>{pm.label}</span>
            {key === priority && <Check className="w-3.5 h-3.5 ml-auto text-primary-600" />}
          </button>
        ))}
      </PortalDropdown>
    </div>
  )
}

// ── Assignee Select (inline editable) ────────────────────────
function AssigneeSelect({ task, groupMembers, onChange }) {
  const { open, setOpen, ref } = useDropdown()
  const assigned = task.assigned_user

  return (
    <div ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-warm-600 hover:text-primary-600 group/assign"
      >
        {assigned ? (
          <>
            <Avatar name={assigned.name} size={5} />
            <span className="truncate max-w-[80px]">{assigned.name}</span>
          </>
        ) : (
          <span className="text-warm-300 group-hover/assign:text-primary-500 flex items-center gap-1">
            <UserPlus className="w-3.5 h-3.5" />
            Assign
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-40 flex-shrink-0" />
      </button>
      <PortalDropdown anchorRef={ref} open={open} minWidth={180}>
        <button
          onClick={() => { onChange(null); setOpen(false) }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-warm-500 hover:bg-warm-50"
        >
          <span className="w-5 h-5 rounded-full border-2 border-dashed border-warm-300 flex-shrink-0" />
          Unassigned
          {!assigned && <Check className="w-3.5 h-3.5 ml-auto text-primary-600" />}
        </button>
        {groupMembers.map(m => {
          const u = m.users || m
          return (
            <button
              key={u.id}
              onClick={() => { onChange(u.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-warm-50 ${u.id === (task.assigned_user?.id || task.assigned_to) ? 'bg-warm-50 font-medium' : 'text-warm-800'}`}
            >
              <Avatar name={u.name || u.email} size={5} />
              <span className="truncate">{u.name || u.email}</span>
              {u.id === (task.assigned_user?.id || task.assigned_to) && <Check className="w-3.5 h-3.5 ml-auto text-primary-600" />}
            </button>
          )
        })}
      </PortalDropdown>
    </div>
  )
}

// ── Due Date Picker (inline) ──────────────────────────────────
function DueDatePicker({ dueDate, onChange }) {
  const inputRef = useRef()
  const overdue = isOverdue(dueDate)
  const label = formatDue(dueDate)

  return (
    <div className="relative">
      <button
        onClick={() => inputRef.current?.showPicker?.() || inputRef.current?.click()}
        className={`flex items-center gap-1 text-xs hover:text-primary-600 transition-colors ${
          overdue ? 'text-red-500 font-medium' : dueDate ? 'text-warm-500' : 'text-warm-300 hover:text-primary-500'
        }`}
      >
        {overdue ? <AlertTriangle className="w-3 h-3 flex-shrink-0" /> : <Calendar className="w-3 h-3 flex-shrink-0" />}
        {label || 'Set date'}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={dueDate ? dueDate.slice(0, 10) : ''}
        onChange={e => onChange(e.target.value || null)}
        className="absolute inset-0 opacity-0 w-0 h-0 pointer-events-none"
        tabIndex={-1}
      />
    </div>
  )
}

// ── Add Task Modal ────────────────────────────────────────────
function AddTaskModal({ projects, groupMembers, initialStatus, onClose, onSave, workflow = WORKFLOW }) {
  const [title, setTitle]       = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [status, setStatus]     = useState(initialStatus || workflow[0]?.key || 'todo')
  const [priority, setPriority] = useState('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate]   = useState('')
  const [type, setType]         = useState('task')
  const [saving, setSaving]     = useState(false)
  const titleRef = useRef()

  useEffect(() => { titleRef.current?.focus() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !projectId) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        project_id: projectId,
        status,
        priority,
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        type,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-900">New Task</h2>
          <button onClick={onClose} className="p-1 text-warm-400 hover:text-warm-900 rounded-lg hover:bg-warm-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="label">Title <span className="text-red-500">*</span></label>
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title…"
              className="input w-full"
              required
            />
          </div>
          {/* Project */}
          <div>
            <label className="label">Project <span className="text-red-500">*</span></label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input w-full" required>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="input w-full">
                {workflow.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="input w-full">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          {/* Assignee */}
          {groupMembers.length > 0 && (
            <div>
              <label className="label">Assignee</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="input w-full">
                <option value="">Unassigned</option>
                {groupMembers.map(m => {
                  const u = m.users || m
                  return <option key={u.id} value={u.id}>{u.name || u.email}</option>
                })}
              </select>
            </div>
          )}
          {/* Due date + Type row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                onClick={e => e.target.showPicker?.()}
                className="input w-full cursor-pointer" />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="input w-full">
                <option value="task">Task</option>
                <option value="deployment_check">Post Deploy</option>
                <option value="backlog">Backlog</option>
              </select>
            </div>
          </div>
          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={!title.trim() || !projectId || saving} className="btn btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteConfirmModal({ title, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-warm-900 text-center mb-1">Delete task?</h3>
        <p className="text-sm text-warm-500 text-center mb-6 line-clamp-2">"{title}"</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 btn bg-red-500 text-white hover:bg-red-600 border-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Detail Panel ──────────────────────────────────────────────
function DetailPanel({ task, groupMembers, projects, allTasks = [], onClose, onUpdate, onDelete, onStatusChange, onTaskClick, workflow = WORKFLOW }) {
  const [title, setTitle]       = useState(task.title)
  const [priority, setPriority] = useState(task.priority || 'medium')
  const [dueDate, setDueDate]   = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [description, setDescription] = useState(task.description || '')
  const [assignedTo, setAssignedTo]   = useState(task.assigned_user?.id || task.assigned_to || '')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Recurrence
  const [recurrenceRule, setRecurrenceRule] = useState(task.recurrence_rule || 'none')
  const [recurrenceEnd,  setRecurrenceEnd]  = useState(task.recurrence_end ? task.recurrence_end.slice(0, 10) : '')
  // Time tracking
  const [timeEntries,   setTimeEntries]   = useState([])
  const [timerRunning,  setTimerRunning]  = useState(false)
  const [timerSeconds,  setTimerSeconds]  = useState(0)
  const [manualMins,    setManualMins]    = useState('')
  const [timeNotes,     setTimeNotes]     = useState('')
  const [loggingTime,   setLoggingTime]   = useState(false)
  const [showTimeForm,  setShowTimeForm]  = useState(false)
  const timerRef = useRef(null)
  // Custom fields
  const [customFields,  setCustomFields]  = useState([])
  const [fieldValues,   setFieldValues]   = useState({})
  // Task updates / activity feed
  const [taskUpdates,      setTaskUpdates]      = useState([])
  const [updateInput,      setUpdateInput]      = useState('')
  const [updateType,       setUpdateType]       = useState('update')
  const [submittingUpdate, setSubmittingUpdate] = useState(false)
  const [loadingUpdates,     setLoadingUpdates]     = useState(true)
  const [aiGenerating,       setAiGenerating]       = useState(false)
  const [confirmDeleteId,    setConfirmDeleteId]    = useState(null)
  const [editingUpdateId,    setEditingUpdateId]    = useState(null)
  const [editContent,        setEditContent]        = useState('')
  const [editType,           setEditType]           = useState('update')
  const [savingEdit,         setSavingEdit]         = useState(false)
  // Task links
  const [taskLinks,          setTaskLinks]          = useState([])
  const [loadingLinks,       setLoadingLinks]       = useState(true)
  const [showAddLink,        setShowAddLink]        = useState(false)
  const [linkSearch,         setLinkSearch]         = useState('')
  const [linkSearchResults,  setLinkSearchResults]  = useState([])
  const [linkSearchLoading,  setLinkSearchLoading]  = useState(false)
  const [selectedLinkTarget, setSelectedLinkTarget] = useState(null)
  const [selectedLinkType,   setSelectedLinkType]   = useState('relates_to')
  const [linkNote,           setLinkNote]           = useState('')
  const [savingLink,         setSavingLink]         = useState(false)
  const [confirmRemoveLinkId, setConfirmRemoveLinkId] = useState(null)
  const linkSearchRef = useRef(null)
  const linkDebounceRef = useRef(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  // Load custom field definitions + task values + time entries on mount
  useEffect(() => {
    customFieldsApi.list()
      .then(r => setCustomFields(r.data.data || []))
      .catch(() => {})
    customFieldsApi.getValues(task.id)
      .then(r => setFieldValues(r.data.data || {}))
      .catch(() => {})
    timeEntriesApi.list({ task_id: task.id })
      .then(r => setTimeEntries(r.data.data || []))
      .catch(() => {})
    setLoadingUpdates(true)
    taskUpdatesApi.list(task.id)
      .then(r => setTaskUpdates(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingUpdates(false))
    setLoadingLinks(true)
    taskLinksApi.list(task.id)
      .then(r => setTaskLinks(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoadingLinks(false))
  }, [task.id])

  // Timer tick
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning])

  function fmtTimer(secs) {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${m}:${String(s).padStart(2,'0')}`
  }

  function fmtMins(mins) {
    if (!mins) return '0m'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
  }

  async function stopTimerAndLog() {
    setTimerRunning(false)
    const mins = Math.max(1, Math.round(timerSeconds / 60))
    setTimerSeconds(0)
    await logTime(mins, timeNotes)
  }

  async function logTime(mins, notes) {
    if (!mins || mins <= 0) return
    setLoggingTime(true)
    try {
      const r = await timeEntriesApi.create({ task_id: task.id, duration_mins: parseInt(mins), notes: notes || null })
      setTimeEntries(prev => [r.data.data, ...prev])
      setManualMins('')
      setTimeNotes('')
      setShowTimeForm(false)
      toast.success(`Logged ${fmtMins(parseInt(mins))}`)
    } catch {
      toast.error('Failed to log time')
    } finally {
      setLoggingTime(false)
    }
  }

  async function deleteTimeEntry(entryId) {
    await timeEntriesApi.delete(entryId).catch(() => {})
    setTimeEntries(prev => prev.filter(e => e.id !== entryId))
  }

  const totalMins = timeEntries.reduce((sum, e) => sum + (e.duration_mins || 0), 0)

  const workflowMap = Object.fromEntries(workflow.map(w => [w.key, w]))
  const currentKey = normalizeToWorkflow(task.status, workflow)
  const wf = workflowMap[currentKey] || workflow[0] || WORKFLOW_MAP.todo

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onUpdate(task.id, {
        title: title.trim(),
        priority,
        due_date: dueDate || null,
        description: description || null,
        recurrence_rule: recurrenceRule !== 'none' ? recurrenceRule : null,
        recurrence_end:  (recurrenceRule !== 'none' && recurrenceEnd) ? recurrenceEnd : null,
      })
      if (assignedTo !== (task.assigned_user?.id || task.assigned_to || '')) {
        await onUpdate(task.id, { assigned_to: assignedTo || null })
      }
      // Save custom field values if any fields exist
      if (customFields.length > 0) {
        await customFieldsApi.saveValues(task.id, fieldValues).catch(() => {})
      }
      toast.success('Task saved')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    // Calls requestDelete in parent which shows the custom modal
    onDelete(task.id, task.title)
  }

  async function submitUpdate() {
    if (!updateInput.trim()) return
    setSubmittingUpdate(true)
    try {
      const r = await taskUpdatesApi.create(task.id, updateInput.trim(), updateType)
      setTaskUpdates(prev => [r.data.data, ...prev])
      setUpdateInput('')
      setUpdateType('update')
      toast.success('Update posted')
    } catch {
      toast.error('Failed to post update')
    } finally {
      setSubmittingUpdate(false)
    }
  }

  async function deleteUpdate(updateId) {
    await taskUpdatesApi.delete(task.id, updateId).catch(() => {})
    setTaskUpdates(prev => prev.filter(u => u.id !== updateId))
  }

  async function generateAiUpdate() {
    if (!updateInput.trim()) return
    setAiGenerating(true)
    try {
      const r = await tasksApi.suggestUpdate(task.id, updateInput.trim())
      setUpdateInput(r.data.suggestion || updateInput)
    } catch {
      toast.error('AI could not improve the text')
    } finally {
      setAiGenerating(false)
    }
  }

  function startEdit(upd) {
    setEditingUpdateId(upd.id)
    setEditContent(upd.content)
    setEditType(upd.update_type)
  }

  function cancelEdit() {
    setEditingUpdateId(null)
    setEditContent('')
  }

  async function saveEditedUpdate() {
    if (!editContent.trim()) return
    setSavingEdit(true)
    try {
      const r = await taskUpdatesApi.update(task.id, editingUpdateId, editContent.trim(), editType)
      setTaskUpdates(prev => prev.map(u => u.id === editingUpdateId ? r.data.data : u))
      setEditingUpdateId(null)
      setEditContent('')
      toast.success('Update saved')
    } catch {
      toast.error('Failed to save edit')
    } finally {
      setSavingEdit(false)
    }
  }

  async function confirmDeleteUpdate() {
    if (!confirmDeleteId) return
    await taskUpdatesApi.delete(task.id, confirmDeleteId).catch(() => {})
    setTaskUpdates(prev => prev.filter(u => u.id !== confirmDeleteId))
    setConfirmDeleteId(null)
  }

  // ── Link helpers ─────────────────────────────────────────────
  const LINK_TYPE_META = {
    relates_to:  { label: 'Relates to',   color: 'bg-warm-100 text-warm-600 border-warm-200' },
    blocks:      { label: 'Blocks',        color: 'bg-red-50 text-red-600 border-red-200' },
    blocked_by:  { label: 'Blocked by',   color: 'bg-orange-50 text-orange-600 border-orange-200' },
    duplicates:  { label: 'Duplicates',   color: 'bg-violet-50 text-violet-600 border-violet-200' },
    parent:      { label: 'Parent of',    color: 'bg-blue-50 text-blue-600 border-blue-200' },
    child:       { label: 'Sub-task of',  color: 'bg-teal-50 text-teal-600 border-teal-200' },
  }

  function searchLinkedTasks(q) {
    if (!q || q.length < 2) { setLinkSearchResults([]); return }
    setLinkSearchLoading(true)
    // Search from already-loaded tasks first (fast, client-side)
    const qLow = q.toLowerCase().replace(/^#/, '')
    const results = (allTasks || [])
      .filter(t => t.id !== task.id)
      .filter(t => {
        const taskId = t.task_number ? `${getProjectPrefix(t.projects?.name)}-${t.task_number}`.toLowerCase() : ''
        return (
          t.title.toLowerCase().includes(qLow) ||
          taskId.includes(qLow) ||
          (t.task_number ? String(t.task_number).includes(qLow) : false)
        )
      })
      .slice(0, 8)
    setLinkSearchResults(results)
    setLinkSearchLoading(false)
  }

  async function addLink() {
    if (!selectedLinkTarget) return
    setSavingLink(true)
    try {
      const r = await taskLinksApi.create(task.id, selectedLinkTarget.id, selectedLinkType, linkNote.trim() || null)
      setTaskLinks(prev => [...prev, r.data.data])
      setShowAddLink(false)
      setLinkSearch('')
      setLinkNote('')
      setSelectedLinkTarget(null)
      setSelectedLinkType('relates_to')
      toast.success('Link added')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add link')
    } finally {
      setSavingLink(false)
    }
  }

  async function removeLink(linkId) {
    try {
      await taskLinksApi.delete(task.id, linkId)
      setTaskLinks(prev => prev.filter(l => l.id !== linkId))
      toast.success('Link removed')
    } catch {
      toast.error('Failed to remove link')
    }
  }

  const UPDATE_TYPES = [
    { key: 'update',   label: 'Update',   icon: <MessageSquare className="w-3.5 h-3.5" />, pill: 'bg-blue-50 text-blue-600 border-blue-200',   activePill: 'bg-blue-600 text-white border-blue-600' },
    { key: 'blocker',  label: 'Blocker',  icon: <ShieldAlert className="w-3.5 h-3.5" />,   pill: 'bg-red-50 text-red-600 border-red-200',     activePill: 'bg-red-600 text-white border-red-600' },
    { key: 'opinion',  label: 'Opinion',  icon: <Lightbulb className="w-3.5 h-3.5" />,     pill: 'bg-amber-50 text-amber-600 border-amber-200', activePill: 'bg-amber-500 text-white border-amber-500' },
    { key: 'resolved', label: 'Resolved', icon: <CheckCheck className="w-3.5 h-3.5" />,    pill: 'bg-green-50 text-green-600 border-green-200', activePill: 'bg-green-600 text-white border-green-600' },
  ]
  const typeStyleMap = {
    update:   { bg: 'bg-blue-50 border-blue-100',   badge: 'bg-blue-100 text-blue-600',    icon: <MessageSquare className="w-3 h-3" /> },
    blocker:  { bg: 'bg-red-50 border-red-100',     badge: 'bg-red-100 text-red-600',      icon: <ShieldAlert className="w-3 h-3" /> },
    opinion:  { bg: 'bg-amber-50 border-amber-100', badge: 'bg-amber-100 text-amber-600',  icon: <Lightbulb className="w-3 h-3" /> },
    resolved: { bg: 'bg-green-50 border-green-100', badge: 'bg-green-100 text-green-700',  icon: <CheckCheck className="w-3 h-3" /> },
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-warm-200">

        {/* ── Modal header ── */}
        <div className={`px-6 py-4 border-b border-warm-200 ${wf.headerBg} flex items-center justify-between gap-4 flex-shrink-0`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`w-3 h-3 rounded-full flex-shrink-0 ${wf.dotColor}`} />
            <StatusBadge
              status={task.status}
              onChange={newStatus => onStatusChange(task.id, newStatus)}
              workflow={workflow}
            />
            {task.task_number && (
              <TaskIdBadge
                taskNumber={task.task_number}
                projectName={task.projects?.name}
                className="text-[11px] px-2 py-1 rounded-lg bg-white/60 border border-warm-200"
              />
            )}
            {task.projects && (
              <span className="text-xs text-warm-400 truncate hidden sm:block">
                {task.projects.name}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 text-warm-500 hover:text-warm-900 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* ── LEFT: task fields ── */}
          <div className="w-[52%] border-r border-warm-200 overflow-y-auto p-6 space-y-4 flex-shrink-0">
        {/* Title */}
        <div>
          <label className="label">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input w-full font-medium"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="label">Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} className="input w-full">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Assignee */}
        {groupMembers.length > 0 && (
          <div>
            <label className="label">Assignee</label>
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="input w-full">
              <option value="">Unassigned</option>
              {groupMembers.map(m => {
                const u = m.users || m
                return <option key={u.id} value={u.id}>{u.name || u.email}</option>
              })}
            </select>
          </div>
        )}

        {/* Due date */}
        <div>
          <label className="label">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            onClick={e => e.target.showPicker?.()}
            className="input w-full cursor-pointer"
          />
        </div>

        {/* Project */}
        {task.projects && (
          <div>
            <label className="label">Project</label>
            <div className="text-sm text-warm-700 px-2 py-1.5 bg-warm-50 border border-warm-200 rounded-lg">
              {task.projects.name}
            </div>
          </div>
        )}

        {/* Topic link */}
        {task.topics && (
          <div>
            <label className="label">Topic</label>
            <button
              onClick={() => navigate(`/topics/${task.topics.id}`)}
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 hover:underline"
            >
              <Tag className="w-3.5 h-3.5 flex-shrink-0" />
              {task.topics.title}
            </button>
          </div>
        )}

        {/* Description */}
        <div>
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="Add a description…"
            className="input w-full resize-none"
          />
        </div>

        {/* Time tracking */}
        <div className="border-t border-warm-100 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" />
              Time Logged
              {totalMins > 0 && <span className="font-bold text-warm-700">{fmtMins(totalMins)}</span>}
            </p>
            <div className="flex items-center gap-1">
              {/* Live timer */}
              {timerRunning ? (
                <button
                  onClick={stopTimerAndLog}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 transition-colors"
                >
                  <Square className="w-3 h-3" />
                  {fmtTimer(timerSeconds)}
                </button>
              ) : (
                <button
                  onClick={() => { setTimerRunning(true); setTimerSeconds(0) }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  Start
                </button>
              )}
              {/* Manual log */}
              <button
                onClick={() => setShowTimeForm(v => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-warm-100 text-warm-600 text-xs font-medium hover:bg-warm-200 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                Log
              </button>
            </div>
          </div>

          {/* Manual time entry form */}
          {showTimeForm && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="label">Minutes</label>
                <input
                  type="number"
                  min="1"
                  value={manualMins}
                  onChange={e => setManualMins(e.target.value)}
                  placeholder="e.g. 30"
                  className="input w-full"
                />
              </div>
              <div className="flex-1">
                <label className="label">Notes (optional)</label>
                <input
                  type="text"
                  value={timeNotes}
                  onChange={e => setTimeNotes(e.target.value)}
                  placeholder="What did you work on?"
                  className="input w-full"
                />
              </div>
              <button
                onClick={() => logTime(manualMins, timeNotes)}
                disabled={loggingTime || !manualMins}
                className="btn btn-primary btn-sm mb-0.5"
              >
                {loggingTime ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
              </button>
            </div>
          )}

          {/* Entries list */}
          {timeEntries.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {timeEntries.map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-xs text-warm-600 py-1 px-2 rounded-lg hover:bg-warm-50 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-warm-800 shrink-0">{fmtMins(entry.duration_mins)}</span>
                    {entry.notes && <span className="truncate text-warm-500">{entry.notes}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="text-warm-400">{entry.logged_at}</span>
                    <button
                      onClick={() => deleteTimeEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recurrence */}
        <div className="border-t border-warm-100 pt-3 space-y-3">
          <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Recurrence</p>
          <div>
            <label className="label">Repeat</label>
            <select
              value={recurrenceRule}
              onChange={e => setRecurrenceRule(e.target.value)}
              className="input w-full"
            >
              <option value="none">No repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {recurrenceRule !== 'none' && (
            <div>
              <label className="label">End date (optional)</label>
              <input
                type="date"
                value={recurrenceEnd}
                onChange={e => setRecurrenceEnd(e.target.value)}
                className="input w-full cursor-pointer"
                min={dueDate || undefined}
              />
            </div>
          )}
        </div>

        {/* Custom fields */}
        {customFields.length > 0 && (
          <div className="border-t border-warm-100 pt-3 space-y-3">
            <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Custom Fields</p>
            {customFields.map(field => (
              <div key={field.key}>
                <label className="label">{field.label}</label>
                {field.field_type === 'text' && (
                  <input
                    type="text"
                    value={fieldValues[field.key] || ''}
                    onChange={e => setFieldValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="input w-full"
                    placeholder={`Enter ${field.label.toLowerCase()}…`}
                  />
                )}
                {field.field_type === 'number' && (
                  <input
                    type="number"
                    value={fieldValues[field.key] || ''}
                    onChange={e => setFieldValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="input w-full"
                    placeholder="0"
                  />
                )}
                {field.field_type === 'date' && (
                  <input
                    type="date"
                    value={fieldValues[field.key] || ''}
                    onChange={e => setFieldValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="input w-full cursor-pointer"
                  />
                )}
                {field.field_type === 'select' && (
                  <select
                    value={fieldValues[field.key] || ''}
                    onChange={e => setFieldValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className="input w-full"
                  >
                    <option value="">— Select —</option>
                    {(field.options || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {field.field_type === 'checkbox' && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      id={`cf_${field.key}`}
                      checked={fieldValues[field.key] === 'true'}
                      onChange={e => setFieldValues(v => ({ ...v, [field.key]: e.target.checked ? 'true' : 'false' }))}
                      className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
                    />
                    <label htmlFor={`cf_${field.key}`} className="text-sm text-warm-700 cursor-pointer">
                      {field.label}
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>{/* end left column */}

          {/* ── RIGHT: Updates panel ── */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Right header */}
            <div className="px-5 py-3 border-b border-warm-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-warm-700 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-500" />
                  Updates
                  {taskUpdates.length > 0 && (
                    <span className="bg-primary-100 text-primary-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {taskUpdates.length}
                    </span>
                  )}
                </h3>
              </div>
            </div>

            {/* ── Linked Tasks (in Updates panel) ──────────────── */}
            <div className="px-5 py-3 border-b border-warm-100 flex-shrink-0">
              <div className="border border-warm-200 rounded-xl p-3 space-y-2 bg-warm-50/50">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-warm-600 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-primary-500" /> Linked Tasks
                    {taskLinks.length > 0 && (
                      <span className="bg-primary-100 text-primary-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{taskLinks.length}</span>
                    )}
                  </p>
                  <button
                    onClick={() => { setShowAddLink(v => !v); setLinkSearch(''); setLinkNote(''); setLinkSearchResults([]); setSelectedLinkTarget(null) }}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add link
                  </button>
                </div>

                {/* Add link form */}
                {showAddLink && (
                  <div className="rounded-xl border border-warm-200 bg-white p-3 space-y-2">
                    <select
                      value={selectedLinkType}
                      onChange={e => setSelectedLinkType(e.target.value)}
                      className="input w-full text-xs"
                    >
                      {Object.entries(LINK_TYPE_META).map(([key, meta]) => (
                        <option key={key} value={key}>{meta.label}</option>
                      ))}
                    </select>

                    <div className="relative">
                      <input
                        ref={linkSearchRef}
                        type="text"
                        value={selectedLinkTarget ? `${getProjectPrefix(selectedLinkTarget.projects?.name)}-${selectedLinkTarget.task_number || ''} ${selectedLinkTarget.title}` : linkSearch}
                        onChange={e => {
                          setSelectedLinkTarget(null)
                          setLinkSearch(e.target.value)
                          clearTimeout(linkDebounceRef.current)
                          linkDebounceRef.current = setTimeout(() => searchLinkedTasks(e.target.value), 200)
                        }}
                        placeholder="Search task by title or ID..."
                        className="input w-full text-xs pr-8"
                      />
                      {selectedLinkTarget && (
                        <button onClick={() => { setSelectedLinkTarget(null); setLinkSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {!selectedLinkTarget && linkSearch.length >= 2 && (
                      <div className="rounded-lg border border-warm-200 bg-white shadow-sm max-h-40 overflow-y-auto">
                        {linkSearchLoading && (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="w-4 h-4 animate-spin text-warm-400" />
                          </div>
                        )}
                        {!linkSearchLoading && linkSearchResults.length === 0 && (
                          <p className="text-xs text-warm-400 text-center py-3">No tasks found</p>
                        )}
                        {linkSearchResults.map(t => (
                          <button
                            key={t.id}
                            onClick={() => { setSelectedLinkTarget(t); setLinkSearchResults([]) }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-warm-50 text-left"
                          >
                            <TaskIdBadge taskNumber={t.task_number} projectName={t.projects?.name} />
                            <span className="text-xs text-warm-800 truncate flex-1">{t.title}</span>
                            <span className="text-[10px] text-warm-400 shrink-0">{t.projects?.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <textarea
                      value={linkNote}
                      onChange={e => setLinkNote(e.target.value)}
                      placeholder="Add a note about this link (optional)..."
                      rows={2}
                      className="input w-full text-xs resize-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={addLink}
                        disabled={!selectedLinkTarget || savingLink}
                        className="btn-primary btn-sm text-xs flex items-center gap-1.5 flex-1 justify-center"
                      >
                        {savingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                        Link Task
                      </button>
                      <button onClick={() => { setShowAddLink(false); setLinkNote('') }} className="btn-ghost btn-sm text-xs text-warm-500">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing links */}
                {loadingLinks ? (
                  <div className="flex items-center gap-1.5 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-warm-300" />
                    <span className="text-xs text-warm-400">Loading…</span>
                  </div>
                ) : taskLinks.length > 0 ? (
                  <div className="space-y-1">
                    {taskLinks.map(link => {
                      const meta = LINK_TYPE_META[link.link_type] || LINK_TYPE_META.relates_to
                      const t = link.task
                      if (!t) return null
                      return (
                        <div key={link.id} className="group rounded-lg px-2 py-1.5 hover:bg-white transition-colors space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${meta.color}`}>
                              {meta.label}
                            </span>
                            <button
                              onClick={() => onTaskClick && onTaskClick(t)}
                              className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:text-primary-600 transition-colors"
                            >
                              <TaskIdBadge taskNumber={t.task_number} projectName={t.projects?.name} />
                              <span className="text-xs text-warm-800 truncate">{t.title}</span>
                              <ExternalLink className="w-3 h-3 text-warm-300 group-hover:text-primary-400 shrink-0 ml-auto" />
                            </button>
                            <button
                              onClick={() => setConfirmRemoveLinkId(link.id)}
                              className="opacity-0 group-hover:opacity-100 text-warm-300 hover:text-red-500 transition-all shrink-0"
                              title="Remove link"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {link.note && (
                            <p className="text-[11px] text-warm-500 italic pl-1 leading-relaxed">{link.note}</p>
                          )}
                          {confirmRemoveLinkId === link.id && (
                            <div className="flex items-center gap-2 pt-1 pl-1">
                              <span className="text-xs text-warm-600">Remove this link?</span>
                              <button
                                onClick={() => { removeLink(link.id); setConfirmRemoveLinkId(null) }}
                                className="text-xs font-semibold text-red-600 hover:text-red-700 px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors"
                              >
                                Remove
                              </button>
                              <button
                                onClick={() => setConfirmRemoveLinkId(null)}
                                className="text-xs text-warm-500 hover:text-warm-700 px-2 py-0.5 rounded hover:bg-warm-100 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-warm-400 italic pl-0.5">No linked tasks</p>
                )}
              </div>
            </div>

            {/* Compose area — always visible */}
            {true ? (
            <div className="px-5 py-4 border-b border-warm-100 flex-shrink-0 space-y-3">
              {/* Type selector */}
              <div className="flex gap-1.5 flex-wrap">
                {UPDATE_TYPES.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setUpdateType(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      updateType === t.key ? t.activePill : 'bg-warm-50 text-warm-500 border-warm-200 hover:bg-warm-100'
                    }`}
                  >
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                value={updateInput}
                onChange={e => setUpdateInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitUpdate() }}
                rows={4}
                placeholder={
                  updateType === 'blocker'  ? 'Describe what is blocking progress...' :
                  updateType === 'opinion'  ? 'Share your opinion or suggestion...' :
                  updateType === 'resolved' ? 'What was resolved and how?' :
                                              'What is the latest status? What got done, what is next?'
                }
                className="input w-full resize-none text-sm leading-relaxed"
              />

              {/* Action row */}
              <div className="flex items-center gap-2 flex-wrap">
                {updateInput.trim() && (
                  <button
                    onClick={generateAiUpdate}
                    disabled={aiGenerating}
                    title="Improve grammar, spelling and clarity with AI"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-semibold transition-all disabled:opacity-60"
                  >
                    {aiGenerating
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Sparkles className="w-3.5 h-3.5" />
                    }
                    {aiGenerating ? 'Improving...' : 'Improve with AI'}
                  </button>
                )}
                {updateInput && (
                  <button
                    onClick={() => { setUpdateInput(''); setUpdateType('update') }}
                    className="text-xs text-warm-400 hover:text-warm-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <div className="flex-1" />
                <span className="text-[10px] text-warm-400 hidden sm:block">Ctrl+Enter to post</span>
                <button
                  onClick={submitUpdate}
                  disabled={submittingUpdate || !updateInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {submittingUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Post
                </button>
              </div>
            </div>
            ) : null}

            {/* Confirm delete dialog */}
            {confirmDeleteId && (
              <div className="mx-5 my-2 p-4 bg-red-50 border border-red-200 rounded-2xl flex-shrink-0">
                <p className="text-sm font-semibold text-red-700 mb-1">Delete this update?</p>
                <p className="text-xs text-red-500 mb-3">This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={confirmDeleteUpdate}
                    className="flex-1 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 py-1.5 rounded-xl bg-warm-100 text-warm-700 text-xs font-semibold hover:bg-warm-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Feed */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              {loadingUpdates ? (
                <div className="space-y-3 pt-1">
                  {[1,2].map(i => (
                    <div key={i} className="rounded-2xl border border-warm-100 p-4 bg-warm-50 animate-pulse">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-warm-200 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2 items-center">
                            <div className="h-3 w-24 bg-warm-200 rounded-full" />
                            <div className="h-3 w-14 bg-warm-200 rounded-full" />
                          </div>
                          <div className="h-3 w-full bg-warm-200 rounded-full" />
                          <div className="h-3 w-4/5 bg-warm-200 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : taskUpdates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <MessageSquare className="w-8 h-8 text-warm-200 mb-3" />
                  <p className="text-sm font-medium text-warm-400">No updates yet</p>
                  <p className="text-xs text-warm-300 mt-1">Post a status update, flag a blocker, or share your opinion above.</p>
                </div>
              ) : taskUpdates.map(upd => {
                const st = typeStyleMap[upd.update_type] || typeStyleMap.update
                const name = upd.users?.name || 'Team member'
                const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                const isOwn = upd.users?.id === user?.id
                const isEditing = editingUpdateId === upd.id

                return (
                  <div key={upd.id} className={`rounded-2xl border p-4 ${st.bg}`}>
                    <div className="flex items-start gap-3">
                      {upd.users?.avatar_url
                        ? <img src={upd.users.avatar_url} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{initials}</div>
                      }
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-warm-900">{name}</span>
                          <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.badge}`}>
                            {st.icon}
                            {upd.update_type.charAt(0).toUpperCase() + upd.update_type.slice(1)}
                          </span>
                          <span className="ml-auto text-xs text-warm-400 flex-shrink-0">
                            {new Date(upd.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </span>
                          {isOwn && !isEditing && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => startEdit(upd)}
                                className="text-warm-300 hover:text-primary-500 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(upd.id)}
                                className="text-warm-300 hover:text-red-500 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {isEditing && (
                            <button onClick={cancelEdit} className="text-warm-300 hover:text-warm-600 transition-colors" title="Cancel edit">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Content or edit form */}
                        {isEditing ? (
                          <div className="space-y-2 mt-1">
                            {/* Edit type pills */}
                            <div className="flex gap-1 flex-wrap">
                              {UPDATE_TYPES.map(t => (
                                <button
                                  key={t.key}
                                  onClick={() => setEditType(t.key)}
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                                    editType === t.key ? t.activePill : 'bg-white text-warm-400 border-warm-200 hover:bg-warm-50'
                                  }`}
                                >
                                  {t.icon}{t.label}
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              rows={3}
                              className="input w-full resize-none text-sm"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveEditedUpdate}
                                disabled={savingEdit || !editContent.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
                              >
                                {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Save
                              </button>
                              <button onClick={cancelEdit} className="px-3 py-1.5 rounded-xl bg-warm-100 text-warm-600 text-xs font-semibold hover:bg-warm-200 transition-colors">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-warm-800 leading-relaxed whitespace-pre-line">{upd.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>{/* end right column */}

        </div>{/* end two-column body */}

        {/* ── Modal footer ── */}
        <div className="px-6 py-4 border-t border-warm-200 flex items-center gap-2 flex-shrink-0 bg-warm-50">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn-sm text-red-600 hover:bg-red-50 border border-red-200"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button
            onClick={save}
            disabled={!title.trim() || saving}
            className="btn btn-primary btn-sm"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save Changes
          </button>
        </div>

      </div>{/* end modal card */}
    </div>
  )
}

// ── Board Card ────────────────────────────────────────────────
function BoardCard({ task, onClick, onDragStart }) {
  const overdue = isOverdue(task.due_date)
  const dueLabel = formatDue(task.due_date)
  const status = normalizeStatus(task.status)
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium

  const borderAccent =
    status === 'blocked'     ? 'border-l-4 border-l-red-400'  :
    status === 'in_progress' ? 'border-l-4 border-l-blue-400' :
    ''

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('taskId', task.id); e.dataTransfer.effectAllowed = 'move'; onDragStart?.() }}
      onClick={() => onClick(task)}
      className={`bg-white rounded-xl border border-warm-200 p-3 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all ${borderAccent}`}
    >
      {/* Title row with ID */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <p className="text-sm font-medium text-warm-900 line-clamp-2 leading-snug flex-1">{task.title}</p>
        <TaskIdBadge taskNumber={task.task_number} projectName={task.projects?.name} className="flex-shrink-0 mt-0.5" />
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${pm.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pm.dot}`} />
          {pm.label}
        </span>
        {task.topics && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary-50 text-primary-600 border border-primary-100">
            <Tag className="w-2.5 h-2.5" />
            <span className="truncate max-w-[80px]">{task.topics.title}</span>
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-1 mt-1">
        {/* Project */}
        {task.projects && (
          <span className="text-xs text-warm-400 truncate max-w-[100px]">{task.projects.name}</span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Due date */}
          {dueLabel && (
            <span className={`flex items-center gap-0.5 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-warm-400'}`}>
              {overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {dueLabel}
            </span>
          )}
          {/* Assignee avatar */}
          {task.assigned_user && (
            <Avatar name={task.assigned_user.name} size={5} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Board Column ──────────────────────────────────────────────
function BoardColumn({ workflow, tasks, onCardClick, onStatusChange }) {
  const wf = workflow
  const count = tasks.length
  const [dragOver, setDragOver] = useState(false)
  // Counter pattern: increment on enter, decrement on leave.
  // Only truly "left" the column when counter hits 0 — avoids false
  // dragLeave events fired when cursor moves over child elements.
  const dragCounter = useRef(0)

  function handleDragEnter(e) {
    e.preventDefault()
    dragCounter.current += 1
    if (dragCounter.current === 1) setDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current === 0) setDragOver(false)
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setDragOver(false)
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) onStatusChange(taskId, wf.key)
  }

  return (
    // Make the ENTIRE column a drop target (not just the cards area)
    // Remove overflow-hidden from outer so header doesn't block drops
    <div
      className={`min-w-[260px] max-w-[260px] flex flex-col rounded-2xl border-2 transition-colors ${
        dragOver ? 'border-primary-400 bg-primary-50/30' : 'border-warm-200 bg-warm-50'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className={`sticky top-0 z-10 px-3 py-2.5 ${wf.headerBg} border-b border-warm-200 rounded-t-2xl`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${wf.dotColor}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${wf.textColor}`}>{wf.label}</span>
          </div>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${wf.badgeBg}`}>{count}</span>
        </div>
      </div>

      {/* Cards area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
        {tasks.map(task => (
          <BoardCard key={task.id} task={task} onClick={onCardClick} />
        ))}
        {dragOver && tasks.length === 0 && (
          <div className="h-16 border-2 border-dashed border-primary-300 rounded-xl flex items-center justify-center text-xs text-primary-400">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

// ── List View Table ───────────────────────────────────────────
function ListView({ tasks, groupMembers, filterProject, setFilterProject, filterStatus, setFilterStatus, filterPriority, setFilterPriority, projects, onStatusChange, onUpdate, onDelete, onCardClick, selectedIds, toggleSelect, toggleSelectAll, onBulkStatusChange, onBulkDelete, workflow = WORKFLOW }) {
  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length

  return (
    <div>
      {/* Status filter pills — list-view only (project/priority/search live in the top bar) */}
      <div className="flex flex-wrap items-center gap-1 mb-4">
        <button
          onClick={() => setFilterStatus([])}
          className={`tab-pill text-xs ${filterStatus.length === 0 ? 'active' : 'inactive'}`}
        >All Statuses</button>
        {workflow.map(w => (
          <button
            key={w.key}
            onClick={() => setFilterStatus(prev =>
              prev.includes(w.key) ? prev.filter(s => s !== w.key) : [...prev, w.key]
            )}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
              filterStatus.includes(w.key)
                ? `${w.badgeBg} ring-2 ring-offset-1 ring-current`
                : 'bg-warm-100 text-warm-500 hover:bg-warm-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${w.dotColor}`} />
            {w.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary-600 text-white text-sm rounded-2xl mb-3">
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            {workflow.slice(0, 4).map(w => (
              <button
                key={w.key}
                onClick={() => onBulkStatusChange(w.key)}
                className="flex items-center gap-1 px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium"
              >
                → {w.label}
              </button>
            ))}
            <button
              onClick={onBulkDelete}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-500/40 hover:bg-red-500/60 rounded-lg text-xs font-medium"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
            <button onClick={() => toggleSelectAll(false)} className="p-1.5 hover:bg-white/20 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-warm-50 border-b border-warm-200">
              <tr>
                <th className="pl-4 pr-2 py-3 w-10">
                  <button onClick={() => toggleSelectAll(!allSelected)} className="text-warm-300 hover:text-primary-600">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${allSelected ? 'bg-primary-600 border-primary-600' : 'border-warm-300'}`}>
                      {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                  </button>
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide">Title</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide w-36">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide w-24 hidden sm:table-cell">Priority</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide w-32 hidden md:table-cell">Project</th>
                {groupMembers.length > 0 && <th className="px-3 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide w-32 hidden lg:table-cell">Assignee</th>}
                <th className="px-3 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide w-28 hidden lg:table-cell">Due Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide w-28 hidden xl:table-cell">Topic</th>
                <th className="pr-4 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {tasks.map(task => {
                const isSelected = selectedIds.has(task.id)
                return (
                  <tr
                    key={task.id}
                    className={`group transition-colors hover:bg-warm-50 ${isSelected ? 'bg-primary-50/30' : ''}`}
                  >
                    <td className="pl-4 pr-2 py-3 w-10">
                      <button onClick={() => toggleSelect(task.id)} className="text-warm-300 hover:text-primary-600">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-warm-300 group-hover:border-primary-400'}`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <TaskIdBadge taskNumber={task.task_number} projectName={task.projects?.name} />
                        <button
                          onClick={() => onCardClick(task)}
                          className="text-sm text-warm-900 hover:text-primary-600 font-medium text-left line-clamp-1 max-w-[260px]"
                        >
                          {task.title}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 w-36">
                      <StatusBadge
                        status={task.status}
                        onChange={newStatus => onStatusChange(task.id, newStatus)}
                        workflow={workflow}
                      />
                    </td>
                    <td className="px-3 py-3 w-24 hidden sm:table-cell">
                      <PrioritySelect
                        priority={task.priority}
                        onChange={val => onUpdate(task.id, { priority: val })}
                      />
                    </td>
                    <td className="px-3 py-3 w-32 hidden md:table-cell">
                      {task.projects && (
                        <span className="text-xs text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full truncate max-w-[110px] block">
                          {task.projects.name}
                        </span>
                      )}
                    </td>
                    {groupMembers.length > 0 && (
                      <td className="px-3 py-3 w-36 hidden lg:table-cell">
                        <AssigneeSelect
                          task={task}
                          groupMembers={groupMembers}
                          onChange={userId => onUpdate(task.id, { assigned_to: userId })}
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 w-28 hidden lg:table-cell">
                      <DueDatePicker
                        dueDate={task.due_date}
                        onChange={val => onUpdate(task.id, { due_date: val })}
                      />
                    </td>
                    <td className="px-3 py-3 w-28 hidden xl:table-cell">
                      {task.topics ? (
                        <span className="flex items-center gap-1 text-xs text-primary-600 truncate max-w-[100px]">
                          <Tag className="w-3 h-3 flex-shrink-0" />
                          {task.topics.title}
                        </span>
                      ) : (
                        <span className="text-xs text-warm-300">—</span>
                      )}
                    </td>
                    <td className="pr-4 py-3 w-10">
                      <button
                        onClick={() => {
                          onDelete(task.id, task.title)
                        }}
                        className="p-1 text-warm-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {tasks.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-warm-400 text-sm">No tasks match your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export default function Lists() {
  const { user } = useAuth()
  const { getEffectiveStatuses, activeGroupId } = useWorkspace()
  const { projects, loading: projectsLoading, fetchProjects } = useProjectStore()

  const [view, setView]           = useState('board') // 'board' | 'list'
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [groupMembers, setGroupMembers] = useState([])

  // Filters
  const [filterProject,  setFilterProject]  = useState('')
  const [filterStatus,   setFilterStatus]   = useState([])   // list view multi-status
  const [filterPriority, setFilterPriority] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')   // '' = all, 'unassigned' = no assignee, else user id
  const [search, setSearch]                 = useState('')

  // UI state
  const [showAddModal, setShowAddModal]     = useState(false)
  const [addModalStatus, setAddModalStatus] = useState('todo')
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [selectedTask, setSelectedTask]     = useState(null)
  const [selectedIds, setSelectedIds]       = useState(new Set())
  const [deleteTarget, setDeleteTarget]     = useState(null) // { id, title }

  // Click-outside to close status picker
  const addBtnRef = useRef(null)
  useEffect(() => {
    function handleOutside(e) {
      if (addBtnRef.current && !addBtnRef.current.contains(e.target)) setShowStatusPicker(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  // Load data on mount
  useEffect(() => {
    if (!user) return
    fetchProjects(user.id, { groupId: activeGroupId })
    loadTasks()
    loadGroupMembers()
  }, [user, activeGroupId]) // eslint-disable-line

  async function loadTasks() {
    setLoading(true)
    try {
      // show_done=true: include tasks with status='done' so the DONE/PROD column is visible
      const params = { excludeTestCases: true, show_done: true }
      if (activeGroupId) params.group_id = activeGroupId
      else params.group_id = 'personal'
      const res = await tasksApi.list(params)
      const all = res.data.data || []
      // Filter out test_case on frontend
      setTasks(all.filter(t => t.type !== 'test_case'))
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  async function loadGroupMembers() {
    try {
      if (!activeGroupId) { setGroupMembers([]); return }
      const groupRes = await groupsApi.get(activeGroupId)
      setGroupMembers(groupRes.data.data?.members || [])
    } catch { /* non-fatal */ }
  }

  // Status change with optimistic update
  const handleStatusChange = useCallback(async (taskId, newStatus) => {
    const prev = tasks.find(t => t.id === taskId)
    if (!prev) return
    // Optimistic
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    if (selectedTask?.id === taskId) {
      setSelectedTask(s => s ? { ...s, status: newStatus } : null)
    }
    try {
      // 'todo' is a frontend alias for DB value 'pending'
      const dbStatus = newStatus === 'todo' ? 'pending' : newStatus
      await tasksApi.update(taskId, { status: dbStatus })
    } catch {
      // Revert
      setTasks(ts => ts.map(t => t.id === taskId ? prev : t))
      if (selectedTask?.id === taskId) setSelectedTask(prev)
      toast.error('Failed to update status')
    }
  }, [tasks, selectedTask])

  async function handleUpdate(taskId, patch) {
    // Optimistic update so UI responds instantly
    let optimisticExtra = {}
    if ('assigned_to' in patch) {
      const member = groupMembers.find(m => (m.users || m)?.id === patch.assigned_to)
      const u = member ? (member.users || member) : null
      optimisticExtra.assigned_user = u ? { id: u.id, name: u.name || u.email, avatar_url: u.avatar_url || null } : null
    }
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...patch, ...optimisticExtra } : t))
    if (selectedTask?.id === taskId) setSelectedTask(s => s ? { ...s, ...patch, ...optimisticExtra } : null)
    try {
      const res = await tasksApi.update(taskId, patch)
      const updated = res.data.data
      if (updated) {
        setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...updated } : t))
        if (selectedTask?.id === taskId) setSelectedTask(s => s ? { ...s, ...updated } : null)
      }
    } catch {
      toast.error('Failed to update task')
      // revert
      setTasks(ts => ts.map(t => t.id === taskId ? { ...t, ...Object.fromEntries(Object.keys(patch).map(k => [k, t[k]])) } : t))
    }
  }

  // Show custom modal; actual delete fires on confirm
  function requestDelete(taskId, taskTitle) {
    setDeleteTarget({ id: taskId, title: taskTitle || 'this task' })
    if (selectedTask?.id === taskId) setSelectedTask(null) // close detail panel
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteTarget(null)
    try {
      await tasksApi.delete(id)
      setTasks(ts => ts.filter(t => t.id !== id))
      setSelectedIds(s => { const n = new Set(s); n.delete(id); return n })
      toast.success('Task deleted')
    } catch {
      toast.error('Failed to delete task')
    }
  }

  async function handleBulkDeleteConfirmed() {
    const ids = [...selectedIds]
    setDeleteTarget(null)
    try {
      await Promise.all(ids.map(id => tasksApi.delete(id)))
      setTasks(ts => ts.filter(t => !ids.includes(t.id)))
      setSelectedIds(new Set())
      toast.success(`${ids.length} tasks deleted`)
    } catch {
      toast.error('Delete failed')
    }
  }

  // Store status key as-is; legacy 'todo' maps to 'pending' for backward compat
  function toDbStatus(s) {
    if (!s) return workflow[0]?.key || 'pending'
    return s === 'todo' ? 'pending' : s
  }

  async function handleCreate(payload) {
    try {
      const status = toDbStatus(payload.status || addModalStatus)
      const res = await tasksApi.create({ ...payload, status })
      const created = res.data.data
      if (created) setTasks(ts => [created, ...ts])
      toast.success('Task created!')
    } catch {
      toast.error('Failed to create task')
      throw new Error('create failed')
    }
  }

  // Bulk actions
  async function handleBulkStatusChange(newStatus) {
    const ids = [...selectedIds]
    const prevTasks = [...tasks]
    const dbStatus = toDbStatus(newStatus)
    setTasks(ts => ts.map(t => ids.includes(t.id) ? { ...t, status: newStatus } : t))
    try {
      await Promise.all(ids.map(id => tasksApi.update(id, { status: dbStatus })))
      toast.success(`${ids.length} tasks updated`)
      setSelectedIds(new Set())
    } catch {
      setTasks(prevTasks)
      toast.error('Bulk update failed')
    }
  }

  function handleBulkDelete() {
    setDeleteTarget({ id: '__bulk__', title: `${selectedIds.size} selected tasks` })
  }

  function toggleSelect(id) {
    setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleSelectAll(selectAll) {
    if (selectAll) setSelectedIds(new Set(filteredTasks.map(t => t.id)))
    else setSelectedIds(new Set())
  }

  // Compute effective workflow based on selected project's custom statuses
  const workflow = useMemo(() => {
    const selectedProject = projects.find(p => p.id === filterProject)
    const statuses = getEffectiveStatuses(selectedProject?.custom_statuses)
    return workflowFromStatuses(statuses)
  }, [projects, filterProject, getEffectiveStatuses])

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterProject && t.project_id !== filterProject) return false
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterStatus.length > 0) {
        const normalized = normalizeToWorkflow(t.status, workflow)
        if (!filterStatus.includes(normalized)) return false
      }
      if (filterAssignee === 'unassigned') {
        if (t.assigned_to || t.assigned_user) return false
      } else if (filterAssignee) {
        const assignedId = t.assigned_user?.id || t.assigned_to
        if (assignedId !== filterAssignee) return false
      }
      if (search) {
        const q = search.toLowerCase().replace(/^#/, '')
        // Build the task's full ID (e.g. "COS-39") for comparison
        const taskId = t.task_number
          ? `${getProjectPrefix(t.projects?.name)}-${t.task_number}`.toLowerCase()
          : ''
        // Also match just the number ("39") or the full ID ("cos-39")
        const taskNumStr = t.task_number ? String(t.task_number) : ''
        return (
          t.title.toLowerCase().includes(q) ||
          (t.projects?.name || '').toLowerCase().includes(q) ||
          (t.assigned_user?.name || '').toLowerCase().includes(q) ||
          taskId.includes(q) ||
          taskNumStr.includes(q)
        )
      }
      return true
    })
  }, [tasks, filterProject, filterPriority, filterStatus, filterAssignee, search, workflow])

  // Group tasks by status for board view
  const tasksByStatus = useMemo(() => {
    const map = {}
    workflow.forEach(w => { map[w.key] = [] })
    filteredTasks.forEach(t => {
      const s = normalizeToWorkflow(t.status, workflow)
      if (map[s] !== undefined) map[s].push(t)
      else map[workflow[0]?.key]?.push(t)
    })
    return map
  }, [filteredTasks, workflow])

  const totalCount = tasks.length
  const projectCount = useMemo(() => new Set(tasks.map(t => t.project_id).filter(Boolean)).size, [tasks])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Page Header ─── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-warm-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-warm-900">Tasks</h1>
            <p className="text-xs text-warm-400 mt-0.5">
              {totalCount} tasks across {projectCount} project{projectCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-warm-100 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setView('board')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${view === 'board' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500 hover:text-warm-700'}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${view === 'list' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500 hover:text-warm-700'}`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
            {/* Refresh */}
            <button
              onClick={loadTasks}
              disabled={loading}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {/* Add Task — status picker popover */}
            <div className="relative" ref={addBtnRef}>
              <button
                onClick={() => setShowStatusPicker(p => !p)}
                className="btn btn-primary btn-sm"
              >
                <Plus className="w-4 h-4" />
                Add Task
              </button>
              {showStatusPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-warm-200 rounded-xl shadow-lg z-50 py-1.5 min-w-[190px]">
                  <p className="px-3 py-1 text-[11px] font-semibold text-warm-400 uppercase tracking-wide">Add to column</p>
                  {workflow.map(wf => (
                    <button
                      key={wf.key}
                      onClick={() => { setAddModalStatus(wf.key); setShowStatusPicker(false); setShowAddModal(true) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-warm-700 hover:bg-warm-50 transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${wf.dotColor}`} />
                      {wf.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compact single-row filter bar */}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {/* Project inline select */}
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="select-inline min-w-[120px] max-w-[160px]"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {/* Assignee filter — only shown when group members exist */}
          {groupMembers.length > 0 && (
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="select-inline min-w-[120px] max-w-[160px]"
            >
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {user && <option value={user.id}>Assigned to me</option>}
              {groupMembers
                .map(m => m.users || m)
                .filter(u => u.id !== user?.id)
                .map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))
              }
            </select>
          )}
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="input w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-700">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {/* Priority pills */}
          <div className="flex items-center gap-1">
            {[{ v: '', l: 'All' }, { v: 'high', l: 'High' }, { v: 'medium', l: 'Med' }, { v: 'low', l: 'Low' }].map(p => (
              <button
                key={p.v}
                onClick={() => setFilterPriority(p.v)}
                className={`chip ${filterPriority === p.v ? 'chip-active' : 'chip-inactive'}`}
              >{p.l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ─── */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : tasks.length === 0 && !filterProject && !filterStatus ? (
          /* Empty state — no tasks at all */
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 border-2 border-dashed border-primary-200 flex items-center justify-center mb-4">
              <ListChecks className="w-7 h-7 text-primary-400" />
            </div>
            <h3 className="text-base font-semibold text-warm-800 mb-1">No tasks yet</h3>
            <p className="text-sm text-warm-400 max-w-xs mb-5">
              Tasks live inside projects. Create a project first, then add tasks here — or click <strong>+ Add Task</strong> above to start right now.
            </p>
            <button
              onClick={() => setShowStatusPicker(p => !p)}
              className="btn btn-primary btn-sm"
            >
              <Plus className="w-4 h-4" /> Add your first task
            </button>
          </div>
        ) : view === 'board' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {workflow.map(wf => (
              <BoardColumn
                key={wf.key}
                workflow={wf}
                tasks={tasksByStatus[wf.key] || []}
                onCardClick={task => setSelectedTask(task)}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        ) : (
          <ListView
            tasks={filteredTasks}
            groupMembers={groupMembers}
            filterProject={filterProject}
            setFilterProject={setFilterProject}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterPriority={filterPriority}
            setFilterPriority={setFilterPriority}
            projects={projects}
            onStatusChange={handleStatusChange}
            onUpdate={handleUpdate}
            onDelete={requestDelete}
            onCardClick={task => setSelectedTask(task)}
            selectedIds={selectedIds}
            toggleSelect={toggleSelect}
            toggleSelectAll={toggleSelectAll}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkDelete={handleBulkDelete}
            workflow={workflow}
          />
        )}
      </div>

      {/* ── Add Task Modal ─── */}
      {showAddModal && (
        <AddTaskModal
          projects={projects}
          groupMembers={groupMembers}
          initialStatus={addModalStatus}
          onClose={() => setShowAddModal(false)}
          onSave={handleCreate}
          workflow={workflow}
        />
      )}

      {/* ── Detail Panel ─── */}
      {selectedTask && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedTask(null)}
          />
          <DetailPanel
            task={selectedTask}
            groupMembers={groupMembers}
            projects={projects}
            allTasks={tasks}
            onClose={() => setSelectedTask(null)}
            onUpdate={handleUpdate}
            onDelete={requestDelete}
            onStatusChange={handleStatusChange}
            onTaskClick={t => setSelectedTask(t)}
            workflow={workflow}
          />
        </>
      )}

      {/* ── Delete Confirm Modal ─── */}
      {deleteTarget && (
        <DeleteConfirmModal
          title={deleteTarget.title}
          onConfirm={deleteTarget.id === '__bulk__' ? handleBulkDeleteConfirmed : handleDeleteConfirmed}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
