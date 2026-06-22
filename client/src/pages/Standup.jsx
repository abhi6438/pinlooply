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

// ── Single row in a project card ─────────────────────────────
function StandupRow({ rowKey, label, color, value, hasBlocker, onEdit }) {
  const isEmpty = rowKey === 'blockers' && !hasBlocker
  return (
    <div className="flex items-start gap-4 px-5 py-3 group hover:bg-gray-50 transition-colors rounded-lg mx-1">
      <span className={`text-[11px] font-bold uppercase tracking-widest ${color} w-20 flex-shrink-0 mt-0.5`}>
        {label}
      </span>
      <p className={`flex-1 text-sm leading-relaxed ${isEmpty ? 'text-gray-300 italic' : 'text-gray-700'}`}>
        {value}
      </p>
      <button
        onClick={onEdit}
        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 flex-shrink-0 mt-0.5"
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
    { key: 'today',     label: 'Today',     color: 'text-indigo-600'  },
    { key: 'blockers',  label: 'Blockers',  color: hasBlocker ? 'text-orange-600' : 'text-gray-300' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Hash className="w-3.5 h-3.5 text-indigo-500" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900 flex-1">{project.project_name}</h3>
        {hasBlocker && (
          <span className="flex items-center gap-1 text-[11px] text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
            <AlertCircle className="w-3 h-3" /> Blocker
          </span>
        )}
        <span className="text-gray-400">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </div>

      {!collapsed && (
        <div className="border-t border-gray-100 py-2 space-y-0.5">
          {rows.map(({ key, label, color }) => (
            editing === key ? (
              <div key={key} className="px-5 py-3">
                <span className={`block text-[11px] font-bold uppercase tracking-widest ${color} mb-1.5`}>{label}</span>
                <textarea
                  autoFocus
                  value={draft[key]}
                  onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-indigo-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none bg-white"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => save(key)}
                    className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium">
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button onClick={cancelEdit}
                    className="text-xs text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-gray-100">
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

// ── Right-side panel ──────────────────────────────────────────
function StandupPanel({ standup, projects, loading, copied, onCopy, onRegenerate }) {
  const hasBlockers = projects.some(p => p.blockers && p.blockers.toLowerCase() !== 'none')

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {standup && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Hash,     value: standup.meta?.projectCount || 0,    label: 'Projects' },
            { icon: CheckCheck, value: standup.meta?.recentDoneCount || 0, label: 'Done' },
            { icon: Clock,    value: standup.meta?.pendingCount || 0,    label: 'Pending' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI Summary */}
      {standup?.summary && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1.5">AI Summary</p>
          <p className="text-sm text-indigo-900 leading-relaxed">{standup.summary}</p>
        </div>
      )}

      {/* Blocker warning */}
      {hasBlockers && (
        <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-800 leading-relaxed">You have blockers — make sure to address them with your team.</p>
        </div>
      )}

      {/* Copy button */}
      {standup && (
        <button
          onClick={onCopy}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm ${
            copied ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
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
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Regenerate
        </button>
      )}

      {/* Plain text preview */}
      {standup && projects.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <p className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
            Plain Text Preview
          </p>
          <pre className="px-4 py-4 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
            {formatAsText(projects, standup?.summary)}
          </pre>
        </div>
      )}

      {/* Generation time */}
      {standup?.meta?.generatedAt && (
        <p className="text-center text-xs text-gray-400">
          Generated at {format(new Date(standup.meta.generatedAt), 'h:mm a')}
        </p>
      )}
    </div>
  )
}

// ── Empty / initial state ─────────────────────────────────────
function EmptyState({ onGenerate, loading }) {
  return (
    <div className="col-span-2 flex flex-col items-center justify-center py-24 text-center">
      <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
        <ClipboardList className="w-10 h-10 text-indigo-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Daily Standup</h2>
      <p className="text-sm text-gray-500 mb-8 max-w-sm leading-relaxed">
        AI will analyze your recent completed tasks and pending work to generate a ready-to-share standup update.
      </p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center gap-2.5 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-md"
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Standup</h1>
          <div className="flex items-center gap-1.5 mt-0.5 text-sm text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(new Date(), 'EEEE, MMMM d')}</span>
          </div>
        </div>
        {!standup && (
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Zap className="w-4 h-4" /> Generate</>
            }
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Left — project cards (2/3 width) */}
        <div className="lg:col-span-2">
          {!standup && !loading ? (
            <EmptyState onGenerate={generate} loading={loading} />
          ) : loading && !standup ? (
            <div className="flex flex-col items-center justify-center h-full py-24">
              <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
              <p className="text-sm text-gray-500">AI is analyzing your tasks…</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-24 bg-white rounded-2xl border border-gray-200">
              <FolderOpen className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-sm text-gray-500 mb-1 font-medium">No project activity found</p>
              <p className="text-xs text-gray-400">Log discussions or add tasks to generate a standup</p>
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
