import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { automationsApi } from '../../services/api'
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, Loader2,
  Bell, RefreshCw, AlertTriangle, MessageSquare, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Settings nav (mirrors Workspace.jsx) ──────────────────────
const SETTINGS_TABS = [
  { path: '/settings/plan',        label: 'Plan & Billing' },
  { path: '/settings/workspace',   label: 'Workspace'      },
  { path: '/settings/automations', label: 'Automations'    },
]

// ── Trigger type labels ────────────────────────────────────────
const TRIGGER_LABELS = {
  status_change:    { label: 'Status changes',        icon: RefreshCw,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
  discussion_saved: { label: 'Discussion saved',       icon: MessageSquare, color: 'text-violet-600', bg: 'bg-violet-50' },
  overdue:          { label: 'Task becomes overdue',   icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50'    },
}

const ACTION_LABELS = {
  notify:       'Send notification',
  create_tasks: 'Auto-create tasks',
  mark_overdue: 'Mark task as overdue',
}

// ── Preset templates for easy creation ────────────────────────
const PRESETS = [
  {
    name:           'Notify when task marked done',
    trigger_type:   'status_change',
    trigger_config: { to_status: 'done' },
    action_type:    'notify',
    action_config:  { message: 'A task has been marked as done' },
  },
  {
    name:           'Notify when task blocked',
    trigger_type:   'status_change',
    trigger_config: { to_status: 'blocked' },
    action_type:    'notify',
    action_config:  { message: 'A task has been blocked' },
  },
  {
    name:           'Auto-create tasks from discussion',
    trigger_type:   'discussion_saved',
    trigger_config: {},
    action_type:    'create_tasks',
    action_config:  { auto_create: true },
  },
  {
    name:           'Flag overdue tasks',
    trigger_type:   'overdue',
    trigger_config: {},
    action_type:    'mark_overdue',
    action_config:  { mark_overdue: true, notify_assignee: true },
  },
]

// ── Rule card ─────────────────────────────────────────────────
function RuleCard({ rule, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const trig = TRIGGER_LABELS[rule.trigger_type] || { label: rule.trigger_type, icon: Zap, color: 'text-warm-600', bg: 'bg-warm-50' }
  const TrigIcon = trig.icon

  async function handleToggle() {
    setToggling(true)
    try { await onToggle(rule.id, !rule.is_active) }
    finally { setToggling(false) }
  }

  async function handleDelete() {
    if (!confirm(`Delete rule "${rule.name}"?`)) return
    setDeleting(true)
    try { await onDelete(rule.id) }
    finally { setDeleting(false) }
  }

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all ${rule.is_active ? 'border-warm-200' : 'border-warm-100 opacity-60'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Trigger icon */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${trig.bg}`}>
          <TrigIcon className={`w-4 h-4 ${trig.color}`} />
        </div>

        {/* Name + trigger */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-warm-900 truncate">{rule.name}</p>
          <p className="text-xs text-warm-500">
            {trig.label} → {ACTION_LABELS[rule.action_type] || rule.action_type}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-warm-400 hover:bg-warm-50 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="p-1.5 rounded-lg text-warm-400 hover:bg-warm-50 transition-colors"
            title={rule.is_active ? 'Disable' : 'Enable'}
          >
            {toggling
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : rule.is_active
                ? <ToggleRight className="w-5 h-5 text-primary-500" />
                : <ToggleLeft  className="w-5 h-5 text-warm-400" />
            }
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-warm-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete rule"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-warm-100 px-4 py-3 bg-warm-50 text-xs space-y-1 text-warm-600">
          <p><span className="font-medium">Trigger config:</span> {JSON.stringify(rule.trigger_config)}</p>
          <p><span className="font-medium">Action config:</span>  {JSON.stringify(rule.action_config)}</p>
          {rule.project_id && <p><span className="font-medium">Scoped to project:</span> {rule.project_id}</p>}
          <p><span className="font-medium">Created:</span> {new Date(rule.created_at).toLocaleDateString()}</p>
        </div>
      )}
    </div>
  )
}

// ── Create form ───────────────────────────────────────────────
function CreateRuleForm({ onCreate, onCancel }) {
  const [name, setName]           = useState('')
  const [triggerType, setTrigger] = useState('status_change')
  const [actionType, setAction]   = useState('notify')
  const [toStatus, setToStatus]   = useState('')
  const [message, setMessage]     = useState('')
  const [autoCreate, setAutoCreate] = useState(true)
  const [notifyAssignee, setNotifyAssignee] = useState(true)
  const [saving, setSaving] = useState(false)

  function buildPayload() {
    const trigger_config = {}
    const action_config  = {}

    if (triggerType === 'status_change' && toStatus) trigger_config.to_status = toStatus
    if (actionType === 'notify')       action_config.message        = message || `Task status changed`
    if (actionType === 'create_tasks') action_config.auto_create    = autoCreate
    if (actionType === 'mark_overdue') {
      action_config.mark_overdue    = true
      action_config.notify_assignee = notifyAssignee
    }

    return { name, trigger_type: triggerType, trigger_config, action_type: actionType, action_config }
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Rule name is required'); return }
    setSaving(true)
    try {
      await onCreate(buildPayload())
      toast.success('Automation rule created')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-primary-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-warm-800">New automation rule</h3>

      {/* Name */}
      <div>
        <label className="label">Rule name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Notify when task is done"
          className="input w-full"
        />
      </div>

      {/* Trigger */}
      <div>
        <label className="label">When (trigger)</label>
        <select value={triggerType} onChange={e => setTrigger(e.target.value)} className="input w-full">
          <option value="status_change">Status changes</option>
          <option value="discussion_saved">Discussion is saved</option>
          <option value="overdue">Task becomes overdue</option>
        </select>
      </div>

      {/* Status filter for status_change */}
      {triggerType === 'status_change' && (
        <div>
          <label className="label">To status (leave blank for any)</label>
          <input
            type="text"
            value={toStatus}
            onChange={e => setToStatus(e.target.value)}
            placeholder="e.g. done, blocked, in_review"
            className="input w-full"
          />
        </div>
      )}

      {/* Action */}
      <div>
        <label className="label">Then (action)</label>
        <select value={actionType} onChange={e => setAction(e.target.value)} className="input w-full">
          {triggerType === 'status_change'    && <option value="notify">Send notification</option>}
          {triggerType === 'discussion_saved' && <option value="create_tasks">Auto-create tasks</option>}
          {triggerType === 'overdue'          && <option value="mark_overdue">Mark overdue + notify</option>}
        </select>
      </div>

      {/* Action-specific config */}
      {actionType === 'notify' && (
        <div>
          <label className="label">Notification message</label>
          <input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Task status changed"
            className="input w-full"
          />
        </div>
      )}
      {actionType === 'create_tasks' && (
        <label className="flex items-center gap-2 text-sm text-warm-700 cursor-pointer">
          <input
            type="checkbox"
            checked={autoCreate}
            onChange={e => setAutoCreate(e.target.checked)}
            className="w-4 h-4 rounded accent-primary-500"
          />
          Auto-create tasks without confirmation step
        </label>
      )}
      {actionType === 'mark_overdue' && (
        <label className="flex items-center gap-2 text-sm text-warm-700 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyAssignee}
            onChange={e => setNotifyAssignee(e.target.checked)}
            className="w-4 h-4 rounded accent-primary-500"
          />
          Notify task assignee when flagged overdue
        </label>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Create rule
        </button>
        <button onClick={onCancel} className="btn btn-sm">Cancel</button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function Automations() {
  const location = useLocation()
  const [rules, setRules]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [runningOverdue, setRunningOverdue] = useState(false)

  useEffect(() => {
    automationsApi.list()
      .then(r => setRules(r.data.data || []))
      .catch(() => toast.error('Failed to load automation rules'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(payload) {
    const r = await automationsApi.create(payload)
    setRules(prev => [r.data.data, ...prev])
    setShowForm(false)
  }

  async function handleToggle(id, is_active) {
    const r = await automationsApi.update(id, { is_active })
    setRules(prev => prev.map(rule => rule.id === id ? r.data.data : rule))
  }

  async function handleDelete(id) {
    await automationsApi.delete(id)
    setRules(prev => prev.filter(r => r.id !== id))
    toast.success('Rule deleted')
  }

  async function handleRunOverdue() {
    setRunningOverdue(true)
    try {
      const r = await automationsApi.runOverdue()
      const { marked = 0, notified = 0 } = r.data
      toast.success(`Overdue check done — ${marked} task${marked !== 1 ? 's' : ''} flagged, ${notified} notified`)
    } catch {
      toast.error('Overdue check failed')
    } finally {
      setRunningOverdue(false)
    }
  }

  async function applyPreset(preset) {
    const r = await automationsApi.create(preset)
    setRules(prev => [r.data.data, ...prev])
    toast.success(`"${preset.name}" rule created`)
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Settings nav */}
      <div className="bg-white border-b border-warm-200 px-6">
        <div className="flex items-center gap-1 py-1">
          {SETTINGS_TABS.map(tab => (
            <Link
              key={tab.path}
              to={tab.path}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                location.pathname === tab.path
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-warm-500 hover:text-warm-800'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-warm-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary-500" />
              Automations
            </h1>
            <p className="text-sm text-warm-500 mt-1">Rules that run automatically when events occur in your workspace.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunOverdue}
              disabled={runningOverdue}
              className="btn btn-sm text-warm-600 border border-warm-200 hover:bg-warm-50"
              title="Manually run the overdue check now"
            >
              {runningOverdue
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <AlertTriangle className="w-3.5 h-3.5" />
              }
              Run overdue check
            </button>
            <button
              onClick={() => setShowForm(v => !v)}
              className="btn btn-primary btn-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New rule
            </button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <CreateRuleForm
            onCreate={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Active rules */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-warm-400" />
          </div>
        ) : rules.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Your rules ({rules.length})</h2>
            {rules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : !showForm && (
          <div className="text-center py-12 text-warm-400">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No automation rules yet</p>
            <p className="text-xs mt-1">Add a rule above or pick a starter template below.</p>
          </div>
        )}

        {/* Preset templates */}
        {!showForm && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Starter templates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRESETS.map(preset => {
                const trig = TRIGGER_LABELS[preset.trigger_type] || { label: preset.trigger_type, icon: Zap, color: 'text-warm-600', bg: 'bg-warm-50' }
                const TrigIcon = trig.icon
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className="text-left bg-white border border-warm-200 rounded-xl px-4 py-3 hover:border-primary-300 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${trig.bg}`}>
                        <TrigIcon className={`w-3.5 h-3.5 ${trig.color}`} />
                      </div>
                      <span className="text-sm font-medium text-warm-800 group-hover:text-primary-600 transition-colors">{preset.name}</span>
                    </div>
                    <p className="text-xs text-warm-500 ml-8">
                      {trig.label} → {ACTION_LABELS[preset.action_type]}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
