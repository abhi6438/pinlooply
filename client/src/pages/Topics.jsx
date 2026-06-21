import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { topicsApi } from '../services/api'
import {
  Tag, Search, ChevronDown, AlertTriangle, MessageSquare,
  CheckCircle2, Circle, Loader2, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All' },
  { value: 'open',     label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
]

function StatusBadge({ status }) {
  if (status === 'resolved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
        <CheckCircle2 className="w-3 h-3" />
        Resolved
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
      <Circle className="w-3 h-3" />
      Open
    </span>
  )
}

function TopicCard({ topic, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-indigo-100 transition-colors">
            <Tag className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 group-hover:text-indigo-700 transition-colors">
              {topic.title}
            </h3>
            {topic.summary && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                {topic.summary}
              </p>
            )}
          </div>
        </div>
        <StatusBadge status={topic.status} />
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <MessageSquare className="w-3.5 h-3.5" />
          {topic.discussion_count} discussion{topic.discussion_count !== 1 ? 's' : ''}
        </span>
        {topic.conflict_count > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-orange-500">
            <AlertTriangle className="w-3.5 h-3.5" />
            {topic.conflict_count} conflict{topic.conflict_count !== 1 ? 's' : ''}
          </span>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {new Date(topic.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  )
}

export default function Topics() {
  const { user } = useAuth()
  const { projects, fetchProjects } = useProjectStore()
  const navigate = useNavigate()

  const [selectedProject, setSelectedProject] = useState('')
  const [topics, setTopics]       = useState([])
  const [loading, setLoading]     = useState(false)
  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')

  // Init project
  useEffect(() => {
    if (user && !projects.length) fetchProjects(user.id)
  }, [user]) // eslint-disable-line

  useEffect(() => {
    if (projects.length && !selectedProject) setSelectedProject(projects[0].id)
  }, [projects]) // eslint-disable-line

  // Load topics when project changes
  useEffect(() => {
    if (selectedProject) loadTopics()
  }, [selectedProject]) // eslint-disable-line

  async function loadTopics() {
    setLoading(true)
    try {
      const res = await topicsApi.list(selectedProject)
      setTopics(res.data.data || [])
    } catch (err) {
      toast.error('Failed to load topics')
    } finally {
      setLoading(false)
    }
  }

  const filtered = topics.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.summary?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openCount     = topics.filter(t => t.status === 'open').length
  const resolvedCount = topics.filter(t => t.status === 'resolved').length

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-extracted discussion topics tracked over time
          </p>
        </div>
        <button
          onClick={loadTopics}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total',    count: topics.length,  color: 'text-gray-700',  bg: 'bg-gray-50'   },
          { label: 'Open',     count: openCount,       color: 'text-blue-700',  bg: 'bg-blue-50'   },
          { label: 'Resolved', count: resolvedCount,   color: 'text-green-700', bg: 'bg-green-50'  },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Project selector */}
        <div className="relative">
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs ml-auto">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search topics…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* Topics list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {topics.length === 0
              ? 'No topics yet — log a discussion and AI will extract topics automatically.'
              : 'No topics match your current filter.'}
          </p>
          {topics.length === 0 && (
            <button
              onClick={() => navigate('/log')}
              className="mt-4 text-sm text-indigo-600 hover:underline"
            >
              Log a discussion →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(topic => (
            <TopicCard
              key={topic.id}
              topic={topic}
              onClick={() => navigate(`/topics/${topic.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
