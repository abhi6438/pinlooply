import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { testCasesApi, projectsApi, tasksApi } from '../services/api'
import { useProjectStore } from '../stores/useProjectStore'
import {
  FlaskConical, Loader2, ChevronDown, ChevronRight, Pencil,
  Trash2, Check, X, Copy, RefreshCw, Save, CheckSquare2,
  Square, AlertTriangle, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',         label: 'All',        emoji: '📋' },
  { key: 'happy_path',  label: 'Happy Path', emoji: '✅' },
  { key: 'edge_case',   label: 'Edge Cases', emoji: '⚠️' },
  { key: 'negative',    label: 'Negative',   emoji: '❌' },
  { key: 'ui_ux',       label: 'UI/UX',      emoji: '🎨' },
  { key: 'performance', label: 'Performance',emoji: '⚡' },
]

const PRIORITY_STYLE = {
  high:   { label: '🔴 High',   cls: 'bg-red-50 text-red-600 border-red-200' },
  medium: { label: '🟡 Medium', cls: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  low:    { label: '🟢 Low',    cls: 'bg-green-50 text-green-600 border-green-200' },
}

const LOADING_STEPS = [
  'Reading your task…',
  'Analyzing requirements…',
  'Generating test cases…',
  'Done!',
]

// ── Loading animation ─────────────────────────────────────────
function LoadingSteps({ step }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
        <FlaskConical className="w-7 h-7 text-indigo-600 animate-pulse" />
      </div>
      <div className="space-y-2 text-center">
        {LOADING_STEPS.map((s, i) => (
          <div key={s} className={`flex items-center gap-2 text-sm transition-all ${
            i < step ? 'text-emerald-600' : i === step ? 'text-indigo-700 font-medium' : 'text-gray-300'
          }`}>
            {i < step
              ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              : i === step
                ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                : <div className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" />
            }
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Test Case Card ────────────────────────────────────────────
function TestCaseCard({ tc, selected, onToggle, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [draft,    setDraft]    = useState(tc.title)
  const p = PRIORITY_STYLE[tc.priority] || PRIORITY_STYLE.medium

  function saveEdit() {
    if (draft.trim()) onEdit(tc.id, draft.trim())
    setEditing(false)
  }

  return (
    <div className={`border rounded-xl transition-all ${
      selected ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200 bg-white'
    }`}>
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Select checkbox */}
        <button onClick={() => onToggle(tc.id)} className="mt-0.5 flex-shrink-0">
          {selected
            ? <CheckSquare2 className="w-4.5 h-4.5 text-indigo-600" />
            : <Square className="w-4.5 h-4.5 text-gray-300" />
          }
        </button>

        {/* Title / edit */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
                className="flex-1 border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                autoFocus
              />
              <button onClick={saveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-900">{tc.title}</p>
          )}
        </div>

        {/* Priority badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${p.cls}`}>{p.label}</span>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit title">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(tc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded(x => !x)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded: steps + expected result */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {tc.steps?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Steps</p>
              <ol className="space-y-1">
                {tc.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {tc.expected_result && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Expected Result</p>
              <p className="text-sm text-gray-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">{tc.expected_result}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function TestCaseGenerator() {
  const { taskId: prefilledTaskId } = useParams()
  const navigate = useNavigate()
  const { projects } = useProjectStore()

  // Input state
  const [projectId,   setProjectId]   = useState('')
  const [tasks,       setTasks]       = useState([])
  const [selectedTaskId, setSelectedTaskId] = useState(prefilledTaskId || '')
  const [manualTitle, setManualTitle] = useState('')
  const [manualDesc,  setManualDesc]  = useState('')
  const [useManual,   setUseManual]   = useState(!prefilledTaskId)
  const [loadingTasks, setLoadingTasks] = useState(false)

  // Generation state
  const [generating,   setGenerating]   = useState(false)
  const [loadingStep,  setLoadingStep]  = useState(0)
  const [generated,    setGenerated]    = useState(null) // { summary, test_cases[] }
  const [cards,        setCards]        = useState([])   // local editable copy
  const [selectedIds,  setSelectedIds]  = useState(new Set())
  const [activeTab,    setActiveTab]    = useState('all')
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)

  // If prefilled task, try to detect its project
  useEffect(() => {
    if (prefilledTaskId && projects.length > 0) {
      // Load all projects' tasks to find this task — or user can pick project
      setSelectedTaskId(prefilledTaskId)
      setUseManual(false)
    }
  }, [prefilledTaskId, projects])

  // Load tasks when project changes
  useEffect(() => {
    if (!projectId) { setTasks([]); return }
    setLoadingTasks(true)
    tasksApi.list({ project_id: projectId })
      .then(r => setTasks((r.data.data || []).filter(t => t.type !== 'test_case')))
      .catch(() => {})
      .finally(() => setLoadingTasks(false))
  }, [projectId])

  // Animate loading steps during generation
  useEffect(() => {
    if (!generating) { setLoadingStep(0); return }
    let step = 0
    const id = setInterval(() => {
      step = Math.min(step + 1, LOADING_STEPS.length - 2)
      setLoadingStep(step)
    }, 900)
    return () => clearInterval(id)
  }, [generating])

  const canGenerate = useManual ? manualTitle.trim().length > 0 : !!selectedTaskId

  async function handleGenerate() {
    if (!canGenerate) return
    setGenerating(true)
    setSaved(false)
    setGenerated(null)
    setLoadingStep(0)

    try {
      const selectedTask = tasks.find(t => t.id === selectedTaskId)
      const payload = {
        projectId: projectId || undefined,
        taskId:    useManual ? undefined : selectedTaskId,
        taskTitle: useManual ? manualTitle.trim() : (selectedTask?.title || manualTitle.trim()),
        taskDescription: useManual ? manualDesc.trim() : '',
      }

      const res = await testCasesApi.generate(payload)
      const data = res.data.data

      setLoadingStep(LOADING_STEPS.length - 1)
      await new Promise(r => setTimeout(r, 400)) // brief "Done!" flash

      const withIds = (data.test_cases || []).map((tc, i) => ({ ...tc, id: `tc-${i}-${Date.now()}` }))
      setCards(withIds)
      setSelectedIds(new Set(withIds.map(tc => tc.id)))
      setGenerated({ summary: data.summary, provider: data.provider })
      setActiveTab('all')
    } catch (err) {
      toast.error('Failed to generate test cases. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function deleteCard(id) {
    setCards(cs => cs.filter(c => c.id !== id))
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  function editCard(id, title) {
    setCards(cs => cs.map(c => c.id === id ? { ...c, title } : c))
  }

  function selectAll()   { setSelectedIds(new Set(cards.map(c => c.id))) }
  function deselectAll() { setSelectedIds(new Set()) }

  const filtered = activeTab === 'all' ? cards : cards.filter(c => c.category === activeTab)
  const selectedCount = selectedIds.size

  async function handleSave() {
    if (selectedCount === 0) { toast.error('Select at least one test case to save'); return }
    if (!projectId) { toast.error('Please select a project first'); return }

    setSaving(true)
    try {
      const toSave = cards.filter(c => selectedIds.has(c.id)).map(c => ({
        title:           c.title,
        category:        c.category,
        steps:           c.steps,
        expected_result: c.expected_result,
        priority:        c.priority,
      }))

      const res = await testCasesApi.save({
        projectId,
        taskId: useManual ? undefined : selectedTaskId,
        testCases: toSave,
      })

      toast.success(`${res.data.count} test case${res.data.count !== 1 ? 's' : ''} saved!`)
      setSaved(true)
    } catch {
      toast.error('Failed to save test cases')
    } finally {
      setSaving(false)
    }
  }

  function copyAsText() {
    const text = cards
      .filter(c => selectedIds.has(c.id))
      .map((c, i) => {
        const steps = (c.steps || []).map((s, j) => `  ${j + 1}. ${s}`).join('\n')
        return `${i + 1}. [${(c.category || '').replace('_', ' ').toUpperCase()}] ${c.title}\n${steps}\n  Expected: ${c.expected_result}`
      })
      .join('\n\n')

    navigator.clipboard.writeText(text)
      .then(() => toast.success('Copied to clipboard!'))
      .catch(() => toast.error('Failed to copy'))
  }

  return (
    <div className="h-full flex flex-col px-6 py-6 gap-6 min-h-0">
      {/* Page header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Test Case Generator</h1>
        </div>
        <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">AI-Powered</span>
      </div>

      <div className="flex-1 grid lg:grid-cols-3 gap-6 min-h-0 overflow-auto">

        {/* ── Left: Input ───────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4 flex flex-col">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Configure</h2>

            {/* Project selector */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Project</label>
              <select
                value={projectId}
                onChange={e => { setProjectId(e.target.value); setSelectedTaskId('') }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Select project…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Toggle: task selector vs manual */}
            <div className="flex rounded-xl overflow-hidden border border-gray-200 text-sm">
              <button
                onClick={() => setUseManual(false)}
                className={`flex-1 py-2 transition-colors ${!useManual ? 'bg-indigo-600 text-white font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                From Task
              </button>
              <button
                onClick={() => setUseManual(true)}
                className={`flex-1 py-2 transition-colors ${useManual ? 'bg-indigo-600 text-white font-medium' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                Manual
              </button>
            </div>

            {!useManual ? (
              /* Task dropdown */
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Select Task</label>
                {loadingTasks ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading tasks…
                  </div>
                ) : (
                  <select
                    value={selectedTaskId}
                    onChange={e => setSelectedTaskId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  >
                    <option value="">Choose a task…</option>
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                )}
                {!projectId && (
                  <p className="text-xs text-gray-400 mt-1">↑ Select a project to see tasks</p>
                )}
              </div>
            ) : (
              /* Manual input */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Title <span className="text-red-400">*</span></label>
                  <input
                    value={manualTitle}
                    onChange={e => setManualTitle(e.target.value)}
                    placeholder="e.g. User login with email and password"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Description</label>
                  <textarea
                    value={manualDesc}
                    onChange={e => setManualDesc(e.target.value)}
                    rows={3}
                    placeholder="Describe the feature or behavior to test…"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><FlaskConical className="w-4 h-4" /> Generate Test Cases →</>
              }
            </button>
          </div>

          {/* Tips */}
          {!generated && !generating && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-700 mb-2">💡 Tips</p>
              <ul className="text-xs text-indigo-600 space-y-1.5">
                <li>• Select a specific task for better AI context</li>
                <li>• Add a description for more accurate test cases</li>
                <li>• Review and edit titles before saving</li>
                <li>• Deselect test cases you don't need</li>
              </ul>
            </div>
          )}

          {/* Stats after generation */}
          {generated && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500">Coverage</p>
              {CATEGORIES.slice(1).map(cat => {
                const count = cards.filter(c => c.category === cat.key).length
                if (count === 0) return null
                return (
                  <div key={cat.key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{cat.emoji} {cat.label}</span>
                    <span className="font-semibold text-gray-800">{count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right: Results ────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          {generating && <LoadingSteps step={loadingStep} />}

          {!generating && !generated && (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <FlaskConical className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">No test cases yet</p>
              <p className="text-sm text-gray-400 mt-1">Configure your task and click Generate</p>
            </div>
          )}

          {!generating && generated && (
            <div className="flex flex-col gap-4 min-h-0">
              {/* Summary + actions bar */}
              <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{generated.summary}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cards.length} generated · {selectedCount} selected
                    {generated.provider && ` · via ${generated.provider}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline">Select All</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={deselectAll} className="text-xs text-gray-500 hover:underline">Deselect All</button>
                </div>
              </div>

              {/* Category tabs */}
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.filter(cat => cat.key === 'all' || cards.some(c => c.category === cat.key)).map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setActiveTab(cat.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      activeTab === cat.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeTab === cat.key ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {cat.key === 'all' ? cards.length : cards.filter(c => c.category === cat.key).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Cards list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filtered.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No test cases in this category</p>
                )}
                {filtered.map(tc => (
                  <TestCaseCard
                    key={tc.id}
                    tc={tc}
                    selected={selectedIds.has(tc.id)}
                    onToggle={toggleSelect}
                    onDelete={deleteCard}
                    onEdit={editCard}
                  />
                ))}
              </div>

              {/* Bottom action bar */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={saving || selectedCount === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4" /> Save Selected ({selectedCount})</>
                  }
                </button>

                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Regenerate
                </button>

                <button
                  onClick={copyAsText}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Copy className="w-4 h-4" /> Copy as Text
                </button>

                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium ml-2">
                    <Check className="w-4 h-4" /> Saved to project!
                  </span>
                )}

                {!projectId && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5" /> Select a project to save
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
