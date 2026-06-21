import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProjectStore } from '../stores/useProjectStore'
import { discussionsApi } from '../services/api'
import { Send, ChevronDown, CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 w-full max-w-sm mx-4">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        </div>
        <h2 className="text-center font-semibold text-gray-900 mb-6">Processing with AI...</h2>
        <div className="space-y-3">
          {PROCESSING_STEPS.map((step, i) => {
            const done = i < currentStep
            const active = i === currentStep
            return (
              <div
                key={step}
                className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  done ? 'text-green-600' : active ? 'text-indigo-600 font-medium' : 'text-gray-300'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : active ? (
                  <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
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

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Log Discussion</h1>
          <p className="text-gray-500 mt-1 text-sm">Paste notes, Slack threads, or type what happened — AI will extract everything.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {/* Textarea */}
          <div>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={onKeyDown}
              placeholder="What happened today? Paste your discussion, meeting notes, or Slack messages here..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[160px] leading-relaxed"
              style={{ height: 'auto' }}
            />
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${text.length > 4000 ? 'text-red-500' : 'text-gray-400'}`}>
                {text.length.toLocaleString()} characters
              </span>
            </div>
          </div>

          {/* Project + Source row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
              <div className="relative">
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none pr-8"
                >
                  {projects.length === 0 && <option value="">No projects</option>}
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
              <div className="relative">
                <select
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white appearance-none pr-8"
                >
                  {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-400 hidden sm:block">
              Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 font-mono text-xs">⌘ Enter</kbd> to process
            </span>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || !projectId || processing}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40 ml-auto"
            >
              <Send className="w-4 h-4" />
              Process with AI →
            </button>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 bg-indigo-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-indigo-700 mb-2">💡 Tips for better results</p>
          <ul className="text-xs text-indigo-600 space-y-1">
            <li>• Include names when assigning tasks ("John will fix the login bug")</li>
            <li>• Mention dates for deadlines ("deploy by Friday")</li>
            <li>• Paste full Slack threads or meeting notes for richer extraction</li>
          </ul>
        </div>
      </div>
    </>
  )
}
