import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { useWorkspace } from '../context/WorkspaceContext'
import { topicsApi } from '../services/api'
import {
  Tag, AlertTriangle, MessageSquare, CheckCircle2,
  Circle, Loader2, RefreshCw, Search, X, LayoutGrid,
  List, ChevronRight, SortAsc, Clock, ArrowUpDown,
  BookOpen, TrendingUp, CheckCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'

const SORT_OPTIONS = [
  { value: 'updated_at:desc', label: 'Recently updated' },
  { value: 'updated_at:asc',  label: 'Oldest first'     },
  { value: 'title:asc',       label: 'A → Z'            },
  { value: 'title:desc',      label: 'Z → A'            },
  { value: 'discussions:desc',label: 'Most discussed'   },
  { value: 'conflicts:desc',  label: 'Most conflicts'   },
]

function formatDate(iso) {
  if (!iso) return ''
  const d    = new Date(iso)
  const now  = new Date()
  const days = Math.floor((now - d) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7)  return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Stat tile ─────────────────────────────────────────────────
function StatTile({ icon: Icon, value, label, color, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left flex-1 min-w-[110px] ${
        active
          ? 'border-primary-400 bg-primary-50 shadow-sm'
          : 'border-warm-200 bg-white hover:border-warm-300 hover:shadow-sm'
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-warm-900 leading-none">{value}</p>
        <p className="text-xs text-warm-500 mt-0.5 truncate">{label}</p>
      </div>
    </button>
  )
}

// ── Grid Card ────────────────────────────────────────────────
function TopicGridCard({ topic, projectColor, onClick }) {
  const isResolved = topic.status === 'resolved'
  const accent     = isResolved ? '#22c55e' : (projectColor || '#6366f1')
  const hasConflict= topic.conflict_count > 0

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl border border-warm-200 hover:border-primary-300 hover:shadow-lg transition-all cursor-pointer flex flex-col overflow-hidden"
    >
      {/* Top accent bar */}
      <div className="h-1 w-full flex-shrink-0" style={{ background: accent }} />

      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Header row */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-warm-900 leading-snug line-clamp-2 group-hover:text-primary-700 transition-colors">
              {topic.title}
            </h3>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            {isResolved
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <Circle      className="w-4 h-4 text-primary-400" />
            }
          </div>
        </div>

        {/* Summary */}
        {topic.summary && (
          <p className="text-xs text-warm-500 leading-relaxed line-clamp-3 flex-1">
            {topic.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 pt-2 border-t border-warm-100 flex-wrap">
          {/* Status */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            isResolved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {isResolved ? <CheckCheck className="w-3 h-3" /> : <Circle className="w-2.5 h-2.5" />}
            {isResolved ? 'Resolved' : 'Open'}
          </span>

          {/* Discussion count */}
          <span className="inline-flex items-center gap-1 text-[11px] text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full">
            <MessageSquare className="w-3 h-3" />
            {topic.discussion_count}
          </span>

          {/* Conflict badge */}
          {hasConflict && (
            <span className="inline-flex items-center gap-1 text-[11px] text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" />
              {topic.conflict_count}
            </span>
          )}

          <span className="ml-auto text-[11px] text-warm-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(topic.updated_at)}
          </span>
        </div>
      </div>

      {/* Open detail arrow */}
      <div className="px-5 pb-3 flex items-center justify-end">
        <span className="text-[11px] text-primary-500 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity font-medium">
          View details <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  )
}

// ── List Row ──────────────────────────────────────────────────
function TopicListRow({ topic, projectName, projectColor, onClick }) {
  const isResolved  = topic.status === 'resolved'
  const hasConflict = topic.conflict_count > 0
  const accent      = isResolved ? '#22c55e' : (projectColor || '#6366f1')

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 px-4 py-3.5 hover:bg-warm-50 cursor-pointer border-b border-warm-100 last:border-0 transition-colors"
    >
      {/* Status dot */}
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: accent }} />

      {/* Title + summary */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-warm-900 truncate group-hover:text-primary-700 transition-colors">
          {topic.title}
        </p>
        {topic.summary && (
          <p className="text-xs text-warm-400 truncate mt-0.5">{topic.summary}</p>
        )}
      </div>

      {/* Status badge */}
      <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium hidden sm:inline-flex ${
        isResolved
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        {isResolved ? 'Resolved' : 'Open'}
      </span>

      {/* Discussion count */}
      <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-warm-500 hidden md:inline-flex">
        <MessageSquare className="w-3 h-3" />
        {topic.discussion_count}
      </span>

      {/* Conflict */}
      {hasConflict && (
        <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-orange-500 hidden md:inline-flex">
          <AlertTriangle className="w-3 h-3" />
          {topic.conflict_count}
        </span>
      )}

      {/* Date */}
      <span className="flex-shrink-0 text-xs text-warm-400 hidden lg:block w-20 text-right">
        {formatDate(topic.updated_at)}
      </span>

      <ChevronRight className="w-4 h-4 text-warm-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────
function EmptyTopics({ hasProjects, search, filter, onClear, onLog }) {
  if (!hasProjects) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 border-2 border-dashed border-primary-200 flex items-center justify-center mb-4">
          <BookOpen className="w-7 h-7 text-primary-400" />
        </div>
        <h3 className="text-base font-semibold text-warm-800 mb-1">No projects yet</h3>
        <p className="text-sm text-warm-400 max-w-xs">Create a project first, then log discussions to generate topics automatically.</p>
      </div>
    )
  }
  if (search || filter !== 'all') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-warm-100 flex items-center justify-center mb-4">
          <Search className="w-6 h-6 text-warm-400" />
        </div>
        <h3 className="text-base font-semibold text-warm-800 mb-1">No topics found</h3>
        <p className="text-sm text-warm-400 mb-4">
          {search ? `No results for "${search}"` : `No ${filter} topics in this project`}
        </p>
        <button onClick={onClear} className="btn btn-secondary btn-sm">
          <X className="w-3.5 h-3.5" /> Clear filters
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 border-2 border-dashed border-primary-200 flex items-center justify-center mb-4">
        <Tag className="w-7 h-7 text-primary-400" />
      </div>
      <h3 className="text-base font-semibold text-warm-800 mb-1">No topics yet</h3>
      <p className="text-sm text-warm-400 max-w-xs mb-5">
        Topics are auto-generated when you log discussions. Start by logging your first discussion.
      </p>
      <button onClick={onLog} className="btn btn-primary btn-sm">
        Log a discussion →
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Topics() {
  const { user }             = useAuth()
  const { activeGroupId }    = useWorkspace()
  const { projects, fetchProjects } = useProjectStore()
  const navigate             = useNavigate()

  const [selectedProject, setSelectedProject] = useState('')
  const [topics,    setTopics]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')
  const [sort,      setSort]      = useState('updated_at:desc')
  const [view,      setView]      = useState('grid')   // 'grid' | 'list'
  const [sortOpen,  setSortOpen]  = useState(false)

  useEffect(() => {
    if (user) fetchProjects(user.id, { groupId: activeGroupId })
  }, [user, activeGroupId]) // eslint-disable-line

  useEffect(() => {
    if (projects.length && !selectedProject) setSelectedProject(projects[0].id)
  }, [projects]) // eslint-disable-line

  useEffect(() => {
    if (selectedProject) loadTopics()
  }, [selectedProject]) // eslint-disable-line

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return
    const h = (e) => { if (!e.target.closest('[data-sort-anchor]')) setSortOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [sortOpen])

  async function loadTopics() {
    setLoading(true)
    try {
      const res = await topicsApi.list(selectedProject)
      setTopics(res.data.data || [])
    } catch {
      toast.error('Failed to load topics')
    } finally {
      setLoading(false)
    }
  }

  const currentProject = projects.find(p => p.id === selectedProject)

  const filtered = useMemo(() => {
    let list = topics.filter(t => {
      if (filter !== 'all' && t.status !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        return t.title.toLowerCase().includes(q) || t.summary?.toLowerCase().includes(q)
      }
      return true
    })
    const [field, dir] = sort.split(':')
    list = [...list].sort((a, b) => {
      let av = a[field === 'discussions' ? 'discussion_count' : field === 'conflicts' ? 'conflict_count' : field]
      let bv = b[field === 'discussions' ? 'discussion_count' : field === 'conflicts' ? 'conflict_count' : field]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return dir === 'asc' ? -1 : 1
      if (av > bv) return dir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [topics, filter, search, sort])

  const totalCount    = topics.length
  const openCount     = topics.filter(t => t.status === 'open').length
  const resolvedCount = topics.filter(t => t.status === 'resolved').length
  const conflictCount = topics.filter(t => t.conflict_count > 0).length

  const sortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label || 'Sort'

  return (
    <div className="h-full flex flex-col bg-warm-50 overflow-hidden">

      {/* ── Top Bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-warm-200 px-6 pt-5 pb-4 space-y-4">

        {/* Title row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-warm-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary-600" />
              Topics
            </h1>
            <p className="text-xs text-warm-400 mt-0.5">
              AI-extracted discussion threads · tracked over time
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Project selector */}
            <select
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              className="select-inline max-w-[200px] font-medium"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Refresh */}
            <button
              onClick={loadTopics}
              disabled={loading}
              className="btn btn-secondary btn-sm"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Stats tiles ── */}
        <div className="flex gap-2 flex-wrap">
          <StatTile
            icon={BookOpen}
            value={totalCount}
            label="All Topics"
            color="bg-primary-100 text-primary-600"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <StatTile
            icon={Circle}
            value={openCount}
            label="Open"
            color="bg-amber-100 text-amber-600"
            active={filter === 'open'}
            onClick={() => setFilter('open')}
          />
          <StatTile
            icon={CheckCircle2}
            value={resolvedCount}
            label="Resolved"
            color="bg-emerald-100 text-emerald-600"
            active={filter === 'resolved'}
            onClick={() => setFilter('resolved')}
          />
          {conflictCount > 0 && (
            <StatTile
              icon={AlertTriangle}
              value={conflictCount}
              label="Has Conflicts"
              color="bg-orange-100 text-orange-600"
              active={false}
              onClick={() => {}}
            />
          )}
        </div>

        {/* ── Search + Sort + View ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${totalCount} topics…`}
              className="input w-full pl-8 pr-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative" data-sort-anchor>
            <button
              onClick={() => setSortOpen(o => !o)}
              className="btn btn-secondary btn-sm gap-1.5"
              data-sort-anchor
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortLabel}
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-warm-200 rounded-xl shadow-lg z-50 py-1 min-w-[180px]">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSort(opt.value); setSortOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      sort === opt.value
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-warm-700 hover:bg-warm-50'
                    }`}
                  >
                    {sort === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-warm-100 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-400 hover:text-warm-700'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-warm-900' : 'text-warm-400 hover:text-warm-700'}`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            <p className="text-sm text-warm-400">Loading topics…</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyTopics
            hasProjects={projects.length > 0}
            search={search}
            filter={filter}
            onClear={() => { setSearch(''); setFilter('all') }}
            onLog={() => navigate('/log')}
          />
        ) : view === 'grid' ? (
          <>
            {/* Optionally group Open / Resolved */}
            {filter === 'all' && openCount > 0 && resolvedCount > 0 ? (
              <div className="space-y-6">
                {/* Open section */}
                {filtered.filter(t => t.status === 'open').length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Circle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
                        Open · {filtered.filter(t => t.status === 'open').length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filtered.filter(t => t.status === 'open').map(topic => (
                        <TopicGridCard
                          key={topic.id}
                          topic={topic}
                          projectColor={currentProject?.color}
                          onClick={() => navigate(`/topics/${topic.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {/* Resolved section */}
                {filtered.filter(t => t.status === 'resolved').length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
                        Resolved · {filtered.filter(t => t.status === 'resolved').length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filtered.filter(t => t.status === 'resolved').map(topic => (
                        <TopicGridCard
                          key={topic.id}
                          topic={topic}
                          projectColor={currentProject?.color}
                          onClick={() => navigate(`/topics/${topic.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(topic => (
                  <TopicGridCard
                    key={topic.id}
                    topic={topic}
                    projectColor={currentProject?.color}
                    onClick={() => navigate(`/topics/${topic.id}`)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          /* List view */
          <div className="bg-white rounded-2xl border border-warm-200 shadow-sm overflow-hidden">
            {/* List header */}
            <div className="flex items-center gap-4 px-4 py-2.5 bg-warm-50 border-b border-warm-200">
              <div className="w-2.5 flex-shrink-0" />
              <p className="flex-1 text-xs font-semibold text-warm-500 uppercase tracking-wide">Title</p>
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide w-20 hidden sm:block">Status</p>
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide w-16 hidden md:block text-center">Discuss</p>
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide w-20 hidden lg:block text-right">Updated</p>
              <div className="w-4 flex-shrink-0" />
            </div>
            {filtered.map(topic => (
              <TopicListRow
                key={topic.id}
                topic={topic}
                projectName={currentProject?.name}
                projectColor={currentProject?.color}
                onClick={() => navigate(`/topics/${topic.id}`)}
              />
            ))}
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-warm-400">
            <span>
              {filtered.length === totalCount
                ? `${totalCount} topic${totalCount !== 1 ? 's' : ''}`
                : `${filtered.length} of ${totalCount} topics`
              }
              {search && ` matching "${search}"`}
            </span>
            {conflictCount > 0 && (
              <span className="flex items-center gap-1 text-orange-500">
                <AlertTriangle className="w-3 h-3" />
                {conflictCount} with conflicts
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
