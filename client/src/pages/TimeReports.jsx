import { useState, useEffect } from 'react'
import { timeEntriesApi, projectsApi } from '../services/api'
import { Timer, Download, ChevronDown, ChevronUp, Loader2, BarChart3, FolderOpen, User } from 'lucide-react'
import toast from 'react-hot-toast'

function fmtMins(mins) {
  if (!mins) return '0m'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function fmtHours(mins) {
  return (mins / 60).toFixed(1) + 'h'
}

// ── Progress bar ──────────────────────────────────────────────
function Bar({ value, max, color = 'bg-primary-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full h-2 bg-warm-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Project row ───────────────────────────────────────────────
function ProjectRow({ item, maxMins }) {
  const [expanded, setExpanded] = useState(false)
  const color = item.project?.color || '#6366f1'

  return (
    <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-warm-50 transition-colors text-left"
      >
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-warm-900 truncate">{item.project?.name || 'Unknown project'}</p>
          <div className="mt-1.5 w-full max-w-xs">
            <Bar value={item.total_mins} max={maxMins} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-warm-900">{fmtMins(item.total_mins)}</p>
          <p className="text-xs text-warm-400">{item.task_count} task{item.task_count !== 1 ? 's' : ''}</p>
        </div>
        <div className="text-warm-400 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
    </div>
  )
}

// ── Export CSV helper ─────────────────────────────────────────
function exportCSV(entries) {
  const header = 'Date,Task,Project,Minutes,Hours,Notes'
  const rows = entries.map(e => [
    e.logged_at,
    `"${(e.task?.title || '').replace(/"/g, '""')}"`,
    `"${(e.task?.projects?.name || '').replace(/"/g, '""')}"`,
    e.duration_mins,
    (e.duration_mins / 60).toFixed(2),
    `"${(e.notes || '').replace(/"/g, '""')}"`,
  ].join(','))
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'time-report.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ── Main page ─────────────────────────────────────────────────
export default function TimeReports() {
  const [report,   setReport]   = useState(null)
  const [entries,  setEntries]  = useState([])
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [projectId, setProjectId] = useState('')
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState('by_project') // by_project | by_task | log

  useEffect(() => {
    projectsApi.list()
      .then(r => setProjects(r.data.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = { from, to }
    if (projectId) params.project_id = projectId

    Promise.all([
      timeEntriesApi.report(params),
      timeEntriesApi.list({ ...params }),
    ])
      .then(([rpt, ent]) => {
        setReport(rpt.data.data)
        setEntries(ent.data.data || [])
      })
      .catch(() => toast.error('Failed to load time report'))
      .finally(() => setLoading(false))
  }, [from, to, projectId])

  const maxProjMins = report?.by_project?.[0]?.total_mins || 1
  const maxTaskMins = report?.by_task?.[0]?.total_mins || 1

  return (
    <div className="min-h-screen bg-warm-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-warm-900 flex items-center gap-2">
            <Timer className="w-6 h-6 text-primary-500" />
            Time Reports
          </h1>
          <p className="text-sm text-warm-500 mt-0.5">Track time logged across projects and tasks.</p>
        </div>
        <button
          onClick={() => exportCSV(entries)}
          disabled={!entries.length}
          className="btn btn-sm border border-warm-200 text-warm-600 hover:bg-warm-100 disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-white border border-warm-200 rounded-xl px-5 py-4">
        <div>
          <label className="label">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Project</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="input">
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-warm-400" />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total time',    value: fmtMins(report?.total_mins),          icon: Timer,      color: 'text-primary-600' },
              { label: 'Hours logged',  value: fmtHours(report?.total_mins || 0),     icon: BarChart3,  color: 'text-blue-600'    },
              { label: 'Projects',      value: report?.by_project?.length || 0,        icon: FolderOpen, color: 'text-violet-600'  },
              { label: 'Tasks tracked', value: report?.by_task?.length || 0,           icon: User,       color: 'text-green-600'   },
            ].map(s => (
              <div key={s.label} className="bg-white border border-warm-200 rounded-xl px-5 py-4 flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
                <div>
                  <p className="text-lg font-bold text-warm-900">{s.value}</p>
                  <p className="text-xs text-warm-500">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-warm-100 p-1 rounded-xl w-fit">
            {[
              { key: 'by_project', label: 'By project' },
              { key: 'by_task',    label: 'By task'    },
              { key: 'log',        label: 'Entry log'  },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key ? 'bg-white text-primary-700 shadow-sm font-semibold' : 'text-warm-500 hover:text-warm-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* By project */}
          {tab === 'by_project' && (
            <div className="space-y-3">
              {report?.by_project?.length ? report.by_project.map(item => (
                <ProjectRow key={item.project_id} item={item} maxMins={maxProjMins} />
              )) : (
                <div className="text-center py-12 text-warm-400 text-sm">No time logged in this period.</div>
              )}
            </div>
          )}

          {/* By task */}
          {tab === 'by_task' && (
            <div className="bg-white border border-warm-200 rounded-xl overflow-hidden">
              {report?.by_task?.length ? (
                <table className="w-full text-sm">
                  <thead className="bg-warm-50 border-b border-warm-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-warm-500 uppercase">Task</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-warm-500 uppercase">Project</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-warm-500 uppercase">Time</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-warm-500 uppercase w-40">
                        <span className="sr-only">Bar</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-100">
                    {report.by_task.map(item => {
                      const entry = entries.find(e => e.task_id === item.task_id)
                      return (
                        <tr key={item.task_id} className="hover:bg-warm-50 transition-colors">
                          <td className="px-5 py-3 font-medium text-warm-900 truncate max-w-xs">{item.title}</td>
                          <td className="px-5 py-3 text-warm-500 text-xs">{entry?.task?.projects?.name || '—'}</td>
                          <td className="px-5 py-3 text-right font-semibold text-warm-800">{fmtMins(item.total_mins)}</td>
                          <td className="px-5 py-3 w-40">
                            <Bar value={item.total_mins} max={maxTaskMins} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-warm-400 text-sm">No time logged in this period.</div>
              )}
            </div>
          )}

          {/* Entry log */}
          {tab === 'log' && (
            <div className="bg-white border border-warm-200 rounded-xl overflow-hidden">
              {entries.length ? (
                <table className="w-full text-sm">
                  <thead className="bg-warm-50 border-b border-warm-200">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-warm-500 uppercase">Date</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-warm-500 uppercase">Task</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-warm-500 uppercase">Notes</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-warm-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-100">
                    {entries.map(entry => (
                      <tr key={entry.id} className="hover:bg-warm-50 transition-colors">
                        <td className="px-5 py-3 text-warm-500 text-xs whitespace-nowrap">{entry.logged_at}</td>
                        <td className="px-5 py-3 font-medium text-warm-900 truncate max-w-xs">{entry.task?.title || '—'}</td>
                        <td className="px-5 py-3 text-warm-500 text-xs truncate max-w-xs">{entry.notes || '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold text-warm-800 whitespace-nowrap">{fmtMins(entry.duration_mins)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-warm-400 text-sm">No entries in this period.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
