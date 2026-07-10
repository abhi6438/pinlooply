import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { discussionsApi } from '../services/api'
import { CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, PageHeader } from '../components/ui'

const SOURCES = [
  { value: 'manual',          label: 'Manual entry' },
  { value: 'pasted_slack',    label: 'Pasted from Slack' },
  { value: 'pasted_email',    label: 'Pasted from Email' },
  { value: 'pasted_whatsapp', label: 'Pasted from WhatsApp' },
]

const PROCESSING_STEPS = [
  'Reading your discussion...',
  'Detecting topics...',
  'Extracting tasks...',
  'Checking for conflicts...',
  'Done!',
]

// ── Processing overlay ────────────────────────────────────────
function ProcessingOverlay({ currentStep }) {
  return (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-warm-200 shadow-xl p-8 w-full max-w-sm mx-4">
        <div className="flex items-center justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-primary-600 animate-spin" />
          </div>
        </div>
        <h2 className="text-center font-semibold text-warm-900 mb-6">Processing with AI...</h2>
        <div className="space-y-3">
          {PROCESSING_STEPS.map((step, i) => {
            const done = i < currentStep
            const active = i === currentStep
            return (
              <div
                key={step}
                className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  done ? 'text-green-600' : active ? 'text-primary-600 font-medium' : 'text-warm-200'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : active ? (
                  <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-warm-200 flex-shrink-0" />
                )}
                {step}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export default function LogDiscussion() {
  const { user } = useAuth()
  const { projects, fetchProjects } = useProjectStore()
  const navigate = useNavigate()
  const location = useLocation()
  const textareaRef = useRef(null)

  const [text, setText]           = useState('')
  const [projectId, setProjectId] = useState('')
  const [source, setSource]       = useState('manual')
  const [processing, setProcessing] = useState(false)
  const [step, setStep]           = useState(-1)

  // Pre-fill project from location state (coming from dashboard quick log)
  useEffect(() => {
    if (location.state?.prefilledText) setText(location.state.prefilledText)
    if (location.state?.projectId)     setProjectId(location.state.projectId)
  }, [location.state])

  useEffect(() => {
    if (user && !projects.length) fetchProjects(user.id)
  }, [user]) // eslint-disable-line

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0].id)
  }, [projects]) // eslint-disable-line

  // Auto-resize textarea
  function handleTextChange(e) {
    setText(e.target.value)
    const ta = textareaRef.current
    if (ta) { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px' }
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit()
  }

  async function handleSubmit() {
    if (!text.trim() || !projectId || processing) return
    setProcessing(true)
    setStep(0)

    // Animate through steps
    const stepDelay = (ms) => new Promise(r => setTimeout(r, ms))

    try {
      setStep(0)
      await stepDelay(600)
      setStep(1)
      await stepDelay(500)
      setStep(2)

      const response = await discussionsApi.process(text, projectId, source)

      setStep(3)
      await stepDelay(400)
      setStep(4)
      await stepDelay(500)

      // Navigate to confirm screen with AI result
      navigate('/log/confirm', {
        state: {
          rawText: text,
          projectId,
          source,
          aiResult: response.data.data,
        },
      })
    } catch (err) {
      console.error('AI processing error:', err)
      toast.error(err.response?.data?.error || 'AI processing failed. Check your API keys.')
      setProcessing(false)
      setStep(-1)
    }
  }

  return (
    <>
      {processing && <ProcessingOverlay currentStep={step} />}

      <PageShell>
        {/* Compact header row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-warm-900">Log Discussion</h1>
            <p className="text-xs text-warm-400 mt-0.5">Tell Pinloop what happened — AI will handle the rest.</p>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          {/* Top toolbar: source chips + project selector in one line */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Source chips */}
            {SOURCES.map(s => (
              <button
                key={s.value}
                onClick={() => setSource(s.value)}
                className={`chip ${source === s.value ? 'chip-active' : 'chip-inactive'}`}
              >
                {s.label}
              </button>
            ))}

            {/* Divider */}
            <div className="h-4 w-px bg-warm-200 mx-1 hidden sm:block" />

            {/* Project selector — inline, compact */}
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="select-inline flex-1 min-w-[140px] max-w-[200px]"
            >
              {projects.length === 0 && <option value="">No projects</option>}
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={onKeyDown}
            placeholder="What happened today? Describe your meeting, standup, or team discussion... 💬"
            className="input min-h-52 text-sm resize-none w-full"
            style={{ height: 'auto' }}
          />

          {/* Bottom action bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-warm-400 hidden sm:block">
                <kbd className="px-1.5 py-0.5 bg-warm-100 rounded text-warm-600 font-mono text-xs border border-warm-200">⌘ Enter</kbd> to process
              </span>
              <span className={`text-xs ${text.length > 4000 ? 'text-red-500' : 'text-warm-400'}`}>
                {text.length} chars
              </span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || !projectId || processing}
              className="btn-primary px-5 py-2 text-sm"
            >
              Process with AI ✨
            </button>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warm-400 mb-2 px-0.5">💡 Tips for better AI results</p>
          <div className="flex flex-wrap gap-2">
            {[
              { color: 'bg-blue-50 text-blue-700 border-blue-200',   icon: '👤', text: 'Name people — AI auto-assigns tasks' },
              { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: '📅', text: 'Mention dates — "by Friday", "next Monday"' },
              { color: 'bg-violet-50 text-violet-700 border-violet-200', icon: '📋', text: 'Full Slack/email threads work best' },
              { color: 'bg-green-50 text-green-700 border-green-200',  icon: '✅', text: 'Say "done" or "completed" to mark tasks' },
              { color: 'bg-rose-50 text-rose-700 border-rose-200',     icon: '🚨', text: '"Blocked" or "urgent" flags priority' },
              { color: 'bg-teal-50 text-teal-700 border-teal-200',     icon: '🔗', text: 'Link to project — topics auto-tagged' },
            ].map(t => (
              <span key={t.text} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium ${t.color}`}>
                <span>{t.icon}</span>
                {t.text}
              </span>
            ))}
          </div>
        </div>
      </PageShell>
    </>
  )
}
