import { useState, useEffect, useMemo } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { timelineApi } from '../services/api'
import {
  MessageSquare, CheckSquare2, Tag, AlertTriangle,
  ListChecks, Users, Search, Calendar, Loader2,
  X, ChevronDown, RefreshCw, Clock, FolderOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, SearchInput, PageLoader, EmptyState } from '../components/ui'

// ── Config ────────────────────────────────────────────────────
const CFG = {
  discussion:    { Icon: MessageSquare, color: '#2563eb', bg: '#dbeafe', label: 'Discussion',    border: 'border-blue-400'   },
  task_created:  { Icon: ListChecks,    color: '#4f46e5', bg: '#e0e7ff', label: 'Task Added',    border: 'border-indigo-400' },
  task_completed:{ Icon: CheckSquare2,  color: '#16a34a', bg: '#dcfce7', label: 'Task Done',     border: 'border-green-400'  },
  topic_updated: { Icon: Tag,           color: '#7c3aed', bg: '#ede9fe', label: 'Topic Updated', border: 'border-violet-400' },
  conflict:      { Icon: AlertTriangle, color: '#ea580c', bg: '#ffedd5', label: 'Conflict',      border: 'border-orange-400' },
  member_joined: { Icon: Users,         color: '#0d9488', bg: '#ccfbf1', label: 'Member Joined', border: 'border-teal-400'   },
}

const TYPE_DOT_COLOR = {
  discussion:     'bg-primary-500',
  task_created:   'bg-blue-500',
  task_completed: 'bg-green-500',
  topic_updated:  'bg-violet-500',
  conflict:       'bg-orange-400',
  member_joined:  'bg-teal-500',
}

