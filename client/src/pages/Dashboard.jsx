import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { useWorkspace } from '../context/WorkspaceContext'
import { supabase } from '../config/supabase'
import { discussionsApi, groupsApi, projectsApi, tasksApi, suggestionsApi } from '../services/api'
import { format } from 'date-fns'
import {
  AlertTriangle, Clock, ChevronRight, Send, Loader2,
  CheckCircle2, Circle, Zap, FolderOpen, Users,
  ClipboardList, FlaskConical, ArrowRight, BarChart3,
  Plus, ListChecks, X, Check, Sparkles, RefreshCw,
  Rocket, HelpCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, PageHeader } from '../components/ui'

// ── Helpers ───────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good morning', emoji: '☀️' }
  if (h < 17) return { text: 'Good afternoon', emoji: '👋' }
  return { text: 'Good evening', emoji: '🌙' }
}

function healthColor(count) {
  if (count === 0) return { dot: 'bg-green-400', badge: 'text-green-700 bg-green-50', label: 'On track', health: 'health-good' }
  if (count <= 3)  return { dot: 'bg-yellow-400', badge: 'text-yellow-700 bg-yellow-50', label: 'In progress', health: 'health-at-risk' }
  return { dot: 'bg-red-400', badge: 'text-red-700 bg-red-50', label: 'Needs attention', health: 'health-behind' }
}

// ── New Project Modal ─────────────────────────────────────────
const PROJECT_COLORS = ['#7C3AED', '#3B82F6', '#0D9488', '#16A34A', '#CA8A04', '#EA580C', '#DC2626', '#6366F1']

