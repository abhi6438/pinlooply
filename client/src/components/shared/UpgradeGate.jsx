import { useNavigate } from 'react-router-dom'
import { Lock, Zap, ArrowRight } from 'lucide-react'

/**
 * UpgradeGate — wraps any feature that requires a higher plan.
 *
 * Props:
 *   locked   (bool)    — if true, renders the upgrade prompt instead of children
 *   plan     (string)  — plan key that unlocks this feature (e.g. 'group_free')
 *   message  (string)  — short message explaining the limit
 *   hint     (string)  — optional one-liner shown below message
 *   inline   (bool)    — if true, renders a small inline banner instead of the full overlay
 *
 * Usage:
 *   <UpgradeGate locked={projects.length >= 3} plan="group_free" message="You've reached 3 projects">
 *     <CreateProjectButton />
 *   </UpgradeGate>
 */

const PLAN_LABELS = {
  group_free: 'Group (Free)',
  team_paid:  'Team (Paid)',
  org_paid:   'Org (Paid)',
}

const PLAN_COLORS = {
  group_free: { bg: 'bg-indigo-50',  border: 'border-indigo-200', btn: 'bg-indigo-600 hover:bg-indigo-700', text: 'text-indigo-700', icon: 'text-indigo-500' },
  team_paid:  { bg: 'bg-violet-50',  border: 'border-violet-200', btn: 'bg-violet-600 hover:bg-violet-700', text: 'text-violet-700', icon: 'text-violet-500' },
  org_paid:   { bg: 'bg-amber-50',   border: 'border-amber-200',  btn: 'bg-amber-500  hover:bg-amber-600',  text: 'text-amber-700',  icon: 'text-amber-500'  },
}

export function UpgradeGate({ locked, plan = 'group_free', message, hint, inline = false, children }) {
  const navigate = useNavigate()
  const colors = PLAN_COLORS[plan] || PLAN_COLORS.group_free
  const planLabel = PLAN_LABELS[plan] || 'higher plan'

  if (!locked) return children

  // ── Inline banner (use inside table rows, compact spaces) ────
  if (inline) {
    return (
      <div className={`flex items-center gap-2.5 ${colors.bg} ${colors.border} border rounded-xl px-3 py-2`}>
        <Lock className={`w-3.5 h-3.5 flex-shrink-0 ${colors.icon}`} />
        <p className={`text-xs ${colors.text} flex-1`}>{message || `Requires ${planLabel}`}</p>
        <button
          onClick={() => navigate('/settings/plan')}
          className={`flex items-center gap-1 text-xs text-white px-2.5 py-1 rounded-lg ${colors.btn} flex-shrink-0`}
        >
          Upgrade <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    )
  }

  // ── Full overlay card ────────────────────────────────────────
  return (
    <div className={`relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-8 text-center flex flex-col items-center gap-4`}>
      <div className={`w-14 h-14 rounded-2xl bg-white border ${colors.border} flex items-center justify-center shadow-sm`}>
        <Lock className={`w-6 h-6 ${colors.icon}`} />
      </div>
      <div>
        <p className="text-base font-bold text-gray-900 mb-1">
          {message || `Requires ${planLabel}`}
        </p>
        {hint && <p className="text-sm text-gray-500">{hint}</p>}
        {!hint && (
          <p className="text-sm text-gray-500">
            Upgrade to <span className="font-semibold">{planLabel}</span> to unlock this feature.
          </p>
        )}
      </div>
      <button
        onClick={() => navigate('/settings/plan')}
        className={`flex items-center gap-2 text-sm text-white px-5 py-2.5 rounded-xl font-semibold ${colors.btn} transition-all shadow-sm`}
      >
        <Zap className="w-4 h-4" />
        View Upgrade Options
      </button>
    </div>
  )
}

/**
 * UpgradeBanner — a dismissible inline banner for soft upgrade prompts.
 * Shown contextually when a user is approaching a limit.
 *
 * Props:
 *   message  (string)
 *   plan     (string)
 *   onDismiss (fn) — optional
 */
export function UpgradeBanner({ message, plan = 'group_free', onDismiss }) {
  const navigate = useNavigate()
  const colors = PLAN_COLORS[plan] || PLAN_COLORS.group_free
  const planLabel = PLAN_LABELS[plan] || 'higher plan'

  return (
    <div className={`flex items-center gap-3 ${colors.bg} border ${colors.border} rounded-xl px-4 py-3`}>
      <Zap className={`w-4 h-4 flex-shrink-0 ${colors.icon}`} />
      <p className={`text-xs ${colors.text} flex-1`}>
        {message || `Upgrade to ${planLabel} to unlock more features.`}
      </p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => navigate('/settings/plan')}
          className={`text-xs text-white px-3 py-1.5 rounded-lg font-medium ${colors.btn} transition-all`}
        >
          Upgrade
        </button>
        {onDismiss && (
          <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-xs">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

export default UpgradeGate
