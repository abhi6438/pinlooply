import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { timelineApi } from '../services/api'
import {
  MessageSquare, CheckSquare2, RefreshCw, Tag, AlertTriangle,
  ListChecks, Users, ChevronDown, ChevronRight, Search,
  Calendar, Loader2, X, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Event type config ─────────────────────────────────────────
const EVENT_TYPES = {
  discussion:    { label: 'Discussion',      icon: MessageSquare, dot: 'bg-blue-500',   ring: 'ring-blue-200',   text: 'text-blue-600',   bg: 'bg-blue-50'   },
  task_created:  { label: 'Task Created',    icon: ListChecks,    dot: 'bg-indigo-500', ring: 'ring-indigo-200', text: 'text-indigo-600', bg: 'bg-indigo-50' },
  task_completed:{ label: 'Task Completed',  icon: CheckSquare2,  dot: 'bg-green-500',  ring: 'ring-green-200',  text: 'text-green-600',  bg: 'bg-green-50'  },
  topic_updated: { label: 'Topic Updated',   icon: Tag,           dot: 'bg-purple-500', ring: 'ring-purple-200', text: 'text-purple-600', bg: 'bg-purple-50' },
  conflict:      { label: 'Conflict',        icon: AlertTriangle, dot: 'bg-orange-500', ring: 'ring-orange-200', text: 'text-orange-600', bg: 'bg-orange-50' },
  member_joined: { label: 'Member Joined',   icon: Users,         dot: 'bg-teal-500',   ring: 'ring-teal-200',   text: 'text-teal-600',   bg: 'bg-teal-50'   },
}

const TYPE_FILTERS = [
  { value: '',           label: 'All types' },
  { value: 'discussion', label: '💬 Discussions' },
  { value: 'task',       label: '📋 Tasks' },
  { value: 'topic',      label: '🔄 Topics' },
  { value: 'conflict',   label: '⚠️ Conflicts' },
  { value: 'member',     label: '👥 Members' },
]

// ── Helpers ───────────────────────────────────────────────────
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDateHeader(dateStr) {
  const d = new Date(dateStr)
  const today     = new Date(new Date().toDateString())
  const yesterday = new Date(today - 86400000)
  const dDate     = new Date(d.toDateString())
  if (dDate.getTime() === today.getTime())     return 'Today'
  if (dDate.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function getDateKey(iso) {
  return new Date(iso).toDateString()
}

// Highlight search terms in text
function Highlight({ text, query }) {
  if (!query || !text) return <span>{text}</span>
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <span>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{p}</mark>
          : p
      )}
    </span>
  )
}

