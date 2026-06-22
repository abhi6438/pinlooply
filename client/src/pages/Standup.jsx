import { useState } from 'react'
import { standupApi } from '../services/api'
import {
  Zap, Copy, RefreshCw, Check, Loader2, ChevronDown,
  ChevronUp, Pencil, CheckCheck, AlertCircle, FolderOpen,
  ClipboardList, Calendar, Hash, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// ── Format standup as plain text (for clipboard) ──────────────
function formatAsText(projects, summary) {
  const date = format(new Date(), 'EEEE, MMMM d')
  let out = `Daily Standup — ${date}\n\n`
  for (const p of projects) {
    out += `📋 ${p.project_name}\n`
    out += `  Yesterday: ${p.yesterday}\n`
    out += `  Today: ${p.today}\n`
    out += `  Blockers: ${p.blockers}\n\n`
  }
  if (summary) out += `Summary: ${summary}`
  return out.trim()
}

// ── Health color helper ───────────────────────────────────────
function healthBorder(project) {
  const hasBlocker = project.blockers && project.blockers.toLowerCase() !== 'none'
  if (hasBlocker) return 'border-l-4 border-red-500'
  return 'border-l-4 border-emerald-500'
}

// ── Single row in a project card ─────────────────────────────
function StandupRow({ rowKey, label, color, value, hasBlocker, onEdit }) {
  const isEmpty = rowKey === 'blockers' && !hasBlocker
  return (
    <div className="flex items-start gap-4 px-5 py-3 group hover:bg-warm-50 transition-colors rounded-lg mx-1">
      <span className={`text-[11px] font-bold uppercase tracking-widest ${color} w-20 flex-shrink-0 mt-0.5`}>
        {label}
      </span>
      <p className={`flex-1 text-sm leading-relaxed ${isEmpty ? 'text-warm-200 italic' : 'text-warm-900'}`}>
        {value}
      </p>
      <button
        onClick={onEdit}
        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-warm-400 hover:text-primary-600 hover:bg-primary-50 flex-shrink-0 mt-0.5"
        title="Edit"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Single project standup card ───────────────────────────────
function ProjectCard({ project, index, onChange }) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [draft, setDraft]         = useState({ ...project })

  function save(field) {
    onChange(index, { ...project, [field]: draft[field] })
    setEditing(null)
  }
  function cancelEdit() {
    setDraft({ ...project })
    setEditing(null)
  }

  const hasBlocker = project.blockers && project.blockers.toLowerCase() !== 'none'

  const rows = [
    { key: 'yesterday', label: 'Yesterday', color: 'text-emerald-600' },
    { key: 'today',     label: 'Today',     color: 'text-primary-600' },
    { key: 'blockers',  label: 'Blockers',  color: hasBlocker ? 'text-amber-600' : 'text-warm-300' },
  ]

  return (
    <div className={`card overflow-hidden ${healthBorder(project)}`}>
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none hover:bg-warm-50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Hash className="w-3.5 h-3.5 text-primary-600" />
        </div>
        <h3 className="text-sm font-semibold text-warm-900 flex-1">{project.project_name}</h3>
        {hasBlocker && (
          <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            <AlertCircle className="w-3 h-3" /> Blocker
          </span>
        )}
        <span className="text-warm-400">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </div>

      {!collapsed && (
        <div className="border-t border-warm-100 py-2 space-y-0.5">
          {rows.map(({ key, label, color }) => (
            editing === key ? (
              <div key={key} className="px-5 py-3">
                <span className={`block text-[11px] font-bold uppercase tracking-widest ${color} mb-1.5`}>{label}</span>
                <textarea
                  autoFocus
                  value={draft[key]}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  rows={3}
                  className="input resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => save(key)}
                    className="btn-primary btn-sm flex items-center gap-1">
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button onClick={cancelEdit}
                    className="btn-ghost btn-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <StandupRow
                key={key}
                rowKey={key}
                label={label}
                color={color}
                value={project[key]}
                hasBlocker={hasBlocker}
                onEdit={() => { setDraft({ ...project }); setEditing(key) }}
              />
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ── Right-side summary panel ──────────────────────────────────
function StandupPanel({ standup, projects, loading, copied, onCopy, onRegenerate }) {
  const hasBlockers = projects.some(p => p.blockers && p.blockers.toLowerCase() !== 'none')

  return (
    <div className="card bg-primary-50 border-primary-200 space-y-4 p-5">
      <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">Summary Panel</p>

      {/* Stats row */}
      {standup && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Hash,       value: standup.meta?.projectCount || 0,    label: 'Projects' },
            { icon: CheckCheck, value: standup.meta?.recentDoneCount || 0, label: 'Done' },
            { icon: Clock,      value: standup.meta?.pendingCount || 0,    label: 'Pending' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="bg-white rounded-xl p-3 text-center border border-primary-100">
              <p className="text-xl font-bold text-warm-900">{value}</p>
              <p className="text-[11px] text-warm-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Summary */}
      {standup?.summary && (
        <div>
          <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1.5">AI Summary</p>
          <p className="text-sm text-primary-900 leading-relaxed">{standup.summary}</p>
        </div>
      )}

      {/* Blocker warning */}
      {hasBlockers && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">You have blockers — make sure to address them with your team.</p>
        </div>
      )}

      {/* Copy button */}
      {standup && (
        <button
          onClick={onCopy}
          className={`btn-secondary w-full flex items-center justify-center gap-2 ${
            copied ? '!bg-emerald-600 !text-white !border-emerald-600' : ''
          }`}
        >
          {copied
            ? <><CheckCheck className="w-4 h-4" /> Copied!</>
            : <><Copy className="w-4 h-4" /> Copy to Clipboard</>
          }
        </button>
      )}

      {/* Regenerate */}
      {standup && (
        <button
          onClick={onRegenerate}
          disabled={loading}
          className="btn-ghost w-full flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      )}

      {/* Plain text preview */}
      {standup && projects.length > 0 && (
        <div className="bg-white border border-primary-100 rounded-xl overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wide border-b border-warm-100">
            Plain Text Preview
          </p>
          <pre className="px-4 py-3 text-xs text-warm-500 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
            {formatAsText(projects, standup?.summary)}
          </pre>
        </div>
      )}

      {/* Generation time */}
      {standup?.meta?.generatedAt && (
        <p className="text-center text-xs text-warm-400">
          Generated at {format(new Date(standup.meta.generatedAt), 'h:mm a')}
        </p>
      )}
    </div>
  )
}

// ── Loading state ─────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24">
      <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
      </div>
      <p className="text-sm text-warm-500">AI is analyzing your tasks…</p>
    </div>
  )
}

// ── Empty / initial state ─────────────────────────────────────
function EmptyState({ onGenerate, loading }) {
  return (
    <div className="empty-state">
      <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4 mx-auto">
        <ClipboardList className="w-8 h-8 text-primary-600" />
      </div>
      <h3 className="text-lg font-semibold text-warm-900 mb-2">No standup yet</h3>
      <p className="text-sm text-warm-500 mb-6 max-w-sm">
        AI will analyze your recent tasks and pending work to generate a ready-to-share standup update.
      </p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="btn-primary btn-lg flex items-center gap-2 mx-auto"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
          : <><Zap className="w-4 h-4" /> Generate My Standup</>
        }
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Standup() {
  const [standup, setStandup]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [copied, setCopied]     = useState(false)
  const [projects, setProjects] = useState([])

  async function generate() {
    setLoading(true)
    try {
      const res = await standupApi.generate()
      const data = res.data.data
      setStandup(data)
      setProjects(data.projects || [])
      if (!data.projects?.length) {
        toast('No recent activity found. Log some discussions first!', { icon: '💡' })
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate standup')
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard() {
    const text = formatAsText(projects, standup?.summary)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2500)
  }

  function updateProject(index, updated) {
    setProjects(ps => ps.map((p, i) => i === index ? updated : p))
  }

  return (
    <div className="h-full flex flex-col px-6 py-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-warm-900">Daily Standup 📋</h1>
          <span className="badge badge-purple">AI-Generated</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-warm-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{format(new Date(), 'EEEE, MMMM d')}</span>
        </div>
      </div>

      {/* Generate button when no standup yet */}
      {!standup && !loading && (
        <div className="mb-6">
          <button
            onClick={generate}
            disabled={loading}
            className="btn-primary btn-lg flex items-center gap-2"
          >
            <Zap className="w-4 h-4" /> Generate Standup
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Left — project cards (2/3 width) */}
        <div className="lg:col-span-2">
          {!standup && !loading ? (
            <EmptyState onGenerate={generate} loading={loading} />
          ) : loading && !standup ? (
            <LoadingState />
          ) : projects.length === 0 ? (
            <div className="empty-state card">
              <FolderOpen className="w-10 h-10 text-warm-200 mb-3 mx-auto" />
              <p className="text-sm text-warm-500 mb-1 font-medium">No project activity found</p>
              <p className="text-xs text-warm-400">Log discussions or add tasks to generate a standup</p>
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto pr-1">
              {projects.map((p, i) => (
                <ProjectCard key={i} project={p} index={i} onChange={updateProject} />
              ))}
            </div>
          )}
        </div>

        {/* Right — summary panel (1/3 width) */}
        {(standup || loading) && (
          <div className="lg:col-span-1 overflow-y-auto">
            <StandupPanel
              standup={standup}
              projects={projects}
              loading={loading}
              copied={copied}
              onCopy={copyToClipboard}
              onRegenerate={generate}
            />
          </div>
        )}
      </div>
    </div>
  )
}
