import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Star, Send, MessageSquare, CheckCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { feedbackApi } from '../../services/api'

const CATEGORIES = [
  { value: 'bug',     label: '🐛 Bug Report',      desc: 'Something is broken' },
  { value: 'feature', label: '✨ Feature Request',  desc: 'I want something new' },
  { value: 'general', label: '💬 General',          desc: 'Other feedback' },
]

// ── Star rating ───────────────────────────────────────────────
function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              n <= (hovered || value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-none text-warm-200'
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs text-warm-400 self-center">
          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][value]}
        </span>
      )}
    </div>
  )
}

// ── Feedback modal ────────────────────────────────────────────
function FeedbackModal({ onClose }) {
  const { user } = useAuth()

  const [step,     setStep]     = useState('form')   // 'form' | 'done'
  const [category, setCategory] = useState('general')
  const [rating,   setRating]   = useState(0)
  const [message,  setMessage]  = useState('')
  const [name,     setName]     = useState(user?.user_metadata?.name || user?.name || '')
  const [email,    setEmail]    = useState(user?.email || '')
  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!message.trim()) { setError('Please write a message.'); return }
    setSending(true)
    setError('')
    try {
      const res = await feedbackApi.submit({
        user_id:  user?.id || null,
        name:     name.trim(),
        email:    email.trim(),
        category,
        rating:   rating || null,
        message:  message.trim(),
      })
      if (res.success) setStep('done')
      else setError(res.error || 'Something went wrong')
    } catch {
      setError('Failed to send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center sm:justify-end p-4 sm:pr-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-primary-600" />
            </div>
            <h2 className="text-sm font-semibold text-warm-900">Share Feedback</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'done' ? (
          /* ── Done state ── */
          <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-1">
              <CheckCheck className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-base font-semibold text-warm-900">Thank you!</h3>
            <p className="text-sm text-warm-500 leading-relaxed">
              Your feedback means a lot and helps us make Pinlooply better for everyone.
            </p>
            <button onClick={onClose} className="btn-primary mt-2 px-6">Close</button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={submit} className="px-5 py-4 space-y-4">

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2 block">
                Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                      category === c.value
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-warm-200 hover:border-warm-300 text-warm-600'
                    }`}
                  >
                    <div className="font-medium leading-snug">{c.label}</div>
                    <div className="text-[10px] text-warm-400 mt-0.5 leading-snug">{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2 block">
                How's your experience? <span className="text-warm-300 font-normal">(optional)</span>
              </label>
              <StarRating value={rating} onChange={setRating} />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1.5 block">
                Your feedback <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind…"
                className="input w-full resize-none text-sm leading-relaxed"
              />
            </div>

            {/* Name + Email */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-warm-400 mb-1 block">
                  Name <span className="text-warm-300">(optional)</span>
                </label>
                <input
                  className="input text-sm w-full"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-warm-400 mb-1 block">
                  Email <span className="text-warm-300">(optional)</span>
                </label>
                <input
                  type="email"
                  className="input text-sm w-full"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sending
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Send className="w-3.5 h-3.5" />
              }
              {sending ? 'Sending…' : 'Send Feedback'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Floating trigger button ───────────────────────────────────
export default function FeedbackWidget() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating tab — right edge, mid-screen */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={() => setOpen(true)}
          title="Give feedback"
          className="flex flex-col items-center gap-1 bg-primary-600 hover:bg-primary-700 text-white text-[11px] font-semibold px-2 py-3 rounded-l-xl shadow-lg transition-all hover:shadow-xl hover:-translate-x-0.5"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'translateY(-50%) rotate(180deg)' }}
        >
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ transform: 'rotate(180deg)' }} />
          Feedback
        </button>
      </div>

      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  )
}
