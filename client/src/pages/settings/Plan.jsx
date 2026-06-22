import { useState, useEffect } from 'react'
import { planApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import {
  Check, Zap, Users, Building2, Crown, Loader2,
  ExternalLink, Star, ChevronRight, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Plan definitions (mirrors server constants) ───────────────
const PLANS = [
  {
    key:   'personal_free',
    label: 'Personal',
    badge: 'Free',
    icon:  '👤',
    color: 'gray',
    features: [
      '3 projects',
      '90 days history',
      'Groq AI (fast)',
      'Standup generator',
      'Weekly summary',
    ],
    cta:      null,
    ctaLabel: null,
  },
  {
    key:   'group_free',
    label: 'Group',
    badge: 'Free',
    icon:  '👥',
    color: 'primary',
    features: [
      'Everything in Personal',
      'Up to 5 members',
      'Task assignment',
      'Member notifications',
      'Team standup',
    ],
    cta:      'upgrade_free',
    ctaLabel: 'Upgrade Free →',
  },
  {
    key:   'team_paid',
    label: 'Team',
    badge: 'Paid',
    icon:  '🏢',
    color: 'violet',
    features: [
      'Unlimited projects',
      'Up to 20 members',
      'Unlimited history',
      'Claude AI (better quality)',
      'Priority support',
    ],
    cta:      'donate',
    ctaLabel: 'Donate / Support →',
    bmcUrl:   'https://buymeacoffee.com',
  },
  {
    key:   'org_paid',
    label: 'Org',
    badge: 'Paid',
    icon:  '🏗️',
    color: 'amber',
    features: [
      'Everything in Team',
      'Unlimited members',
      'Multiple teams',
      'Org dashboard',
      'Custom integrations',
    ],
    cta:      'contact',
    ctaLabel: 'Contact Us →',
  },
]

// ── Usage bar ─────────────────────────────────────────────────
function UsageBar({ used, max, label }) {
  const pct         = max === Infinity ? 0 : Math.min(100, Math.round((used / max) * 100))
  const isInfinity  = max === Infinity
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

// ── Plan card ─────────────────────────────────────────────────
function PlanCard({ plan, isCurrent, onUpgrade, upgrading }) {
  return (
    <div className={`relative rounded-2xl p-5 flex flex-col gap-4 transition-all ${
      isCurrent
        ? 'card border-2 border-primary-500'
        : 'card-hover'
    }`}>
      {/* Current badge */}
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
              plan.badge === 'Paid'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-warm-100 text-warm-500'
            }`}>
              {plan.badge}
            </span>
          </div>
        </div>
        {plan.badge === 'Paid' && <Star className="w-4 h-4 text-amber-400" />}
      </div>

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
      {plan.cta && !isCurrent && (
        <>
          {plan.cta === 'upgrade_free' && (
            <button
              onClick={() => onUpgrade('group')}
              disabled={upgrading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {upgrading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              {plan.ctaLabel}
            </button>
          )}
          {plan.cta === 'donate' && (
            <a
              href={plan.bmcUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {plan.ctaLabel}
            </a>
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
  const [info, setInfo]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    planApi.get().then(res => {
      setInfo(res.data.data)
    }).catch(() => {
      toast.error('Failed to load plan info')
    }).finally(() => setLoading(false))
  }, [])

  async function handleUpgrade(mode) {
    setUpgrading(true)
    try {
      await planApi.upgrade(mode)
      toast.success('Plan updated! Refreshing…')
      const res = await planApi.get()
      setInfo(res.data.data)
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upgrade failed')
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
    <div className="max-w-5xl mx-auto px-6 py-6 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-warm-900">Plan & Billing 💳</h1>
        <p className="text-sm text-warm-500 mt-1">Manage your plan and see what's included.</p>
      </div>

      {/* Current plan summary */}
      {info && (
        <div className="card p-5 mb-8 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex-1">
            <p className="text-xs text-warm-400 uppercase tracking-wide font-semibold mb-1">Current Plan</p>
            <h2 className="text-xl font-bold text-warm-900">{info.label}</h2>
            <p className="text-sm text-warm-500 mt-0.5 capitalize">{info.mode} mode · {info.plan}</p>
          </div>
          <div className="flex flex-col gap-3 sm:w-64">
            <UsageBar
              used={info.usage.projects.used}
              max={info.usage.projects.max}
              label="Projects"
            />
            {info.usage.group_members.max > 0 && (
              <UsageBar
                used={info.usage.group_members.used}
                max={info.usage.group_members.max}
                label="Team members"
              />
            )}
          </div>
        </div>
      )}

      {/* Near-limit warning */}
      {info && info.usage.projects.max !== Infinity &&
        info.usage.projects.used >= info.usage.projects.max - 1 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <span className="text-lg">⚠️</span>
          <p className="text-sm text-amber-800">
            You're using {info.usage.projects.used} of {info.usage.projects.max} projects.
            Upgrade to add more.
          </p>
        </div>
      )}

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.key}
            plan={plan}
            isCurrent={currentPlanKey === plan.key}
            onUpgrade={handleUpgrade}
            upgrading={upgrading}
          />
        ))}
      </div>

      {/* Paid upgrade note */}
      <div className="mt-6 text-center text-xs text-warm-400">
        Paid plans (Team & Org) are activated after donation confirmation.
        <a href="mailto:support@pinlooply.com" className="text-primary-600 hover:underline ml-1">
          Contact us
        </a> after donating.
      </div>
    </div>
  )
}
