import { useState, useEffect } from 'react'
import { standupApi } from '../services/api'
import { useWorkspace } from '../context/WorkspaceContext'
import {
  Copy, RefreshCw, Loader2, ChevronDown,
  ChevronUp, CheckCheck, AlertCircle, FolderOpen,
  Calendar, Hash, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

// ── Normalize field: string or array → array ──────────────────
function toArr(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed || trimmed.toLowerCase() === 'none') return []
    return [trimmed]
  }
  return []
}

// ── Format standup as plain text (for clipboard) ──────────────
function formatAsText(projects, summary) {
  const date = format(new Date(), 'EEEE, MMMM d')
  let out = `Daily Standup — ${date}\n\n`
  for (const p of projects) {
    out += `📋 ${p.project_name}${p.focus ? ` · ${p.focus}` : ''}\n`
    const y = toArr(p.yesterday)
    out += `  Yesterday:\n${y.length ? y.map(t => `    ✓ ${t}`).join('\n') : '    – Nothing completed'}\n`
    const t = toArr(p.today)
    out += `  Today:\n${t.length ? t.map(t => `    → ${t}`).join('\n') : '    – Nothing planned'}\n`
    const b = toArr(p.blockers)
    out += `  Blockers: ${b.length ? b.join(', ') : 'None'}\n\n`
  }
  if (summary) out += `Summary: ${summary}`
  return out.trim()
}

// ── Task list section inside a card ──────────────────────────
function TaskSection({ label, items, emptyText, icon, labelColor, itemStyle }) {
  return (
    <div className="px-5 py-3">
      <p className={`text-[11px] font-bold uppercase tracking-widest ${labelColor} mb-2 flex items-center gap-1.5`}>
        <span>{icon}</span>{label}
        {items.length > 0 && <span className="font-normal opacity-50">({items.length})</span>}
      </p>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className={`flex items-start gap-2 text-sm ${itemStyle}`}>
              <span className="flex-shrink-0 mt-0.5">{icon === '✓' ? '✓' : '→'}</span>
              <span className="leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-warm-300 italic">{emptyText}</p>
      )}
    </div>
  )
}

