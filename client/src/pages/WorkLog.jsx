import { useState, useEffect, useCallback, useRef } from 'react'
import { timeEntriesApi, taskUpdatesApi } from '../services/api'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  Clock, ChevronLeft, ChevronRight, Loader2, Download,
  Plus, Timer, FileText, RefreshCw, Check, X, Trash2,
  Pencil, CheckCircle2, Circle, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ────────────────────────────────────────────────────
function fmtMins(mins) {
  if (!mins || mins === 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function shiftISO(iso, delta) {
  const d = new Date(iso)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

function fmtDateLabel(iso) {
  const today = todayISO()
  const yesterday = shiftISO(today, -1)
  if (iso === today) return 'Today'
  if (iso === yesterday) return 'Yesterday'
  const [y, mo, d] = iso.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function statusMeta(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('done') || s.includes('complete') || s.includes('closed'))
    return { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-green-500' }
  if (s.includes('progress') || s.includes('review'))
    return { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-amber-500' }
  return { icon: <Circle className="w-3.5 h-3.5" />, color: 'text-warm-300' }
}

function buildTextExport(data, dateLabel) {
  const lines = [
    `Work Log — ${dateLabel}`,
    '═'.repeat(50),
    `Total time logged: ${fmtMins(data.total_mins)}`,
    '',
  ]
  for (const project of data.projects) {
    lines.push(`▸ ${project.project?.name || 'Unknown Project'}  (${fmtMins(project.total_mins)})`)
    lines.push('─'.repeat(48))
    for (const task of project.tasks) {
      const num = task.task_number ? `#${task.task_number}  ` : ''
      lines.push(`  ${num}${task.title}  [${task.status || 'no status'}]  ${fmtMins(task.total_mins)}`)
      for (const e of task.entries) {
        lines.push(`    ⏱  ${fmtMins(e.duration_mins)}${e.notes ? ` — ${e.notes}` : ''}`)
      }
      for (const u of task.updates) {
        lines.push(`    ✎  ${fmtTime(u.created_at)}  ${u.content}`)
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
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Inline editable time entry row ────────────────────────────
function TimeEntryRow({ entry, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [mins, setMins] = useState(String(entry.duration_mins))
  const [note, setNote] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)
  const minsRef = useRef()

  function startEdit() { setEditing(true); setTimeout(() => minsRef.current?.focus(), 50) }
  function cancel() { setMins(String(entry.duration_mins)); setNote(entry.notes || ''); setEditing(false) }

  async function save() {
    const m = parseInt(mins)
    if (!m || m <= 0) return toast.error('Enter valid minutes')
    setSaving(true)
    try {
      await timeEntriesApi.update(entry.id, { duration_mins: m, notes: note || null })
      onUpdated({ ...entry, duration_mins: m, notes: note || null })
      setEditing(false)
      toast.success('Updated')
    } catch { toast.error('Failed to update') }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('Delete this time entry?')) return
    try {
      await timeEntriesApi.delete(entry.id)
      onDeleted(entry.id)
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1.5 group">
        <Timer className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
        <input
          ref={minsRef}
          type="number" min="1" value={mins}
          onChange={e => setMins(e.target.value)}
          className="w-16 border border-primary-300 rounded-md px-2 py-0.5 text-xs text-warm-800 focus:outline-none focus:ring-1 focus:ring-primary-400"
          placeholder="mins"
        />
        <span className="text-xs text-warm-400">min</span>
        <input
          type="text" value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="flex-1 border border-primary-300 rounded-md px-2 py-0.5 text-xs text-warm-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
        />
        <button onClick={save} disabled={saving} className="text-green-500 hover:text-green-600 p-0.5">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={cancel} className="text-warm-400 hover:text-warm-600 p-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1 group/row">
      <Timer className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
      <span className="text-xs font-semibold text-primary-600 min-w-[36px]">{fmtMins(entry.duration_mins)}</span>
      {entry.notes && <span className="text-xs text-warm-500 flex-1 truncate">{entry.notes}</span>}
      {!entry.notes && <span className="flex-1" />}
      <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-1 transition-opacity">
        <button onClick={startEdit} className="text-warm-300 hover:text-primary-500 p-0.5 transition-colors">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={remove} className="text-warm-300 hover:text-red-500 p-0.5 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ── Inline editable task update row ──────────────────────────
function UpdateRow({ update, taskId, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(update.content || '')
  const [saving, setSaving] = useState(false)
  const textRef = useRef()

  function startEdit() { setEditing(true); setTimeout(() => textRef.current?.focus(), 50) }
  function cancel() { setContent(update.content || ''); setEditing(false) }

  async function save() {
    if (!content.trim()) return toast.error('Content cannot be empty')
    setSaving(true)
    try {
      await taskUpdatesApi.update(taskId, update.id, content.trim(), update.update_type)
      onUpdated({ ...update, content: content.trim() })
      setEditing(false)
      toast.success('Updated')
    } catch { toast.error('Failed to update') }
    finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('Delete this update?')) return
    try {
      await taskUpdatesApi.delete(taskId, update.id)
      onDeleted(update.id)
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  if (editing) {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <FileText className="w-3.5 h-3.5 mt-0.5 text-warm-300 flex-shrink-0" />
        <textarea
          ref={textRef}
          rows={2}
          value={content}
          onChange={e => setContent(e.target.value)}
          className="flex-1 border border-primary-300 rounded-md px-2 py-1 text-xs text-warm-700 focus:outline-none focus:ring-1 focus:ring-primary-400 resize-none"
          onKeyDown={e => { if (e.key === 'Escape') cancel() }}
        />
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button onClick={save} disabled={saving} className="text-green-500 hover:text-green-600 p-0.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button onClick={cancel} className="text-warm-400 hover:text-warm-600 p-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2 py-1 group/row">
      <FileText className="w-3.5 h-3.5 mt-0.5 text-warm-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-warm-400 mr-1.5">{fmtTime(update.created_at)}</span>
        <span className="text-xs text-warm-600">{update.content}</span>
      </div>
      <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-1 flex-shrink-0 transition-opacity">
        <button onClick={startEdit} className="text-warm-300 hover:text-primary-500 p-0.5 transition-colors">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={remove} className="text-warm-300 hover:text-red-500 p-0.5 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ── Log time mini-form ────────────────────────────────────────
function LogTimeForm({ taskId, date, onSaved, onCancel }) {
  const [mins, setMins] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef()
  useEffect(() => ref.current?.focus(), [])

  async function submit(e) {
    e.preventDefault()
    const m = parseInt(mins)
    if (!m || m <= 0) return toast.error('Enter valid minutes')
    setSaving(true)
    try {
      await timeEntriesApi.create({ task_id: taskId, duration_mins: m, notes: note || null, logged_at: date })
      toast.success('Time logged')
      onSaved()
    } catch { toast.error('Failed to log time') }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 mt-1 pt-2 border-t border-warm-100">
      <Timer className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
      <input
        ref={ref}
        type="number" min="1" value={mins}
        onChange={e => setMins(e.target.value)}
        placeholder="mins"
        className="w-16 border border-warm-200 rounded-md px-2 py-1 text-xs text-warm-800 focus:outline-none focus:border-primary-400"
      />
      <input
        type="text" value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="flex-1 border border-warm-200 rounded-md px-2 py-1 text-xs text-warm-700 focus:outline-none focus:border-primary-400"
      />
      <button type="submit" disabled={saving}
        className="bg-primary-500 text-white rounded-md px-3 py-1 text-xs font-medium hover:bg-primary-600 disabled:opacity-60 flex items-center gap-1">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        Log
      </button>
      <button type="button" onClick={onCancel} className="text-warm-400 hover:text-warm-600 p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  )
}

// ── Task card ─────────────────────────────────────────────────
function TaskCard({ task: initialTask, date, projectColor, onDataChanged }) {
  const [task, setTask] = useState(initialTask)
  const [showLogForm, setShowLogForm] = useState(false)
  const sm = statusMeta(task.status)

  function handleEntryUpdated(updated) {
    const entries = task.entries.map(e => e.id === updated.id ? updated : e)
    const total_mins = entries.reduce((s, e) => s + e.duration_mins, 0)
    setTask(t => ({ ...t, entries, total_mins }))
    onDataChanged()
  }
  function handleEntryDeleted(id) {
    const entries = task.entries.filter(e => e.id !== id)
    const total_mins = entries.reduce((s, e) => s + e.duration_mins, 0)
    setTask(t => ({ ...t, entries, total_mins }))
    onDataChanged()
  }
  function handleUpdateUpdated(updated) {
    setTask(t => ({ ...t, updates: t.updates.map(u => u.id === updated.id ? updated : u) }))
  }
  function handleUpdateDeleted(id) {
    setTask(t => ({ ...t, updates: t.updates.filter(u => u.id !== id) }))
    onDataChanged()
  }

  const hasActivity = task.entries.length > 0 || task.updates.length > 0

  return (
    <div className="rounded-xl border border-warm-150 bg-white overflow-hidden">
      {/* Task header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`flex-shrink-0 ${sm.color}`}>{sm.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {task.task_number && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ color: projectColor, backgroundColor: projectColor + '18' }}>
                #{task.task_number}
              </span>
            )}
            <span className="text-sm font-semibold text-warm-900">{task.title}</span>
          </div>
          {task.status && (
            <span className="text-[10px] text-warm-400 mt-0.5 block capitalize">{task.status.replace(/_/g, ' ')}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {task.total_mins > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"
              style={{ color: projectColor, backgroundColor: projectColor + '18' }}>
              <Timer className="w-3 h-3" />
              {fmtMins(task.total_mins)}
            </span>
          )}
          <button
            onClick={() => setShowLogForm(v => !v)}
            title="Log time"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-dashed border-warm-300 text-warm-400 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Activity */}
      {(hasActivity || showLogForm) && (
        <div className="px-4 pb-3 space-y-0.5 border-t border-warm-100 pt-2">
          {task.entries.map(entry => (
            <TimeEntryRow
              key={entry.id}
              entry={entry}
              onUpdated={handleEntryUpdated}
              onDeleted={handleEntryDeleted}
            />
          ))}
          {task.updates.map(update => (
            <UpdateRow
              key={update.id}
              update={update}
              taskId={task.id}
              onUpdated={handleUpdateUpdated}
              onDeleted={handleUpdateDeleted}
            />
          ))}
          {showLogForm && (
            <LogTimeForm
              taskId={task.id}
              date={date}
              onSaved={() => { setShowLogForm(false); onDataChanged() }}
              onCancel={() => setShowLogForm(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function WorkLog() {
  const { activeGroupId } = useWorkspace()
  const [date, setDate] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [totalMins, setTotalMins] = useState(0)

  const load = useCallback(async (d) => {
    setLoading(true)
    try {
      const params = { date: d }
      if (activeGroupId) params.group_id = activeGroupId
      const res = await timeEntriesApi.worklog(params)
      setData(res.data.data)
      setTotalMins(res.data.data?.total_mins || 0)
    } catch {
      toast.error('Failed to load work log')
    } finally {
      setLoading(false)
    }
  }, [activeGroupId])

  useEffect(() => { load(date) }, [date, load])

  function go(delta) {
    const next = shiftISO(date, delta)
    if (next <= todayISO()) setDate(next)
  }

  function recomputeTotal() {
    if (!data) return
    const total = data.projects.reduce((s, p) => s + p.tasks.reduce((ts, t) => ts + t.total_mins, 0), 0)
    setTotalMins(total)
  }

  const dateLabel = fmtDateLabel(date)
  const isToday = date === todayISO()

  // Last 7 days for quick-nav chips
  const chips = Array.from({ length: 7 }, (_, i) => {
    const iso = shiftISO(todayISO(), -i)
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })
    return { iso, label }
  })

  return (
    <div className="min-h-screen bg-warm-50/30">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-warm-900 leading-none">Work Log</h1>
              <p className="text-[11px] text-warm-400 mt-0.5">Track what you worked on each day</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(date)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-warm-400 hover:text-warm-700 hover:bg-warm-100 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (!data || data.projects.length === 0) return
                downloadText(buildTextExport(data, dateLabel), `worklog-${date}.txt`)
              }}
              disabled={!data || (data?.projects?.length === 0)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-warm-200 bg-white text-xs font-medium text-warm-600 hover:bg-warm-50 disabled:opacity-40 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* ── Date nav card ── */}
        <div className="bg-white rounded-2xl border border-warm-200 shadow-sm overflow-hidden">
          {/* Arrow nav */}
          <div className="flex items-center border-b border-warm-100 px-2 py-2">
            <button
              onClick={() => go(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-warm-400 hover:text-warm-700 hover:bg-warm-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm font-bold text-warm-900">{dateLabel}</p>
              <p className="text-[10px] text-warm-400">{date}</p>
            </div>
            <button
              onClick={() => go(1)}
              disabled={isToday}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-warm-400 hover:text-warm-700 hover:bg-warm-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick chips */}
          <div className="flex px-3 py-2.5 gap-1.5">
            {chips.map(c => (
              <button
                key={c.iso}
                onClick={() => setDate(c.iso)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  c.iso === date
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-warm-500 hover:bg-warm-100'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <span className="text-[11px] text-warm-400">Custom:</span>
            <input
              type="date"
              max={todayISO()}
              value={date}
              onChange={e => { if (e.target.value) setDate(e.target.value) }}
              className="border border-warm-200 rounded-lg px-2.5 py-1 text-xs text-warm-700 focus:outline-none focus:border-primary-400 bg-warm-50"
            />
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
            <p className="text-xs text-warm-400">Loading work log…</p>
          </div>
        ) : !data || data.projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-warm-200 shadow-sm px-6 py-14 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-warm-100 flex items-center justify-center">
              <Clock className="w-7 h-7 text-warm-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-warm-700">No activity for {dateLabel.toLowerCase()}</p>
              <p className="text-xs text-warm-400 mt-1">Log time on tasks or write task updates to see your work here.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-primary-500 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <Timer className="w-5 h-5 text-white/80" />
                <div>
                  <p className="text-[11px] text-white/60 uppercase tracking-wide font-medium">Total logged</p>
                  <p className="text-2xl font-bold text-white leading-none mt-0.5">{fmtMins(totalMins)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm font-semibold">
                  {data.projects.length} project{data.projects.length !== 1 ? 's' : ''}
                </p>
                <p className="text-white/60 text-xs">
                  {data.projects.reduce((s, p) => s + p.tasks.length, 0)} task{data.projects.reduce((s, p) => s + p.tasks.length, 0) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Projects */}
            {data.projects.map(project => {
              const color = project.project?.color || '#6366f1'
              return (
                <div key={project.project?.id || 'unknown'} className="space-y-2">
                  {/* Project label */}
                  <div className="flex items-center gap-2.5 px-1">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-bold text-warm-700 uppercase tracking-wider">
                      {project.project?.name || 'Unknown Project'}
                    </span>
                    {project.total_mins > 0 && (
                      <span className="text-xs font-semibold" style={{ color }}>
                        {fmtMins(project.total_mins)}
                      </span>
                    )}
                    <div className="flex-1 h-px" style={{ backgroundColor: color + '30' }} />
                  </div>

                  {/* Task cards */}
                  <div className="space-y-2">
                    {project.tasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        date={date}
                        projectColor={color}
                        onDataChanged={recomputeTotal}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
