import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import {
  CheckCircle2, AlertTriangle, XCircle, Clock,
  ChevronRight, FlaskConical, Loader2, ExternalLink,
  BookOpen, Tag,
} from 'lucide-react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'

// ── Health config ─────────────────────────────────────────────
const HEALTH = {
  on_track: {
    label:   'On Track',
    icon:    CheckCircle2,
    color:   'text-emerald-600',
    bg:      'bg-emerald-50',
    border:  'border-emerald-200',
    dot:     'bg-emerald-500',
    emoji:   '🟢',
  },
  at_risk: {
    label:   'At Risk',
    icon:    AlertTriangle,
    color:   'text-amber-600',
    bg:      'bg-amber-50',
    border:  'border-amber-200',
    dot:     'bg-amber-500',
    emoji:   '🟡',
  },
  behind: {
    label:   'Behind Schedule',
    icon:    XCircle,
    color:   'text-red-600',
    bg:      'bg-red-50',
    border:  'border-red-200',
    dot:     'bg-red-500',
    emoji:   '🔴',
  },
}

const PRIORITY_COLOR = {
  high:   'text-red-600 bg-red-50 border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low:    'text-gray-500 bg-gray-50 border-gray-200',
}

function timeAgo(iso) {
  if (!iso) return ''
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }) }
  catch { return '' }
}

// ── Donut chart (SVG, no deps) ────────────────────────────────
function DonutChart({ pct, done, total, overdue }) {
  const r = 36
  const cx = 48
  const cy = 48
  const circ = 2 * Math.PI * r
  const fill = pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6366f1'
  const dash = (pct / 100) * circ

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="9" />
        {pct > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none" stroke={fill} strokeWidth="9"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ * 0.25}
            strokeLinecap="round"
          />
        )}
        {overdue > 0 && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none" stroke="#ef4444" strokeWidth="9" opacity="0.7"
            strokeDasharray={`${(overdue / total) * circ} ${circ - (overdue / total) * circ}`}
            strokeDashoffset={circ * 0.25 - (done / total) * circ}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900 leading-none">{pct}%</span>
        <span className="text-[10px] text-gray-400 mt-0.5">done</span>
      </div>
    </div>
  )
}

