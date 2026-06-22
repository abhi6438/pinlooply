import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../config/supabase'
import { projectsApi } from '../services/api'
import api from '../services/api'
import toast from 'react-hot-toast'
import { ChevronLeft, Check, Plus, X } from 'lucide-react'

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

// ─────────────────────────────────────────────
// Progress Bar
// ─────────────────────────────────────────────
function ProgressBar({ current, total }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-8">
      <div
        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${(current / total) * 100}%` }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 1 — Welcome + Name
// ─────────────────────────────────────────────
function StepName({ value, onChange, onNext, hasInvite }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Pinlooply 👋</h1>
        <p className="text-gray-500 mt-2">
          {hasInvite ? "Just tell us your name and we'll take you straight to your team." : "Let's get you set up in under 2 minutes."}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">What should we call you?</label>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Your name"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          autoFocus
        />
      </div>
      <button
        onClick={onNext}
        disabled={!value.trim()}
        className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 2 — Choose Mode
// ─────────────────────────────────────────────
const MODES = [
  { value: 'personal', emoji: '👤', label: 'Just Me',  desc: 'Personal projects, just for me' },
  { value: 'team',     emoji: '👥', label: 'My Team',  desc: 'Collaborate with teammates' },
  { value: 'org',      emoji: '🏢', label: 'My Org',   desc: 'Multiple teams in one org' },
]

function StepMode({ value, onChange, onNext }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">How will you use Pinlooply?</h1>
        <p className="text-gray-500 mt-2">You can change this later.</p>
      </div>
      <div className="space-y-3">
        {MODES.map(m => (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              value === m.value
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <span className="text-2xl">{m.emoji}</span>
            <div>
              <p className="font-medium text-gray-900">{m.label}</p>
              <p className="text-sm text-gray-500">{m.desc}</p>
            </div>
            {value === m.value && (
              <div className="ml-auto w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!value}
        className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 3 — Create First Project
// ─────────────────────────────────────────────
function StepProject({ value, onChange, onNext, loading }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create your first project</h1>
        <p className="text-gray-500 mt-2">A project holds discussions, topics, and tasks.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project name</label>
          <input
            type="text"
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Product Roadmap"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={value.description}
            onChange={e => onChange({ ...value, description: e.target.value })}
            placeholder="What is this project about?"
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex gap-3">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => onChange({ ...value, color: c })}
                className={`w-8 h-8 rounded-full transition-transform ${
                  value.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <button
        onClick={onNext}
        disabled={!value.name.trim() || loading}
        className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
      >
        {loading ? 'Creating...' : 'Create Project'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 4 — Group Setup (team/org only)
// ─────────────────────────────────────────────
function StepGroup({ value, onChange, onNext, onSkip, loading }) {
  const [emailInput, setEmailInput] = useState('')

  function addEmail() {
    const e = emailInput.trim().toLowerCase()
    if (!e || !e.includes('@')) return
    if (value.invites.includes(e)) return
    onChange({ ...value, invites: [...value.invites, e] })
    setEmailInput('')
  }

  function removeEmail(email) {
    onChange({ ...value, invites: value.invites.filter(i => i !== email) })
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail() }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Name your team</h1>
        <p className="text-gray-500 mt-2">You can invite more people later.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Team name</label>
          <input
            type="text"
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Engineering"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invite teammates <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="teammate@example.com"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              onClick={addEmail}
              className="p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          {value.invites.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {value.invites.map(e => (
                <span key={e} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  {e}
                  <button onClick={() => removeEmail(e)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <button
          onClick={onNext}
          disabled={!value.name.trim() || loading}
          className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-40"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
        <button
          onClick={onSkip}
          className="w-full text-gray-500 text-sm py-2 hover:text-gray-700 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Step 5 — Done
// ─────────────────────────────────────────────
function StepDone({ name, onFinish }) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="text-6xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pinlooply is ready for you!</h1>
        <p className="text-gray-500 mt-2">
          Hey {name?.split(' ')[0] || 'there'}, everything is set up. Let's get started.
        </p>
      </div>
      <button
        onClick={onFinish}
        className="w-full bg-indigo-600 text-white rounded-lg px-4 py-3 text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        Start logging your first discussion →
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Onboarding Component
// ─────────────────────────────────────────────
export default function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState(1)
  const [name, setName]         = useState('')
  const [mode, setMode]         = useState('')
  const [project, setProject]   = useState({ name: '', description: '', color: COLORS[0] })
  const [group, setGroup]       = useState({ name: '', invites: [] })

  // Detect invite link in localStorage (persists across login redirects)
  const pendingInvite = (() => {
    try { return JSON.parse(localStorage.getItem('pendingInvite') || 'null') } catch { return null }
  })()

  const needsGroup  = mode === 'team' || mode === 'org'
  const totalSteps  = needsGroup ? 5 : 4

  // ── Load saved progress ──
  useEffect(() => {
    if (!user) return
    async function loadProgress() {
      const { data } = await supabase
        .from('users')
        .select('name, mode, onboarding_step, onboarding_complete')
        .eq('id', user.id)
        .single()

      if (!data) return
      if (data.onboarding_complete) { navigate('/dashboard'); return }

      const savedName = data.name || user.user_metadata?.full_name || ''
      if (savedName) setName(savedName)

      // If user arrived via invite link — fast-track straight to invite page
      const invite = localStorage.getItem('pendingInvite')
      if (invite) {
        const { inviteCode } = JSON.parse(invite)
        // If they already have a name, skip even step 1
        if (savedName) {
          await supabase.from('users').update({ mode: 'team', onboarding_complete: true }).eq('id', user.id)
          navigate(`/invite/${inviteCode}`)
          return
        }
        // Otherwise show step 1 only (handleStep1 will redirect after name entered)
        setStep(1)
        return
      }

      if (data.mode) setMode(data.mode)
      if (data.onboarding_step > 1) setStep(data.onboarding_step)
    }
    loadProgress()
  }, [user]) // eslint-disable-line

  async function save(updates) {
    await supabase.from('users').update(updates).eq('id', user.id)
  }

  // ── Step submit handlers ──
  async function handleStep1() {
    setLoading(true)
    // If user came via invite link — skip onboarding, mark complete, go join
    if (pendingInvite) {
      await save({ name, mode: 'team', onboarding_complete: true })
      setLoading(false)
      navigate(`/invite/${pendingInvite.inviteCode}`)
      return
    }
    await save({ name, onboarding_step: 2 })
    setLoading(false)
    setStep(2)
  }

  async function handleStep2() {
    setLoading(true)
    await save({ mode, onboarding_step: 3 })
    setLoading(false)
    setStep(3)
  }

  async function handleStep3() {
    setLoading(true)
    try {
      await projectsApi.create({
        name:        project.name,
        description: project.description || null,
        color:       project.color,
      })
      const next = needsGroup ? 4 : 5
      await save({ onboarding_step: next })
      setStep(next)
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep4() {
    setLoading(true)
    try {
      await api.post('/api/groups', { name: group.name })
      await save({ onboarding_step: 5 })
      setStep(5)
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  async function handleSkipGroup() {
    await save({ onboarding_step: 5 })
    setStep(5)
  }

  async function handleFinish() {
    setLoading(true)
    await save({ onboarding_complete: true })
    // Full reload so ProtectedRoute re-fetches onboarding_complete fresh
    window.location.replace('/dashboard')
  }

  function goBack() {
    setStep(s => Math.max(1, s - 1))
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-xl font-bold text-gray-900">Pinlooply</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <ProgressBar current={step} total={totalSteps} />

          {step > 1 && step < (needsGroup ? 5 : 4) + 1 && step !== (needsGroup ? 5 : 4) && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 -mt-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}

          {step === 1 && <StepName value={name} onChange={setName} onNext={handleStep1} hasInvite={!!pendingInvite} />}
          {step === 2 && <StepMode value={mode} onChange={setMode} onNext={handleStep2} />}
          {step === 3 && <StepProject value={project} onChange={setProject} onNext={handleStep3} loading={loading} />}
          {step === 4 && needsGroup && (
            <StepGroup value={group} onChange={setGroup} onNext={handleStep4} onSkip={handleSkipGroup} loading={loading} />
          )}
          {step === 5 && <StepDone name={name} onFinish={handleFinish} />}
          {step === 4 && !needsGroup && <StepDone name={name} onFinish={handleFinish} />}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Step {Math.min(step, totalSteps)} of {totalSteps}
        </p>
      </div>
    </div>
  )
}
