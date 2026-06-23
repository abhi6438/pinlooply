import { useState, useEffect, useCallback } from 'react'
import { summaryApi } from '../services/api'
import {
  ChevronLeft, ChevronRight, Copy, CheckCheck, Loader2,
  CheckCircle2, Clock, AlertCircle, RefreshCw, BarChart3,
  FolderOpen, MessageSquare, Zap, TrendingUp, Calendar,
  ChevronDown, ChevronUp, Hash,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

// ── ISO week helpers ──────────────────────────────────────────
function currentWeekStr() {
  const now = new Date()
  const year = now.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const weekOneStart = new Date(jan4)
  weekOneStart.setDate(jan4.getDate() - (jan4Day - 1))
  const diff = now - weekOneStart
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

function weekOffset(weekStr, delta) {
  const [yearStr, wStr] = weekStr.split('-W')
  let year = parseInt(yearStr, 10)
  let week = parseInt(wStr, 10) + delta
  if (week < 1) { year--; week = 52 }
  if (week > 52) { year++; week = 1 }
  return `${year}-W${String(week).padStart(2, '0')}`
}

function formatWeekRange(start, end) {
  if (!start || !end) return ''
  const s = parseISO(start)
  const e = parseISO(end)
  const sameMonth = s.getMonth() === e.getMonth()
  if (sameMonth) {
    return `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}`
  }
  return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
}

// ── Format summary as plain text ─────────────────────────────
function formatAsText(data) {
  if (!data) return ''
  const range = formatWeekRange(data.dateRange?.start, data.dateRange?.end)
  let out = `Weekly Summary — ${range}\n\n`
  if (data.overall_summary) out += `${data.overall_summary}\n\n`

  for (const p of data.projects || []) {
    out += `📋 ${p.project_name}\n`
    if (p.completed?.length) out += `  ✅ Completed: ${p.completed.join(', ')}\n`
    if (p.changed?.length)   out += `  🔄 Changed: ${p.changed.join(', ')}\n`
    if (p.pending?.length)   out += `  ⏳ Pending: ${p.pending.join(', ')}\n`
    if (p.conflicts?.length) out += `  ⚠️ Conflicts: ${p.conflicts.join(', ')}\n`
    out += '\n'
  }

  if (data.highlights?.length) {
    out += `Highlights:\n${data.highlights.map(h => `  • ${h}`).join('\n')}\n`
  }
  return out.trim()
}

// ── Section component inside a project card ───────────────────
function Section({ icon, label, items, color }) {
  if (!items?.length) return null
  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-widest ${color} mb-1.5 flex items-center gap-1`}>
        {icon} {label} <span className="font-normal opacity-60">({items.length})</span>
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-warm-900">
            <span className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 flex-shrink-0 opacity-40" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Per-project card ──────────────────────────────────────────
function ProjectCard({ project }) {
  const [collapsed, setCollapsed] = useState(false)
  const hasConflicts = project.conflicts?.length > 0

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-warm-50 transition-colors select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Hash className="w-3.5 h-3.5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-warm-900 truncate">{project.project_name}</h3>
          {project.summary && (
            <p className="text-xs text-warm-400 truncate mt-0.5">{project.summary}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {project.completed?.length > 0 && (
            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              ✅ {project.completed.length} done
            </span>
          )}
          {hasConflicts && (
            <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              ⚠️ {project.conflicts.length}
            </span>
          )}
          {collapsed ? <ChevronDown className="w-4 h-4 text-warm-400" /> : <ChevronUp className="w-4 h-4 text-warm-400" />}
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-4 pt-2 border-t border-warm-100 space-y-4">
          <Section icon="✅" label="Completed" items={project.completed} color="text-emerald-700" />
          <Section icon="🔄" label="Changed"   items={project.changed}   color="text-blue-700" />
          <Section icon="⏳" label="Pending"   items={project.pending}   color="text-warm-500" />
          {project.conflicts?.length > 0 && (
            <Section icon="⚠️" label="Conflicts" items={project.conflicts} color="text-amber-700" />
          )}
          {!project.completed?.length && !project.changed?.length && !project.pending?.length && !project.conflicts?.length && (
            <p className="text-xs text-warm-400 italic">No activity data available.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────
function StatBox({ icon: Icon, value, label, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-warm-100">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold text-warm-900">{value}</p>
      <p className="text-xs text-warm-400 mt-0.5">{label}</p>
    </div>
  )
}

// ── Right panel ───────────────────────────────────────────────
function SummaryPanel({ data, loading, copied, onCopy, onRegenerate }) {
  return (
    <div className="card space-y-4 p-5">
      {/* Stats grid */}
      {data ? (
        <div className="grid grid-cols-2 gap-3">
          <StatBox icon={CheckCircle2}  value={data.stats.totalCompleted}  label="Completed"   iconBg="bg-emerald-100" iconColor="text-emerald-600" />
          <StatBox icon={MessageSquare} value={data.stats.totalDiscussions} label="Discussions" iconBg="bg-primary-100" iconColor="text-primary-600" />
          <StatBox icon={Clock}         value={data.stats.totalPending}     label="Pending"     iconBg="bg-warm-100"    iconColor="text-warm-500" />
          <StatBox icon={AlertCircle}   value={data.stats.totalConflicts}   label="Conflicts"   iconBg="bg-amber-100"   iconColor="text-amber-600" />
        </div>
      ) : (
        /* Skeleton stats while loading */
        <div className="grid grid-cols-2 gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className="bg-warm-50 rounded-xl p-4 border border-warm-100 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-warm-100 mb-2" />
              <div className="h-6 w-10 bg-warm-100 rounded mb-1" />
              <div className="h-3 w-16 bg-warm-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Most active */}
      {data?.stats.mostActiveProject && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-primary-600 flex-shrink-0" />
          <div>
            <p className="text-[11px] text-primary-500 font-semibold uppercase tracking-wide">Most Active</p>
            <p className="text-sm font-semibold text-primary-900">{data.stats.mostActiveProject}</p>
          </div>
        </div>
      )}

      {/* Overall summary */}
      {data?.overall_summary ? (
        <div className="bg-primary-50 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wide mb-2">AI Summary</p>
          <p className="text-sm text-primary-900 leading-relaxed">{data.overall_summary}</p>
        </div>
      ) : loading ? (
        <div className="bg-warm-50 rounded-xl p-4 animate-pulse space-y-2">
          <div className="h-3 w-20 bg-warm-100 rounded" />
          <div className="h-4 bg-warm-100 rounded w-full" />
          <div className="h-4 bg-warm-100 rounded w-5/6" />
          <div className="h-4 bg-warm-100 rounded w-4/6" />
        </div>
      ) : null}

      {/* Highlights */}
      {data?.highlights?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-warm-500 uppercase tracking-wide mb-2">Highlights</p>
          <ul className="space-y-1.5">
            {data.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-warm-900">
                <Zap className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Copy button */}
      {data && (
        <button
          onClick={onCopy}
          className={`btn-secondary w-full flex items-center justify-center gap-2 ${
            copied ? '!bg-emerald-600 !text-white !border-emerald-600' : ''
          }`}
        >
          {copied
            ? <><CheckCheck className="w-4 h-4" /> Copied!</>
            : <><Copy className="w-4 h-4" /> Copy Summary</>
          }
        </button>
      )}

      {/* Regenerate */}
      {data && (
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="btn-ghost w-full flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      )}

      {/* Generation time */}
      {data?.generatedAt && (
        <p className="text-center text-xs text-warm-400">
          Generated {format(parseISO(data.generatedAt), 'h:mm a, MMM d')}
        </p>
      )}
    </div>
  )
}

// ── Full-width loading skeleton ───────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
      {/* Left skeleton */}
      <div className="lg:col-span-2 space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-7 h-7 rounded-lg bg-warm-100" />
              <div className="flex-1">
                <div className="h-4 bg-warm-100 rounded w-40 mb-1.5" />
                <div className="h-3 bg-warm-100 rounded w-24" />
              </div>
              <div className="h-5 w-16 bg-warm-100 rounded-full" />
            </div>
            <div className="space-y-3 pt-2 border-t border-warm-100">
              {[0, 1].map(j => (
                <div key={j} className="flex gap-3">
                  <div className="h-3 w-16 bg-warm-100 rounded" />
                  <div className="flex-1 h-3 bg-warm-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Right skeleton */}
      <div className="lg:col-span-1">
        <div className="card p-5 animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                <div className="w-8 h-8 rounded-lg bg-warm-100 mb-2" />
                <div className="h-6 w-10 bg-warm-100 rounded mb-1" />
                <div className="h-3 w-16 bg-warm-100 rounded" />
              </div>
            ))}
          </div>
          <div className="bg-warm-50 rounded-xl p-4 space-y-2">
            <div className="h-3 w-20 bg-warm-100 rounded" />
            <div className="h-4 bg-warm-100 rounded w-full" />
            <div className="h-4 bg-warm-100 rounded w-5/6" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── No-activity empty state ───────────────────────────────────
function NoActivityState({ onRegenerate }) {
  return (
    <div className="flex-1 flex items-center justify-center py-8">
      <div className="max-w-md w-full card p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-warm-100 flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-warm-300" />
        </div>
        <h3 className="text-lg font-semibold text-warm-900 mb-2">No activity this week</h3>
        <p className="text-sm text-warm-500 leading-relaxed mb-6">
          Log discussions or complete tasks this week to see a summary here. Activity is tracked in real-time.
        </p>
        <button onClick={onRegenerate} className="btn-secondary flex items-center gap-2 mx-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function WeeklySummary() {
  const thisWeek = currentWeekStr()
  const [week, setWeek]       = useState(thisWeek)
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)

  const isCurrentWeek = week === thisWeek

  const load = useCallback(async (weekStr) => {
    setLoading(true)
    setData(null)
    try {
      const res = await summaryApi.weekly(weekStr)
      setData(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(week) }, [week, load])

  function prevWeek() { setWeek(w => weekOffset(w, -1)) }
  function nextWeek() { setWeek(w => weekOffset(w, +1)) }

  async function copyToClipboard() {
    const text = formatAsText(data)
    try { await navigator.clipboard.writeText(text) }
    catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2500)
  }

  const range = data ? formatWeekRange(data.dateRange?.start, data.dateRange?.end) : ''

  return (
    <div className="h-full flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-warm-900">Weekly Summary</h1>
            <span className="badge badge-purple">AI</span>
          </div>
          {range ? (
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-warm-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>{range}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-warm-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>{isCurrentWeek ? 'This week' : week}</span>
            </div>
          )}
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="btn-ghost btn-sm flex items-center gap-1"
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-warm-900 min-w-[80px] text-center px-2">
            {isCurrentWeek ? 'This week' : week}
          </span>
          <button
            onClick={nextWeek}
            disabled={isCurrentWeek}
            className="btn-ghost btn-sm flex items-center gap-1 disabled:opacity-30"
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : !data || data.projects?.length === 0 ? (
        <NoActivityState onRegenerate={() => load(week)} />
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
          {/* Left — project cards */}
          <div className="lg:col-span-2 overflow-y-auto pr-1 space-y-4">
            {data.projects.map((p, i) => (
              <ProjectCard key={i} project={p} />
            ))}
          </div>

          {/* Right — stats + summary panel */}
          <div className="lg:col-span-1 overflow-y-auto">
            <SummaryPanel
              data={data}
              loading={loading}
              copied={copied}
              onCopy={copyToClipboard}
              onRegenerate={() => load(week)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
