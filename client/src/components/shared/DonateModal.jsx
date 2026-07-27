import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Heart, X, Copy, Check, ExternalLink, CheckCheck, Send } from 'lucide-react'
import { donorApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

// ── Module-level config cache — fetched once, shared by all buttons ───
let _configCache   = null   // null = not fetched, {} = fetched (may be empty)
let _configPromise = null

function fetchDonateConfig() {
  if (_configCache !== null) return Promise.resolve(_configCache)
  if (!_configPromise) {
    _configPromise = fetch('/api/public/donate-config')
      .then(r => r.json())
      .then(res => { _configCache = res.data || {}; return _configCache })
      .catch(() => { _configCache = {}; return {} })
  }
  return _configPromise
}

function hasAnyMethod(cfg) {
  return !!(cfg && (cfg.upi || cfg.paypal || cfg.buymeacoffee || cfg.razorpay))
}

// Load Razorpay checkout.js on demand
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// UPI deep-link QR
function upiQrUrl(id, name) {
  const data = encodeURIComponent(`upi://pay?pa=${id}&pn=${encodeURIComponent(name)}&cu=INR`)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data}`
}

// ── Razorpay tab ─────────────────────────────────────────────────
const PRESETS = [99, 299, 499]

function RazorpayTab({ cfg, onClose }) {
  const { user }             = useAuth()
  const [preset,  setPreset] = useState(99)
  const [custom,  setCustom] = useState('')
  const [paying,  setPaying] = useState(false)
  const [success, setSuccess]= useState(false)
  const [error,   setError]  = useState('')

  const finalAmount = custom ? Number(custom) : preset

  async function pay() {
    const amt = finalAmount
    if (!amt || isNaN(amt) || amt < 1) { setError('Please enter a valid amount'); return }
    setError('')
    setPaying(true)
    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) {
        setError('Could not load payment gateway — try refreshing.')
        setPaying(false)
        return
      }

      const orderRes = await donorApi.razorpayCreateOrder(amt, user?.id)
      if (!orderRes.success) {
        setError(orderRes.error || 'Failed to create order')
        setPaying(false)
        return
      }

      const options = {
        key:       orderRes.key_id,
        amount:    orderRes.amount,
        currency:  orderRes.currency || 'INR',
        order_id:  orderRes.order_id,
        name:      'Pinlooply',
        description: 'Support my work',
        prefill: {
          name:  user?.user_metadata?.name || user?.name || '',
          email: user?.email || '',
        },
        theme: { color: '#6366f1' },
        handler: async (response) => {
          try {
            const verifyRes = await donorApi.razorpayVerify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              name:    user?.user_metadata?.name || 'Supporter',
              email:   user?.email || '',
              amount:  amt,
              user_id: user?.id || null,
            })
            if (verifyRes.success) setSuccess(true)
            else setError('Payment received but verification failed. Please contact support.')
          } catch {
            setError('Verification error — please contact support.')
          }
          setPaying(false)
        },
        modal: { ondismiss: () => setPaying(false) },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setError(err.message || 'Something went wrong')
      setPaying(false)
    }
  }

  if (success) {
    return (
      <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <CheckCheck className="w-7 h-7 text-emerald-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">You're amazing! 🎉</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Thank you for your support. We'll send you a personal thank-you soon!
        </p>
        <button
          onClick={onClose}
          className="mt-2 px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Amount presets */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Select amount</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => { setPreset(p); setCustom('') }}
              className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                !custom && preset === p
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400'
              }`}
            >
              ₹{p}
            </button>
          ))}
        </div>
      </div>

      {/* Custom amount */}
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">
          Custom amount <span className="text-gray-300">(optional)</span>
        </label>
        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-300">
          <span className="pl-3 pr-1 text-gray-500 text-sm">₹</span>
          <input
            type="number"
            className="flex-1 py-2 pr-3 text-sm outline-none"
            placeholder="e.g. 150"
            value={custom}
            min="1"
            onChange={e => setCustom(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={pay}
        disabled={paying}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all disabled:opacity-60"
      >
        {paying && (
          <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        )}
        {paying ? 'Opening checkout…' : `Pay ₹${finalAmount || '—'} with Razorpay`}
      </button>

      <p className="text-[11px] text-gray-400 text-center">
        Secured by Razorpay · UPI, cards, net banking &amp; wallets accepted
      </p>
    </div>
  )
}

