import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { planApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Check, Zap, Loader2 } from 'lucide-react'
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
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
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
const PLANS = [
  {
    key:         'personal',
    planKey:     'personal_free',
    label:       'Personal',
    icon:        '👤',
    description: 'For individuals tracking their own work.',
    features: [
      'Unlimited projects',
      'Unlimited history',
      'AI task extraction',
      'Standup generator',
      'Weekly summary',
    ],
  },
  {
    key:         'group',
    planKey:     'group_free',
    label:       'Group',
    icon:        '👥',
    description: 'For small teams collaborating together.',
    features: [
      'Everything in Personal',
      'Unlimited team members',
      'Task assignment',
      'Member notifications',
      'Team standup',
    ],
  },
  {
    key:         'team',
    planKey:     'team_paid',
    label:       'Team',
    icon:        '🏢',
    description: 'For growing teams that need more structure.',
    features: [
      'Everything in Group',
      'Multiple workspaces',
      'Advanced board views',
      'Custom status pipelines',
      'Automation rules',
    ],
  },
  {
    key:         'org',
    planKey:     'org_paid',
    label:       'Org',
    icon:        '🏗️',
    description: 'For organisations managing multiple teams.',
    features: [
      'Everything in Team',
      'Multiple teams',
      'Org-level dashboard',
      'Cross-team reporting',
      'Custom integrations',
    ],
  },
]

// ── Plan card ─────────────────────────────────────────────────
function PlanCard({ plan, isCurrent, onSwitch, switching }) {
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
      <div className="flex items-center gap-2">
        <span className="text-2xl">{plan.icon}</span>
        <div>
          <h3 className="text-sm font-bold text-warm-900">{plan.label}</h3>
          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
            Free
          </span>
        </div>
      </div>

      <p className="text-xs text-warm-500 -mt-1">{plan.description}</p>

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
      {isCurrent ? (
        <div className="w-full py-2.5 rounded-xl text-xs font-semibold text-center text-primary-700 bg-primary-50">
          ✓ Your current plan
        </div>
      ) : (
        <button
          onClick={() => onSwitch(plan.key)}
          disabled={switching}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {switching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Switch to {plan.label}
        </button>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Plan() {
  const [info, setInfo]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    planApi.get().then(res => setInfo(res.data.data))
      .catch(() => toast.error('Failed to load plan info'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSwitch(mode) {
    setSwitching(true)
    try {
      await planApi.upgrade(mode)
      toast.success('Plan switched!')
      const res = await planApi.get()
      setInfo(res.data.data)
      setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Switch failed')
    } finally {
      setSwitching(false)
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
        subtitle="Switch between plans anytime — all plans are free."
      />
      <SettingsNav />

      {/* Current plan summary */}
      {info && (
        <div className="card p-5 mb-8 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-warm-400 uppercase tracking-wide font-semibold mb-1">Current Plan</p>
            <h2 className="text-lg font-semibold text-warm-900">{info.label}</h2>
            <p className="text-sm text-warm-500 mt-0.5 capitalize">{info.mode} mode</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Free Forever
          </span>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => (
          <PlanCard
            key={plan.key}
            plan={plan}
            isCurrent={currentPlanKey === plan.planKey}
            onSwitch={handleSwitch}
            switching={switching}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-warm-400">
        All plans include full access to every feature. Switch anytime.
      </p>
    </PageShell>
  )
}
