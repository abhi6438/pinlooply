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
// Step 1 — Welcome + Name
// ─────────────────────────────────────────────
function StepName({ value, onChange, onNext, hasInvite }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="text-5xl mb-4">👋</div>
        <h1 className="text-2xl font-bold text-warm-900">Welcome to Pinlooply</h1>
        <p className="text-warm-500 mt-2">
          {hasInvite
            ? "Just tell us your name and we'll take you straight to your team."
            : "Let's get you set up in under 2 minutes."}
        </p>
      </div>
      <div>
        <label className="label">What should we call you?</label>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Your name"
          className="input"
          autoFocus
        />
      </div>
      <button
        onClick={onNext}
        disabled={!value.trim()}
        className="btn-primary btn-lg w-full"
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-warm-900">How will you use Pinlooply?</h1>
        <p className="text-warm-500 mt-2">You can change this later.</p>
      </div>
      <div className="space-y-3">
        {MODES.map(m => (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              value === m.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-warm-200 hover:border-warm-400 bg-white'
            }`}
          >
            <span className="text-2xl">{m.emoji}</span>
            <div>
              <p className="font-medium text-warm-900">{m.label}</p>
              <p className="text-sm text-warm-500">{m.desc}</p>
            </div>
            {value === m.value && (
              <div className="ml-auto w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!value}
        className="btn-primary btn-lg w-full"
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-warm-900">Create your first project</h1>
        <p className="text-warm-500 mt-2">A project holds discussions, topics, and tasks.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">Project name</label>
          <input
            type="text"
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Product Roadmap"
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="label">
            Description <span className="text-warm-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={value.description}
            onChange={e => onChange({ ...value, description: e.target.value })}
            placeholder="What is this project about?"
            rows={2}
            className="input resize-none"
          />
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex gap-3 mt-2">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => onChange({ ...value, color: c })}
                className={`w-10 h-10 rounded-full cursor-pointer transition-transform hover:scale-110 ${
                  value.color === c ? 'ring-2 ring-primary-600 ring-offset-2 scale-110' : ''
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
        className="btn-primary btn-lg w-full"
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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-warm-900">Name your team</h1>
        <p className="text-warm-500 mt-2">You can invite more people later.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="label">Team name</label>
          <input
            type="text"
            value={value.name}
            onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="e.g. Engineering"
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="label">
            Invite teammates <span className="text-warm-400 font-normal">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="teammate@example.com"
              className="input flex-1"
            />
            <button
              onClick={addEmail}
              className="btn-secondary p-2.5"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {value.invites.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {value.invites.map(e => (
                <span key={e} className="flex items-center gap-1 bg-primary-50 text-primary-700 text-xs px-2.5 py-1 rounded-full">
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
          className="btn-primary btn-lg w-full"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
        <button
          onClick={onSkip}
          className="btn-ghost btn-sm w-full text-warm-500"
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
    <div className="text-center space-y-6 py-4 animate-slide-up">
      <div className="text-6xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold text-warm-900">Pinlooply is ready for you!</h1>
        <p className="text-warm-500 mt-2">
          Hey {name?.split(' ')[0] || 'there'}, everything is set up. Let's get started.
        </p>
      </div>
      <button
        onClick={onFinish}
        className="btn-primary btn-lg w-full"
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
    <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md mx-auto w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-xl font-bold text-warm-900">Pinlooply</span>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 mb-12 justify-center">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map(i => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i <= step ? 'bg-primary-600 w-8' : 'bg-warm-200 w-2'
              }`}
            />
          ))}
        </div>

        {/* Back button */}
        {step > 1 && step < totalSteps + 1 && step !== totalSteps && (
          <button
            onClick={goBack}
            className="btn-ghost btn-sm flex items-center gap-1 mb-6 text-warm-500"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}

        {/* Step content */}
        {step === 1 && <StepName value={name} onChange={setName} onNext={handleStep1} hasInvite={!!pendingInvite} />}
        {step === 2 && <StepMode value={mode} onChange={setMode} onNext={handleStep2} />}
        {step === 3 && <StepProject value={project} onChange={setProject} onNext={handleStep3} loading={loading} />}
        {step === 4 && needsGroup && (
          <StepGroup value={group} onChange={setGroup} onNext={handleStep4} onSkip={handleSkipGroup} loading={loading} />
        )}
        {step === 5 && <StepDone name={name} onFinish={handleFinish} />}
        {step === 4 && !needsGroup && <StepDone name={name} onFinish={handleFinish} />}

        {/* Step counter */}
        <p className="text-center text-xs text-warm-400 mt-6">
          Step {Math.min(step, totalSteps)} of {totalSteps}
        </p>
      </div>
    </div>
  )
}
