import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { tasksApi, groupsApi } from '../services/api'
import {
  LayoutGrid, List, Plus, ChevronDown, X, Loader2,
  RefreshCw, Calendar, Tag, UserCircle, Trash2, Check,
  AlertTriangle, Clock, UserPlus,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Workflow statuses ─────────────────────────────────────────
const WORKFLOW = [
  { key: 'todo',         label: 'To Do',        headerBg: 'bg-warm-100',    dotColor: 'bg-warm-400',   textColor: 'text-warm-600',   badgeBg: 'bg-warm-100 text-warm-600'     },
  { key: 'in_progress',  label: 'In Progress',  headerBg: 'bg-blue-100',    dotColor: 'bg-blue-500',   textColor: 'text-blue-700',   badgeBg: 'bg-blue-100 text-blue-700'     },
  { key: 'blocked',      label: 'Blocked',      headerBg: 'bg-red-100',     dotColor: 'bg-red-500',    textColor: 'text-red-700',    badgeBg: 'bg-red-100 text-red-700'       },
  { key: 'in_review',    label: 'In Review',    headerBg: 'bg-violet-100',  dotColor: 'bg-violet-500', textColor: 'text-violet-700', badgeBg: 'bg-violet-100 text-violet-700' },
  { key: 'done',         label: 'Done',         headerBg: 'bg-green-100',   dotColor: 'bg-green-500',  textColor: 'text-green-700',  badgeBg: 'bg-green-100 text-green-700'   },
  { key: 'pending_uat',  label: 'Pending UAT',  headerBg: 'bg-amber-100',   dotColor: 'bg-amber-500',  textColor: 'text-amber-700',  badgeBg: 'bg-amber-100 text-amber-700'   },
  { key: 'pending_prod', label: 'Pending Prod', headerBg: 'bg-orange-100',  dotColor: 'bg-orange-500', textColor: 'text-orange-700', badgeBg: 'bg-orange-100 text-orange-700' },
  { key: 'released',     label: 'Released',     headerBg: 'bg-teal-100',    dotColor: 'bg-teal-500',   textColor: 'text-teal-700',   badgeBg: 'bg-teal-100 text-teal-700'     },
]

const WORKFLOW_MAP = Object.fromEntries(WORKFLOW.map(w => [w.key, w]))

function normalizeStatus(s) {
  if (s === 'pending') return 'todo'
  return s || 'todo'
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
function StatusBadge({ status, onChange, disabled }) {
  const { open, setOpen, ref } = useDropdown()
  const wf = WORKFLOW_MAP[normalizeStatus(status)] || WORKFLOW_MAP.todo

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
        {WORKFLOW.map(w => (
          <button
            key={w.key}
            onClick={() => { onChange(w.key); setOpen(false) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-warm-50 ${w.key === normalizeStatus(status) ? 'bg-warm-50 font-medium' : 'text-warm-800'}`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${w.dotColor}`} />
            <span className={w.textColor}>{w.label}</span>
            {w.key === normalizeStatus(status) && <Check className="w-3.5 h-3.5 ml-auto text-primary-600" />}
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
function AddTaskModal({ projects, groupMembers, initialStatus = 'todo', onClose, onSave }) {
  const [title, setTitle]       = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [status, setStatus]     = useState(initialStatus)
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
                {WORKFLOW.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
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
function DetailPanel({ task, groupMembers, projects, onClose, onUpdate, onDelete, onStatusChange }) {
  const [title, setTitle]       = useState(task.title)
  const [priority, setPriority] = useState(task.priority || 'medium')
  const [dueDate, setDueDate]   = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [description, setDescription] = useState(task.description || '')
  const [assignedTo, setAssignedTo]   = useState(task.assigned_user?.id || task.assigned_to || '')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  const wf = WORKFLOW_MAP[normalizeStatus(task.status)] || WORKFLOW_MAP.todo

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    try {
      await onUpdate(task.id, {
        title: title.trim(),
        priority,
        due_date: dueDate || null,
        description: description || null,
      })
      if (assignedTo !== (task.assigned_user?.id || task.assigned_to || '')) {
        await onUpdate(task.id, { assigned_to: assignedTo || null })
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

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-warm-200 shadow-2xl z-50 flex flex-col">
      {/* Panel header */}
      <div className={`px-5 py-4 border-b border-warm-200 ${wf.headerBg}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${wf.dotColor}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${wf.textColor}`}>{wf.label}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 text-warm-500 hover:text-warm-900">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Status dropdown */}
        <StatusBadge
          status={task.status}
          onChange={newStatus => onStatusChange(task.id, newStatus)}
        />
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
      </div>

      {/* Panel footer */}
      <div className="px-5 py-4 border-t border-warm-200 flex items-center gap-2">
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
          Save
        </button>
      </div>
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
      {/* Title */}
      <p className="text-sm font-medium text-warm-900 line-clamp-2 mb-2 leading-snug">{task.title}</p>

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

  function handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) onStatusChange(taskId, wf.key)
  }

  return (
    <div className="min-w-[260px] max-w-[260px] flex flex-col bg-warm-50 rounded-2xl border border-warm-200 overflow-hidden">
      {/* Column header */}
      <div className={`sticky top-0 z-10 px-3 py-2.5 ${wf.headerBg} border-b border-warm-200`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${wf.dotColor}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${wf.textColor}`}>{wf.label}</span>
          </div>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${wf.badgeBg}`}>{count}</span>
        </div>
      </div>

      {/* Cards drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] transition-colors ${dragOver ? 'bg-primary-50/60' : ''}`}
      >
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
function ListView({ tasks, groupMembers, filterProject, setFilterProject, filterStatus, setFilterStatus, filterPriority, setFilterPriority, projects, onStatusChange, onUpdate, onDelete, onCardClick, selectedIds, toggleSelect, toggleSelectAll, onBulkStatusChange, onBulkDelete }) {
  const allSelected = tasks.length > 0 && selectedIds.size === tasks.length

  return (
    <div>
      {/* Status filter pills — list-view only (project/priority/search live in the top bar) */}
      <div className="flex flex-wrap items-center gap-1 mb-4">
        <button
          onClick={() => setFilterStatus([])}
          className={`tab-pill text-xs ${filterStatus.length === 0 ? 'active' : 'inactive'}`}
        >All Statuses</button>
        {WORKFLOW.map(w => (
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
            {WORKFLOW.slice(0, 4).map(w => (
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
                      <button
                        onClick={() => onCardClick(task)}
                        className="text-sm text-warm-900 hover:text-primary-600 font-medium text-left line-clamp-1 max-w-[280px]"
                      >
                        {task.title}
                      </button>
                    </td>
                    <td className="px-3 py-3 w-36">
                      <StatusBadge
                        status={task.status}
                        onChange={newStatus => onStatusChange(task.id, newStatus)}
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
  const { projects, loading: projectsLoading, fetchProjects } = useProjectStore()

  const [view, setView]           = useState('board') // 'board' | 'list'
  const [tasks, setTasks]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [groupMembers, setGroupMembers] = useState([])

  // Filters
  const [filterProject, setFilterProject]   = useState('')
  const [filterStatus, setFilterStatus]     = useState([])   // list view multi-status
  const [filterPriority, setFilterPriority] = useState('')
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
    fetchProjects(user.id)
    loadTasks()
    loadGroupMembers()
  }, [user]) // eslint-disable-line

  async function loadTasks() {
    setLoading(true)
    try {
      const res = await tasksApi.list({ excludeTestCases: true })
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
      const res = await groupsApi.list()
      const groups = res.data.data || []
      if (groups.length > 0) {
        const groupRes = await groupsApi.get(groups[0].id)
        const members = groupRes.data.data?.members || []
        setGroupMembers(members)
      }
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

  // Normalize 'todo' alias to DB value 'pending' before saving
  function toDbStatus(s) { return s === 'todo' ? 'pending' : (s || 'pending') }

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

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterProject && t.project_id !== filterProject) return false
      if (filterPriority && t.priority !== filterPriority) return false
      if (filterStatus.length > 0 && !filterStatus.includes(normalizeStatus(t.status))) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(q) ||
          (t.projects?.name || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [tasks, filterProject, filterPriority, filterStatus, search])

  // Group tasks by status for board view
  const tasksByStatus = useMemo(() => {
    const map = {}
    WORKFLOW.forEach(w => { map[w.key] = [] })
    filteredTasks.forEach(t => {
      const s = normalizeStatus(t.status)
      if (map[s]) map[s].push(t)
      else map['todo'].push(t)
    })
    return map
  }, [filteredTasks])

  const totalCount = tasks.length
  const projectCount = useMemo(() => new Set(tasks.map(t => t.project_id).filter(Boolean)).size, [tasks])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Page Header ─── */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-warm-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-warm-900">Tasks</h1>
            <p className="text-sm text-warm-400 mt-0.5">
              {totalCount} tasks across {projectCount} project{projectCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-warm-100 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => setView('board')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'board' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500 hover:text-warm-700'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                Board
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'list' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-500 hover:text-warm-700'}`}
              >
                <List className="w-4 h-4" />
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
                  {WORKFLOW.map(wf => (
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
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Project inline select */}
          <select
            value={filterProject}
            onChange={e => setFilterProject(e.target.value)}
            className="input text-sm py-1.5 max-w-[160px]"
          >
            <option value="">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="input w-full py-1.5 pl-3 pr-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-700">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Priority pills */}
          <div className="flex items-center gap-1">
            {[{ v: '', l: 'All' }, { v: 'high', l: 'High' }, { v: 'medium', l: 'Med' }, { v: 'low', l: 'Low' }].map(p => (
              <button
                key={p.v}
                onClick={() => setFilterPriority(p.v)}
                className={`tab-pill text-xs ${filterPriority === p.v ? 'active' : 'inactive'}`}
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
        ) : view === 'board' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {WORKFLOW.map(wf => (
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
            onClose={() => setSelectedTask(null)}
            onUpdate={handleUpdate}
            onDelete={requestDelete}
            onStatusChange={handleStatusChange}
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
