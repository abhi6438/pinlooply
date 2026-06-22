import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { discussionsApi } from '../services/api'
import { CheckCircle2, Loader2, ChevronDown } from 'lucide-react'
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
        <PageHeader
          title="Log Discussion"
          subtitle="Tell Pinloop what happened — AI will handle the rest."
        />

        <div className="card space-y-5">
          {/* Source pill toggle */}
          <div>
            <label className="label mb-2">Source</label>
            <div className="flex flex-wrap gap-2 mb-1">
              {SOURCES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSource(s.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    source === s.value
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white border border-warm-200 text-warm-600 hover:border-primary-300 hover:text-primary-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="label mb-2">Discussion</label>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={onKeyDown}
              placeholder="What happened today? Describe your meeting, standup, or team discussion... 💬"
              className="input min-h-48 text-base"
              style={{ height: 'auto' }}
            />
            <div className="flex justify-end mt-1.5">
              <span className={`text-xs ${text.length > 4000 ? 'text-red-500' : 'text-warm-400'}`}>
                {text.length} characters
              </span>
            </div>
          </div>

          {/* Project selector */}
          <div>
            <label className="label mb-2">Project</label>
            <div className="relative">
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className="input appearance-none pr-9 text-sm"
              >
                {projects.length === 0 && <option value="">No projects</option>}
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 pointer-events-none" />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-1 gap-3">
            <span className="text-xs text-warm-400 hidden sm:block">
              Press <kbd className="px-1.5 py-0.5 bg-warm-100 rounded text-warm-600 font-mono text-xs border border-warm-200">⌘ Enter</kbd> to process
            </span>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || !projectId || processing}
              className="btn-primary btn-lg w-full sm:w-auto"
            >
              Process with AI ✨
            </button>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 bg-primary-50 rounded-2xl p-5 border border-primary-100">
          <p className="text-xs font-semibold text-primary-700 mb-2">💡 Tips for better results</p>
          <ul className="text-xs text-primary-600 space-y-1.5">
            <li>• Include names when assigning tasks ("John will fix the login bug")</li>
            <li>• Mention dates for deadlines ("deploy by Friday")</li>
            <li>• Paste full Slack threads or meeting notes for richer extraction</li>
          </ul>
        </div>
      </PageShell>
    </>
  )
}