// ── Donor details form (shown after UPI / PayPal / BMC click) ─────────
function DonorThanksForm({ method, onClose, onSkip }) {
  const { user }              = useAuth()
  const [name,    setName]    = useState(user?.user_metadata?.name || user?.name || '')
  const [email,   setEmail]   = useState(user?.email || '')
  const [amount,  setAmount]  = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return }
    setSending(true)
    setError('')
    try {
      const res = await donorApi.notify({
        name: name.trim(), email: email.trim(), method,
        amount: amount.trim(), message: message.trim(), user_id: user?.id || null,
      })
      if (res.success) setDone(true)
      else setError(res.error || 'Something went wrong')
    } catch { setError('Failed to send. Try again.') }
    finally { setSending(false) }
  }

  if (done) {
    return (
      <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <CheckCheck className="w-7 h-7 text-emerald-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">You're amazing! 🎉</h3>
        <p className="text-sm text-gray-500 leading-relaxed">We'll send you a personal thank-you note. It truly means the world.</p>
        <button onClick={onClose} className="mt-2 px-6 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors">
          Close
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="px-5 py-4 space-y-3">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
        🎉 Thank you for supporting! Leave your details and we'll personally say thanks.
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Name <span className="text-red-400">*</span></label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Email <span className="text-red-400">*</span></label>
          <input
            type="email"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Amount <span className="text-gray-300">(optional)</span></label>
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          placeholder="e.g. ₹100 or $5"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Note for us <span className="text-gray-300">(optional)</span></label>
        <textarea
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"
          placeholder="Any message you'd like to share…"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending}
          className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Send className="w-3.5 h-3.5" />
          }
          {sending ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl transition-colors"
        >
          Skip
        </button>
      </div>
    </form>
  )
}

// ── Tab button ────────────────────────────────────────────────────────
function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

