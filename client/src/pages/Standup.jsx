import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { standupApi } from '../services/api'
import {
  Zap, Copy, RefreshCw, Check, Loader2, ChevronDown,
  ChevronUp, Pencil, CheckCheck, AlertCircle, FolderOpen,
  ClipboardList,
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

// ── Single project standup card ───────────────────────────────
function ProjectCard({ project, index, onChange }) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing]     = useState(null) // 'yesterday'|'today'|'blockers'|null
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

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gray-50 border-b border-gray-100">
        <span className="text-lg">📋</span>
        <h3 className="text-sm font-semibold text-gray-900 flex-1">{project.project_name}</h3>
        {hasBlocker && (
          <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3" /> Blocker
          </span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="divide-y divide-gray-100">
          {[
            { key: 'yesterday', label: '✅ Yesterday', color: 'text-green-700' },
            { key: 'today',     label: '🎯 Today',     color: 'text-blue-700' },
            { key: 'blockers',  label: '🚧 Blockers',  color: hasBlocker ? 'text-orange-700' : 'text-gray-500' },
          ].map(({ key, label, color }) => (
            <div key={key} className="px-5 py-3 group">
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wide ${color} w-24 flex-shrink-0 mt-0.5`}>
                  {label}
                </span>
                {editing === key ? (
                  <div className="flex-1 space-y-1.5">
                    <textarea
                      autoFocus
                      value={draft[key]}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                      rows={2}
                      className="w-full text-sm border border-indigo-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => save(key)}
                        className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded hover:bg-indigo-700">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button onClick={cancelEdit}
                        className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-start gap-2">
                    <p className={`text-sm leading-relaxed flex-1 ${
                      key === 'blockers' && !hasBlocker ? 'text-gray-400 italic' : 'text-gray-700'
                    }`}>
                      {project[key]}
                    </p>
                    <button
                      onClick={() => { setDraft({ ...project }); setEditing(key) }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 flex-shrink-0"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Empty / initial state ─────────────────────────────────────
function EmptyState({ onGenerate, loading }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
        <ClipboardList className="w-8 h-8 text-indigo-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Daily Standup</h2>
      <p className="text-sm text-gray-500 mb-8 max-w-sm">
        Pinlooply AI will analyze your recent completed tasks and pending work to generate a ready-to-share standup.
      </p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="flex items-center gap-2.5 bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm"
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
  const [standup, setStandup]     = useState(null)   // null = not generated yet
  const [loading, setLoading]     = useState(false)
  const [copied, setCopied]       = useState(false)
  const [projects, setProjects]   = useState([])

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
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback for non-https
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      toast.success('Copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    }
  }

  function updateProject(index, updated) {
    setProjects(ps => ps.map((p, i) => i === index ? updated : p))
  }

  const hasBlockers = projects.some(p => p.blockers && p.blockers.toLowerCase() !== 'none')

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Standup</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {standup
              ? `Generated ${format(new Date(standup.meta?.generatedAt || Date.now()), 'h:mm a')} · ${standup.meta?.projectCount || 0} projects`
              : format(new Date(), 'EEEE, MMMM d')
            }
          </p>
        </div>
        {standup && (
          <div className="flex items-center gap-2">
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg font-medium transition-all ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {copied ? <><CheckCheck className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
            </button>
          </div>
        )}
      </div>

      {/* Blocker alert */}
      {standup && hasBlockers && (
        <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-5 text-sm text-orange-800">
          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span>You have blockers in your standup — make sure to address them.</span>
        </div>
      )}

      {/* Overall summary */}
      {standup?.summary && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm text-indigo-800 font-medium">{standup.summary}</p>
          <p className="text-xs text-indigo-500 mt-0.5">
            Based on {standup.meta?.recentDoneCount || 0} completed + {standup.meta?.pendingCount || 0} pending tasks
          </p>
        </div>
      )}

      {/* Content */}
      {!standup && !loading ? (
        <EmptyState onGenerate={generate} loading={loading} />
      ) : loading && !standup ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
          <p className="text-sm text-gray-500">AI is analyzing your tasks…</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FolderOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-1">No project activity found</p>
          <p className="text-xs text-gray-400">Log discussions or add tasks to generate a standup</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p, i) => (
            <ProjectCard key={i} project={p} index={i} onChange={updateProject} />
          ))}

          {/* Plain-text preview */}
          <details className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
            <summary className="px-5 py-3 cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900 select-none">
              Preview plain text
            </summary>
            <pre className="px-5 py-4 text-xs text-gray-600 font-mono whitespace-pre-wrap border-t border-gray-200 bg-white">
              {formatAsText(projects, standup?.summary)}
            </pre>
          </details>

          {/* Bottom copy button */}
          <button
            onClick={copyToClipboard}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              copied ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {copied ? <><CheckCheck className="w-4 h-4" /> Copied to Clipboard!</> : <><Copy className="w-4 h-4" /> Copy Standup to Clipboard</>}
          </button>
        </div>
      )}
    </div>
  )
}
