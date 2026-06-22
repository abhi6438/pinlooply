import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { useTaskStore } from '../stores/useTaskStore'
import { supabase } from '../config/supabase'
import { discussionsApi, groupsApi } from '../services/api'
import { format } from 'date-fns'
import {
  AlertTriangle, Clock, ChevronRight, Send, Loader2,
  CheckCircle2, Circle, Zap, FolderOpen, Users,
  ClipboardList, FlaskConical, ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function healthColor(count) {
  if (count === 0) return { dot: 'bg-green-400', badge: 'text-green-700 bg-green-50', label: 'On track' }
  if (count <= 3)  return { dot: 'bg-yellow-400', badge: 'text-yellow-700 bg-yellow-50', label: 'In progress' }
  return { dot: 'bg-red-400', badge: 'text-red-700 bg-red-50', label: 'Needs attention' }
}

// ── Alert Cards ───────────────────────────────────────────────
function AlertCards({ tasks }) {
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const deployPending = tasks.filter(t => t.type === 'deployment_check' && t.status === 'pending')
  if (!overdue.length && !deployPending.length) return null

  return (
    <div className="space-y-3 mb-6">
      {overdue.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">{overdue.length} overdue task{overdue.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-red-600 mt-0.5">
              {overdue.slice(0, 2).map(t => t.title).join(', ')}{overdue.length > 2 ? ` +${overdue.length - 2} more` : ''}
            </p>
          </div>
        </div>
      )}
      {deployPending.length > 0 && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <Clock className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">{deployPending.length} deployment check{deployPending.length > 1 ? 's' : ''} pending</p>
            <p className="text-xs text-orange-600 mt-0.5">Review before deploying</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Project Card ──────────────────────────────────────────────
function ProjectCard({ project, taskCount }) {
  const navigate = useNavigate()
  const { dot, badge, label } = healthColor(taskCount)

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md hover:border-indigo-200 transition-all group w-full"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
          <h3 className="font-medium text-gray-900 text-sm truncate">{project.name}</h3>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0 ml-2" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${dot}`} />
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{label}</span>
        </div>
        <span className="text-xs text-gray-400">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
      </div>
    </button>
  )
}

// ── Quick Log ─────────────────────────────────────────────────
function QuickLogBox({ projects, userId }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0]?.id || '')
  }, [projects]) // eslint-disable-line

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!text.trim() || !projectId) return
    setSaving(true)
    try {
      const res = await discussionsApi.process(text.trim(), projectId, 'manual')
      navigate('/log/confirm', {
        state: { rawText: text.trim(), projectId, source: 'manual', aiResult: res.data.data }
      })
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to process')
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-900">Quick Log</h2>
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What happened today? Paste a Slack thread, meeting notes, or anything worth remembering..."
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
        />
        <div className="flex items-center justify-between mt-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {projects.length > 0 ? (
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <span className="text-xs text-gray-400">No projects yet</span>
            )}
            <span className="text-xs text-gray-400 hidden sm:inline">⌘+Enter</span>
          </div>
          <button
            type="submit"
            disabled={!text.trim() || !projectId || saving}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Process with AI
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Priority Task ─────────────────────────────────────────────
function PriorityTask({ task, onToggle }) {
  const colors = { high: 'text-red-500', medium: 'text-yellow-500', low: 'text-gray-400' }
  const done = task.status === 'done'

  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0 transition-opacity ${done ? 'opacity-40' : ''}`}>
      <button
        onClick={() => onToggle(task.id, done ? 'pending' : 'done')}
        className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-indigo-500 transition-colors"
      >
        {done
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <Circle className="w-5 h-5" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-gray-800 truncate ${done ? 'line-through' : ''}`}>{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.projects?.name && <span className="text-xs text-gray-400">{task.projects.name}</span>}
          <span className={`text-xs font-medium ${colors[task.priority]}`}>{task.priority}</span>
          {task.due_date && <span className="text-xs text-gray-400">{format(new Date(task.due_date), 'MMM d')}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Morning Briefing Widget ───────────────────────────────────
function MorningBriefing({ tasks, projects, userName }) {
  const navigate = useNavigate()
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const projectTaskMap = {}
  for (const t of tasks) {
    if (!t.project_id || t.status === 'done') continue
    if (!projectTaskMap[t.project_id]) {
      const proj = projects.find(p => p.id === t.project_id)
      projectTaskMap[t.project_id] = { name: proj?.name || 'Unknown', overdue: [], dueSoon: [] }
    }
    if (t.due_date) {
      const due = new Date(t.due_date)
      if (due < now) projectTaskMap[t.project_id].overdue.push(t)
      else if (due <= tomorrow) projectTaskMap[t.project_id].dueSoon.push(t)
    }
  }

  const attentionItems = []
  for (const info of Object.values(projectTaskMap)) {
    if (info.overdue.length > 0) {
      attentionItems.push({ label: info.name, detail: `${info.overdue.length} overdue`, color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' })
    } else if (info.dueSoon.length > 0) {
      attentionItems.push({ label: info.name, detail: `${info.dueSoon.length} due today`, color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-400' })
    }
  }

  const pendingTests = tasks.filter(t => t.type === 'test_case' && t.status !== 'done')
  const testsByProject = pendingTests.reduce((acc, t) => {
    const name = projects.find(p => p.id === t.project_id)?.name || 'Unknown'
    acc[name] = (acc[name] || 0) + 1
    return acc
  }, {})

  if (!attentionItems.length && !pendingTests.length) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Morning Briefing</p>
      </div>
      <div className="p-4 space-y-4">
        {attentionItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🔴 Needs Attention</p>
            <div className="space-y-1.5">
              {attentionItems.map((item, i) => (
                <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${item.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dot}`} />
                  <span className="text-xs font-medium text-gray-800 truncate flex-1">{item.label}</span>
                  <span className={`text-xs ${item.color} flex-shrink-0`}>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => navigate('/standup')}
          className="w-full flex items-center gap-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl px-3 py-2.5 transition-colors group"
        >
          <ClipboardList className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs font-semibold text-indigo-800">Today's Standup</p>
            <p className="text-xs text-indigo-500">Generate with AI →</p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        {pendingTests.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">🧪 Test Cases Due</p>
            <div className="space-y-1.5">
              {Object.entries(testsByProject).map(([name, count]) => (
                <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-purple-50">
                  <FlaskConical className="w-3 h-3 text-purple-400 flex-shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{name}</span>
                  <span className="text-xs text-purple-600 font-medium">{count} pending</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Who's Working On What ─────────────────────────────────────
function WhoSection({ group }) {
  const navigate = useNavigate()
  if (!group?.members?.length) return null

  function timeAgo(iso) {
    if (!iso) return '—'
    const diff = Date.now() - new Date(iso)
    const d = Math.floor(diff / 86400000)
    if (d === 0) return 'Today'
    if (d === 1) return 'Yesterday'
    return `${d}d ago`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">Who's Working On What</h2>
        <button onClick={() => navigate('/team')} className="text-xs text-indigo-500 hover:underline">View all</button>
      </div>
      <div className="space-y-3">
        {group.members.slice(0, 5).map(m => {
          const u = m.users || {}
          return (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs flex-shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                  : (u.name?.[0]?.toUpperCase() ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{u.name || 'Unknown'}</p>
                <p className="text-xs text-gray-400">{m.active_tasks ?? 0} active tasks · {timeAgo(m.last_activity)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const { projects, loading: projectsLoading, fetchProjects } = useProjectStore()
  const { tasks, fetchAllTasks, updateTaskStatus } = useTaskStore()
  const [userName, setUserName]   = useState('')
  const [userMode, setUserMode]   = useState('personal')
  const [group,    setGroup]      = useState(null)

  useEffect(() => {
    if (!user) return
    fetchAllTasks(user.id)
    fetchProjects(user.id)
    supabase.from('users').select('name, mode').eq('id', user.id).single()
      .then(({ data }) => {
        setUserName(data?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'there')
        setUserMode(data?.mode || 'personal')
      })
  }, [user]) // eslint-disable-line

  // Load group if in team/org mode
  useEffect(() => {
    if (userMode !== 'team' && userMode !== 'org') return
    groupsApi.list()
      .then(r => {
        const list = r.data.data || []
        if (!list.length) return
        return groupsApi.get(list[0].id)
      })
      .then(r => r && setGroup(r.data.data))
      .catch(() => {})
  }, [userMode])

  const highPriorityTasks = tasks
    .filter(t => t.priority === 'high' && t.status !== 'done')
    .slice(0, 5)

  const taskCountByProject = tasks.reduce((acc, t) => {
    acc[t.project_id] = (acc[t.project_id] || 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Greeting */}
      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {userName.split(' ')[0]} 👋
          </h1>
          {group && (
            <span className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
              <Users className="w-3.5 h-3.5" />{group.name}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <AlertCards tasks={tasks} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Quick log + priorities */}
        <div className="lg:col-span-2 space-y-6">
          <QuickLogBox projects={projects} userId={user?.id} />

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Today's Priorities</h2>
            <p className="text-xs text-gray-400 mb-4">High priority tasks across all projects</p>
            {highPriorityTasks.length > 0 ? (
              highPriorityTasks.map(task => (
                <PriorityTask key={task.id} task={task} onToggle={updateTaskStatus} />
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 text-gray-100 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No high priority tasks — you're all clear!</p>
              </div>
            )}
          </div>
        </div>

        {/* Right — Briefing + Who's working + Project health */}
        <div className="space-y-6">
          <MorningBriefing tasks={tasks} projects={projects} userName={userName} />
          {group && <WhoSection group={group} />}
          <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Project Health</h2>
          {projectsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-3">
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} taskCount={taskCountByProject[p.id] || 0} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
              <FolderOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No projects yet</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
