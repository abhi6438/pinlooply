import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { topicsApi } from '../services/api'
import {
  Tag, Search, ChevronDown, AlertTriangle, MessageSquare,
  CheckCircle2, Circle, Loader2, RefreshCw, ArrowUpDown,
  ArrowUp, ArrowDown, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All' },
  { value: 'open',     label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
]

const SORT_OPTIONS = [
  { value: 'updated_at:desc', label: 'Recently updated' },
  { value: 'updated_at:asc',  label: 'Oldest updated' },
  { value: 'title:asc',       label: 'A → Z' },
  { value: 'title:desc',      label: 'Z → A' },
  { value: 'discussions:desc',label: 'Most discussions' },
  { value: 'conflicts:desc',  label: 'Most conflicts' },
]

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Topic Card ────────────────────────────────────────────────
function TopicCard({ topic, onClick }) {
  const borderColor = topic.status === 'resolved' ? 'border-warm-300' : 'border-primary-500'
  return (
    <div
      onClick={onClick}
      className={`card-hover border-l-4 ${borderColor} cursor-pointer animate-fade-in`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-warm-900 leading-snug line-clamp-2">{topic.title}</span>
        {topic.status === 'resolved'
          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          : <Circle className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
        }
      </div>

      {topic.summary && (
        <p className="text-sm text-warm-500 line-clamp-2 mb-3">{topic.summary}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-auto">
        <span className={`badge ${topic.status === 'resolved' ? 'badge-low' : 'badge-medium'}`}>
          {topic.status === 'resolved' ? 'Resolved' : 'Open'}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full">
          <MessageSquare className="w-3 h-3" />
          {topic.discussion_count}
        </span>
        {topic.conflict_count > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
            <AlertTriangle className="w-2.5 h-2.5" />
            {topic.conflict_count}
          </span>
        )}
        <span className="ml-auto text-xs text-warm-400">{formatDate(topic.updated_at)}</span>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Topics() {
  const { user } = useAuth()
  const { projects, fetchProjects } = useProjectStore()
  const navigate = useNavigate()

  const [selectedProject, setSelectedProject] = useState('')
  const [topics, setTopics]   = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter]   = useState('all')
  const [search, setSearch]   = useState('')
  const [sort, setSort]       = useState('updated_at:desc')

  useEffect(() => {
    if (user && !projects.length) fetchProjects(user.id)
  }, [user]) // eslint-disable-line

  useEffect(() => {
    if (projects.length && !selectedProject) setSelectedProject(projects[0].id)
  }, [projects]) // eslint-disable-line

  useEffect(() => {
    if (selectedProject) loadTopics()
  }, [selectedProject]) // eslint-disable-line

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

  const openCount     = topics.filter(t => t.status === 'open').length
  const resolvedCount = topics.filter(t => t.status === 'resolved').length

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-warm-900">Topics 💡</h1>
          <p className="text-sm text-warm-500 mt-1">AI-extracted discussion threads tracked over time</p>
        </div>
        <button
          onClick={loadTopics}
          disabled={loading}
          className="btn-secondary btn-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Project selector */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={e => { setSelectedProject(e.target.value) }}
            className="input py-1.5 text-sm pr-8 appearance-none"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-warm-400 pointer-events-none" />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`tab-pill ${filter === opt.value ? 'active' : 'inactive'}`}
            >
              {opt.label}
              {opt.value === 'open' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${filter === 'open' ? 'bg-white/20 text-white' : 'bg-warm-100 text-warm-500'}`}>
                  {openCount}
                </span>
              )}
              {opt.value === 'resolved' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${filter === 'resolved' ? 'bg-white/20 text-white' : 'bg-warm-100 text-warm-500'}`}>
                  {resolvedCount}
                </span>
              )}
              {opt.value === 'all' && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${filter === 'all' ? 'bg-white/20 text-white' : 'bg-warm-100 text-warm-500'}`}>
                  {topics.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="input py-1.5 text-xs pr-8 appearance-none"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-warm-400 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-warm-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${topics.length} topics…`}
            className="input w-full pl-9 py-2"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-warm-400 hover:text-warm-900 text-xs"
            >✕</button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💡</div>
          <p className="empty-state-title">
            {topics.length === 0 ? 'No topics yet.' : `No topics match "${search || filter}".`}
          </p>
          <p className="empty-state-sub">
            {topics.length === 0
              ? 'Log your first discussion to create topics!'
              : 'Try adjusting your filters or search query.'}
          </p>
          {topics.length === 0 && (
            <button
              onClick={() => navigate('/log')}
              className="btn-primary btn-sm mt-4"
            >
              Log a discussion →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                onClick={() => navigate(`/topics/${topic.id}`)}
              />
            ))}
          </div>

          {/* Footer count */}
          <div className="mt-4 text-xs text-warm-400 flex items-center justify-between">
            <span>
              {filtered.length} of {topics.length} topic{topics.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </span>
            {topics.filter(t => t.conflict_count > 0).length > 0 && (
              <span className="flex items-center gap-1 text-orange-500">
                <AlertTriangle className="w-3 h-3" />
                {topics.filter(t => t.conflict_count > 0).length} with conflicts
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
