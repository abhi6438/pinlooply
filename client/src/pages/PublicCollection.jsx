import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import {
  CheckCircle2, AlertTriangle, XCircle, Clock,
  Loader2, ExternalLink, ChevronRight,
} from 'lucide-react'
import { formatDistanceToNow, parseISO, format } from 'date-fns'

const HEALTH = {
  on_track: { label: 'On Track',        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', Icon: CheckCircle2 },
  at_risk:  { label: 'At Risk',         color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-500',  Icon: AlertTriangle },
  behind:   { label: 'Behind Schedule', color: 'text-red-600',    bg: 'bg-red-50',     border: 'border-red-200',    dot: 'bg-red-500',    Icon: XCircle },
}

function timeAgo(iso) {
  if (!iso) return ''
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }) } catch { return '' }
}

// ── Donut chart ───────────────────────────────────────────────
function DonutChart({ pct, size = 56, stroke = 7 }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const fill = pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6366f1'
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
        {pct > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none" stroke={fill} strokeWidth={stroke}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ * 0.25}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-gray-900">{pct}%</span>
      </div>
    </div>
  )
}

// ── Project card ──────────────────────────────────────────────
function ProjectCard({ data }) {
  const { project, health, taskProgress, latestSummary, openItems, testStatus } = data
  const cfg = HEALTH[health] || HEALTH.on_track
  const { Icon } = cfg

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      {/* Color bar */}
      <div className="h-1.5" style={{ background: project.color || '#6366f1' }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex-shrink-0"
              style={{ background: (project.color || '#6366f1') + '22' }}>
              <div className="w-full h-full rounded-xl" style={{ background: project.color || '#6366f1', opacity: 0.3 }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 truncate">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{project.description}</p>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border flex-shrink-0 ${cfg.bg} ${cfg.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>

        {/* Progress */}
        {taskProgress && taskProgress.total > 0 ? (
          <div className="flex items-center gap-4 mb-4">
            <DonutChart pct={taskProgress.pct} />
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span><strong className="text-gray-800">{taskProgress.done}</strong> done</span>
                <span><strong className="text-gray-800">{taskProgress.open}</strong> open</span>
                {taskProgress.overdue > 0 && (
                  <span className="text-red-600"><strong>{taskProgress.overdue}</strong> overdue</span>
                )}
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${taskProgress.pct}%`,
                    background: taskProgress.pct >= 80 ? '#22c55e' : taskProgress.pct >= 40 ? '#f59e0b' : '#6366f1',
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic mb-4">No tasks yet.</p>
        )}

        {/* AI Summary */}
        {latestSummary && (
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-3 bg-gray-50 rounded-lg px-3 py-2">
            {latestSummary}
          </p>
        )}

        {/* Open items preview */}
        {openItems && openItems.length > 0 && (
          <div className="space-y-1">
            {openItems.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  item.overdue ? 'bg-red-400' : item.priority === 'high' ? 'bg-amber-400' : 'bg-gray-300'
                }`} />
                <span className={`truncate ${item.overdue ? 'text-red-600' : ''}`}>{item.title}</span>
              </div>
            ))}
            {openItems.length > 3 && (
              <p className="text-[11px] text-gray-400 pl-3.5">+{openItems.length - 3} more</p>
            )}
          </div>
        )}

        {/* Test badge */}
        {testStatus && testStatus.total > 0 && (
          <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
            <span className="font-medium text-emerald-600">{testStatus.passing}/{testStatus.total}</span>
            <span>tests passing</span>
          </div>
        )}

        {/* Last updated */}
        {project.updated_at && (
          <p className="text-[11px] text-gray-300 mt-3">Updated {timeAgo(project.updated_at)}</p>
        )}
      </div>
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────
function SummaryBar({ projects }) {
  const total   = projects.reduce((s, p) => s + (p.taskProgress?.total || 0), 0)
  const done    = projects.reduce((s, p) => s + (p.taskProgress?.done || 0), 0)
  const overdue = projects.reduce((s, p) => s + (p.taskProgress?.overdue || 0), 0)
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0

  const onTrack = projects.filter(p => p.health === 'on_track').length
  const atRisk  = projects.filter(p => p.health === 'at_risk').length
  const behind  = projects.filter(p => p.health === 'behind').length

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
      <div className="flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-3">
          <DonutChart pct={pct} size={64} stroke={8} />
          <div>
            <p className="text-xs text-gray-500">Overall Progress</p>
            <p className="text-sm font-bold text-gray-900">{done} / {total} tasks done</p>
            {overdue > 0 && <p className="text-xs text-red-600">{overdue} overdue</p>}
          </div>
        </div>
        <div className="flex gap-4 text-xs">
          {onTrack > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-gray-600">{onTrack} on track</span>
            </div>
          )}
          {atRisk > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-600">{atRisk} at risk</span>
            </div>
          )}
          {behind > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-gray-600">{behind} behind</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6366f1',
          }}
        />
      </div>
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
        <p className="text-sm text-gray-500 mb-6">This collection page doesn't exist or has been unpublished.</p>
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
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">P</span>
            </div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Status Overview</span>
          </div>
          <a
            href="https://pinlooply.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
          >
            Powered by Pinlooply
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{title || 'Projects Status'}</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Summary */}
        {projects.length > 1 && <SummaryBar projects={projects} />}

        {/* Project grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <ProjectCard key={i} data={p} />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center py-8 mt-4">
          <a
            href="https://pinlooply.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <div className="w-4 h-4 bg-indigo-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-[9px]">P</span>
            </div>
            Powered by Pinlooply
            <ExternalLink className="w-3 h-3" />
          </a>
          {meta?.fetchedAt && (
            <p className="text-[11px] text-gray-300 mt-1">
              Fetched {format(parseISO(meta.fetchedAt), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
