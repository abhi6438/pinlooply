import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { projectsApi, topicsApi, tasksApi, timelineApi, discussionsApi, publishApi } from '../services/api'
import { useProjectStore } from '../stores/useProjectStore'
import {
  ArrowLeft, FolderOpen, CheckSquare2, Tag, AlertTriangle,
  Users, Settings, LayoutDashboard, Clock, Loader2,
  MessageSquare, Zap, Archive, Globe, Copy, CheckCheck, EyeOff, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, SectionTabs, PageLoader } from '../components/ui'

// ── Confirm Modal ─────────────────────────────────────────────────
function ConfirmModal({ icon: Icon = Trash2, iconBg = 'bg-red-50', iconColor = 'text-red-500', title, message, confirmLabel = 'Confirm', confirmClass = 'bg-red-500 text-white hover:bg-red-600 border-red-500', onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <h3 className="text-base font-semibold text-warm-900 text-center mb-1">{title}</h3>
        {message && <p className="text-sm text-warm-500 text-center mb-6">{message}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 btn border ${confirmClass}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Health config ─────────────────────────────────────────────────
const HEALTH = {
  good:    { label: 'Good',    dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50'  },
  at_risk: { label: 'At Risk', dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  behind:  { label: 'Behind',  dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50'    },
}

const TABS = [
  { key: 'overview',  label: 'Overview',  Icon: LayoutDashboard },
  { key: 'topics',    label: 'Topics',    Icon: Tag             },
  { key: 'tasks',     label: 'Tasks',     Icon: CheckSquare2    },
  { key: 'timeline',  label: 'Timeline',  Icon: Clock           },
  { key: 'members',   label: 'Members',   Icon: Users           },
  { key: 'settings',  label: 'Settings',  Icon: Settings        },
]

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso)
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = '#6366f1' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + '22' }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-xs text-warm-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-warm-900">{value}</p>
      {sub && <p className="text-xs text-warm-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────
function OverviewTab({ projectId, stats, project }) {
  const navigate = useNavigate()
  const [quickText, setQuickText] = useState('')
  const [logging,   setLogging]   = useState(false)

  const recentActivity = [
    ...(stats.recent_discussions || []).map(d => ({
      type: 'discussion', text: d.ai_summary || d.raw_text?.slice(0, 80) || 'Discussion logged',
      time: d.created_at, user: d.users?.name,
    })),
    ...(stats.high_priority_tasks || []).slice(0, 3).map(t => ({
      type: 'task', text: t.title, time: t.updated_at,
    })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5)

  async function handleQuickLog() {
    if (!quickText.trim()) return
    setLogging(true)
    try {
      const res = await discussionsApi.process(quickText.trim(), projectId, 'manual')
      navigate('/log/confirm', { state: { rawText: quickText.trim(), projectId, source: 'manual', aiResult: res.data.data } })
    } catch { toast.error('Failed to process') }
    finally { setLogging(false) }
  }

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Tag}           label="Topics"    value={stats.topics_total   ?? 0} sub={`${stats.topics_open ?? 0} open`}              color="#7c3aed" />
        <StatCard icon={CheckSquare2}  label="Open Tasks" value={stats.tasks_pending  ?? 0} sub={`${stats.tasks_total ?? 0} total work tasks`}  color="#2563eb" />
        <StatCard icon={AlertTriangle} label="Conflicts"  value={stats.conflicts_open ?? 0} sub="unresolved"                                    color="#ea580c" />
        <StatCard icon={CheckSquare2}  label="Completed"  value={stats.tasks_done     ?? 0} sub={`${stats.test_cases ?? 0} test cases`}         color="#16a34a" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <div className="bg-white border border-warm-200 rounded-xl">
          <div className="px-4 py-3 border-b border-warm-100">
            <h3 className="text-sm font-semibold text-warm-700">Recent Activity</h3>
          </div>
          {recentActivity.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-warm-400">No activity yet</div>
          ) : (
            <div className="divide-y divide-warm-50">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${a.type === 'discussion' ? 'bg-blue-100' : 'bg-primary-100'}`}>
                    {a.type === 'discussion'
                      ? <MessageSquare className="w-3 h-3 text-blue-500" />
                      : <CheckSquare2 className="w-3 h-3 text-primary-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-warm-700 line-clamp-2">{a.text}</p>
                    <p className="text-xs text-warm-400 mt-0.5">{timeAgo(a.time)}{a.user ? ` · ${a.user}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick log */}
        <div className="bg-white border border-warm-200 rounded-xl">
          <div className="px-4 py-3 border-b border-warm-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary-400" />
            <h3 className="text-sm font-semibold text-warm-700">Quick Log</h3>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              placeholder={`What happened in ${project?.name ?? 'this project'}? Paste notes, decisions, or updates…`}
              rows={5}
              className="input resize-none"
            />
            <button
              onClick={handleQuickLog}
              disabled={logging || !quickText.trim()}
              className="btn-primary btn-sm"
            >
              {logging
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Zap className="w-4 h-4" />
              }
              Process with AI
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Topics Tab ────────────────────────────────────────────────────
function TopicsTab({ projectId }) {
  const navigate = useNavigate()
  const [topics,  setTopics]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    topicsApi.list(projectId)
      .then(r => setTopics(r.data.data || []))
      .catch(() => toast.error('Failed to load topics'))
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) return <PageLoader className="py-12" />
  if (!topics.length) return <div className="text-center py-12 text-sm text-warm-400">No topics yet — log a discussion to create them</div>

  return (
    <div className="bg-white border border-warm-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-warm-50 border-b border-warm-200">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-warm-500">Topic</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-warm-500">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-warm-500">Discussions</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-warm-500">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-100">
          {topics.map(t => (
            <tr key={t.id} onClick={() => navigate(`/topics/${t.id}`)}
              className="hover:bg-warm-50 cursor-pointer">
              <td className="px-4 py-3 font-medium text-warm-800">{t.title}</td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${t.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {t.status || 'open'}
                </span>
              </td>
              <td className="px-4 py-3 text-warm-500">{t.discussion_count ?? 0}</td>
              <td className="px-4 py-3 text-warm-400 text-xs">{timeAgo(t.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tasks Tab ─────────────────────────────────────────────────────
function TasksTab({ projectId }) {
  const navigate = useNavigate()
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Exclude test_cases — they have their own dedicated page
    tasksApi.list({ project_id: projectId, show_done: 'true' })
      .then(r => setTasks((r.data.data || []).filter(t => t.type !== 'test_case')))
      .catch(() => toast.error('Failed to load tasks'))
      .finally(() => setLoading(false))
  }, [projectId])

  const PRIORITY_STYLE = { high: 'bg-red-100 text-red-600', medium: 'bg-yellow-100 text-yellow-600', low: 'bg-warm-100 text-warm-500' }

  if (loading) return <PageLoader className="py-12" />
  if (!tasks.length) return (
    <div className="text-center py-12 text-sm text-warm-400">
      No tasks yet — <button onClick={() => navigate('/lists')} className="text-primary-500 hover:underline">go to Lists</button> to add some
    </div>
  )

  return (
    <div className="bg-white border border-warm-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-warm-50 border-b border-warm-200">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-warm-500">Task</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-warm-500">Priority</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-warm-500">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-warm-500">Due</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-warm-100">
          {tasks.map(t => {
            const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
            return (
              <tr key={t.id} className="hover:bg-warm-50">
                <td className="px-4 py-3">
                  <span className={t.status === 'done' ? 'line-through text-warm-400' : 'text-warm-800 font-medium'}>{t.title}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLE[t.priority] ?? ''}`}>{t.priority}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs capitalize ${t.status === 'done' ? 'text-green-600' : t.status === 'in_progress' ? 'text-blue-600' : 'text-warm-500'}`}>
                    {t.status?.replace('_', ' ')}
                  </span>
                </td>
                <td className={`px-4 py-3 text-xs ${overdue ? 'text-red-500 font-medium' : 'text-warm-400'}`}>
                  {t.due_date ? new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                </td>
                <td className="px-4 py-3">
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Timeline Tab ──────────────────────────────────────────────────
function TimelineTab({ projectId }) {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    timelineApi.list({ project_id: projectId, limit: 50 })
      .then(r => setEvents(r.data.data || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false))
  }, [projectId])

  const TYPE_LABEL = {
    discussion: 'Discussion', task_created: 'Task Added', task_completed: 'Task Done',
    topic_updated: 'Topic Updated', conflict: 'Conflict', member_joined: 'Member Joined',
  }
  const TYPE_COLOR = {
    discussion: 'bg-blue-100 text-blue-600', task_created: 'bg-primary-100 text-primary-600',
    task_completed: 'bg-green-100 text-green-600', topic_updated: 'bg-violet-100 text-violet-600',
    conflict: 'bg-orange-100 text-orange-600', member_joined: 'bg-teal-100 text-teal-600',
  }

  if (loading) return <PageLoader className="py-12" />
  if (!events.length) return <div className="text-center py-12 text-sm text-warm-400">No activity yet</div>

  return (
    <div className="space-y-2">
      {events.map(e => (
        <div key={e.id} className="flex items-start gap-3 bg-white border border-warm-200 rounded-xl px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-0.5 ${TYPE_COLOR[e.type] ?? 'bg-warm-100 text-warm-500'}`}>
            {TYPE_LABEL[e.type] ?? e.type}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-warm-800 line-clamp-1">{e.title === e.description ? e.title : `${e.title} — ${e.description}`}</p>
            {e.user_name && !['Unknown','System','Unassigned'].includes(e.user_name) && (
              <p className="text-xs text-warm-400 mt-0.5">{e.user_name}</p>
            )}
          </div>
          <span className="text-xs text-warm-400 flex-shrink-0">{timeAgo(e.timestamp)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Members Tab ───────────────────────────────────────────────────
function MembersTab({ stats }) {
  const members = stats.members || []
  if (!members.length) return <div className="text-center py-12 text-sm text-warm-400">No team members added yet</div>

  return (
    <div className="bg-white border border-warm-200 rounded-xl overflow-hidden">
      <div className="divide-y divide-warm-100">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm flex-shrink-0">
              {m.users?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-sm font-medium text-warm-800">{m.users?.name ?? 'Unknown'}</p>
              <p className="text-xs text-warm-400 capitalize">{m.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────────────
function SettingsTab({ project, onUpdate, onArchive }) {
  const COLORS = ['#6366f1','#2563eb','#0d9488','#16a34a','#ca8a04','#ea580c','#dc2626','#7c3aed']
  const [name,        setName]        = useState(project.name || '')
  const [description, setDescription] = useState(project.description || '')
  const [color,       setColor]       = useState(project.color || COLORS[0])
  const [saving,      setSaving]      = useState(false)
  // Publish state
  const [publishState,  setPublishState]  = useState(null) // { slug, is_active } | null
  const [publishing,    setPublishing]    = useState(false)
  const [copiedUrl,     setCopiedUrl]     = useState(false)

  // Load publish status on mount
  useEffect(() => {
    if (!project.id) return
    publishApi.getStatus(project.id)
      .then(res => setPublishState(res.data.data))
      .catch(() => {})
  }, [project.id])

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate({ name, description, color })
      toast.success('Project updated')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function enablePublish() {
    setPublishing(true)
    try {
      const res = await publishApi.enable(project.id)
      setPublishState({ slug: res.data.data.slug, is_active: true })
      toast.success('Status page published!')
    } catch { toast.error('Failed to publish') }
    finally { setPublishing(false) }
  }

  async function disablePublish() {
    setPublishing(true)
    try {
      await publishApi.disable(project.id)
      setPublishState(s => ({ ...s, is_active: false }))
      toast.success('Status page unpublished')
    } catch { toast.error('Failed to unpublish') }
    finally { setPublishing(false) }
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${publishState.slug}`
    try { await navigator.clipboard.writeText(url) }
    catch {
      const ta = document.createElement('textarea')
      ta.value = url; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
    }
    setCopiedUrl(true)
    toast.success('Link copied!')
    setTimeout(() => setCopiedUrl(false), 2500)
  }

  const isPublished = publishState?.is_active && publishState?.slug
  const publicUrl = publishState?.slug ? `${window.location.origin}/p/${publishState.slug}` : null

  return (
    <div className="max-w-lg space-y-6">
      {/* General settings */}
      <div className="bg-white border border-warm-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-warm-700">General</h3>
        <div>
          <label className="block text-xs text-warm-500 mb-1">Project Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="input" />
        </div>
        <div>
          <label className="block text-xs text-warm-500 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="input resize-none" />
        </div>
        <div>
          <label className="block text-xs text-warm-500 mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-warm-400 scale-110' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="btn-primary btn-sm">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>

      {/* Publish Status Page */}
      <div className={`bg-white border rounded-xl p-5 space-y-4 ${isPublished ? 'border-emerald-200' : 'border-warm-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className={`w-4 h-4 ${isPublished ? 'text-emerald-600' : 'text-warm-400'}`} />
            <h3 className="text-sm font-semibold text-warm-700">Publish Status Page</h3>
          </div>
          {isPublished && (
            <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          )}
        </div>

        <p className="text-xs text-warm-500">
          Share a public status page showing your project health, open tasks, and recent updates — no login required.
        </p>

        {isPublished ? (
          <div className="space-y-3">
            {/* URL display */}
            <div className="flex items-center gap-2 bg-warm-50 border border-warm-200 rounded-xl px-3 py-2">
              <span className="text-xs text-warm-600 truncate flex-1 font-mono">{publicUrl}</span>
              <button
                onClick={copyLink}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all flex-shrink-0 ${
                  copiedUrl ? 'bg-emerald-600 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {copiedUrl ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedUrl ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <a
                href={`/p/${publishState.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline"
              >
                <Globe className="w-3 h-3" /> View page
              </a>
              <span className="text-warm-300">|</span>
              <button
                onClick={disablePublish}
                disabled={publishing}
                className="flex items-center gap-1.5 text-xs text-warm-500 hover:text-red-600 transition-colors"
              >
                {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />}
                Unpublish
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={enablePublish}
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors"
          >
            {publishing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</>
              : <><Globe className="w-4 h-4" /> Publish Status Page</>
            }
          </button>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white border border-red-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-warm-500 mb-3">Archiving hides the project from your workspace. Data is preserved.</p>
        <button onClick={onArchive}
          className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm rounded-xl hover:bg-red-50 transition-colors">
          <Archive className="w-4 h-4" /> Archive Project
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  const { projects } = useProjectStore()

  const [tab,     setTab]     = useState('overview')
  const [project, setProject] = useState(null)
  const [stats,   setStats]   = useState({})
  const [loading, setLoading] = useState(true)

  // Find project from store or load from stats
  useEffect(() => {
    const p = projects.find(p => p.id === projectId)
    if (p) setProject(p)
  }, [projects, projectId])

  useEffect(() => {
    setLoading(true)
    projectsApi.stats(projectId)
      .then(r => setStats(r.data.data || {}))
      .catch(() => toast.error('Failed to load project stats'))
      .finally(() => setLoading(false))
  }, [projectId])

  // Also load project basic info if not in store
  useEffect(() => {
    if (!project) {
      projectsApi.list()
        .then(r => {
          const p = (r.data.data || []).find(p => p.id === projectId)
          if (p) setProject(p)
        })
    }
  }, [projectId]) // eslint-disable-line

  async function handleUpdate(payload) {
    await projectsApi.update(projectId, payload)
    setProject(p => ({ ...p, ...payload }))
  }

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  async function handleArchive() {
    setShowArchiveConfirm(false)
    await projectsApi.archive(projectId)
    toast.success('Project archived')
    navigate('/projects')
  }

  const health = HEALTH[stats.health ?? project?.health ?? 'good'] ?? HEALTH.good
  const color  = project?.color || '#6366f1'

  return (
    <PageShell>
      <button onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-sm text-warm-500 hover:text-warm-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Projects
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + '22' }}>
          <FolderOpen className="w-6 h-6" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-warm-900">{project?.name ?? '…'}</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${health.bg} ${health.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
              {health.label}
            </span>
          </div>
          {project?.description && (
            <p className="text-sm text-warm-500 mt-0.5 truncate">{project.description}</p>
          )}
        </div>
      </div>

      <SectionTabs tabs={TABS} value={tab} onChange={setTab} />

      {loading && tab === 'overview' ? (
        <PageLoader />
      ) : (
        <>
          {tab === 'overview'  && <OverviewTab projectId={projectId} stats={stats} project={project} />}
          {tab === 'topics'    && <TopicsTab   projectId={projectId} />}
          {tab === 'tasks'     && <TasksTab    projectId={projectId} />}
          {tab === 'timeline'  && <TimelineTab projectId={projectId} />}
          {tab === 'members'   && <MembersTab  stats={stats} />}
          {tab === 'settings'  && <SettingsTab project={project ?? {}} onUpdate={handleUpdate} onArchive={() => setShowArchiveConfirm(true)} />}
        </>
      )}
      {showArchiveConfirm && (
        <ConfirmModal
          icon={Archive}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          title="Archive this project?"
          message="The project will be hidden from your workspace. All data is preserved and can be restored."
          confirmLabel="Archive Project"
          confirmClass="bg-amber-500 text-white hover:bg-amber-600 border-amber-500"
          onConfirm={handleArchive}
          onCancel={() => setShowArchiveConfirm(false)}
        />
      )}
    </PageShell>
  )
}