function Avatar({ name, url, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'
  if (url) return <img src={url} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={`${sz} rounded-full bg-gray-200 text-gray-600 font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ── Single timeline entry ─────────────────────────────────────
function TimelineEntry({ event, search }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = EVENT_TYPES[event.type] || EVENT_TYPES.discussion
  const Icon = cfg.icon

  const hasDetails = event.type === 'discussion'
    ? event.meta?.raw_text
    : event.type === 'conflict'
    ? (event.meta?.old_value || event.meta?.new_value)
    : event.type === 'topic_updated'
    ? event.meta?.summary
    : false

  return (
    <div className="flex gap-4 group">
      {/* Dot + vertical line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-3 h-3 rounded-full ring-4 ${cfg.dot} ${cfg.ring} mt-1 flex-shrink-0 z-10`} />
        <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 pb-5">
        <div
          className={`bg-white border border-gray-200 rounded-xl p-3.5 transition-shadow ${hasDetails ? 'cursor-pointer hover:shadow-sm hover:border-gray-300' : ''}`}
          onClick={() => hasDetails && setExpanded(e => !e)}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  {event.project_name && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: event.project_color + '22', color: event.project_color }}
                    >
                      {event.project_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 mt-0.5 leading-snug">
                  <Highlight text={event.description} query={search} />
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <Avatar name={event.user_name} url={event.user_avatar} />
                <span className="text-xs text-gray-400 hidden sm:block">{event.user_name}</span>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(event.timestamp)}</span>
              {hasDetails && (
                <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              )}
            </div>
          </div>

          {/* Expanded detail */}
          {expanded && hasDetails && (
            <div className={`mt-3 pt-3 border-t border-gray-100 ${cfg.bg} rounded-lg p-3`}>
              {event.type === 'discussion' && event.meta?.raw_text && (
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line line-clamp-6">
                  <Highlight text={event.meta.raw_text} query={search} />
                </p>
              )}
              {event.type === 'conflict' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">Before</p>
                    <p className="text-xs text-gray-700">{event.meta.old_value || '—'}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">Now</p>
                    <p className="text-xs text-gray-700">{event.meta.new_value || '—'}</p>
                  </div>
                </div>
              )}
              {event.type === 'topic_updated' && event.meta?.summary && (
                <p className="text-xs text-gray-600 leading-relaxed">
                  <Highlight text={event.meta.summary} query={search} />
                </p>
              )}
            </div>
          )}

          {/* Task meta pills */}
          {(event.type === 'task_created' || event.type === 'task_completed') && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                event.meta.priority === 'high'   ? 'text-red-600 bg-red-50 border-red-200' :
                event.meta.priority === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
                                                   'text-gray-500 bg-gray-100 border-gray-200'
              }`}>
                {event.meta.priority}
              </span>
              <span className="text-xs text-gray-400 capitalize">
                {event.meta.task_type?.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Date group ────────────────────────────────────────────────
function DateGroup({ dateKey, events, search }) {
  return (
    <div>
      {/* Sticky date header */}
      <div className="sticky top-0 z-20 bg-gray-50/90 backdrop-blur-sm py-2 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">{formatDateHeader(dateKey)}</span>
          </div>
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 flex-shrink-0">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Entries */}
      <div>
        {events.map(event => (
          <TimelineEntry key={event.id} event={event} search={search} />
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Timeline() {
  const { user } = useAuth()
  const { projects, fetchProjects } = useProjectStore()
  const navigate = useNavigate()

  const [events, setEvents]           = useState([])
  const [loading, setLoading]         = useState(false)
  const [search, setSearch]           = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterType, setFilterType]   = useState('')
  const [fromDate, setFromDate]       = useState('')
  const [toDate, setToDate]           = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const searchRef = useRef()

  useEffect(() => {
    if (user && !projects.length) fetchProjects(user.id)
  }, [user]) // eslint-disable-line

  useEffect(() => { loadTimeline() }, [filterProject, filterType, fromDate, toDate]) // eslint-disable-line

  async function loadTimeline() {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (filterProject) params.project_id = filterProject
      if (filterType)    params.type = filterType
      if (fromDate)      params.from = fromDate
      if (toDate)        params.to   = toDate
      const res = await timelineApi.list(params)
      setEvents(res.data.data || [])
    } catch {
      toast.error('Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search) return events
    const q = search.toLowerCase()
    return events.filter(e =>
      e.description?.toLowerCase().includes(q) ||
      e.title?.toLowerCase().includes(q) ||
      e.user_name?.toLowerCase().includes(q) ||
      e.project_name?.toLowerCase().includes(q) ||
      e.meta?.raw_text?.toLowerCase().includes(q) ||
      e.meta?.summary?.toLowerCase().includes(q)
    )
  }, [events, search])

  // Group by date
  const grouped = useMemo(() => {
    const groups = new Map()
    filtered.forEach(e => {
      const key = getDateKey(e.timestamp)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(e)
    })
    return [...groups.entries()]
  }, [filtered])

  // Type count badges
  const typeCounts = useMemo(() => {
    const counts = {}
    events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1 })
    return counts
  }, [events])

  function clearFilters() {
    setFilterProject('')
    setFilterType('')
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  const hasFilters = filterProject || filterType || fromDate || toDate

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              showFilters || hasFilters
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {hasFilters && <span className="bg-white/30 text-white text-xs px-1 rounded">ON</span>}
          </button>
          <button
            onClick={loadTimeline}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-3">
          <div className="flex flex-wrap gap-3">
            {/* Project */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-gray-500 mb-1 font-medium">Project</label>
              <div className="relative">
                <select
                  value={filterProject}
                  onChange={e => setFilterProject(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Type */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-gray-500 mb-1 font-medium">Event Type</label>
              <div className="relative">
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {TYPE_FILTERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* From */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-1 font-medium">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                onClick={e => e.target.showPicker?.()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              />
            </div>

            {/* To */}
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs text-gray-500 mb-1 font-medium">To</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                onClick={e => e.target.showPicker?.()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
              />
            </div>
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <X className="w-3 h-3" /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search timeline…"
          className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Type legend chips */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {Object.entries(EVENT_TYPES).map(([key, cfg]) => {
          const count = typeCounts[key] || 0
          if (!count) return null
          return (
            <button
              key={key}
              onClick={() => {
                const mapped = key.startsWith('task') ? 'task' : key === 'topic_updated' ? 'topic' : key === 'member_joined' ? 'member' : key
                setFilterType(filterType === mapped ? '' : mapped)
                setShowFilters(true)
              }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${cfg.bg} ${cfg.text} border-transparent hover:border-current`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              {cfg.label}
              <span className="font-semibold">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Timeline content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">
            {events.length === 0
              ? 'No activity yet. Log a discussion to get started.'
              : `No events match your filters.`}
          </p>
          {(search || hasFilters) && (
            <button onClick={clearFilters} className="mt-3 text-sm text-indigo-500 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(([dateKey, dayEvents]) => (
            <DateGroup key={dateKey} dateKey={dateKey} events={dayEvents} search={search} />
          ))}
        </div>
      )}
    </div>
  )
}