// ── Single project standup card ───────────────────────────────
function ProjectCard({ project, index, onChange }) {
  const [collapsed, setCollapsed] = useState(false)

  const yesterday = toArr(project.yesterday)
  const today     = toArr(project.today)
  const blockers  = toArr(project.blockers)
  const hasBlocker = blockers.length > 0

  return (
    <div className={`card overflow-hidden ${hasBlocker ? 'border-l-4 border-red-400' : 'border-l-4 border-emerald-400'}`}>
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none hover:bg-warm-50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
          <Hash className="w-3.5 h-3.5 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-warm-900">{project.project_name}</h3>
          {project.focus && (
            <p className="text-xs text-warm-400 mt-0.5 truncate">{project.focus}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {today.length > 0 && (
            <span className="text-[11px] bg-primary-50 text-primary-700 border border-primary-100 px-2 py-0.5 rounded-full font-medium">
              {today.length} today
            </span>
          )}
          {hasBlocker && (
            <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              <AlertCircle className="w-3 h-3" /> {blockers.length} blocker{blockers.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-warm-400">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-warm-100 divide-y divide-warm-50">

          {/* Yesterday */}
          <div className="px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-2">✓ Yesterday</p>
            {yesterday.length > 0 ? (
              <ul className="space-y-1.5">
                {yesterday.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-warm-700">
                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5 font-bold">✓</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-warm-300 italic">Nothing completed recently</p>
            )}
          </div>

          {/* Today */}
          <div className="px-5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary-600 mb-2">→ Today</p>
            {today.length > 0 ? (
              <ul className="space-y-1.5">
                {today.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-warm-900">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0 mt-2" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-warm-300 italic">Nothing planned</p>
            )}
          </div>

          {/* Blockers */}
          <div className="px-5 py-3">
            <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${hasBlocker ? 'text-amber-600' : 'text-warm-300'}`}>
              ⚠ Blockers
            </p>
            {hasBlocker ? (
              <ul className="space-y-1.5">
                {blockers.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                    <span className="w-4 h-4 rounded bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 text-[10px] mt-0.5">!</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-emerald-500 font-medium">No blockers 🎉</p>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Right-side summary panel ──────────────────────────────────
function StandupPanel({ standup, projects, loading, copied, onCopy, onRegenerate }) {
  const hasBlockers = projects.some(p => toArr(p.blockers).length > 0)

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
              <p className="text-lg font-semibold text-warm-900">{value}</p>
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

// ── Hero card shown before first generation ───────────────────
function GenerateHero({ onGenerate }) {
  return (
    <div className="flex-1 flex items-center justify-center py-8">
      <div className="max-w-lg w-full space-y-4">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-5">
            <ClipboardList className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-warm-900 mb-2">Ready for today's standup?</h2>
          <p className="text-xs text-warm-400 leading-relaxed mb-6">
            AI will scan your recent tasks and discussions across all projects to generate a ready-to-share update.
          </p>
          <button
            onClick={onGenerate}
            className="btn-primary btn-lg flex items-center gap-2 mx-auto"
          >
            <Zap className="w-4 h-4" /> Generate My Standup
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { emoji: '📋', label: 'Scans tasks', desc: 'Completed & pending across projects' },
            { emoji: '🤖', label: 'AI drafts', desc: 'Yesterday, today & blockers per project' },
            { emoji: '✏️', label: 'You edit', desc: 'Inline editing before you share' },
          ].map(({ emoji, label, desc }) => (
            <div key={label} className="card p-4 text-center">
              <div className="text-2xl mb-2">{emoji}</div>
              <p className="text-xs font-semibold text-warm-700 mb-0.5">{label}</p>
              <p className="text-[11px] text-warm-400 leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Animated generating state ─────────────────────────────────
const STEPS = [
  'Scanning recent tasks…',
  'Checking completed work…',
  'Identifying blockers…',
  'Drafting standup…',
  'Almost done…',
]

function GeneratingState() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 900)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center py-8">
      <div className="max-w-sm w-full card p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-5">
          <Loader2 className="w-7 h-7 text-primary-600 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-warm-900 mb-1">Generating your standup</h3>
        <p className="text-sm text-warm-400 mb-6">{STEPS[step]}</p>
        <div className="space-y-2 text-left">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex items-center gap-2.5 text-xs px-3 py-1.5 rounded-lg transition-all ${
              i < step    ? 'text-emerald-600 bg-emerald-50'
              : i === step ? 'text-primary-700 bg-primary-50 font-medium'
              : 'text-warm-300'
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                i < step    ? 'bg-emerald-100 text-emerald-600'
                : i === step ? 'bg-primary-200 text-primary-700'
                : 'bg-warm-100 text-warm-300'
              }`}>
                {i < step ? '✓' : i + 1}
              </span>
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Standup() {
  const { activeGroupId } = useWorkspace()
  const [standup, setStandup]   = useState(null)
  const [loading, setLoading]   = useState(true)   // start loading immediately
  const [failed,  setFailed]    = useState(false)
  const [copied, setCopied]     = useState(false)
  const [projects, setProjects] = useState([])

  async function generate() {
    setLoading(true)
    setFailed(false)
    try {
      const res = await standupApi.generate({ group_id: activeGroupId || 'personal' })
      const data = res.data.data
      setStandup(data)
      setProjects(data.projects || [])
      if (!data.projects?.length) {
        toast('No recent activity found. Log some discussions first!', { icon: '💡' })
      }
    } catch (err) {
      setFailed(true)
      toast.error(err.response?.data?.error || 'Failed to generate standup')
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate on mount and when workspace changes
  useEffect(() => { generate() }, [activeGroupId]) // eslint-disable-line

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
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-warm-900">Daily Standup</h1>
          <span className="badge badge-purple">AI</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-warm-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(new Date(), 'EEEE, MMMM d')}</span>
          </div>
          {!loading && (
            <button onClick={generate} className="btn-ghost btn-sm flex items-center gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Full-width states: generating / error / data */}
      {loading ? (
        <GeneratingState />
      ) : failed ? (
        /* Error / retry state */
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="max-w-sm w-full card p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-warm-900 mb-1">Couldn't generate standup</h3>
            <p className="text-sm text-warm-400 mb-6">There was a problem reaching the AI. You can try again or check back later.</p>
            <button onClick={generate} className="btn-primary flex items-center gap-2 mx-auto">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        </div>
      ) : (
        /* Two-column layout — only when standup data exists */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0 overflow-hidden">
          {/* Left — project cards */}
          <div className="lg:col-span-2 overflow-y-auto pr-1">
            {projects.length === 0 ? (
              <div className="card p-10 text-center">
                <FolderOpen className="w-10 h-10 text-warm-200 mb-3 mx-auto" />
                <p className="text-sm font-medium text-warm-500 mb-1">No project activity found</p>
                <p className="text-xs text-warm-400">Log discussions or add tasks to generate a standup</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((p, i) => (
                  <ProjectCard key={i} project={p} index={i} onChange={updateProject} />
                ))}
              </div>
            )}
          </div>

          {/* Right — summary panel */}
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
        </div>
      )}
    </div>
  )
}
