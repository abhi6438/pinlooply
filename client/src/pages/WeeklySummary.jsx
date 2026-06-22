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
  // Handle year boundaries
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
    if (p.changed?.length) out += `  🔄 Changed: ${p.changed.join(', ')}\n`
    if (p.pending?.length) out += `  ⏳ Pending: ${p.pending.join(', ')}\n`
    if (p.conflicts?.length) out += `  ⚠️ Conflicts: ${p.conflicts.join(', ')}\n`
    out += '\n'
  }

  if (data.highlights?.length) {
    out += `Highlights:\n${data.highlights.map(h => `  • ${h}`).join('\n')}\n`
  }
  return out.trim()
}

// ── Section component inside a project card ───────────────────
function Section({ icon, label, items, color, emptyText }) {
  if (!items?.length) return null
  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-widest ${color} mb-1.5 flex items-center gap-1`}>
        {icon} {label} <span className="font-normal opacity-60">({items.length})</span>
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
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
  const totalActivity = (project.completed?.length || 0) + (project.changed?.length || 0)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors select-none"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Hash className="w-3.5 h-3.5 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{project.project_name}</h3>
          {project.summary && (
            <p className="text-xs text-gray-400 truncate mt-0.5">{project.summary}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {project.completed?.length > 0 && (
            <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              ✅ {project.completed.length} done
            </span>
          )}
          {hasConflicts && (
            <span className="text-[11px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
              ⚠️ {project.conflicts.length}
            </span>
          )}
          {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-4 pt-2 border-t border-gray-100 space-y-4">
          <Section
            icon="✅" label="Completed"
            items={project.completed} color="text-emerald-700"
          />
          <Section
            icon="🔄" label="Changed"
            items={project.changed} color="text-blue-700"
          />
          <Section
            icon="⏳" label="Pending"
            items={project.pending} color="text-gray-500"
          />
          {project.conflicts?.length > 0 && (
            <Section
              icon="⚠️" label="Conflicts"
              items={project.conflicts} color="text-orange-700"
            />
          )}
          {!project.completed?.length && !project.changed?.length && !project.pending?.length && !project.conflicts?.length && (
            <p className="text-xs text-gray-400 italic">No activity data available.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ icon: Icon, value, label, color }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-2`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

// ── Right panel ───────────────────────────────────────────────
function SummaryPanel({ data, loading, copied, onCopy, onRegenerate, week, isCurrentWeek }) {
  if (!data && !loading) return null

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={CheckCircle2}  value={data.stats.totalCompleted}   label="Completed"   color="bg-emerald-500" />
          <StatCard icon={MessageSquare} value={data.stats.totalDiscussions}  label="Discussions" color="bg-indigo-500" />
          <StatCard icon={Clock}         value={data.stats.totalPending}      label="Pending"     color="bg-gray-400" />
          <StatCard icon={AlertCircle}   value={data.stats.totalConflicts}    label="Conflicts"   color="bg-orange-500" />
        </div>
      )}

      {/* Most active */}
      {data?.stats.mostActiveProject && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <div>
            <p className="text-[11px] text-indigo-500 font-semibold uppercase tracking-wide">Most Active</p>
            <p className="text-sm font-semibold text-indigo-900">{data.stats.mostActiveProject}</p>
          </div>
        </div>
      )}

      {/* Overall summary */}
      {data?.overall_summary && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Summary</p>
          <p className="text-sm text-gray-700 leading-relaxed">{data.overall_summary}</p>
        </div>
      )}

      {/* Highlights */}
      {data?.highlights?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Highlights</p>
          <ul className="space-y-1.5">
            {data.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
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
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm ${
            copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      )}

      {/* Generation time */}
      {data?.generatedAt && (
        <p className="text-center text-xs text-gray-400">
          Generated {format(parseISO(data.generatedAt), 'h:mm a, MMM d')}
        </p>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function WeeklySummary() {
  const thisWeek = currentWeekStr()
  const [week, setWeek]     = useState(thisWeek)
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Weekly Summary</h1>
          <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{range || week}</span>
          </div>
        </div>

        {/* Week navigator */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          <button
            onClick={prevWeek}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-3 py-1.5 text-center min-w-[120px]">
            <p className="text-xs font-semibold text-gray-900">
              {isCurrentWeek ? 'This week' : week}
            </p>
            {range && <p className="text-[11px] text-gray-400 mt-0.5">{range}</p>}
          </div>
          <button
            onClick={nextWeek}
            disabled={isCurrentWeek}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors disabled:opacity-30"
            title="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
        {/* Left — project cards */}
        <div className="lg:col-span-2 overflow-y-auto pr-1 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-24">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
              <p className="text-sm text-gray-500">Generating weekly summary…</p>
            </div>
          ) : !data ? null
          : data.projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-200">
              <FolderOpen className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500 mb-1">No activity this week</p>
              <p className="text-xs text-gray-400">Log discussions or complete tasks to see a summary here</p>
            </div>
          ) : (
            <>
              {data.projects.map((p, i) => (
                <ProjectCard key={i} project={p} />
              ))}
            </>
          )}
        </div>

        {/* Right — stats + summary panel */}
        <div className="lg:col-span-1 overflow-y-auto">
          <SummaryPanel
            data={data}
            loading={loading}
            copied={copied}
            onCopy={copyToClipboard}
            onRegenerate={() => load(week)}
            week={week}
            isCurrentWeek={isCurrentWeek}
          />
        </div>
      </div>
    </div>
  )
}
