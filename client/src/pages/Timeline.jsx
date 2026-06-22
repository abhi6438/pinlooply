import { useState, useEffect, useMemo } from 'react'
import { useProjectStore } from '../stores/useProjectStore'
import { useAuth } from '../context/AuthContext'
import { timelineApi } from '../services/api'
import {
  MessageSquare, CheckSquare2, Tag, AlertTriangle,
  ListChecks, Users, Search, Calendar, Loader2,
  X, ChevronDown, RefreshCw, Clock, FolderOpen,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Config ────────────────────────────────────────────────────
const CFG = {
  discussion:    { Icon: MessageSquare, color: '#2563eb', bg: '#dbeafe', label: 'Discussion',    border: 'border-blue-400'   },
  task_created:  { Icon: ListChecks,    color: '#4f46e5', bg: '#e0e7ff', label: 'Task Added',    border: 'border-indigo-400' },
  task_completed:{ Icon: CheckSquare2,  color: '#16a34a', bg: '#dcfce7', label: 'Task Done',     border: 'border-green-400'  },
  topic_updated: { Icon: Tag,           color: '#7c3aed', bg: '#ede9fe', label: 'Topic Updated', border: 'border-violet-400' },
  conflict:      { Icon: AlertTriangle, color: '#ea580c', bg: '#ffedd5', label: 'Conflict',      border: 'border-orange-400' },
  member_joined: { Icon: Users,         color: '#0d9488', bg: '#ccfbf1', label: 'Member Joined', border: 'border-teal-400'   },
}

const PRIORITY_STYLE = {
  high:   'bg-red-100 text-red-600',
  medium: 'bg-yellow-100 text-yellow-600',
  low:    'bg-gray-100 text-gray-500',
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
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow border-l-4 ${cfg.border}`}>
      <div className="p-4">
        {/* Top row: type badge + time */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
              <Icon className="w-4 h-4" style={{ color: cfg.color }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(e.timestamp)}
            </span>
          </div>
        </div>

        {/* Title */}
        <p className="text-sm font-medium text-gray-900 leading-snug mb-2">
          <Hi text={title} q={q} />
        </p>

        {/* Subtitle / preview */}
        {sub && (
          <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">
            <Hi text={sub} q={q} />
          </p>
        )}

        {/* Meta pills row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Project */}
          {e.project_name && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: (e.project_color || '#6366f1') + '22', color: e.project_color || '#6366f1' }}>
              <FolderOpen className="w-2.5 h-2.5" />
              {e.project_name}
            </span>
          )}

          {/* Who */}
          {e.user_name && !['Unknown', 'System', 'Unassigned'].includes(e.user_name) && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {e.user_name}
            </span>
          )}

          {/* Priority (tasks) */}
          {(e.type === 'task_created' || e.type === 'task_completed') && e.meta?.priority && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLE[e.meta.priority] ?? ''}`}>
              {e.meta.priority}
            </span>
          )}

          {/* Task type */}
          {(e.type === 'task_created' || e.type === 'task_completed') && e.meta?.task_type && (
            <span className="text-xs text-gray-400 capitalize">
              {e.meta.task_type.replace('_', ' ')}
            </span>
          )}

          {/* Expand toggle */}
          {hasDetail && (
            <button
              onClick={() => setOpen(o => !o)}
              className="ml-auto flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
            >
              {open ? 'Less' : 'More'}
              <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Expanded detail */}
        {open && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 leading-relaxed rounded-lg p-3" style={{ backgroundColor: cfg.bg + 'aa' }}>
            {e.type === 'discussion' && (
              <p className="whitespace-pre-line line-clamp-10"><Hi text={e.meta?.raw_text} q={q} /></p>
            )}
            {e.type === 'conflict' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">Before</p>
                  <p><Hi text={e.meta?.old_value || '—'} q={q} /></p>
                </div>
                <div className="bg-white rounded-lg p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-gray-400 mb-1">After</p>
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
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Timeline() {
  const { user } = useAuth()
  const { projects, fetchProjects } = useProjectStore()

  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [fProject, setFProject] = useState('')
  const [fType,    setFType]    = useState('')
  const [fFrom,    setFFrom]    = useState('')
  const [fTo,      setFTo]      = useState('')

  useEffect(() => { if (user && !projects.length) fetchProjects(user.id) }, [user]) // eslint-disable-line
  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      // Load ALL events once — all filtering is client-side so sidebar counts never flicker
      const res = await timelineApi.list({ limit: 300 })
      setEvents(res.data.data || [])
    } catch { toast.error('Failed to load') }
    finally  { setLoading(false) }
  }

  // Client-side filtering — sidebar counts always come from full `events`
  const displayed = useMemo(() => {
    return events.filter(e => {
      // Type filter — exact match
      if (fType && e.type !== fType) return false
      // Project filter
      if (fProject && e.project_id !== fProject) return false
      // Date range
      if (fFrom && new Date(e.timestamp) < new Date(fFrom)) return false
      if (fTo   && new Date(e.timestamp) > new Date(fTo + 'T23:59:59')) return false
      // Search
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

  // Sidebar counts always from full unfiltered events
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
    <div className="flex gap-6 px-4 sm:px-6 py-6 max-w-7xl mx-auto">

      {/* ── Left sidebar ────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 hidden lg:block">
        <div className="sticky top-6 space-y-5">

          {/* Summary */}
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-0.5">Activity</h1>
            <p className="text-xs text-gray-400">{displayed.length} events</p>
          </div>

          {/* Event types */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Type</p>
            <div className="space-y-1">
              <button
                onClick={() => setFType('')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${!fType ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <span>All events</span>
                <span className="text-gray-400">{events.length}</span>
              </button>
              {Object.entries(CFG).map(([key, cfg]) => {
                const n = typeCounts[key] || 0
                if (!n) return null
                const { Icon } = cfg
                return (
                  <button key={key}
                    onClick={() => setFType(fType === key ? '' : key)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${fType === key ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                      {cfg.label}
                    </span>
                    <span className="text-gray-400">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Projects */}
          {projectCounts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Projects</p>
              <div className="space-y-1">
                <button
                  onClick={() => setFProject('')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${!fProject ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <span>All</span>
                </button>
                {projectCounts.map(p => (
                  <button key={p.id}
                    onClick={() => setFProject(prev => prev === p.id ? '' : p.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${fProject === p.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="text-gray-400 flex-shrink-0">{p.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date range */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Date Range</p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)}
                  onClick={e => e.target.showPicker?.()}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer bg-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="date" value={fTo} onChange={e => setFTo(e.target.value)}
                  onClick={e => e.target.showPicker?.()}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer bg-white"
                />
              </div>
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

        {/* Top bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search activity…"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-9 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-2.5 rounded-xl hover:bg-gray-50 disabled:opacity-40 flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium text-gray-500">No activity yet</p>
            <p className="text-xs mt-1">{events.length === 0 ? 'Log a discussion to see events here' : 'Nothing matches your filters'}</p>
            {(search || hasF) && <button onClick={() => { setFProject(''); setFType(''); setFFrom(''); setFTo(''); setSearch('') }} className="mt-3 text-sm text-indigo-500 hover:underline">Clear all</button>}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(([dk, dayEvents]) => (
              <div key={dk}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">{dayLabel(dk)}</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {dayEvents.map(e => <EventCard key={e.id} e={e} q={search} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
