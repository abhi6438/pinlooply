import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { projectsApi, testCasesApi, topicsApi, tasksApi } from '../services/api'
import {
  FlaskConical, Plus, Trash2, Loader2, Sparkles, X,
  CheckCircle2, XCircle, Clock, CheckSquare2, ChevronRight,
  Calendar, Flag, Tag, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',         label: 'All' },
  { key: 'happy_path',  label: 'Happy Path' },
  { key: 'edge_case',   label: 'Edge Case' },
  { key: 'negative',    label: 'Negative' },
  { key: 'ui_ux',       label: 'UI / UX' },
  { key: 'performance', label: 'Performance' },
]

const CAT_META = {
  happy_path:  { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', label: 'Happy Path'  },
  edge_case:   { badge: 'bg-amber-50 text-amber-700 border-amber-200',       dot: 'bg-amber-400',   label: 'Edge Case'   },
  negative:    { badge: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-400',     label: 'Negative'    },
  ui_ux:       { badge: 'bg-purple-50 text-purple-700 border-purple-200',    dot: 'bg-purple-400',  label: 'UI / UX'     },
  performance: { badge: 'bg-blue-50 text-blue-700 border-blue-200',          dot: 'bg-blue-400',    label: 'Performance' },
}

const PRIORITY_META = {
  high:   { badge: 'bg-red-50 text-red-600 border-red-200',         label: 'High'   },
  medium: { badge: 'bg-yellow-50 text-yellow-600 border-yellow-200', label: 'Medium' },
  low:    { badge: 'bg-warm-100 text-warm-500 border-warm-200',      label: 'Low'    },
}

// normalise DB 'done' → 'pass'
function normalizeStatus(s) {
  if (s === 'done') return 'pass'
  return s || 'pending'
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteConfirmModal({ title, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-warm-900 text-center mb-1">Delete test case?</h3>
        <p className="text-sm text-warm-500 text-center mb-6 line-clamp-2">"{title}"</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="flex-1 btn bg-red-500 text-white hover:bg-red-600 border-red-500">Delete</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Detail Side Panel ─────────────────────────────────────────
function DetailPanel({ tc, onClose, onDelete, onStatusChange }) {
  const [status, setStatus] = useState(normalizeStatus(tc.status))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const catMeta = CAT_META[tc.category] || CAT_META.happy_path
  const priMeta = PRIORITY_META[tc.priority] || PRIORITY_META.medium

  async function setAndSave(next) {
    setStatus(next)
    onStatusChange(tc.id, next)
  }

  async function doDelete() {
    setConfirmDelete(false)
    setDeleting(true)
    try {
      await testCasesApi.delete(tc.id)
      onDelete(tc.id)
      onClose()
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
      setDeleting(false)
    }
  }

  return (
    <>
      {confirmDelete && (
        <DeleteConfirmModal title={tc.title} onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />
      )}
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-semibold text-warm-700">Test Case</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setConfirmDelete(true)} disabled={deleting}
              className="p-1.5 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 text-warm-400 hover:text-warm-700 hover:bg-warm-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Title */}
          <h2 className="text-base font-semibold text-warm-900 leading-snug">{tc.title}</h2>

          {/* Meta row */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border capitalize ${catMeta.badge}`}>
              {catMeta.label}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${priMeta.badge}`}>
              {priMeta.label} priority
            </span>
          </div>

          {/* Status — Pass / Fail / Pending buttons */}
          <div>
            <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-2">Status</p>
            <div className="flex gap-2">
              {[
                { key: 'pass',    icon: CheckCircle2, label: 'Pass',    active: 'bg-green-500 text-white border-green-500',   idle: 'border-warm-200 text-warm-500 hover:border-green-400 hover:text-green-600' },
                { key: 'fail',    icon: XCircle,      label: 'Fail',    active: 'bg-red-500 text-white border-red-500',       idle: 'border-warm-200 text-warm-500 hover:border-red-400 hover:text-red-600'   },
                { key: 'pending', icon: Clock,        label: 'Pending', active: 'bg-warm-600 text-white border-warm-600',     idle: 'border-warm-200 text-warm-500 hover:border-warm-400'                     },
              ].map(({ key, icon: Icon, label, active, idle }) => (
                <button key={key} onClick={() => setAndSave(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${status === key ? active : idle}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Steps */}
          {tc.steps?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-3">Steps</p>
              <div className="space-y-2">
                {tc.steps.map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-warm-100 text-warm-600 text-xs flex items-center justify-center flex-shrink-0 font-semibold mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-warm-700 pt-0.5">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expected Result */}
          {tc.expected_result && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">Expected Result</p>
              <p className="text-sm text-emerald-800 leading-relaxed">{tc.expected_result}</p>
            </div>
          )}

          {/* Description fallback */}
          {!tc.steps?.length && !tc.expected_result && tc.description && (
            <div className="bg-warm-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide mb-2">Details</p>
              <p className="text-sm text-warm-700 leading-relaxed whitespace-pre-wrap">{tc.description}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Test Case Row ─────────────────────────────────────────────
function TestCaseRow({ tc, onSelect, onStatusChange, onDelete }) {
  const [status, setStatus] = useState(normalizeStatus(tc.status))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const catMeta = CAT_META[tc.category] || CAT_META.happy_path
  const priMeta = PRIORITY_META[tc.priority] || PRIORITY_META.medium

  function quickStatus(next, e) {
    e.stopPropagation()
    setStatus(next)
    onStatusChange(tc.id, next)
  }

  async function doDelete() {
    setConfirmDelete(false)
    setDeleting(true)
    try {
      await testCasesApi.delete(tc.id)
      onDelete(tc.id)
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
      setDeleting(false)
    }
  }

  const rowBg = status === 'pass' ? 'bg-green-50/40' : status === 'fail' ? 'bg-red-50/40' : ''

  return (
    <>
      {confirmDelete && (
        <DeleteConfirmModal title={tc.title} onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />
      )}
      <tr
        onClick={() => onSelect(tc)}
        className={`group border-b border-warm-100 last:border-0 cursor-pointer hover:bg-warm-50 transition-colors ${rowBg}`}
      >
        {/* Status quick-buttons */}
        <td className="pl-4 py-3 w-28">
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={e => quickStatus('pass', e)}
              title="Mark Pass"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                status === 'pass'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'border-warm-200 text-warm-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pass</span>
            </button>
            <button
              onClick={e => quickStatus('fail', e)}
              title="Mark Fail"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                status === 'fail'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-warm-200 text-warm-400 hover:border-red-400 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fail</span>
            </button>
          </div>
        </td>

        {/* Title */}
        <td className="px-3 py-3">
          <span className={`text-sm text-warm-900 ${status === 'pass' ? 'line-through text-warm-400' : ''}`}>
            {tc.title}
          </span>
        </td>

        {/* Category */}
        <td className="px-3 py-3 w-32">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${catMeta.badge}`}>
            {catMeta.label}
          </span>
        </td>

        {/* Priority */}
        <td className="px-3 py-3 w-24">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${priMeta.badge}`}>
            {priMeta.label}
          </span>
        </td>

        {/* Actions */}
        <td className="pr-4 py-3 w-16">
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              disabled={deleting}
              className="p-1 text-warm-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
            <ChevronRight className="w-4 h-4 text-warm-300" />
          </div>
        </td>
      </tr>
    </>
  )
}

// ── Project context hook ───────────────────────────────────────
function useProjectContext(defaultProjectId) {
  const [pid,    setPid]    = useState(defaultProjectId || '')
  const [topics, setTopics] = useState([])
  const [tasks,  setTasks]  = useState([])

  useEffect(() => {
    if (!pid) return
    Promise.all([
      topicsApi.list(pid).then(r => setTopics(r.data.data || [])).catch(() => setTopics([])),
      tasksApi.list({ projectId: pid }).then(r => setTasks((r.data.data || []).filter(t => t.type !== 'test_case'))).catch(() => setTasks([])),
    ])
  }, [pid])

  return { pid, setPid, topics, tasks }
}

// ── Add Manual Modal ──────────────────────────────────────────
function AddManualModal({ projects, defaultProjectId, onClose, onSaved }) {
  const { pid, setPid, tasks } = useProjectContext(defaultProjectId)
  const [taskId,    setTaskId]    = useState('')
  const [title,     setTitle]     = useState('')
  const [category,  setCategory]  = useState('happy_path')
  const [priority,  setPriority]  = useState('medium')
  const [expected,  setExpected]  = useState('')
  const [stepsText, setStepsText] = useState('')
  const [saving,    setSaving]    = useState(false)

  async function handleSave() {
    if (!title.trim()) return toast.error('Title is required')
    if (!pid) return toast.error('Select a project')
    setSaving(true)
    try {
      const steps = stepsText.split('\n').map(s => s.trim()).filter(Boolean)
      await testCasesApi.save({
        projectId: pid, taskId: taskId || undefined,
        testCases: [{ title: title.trim(), category, priority, steps, expected_result: expected.trim() }],
      })
      toast.success('Test case added')
      onSaved(); onClose()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-100">
          <h2 className="text-base font-semibold text-warm-900">Add Test Case</h2>
          <button onClick={onClose} className="p-1 text-warm-400 hover:text-warm-700 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project</label>
              <select value={pid} onChange={e => { setPid(e.target.value); setTaskId('') }} className="input">
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Task (optional)</label>
              <select value={taskId} onChange={e => setTaskId(e.target.value)} className="input text-sm">
                <option value="">— None —</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Title *</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. User can login with valid credentials" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input">
                {CATEGORIES.slice(1).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="input">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Steps (one per line)</label>
            <textarea value={stepsText} onChange={e => setStepsText(e.target.value)}
              placeholder={"Go to login page\nEnter valid credentials\nClick Login"}
              rows={4} className="input resize-none font-mono text-xs" />
          </div>
          <div>
            <label className="label">Expected Result</label>
            <input value={expected} onChange={e => setExpected(e.target.value)}
              placeholder="e.g. User is redirected to dashboard" className="input" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-warm-100 bg-warm-50">
          <button onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim() || !pid} className="btn btn-primary btn-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Test Case
          </button>
        </div>
      </div>
    </div>
  )
}

// ── AI Generate Modal ─────────────────────────────────────────
function AIGenerateModal({ projects, defaultProjectId, onClose, onSaved }) {
  const { pid, setPid, tasks } = useProjectContext(defaultProjectId)
  const [taskId,    setTaskId]    = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc,  setTaskDesc]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [generated, setGenerated] = useState([])
  const [selected,  setSelected]  = useState(new Set())
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (taskId) {
      const t = tasks.find(t => t.id === taskId)
      if (t) setTaskTitle(t.title)
    }
  }, [taskId, tasks])

  async function handleGenerate() {
    if (!taskTitle.trim()) return toast.error('Enter what needs to be tested')
    setLoading(true); setGenerated([]); setSelected(new Set())
    try {
      const res = await testCasesApi.generate({ projectId: pid, taskId: taskId || undefined, taskTitle: taskTitle.trim(), taskDescription: taskDesc.trim() })
      const cases = res.data.data || []
      setGenerated(cases)
      setSelected(new Set(cases.map((_, i) => i)))
    } catch { toast.error('AI generation failed') }
    finally { setLoading(false) }
  }

  function toggleSelect(i) {
    setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  async function handleSave() {
    const toSave = generated.filter((_, i) => selected.has(i))
    if (!toSave.length) return toast.error('Select at least one test case')
    setSaving(true)
    try {
      await testCasesApi.save({ projectId: pid, taskId: taskId || undefined, testCases: toSave })
      toast.success(`${toSave.length} test case${toSave.length !== 1 ? 's' : ''} saved`)
      onSaved(); onClose()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-600" />
            </div>
            <h2 className="text-base font-semibold text-warm-900">Generate with AI</h2>
          </div>
          <button onClick={onClose} className="p-1 text-warm-400 hover:text-warm-700 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4 border-b border-warm-100">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Project</label>
              <select value={pid} onChange={e => setPid(e.target.value)} className="input">
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Task (optional)</label>
              <select value={taskId} onChange={e => setTaskId(e.target.value)} className="input text-sm">
                <option value="">— None —</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">What needs to be tested?</label>
            <input value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
              placeholder="e.g. User login with OAuth — or pick a task above"
              className="input" />
          </div>
          <div>
            <label className="label">Additional context (optional)</label>
            <textarea value={taskDesc} onChange={e => setTaskDesc(e.target.value)}
              placeholder="Describe edge cases, requirements, or constraints..."
              rows={2} className="input resize-none text-sm" />
          </div>
          <button onClick={handleGenerate} disabled={loading || !taskTitle.trim() || !pid}
            className="btn btn-primary btn-sm w-full justify-center">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generating test cases…' : 'Generate with AI'}
          </button>
        </div>

        {generated.length > 0 && (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 py-2.5 border-b border-warm-100 flex items-center justify-between">
                <p className="text-xs text-warm-500">{selected.size} of {generated.length} selected</p>
                <div className="flex gap-3">
                  <button onClick={() => setSelected(new Set(generated.map((_, i) => i)))} className="text-xs text-primary-600 hover:text-primary-700">Select all</button>
                  <button onClick={() => setSelected(new Set())} className="text-xs text-warm-500 hover:text-warm-700">Clear</button>
                </div>
              </div>
              {generated.map((tc, i) => {
                const catMeta = CAT_META[tc.category] || CAT_META.happy_path
                const priMeta = PRIORITY_META[tc.priority] || PRIORITY_META.medium
                const isSelected = selected.has(i)
                return (
                  <div key={i} onClick={() => toggleSelect(i)}
                    className={`flex items-center gap-3 px-6 py-3 border-b border-warm-50 cursor-pointer transition-colors ${isSelected ? 'bg-primary-50/40' : 'hover:bg-warm-50 opacity-50 hover:opacity-70'}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-primary-500 bg-primary-500' : 'border-warm-300'}`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="flex-1 text-sm text-warm-900">{tc.title}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${catMeta.badge}`}>
                        {catMeta.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${priMeta.badge}`}>
                        {priMeta.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-warm-100 bg-warm-50">
              <button onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving || !selected.size} className="btn btn-primary btn-sm">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save {selected.size > 0 ? selected.size : ''} Test Case{selected.size !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function TestCases() {
  const [projects,     setProjects]     = useState([])
  const [projectId,    setProjectId]    = useState('')
  const [testCases,    setTestCases]    = useState([])
  const [loading,      setLoading]      = useState(true) // start true to avoid empty-state flash
  const [activeTab,    setActiveTab]    = useState('all')
  const [showManual,   setShowManual]   = useState(false)
  const [showAIGen,    setShowAIGen]    = useState(false)
  const [selectedTc,   setSelectedTc]  = useState(null)

  useEffect(() => {
    projectsApi.list().then(r => {
      const list = r.data.data || []
      setProjects(list)
      if (list.length) {
        setProjectId(list[0].id)
        // loadTestCases will be triggered by the projectId useEffect below
      } else {
        setLoading(false) // no projects → nothing to load
      }
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => { if (projectId) loadTestCases() }, [projectId]) // eslint-disable-line

  async function loadTestCases() {
    setLoading(true)
    try {
      const res = await testCasesApi.list(projectId)
      setTestCases(res.data.data || [])
    } catch { toast.error('Failed to load test cases') }
    finally { setLoading(false) }
  }

  function handleDelete(id) {
    setTestCases(tc => tc.filter(t => t.id !== id))
    if (selectedTc?.id === id) setSelectedTc(null)
  }

  async function handleStatusChange(id, newStatus) {
    // Optimistic update
    setTestCases(tc => tc.map(t => t.id === id ? { ...t, status: newStatus } : t))
    if (selectedTc?.id === id) setSelectedTc(s => ({ ...s, status: newStatus }))
    try {
      await testCasesApi.updateStatus(id, newStatus)
    } catch {
      // Revert on error
      setTestCases(tc => tc.map(t => t.id === id ? { ...t, status: normalizeStatus(t.status) } : t))
      toast.error('Failed to update status')
    }
  }

  const filtered = activeTab === 'all' ? testCases : testCases.filter(tc => tc.category === activeTab)
  const passCount    = testCases.filter(t => normalizeStatus(t.status) === 'pass').length
  const failCount    = testCases.filter(t => normalizeStatus(t.status) === 'fail').length
  const pendingCount = testCases.filter(t => normalizeStatus(t.status) === 'pending').length
  const total        = testCases.length
  const passRate     = total > 0 ? Math.round((passCount / total) * 100) : 0

  return (
    <div className="px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-warm-900 flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6 text-primary-600" />
            Test Cases
          </h1>
          <p className="text-xs text-warm-400 mt-1">Track test runs across your project. Mark pass or fail directly on the table.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAIGen(true)} className="btn btn-primary btn-sm">
            <Sparkles className="w-4 h-4" /> Generate with AI
          </button>
          <button onClick={() => setShowManual(true)} className="btn btn-secondary btn-sm">
            <Plus className="w-4 h-4" /> Add Manually
          </button>
        </div>
      </div>

      {/* Project + Stats */}
      <div className="flex items-center gap-4 mb-5 flex-wrap">
        {projects.length > 1 ? (
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="select-inline min-w-[140px]">
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : projects.length === 1 ? (
          <span className="text-sm font-medium text-warm-700 bg-warm-100 px-3 py-2 rounded-xl">{projects[0].name}</span>
        ) : null}

        {total > 0 && (
          <div className="flex-1 bg-white border border-warm-100 rounded-xl px-4 py-2.5 flex items-center gap-5">
            <div className="flex-1 min-w-[100px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-warm-500 font-medium">Pass rate</span>
                <span className="text-xs font-bold text-warm-800">{passRate}%</span>
              </div>
              <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${passRate}%` }} />
              </div>
            </div>
            <div className="flex gap-5 flex-shrink-0">
              {[
                { label: 'Pass', val: passCount, color: 'text-green-600' },
                { label: 'Fail', val: failCount, color: 'text-red-500' },
                { label: 'Pending', val: pendingCount, color: 'text-warm-400' },
                { label: 'Total', val: total, color: 'text-warm-800' },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-sm font-semibold leading-none ${color}`}>{val}</p>
                  <p className="text-xs text-warm-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
        {CATEGORIES.map(c => {
          const count = c.key === 'all' ? testCases.length : testCases.filter(t => t.category === c.key).length
          return (
            <button key={c.key} onClick={() => setActiveTab(c.key)}
              className={`tab-pill ${activeTab === c.key ? 'active' : 'inactive'}`}>
              {c.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === c.key ? 'bg-white/20' : 'bg-warm-100 text-warm-500'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state border border-dashed border-warm-200 rounded-2xl py-20">
          <div className="text-4xl mb-3">🧪</div>
          <p className="empty-state-title">{testCases.length === 0 ? 'No test cases yet' : 'None in this category'}</p>
          <p className="empty-state-sub">
            {testCases.length === 0
              ? 'Auto-generated when AI processes a discussion, or add one manually.'
              : 'Switch to a different category above.'}
          </p>
          {testCases.length === 0 && (
            <button onClick={() => setShowAIGen(true)} className="btn btn-primary btn-sm mt-4">
              <Sparkles className="w-4 h-4" /> Generate with AI
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-warm-100 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-warm-100 bg-warm-50">
                <th className="pl-4 py-2.5 text-left w-28">
                  <span className="text-xs font-semibold text-warm-400 uppercase tracking-wide">Status</span>
                </th>
                <th className="px-3 py-2.5 text-left">
                  <span className="text-xs font-semibold text-warm-400 uppercase tracking-wide">Test Case</span>
                </th>
                <th className="px-3 py-2.5 text-left w-32">
                  <span className="text-xs font-semibold text-warm-400 uppercase tracking-wide">Category</span>
                </th>
                <th className="px-3 py-2.5 text-left w-24">
                  <span className="text-xs font-semibold text-warm-400 uppercase tracking-wide">Priority</span>
                </th>
                <th className="pr-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(tc => (
                <TestCaseRow
                  key={tc.id}
                  tc={tc}
                  onSelect={setSelectedTc}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail side panel */}
      {selectedTc && (
        <DetailPanel
          tc={selectedTc}
          onClose={() => setSelectedTc(null)}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
      )}

      {showManual && (
        <AddManualModal projects={projects} defaultProjectId={projectId}
          onClose={() => setShowManual(false)} onSaved={loadTestCases} />
      )}
      {showAIGen && (
        <AIGenerateModal projects={projects} defaultProjectId={projectId}
          onClose={() => setShowAIGen(false)} onSaved={loadTestCases} />
      )}
    </div>
  )
}
