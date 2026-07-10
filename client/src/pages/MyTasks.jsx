import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { tasksApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  CheckSquare2, AlertTriangle, Clock, Filter,
  ChevronDown, Loader2, Check, FolderOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, PageHeader, PageLoader, EmptyState } from '../components/ui'

const PRIORITY_META = {
  high:   { label: 'High',   dot: 'bg-red-500',   text: 'text-red-600',   bg: 'bg-red-50'   },
  medium: { label: 'Medium', dot: 'bg-amber-500',  text: 'text-amber-600', bg: 'bg-amber-50' },
  low:    { label: 'Low',    dot: 'bg-blue-400',   text: 'text-blue-600',  bg: 'bg-blue-50'  },
}

function formatDue(iso) {
  if (!iso) return null
  const d   = new Date(iso)
  const now = new Date()
  const diffDays = Math.ceil((d - now) / 86400000)
  if (diffDays < 0)  return { label: `${Math.abs(diffDays)}d overdue`, cls: 'text-red-600 bg-red-50' }
  if (diffDays === 0) return { label: 'Due today',                      cls: 'text-amber-600 bg-amber-50' }
  if (diffDays === 1) return { label: 'Due tomorrow',                   cls: 'text-amber-500 bg-amber-50' }
  if (diffDays <= 7)  return { label: `${diffDays}d left`,              cls: 'text-blue-600 bg-blue-50' }
  return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), cls: 'text-warm-500 bg-warm-100' }
}

const SORT_OPTIONS = [
  { value: 'due',       label: 'Due date'  },
  { value: 'priority',  label: 'Priority'  },
  { value: 'project',   label: 'Project'   },
  { value: 'created',   label: 'Newest'    },
]

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

// ── Task Row ──────────────────────────────────────────────────
function TaskRow({ task, onComplete }) {
  const due = task.due_date ? formatDue(task.due_date) : null
  const pm  = PRIORITY_META[task.priority] || PRIORITY_META.medium
  const [completing, setCompleting] = useState(false)

  async function handleComplete(e) {
    e.stopPropagation()
    setCompleting(true)
    try {
      await onComplete(task.id)
    } finally {
      setCompleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-warm-50 group transition-colors">
      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={completing}
        className="w-5 h-5 rounded-full border-2 border-warm-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center flex-shrink-0 transition-colors"
      >
        {completing
          ? <Loader2 className="w-3 h-3 animate-spin text-warm-400" />
          : <Check className="w-3 h-3 text-transparent group-hover:text-green-500" />}
      </button>

      {/* Priority dot */}
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pm.dot}`} />

      {/* Title + project */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-warm-900 truncate">{task.title}</p>
        {task.projects && (
          <p className="text-xs text-warm-400 flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: task.projects.color || '#6366f1' }} />
            {task.projects.name}
          </p>
        )}
      </div>

      {/* Due date badge */}
      {due && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${due.cls}`}>
          {due.label}
        </span>
      )}
    </div>
  )
}

