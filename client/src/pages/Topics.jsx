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

// ── Compact topic row ─────────────────────────────────────────
function TopicRow({ topic, onClick }) {
  return (
    <tr
      onClick={onClick}
      className="group hover:bg-indigo-50/40 cursor-pointer transition-colors"
    >
      {/* Status dot */}
      <td className="pl-4 pr-2 py-3 w-8">
        {topic.status === 'resolved'
          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
          : <Circle className="w-4 h-4 text-blue-400" />
        }
      </td>

      {/* Title + summary */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 group-hover:text-indigo-700 transition-colors line-clamp-1">
            {topic.title}
          </span>
          {topic.conflict_count > 0 && (
            <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-xs text-orange-500 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" />
              {topic.conflict_count}
            </span>
          )}
        </div>
        {topic.summary && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-xl">
            {topic.summary}
          </p>
        )}
      </td>

      {/* Discussions */}
      <td className="px-3 py-3 w-28 hidden sm:table-cell">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
          {topic.discussion_count}
        </span>
      </td>

      {/* Updated */}
      <td className="px-3 py-3 w-24 hidden md:table-cell text-xs text-gray-400">
        {formatDate(topic.updated_at)}
      </td>

      {/* Arrow */}
      <td className="pr-4 py-3 w-8 text-right">
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors ml-auto" />
      </td>
    </tr>
  )
}

// ── Sort header button ────────────────────────────────────────
function SortTh({ label, field, current, onSort, className = '' }) {
  const [cField, cDir] = current.split(':')
  const active = cField === field
  const nextDir = active && cDir === 'asc' ? 'desc' : 'asc'
  return (
    <th
      className={`px-3 py-2.5 text-left text-xs font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700 ${className}`}
      onClick={() => onSort(`${field}:${nextDir}`)}
    >
      <span className="flex items-center gap-1">
        {label}
        {active
          ? cDir === 'asc'
            ? <ArrowUp className="w-3 h-3" />
            : <ArrowDown className="w-3 h-3" />
          : <ArrowUpDown className="w-3 h-3 opacity-30" />
        }
      </span>
    </th>
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
          <p className="text-sm text-gray-400 mt-0.5">AI-extracted discussion threads tracked over time</p>
        </div>
        <button
          onClick={loadTopics}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Project */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={e => { setSelectedProject(e.target.value) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-gray-200 last:border-0 ${
                filter === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
              {opt.value === 'open' && openCount > 0 && (
                <span className={`ml-1.5 text-xs px-1 rounded-full ${filter === 'open' ? 'bg-white/20' : 'bg-gray-100'}`}>
                  {openCount}
                </span>
              )}
              {opt.value === 'resolved' && resolvedCount > 0 && (
                <span className={`ml-1.5 text-xs px-1 rounded-full ${filter === 'resolved' ? 'bg-white/20' : 'bg-gray-100'}`}>
                  {resolvedCount}
                </span>
              )}
              {opt.value === 'all' && (
                <span className={`ml-1.5 text-xs px-1 rounded-full ${filter === 'all' ? 'bg-white/20' : 'bg-gray-100'}`}>
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
            className="border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-white appearance-none pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>

        {/* Search — grows to fill space */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${topics.length} topics…`}
            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs"
            >✕</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Tag className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">
              {topics.length === 0
                ? 'No topics yet — log a discussion to get started.'
                : `No topics match "${search || filter}".`}
            </p>
            {topics.length === 0 && (
              <button
                onClick={() => navigate('/log')}
                className="mt-3 text-sm text-indigo-600 hover:underline"
              >
                Log a discussion →
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="pl-4 pr-2 py-2.5 w-8" />
                <SortTh label="Topic" field="title" current={sort} onSort={setSort} />
                <SortTh label="Discussions" field="discussions" current={sort} onSort={setSort} className="w-28 hidden sm:table-cell" />
                <SortTh label="Updated" field="updated_at" current={sort} onSort={setSort} className="w-24 hidden md:table-cell" />
                <th className="pr-4 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(topic => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  onClick={() => navigate(`/topics/${topic.id}`)}
                />
              ))}
            </tbody>
          </table>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-400 flex items-center justify-between">
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
        )}
      </div>
    </div>
  )
}
