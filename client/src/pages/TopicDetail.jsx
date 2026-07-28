import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { topicsApi } from '../services/api'
import {
  Tag, ArrowLeft, CheckCircle2, Circle, AlertTriangle,
  MessageSquare, History, ChevronDown, Loader2,
  Clock, X, Sparkles, CalendarDays, Activity,
  CheckCheck, RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function timeAgo(iso) {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = Math.floor((now - d) / 60000) // minutes
  if (diff < 1)   return 'just now'
  if (diff < 60)  return `${diff}m ago`
  const h = Math.floor(diff / 60)
  if (h < 24)     return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days === 1) return 'yesterday'
  if (days < 7)   return `${days}d ago`
  return formatDate(iso)
}

function Avatar({ name, avatarUrl, size = 'md' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]'
           : size === 'lg' ? 'w-11 h-11 text-sm'
           : 'w-9 h-9 text-xs'
  const initials = (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  if (avatarUrl) return <img src={avatarUrl} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />
  return (
    <div className={`${sz} rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white font-bold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ── Discussion bubble ─────────────────────────────────────────
function DiscussionBubble({ disc, index }) {
  const [expanded, setExpanded] = useState(false)
  const preview = disc.raw_text?.slice(0, 220)
  const hasMore = disc.raw_text?.length > 220

  return (
    <div className="flex gap-3 group">
      <Avatar name={disc.users?.name} avatarUrl={disc.users?.avatar_url} />

      <div className="flex-1 min-w-0">
        {/* Name + time row */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold text-warm-900">
            {disc.users?.name || 'Unknown'}
          </span>
          {disc.source && disc.source !== 'manual' && (
            <span className="text-[10px] bg-warm-100 text-warm-500 px-1.5 py-0.5 rounded-full capitalize font-medium">
              {disc.source.replace('pasted_', '')}
            </span>
          )}
          <span className="text-xs text-warm-400 ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDateTime(disc.created_at)}
          </span>
        </div>

        {/* AI Summary callout */}
        {disc.ai_summary && (
          <div className="flex items-start gap-2 bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary-800 italic leading-relaxed">"{disc.ai_summary}"</p>
          </div>
        )}

        {/* Raw text */}
        {disc.raw_text && (
          <div className="bg-warm-50 border border-warm-200 rounded-xl px-4 py-3">
            <p className="text-xs text-warm-700 leading-relaxed whitespace-pre-line">
              {expanded ? disc.raw_text : preview}
              {!expanded && hasMore && <span className="text-warm-400">…</span>}
            </p>
            {hasMore && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="text-xs text-primary-600 hover:text-primary-700 mt-2 flex items-center gap-1 font-medium transition-colors"
              >
                {expanded ? 'Show less' : 'Show more'}
                <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Conflict card ─────────────────────────────────────────────
function ConflictCard({ conflict }) {
  return (
    <div className="flex gap-3 p-4 bg-orange-50 border border-orange-200 rounded-2xl">
      <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-4 h-4 text-orange-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-orange-900 mb-2">{conflict.description}</p>
        {(conflict.old_value || conflict.new_value) && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-white rounded-lg p-2.5 border border-orange-200">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wide mb-1">Before</p>
              <p className="text-xs text-warm-800">{conflict.old_value || '—'}</p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-orange-200">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wide mb-1">Now</p>
              <p className="text-xs text-warm-800">{conflict.new_value || '—'}</p>
            </div>
          </div>
        )}
        <p className="text-[11px] text-orange-500">Detected {formatDate(conflict.detected_at)}</p>
      </div>
    </div>
  )
}

// ── Version timeline ──────────────────────────────────────────
function VersionTimeline({ versions }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? versions : versions.slice(0, 3)

  if (versions.length === 0) {
    return <p className="text-xs text-warm-400 italic py-2">No version history yet.</p>
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-warm-200" />

      <div className="space-y-4">
        {visible.map((v, i) => (
          <div key={v.id} className="flex gap-3 relative">
            {/* Dot */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 text-[10px] font-bold border-2 ${
              i === 0
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'bg-white border-warm-300 text-warm-500'
            }`}>
              v{v.version_number}
            </div>
            <div className="flex-1 pb-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {i === 0 && (
                  <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-semibold">Latest</span>
                )}
                <span className="text-[11px] text-warm-400">{formatDate(v.created_at)}</span>
              </div>
              {v.users?.name && (
                <p className="text-xs font-medium text-warm-700 mb-1">{v.users.name}</p>
              )}
              <p className="text-xs text-warm-600 leading-relaxed line-clamp-3">{v.summary}</p>
            </div>
          </div>
        ))}
      </div>

      {versions.length > 3 && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="mt-3 text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'Show less' : `Show ${versions.length - 3} more`}
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function TopicDetail() {
  const { topicId } = useParams()
  const navigate    = useNavigate()

  const [data,           setData]           = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [togglingStatus, setTogglingStatus] = useState(false)

  useEffect(() => { loadDetail() }, [topicId]) // eslint-disable-line

  async function loadDetail() {
    setLoading(true)
    try {
      const res = await topicsApi.detail(topicId)
      setData(res.data.data)
    } catch {
      toast.error('Failed to load topic')
      navigate('/topics')
    } finally {
      setLoading(false)
    }
  }

  async function toggleStatus() {
    if (!data) return
    const newStatus = data.topic.status === 'open' ? 'resolved' : 'open'
    setTogglingStatus(true)
    try {
      await topicsApi.updateStatus(topicId, newStatus)
      setData(d => ({ ...d, topic: { ...d.topic, status: newStatus } }))
      toast.success(`Topic marked as ${newStatus}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setTogglingStatus(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        <p className="text-sm text-warm-400">Loading topic…</p>
      </div>
    )
  }

  if (!data) return null

  const { topic, versions, discussions, conflicts } = data
  const isResolved = topic.status === 'resolved'

  return (
    <div className="h-full flex flex-col bg-warm-50 overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 bg-white border-b border-warm-200 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        {/* Back + breadcrumb */}
        <button
          onClick={() => navigate('/topics')}
          className="flex items-center gap-2 text-sm text-warm-500 hover:text-primary-600 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Topics
        </button>

        {/* Status + actions */}
        <div className="flex items-center gap-2">
          {/* Status pill */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isResolved
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-amber-100 text-amber-700 border border-amber-200'
          }`}>
            {isResolved
              ? <CheckCheck className="w-3 h-3" />
              : <Circle className="w-3 h-3" />
            }
            {isResolved ? 'Resolved' : 'Open'}
          </span>

          {/* Resolve / Reopen */}
          <button
            onClick={toggleStatus}
            disabled={togglingStatus}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${
              isResolved
                ? 'bg-white text-primary-600 border-primary-300 hover:bg-primary-50'
                : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {togglingStatus
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : isResolved
                ? <><RotateCcw className="w-3.5 h-3.5" /> Reopen</>
                : <><CheckCircle2 className="w-3.5 h-3.5" /> Resolve</>
            }
          </button>
        </div>
      </div>

      {/* ── Body — two columns ── */}
      <div className="flex-1 overflow-hidden flex gap-0">

        {/* ── Left: main content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-w-0">

          {/* Topic header card */}
          <div className="bg-white rounded-2xl border border-warm-200 shadow-sm overflow-hidden">
            {/* Colored top accent */}
            <div className={`h-1.5 w-full ${isResolved ? 'bg-emerald-500' : 'bg-primary-500'}`} />

            <div className="p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isResolved ? 'bg-emerald-100' : 'bg-primary-100'
                }`}>
                  <Tag className={`w-5 h-5 ${isResolved ? 'text-emerald-600' : 'text-primary-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-warm-900 leading-tight mb-2">
                    {topic.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-warm-400">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Created {formatDate(topic.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5" />
                      Updated {timeAgo(topic.updated_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {discussions.length} discussion{discussions.length !== 1 ? 's' : ''}
                    </span>
                    {conflicts.length > 0 && (
                      <span className="flex items-center gap-1 text-orange-500">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Summary */}
              {topic.summary && (
                <div className="bg-gradient-to-br from-primary-50 to-indigo-50 border border-primary-100 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary-500" />
                    <span className="text-[11px] font-bold text-primary-600 uppercase tracking-widest">AI Summary</span>
                  </div>
                  <p className="text-sm text-primary-900 leading-relaxed">{topic.summary}</p>
                </div>
              )}
            </div>
          </div>

          {/* Conflicts */}
          {conflicts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-warm-700 uppercase tracking-wide">
                  Conflicts · {conflicts.length}
                </h2>
              </div>
              <div className="space-y-3">
                {conflicts.map(c => <ConflictCard key={c.id} conflict={c} />)}
              </div>
            </div>
          )}

          {/* Discussion thread */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-primary-500" />
              <h2 className="text-sm font-semibold text-warm-700 uppercase tracking-wide">
                Discussion Thread · {discussions.length}
              </h2>
            </div>

            {discussions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-warm-200 p-10 text-center">
                <MessageSquare className="w-8 h-8 text-warm-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-warm-500">No discussions yet</p>
                <p className="text-xs text-warm-400 mt-1">Discussions linked to this topic will appear here.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-warm-200 shadow-sm divide-y divide-warm-100 overflow-hidden">
                {discussions.map((d, i) => (
                  <div key={d.id} className="p-5">
                    <DiscussionBubble disc={d} index={i} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: sticky sidebar ── */}
        <div className="w-72 flex-shrink-0 border-l border-warm-200 bg-white overflow-y-auto hidden lg:block">
          <div className="p-5 space-y-6">

            {/* Quick stats */}
            <div>
              <p className="text-[11px] font-bold text-warm-400 uppercase tracking-widest mb-3">About</p>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-warm-500 flex items-center gap-2">
                    <CalendarDays className="w-3.5 h-3.5 text-warm-400" /> Created
                  </span>
                  <span className="text-warm-800 font-medium text-xs">{formatDate(topic.created_at)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-warm-500 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-warm-400" /> Last activity
                  </span>
                  <span className="text-warm-800 font-medium text-xs">{timeAgo(topic.updated_at)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-warm-500 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-warm-400" /> Discussions
                  </span>
                  <span className="text-warm-800 font-medium text-xs">{discussions.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-warm-500 flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-warm-400" /> Versions
                  </span>
                  <span className="text-warm-800 font-medium text-xs">{versions.length}</span>
                </div>
                {conflicts.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-orange-500 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> Conflicts
                    </span>
                    <span className="text-orange-600 font-semibold text-xs">{conflicts.length}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-warm-100" />

            {/* Version history */}
            <div>
              <div className="flex items-center gap-1.5 mb-4">
                <History className="w-3.5 h-3.5 text-warm-400" />
                <p className="text-[11px] font-bold text-warm-400 uppercase tracking-widest">
                  Version History
                </p>
                {versions.length > 0 && (
                  <span className="ml-auto text-[10px] bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full font-semibold">
                    {versions.length}
                  </span>
                )}
              </div>
              <VersionTimeline versions={versions} />
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
