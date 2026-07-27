import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Heart, X, Copy, Check, ExternalLink } from 'lucide-react'

// UPI deep-link QR
function upiQrUrl(id, name) {
  const data = encodeURIComponent(`upi://pay?pa=${id}&pn=${encodeURIComponent(name)}&cu=INR`)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${data}`
}

// ── Tab button ───────────────────────────────────────────────
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

// ── Main modal ───────────────────────────────────────────────
export function DonateModal({ onClose }) {
  const [tab,    setTab]    = useState(null)   // set after config loads
  const [copied, setCopied] = useState(false)
  const [cfg,    setCfg]    = useState(null)   // fetched from server

  useEffect(() => {
    fetch('/api/public/donate-config')
      .then(r => r.json())
      .then(res => {
        const data = res.data || {}
        setCfg(data)
        // Default to first enabled tab
        if (data.upi)          setTab('upi')
        else if (data.paypal)  setTab('paypal')
        else if (data.buymeacoffee) setTab('bmc')
      })
      .catch(() => {
        // Silently fall back to showing nothing
        setCfg({})
      })
  }, [])

  function copyUpi() {
    navigator.clipboard.writeText(cfg?.upi?.id || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasAny = cfg && (cfg.upi || cfg.paypal || cfg.buymeacoffee)

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
              <h2 className="text-base font-bold">Support Pinlooply</h2>
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
            Donation methods not configured yet.
          </div>
        )}

        {/* Tabs */}
        {hasAny && (
          <>
            <div className="px-4 pt-4">
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
                {cfg.upi          && <Tab active={tab === 'upi'}    onClick={() => setTab('upi')}>🇮🇳 UPI</Tab>}
                {cfg.paypal       && <Tab active={tab === 'paypal'} onClick={() => setTab('paypal')}>💳 PayPal</Tab>}
                {cfg.buymeacoffee && <Tab active={tab === 'bmc'}    onClick={() => setTab('bmc')}>☕ Buy Me a Coffee</Tab>}
              </div>
            </div>

            {/* UPI tab */}
            {tab === 'upi' && cfg.upi && (
              <div className="px-4 pb-6 flex flex-col items-center gap-3">
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
              </div>
            )}

            {/* PayPal tab */}
            {tab === 'paypal' && cfg.paypal && (
              <div className="px-4 pb-6 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                  <span className="text-3xl">💳</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Donate via PayPal</p>
                  <p className="text-xs text-gray-500">Any amount is deeply appreciated</p>
                </div>
                <a
                  href={cfg.paypal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  Donate on PayPal <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {/* Buy Me a Coffee tab */}
            {tab === 'bmc' && cfg.buymeacoffee && (
              <div className="px-4 pb-6 flex flex-col items-center gap-4">
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
                  className="w-full flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-5 py-3 rounded-xl transition-all"
                >
                  ☕ Buy Me a Coffee <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </>
        )}

        {/* Footer note */}
        {hasAny && (
          <div className="px-4 pb-4 text-center">
            <p className="text-[11px] text-gray-400">
              100% goes to the developer. Thank you for your support 🙏
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── Trigger button (inline use) ───────────────────────────────
export function DonateButton({ variant = 'default' }) {
  const [open, setOpen] = useState(false)

  if (variant === 'sidebar') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-pink-300 hover:bg-[#312E81] hover:text-pink-200 transition-colors"
          title="Support Pinlooply"
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
          title="Support Pinlooply"
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
          <Heart className="w-4 h-4 fill-white" /> Support the developer
        </button>
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
