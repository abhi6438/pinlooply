import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { planApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import {
  Check, Zap, Loader2, ExternalLink, Star,
  ChevronRight, X, Coffee, Rocket,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, PageHeader } from '../../components/ui'

function SettingsNav() {
  const { pathname } = useLocation()
  const tabs = [
    { to: '/settings/plan',        label: 'Plan & Billing' },
    { to: '/settings/workspace',   label: 'Workspace'      },
    { to: '/settings/automations', label: 'Automations'    },
  ]
  return (
    <div className="flex gap-1 mb-6 bg-warm-100 p-1 rounded-xl w-fit">
      {tabs.map(t => (
        <Link
          key={t.to}
          to={t.to}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            pathname === t.to || (t.to === '/settings/plan' && pathname === '/settings')
              ? 'bg-white text-primary-700 shadow-sm font-semibold'
              : 'text-warm-500 hover:text-warm-800'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

// ── Plan definitions ──────────────────────────────────────────
const BMC_URL = 'https://buymeacoffee.com/pinlooply'

const PLANS = [
  {
    key:   'personal_free',
    label: 'Personal',
    badge: 'Free',
    icon:  '👤',
    features: [
      '3 projects',
      '90 days history',
      'Fast AI processing',
      'Standup generator',
      'Weekly summary',
    ],
    cta: null,
  },
  {
    key:   'group_free',
    label: 'Group',
    badge: 'Free',
    icon:  '👥',
    features: [
      'Everything in Personal',
      'Up to 5 members',
      'Task assignment',
      'Member notifications',
      'Team standup',
    ],
    cta: 'upgrade_free',
    ctaLabel: 'Switch to Group (Free)',
    upgradeMode: 'group',
  },
  {
    key:   'team_paid',
    label: 'Team',
    badge: 'Paid',
    icon:  '🏢',
    price: '$5 / month',
    features: [
      'Unlimited projects',
      'Up to 20 members',
      'Unlimited history',
      'Advanced AI (better quality)',
      'Priority support',
    ],
    cta: 'donate',
    ctaLabel: 'Upgrade to Team',
    upgradeMode: 'team',
  },
  {
    key:   'org_paid',
    label: 'Org',
    badge: 'Paid',
    icon:  '🏗️',
    price: 'Custom',
    features: [
      'Everything in Team',
      'Unlimited members',
      'Multiple teams',
      'Org dashboard',
      'Custom integrations',
    ],
    cta: 'contact',
    ctaLabel: 'Contact Us',
  },
]

// ── Usage bar ─────────────────────────────────────────────────
function UsageBar({ used, max, label }) {
  const isInfinity  = max === Infinity
  const pct         = isInfinity ? 0 : Math.min(100, Math.round((used / max) * 100))
  const isNearLimit = pct >= 80

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-warm-500">{label}</span>
        <span className={`text-xs font-semibold ${isNearLimit && !isInfinity ? 'text-amber-600' : 'text-warm-900'}`}>
          {isInfinity ? `${used} used` : `${used} / ${max}`}
        </span>
      </div>
      {!isInfinity && (
        <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-amber-500' : 'bg-primary-600'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ── Donate & Activate Modal ───────────────────────────────────
function DonateModal({ plan, onClose, onActivate, activating }) {
  const [step, setStep] = useState(1) // 1 = donate prompt, 2 = activate

  function openBmc() {
    window.open(BMC_URL, '_blank', 'noopener,noreferrer')
    setStep(2)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-warm-100 text-warm-400"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <span className="text-4xl">{plan.icon}</span>
          <h2 className="text-lg font-bold text-warm-900 mt-2">Upgrade to {plan.label}</h2>
          {plan.price && (
            <p className="text-sm text-warm-500 mt-0.5">{plan.price} · billed monthly</p>
          )}
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-primary-500' : 'bg-warm-100'}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-primary-500' : 'bg-warm-100'}`} />
        </div>

        {step === 1 ? (
          <>
            <p className="text-sm text-warm-600 mb-5 text-center">
              Pinlooply runs on community support. A one-time or recurring donation on Buy Me a Coffee
              unlocks the Team plan.
            </p>
            <ul className="space-y-2 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-warm-600">
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={openBmc}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Coffee className="w-4 h-4" />
              Support on Buy Me a Coffee
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
            <p className="text-center text-xs text-warm-400 mt-3">
              After donating, come back here and click Activate.
            </p>
          </>
        ) : (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5 text-sm text-emerald-700">
              Thank you for supporting Pinlooply! 🎉 Click below to activate your plan.
            </div>
            <button
              onClick={() => onActivate(plan.upgradeMode)}
              disabled={activating}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
            >
              {activating
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Rocket className="w-4 h-4" />
              }
              {activating ? 'Activating…' : `Activate ${plan.label} Plan`}
            </button>
            <button
              onClick={() => setStep(1)}
              className="w-full text-center text-xs text-warm-400 hover:text-warm-600"
            >
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Plan card ─────────────────────────────────────────────────
function PlanCard({ plan, isCurrent, onUpgrade, onOpenDonate, upgrading }) {
  return (
    <div className={`relative rounded-2xl p-5 flex flex-col gap-4 transition-all ${
      isCurrent ? 'card border-2 border-primary-500' : 'card-hover'
    }`}>
      {isCurrent && (
        <span className="absolute -top-3 left-4 badge badge-purple shadow-sm">
          Current Plan
        </span>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{plan.icon}</span>
          <div>
            <h3 className="text-sm font-bold text-warm-900">{plan.label}</h3>
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              plan.badge === 'Paid' ? 'bg-amber-100 text-amber-700' : 'bg-warm-100 text-warm-500'
            }`}>
              {plan.badge}
            </span>
          </div>
        </div>
        {plan.badge === 'Paid' && <Star className="w-4 h-4 text-amber-400" />}
      </div>

      {plan.price && (
        <p className="text-lg font-bold text-warm-900 -mt-1">{plan.price}</p>
      )}

      {/* Features */}
      <ul className="space-y-1.5 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-warm-500">
            <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      {!isCurrent && plan.cta && (
        <>
          {plan.cta === 'upgrade_free' && (
            <button
              onClick={() => onUpgrade(plan.upgradeMode)}
              disabled={upgrading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {upgrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {plan.ctaLabel}
            </button>
          )}
          {plan.cta === 'donate' && (
            <button
              onClick={() => onOpenDonate(plan)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Coffee className="w-3.5 h-3.5" />
              {plan.ctaLabel}
            </button>
          )}
          {plan.cta === 'contact' && (
            <a
              href="mailto:support@pinlooply.com"
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {plan.ctaLabel}
            </a>
          )}
        </>
      )}

      {isCurrent && (
        <div className="w-full py-2.5 rounded-xl text-xs font-semibold text-center text-primary-700 bg-primary-50">
          ✓ Your current plan
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Plan() {
  const { user } = useAuth()
  const [info, setInfo]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [upgrading, setUpgrading]   = useState(false)
  const [donateModal, setDonateModal] = useState(null) // plan object when open

  useEffect(() => {
    planApi.get().then(res => setInfo(res.data.data))
      .catch(() => toast.error('Failed to load plan info'))
      .finally(() => setLoading(false))
  }, [])

  async function handleUpgrade(mode) {
    setUpgrading(true)
    try {
      await planApi.upgrade(mode)
      toast.success('Plan updated!')
      const res = await planApi.get()
      setInfo(res.data.data)
      setDonateModal(null)
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      const msg = err.response?.data?.error || 'Upgrade failed'
      toast.error(msg)
    } finally {
      setUpgrading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  const currentPlanKey = info?.planKey || 'personal_free'

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        subtitle="Manage your plan and workspace."
      />
      <SettingsNav />

      {/* Current plan summary */}
      {info && (
        <div className="card p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1">
            <p className="text-xs text-warm-400 uppercase tracking-wide font-semibold mb-1">Current Plan</p>
            <h2 className="text-xl font-bold text-warm-900">{info.label}</h2>
            <p className="text-sm text-warm-500 mt-0.5 capitalize">{info.mode} mode · {info.plan}</p>
          </div>
          <div className="flex flex-col gap-3 sm:w-64">
            <UsageBar used={info.usage.projects.used} max={info.usage.projects.max} label="Projects" />
            {info.usage.group_members?.max > 0 && (
              <UsageBar used={info.usage.group_members.used} max={info.usage.group_members.max} label="Team members" />
            )}
          </div>
        </div>
      )}

      {/* Near-limit warning */}
      {info && info.usage.projects.max !== Infinity && info.usage.projects.used >= info.usage.projects.max - 1 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <span className="text-lg">⚠️</span>
          <p className="text-sm text-amber-800">
            You're using {info.usage.projects.used} of {info.usage.projects.max} projects. Upgrade to add more.
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.key}
            plan={plan}
            isCurrent={currentPlanKey === plan.key}
            onUpgrade={handleUpgrade}
            onOpenDonate={setDonateModal}
            upgrading={upgrading}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-warm-400">
        Need help?{' '}
        <a href="mailto:support@pinlooply.com" className="text-primary-600 hover:underline">
          Contact support
        </a>
      </p>

      {/* Donate modal */}
      {donateModal && (
        <DonateModal
          plan={donateModal}
          onClose={() => setDonateModal(null)}
          onActivate={handleUpgrade}
          activating={upgrading}
        />
      )}
    </PageShell>
  )
}