const PRIORITY_STYLE = {
  high:   'bg-red-100 text-red-600',
  medium: 'bg-yellow-100 text-yellow-600',
  low:    'bg-warm-100 text-warm-500',
}

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayLabel(dateStr) {
  const diff = Math.floor(
    (new Date(new Date().toDateString()) - new Date(new Date(dateStr).toDateString())) / 86400000
  )
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' })
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function eventTitle(e) {
  switch (e.type) {
    case 'discussion':     return e.meta?.raw_text?.slice(0, 80) || 'Discussion logged'
    case 'task_created':   return e.description
    case 'task_completed': return e.description
    case 'topic_updated':  return e.meta?.topic_title || e.description
    case 'conflict':       return e.description
    case 'member_joined':  return e.description
    default:               return e.description
  }
}

function eventSubtitle(e) {
  if (e.type === 'discussion' && e.meta?.raw_text?.length > 80) {
    return e.meta.raw_text.slice(80, 180) + (e.meta.raw_text.length > 180 ? '…' : '')
  }
  if (e.type === 'topic_updated' && e.meta?.summary) return e.meta.summary.slice(0, 120)
  if (e.type === 'conflict') return `Before: ${e.meta?.old_value || '—'}  →  Now: ${e.meta?.new_value || '—'}`
  return null
}

// Highlight
function Hi({ text, q }) {
  if (!q || !text) return <>{text}</>
  const rx = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return <>{text.split(rx).map((p, i) =>
    p.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm">{p}</mark>
      : p
  )}</>
}

// ── Event Card ────────────────────────────────────────────────
function EventCard({ e, q }) {
  const [open, setOpen] = useState(false)
  const cfg   = CFG[e.type] ?? CFG.discussion
  const { Icon } = cfg
  const title = eventTitle(e)
  const sub   = eventSubtitle(e)
  const hasDetail = e.type === 'discussion' && e.meta?.raw_text?.length > 80
    || e.type === 'conflict'
    || (e.type === 'topic_updated' && e.meta?.summary)

  return (
    <div className="card py-3 px-4 hover:shadow-warm transition-shadow animate-fade-in">
      {/* Top row: type chip + time */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
            <Icon className="w-4 h-4" style={{ color: cfg.color }} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 text-xs text-warm-400">
          <Clock className="w-3 h-3" />
          {timeAgo(e.timestamp)}
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-warm-900 leading-snug mb-2">
        <Hi text={title} q={q} />
      </p>

      {/* Subtitle */}
      {sub && (
        <p className="text-xs text-warm-500 leading-relaxed mb-2 line-clamp-2">
          <Hi text={sub} q={q} />
        </p>
      )}

      {/* Meta pills */}
      <div className="flex flex-wrap items-center gap-2">
        {e.project_name && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: (e.project_color || '#7C3AED') + '22', color: e.project_color || '#7C3AED' }}>
            <FolderOpen className="w-2.5 h-2.5" />
            {e.project_name}
          </span>
        )}
        {e.user_name && !['Unknown', 'System', 'Unassigned'].includes(e.user_name) && (
          <span className="text-xs text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full">
            {e.user_name}
          </span>
        )}
        {(e.type === 'task_created' || e.type === 'task_completed') && e.meta?.priority && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLE[e.meta.priority] ?? ''}`}>
            {e.meta.priority}
          </span>
        )}
        {(e.type === 'task_created' || e.type === 'task_completed') && e.meta?.task_type && (
          <span className="text-xs text-warm-400 capitalize">
            {e.meta.task_type.replace('_', ' ')}
          </span>
        )}
        {hasDetail && (
          <button
            onClick={() => setOpen(o => !o)}
            className="ml-auto flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
          >
            {open ? 'Less' : 'More'}
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="mt-3 pt-3 border-t border-warm-100 text-xs text-warm-500 leading-relaxed rounded-lg p-3" style={{ backgroundColor: cfg.bg + 'aa' }}>
          {e.type === 'discussion' && (
            <p className="whitespace-pre-line line-clamp-10"><Hi text={e.meta?.raw_text} q={q} /></p>
          )}
          {e.type === 'conflict' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-2.5">
                <p className="text-[10px] uppercase font-semibold text-warm-400 mb-1">Before</p>
                <p><Hi text={e.meta?.old_value || '—'} q={q} /></p>
              </div>
              <div className="bg-white rounded-lg p-2.5">
                <p className="text-[10px] uppercase font-semibold text-warm-400 mb-1">After</p>
                <p><Hi text={e.meta?.new_value || '—'} q={q} /></p>
              </div>
            </div>
          )}
          {e.type === 'topic_updated' && (
            <p><Hi text={e.meta?.summary} q={q} /></p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Timeline() {
  const { user } = useAuth()
  const { activeGroupId } = useWorkspace()
  const { projects, fetchProjects } = useProjectStore()

  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [fProject, setFProject] = useState('')
  const [fType,    setFType]    = useState('')
  const [fFrom,    setFFrom]    = useState('')
  const [fTo,      setFTo]      = useState('')

  useEffect(() => { if (user) fetchProjects(user.id, { groupId: activeGroupId }) }, [user, activeGroupId]) // eslint-disable-line
  useEffect(() => { load() }, [activeGroupId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const res = await timelineApi.list({ limit: 300, group_id: activeGroupId || 'personal' })
      setEvents(res.data.data || [])
    } catch { toast.error('Failed to load') }
    finally  { setLoading(false) }
  }

  const displayed = useMemo(() => {
    return events.filter(e => {
      if (fType && e.type !== fType) return false
      if (fProject && e.project_id !== fProject) return false
      if (fFrom && new Date(e.timestamp) < new Date(fFrom)) return false
      if (fTo   && new Date(e.timestamp) > new Date(fTo + 'T23:59:59')) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          eventTitle(e).toLowerCase().includes(q) ||
          e.project_name?.toLowerCase().includes(q) ||
          e.user_name?.toLowerCase().includes(q) ||
          e.meta?.raw_text?.toLowerCase().includes(q) ||
          e.meta?.summary?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [events, fType, fProject, fFrom, fTo, search])

  const grouped = useMemo(() => {
    const map = new Map()
    displayed.forEach(e => {
      const k = new Date(e.timestamp).toDateString()
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(e)
    })
    return [...map.entries()]
  }, [displayed])

  const typeCounts = useMemo(() => {
    const c = {}
    events.forEach(e => { c[e.type] = (c[e.type] || 0) + 1 })
    return c
  }, [events])

  const projectCounts = useMemo(() => {
    const c = {}
    events.forEach(e => {
      if (e.project_id) c[e.project_id] = { id: e.project_id, name: e.project_name, color: e.project_color, count: (c[e.project_id]?.count || 0) + 1 }
    })
    return Object.values(c)
  }, [events])

  const hasF = fProject || fType || fFrom || fTo

  return (
    <PageShell className="flex gap-6 max-w-none">

      {/* ── Left sidebar ────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 hidden lg:block">
        <div className="sticky top-6 space-y-5">

          <div>
            <h1 className="text-lg font-semibold text-warm-900 mb-0.5">Timeline</h1>
            <p className="text-xs text-warm-400">{displayed.length} events</p>
          </div>

          {/* Event types */}
          <div>
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Type</p>
            <div className="space-y-1">
              <button
                onClick={() => setFType('')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${!fType ? 'bg-primary-50 text-primary-700 font-medium' : 'text-warm-500 hover:bg-warm-100'}`}
              >
                <span>All events</span>
                <span className="text-warm-400">{events.length}</span>
              </button>
              {Object.entries(CFG).map(([key, cfg]) => {
                const n = typeCounts[key] || 0
                if (!n) return null
                const { Icon } = cfg
                return (
                  <button key={key}
                    onClick={() => setFType(fType === key ? '' : key)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${fType === key ? 'bg-primary-50 text-primary-700 font-medium' : 'text-warm-500 hover:bg-warm-100'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                      {cfg.label}
                    </span>
                    <span className="text-warm-400">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Projects */}
          {projectCounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Projects</p>
              <div className="space-y-1">
                <button
                  onClick={() => setFProject('')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${!fProject ? 'bg-primary-50 text-primary-700 font-medium' : 'text-warm-500 hover:bg-warm-100'}`}
                >
                  <span>All</span>
                </button>
                {projectCounts.map(p => (
                  <button key={p.id}
                    onClick={() => setFProject(prev => prev === p.id ? '' : p.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${fProject === p.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-warm-500 hover:bg-warm-100'}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="text-warm-400 flex-shrink-0">{p.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date range */}
          <div>
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wider mb-2">Date Range</p>
            <div className="space-y-2">
              {[
                { label: 'From', value: fFrom, set: setFFrom },
                { label: 'To',   value: fTo,   set: setFTo   },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="label mb-1">{label}</label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-400 pointer-events-none" />
                    <input
                      type="date"
                      value={value}
                      onChange={e => set(e.target.value)}
                      onClick={e => e.target.showPicker?.()}
                      className="input w-full text-xs pl-7 py-1.5 cursor-pointer"
                    />
                  </div>
                </div>
              ))}
              {(fFrom || fTo) && (
                <button
                  onClick={() => { setFFrom(''); setFTo('') }}
                  className="text-xs text-warm-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" /> Clear dates
                </button>
              )}
            </div>
          </div>

          {hasF && (
            <button onClick={() => { setFProject(''); setFType(''); setFFrom(''); setFTo('') }}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
      </aside>

      {/* ── Main feed ───────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {/* Header (mobile only — desktop shows in sidebar) */}
        <div className="lg:hidden mb-4">
          <h1 className="text-lg font-semibold text-warm-900">Timeline</h1>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <SearchInput value={search} onChange={setSearch} placeholder="Search activity…" />
          <button onClick={load} disabled={loading} className="btn-secondary btn-sm flex-shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {loading ? (
          <PageLoader />
        ) : grouped.length === 0 ? (
          <EmptyState
            icon="📅"
            title="No activity yet"
            subtitle={events.length === 0 ? 'Log a discussion to see events here' : 'Nothing matches your filters'}
            action={(search || hasF) && (
              <button onClick={() => { setFProject(''); setFType(''); setFFrom(''); setFTo(''); setSearch('') }}
                className="btn-secondary btn-sm mt-4">Clear all</button>
            )}
          />
        ) : (
          <div className="space-y-8">
            {grouped.map(([dk, dayEvents]) => (
              <div key={dk}>
                {/* Date separator */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-warm-400 flex-shrink-0">
                    {dayLabel(dk)}
                  </span>
                  <div className="flex-1 h-px bg-warm-200" />
                  <span className="text-xs text-warm-400 flex-shrink-0">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Vertical timeline */}
                <div className="relative">
                  {/* Left line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-warm-200" />

                  {dayEvents.map(e => (
                    <div key={e.id} className="relative flex gap-4 pb-4 animate-fade-in">
                      {/* Timeline dot */}
                      <div className={`timeline-dot mt-3 flex-shrink-0 ${TYPE_DOT_COLOR[e.type] || 'bg-warm-400'}`} />
                      {/* Card */}
                      <div className="flex-1 min-w-0">
                        <EventCard e={e} q={search} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