// ── Priority bars ─────────────────────────────────────────────
function PriorityBars({ items }) {
  const total = items.length || 1
  const bars = [
    { label: 'High',   count: items.filter(t => t.priority === 'high').length,   color: '#ef4444', track: '#fee2e2' },
    { label: 'Medium', count: items.filter(t => t.priority === 'medium').length, color: '#f59e0b', track: '#fef3c7' },
    { label: 'Low',    count: items.filter(t => t.priority === 'low').length,    color: '#9ca3af', track: '#f3f4f6' },
  ]
  return (
    <div className="space-y-2.5">
      {bars.map(b => (
        <div key={b.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-12 flex-shrink-0">{b.label}</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: b.track }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max((b.count / total) * 100, b.count > 0 ? 4 : 0)}%`, background: b.color }} />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-4 text-right flex-shrink-0">{b.count}</span>
        </div>
      ))}
    </div>
  )
}

// ── Mini stat card ────────────────────────────────────────────
function StatCard({ value, label, color = 'text-gray-900' }) {
  return (
    <div className="flex flex-col items-center bg-gray-50 rounded-xl px-4 py-3 min-w-[60px]">
      <span className={`text-2xl font-bold leading-none ${color}`}>{value}</span>
      <span className="text-[11px] text-gray-400 mt-1 text-center">{label}</span>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, icon: Icon, children, empty }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100">
        <Icon className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-4">
        {empty
          ? <p className="text-sm text-gray-400 italic text-center py-4">{empty}</p>
          : children
        }
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function PublicProject() {
  const { slug } = useParams()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || ''
    axios.get(`${API_URL}/api/public/${slug}`)
      .then(res => setData(res.data.data))
      .catch(err => {
        if (err.response?.status === 404) setError('not_found')
        else setError('error')
      })
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
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <XCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Page not found</h1>
        <p className="text-sm text-gray-500 mb-6">This status page doesn't exist or has been unpublished.</p>
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

  const { project, health, taskProgress, latestSummary, openItems, recentUpdates, topics, testStatus } = data
  const healthCfg = HEALTH[health] || HEALTH.on_track
  const HealthIcon = healthCfg.icon

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color || '#6366f1' }}
            />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Status Page</span>
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-5">
        {/* Project header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex-shrink-0"
                style={{ backgroundColor: project.color || '#6366f1' }}
              />
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>
                )}
              </div>
            </div>

            {/* Status badge */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${healthCfg.bg} ${healthCfg.border} flex-shrink-0`}>
              <span className={`w-2 h-2 rounded-full ${healthCfg.dot}`} />
              <span className={`text-sm font-semibold ${healthCfg.color}`}>{healthCfg.label}</span>
            </div>
          </div>

          {project.updated_at && (
            <p className="text-xs text-gray-400 mt-4">
              Last updated {timeAgo(project.updated_at)}
            </p>
          )}
        </div>

        {/* Current Status */}
        <div className={`flex items-center gap-3 ${healthCfg.bg} border ${healthCfg.border} rounded-2xl px-5 py-4`}>
          <HealthIcon className={`w-5 h-5 ${healthCfg.color} flex-shrink-0`} />
          <div>
            <p className={`text-sm font-semibold ${healthCfg.color}`}>{healthCfg.emoji} {healthCfg.label}</p>
            {health === 'on_track' && <p className="text-xs text-gray-500 mt-0.5">All tasks progressing normally.</p>}
            {health === 'at_risk'  && <p className="text-xs text-gray-500 mt-0.5">Some items need attention soon.</p>}
            {health === 'behind'   && <p className="text-xs text-gray-500 mt-0.5">Multiple tasks are overdue.</p>}
          </div>
        </div>

        {/* Task Progress — donut + stats */}
        {taskProgress && taskProgress.total > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-gray-400" />
              Progress
            </h2>
            <div className="flex items-center gap-6">
              <DonutChart
                pct={taskProgress.pct}
                done={taskProgress.done}
                total={taskProgress.total}
                overdue={taskProgress.overdue}
              />
              <div className="flex-1 grid grid-cols-2 gap-2">
                <StatCard value={taskProgress.done}   label="Completed" color="text-emerald-600" />
                <StatCard value={taskProgress.open}   label="Open"      color="text-indigo-600" />
                <StatCard value={taskProgress.total}  label="Total" />
                {taskProgress.overdue > 0
                  ? <StatCard value={taskProgress.overdue} label="Overdue" color="text-red-600" />
                  : <StatCard value="0" label="Overdue" color="text-gray-400" />
                }
              </div>
            </div>
            {/* Progress bar underneath */}
            <div className="mt-4 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${taskProgress.pct}%`,
                  background: taskProgress.pct >= 80 ? '#22c55e' : taskProgress.pct >= 40 ? '#f59e0b' : '#6366f1',
                }}
              />
            </div>
          </div>
        )}

        {/* Priority Breakdown */}
        {openItems && openItems.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-gray-400" />
              Open Tasks by Priority
            </h2>
            <PriorityBars items={openItems} />
          </div>
        )}

        {/* AI Summary */}
        {latestSummary && (
          <Section title="Summary" icon={BookOpen}>
            <p className="text-sm text-gray-700 leading-relaxed">{latestSummary}</p>
          </Section>
        )}

        {/* Open Items */}
        <Section
          title={`Open Items (${openItems?.length || 0})`}
          icon={CheckCircle2}
          empty={openItems?.length === 0 ? 'No open items — all tasks completed! 🎉' : null}
        >
          <div className="space-y-2">
            {(openItems || []).map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  item.overdue ? 'bg-red-500' : item.priority === 'high' ? 'bg-amber-500' : 'bg-gray-300'
                }`} />
                <span className={`flex-1 text-sm ${item.overdue ? 'text-red-700' : 'text-gray-800'}`}>
                  {item.title}
                  {item.overdue && <span className="ml-2 text-xs text-red-500">overdue</span>}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLOR[item.priority] || PRIORITY_COLOR.medium}`}>
                  {item.priority}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Recent Updates */}
        <Section
          title="Recent Updates"
          icon={Clock}
          empty={recentUpdates?.length === 0 ? 'No updates yet.' : null}
        >
          <div className="space-y-4">
            {(recentUpdates || []).map((u, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-1.5 flex-shrink-0 flex flex-col items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                  {i < recentUpdates.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm text-gray-700 leading-relaxed">{u.summary}</p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(u.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Topics (open) */}
        {topics?.length > 0 && (
          <Section title="Active Topics" icon={Tag}>
            <div className="space-y-3">
              {topics.map((t, i) => (
                <div key={i} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                  <p className="text-sm font-medium text-gray-800">{t.title}</p>
                  {t.summary && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t.summary}</p>}
                  {t.updated_at && <p className="text-[11px] text-gray-400 mt-1">Updated {timeAgo(t.updated_at)}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Test Status */}
        {testStatus && (testStatus.total > 0) && (
          <Section title="Test Status" icon={FlaskConical}>
            <div className="flex items-center gap-5">
              <DonutChart
                pct={Math.round((testStatus.passing / testStatus.total) * 100)}
                done={testStatus.passing}
                total={testStatus.total}
                overdue={testStatus.pending}
              />
              <div className="flex gap-3 flex-wrap">
                <StatCard value={testStatus.passing} label="Passing" color="text-emerald-600" />
                <StatCard value={testStatus.pending} label="Pending" color="text-amber-600" />
                <StatCard value={testStatus.total}   label="Total" />
              </div>
            </div>
          </Section>
        )}

        {/* Footer */}
        <div className="text-center py-6">
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
          {data.meta?.fetchedAt && (
            <p className="text-[11px] text-gray-300 mt-1">
              Fetched {format(parseISO(data.meta.fetchedAt), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
