import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import {
  CheckCircle2, AlertTriangle, XCircle, Clock,
  Loader2, ExternalLink, ChevronDown, ChevronUp,
  BookOpen, Tag, FlaskConical, ListTodo,
} from 'lucide-react'
import { formatDistanceToNow, parseISO, format } from 'date-fns'

// ── Config ────────────────────────────────────────────────────
const HEALTH = {
  on_track: { label: 'On Track',        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  at_risk:  { label: 'At Risk',         color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500'  },
  behind:   { label: 'Behind Schedule', color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-500'    },
}

const PRIORITY_COLOR = {
  high:   'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low:    'text-gray-500 bg-gray-50 border-gray-200',
}

function timeAgo(iso) {
  if (!iso) return ''
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }) } catch { return '' }
}

// ── Donut chart ───────────────────────────────────────────────
function DonutChart({ pct, size = 72, stroke = 8 }) {
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const fill = pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6366f1'
  const cx   = size / 2
  const cy   = size / 2

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {pct > 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={fill} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ * 0.25}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-gray-900 leading-none">{pct}%</span>
        <span className="text-[9px] text-gray-400 mt-0.5">done</span>
      </div>
    </div>
  )
}

// ── Summary bar (overall) ─────────────────────────────────────
function SummaryBar({ projects }) {
  const total   = projects.reduce((s, p) => s + (p.taskProgress?.total   || 0), 0)
  const done    = projects.reduce((s, p) => s + (p.taskProgress?.done    || 0), 0)
  const overdue = projects.reduce((s, p) => s + (p.taskProgress?.overdue || 0), 0)
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0

  const counts = {
    on_track: projects.filter(p => p.health === 'on_track').length,
    at_risk:  projects.filter(p => p.health === 'at_risk').length,
    behind:   projects.filter(p => p.health === 'behind').length,
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-8">
      <div className="flex flex-wrap gap-6 items-center mb-4">
        <div className="flex items-center gap-3">
          <DonutChart pct={pct} size={72} stroke={9} />
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Overall progress</p>
            <p className="text-xl font-bold text-gray-900">{done} / {total}</p>
            <p className="text-xs text-gray-500">tasks completed</p>
            {overdue > 0 && <p className="text-xs text-red-600 mt-0.5 font-medium">{overdue} overdue</p>}
          </div>
        </div>
        <div className="flex gap-5 flex-wrap">
          {Object.entries(counts).map(([key, count]) => count > 0 && (
            <div key={key} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${HEALTH[key].dot}`} />
              <span className="text-sm text-gray-700 font-medium">{count}</span>
              <span className="text-xs text-gray-400">{HEALTH[key].label.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6366f1' }} />
      </div>
    </div>
  )
}

// ── Single project section ────────────────────────────────────
function ProjectSection({ data, index }) {
  const [expanded, setExpanded] = useState(true)
  const { project, health, taskProgress, latestSummary, openItems, recentUpdates, topics, testStatus } = data
  const cfg = HEALTH[health] || HEALTH.on_track

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-5">
      {/* Color bar */}
      <div className="h-1.5" style={{ background: project.color || '#6366f1' }} />

      {/* Project header — clickable to collapse */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-6 py-5 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Number */}
          <span className="text-xs font-bold text-gray-300 w-5 flex-shrink-0">{String(index + 1).padStart(2, '0')}</span>
          {/* Color dot */}
          <div className="w-3.5 h-3.5 rounded-full flex-shrink-0"
            style={{ background: project.color || '#6366f1' }} />
          {/* Name + description */}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900">{project.name}</h2>
            {project.description && (
              <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>
            )}
          </div>
          {/* Health badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border flex-shrink-0 ${cfg.bg} ${cfg.border}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>
        {/* Progress % + toggle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {taskProgress && taskProgress.total > 0 && (
            <span className="text-sm font-bold text-gray-700 hidden sm:block">{taskProgress.pct}%</span>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Progress row */}
          {taskProgress && taskProgress.total > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-6">
                <DonutChart pct={taskProgress.pct} size={72} stroke={8} />
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-5 text-sm">
                    <span className="text-emerald-600 font-medium">{taskProgress.done} completed</span>
                    <span className="text-indigo-600 font-medium">{taskProgress.open} open</span>
                    <span className="text-gray-400">{taskProgress.total} total</span>
                    {taskProgress.overdue > 0 && (
                      <span className="text-red-600 font-medium">{taskProgress.overdue} overdue</span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${taskProgress.pct}%`,
                        background: taskProgress.pct >= 80 ? '#22c55e' : taskProgress.pct >= 40 ? '#f59e0b' : '#6366f1',
                      }} />
                  </div>
                  {project.updated_at && (
                    <p className="text-xs text-gray-400">Last activity {timeAgo(project.updated_at)}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {/* LEFT column */}
            <div className="px-6 py-5 space-y-5">
              {/* AI Summary */}
              {latestSummary && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <BookOpen className="w-3.5 h-3.5" /> Latest Summary
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{latestSummary}</p>
                </div>
              )}

              {/* Open Tasks */}
              {openItems && openItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <ListTodo className="w-3.5 h-3.5" /> Open Tasks ({openItems.length})
                  </h3>
                  <div className="space-y-1.5">
                    {openItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5 py-1">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                          item.overdue ? 'bg-red-500' : item.priority === 'high' ? 'bg-amber-500' : 'bg-gray-300'
                        }`} />
                        <span className={`text-sm flex-1 leading-snug ${item.overdue ? 'text-red-700' : 'text-gray-800'}`}>
                          {item.title}
                          {item.overdue && <span className="ml-2 text-xs text-red-500 font-medium">overdue</span>}
                          {item.due_date && !item.overdue && (
                            <span className="ml-2 text-xs text-gray-400">due {timeAgo(item.due_date)}</span>
                          )}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${PRIORITY_COLOR[item.priority] || PRIORITY_COLOR.medium}`}>
                          {item.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No tasks message */}
              {(!openItems || openItems.length === 0) && taskProgress?.done > 0 && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  All tasks completed!
                </div>
              )}

              {/* Test Status */}
              {testStatus && testStatus.total > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <FlaskConical className="w-3.5 h-3.5" /> Test Status
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-emerald-600 font-semibold">{testStatus.passing} passing</span>
                    <span className="text-amber-600">{testStatus.pending} pending</span>
                    <span className="text-gray-400">{testStatus.total} total</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.round((testStatus.passing / testStatus.total) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT column */}
            <div className="px-6 py-5 space-y-5">
              {/* Recent Updates */}
              {recentUpdates && recentUpdates.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5" /> Recent Updates
                  </h3>
                  <div className="space-y-4">
                    {recentUpdates.map((u, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1" />
                          {i < recentUpdates.length - 1 && (
                            <div className="w-px flex-1 bg-gray-200 mt-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className="text-sm text-gray-700 leading-relaxed">{u.summary}</p>
                          <p className="text-xs text-gray-400 mt-1">{timeAgo(u.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Topics */}
              {topics && topics.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                    <Tag className="w-3.5 h-3.5" /> Active Topics ({topics.length})
                  </h3>
                  <div className="space-y-3">
                    {topics.map((t, i) => (
                      <div key={i} className="border-b border-gray-100 last:border-0 pb-2.5 last:pb-0">
                        <p className="text-sm font-medium text-gray-800">{t.title}</p>
                        {t.summary && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.summary}</p>
                        )}
                        {t.updated_at && (
                          <p className="text-[11px] text-gray-400 mt-1">Updated {timeAgo(t.updated_at)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for right column */}
              {(!recentUpdates || recentUpdates.length === 0) && (!topics || topics.length === 0) && (
                <p className="text-sm text-gray-400 italic">No updates or topics yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function PublicCollection() {
  const { slug } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || ''
    axios.get(`${API_URL}/api/public/collection/${slug}`)
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.status === 404 ? 'not_found' : 'error'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      </div>
    )
  }

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
        <XCircle className="w-12 h-12 text-gray-300 mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 mb-6">This collection doesn't exist or has been unpublished.</p>
        <Link to="/" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          Go to Pinlooply <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Failed to load page. Please try again later.</p>
      </div>
    )
  }

  const { title, projects, meta } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">P</span>
            </div>
            <span className="text-sm font-semibold text-gray-700">{title || 'Projects Status'}</span>
            <span className="text-xs text-gray-400">· {projects.length} projects</span>
          </div>
          <a href="https://pinlooply.app" target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1">
            Powered by Pinlooply <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Page heading */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{title || 'Projects Status'}</h1>
          {meta?.fetchedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Updated {format(parseISO(meta.fetchedAt), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>

        {/* Overall summary */}
        {projects.length > 1 && <SummaryBar projects={projects} />}

        {/* Per-project sections */}
        {projects.map((p, i) => (
          <ProjectSection key={i} data={p} index={i} />
        ))}

        {/* Footer */}
        <div className="text-center py-6">
          <a href="https://pinlooply.app" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors">
            <div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-[9px]">P</span>
            </div>
            Powered by Pinlooply <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