// ── Group Section ─────────────────────────────────────────────
function TaskGroup({ title, tasks, onComplete, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!tasks.length) return null

  return (
    <div className="card overflow-hidden mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-warm-50 transition-colors"
      >
        <span className="text-sm font-semibold text-warm-800 flex items-center gap-2">
          {title}
          <span className="text-xs font-normal text-warm-400 bg-warm-100 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-warm-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="border-t border-warm-100 divide-y divide-warm-50">
          {tasks.map(t => <TaskRow key={t.id} task={t} onComplete={onComplete} />)}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function MyTasks() {
  const { user }               = useAuth()
  const { vocabulary }         = useWorkspace()
  const taskLabel              = vocabulary?.tasks || 'Tasks'

  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sort,    setSort]    = useState('due')
  const [filter,  setFilter]  = useState('active') // active | all | overdue

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await tasksApi.list({ mine: 'true', show_done: 'true' })
      setTasks(res.data.data || [])
    } catch {
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete(taskId) {
    await tasksApi.update(taskId, { status: 'done' })
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, status: 'done' } : t))
    toast.success('Task completed!')
  }

  const now = new Date()

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filter === 'active')  return t.status !== 'done' && t.status !== 'resolved' && t.status !== 'closed'
      if (filter === 'overdue') return t.due_date && new Date(t.due_date) < now && t.status !== 'done' && t.status !== 'resolved'
      return true // 'all'
    })
  }, [tasks, filter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'due') {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date) - new Date(b.due_date)
      }
      if (sort === 'priority') {
        return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
      }
      if (sort === 'project') {
        return (a.projects?.name || '').localeCompare(b.projects?.name || '')
      }
      return new Date(b.created_at) - new Date(a.created_at)
    })
  }, [filtered, sort])

  // Grouped by due section for "due" sort
  const grouped = useMemo(() => {
    if (sort !== 'due') return null
    const overdue = sorted.filter(t => t.due_date && new Date(t.due_date) < now)
    const today   = sorted.filter(t => {
      if (!t.due_date) return false
      const d = new Date(t.due_date)
      return d >= new Date(now.toDateString()) && d < new Date(now.toDateString() + ' 23:59:59')
    })
    const upcoming = sorted.filter(t => {
      if (!t.due_date) return false
      return new Date(t.due_date) > new Date(now.toDateString() + ' 23:59:59')
    })
    const noDue = sorted.filter(t => !t.due_date)
    return { overdue, today, upcoming, noDue }
  }, [sorted])

  // Stats
  const total    = tasks.filter(t => t.status !== 'done' && t.status !== 'resolved').length
  const overdueC = tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done' && t.status !== 'resolved').length
  const doneToday = tasks.filter(t => {
    if (t.status !== 'done') return false
    const updated = new Date(t.updated_at)
    return updated.toDateString() === now.toDateString()
  }).length

  if (loading) return <PageShell><PageLoader /></PageShell>

  return (
    <PageShell>
      <PageHeader
        title={`My ${taskLabel}`}
        subtitle={`${total} active · ${overdueC > 0 ? `${overdueC} overdue · ` : ''}${doneToday} done today`}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-3 text-center">
          <p className="text-lg font-semibold text-warm-900">{total}</p>
          <p className="text-xs text-warm-400">Active</p>
        </div>
        <div className={`card p-3 text-center ${overdueC > 0 ? 'border-red-200 bg-red-50' : ''}`}>
          <p className={`text-lg font-semibold ${overdueC > 0 ? 'text-red-600' : 'text-warm-900'}`}>{overdueC}</p>
          <p className={`text-xs ${overdueC > 0 ? 'text-red-400' : 'text-warm-400'}`}>Overdue</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-semibold text-green-600">{doneToday}</p>
          <p className="text-xs text-warm-400">Done today</p>
        </div>
      </div>

      {/* Filters + sort */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-warm-100 p-1 rounded-xl">
          {[
            { key: 'active',  label: 'Active'  },
            { key: 'overdue', label: 'Overdue' },
            { key: 'all',     label: 'All'     },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`chip ${filter === f.key ? 'chip-active' : 'chip-inactive'}`}
            >
              {f.label}
              {f.key === 'overdue' && overdueC > 0 && (
                <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">
                  {overdueC}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Filter className="w-3.5 h-3.5 text-warm-400" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="select-inline min-w-[120px]"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Task list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<CheckSquare2 className="w-12 h-12" />}
          title={filter === 'overdue' ? 'No overdue tasks' : `No ${taskLabel.toLowerCase()} here`}
          subtitle={filter === 'active' ? 'You\'re all caught up!' : 'Nothing to show for this filter.'}
        />
      ) : sort === 'due' && grouped ? (
        <>
          <TaskGroup title="Overdue"  tasks={grouped.overdue}  onComplete={handleComplete} defaultOpen={true} />
          <TaskGroup title="Today"    tasks={grouped.today}    onComplete={handleComplete} defaultOpen={true} />
          <TaskGroup title="Upcoming" tasks={grouped.upcoming} onComplete={handleComplete} defaultOpen={true} />
          <TaskGroup title="No due date" tasks={grouped.noDue} onComplete={handleComplete} defaultOpen={false} />
        </>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-warm-50">
            {sorted.map(t => <TaskRow key={t.id} task={t} onComplete={handleComplete} />)}
          </div>
        </div>
      )}
    </PageShell>
  )
}