// ── Main modal ────────────────────────────────────────────────────────
export function DonateModal({ onClose }) {
  const [tab,         setTab]         = useState(null)
  const [copied,      setCopied]      = useState(false)
  const [cfg,         setCfg]         = useState(null)
  const [donorStep,   setDonorStep]   = useState(false)
  const [donorMethod, setDonorMethod] = useState('upi')

  useEffect(() => {
    fetchDonateConfig().then(data => {
      setCfg(data)
      if (data.razorpay)      setTab('razorpay')
      else if (data.upi)      setTab('upi')
      else if (data.paypal)   setTab('paypal')
      else if (data.buymeacoffee) setTab('bmc')
    })
  }, [])

  function copyUpi() {
    navigator.clipboard.writeText(cfg?.upi?.id || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePaymentClick(method) {
    setDonorMethod(method)
    setTimeout(() => setDonorStep(true), 1200)
  }

  const hasAny = hasAnyMethod(cfg)

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-pink-500 to-rose-500 px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Support My Work</h2>
              <p className="text-pink-100 text-xs">Your support keeps this project alive ❤️</p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {cfg === null && (
          <div className="px-4 py-10 flex justify-center">
            <div className="w-5 h-5 border-2 border-pink-300 border-t-pink-600 rounded-full animate-spin" />
          </div>
        )}

        {/* No methods enabled */}
        {cfg !== null && !hasAny && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Support methods not configured yet.
          </div>
        )}

        {/* Donor details step — shown after clicking a manual payment link */}
        {hasAny && donorStep && (
          <DonorThanksForm
            method={donorMethod}
            onClose={onClose}
            onSkip={() => setDonorStep(false)}
          />
        )}

        {/* Payment tabs — hidden once donor step is active */}
        {hasAny && !donorStep && (
          <>
            <div className="px-4 pt-4">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
                {cfg.razorpay     && <Tab active={tab === 'razorpay'} onClick={() => setTab('razorpay')}>💳 Razorpay</Tab>}
                {cfg.upi          && <Tab active={tab === 'upi'}      onClick={() => setTab('upi')}>🇮🇳 UPI</Tab>}
                {cfg.paypal       && <Tab active={tab === 'paypal'}   onClick={() => setTab('paypal')}>💳 PayPal</Tab>}
                {cfg.buymeacoffee && <Tab active={tab === 'bmc'}      onClick={() => setTab('bmc')}>☕ Buy Me a Coffee</Tab>}
              </div>
            </div>

            {/* Razorpay tab */}
            {tab === 'razorpay' && cfg.razorpay && (
              <RazorpayTab cfg={cfg} onClose={onClose} />
            )}

            {/* UPI tab */}
            {tab === 'upi' && cfg.upi && (
              <div className="px-4 pb-4 flex flex-col items-center gap-3">
                <div className="bg-gray-50 rounded-2xl p-3 border border-gray-200">
                  <img
                    src={upiQrUrl(cfg.upi.id, cfg.upi.name)}
                    alt="UPI QR Code"
                    className="w-44 h-44 rounded-xl"
                  />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Scan with any UPI app — GPay, PhonePe, Paytm, BHIM
                </p>
                <div className="w-full flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <p className="flex-1 text-sm font-mono text-gray-700 truncate">{cfg.upi.id}</p>
                  <button
                    onClick={copyUpi}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg flex-shrink-0 transition-all ${
                      copied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                {copied && (
                  <button
                    onClick={() => handlePaymentClick('upi')}
                    className="w-full text-xs text-pink-600 hover:text-pink-700 font-medium py-1 transition-colors"
                  >
                    ✓ Done? Leave your details for a thank-you →
                  </button>
                )}
              </div>
            )}

            {/* PayPal tab */}
            {tab === 'paypal' && cfg.paypal && (
              <div className="px-4 pb-4 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">💳</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Support via PayPal</p>
                  <p className="text-xs text-gray-500">Any amount is deeply appreciated</p>
                </div>
                <a
                  href={cfg.paypal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handlePaymentClick('paypal')}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  Support on PayPal <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Buy Me a Coffee tab */}
            {tab === 'bmc' && cfg.buymeacoffee && (
              <div className="px-4 pb-4 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center">
                  <span className="text-4xl">☕</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Buy me a coffee</p>
                  <p className="text-xs text-gray-500">A small gesture means a lot — thank you!</p>
                </div>
                <a
                  href={cfg.buymeacoffee.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handlePaymentClick('buymeacoffee')}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  ☕ Buy Me a Coffee <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Footer note */}
            <div className="px-4 pb-4 text-center">
              <p className="text-[11px] text-gray-400">
                100% goes to the developer. Thank you for your support 🙏
              </p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Trigger button (inline use) ───────────────────────────────────────
export function DonateButton({ variant = 'default' }) {
  const [open,    setOpen]    = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    fetchDonateConfig().then(cfg => setVisible(hasAnyMethod(cfg)))
  }, [])

  if (!visible) return null

  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-pink-300 hover:bg-[#312E81] hover:text-pink-200 transition-colors"
          title="Support My Work"
        >
          <Heart className="w-3.5 h-3.5 flex-shrink-0 fill-pink-400" />
          <span>Support</span>
        </button>
        {open && <DonateModal onClose={() => setOpen(false)} />}
      </>
    )
  }

  if (variant === 'sidebar-collapsed') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-pink-300 hover:bg-[#312E81] hover:text-pink-200 transition-colors mx-auto"
          title="Support My Work"
        >
          <Heart className="w-4 h-4 fill-pink-400" />
        </button>
        {open && <DonateModal onClose={() => setOpen(false)} />}
      </>
    )
  }

  if (variant === 'public') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-sm"
        >
          <Heart className="w-4 h-4 fill-white" /> Support my work
        </button>
        {open && <DonateModal onClose={() => setOpen(false)} />}
      </>
    )
  }

  if (variant === 'inline') {
    return (
      <>
        <div className="flex items-center justify-center gap-2 pt-1">
          <div className="flex-1 h-px bg-gray-100" />
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-pink-500 hover:text-pink-600 font-medium transition-colors"
          >
            <Heart className="w-3 h-3 fill-pink-400" />
            Support this project
          </button>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
        {open && <DonateModal onClose={() => setOpen(false)} />}
      </>
    )
  }

  // default
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-pink-600 hover:text-pink-700 font-medium"
      >
        <Heart className="w-3.5 h-3.5 fill-pink-500" /> Support
      </button>
      {open && <DonateModal onClose={() => setOpen(false)} />}
    </>
  )
}

export default DonateButton
