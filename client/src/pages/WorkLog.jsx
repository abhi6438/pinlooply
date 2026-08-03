import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { timeEntriesApi } from '../services/api'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  Clock, ChevronLeft, ChevronRight, Calendar, Loader2,
  Download, Plus, CheckCircle2, AlertCircle, Circle,
  Timer, FileText, Folder, RefreshCw, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────
function fmtMins(mins) {
  if (!mins || mins === 0) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDateLabel(iso) {
  const [y, mo, d] = iso.split('-').map(Number)
  const today = todayISO()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yestISO = yesterday.toISOString().slice(0, 10)

  if (iso === today) return 'Today'
  if (iso === yestISO) return 'Yesterday'
  const date = new Date(y, mo - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function statusIcon(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('done') || s.includes('complete') || s.includes('closed'))
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
  if (s.includes('progress') || s.includes('review'))
    return <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
  return <Circle className="w-3.5 h-3.5 text-warm-300" />
}

// ── Log Time modal ────────────────────────────────────────────
function LogTimeModal({ task, date, onClose, onSaved }) {
  const [mins, setMins] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const m = parseInt(mins)
    if (!m || m <= 0) return toast.error('Enter a valid duration')
    setSaving(true)
    try {
      await timeEntriesApi.create({ task_id: task.id, duration_mins: m, notes: note || null, logged_at: date })
      toast.success('Time logged')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to log time')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm px-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4"
      >
        <div>
          <p className="text-xs text-warm-400 font-medium mb-0.5">Log time for</p>
          <p className="text-sm font-semibold text-warm-900 leading-snug">{task.title}</p>
        </div>
        <div>
          <label className="text-xs font-medium text-warm-600 block mb-1">Duration (minutes)</label>
          <input
            autoFocus
            type="number"
            min="1"
            placeholder="e.g. 45"
            value={mins}
            onChange={e => setMins(e.target.value)}
            className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-warm-600 block mb-1">Note (optional)</label>
          <input
            type="text"
            placeholder="What did you work on?"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 border border-warm-200 rounded-lg py-2 text-sm text-warm-600 hover:bg-warm-50">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-primary-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-600 disabled:opacity-60 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Log Time
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Export helpers ────────────────────────────────────────────
function buildTextExport(data, dateLabel) {
  const lines = []
  lines.push(`Work Log — ${dateLabel}`)
  lines.push('='.repeat(40))
  lines.push(`Total time: ${fmtMins(data.total_mins)}`)
  lines.push('')

  for (const project of data.projects) {
    lines.push(`${project.project?.name || 'Unknown Project'} (${fmtMins(project.total_mins)})`)
    lines.push('-'.repeat(36))
    for (const task of project.tasks) {
      const num = task.task_number ? `#${task.task_number}  ` : ''
      lines.push(`  ${num}${task.title}`)
      if (task.total_mins) lines.push(`    Time: ${fmtMins(task.total_mins)}`)
      for (const e of task.entries) {
        if (e.notes) lines.push(`    → ${e.notes}`)
      }
      for (const u of task.updates) {
        lines.push(`    [${fmtTime(u.created_at)}] ${u.content}`)
      }
    }
    lines.push('')
  }
  return lines.join('\n')
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Task card ─────────────────────────────────────────────────
function TaskCard({ task, date, onLogTime }) {
  const [expanded, setExpanded] = useState(true)
  const hasActivity = task.entries.length > 0 || task.updates.length > 0

  return (
    <div className="bg-white rounded-xl border border-warm-100 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-warm-50/50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {statusIcon(task.status)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {task.task_number && (
              <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                #{task.task_number}
              </span>
            )}
            <span className="text-sm font-medium text-warm-900 truncate">{task.title}</span>
          </div>
          {task.status && (
            <span className="text-[10px] text-warm-400 mt-0.5 block">{task.status}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {task.total_mins > 0 && (
            <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {fmtMins(task.total_mins)}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onLogTime(task) }}
            className="text-xs text-warm-400 hover:text-primary-600 flex items-center gap-1 transition-colors"
            title="Log time"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && hasActivity && (
        <div className="border-t border-warm-100 px-4 pb-3 pt-2 space-y-1.5">
          {task.entries.map(e => (
            <div key={e.id} className="flex items-start gap-2 text-xs text-warm-600">
              <Timer className="w-3 h-3 mt-0.5 text-primary-400 flex-shrink-0" />
              <span>
                <span className="font-medium text-primary-600">{fmtMins(e.duration_mins)}</span>
                {e.notes && <span className="text-warm-500"> — {e.notes}</span>}
              </span>
            </div>
          ))}
          {task.updates.map(u => (
            <div key={u.id} className="flex items-start gap-2 text-xs text-warm-600">
              <FileText className="w-3 h-3 mt-0.5 text-warm-300 flex-shrink-0" />
              <span>
                <span className="text-warm-400 mr-1">{fmtTime(u.created_at)}</span>
                {u.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function WorkLog() {
  const { activeGroupId } = useWorkspace()
  const navigate = useNavigate()

  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logTimeTask, setLogTimeTask] = useState(null)

  const load = useCallback(async (d) => {
    setLoading(true)
    try {
      const params = { date: d }
      if (activeGroupId) params.group_id = activeGroupId
      const res = await timeEntriesApi.worklog(params)
      setData(res.data.data)
    } catch {
      toast.error('Failed to load work log')
    } finally {
      setLoading(false)
    }
  }, [activeGroupId])

  useEffect(() => { load(date) }, [date, load])

  function shiftDate(delta) {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    const next = d.toISOString().slice(0, 10)
    if (next <= todayISO()) setDate(next)
  }

  function exportTxt() {
    if (!data) return
    const text = buildTextExport(data, fmtDateLabel(date))
    downloadText(text, `worklog-${date}.txt`)
  }

  const dateLabel = fmtDateLabel(date)
  const isToday = date === todayISO()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-500" />
          <h1 className="text-xl font-bold text-warm-900">Work Log</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(date)}
            className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-400 hover:text-warm-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportTxt}
            disabled={!data || data.projects.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-warm-200 text-sm text-warm-600 hover:bg-warm-50 disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-3 bg-white border border-warm-200 rounded-xl px-4 py-3">
        <button
          onClick={() => shiftDate(-1)}
          className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-500 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <Calendar className="w-4 h-4 text-warm-400" />
          <span className="text-sm font-semibold text-warm-900">{dateLabel}</span>
          <span className="text-xs text-warm-400">{date}</span>
        </div>
        <button
          onClick={() => shiftDate(1)}
          disabled={isToday}
          className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-500 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Date picker shortcut buttons */}
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map(delta => {
          const d = new Date()
          d.setDate(d.getDate() - delta)
          const iso = d.toISOString().slice(0, 10)
          const label = delta === 0 ? 'Today' : delta === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short' })
          const active = iso === date
          return (
            <button
              key={iso}
              onClick={() => setDate(iso)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                active
                  ? 'bg-primary-500 text-white border-primary-500'
                  : 'border-warm-200 text-warm-600 hover:bg-warm-50'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Custom date input */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-warm-500">Or pick a date:</span>
        <input
          type="date"
          max={todayISO()}
          value={date}
          onChange={e => { if (e.target.value) setDate(e.target.value) }}
          className="border border-warm-200 rounded-lg px-3 py-1.5 text-sm text-warm-700 focus:outline-none focus:border-primary-400"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-warm-300" />
        </div>
      ) : !data || data.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
          <Clock className="w-10 h-10 text-warm-200" />
          <p className="text-warm-500 font-medium">No activity logged for {dateLabel.toLowerCase()}</p>
          <p className="text-xs text-warm-400">Log time on tasks to see your work here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="bg-primary-50 border border-primary-100 rounded-xl px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-semibold text-primary-700">Total: {fmtMins(data.total_mins)}</span>
            </div>
            <span className="text-xs text-primary-500">
              {data.projects.length} project{data.projects.length !== 1 ? 's' : ''} · {data.projects.reduce((s, p) => s + p.tasks.length, 0)} task{data.projects.reduce((s, p) => s + p.tasks.length, 0) !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Projects */}
          {data.projects.map(project => (
            <div key={project.project?.id || 'unknown'} className="space-y-2">
              {/* Project header */}
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.project?.color || '#6366f1' }}
                />
                <span className="text-sm font-bold text-warm-800">
                  {project.project?.name || 'Unknown Project'}
                </span>
                {project.total_mins > 0 && (
                  <span className="text-xs text-warm-400 font-medium">{fmtMins(project.total_mins)}</span>
                )}
                <div className="flex-1 h-px bg-warm-100" />
              </div>

              {/* Tasks */}
              <div className="space-y-2 pl-5">
                {project.tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    date={date}
                    onLogTime={setLogTimeTask}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Time modal */}
      {logTimeTask && (
        <LogTimeModal
          task={logTimeTask}
          date={date}
          onClose={() => setLogTimeTask(null)}
          onSaved={() => load(date)}
        />
      )}
    </div>
  )
}
