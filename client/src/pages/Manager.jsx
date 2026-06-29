import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { managerApi } from '../services/api'
import {
  Users, CheckSquare2, AlertTriangle, Clock, TrendingUp,
  ChevronDown, ChevronRight, BarChart3, Shield, Loader2,
} from 'lucide-react'
import { PageShell, PageHeader, PageLoader, EmptyState } from '../components/ui'
import toast from 'react-hot-toast'

const PRIORITY_DOT = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-blue-300',
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso)
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDue(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Completion ring ───────────────────────────────────────────
function Ring({ pct, size = 48 }) {
  const r  = (size - 6) / 2
  const c  = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const color = pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x={size/2} y={size/2}
        dominantBaseline="middle" textAnchor="middle"
        style={{ fontSize: size * 0.28, fontWeight: 700, fill: color, transform: `rotate(90deg) translate(0px, -${size}px)` }}
        transform={`rotate(90, ${size/2}, ${size/2})`}
      >
        {pct}%
      </text>
    </svg>
  )
}

// ── Member Card ───────────────────────────────────────────────
function MemberCard({ member }) {
  const [expanded, setExpanded] = useState(false)
  const { user, role, stats, active_tasks } = member

  const initials = (user.name || user.email || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header row */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-11 h-11 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary-700">
            {user.avatar_url
              ? <img src={user.avatar_url} className="w-11 h-11 rounded-xl object-cover" alt="" />
              : initials}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-warm-900 truncate">{user.name || user.email}</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                role === 'owner' ? 'bg-violet-100 text-violet-700'
                : role === 'admin' ? 'bg-blue-100 text-blue-700'
                : 'bg-warm-100 text-warm-600'
              }`}>{role}</span>
            </div>
            {user.email && user.name && (
              <p className="text-xs text-warm-400 truncate mt-0.5">{user.email}</p>
            )}
          </div>

          {/* Completion ring */}
          <Ring pct={stats.completion_rate} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: 'Total',      value: stats.total,       icon: CheckSquare2, color: 'text-warm-600'  },
            { label: 'Done',       value: stats.done,        icon: CheckSquare2, color: 'text-green-600' },
            { label: 'Overdue',    value: stats.overdue,     icon: AlertTriangle, color: stats.overdue > 0 ? 'text-red-600' : 'text-warm-400' },
            { label: 'Blocked',    value: stats.blocked,     icon: Shield,       color: stats.blocked > 0 ? 'text-amber-600' : 'text-warm-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="text-center p-2 rounded-xl bg-warm-50">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-warm-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Active tasks toggle */}
      {active_tasks.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-warm-500 hover:text-warm-800 border-t border-warm-100 hover:bg-warm-50 transition-colors"
          >
            <span className="font-medium">{active_tasks.length} active task{active_tasks.length !== 1 ? 's' : ''}</span>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {expanded && (
            <div className="border-t border-warm-100 divide-y divide-warm-50">
              {active_tasks.map(task => (
                <div key={task.id} className="px-5 py-2.5 flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-warm-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${task.is_overdue ? 'text-red-700 font-medium' : 'text-warm-800'}`}>
                      {task.title}
                    </p>
                    {task.project && (
                      <p className="text-[10px] text-warm-400 truncate">{task.project.name}</p>
                    )}
                  </div>
                  {task.due_date && (
                    <span className={`text-[10px] flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                      task.is_overdue
                        ? 'bg-red-100 text-red-600 font-medium'
                        : 'bg-warm-100 text-warm-500'
                    }`}>
                      {formatDue(task.due_date)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Summary Stat Card ─────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-warm-900', bg = 'bg-white' }) {
  return (
    <div className={`card p-4 flex items-center gap-4 ${bg}`}>
      <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center flex-shrink-0">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-warm-500">{label}</p>
        {sub && <p className="text-[10px] text-warm-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function Manager() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    managerApi.overview()
      .then(res => setData(res.data.data))
      .catch(err => {
        if (err.response?.status === 403) {
          setError('manager_only')
        } else {
          toast.error('Failed to load manager overview')
          setError('error')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageShell><PageLoader /></PageShell>

  if (error === 'manager_only') {
    return (
      <PageShell>
        <EmptyState
          icon={<Shield className="w-12 h-12" />}
          title="Manager access only"
          subtitle="This view is available to group owners and admins."
        />
      </PageShell>
    )
  }

  if (!data) return null

  const { summary, members } = data
  const completionRate = summary.total_tasks > 0
    ? Math.round((summary.done_tasks / summary.total_tasks) * 100)
    : 0

  return (
    <PageShell>
      <PageHeader
        title="Manager View"
        subtitle={summary.group_name ? `Team: ${summary.group_name}` : `${summary.member_count} member${summary.member_count !== 1 ? 's' : ''}`}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users}         label="Team members"    value={summary.member_count}  />
        <StatCard icon={CheckSquare2}  label="Tasks done"      value={`${summary.done_tasks}/${summary.total_tasks}`} sub={`${completionRate}% complete`} color="text-green-600" />
        <StatCard icon={AlertTriangle} label="Overdue tasks"   value={summary.overdue_tasks} color={summary.overdue_tasks > 0 ? 'text-red-600' : 'text-warm-400'} />
        <StatCard icon={Shield}        label="Blocked tasks"   value={summary.blocked_tasks} color={summary.blocked_tasks > 0 ? 'text-amber-600' : 'text-warm-400'} />
      </div>

      {/* Team progress bar */}
      {summary.total_tasks > 0 && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-warm-700 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary-500" />
              Overall team progress
            </span>
            <span className="text-sm font-bold text-warm-900">{completionRate}%</span>
          </div>
          <div className="w-full h-2.5 bg-warm-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${completionRate}%`,
                background: completionRate >= 80 ? '#22c55e' : completionRate >= 40 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-warm-400">
            <span>{summary.done_tasks} done</span>
            <span>{summary.total_tasks - summary.done_tasks} remaining</span>
          </div>
        </div>
      )}

      {/* Members grid */}
      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="w-12 h-12" />}
          title="No team members yet"
          subtitle="Invite members to your group to see their progress here."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {members.map(m => (
            <MemberCard key={m.user.id} member={m} />
          ))}
        </div>
      )}
    </PageShell>
  )
}
