import { useState, useEffect, useCallback, useRef } from 'react'
import { timeEntriesApi, taskUpdatesApi } from '../services/api'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  Clock, ChevronLeft, ChevronRight, Loader2, Download,
  Plus, Timer, FileText, RefreshCw, Check, X, Trash2,
  Pencil, CheckCircle2, Circle, AlertCircle, Sparkles,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ────────────────────────────────────────────────────
function fmtMins(mins) {
  if (!mins || mins === 0) return null
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
    return { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-green-500', bg: 'bg-green-50 text-green-700' }
  if (s.includes('progress'))
    return { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-blue-500', bg: 'bg-blue-50 text-blue-700' }
  if (s.includes('review'))
    return { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-amber-500', bg: 'bg-amber-50 text-amber-700' }
  return { icon: <Circle className="w-3.5 h-3.5" />, color: 'text-warm-300', bg: 'bg-warm-100 text-warm-500' }
}

function buildTextExport(data, dateLabel) {
  const lines = [`Work Log — ${dateLabel}`, '═'.repeat(50), `Total: ${fmtMins(data.total_mins) || '0m'}`, '']
  for (const p of data.projects) {
    lines.push(`▸ ${p.project?.name || 'Unknown'}  (${fmtMins(p.total_mins) || '—'})`)
    lines.push('─'.repeat(48))
    for (const t of p.tasks) {
      lines.push(`  ${t.task_number ? '#' + t.task_number + '  ' : ''}${t.title}  [${t.status || ''}]  ${fmtMins(t.total_mins) || '—'}`)
      for (const e of t.entries) lines.push(`    ⏱  ${fmtMins(e.duration_mins)}${e.notes ? ' — ' + e.notes : ''}`)
      for (const u of t.updates) lines.push(`    ✎  ${fmtTime(u.created_at)}  ${u.content}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Log Time inline form ──────────────────────────────────────
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
    <form onSubmit={submit} className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 mt-1">
      <Timer className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
      <input ref={ref} type="number" min="1" value={mins} onChange={e => setMins(e.target.value)}
        placeholder="mins" className="w-16 bg-white border border-primary-200 rounded px-2 py-0.5 text-xs text-warm-800 focus:outline-none focus:border-primary-400" />
      <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
        className="flex-1 bg-white border border-primary-200 rounded px-2 py-0.5 text-xs text-warm-700 focus:outline-none focus:border-primary-400" />
      <button type="submit" disabled={saving}
        className="bg-primary-500 text-white rounded px-3 py-0.5 text-xs font-medium hover:bg-primary-600 disabled:opacity-60 flex items-center gap-1">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
      </button>
      <button type="button" onClick={onCancel} className="text-warm-400 hover:text-warm-600"><X className="w-3.5 h-3.5" /></button>
    </form>
  )
}

// ── Time entry row ────────────────────────────────────────────
function TimeEntryRow({ entry, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [mins, setMins] = useState(String(entry.duration_mins))
  const [note, setNote] = useState(entry.notes || '')
  const [saving, setSaving] = useState(false)

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

  function cancel() { setMins(String(entry.duration_mins)); setNote(entry.notes || ''); setEditing(false) }

  async function remove() {
    if (!confirm('Delete this time entry?')) return
    try { await timeEntriesApi.delete(entry.id); onDeleted(entry.id); toast.success('Deleted') }
    catch { toast.error('Failed') }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 bg-primary-50 rounded-lg">
        <Timer className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
        <input autoFocus type="number" min="1" value={mins} onChange={e => setMins(e.target.value)}
          className="w-16 border border-primary-300 rounded px-1.5 py-0.5 text-xs focus:outline-none" placeholder="mins" />
        <span className="text-xs text-warm-400">min</span>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note"
          className="flex-1 border border-primary-300 rounded px-1.5 py-0.5 text-xs focus:outline-none"
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }} />
        <button onClick={save} disabled={saving} className="text-green-500 hover:text-green-600">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button onClick={cancel} className="text-warm-400 hover:text-warm-600"><X className="w-3.5 h-3.5" /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 py-1 px-1 group/te rounded hover:bg-warm-50">
      <Timer className="w-3 h-3 text-primary-400 flex-shrink-0" />
      <span className="text-xs font-semibold text-primary-600 w-10 flex-shrink-0">{fmtMins(entry.duration_mins)}</span>
      <span className="text-xs text-warm-500 flex-1 truncate">{entry.notes || <span className="italic text-warm-300">no note</span>}</span>
      <div className="opacity-0 group-hover/te:opacity-100 flex gap-1 transition-opacity">
        <button onClick={() => setEditing(true)} className="text-warm-300 hover:text-primary-500 p-0.5"><Pencil className="w-3 h-3" /></button>
        <button onClick={remove} className="text-warm-300 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  )
}

// ── Update row with AI improve ────────────────────────────────
function UpdateRow({ update, taskId, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(update.content || '')
  const [saving, setSaving] = useState(false)
  const [improving, setImproving] = useState(false)
  const ref = useRef()

  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  async function save() {
    if (!content.trim()) return toast.error('Cannot be empty')
    setSaving(true)
    try {
      await taskUpdatesApi.update(taskId, update.id, content.trim(), update.update_type)
      onUpdated({ ...update, content: content.trim() })
      setEditing(false)
      toast.success('Saved')
    } catch { toast.error('Failed to update') }
    finally { setSaving(false) }
  }

  async function aiImprove() {
    if (!content.trim()) return toast.error('Write something first')
    setImproving(true)
    try {
      const res = await taskUpdatesApi.suggestImprove(taskId, content.trim())
      const improved = res.data?.data?.suggestion || res.data?.suggestion
      if (improved) {
        setContent(improved)
        toast.success('AI improved ✨')
      } else {
        toast.error('No improvement returned')
      }
    } catch { toast.error('AI improve failed') }
    finally { setImproving(false) }
  }

  function cancel() { setContent(update.content || ''); setEditing(false) }

  async function remove() {
    if (!confirm('Delete this update?')) return
    try { await taskUpdatesApi.delete(taskId, update.id); onDeleted(update.id); toast.success('Deleted') }
    catch { toast.error('Failed') }
  }

  if (editing) {
    return (
      <div className="py-1.5 px-1 space-y-1.5">
        <textarea ref={ref} rows={2} value={content} onChange={e => setContent(e.target.value)}
          className="w-full border border-primary-300 rounded-lg px-2.5 py-1.5 text-xs text-warm-800 focus:outline-none focus:ring-1 focus:ring-primary-400 resize-none bg-primary-50/50"
          onKeyDown={e => { if (e.key === 'Escape') cancel() }}
        />
        <div className="flex items-center gap-1.5">
          <button onClick={aiImprove} disabled={improving}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 disabled:opacity-60 font-medium transition-colors">
            {improving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI Improve
          </button>
          <div className="flex-1" />
          <button onClick={cancel} className="text-xs px-2.5 py-1 rounded-lg border border-warm-200 text-warm-500 hover:bg-warm-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-60 font-medium">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 py-1 px-1 group/ur rounded hover:bg-warm-50">
      <FileText className="w-3 h-3 mt-0.5 text-warm-300 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-warm-400 mr-1.5 font-medium">{fmtTime(update.created_at)}</span>
        <span className="text-xs text-warm-700">{update.content}</span>
      </div>
      <div className="opacity-0 group-hover/ur:opacity-100 flex gap-1 transition-opacity flex-shrink-0">
        <button onClick={() => setEditing(true)} className="text-warm-300 hover:text-primary-500 p-0.5"><Pencil className="w-3 h-3" /></button>
        <button onClick={remove} className="text-warm-300 hover:text-red-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  )
}

// ── Expandable table row ──────────────────────────────────────
function TaskRow({ task: initialTask, date, projectColor, projectName, onTotalChanged }) {
  const [task, setTask] = useState(initialTask)
  const [expanded, setExpanded] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const sm = statusMeta(task.status)
  const hasActivity = task.entries.length > 0 || task.updates.length > 0
  const timeMins = task.entries.reduce((s, e) => s + e.duration_mins, 0)

  function handleEntryUpdated(updated) {
    const entries = task.entries.map(e => e.id === updated.id ? updated : e)
    const newMins = entries.reduce((s, e) => s + e.duration_mins, 0)
    setTask(t => ({ ...t, entries, total_mins: newMins }))
    onTotalChanged()
  }
  function handleEntryDeleted(id) {
    const entries = task.entries.filter(e => e.id !== id)
    const newMins = entries.reduce((s, e) => s + e.duration_mins, 0)
    setTask(t => ({ ...t, entries, total_mins: newMins }))
    onTotalChanged()
  }
  function handleUpdateUpdated(updated) {
    setTask(t => ({ ...t, updates: t.updates.map(u => u.id === updated.id ? updated : u) }))
  }
  function handleUpdateDeleted(id) {
    setTask(t => ({ ...t, updates: t.updates.filter(u => u.id !== id) }))
    onTotalChanged()
  }

  return (
    <>
      {/* Main row */}
      <tr
        onClick={() => { if (hasActivity || !showLog) setExpanded(v => !v) }}
        className="border-b border-warm-100 hover:bg-warm-50/60 cursor-pointer transition-colors group"
      >
        {/* Task */}
        <td className="py-3 pl-4 pr-3">
          <div className="flex items-center gap-2">
            {(hasActivity) && (
              <span className="text-warm-300 flex-shrink-0">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            )}
            {!hasActivity && <span className="w-3.5 flex-shrink-0" />}
            {task.task_number && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ color: projectColor, backgroundColor: projectColor + '20' }}>
                #{task.task_number}
              </span>
            )}
            <span className="text-sm font-medium text-warm-900 leading-snug">{task.title}</span>
          </div>
        </td>

        {/* Project */}
        <td className="py-3 px-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor }} />
            <span className="text-xs text-warm-600 font-medium">{projectName}</span>
          </div>
        </td>

        {/* Status */}
        <td className="py-3 px-3 whitespace-nowrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${sm.bg}`}>
            {sm.icon}
            <span className="capitalize">{(task.status || 'No status').replace(/_/g, ' ')}</span>
          </span>
        </td>

        {/* Time */}
        <td className="py-3 px-3 whitespace-nowrap">
          {timeMins > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg"
              style={{ color: projectColor, backgroundColor: projectColor + '15' }}>
              <Timer className="w-3 h-3" />
              {fmtMins(timeMins)}
            </span>
          ) : (
            <span className="text-xs text-warm-300 italic">—</span>
          )}
        </td>

        {/* Activity count */}
        <td className="py-3 px-3 whitespace-nowrap text-xs text-warm-400">
          {task.updates.length > 0 && (
            <span className="inline-flex items-center gap-1 mr-2">
              <FileText className="w-3 h-3" /> {task.updates.length}
            </span>
          )}
          {task.entries.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Timer className="w-3 h-3" /> {task.entries.length}
            </span>
          )}
          {task.updates.length === 0 && task.entries.length === 0 && <span className="italic">—</span>}
        </td>

        {/* Actions */}
        <td className="py-3 pl-3 pr-4" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => { setShowLog(v => !v); setExpanded(true) }}
            title="Log time"
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-warm-400 hover:text-primary-600 border border-dashed border-warm-300 hover:border-primary-400 rounded-lg px-2 py-1 transition-all"
          >
            <Plus className="w-3 h-3" /> Log time
          </button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (hasActivity || showLog) && (
        <tr className="bg-warm-50/40">
          <td colSpan={6} className="pb-3 pt-1 pl-14 pr-4">
            <div className="space-y-0.5">
              {task.entries.map(e => (
                <TimeEntryRow key={e.id} entry={e} onUpdated={handleEntryUpdated} onDeleted={handleEntryDeleted} />
              ))}
              {task.updates.map(u => (
                <UpdateRow key={u.id} update={u} taskId={task.id} onUpdated={handleUpdateUpdated} onDeleted={handleUpdateDeleted} />
              ))}
              {showLog && (
                <LogTimeForm
                  taskId={task.id} date={date}
                  onSaved={() => { setShowLog(false); onTotalChanged() }}
                  onCancel={() => setShowLog(false)}
                />
              )}
            </div>
          </td>
        </tr>
      )}
    </>
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
    } catch { toast.error('Failed to load work log') }
    finally { setLoading(false) }
  }, [activeGroupId])

  useEffect(() => { load(date) }, [date, load])

  function recompute() {
    if (!data) return
    const t = data.projects.reduce((s, p) => s + p.tasks.reduce((ts, tk) =>
      ts + tk.entries.reduce((es, e) => es + e.duration_mins, 0), 0), 0)
    setTotalMins(t)
  }

  function go(delta) {
    const next = shiftISO(date, delta)
    if (next <= todayISO()) setDate(next)
  }

  const dateLabel = fmtDateLabel(date)
  const isToday = date === todayISO()

  const chips = Array.from({ length: 7 }, (_, i) => {
    const iso = shiftISO(todayISO(), -i)
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday'
      : new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })
    return { iso, label }
  })

  // Flatten all tasks for the table
  const allRows = data?.projects?.flatMap(p =>
    p.tasks.map(t => ({ task: t, projectColor: p.project?.color || '#6366f1', projectName: p.project?.name || 'Unknown' }))
  ) || []

  return (
    <div className="min-h-screen bg-warm-50/30">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-warm-900 leading-none">Work Log</h1>
              <p className="text-[11px] text-warm-400 mt-0.5">What you worked on each day</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => load(date)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-warm-400 hover:text-warm-700 hover:bg-warm-100 transition-colors" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { if (data?.projects?.length) downloadText(buildTextExport(data, dateLabel), `worklog-${date}.txt`) }}
              disabled={!data?.projects?.length}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-warm-200 bg-white text-xs font-medium text-warm-600 hover:bg-warm-50 disabled:opacity-40 shadow-sm transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>

        {/* ── Date nav ── */}
        <div className="bg-white rounded-2xl border border-warm-200 shadow-sm overflow-hidden">
          <div className="flex items-center border-b border-warm-100 px-3 py-2">
            <button onClick={() => go(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg text-warm-400 hover:text-warm-700 hover:bg-warm-100 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm font-bold text-warm-900">{dateLabel}</p>
              <p className="text-[10px] text-warm-400">{date}</p>
            </div>
            <button onClick={() => go(1)} disabled={isToday}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-warm-400 hover:text-warm-700 hover:bg-warm-100 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex px-3 py-2 gap-1.5">
            {chips.map(c => (
              <button key={c.iso} onClick={() => setDate(c.iso)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${c.iso === date ? 'bg-primary-500 text-white shadow-sm' : 'text-warm-500 hover:bg-warm-100'}`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <span className="text-[11px] text-warm-400">Custom date:</span>
            <input type="date" max={todayISO()} value={date}
              onChange={e => { if (e.target.value) setDate(e.target.value) }}
              className="border border-warm-200 rounded-lg px-2.5 py-1 text-xs text-warm-700 focus:outline-none focus:border-primary-400 bg-warm-50" />
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
            <p className="text-xs text-warm-400">Loading…</p>
          </div>
        ) : allRows.length === 0 ? (
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
          <div className="space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-primary-500 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm col-span-1">
                <Timer className="w-5 h-5 text-white/70" />
                <div>
                  <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Total time</p>
                  <p className="text-xl font-bold text-white">{fmtMins(totalMins) || '0m'}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-warm-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-warm-400" />
                </div>
                <div>
                  <p className="text-[10px] text-warm-400 uppercase tracking-wider font-semibold">Updates</p>
                  <p className="text-xl font-bold text-warm-800">
                    {allRows.reduce((s, r) => s + r.task.updates.length, 0)}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-warm-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-warm-400" />
                </div>
                <div>
                  <p className="text-[10px] text-warm-400 uppercase tracking-wider font-semibold">Tasks</p>
                  <p className="text-xl font-bold text-warm-800">{allRows.length}</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-warm-200 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-warm-100 bg-warm-50">
                    <th className="text-left text-[11px] font-semibold text-warm-500 uppercase tracking-wider py-2.5 pl-4 pr-3">Task</th>
                    <th className="text-left text-[11px] font-semibold text-warm-500 uppercase tracking-wider py-2.5 px-3">Project</th>
                    <th className="text-left text-[11px] font-semibold text-warm-500 uppercase tracking-wider py-2.5 px-3">Status</th>
                    <th className="text-left text-[11px] font-semibold text-warm-500 uppercase tracking-wider py-2.5 px-3">Time</th>
                    <th className="text-left text-[11px] font-semibold text-warm-500 uppercase tracking-wider py-2.5 px-3">Activity</th>
                    <th className="py-2.5 pl-3 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {allRows.map(({ task, projectColor, projectName }) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      date={date}
                      projectColor={projectColor}
                      projectName={projectName}
                      onTotalChanged={recompute}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