function NewProjectModal({ onClose, onCreated, groupId }) {
  const [name,   setName]   = useState('')
  const [desc,   setDesc]   = useState('')
  const [color,  setColor]  = useState(PROJECT_COLORS[0])
  const [saving, setSaving] = useState(false)
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await projectsApi.create({ name: name.trim(), description: desc.trim(), color, group_id: groupId || null })
      toast.success('Project created!')
      onCreated(res.data.data || res.data)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-warm-900">New Project</h3>
          <button onClick={onClose} className="p-1.5 text-warm-400 hover:text-warm-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex-shrink-0 border-2 border-white ring-2 ring-primary-400"
              style={{ backgroundColor: color }} />
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
              className="input flex-1"
              required
            />
          </div>

          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="input resize-none"
          />

          <div>
            <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Color</p>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-4 h-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-warm-100">
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
            <button type="submit" disabled={!name.trim() || saving} className="btn-primary btn-sm flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Alert Cards ───────────────────────────────────────────────
function AlertCards({ tasks }) {
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const deployPending = tasks.filter(t => t.type === 'deployment_check' && t.status === 'pending')
  if (!overdue.length && !deployPending.length) return null

  return (
    <div className="space-y-3 mb-6">
      {overdue.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
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
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">{deployPending.length} deployment check{deployPending.length > 1 ? 's' : ''} pending</p>
            <p className="text-xs text-amber-600 mt-0.5">Review before deploying</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Project Card ──────────────────────────────────────────────
function ProjectCard({ project, taskCount }) {
  const navigate = useNavigate()
  const { dot, badge, label, health } = healthColor(taskCount)

  return (
    <button
      onClick={() => navigate(`/projects/${project.id}`)}
      className={`card card-hover text-left w-full ${health} animate-fade-in`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
          <h3 className="font-semibold text-warm-900 text-sm truncate">{project.name}</h3>
        </div>
        <ChevronRight className="w-4 h-4 text-warm-400 group-hover:text-primary-500 transition-colors flex-shrink-0 ml-2" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${dot}`} />
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>{label}</span>
        </div>
        <span className="text-xs text-warm-400">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
      </div>
    </button>
  )
}

// ── Sources ───────────────────────────────────────────────────
const SOURCES = [
  { key: 'manual',          label: 'Manual entry' },
  { key: 'pasted_slack',    label: 'Slack' },
  { key: 'pasted_email',    label: 'Email' },
  { key: 'pasted_whatsapp', label: 'WhatsApp' },
]

const PROCESSING_STEPS = [
  'Reading your discussion…',
  'Detecting topics…',
  'Extracting tasks…',
  'Checking for conflicts…',
  'Done!',
]

// ── Processing Overlay ─────────────────────────────────────────
function ProcessingOverlay({ step }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mb-4">
            <Zap className="w-7 h-7 text-primary-600" />
          </div>
          <h3 className="text-base font-semibold text-warm-900">Processing with AI ✨</h3>
          <p className="text-xs text-warm-400 mt-1">This takes just a moment</p>
        </div>
        <div className="space-y-3">
          {PROCESSING_STEPS.map((label, i) => {
            const done = i < step
            const active = i === step
            return (
              <div key={i} className={`flex items-center gap-3 transition-opacity ${i > step ? 'opacity-30' : 'opacity-100'}`}>
                <div className="flex-shrink-0">
                  {done
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : active
                      ? <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                      : <div className="w-5 h-5 rounded-full border-2 border-warm-200" />
                  }
                </div>
                <span className={`text-sm ${done ? 'text-warm-400 line-through' : active ? 'text-warm-900 font-medium' : 'text-warm-400'}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Log Discussion Box ─────────────────────────────────────────
function QuickLogBox({ projects, onNewProject }) {
  const navigate = useNavigate()
  const [text,      setText]      = useState('')
  const [projectId, setProjectId] = useState('')
  const [source,    setSource]    = useState('manual')
  const [saving,    setSaving]    = useState(false)
  const [step,      setStep]      = useState(0)

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0]?.id || '')
  }, [projects]) // eslint-disable-line

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!text.trim() || !projectId) return
    setSaving(true)
    setStep(0)

    let currentStep = 0
    const interval = setInterval(() => {
      currentStep += 1
      if (currentStep < PROCESSING_STEPS.length - 1) {
        setStep(currentStep)
      } else {
        clearInterval(interval)
      }
    }, 600)

    try {
      const res = await discussionsApi.process(text.trim(), projectId, source)
      clearInterval(interval)
      setStep(PROCESSING_STEPS.length - 1)
      await new Promise(r => setTimeout(r, 400))
      navigate('/log/confirm', {
        state: { rawText: text.trim(), projectId, source, aiResult: res.data.data }
      })
    } catch (err) {
      clearInterval(interval)
      const status = err?.response?.status
      const msg    = err?.response?.data?.error || err.message || 'Failed to process'
      if (status === 429) {
        toast.error(`⚠️ AI rate limit reached. ${msg}`, { duration: 6000 })
      } else {
        toast.error(msg)
      }
    } finally {
      setSaving(false)
      setStep(0)
    }
  }

  const placeholder = {
    manual:          'What happened today? Describe your meeting, standup, or team discussion…',
    pasted_slack:    'Paste Slack thread here…',
    pasted_email:    'Paste email thread here…',
    pasted_whatsapp: 'Paste WhatsApp chat here…',
  }[source]

  return (
    <>
    {saving && <ProcessingOverlay step={step} />}
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-primary-600" />
        <h2 className="text-sm font-semibold text-warm-900">Log Discussion</h2>
        <span className="text-xs text-warm-400 ml-auto">AI extracts topics, tasks &amp; decisions</span>
      </div>

      {/* Project selector — TOP, prominent */}
      <div className="flex items-center gap-2 mb-3 p-3 bg-warm-50 rounded-xl border border-warm-200">
        <span className="text-xs font-semibold text-warm-600 flex-shrink-0">Project:</span>
        {projects.length > 0 ? (
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="flex-1 text-sm font-medium border-0 bg-transparent text-warm-900 focus:outline-none focus:ring-0 cursor-pointer"
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <span className="text-xs text-warm-400 flex-1">No projects yet — create one first</span>
        )}
        <button
          type="button"
          onClick={onNewProject}
          className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
        >
          <Plus className="w-3 h-3" /> New
        </button>
      </div>

      {/* Source selector */}
      <div className="flex gap-2 flex-wrap mb-3">
        {SOURCES.map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSource(s.key)}
            className={`chip ${source === s.key ? 'chip-active' : 'chip-inactive'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit() }}
          placeholder={placeholder}
          rows={4}
          className="input resize-none text-sm"
        />
        <div className="flex items-center justify-end mt-3 gap-2">
          <span className="text-xs text-warm-300 hidden sm:inline">⌘+Enter</span>
          <button
            type="submit"
            disabled={!text.trim() || !projectId || saving}
            className="btn-primary btn-sm flex items-center gap-2 flex-shrink-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Process with AI ✨
          </button>
        </div>
      </form>
    </div>
    </>
  )
}

// ── Priority Task ─────────────────────────────────────────────
function PriorityTask({ task, onToggle }) {
  const done = task.status === 'done'

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-warm-100 last:border-0 transition-opacity ${done ? 'opacity-40' : ''}`}>
      <button
        onClick={() => onToggle(task.id, done ? 'pending' : 'done')}
        className="mt-0.5 flex-shrink-0 text-warm-200 hover:text-primary-500 transition-colors"
      >
        {done
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <Circle className="w-5 h-5" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-warm-900 truncate ${done ? 'line-through' : ''}`}>{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.projects?.name && <span className="text-xs text-warm-400">{task.projects.name}</span>}
          <span className={`badge ${
            task.priority === 'high' ? 'badge-high' : task.priority === 'medium' ? 'badge-medium' : 'badge-low'
          }`}>{task.priority}</span>
          {task.due_date && <span className="text-xs text-warm-400">{format(new Date(task.due_date), 'MMM d')}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Quick Add Task ────────────────────────────────────────────
function QuickAddTask({ projects, onAdded }) {
  const [open,      setOpen]      = useState(false)
  const [title,     setTitle]     = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [priority,  setPriority]  = useState('medium')
  const [saving,    setSaving]    = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function handleAdd(e) {
    e.preventDefault()
    if (!title.trim() || !projectId) return
    setSaving(true)
    try {
      const res = await tasksApi.create({ title: title.trim(), project_id: projectId, priority, status: 'pending' })
      toast.success('Task added!')
      setTitle('')
      onAdded(res.data.data || res.data)
      setOpen(false)
    } catch (err) {
      toast.error('Failed to add task')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 border border-dashed border-primary-200 rounded-xl px-4 py-3 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add a task
      </button>
    )
  }

  return (
    <form onSubmit={handleAdd} className="bg-primary-50 border border-primary-200 rounded-xl p-3 space-y-2">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title…"
        className="input text-sm py-2"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="text-xs border border-warm-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-warm-500 hover:text-warm-700 px-2 py-1">Cancel</button>
          <button type="submit" disabled={!title.trim() || saving} className="btn-primary btn-sm text-xs">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Stats Panel ───────────────────────────────────────────────
const TASK_FILTERS = [
  { key: 'work',  label: 'Work tasks' },
  { key: 'test',  label: 'Test cases' },
  { key: 'all',   label: 'All' },
]

function StatsPanel({ stats, taskFilter, onFilterChange }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Overview</h2>
        <div className="flex items-center bg-warm-100 rounded-lg p-0.5 gap-0.5">
          {TASK_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={`text-xs px-2 py-1 rounded-md font-medium transition-all ${
                taskFilter === f.key
                  ? 'bg-white text-warm-900 shadow-sm'
                  : 'text-warm-500 hover:text-warm-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 flex flex-col items-start gap-1`}>
            <Icon className={`w-4 h-4 ${color}`} />
            <p className="text-lg font-semibold text-warm-900 leading-none">{value}</p>
            <p className="text-xs text-warm-500">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Morning Briefing Widget ───────────────────────────────────
function MorningBriefing({ tasks, projects }) {
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
      attentionItems.push({ label: info.name, detail: `${info.dueSoon.length} due today`, color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400' })
    }
  }

  const pendingTests = tasks.filter(t => t.type === 'test_case' && t.status !== 'done')

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-3 border-b border-warm-100 bg-gradient-to-r from-primary-50 to-white -mx-5 -mt-5 mb-4">
        <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Morning Briefing</p>
      </div>
      <div className="space-y-4">
        {attentionItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">🔴 Needs Attention</p>
            <div className="space-y-1.5">
              {attentionItems.map((item, i) => (
                <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl ${item.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.dot}`} />
                  <span className="text-xs font-medium text-warm-900 truncate flex-1">{item.label}</span>
                  <span className={`text-xs ${item.color} flex-shrink-0`}>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => navigate('/standup')}
          className="w-full flex items-center gap-3 bg-primary-50 hover:bg-primary-100 border border-primary-100 rounded-xl px-3 py-2.5 transition-colors group"
        >
          <ClipboardList className="w-4 h-4 text-primary-500 flex-shrink-0" />
          <div className="text-left flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary-800">Today's Standup</p>
            <p className="text-xs text-primary-500">AI-generated daily update →</p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        {pendingTests.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">🧪 Test Cases Due</p>
            <div className="space-y-1.5">
              {Object.entries(
                pendingTests.reduce((acc, t) => {
                  const name = projects.find(p => p.id === t.project_id)?.name || 'Unknown'
                  acc[name] = (acc[name] || 0) + 1
                  return acc
                }, {})
              ).map(([name, count]) => (
                <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-primary-50">
                  <FlaskConical className="w-3 h-3 text-primary-400 flex-shrink-0" />
                  <span className="text-xs text-warm-700 truncate flex-1">{name}</span>
                  <span className="text-xs text-primary-600 font-medium">{count} pending</span>
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
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">Who's Working On What</h2>
        <button onClick={() => navigate('/team')} className="text-xs text-primary-600 hover:underline font-medium">View all</button>
      </div>
      <div className="space-y-3">
        {group.members.slice(0, 5).map(m => {
          const u = m.users || {}
          return (
            <div key={m.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                {u.avatar_url
                  ? <img src={u.avatar_url} className="w-8 h-8 rounded-full object-cover" alt={u.name} />
                  : (u.name?.[0]?.toUpperCase() ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-warm-900 truncate">{u.name || 'Unknown'}</p>
                <p className="text-xs text-warm-400">{m.active_tasks ?? 0} active tasks · {timeAgo(m.last_activity)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Getting Started Checklist ─────────────────────────────────
const CHECKLIST_STEPS = [
  {
    id: 'project',
    icon: FolderOpen,
    label: 'Create your first project',
    desc: 'Projects hold your tasks and discussions',
    to: '/projects',
    action: 'Create project',
  },
  {
    id: 'task',
    icon: ListChecks,
    label: 'Add a task',
    desc: 'Track work items on your task board',
    to: '/lists',
    action: 'Go to Tasks',
  },
  {
    id: 'discussion',
    icon: Send,
    label: 'Log a discussion',
    desc: 'Paste meeting notes — AI extracts tasks automatically',
    to: '/log',
    action: 'Log Discussion',
  },
  {
    id: 'help',
    icon: HelpCircle,
    label: 'Explore the Help guide',
    desc: 'See all features with step-by-step walkthroughs',
    to: '/help',
    action: 'Open Help',
  },
]

function GettingStarted({ completedIds, onDismiss }) {
  const navigate = useNavigate()
  const doneCount = completedIds.size
  const total = CHECKLIST_STEPS.length

  if (doneCount >= total) return null

  return (
    <div className="card border-2 border-primary-100 bg-gradient-to-br from-primary-50/60 to-white mb-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute right-0 top-0 w-32 h-32 bg-primary-100/30 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="flex items-start justify-between mb-4 relative">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
            <Rocket className="w-4.5 h-4.5 text-white w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-warm-900">Getting started</h3>
            <p className="text-xs text-warm-500">{doneCount} of {total} complete</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-warm-400 hover:text-warm-600 hover:bg-warm-100 transition-colors flex-shrink-0"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-warm-200 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${(doneCount / total) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {CHECKLIST_STEPS.map(step => {
          const done = completedIds.has(step.id)
          const Icon = step.icon
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                done ? 'opacity-50' : 'bg-white border border-warm-100 hover:border-primary-200 hover:shadow-sm'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                done ? 'bg-green-100' : 'bg-primary-50 border border-primary-200'
              }`}>
                {done
                  ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                  : <Icon className="w-3.5 h-3.5 text-primary-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${done ? 'line-through text-warm-400' : 'text-warm-900'}`}>
                  {step.label}
                </p>
                {!done && (
                  <p className="text-xs text-warm-400 leading-tight mt-0.5">{step.desc}</p>
                )}
              </div>
              {!done && (
                <button
                  onClick={() => navigate(step.to)}
                  className="text-xs text-primary-600 font-semibold hover:text-primary-700 whitespace-nowrap flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  {step.action} →
                </button>
              )}
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
  const { activeGroupId } = useWorkspace()
  const { projects, loading: projectsLoading, fetchProjects } = useProjectStore()
  const [userName, setUserName]         = useState('')
  const [userMode, setUserMode]         = useState('personal')
  const [group,    setGroup]            = useState(null)
  const [showNewProject, setShowNewProject] = useState(false)
  // Use local state + server API (bypasses Supabase RLS issues on client)
  const [allTasks, setAllTasks]         = useState([])
  // Track tasks the user just checked off — keep them visible (crossed out) in the list
  const [justCompleted, setJustCompleted] = useState(new Set())
  // Overview filter: 'work' = exclude test cases (default), 'test' = only test cases, 'all' = everything
  const [taskFilter, setTaskFilter]     = useState('work')
  // AI suggestions
  const [suggestions,     setSuggestions]     = useState([])
  const [suggestLoading,  setSuggestLoading]  = useState(false)
  // Getting Started checklist
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem('gs_dismissed') === '1'
  )
  const navigate = useNavigate()

  async function loadTasks() {
    try {
      // Filter by group: personal workspace passes group_id=personal, team passes the group UUID
      const params = { show_done: 'true' }
      if (activeGroupId) params.group_id = activeGroupId
      else params.group_id = 'personal'
      const res = await tasksApi.list(params)
      setAllTasks(res.data.data || [])
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    if (!user) return
    loadTasks()
    fetchProjects(user.id, { groupId: activeGroupId })
    supabase.from('users').select('name, mode').eq('id', user.id).single()
      .then(({ data }) => {
        setUserName(data?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'there')
        setUserMode(data?.mode || 'personal')
      })
    // Load AI suggestions (non-blocking, fire-and-forget style)
    setSuggestLoading(true)
    suggestionsApi.get({ groupId: activeGroupId })
      .then(r => setSuggestions(r.data.data || []))
      .catch(() => {})
      .finally(() => setSuggestLoading(false))
  }, [user, activeGroupId]) // eslint-disable-line

  function refreshSuggestions() {
    setSuggestLoading(true)
    suggestionsApi.get({ groupId: activeGroupId })
      .then(r => setSuggestions(r.data.data || []))
      .catch(() => {})
      .finally(() => setSuggestLoading(false))
  }

  useEffect(() => {
    // Only load group data if we're actively in a team workspace session
    if (!activeGroupId) { setGroup(null); return }
    groupsApi.get(activeGroupId)
      .then(r => r && setGroup(r.data.data))
      .catch(() => {})
  }, [activeGroupId])

  function handleProjectCreated() {
    fetchProjects(user.id, { groupId: activeGroupId, force: true })
    setShowNewProject(false)
  }

  function dismissChecklist() {
    localStorage.setItem('gs_dismissed', '1')
    setChecklistDismissed(true)
  }

  // Determine which checklist steps are done
  const checklistDone = new Set()
  if (projects.length > 0)   checklistDone.add('project')
  if (allTasks.length > 0)   checklistDone.add('task')
  // 'discussion' and 'help' are always nudges (can't detect easily without extra fetch)
  const showChecklist = !checklistDismissed && projects.length === 0

  async function handleToggleTask(taskId, newStatus) {
    // Keep just-completed tasks visible in the list (crossed out, not disappeared)
    if (newStatus === 'done') {
      setJustCompleted(prev => new Set([...prev, taskId]))
    } else {
      setJustCompleted(prev => { const s = new Set(prev); s.delete(taskId); return s })
    }
    // Optimistic update
    setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      await tasksApi.update(taskId, { status: newStatus })
    } catch {
      loadTasks()
    }
  }

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

  // Apply task type filter to stats and priorities
  const filteredTasks = allTasks.filter(t => {
    if (taskFilter === 'work') return t.type !== 'test_case'
    if (taskFilter === 'test') return t.type === 'test_case'
    return true // 'all'
  })

  const openTasks      = filteredTasks.filter(t => t.status !== 'done' && t.status !== 'released')
  const overdueTasks   = filteredTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const completedTasks = filteredTasks.filter(t => t.status === 'done' || t.status === 'released')

  // Include just-completed tasks so they stay visible (crossed out) instead of disappearing
  const highPriorityTasks = [...filteredTasks]
    .filter(t => t.status !== 'done' && t.status !== 'released' || justCompleted.has(t.id))
    .sort((a, b) => {
      const aDone = justCompleted.has(a.id) ? 1 : 0
      const bDone = justCompleted.has(b.id) ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    })
    .slice(0, 5)

  const taskCountByProject = allTasks.filter(t => t.type !== 'test_case').reduce((acc, t) => {
    acc[t.project_id] = (acc[t.project_id] || 0) + 1
    return acc
  }, {})

  const stats = [
    { label: 'Open Tasks',  value: openTasks.length,      icon: ListChecks,   color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Completed',   value: completedTasks.length,  icon: CheckCircle2, color: 'text-green-600',   bg: 'bg-green-50'   },
    { label: 'Overdue',     value: overdueTasks.length,    icon: AlertTriangle, color: overdueTasks.length > 0 ? 'text-red-600' : 'text-warm-400', bg: overdueTasks.length > 0 ? 'bg-red-50' : 'bg-warm-50' },
    { label: 'Projects',    value: projects.length,        icon: FolderOpen,   color: 'text-violet-600',  bg: 'bg-violet-50'  },
  ]

  const { text: greetText, emoji: greetEmoji } = greeting()
  const hasMorningBriefing = allTasks.some(t => t.due_date && (new Date(t.due_date) < new Date() || new Date(t.due_date) <= new Date(Date.now() + 86400000)) && t.status !== 'done')
    || allTasks.some(t => t.type === 'test_case' && t.status !== 'done')

  return (
    <PageShell>
      <PageHeader
        title={`${greetText}, ${userName.split(' ')[0]} ${greetEmoji}`}
        subtitle="Here's what's happening with your projects."
        actions={group && (
          <span className="inline-flex items-center gap-1.5 text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium border border-primary-100">
            <Users className="w-3.5 h-3.5" />{group.name}
          </span>
        )}
      />

      <AlertCards tasks={allTasks} />

      {showChecklist && (
        <GettingStarted completedIds={checklistDone} onDismiss={dismissChecklist} />
      )}

      {/* Friday weekly summary banner */}
      {new Date().getDay() === 5 && (
        <button
          onClick={() => navigate('/weekly-summary')}
          className="w-full flex items-center gap-4 bg-gradient-to-r from-primary-600 to-violet-600 text-white rounded-2xl px-5 py-4 mb-7 hover:from-primary-700 hover:to-violet-700 transition-all shadow-md group"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-bold">Your weekly summary is ready</p>
            <p className="text-xs text-primary-200 mt-0.5">Review what your team accomplished this week →</p>
          </div>
          <ArrowRight className="w-4 h-4 text-white/70 group-hover:text-white transition-colors flex-shrink-0" />
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Log discussion + Today's Priorities */}
        <div className="lg:col-span-2 space-y-6">
          <QuickLogBox
            projects={projects}
            onNewProject={() => setShowNewProject(true)}
          />

          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <h2 className="section-title">Today's Priorities</h2>
              {openTasks.length > 0 && (
                <span className="text-xs text-warm-400">{openTasks.length} open</span>
              )}
            </div>
            <p className="text-xs text-warm-400 mb-4">Your open tasks sorted by priority — check off as you go</p>

            {highPriorityTasks.length > 0 ? (
              highPriorityTasks.map(task => (
                <PriorityTask key={task.id} task={task} onToggle={handleToggleTask} />
              ))
            ) : (
              <div className="space-y-4">
                <div className="empty-state py-6">
                  <CheckCircle2 className="empty-state-icon w-10 h-10 mx-auto mb-2" />
                  <p className="empty-state-title">All clear!</p>
                  <p className="empty-state-sub">
                    {projects.length === 0
                      ? 'Create a project and log a discussion to get started.'
                      : 'No open tasks — use Log Discussion above or add one below.'}
                  </p>
                </div>
                {projects.length > 0 && (
                  <QuickAddTask projects={projects} onAdded={loadTasks} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right — Stats + Briefing + Who's working + Project health */}
        <div className="space-y-6">
          <StatsPanel stats={stats} taskFilter={taskFilter} onFilterChange={setTaskFilter} />

          {/* AI Suggestions */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary-500" />
                What to work on next
              </h2>
              <button
                onClick={refreshSuggestions}
                disabled={suggestLoading}
                className="p-1 rounded-lg text-warm-400 hover:text-warm-600 hover:bg-warm-100 transition-colors"
                title="Refresh suggestions"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${suggestLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {suggestLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-warm-100 rounded-lg animate-pulse" />)}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((s, idx) => (
                  <div key={s.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-warm-50 transition-colors">
                    <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-warm-900 truncate">{s.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {s.project && <span className="text-xs text-warm-400 truncate">{s.project.name}</span>}
                        {s.days_until_due !== null && (
                          <span className={`text-xs font-medium shrink-0 ${s.days_until_due <= 0 ? 'text-red-500' : s.days_until_due <= 3 ? 'text-amber-500' : 'text-warm-400'}`}>
                            {s.days_until_due <= 0 ? 'Overdue' : `${s.days_until_due}d left`}
                          </span>
                        )}
                      </div>
                      {s.reason && <p className="text-xs text-warm-500 mt-0.5 italic">{s.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400 text-center py-4">No open tasks — you're all caught up!</p>
            )}
          </div>

          {hasMorningBriefing && (
            <MorningBriefing tasks={allTasks} projects={projects} />
          )}

          {group && <WhoSection group={group} />}

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Project Health</h2>
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
            {projectsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="card animate-pulse">
                    <div className="h-4 bg-warm-100 rounded w-3/4 mb-3" />
                    <div className="h-3 bg-warm-100 rounded w-1/2" />
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
              <button
                onClick={() => setShowNewProject(true)}
                className="w-full empty-state border border-dashed border-warm-200 rounded-2xl p-6 hover:border-primary-300 hover:bg-primary-50/30 transition-colors"
              >
                <FolderOpen className="empty-state-icon w-8 h-8 mx-auto mb-2" />
                <p className="empty-state-title">No projects yet</p>
                <p className="empty-state-sub text-primary-500 font-medium mt-1">+ Create your first project</p>
              </button>
            )}
          </div>
        </div>
      </div>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={handleProjectCreated}
          groupId={activeGroupId}
        />
      )}
    </PageShell>
  )
}
