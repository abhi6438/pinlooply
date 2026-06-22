import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { topicsApi } from '../services/api'
import GenerateTestCasesButton from '../components/shared/GenerateTestCasesButton'
import {
  Tag, ArrowLeft, CheckCircle2, Circle, AlertTriangle,
  MessageSquare, History, ChevronDown, ChevronRight,
  Loader2, Clock, User, X,
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

function Avatar({ name, avatarUrl, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sz} rounded-full object-cover`} />
  }
  const initials = (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={`${sz} rounded-full bg-primary-100 text-primary-600 font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ── Version History Drawer ────────────────────────────────────
function VersionDrawer({ versions, open, onClose }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-warm-900 text-sm">Version History</h2>
            <span className="text-xs bg-warm-100 text-warm-500 px-2 py-0.5 rounded-full">{versions.length}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-warm-100 rounded text-warm-400 hover:text-warm-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {versions.length === 0 ? (
            <p className="text-sm text-warm-400 text-center py-8">No versions yet</p>
          ) : (
            versions.map((v, i) => (
              <div key={v.id} className="relative">
                {/* Timeline line */}
                {i < versions.length - 1 && (
                  <div className="absolute left-4 top-10 w-0.5 h-full bg-warm-200" />
                )}
                <div className="flex gap-3">
                  {/* Version chip */}
                  <div className="flex-shrink-0 z-10">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-primary-50 border border-primary-200 text-xs font-bold text-primary-600">
                      v{v.version_number}
                    </span>
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      {v.users && (
                        <span className="text-xs font-medium text-warm-900">{v.users.name}</span>
                      )}
                      <span className="text-xs text-warm-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(v.created_at)}
                      </span>
                      {i === 0 && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-medium">Latest</span>
                      )}
                    </div>
                    <div className="bg-warm-50 rounded-lg p-3">
                      <p className="text-xs text-warm-900 leading-relaxed">{v.summary}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

// ── Discussion Thread Item ────────────────────────────────────
function DiscussionItem({ disc }) {
  const [expanded, setExpanded] = useState(false)
  const preview = disc.raw_text?.slice(0, 180)
  const hasMore = disc.raw_text?.length > 180

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <Avatar name={disc.users?.name} avatarUrl={disc.users?.avatar_url} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-medium text-warm-900">{disc.users?.name || 'Unknown'}</span>
            <span className="text-xs text-warm-400">{formatDateTime(disc.created_at)}</span>
            {disc.source && disc.source !== 'manual' && (
              <span className="text-xs bg-warm-100 text-warm-500 px-1.5 py-0.5 rounded capitalize">
                {disc.source.replace('pasted_', '')}
              </span>
            )}
          </div>
          {disc.ai_summary && (
            <p className="text-sm text-primary-700 bg-primary-50 rounded-lg px-3 py-2 mb-2 italic">
              "{disc.ai_summary}"
            </p>
          )}
          {disc.raw_text && (
            <div>
              <p className="text-xs text-warm-500 leading-relaxed">
                {expanded ? disc.raw_text : preview}
                {!expanded && hasMore && '…'}
              </p>
              {hasMore && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-xs text-primary-600 hover:text-primary-700 mt-1 flex items-center gap-1"
                >
                  {expanded ? 'Show less' : 'Show more'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Conflict Item ─────────────────────────────────────────────
function ConflictItem({ conflict }) {
  return (
    <div className="card border-l-4 border-red-400">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-lg leading-none">⚠️</span>
        <p className="text-sm font-medium text-warm-900">{conflict.description}</p>
      </div>
      {(conflict.old_value || conflict.new_value) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-warm-50 rounded-lg p-3 border border-warm-200">
            <p className="text-xs text-warm-400 font-medium mb-1 uppercase tracking-wide">Before</p>
            <p className="text-xs text-warm-900">{conflict.old_value || '—'}</p>
          </div>
          <div className="bg-warm-50 rounded-lg p-3 border border-warm-200">
            <p className="text-xs text-warm-400 font-medium mb-1 uppercase tracking-wide">Now</p>
            <p className="text-xs text-warm-900">{conflict.new_value || '—'}</p>
          </div>
        </div>
      )}
      <p className="text-xs text-warm-400 mt-2">
        Detected {formatDate(conflict.detected_at)}
      </p>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function TopicDetail() {
  const { topicId } = useParams()
  const navigate    = useNavigate()

  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)

  useEffect(() => {
    loadDetail()
  }, [topicId]) // eslint-disable-line

  async function loadDetail() {
    setLoading(true)
    try {
      const res = await topicsApi.detail(topicId)
      setData(res.data.data)
    } catch (err) {
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
      toast.success(`Marked as ${newStatus}`)
    } catch (err) {
      toast.error('Failed to update status')
    } finally {
      setTogglingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
      </div>
    )
  }

  if (!data) return null

  const { topic, versions, discussions, conflicts } = data

  return (
    <>
      <VersionDrawer
        versions={versions}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <div className="px-6 py-8">
        {/* Back */}
        <button
          onClick={() => navigate('/topics')}
          className="flex items-center gap-2 text-sm text-warm-500 hover:text-warm-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Topic summary card */}
        <div className="card mb-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Tag className="w-5 h-5 text-primary-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-warm-900 leading-tight">{topic.title}</h1>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-warm-100 text-warm-500 rounded-full px-3 py-1">
                    Created {formatDate(topic.created_at)}
                  </span>
                  <span className="text-xs bg-warm-100 text-warm-500 rounded-full px-3 py-1">
                    Updated {formatDate(topic.updated_at)}
                  </span>
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              <GenerateTestCasesButton label="Generate Tests" size="sm" variant="outline" />
              <button
                onClick={() => setDrawerOpen(true)}
                className="btn-secondary btn-sm"
              >
                <History className="w-3.5 h-3.5" />
                History
                {versions.length > 0 && (
                  <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full text-xs font-medium ml-1">
                    {versions.length}
                  </span>
                )}
              </button>
              <button
                onClick={toggleStatus}
                disabled={togglingStatus}
                className={`btn-sm flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                  topic.status === 'open'
                    ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                {togglingStatus ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : topic.status === 'open' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Circle className="w-3.5 h-3.5" />
                )}
                {topic.status === 'open' ? 'Resolve' : 'Reopen'}
              </button>
            </div>
          </div>

          {/* Status badge row */}
          <div className="flex items-center gap-2 mb-4">
            {topic.status === 'resolved' ? (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Resolved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 font-medium">
                <Circle className="w-3 h-3" /> Open
              </span>
            )}
            <span className="text-xs text-warm-400">
              {discussions.length} discussion{discussions.length !== 1 ? 's' : ''}
            </span>
            {conflicts.length > 0 && (
              <span className="text-xs text-orange-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Current summary */}
          {topic.summary && (
            <div className="bg-primary-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1.5">Current Summary</p>
              <p className="text-sm text-primary-900 leading-relaxed">{topic.summary}</p>
            </div>
          )}
        </div>

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <section className="mb-5">
            <h2 className="section-title flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Conflicts ({conflicts.length})
            </h2>
            <div className="space-y-3">
              {conflicts.map(c => <ConflictItem key={c.id} conflict={c} />)}
            </div>
          </section>
        )}

        {/* Discussion thread */}
        <section>
          <h2 className="section-title flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-primary-600" />
            Discussion Thread ({discussions.length})
          </h2>

          {discussions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <p className="empty-state-title">No discussions yet</p>
              <p className="empty-state-sub">No discussions linked to this topic yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {discussions.map(d => <DiscussionItem key={d.id} disc={d} />)}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
