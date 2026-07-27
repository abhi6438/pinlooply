import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../services/api'
import {
  Settings, Users, BarChart3, Shield, Loader2,
  Save, CheckCheck, Search, ChevronDown, AlertCircle,
  Cpu, Crown, RefreshCw, TrendingUp, FolderOpen,
  MessageSquare, CheckSquare2, GitBranch, Heart,
  Star, HandCoins, Mail, Send, X, LayoutDashboard,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

// ── Admin email (must match server ADMIN_EMAIL) ────────────────
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

// ── Tab navigation ─────────────────────────────────────────────
const TABS = [
  { id: 'ai',       label: 'AI Config',       icon: Cpu          },
  { id: 'users',    label: 'User Stats',      icon: Users        },
  { id: 'usage',    label: 'Usage Stats',     icon: BarChart3    },
  { id: 'plans',    label: 'Plan Management', icon: Crown        },
  { id: 'menus',    label: 'Menu Config',     icon: LayoutDashboard },
  { id: 'donate',   label: 'Donation',        icon: Heart        },
  { id: 'feedback', label: 'Feedback',        icon: Star         },
  { id: 'donors',   label: 'Donors',          icon: HandCoins    },
]

// ── All configurable module definitions ──────────────────────────
const MODULE_DEFS = [
  { key: 'projects',  icon: '📁', label: 'Projects',      desc: 'Project boards and tracking' },
  { key: 'tasks',     icon: '✅', label: 'Tasks / Lists',  desc: 'Task lists and assignments' },
  { key: 'timeline',  icon: '📅', label: 'Timeline',      desc: 'Gantt / calendar view' },
  { key: 'topics',    icon: '🏷️', label: 'Topics',        desc: 'Decisions and discussion topics' },
  { key: 'standup',   icon: '📋', label: 'Standup',       desc: 'Daily standup generator' },
  { key: 'summary',   icon: '📊', label: 'Weekly Summary', desc: 'Auto weekly report' },
  { key: 'testcases', icon: '🧪', label: 'Test Cases',    desc: 'QA test case management' },
]

const ALWAYS_ON = [
  { icon: '🏠', label: 'Dashboard' },
  { icon: '💬', label: 'Log Discussion' },
  { icon: '✔️', label: 'My Tasks' },
  { icon: '⏱️', label: 'Time Reports' },
  { icon: '⚙️', label: 'Settings' },
  { icon: '❓', label: 'Help' },
  { icon: '👥', label: 'Team (in team mode)' },
  { icon: '📈', label: 'Manager (in team mode)' },
]

// ── Tab: Menu Config (admin-level global module toggles) ──────────
function MenuConfigTab() {
  const [menus,   setMenus]   = useState(null)  // array from DB
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    adminApi.getMenus()
      .then(res => setMenus(res.data.data || []))
      .catch(() => {
        // Fall back to old API if migration not run yet
        adminApi.getModuleConfig()
          .then(res => {
            const enabled = res.data.data || MODULE_DEFS.map(m => m.key)
            setMenus(MODULE_DEFS.map(m => ({
              ...m, always_on: false, disabled: !enabled.includes(m.key),
            })))
          })
          .catch(() => toast.error('Failed to load menu config'))
      })
      .finally(() => setLoading(false))
  }, [])

  function toggle(key) {
    setMenus(prev => prev.map(m => m.key === key ? { ...m, disabled: !m.disabled } : m))
  }

  async function save() {
    setSaving(true)
    try {
      const disabledKeys = menus.filter(m => !m.always_on && m.disabled).map(m => m.key)
      await adminApi.saveMenus(disabledKeys)
      setSaved(true)
      toast.success('Menu configuration saved for all users')
      setTimeout(() => setSaved(false), 2500)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary-600 animate-spin" /></div>

  const alwaysOnMenus  = menus.filter(m => m.always_on)
  const configMenus    = menus.filter(m => !m.always_on)

  return (
    <div className="max-w-xl space-y-6">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
        <strong>Platform-wide control.</strong> Items disabled here are hidden for <em>all</em> users regardless of their personal settings. Team owners can further restrict their group's access within what you enable.
      </div>

      {/* Always-on section */}
      {alwaysOnMenus.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-3">Always visible — can't be turned off</h3>
          <div className="grid grid-cols-2 gap-2">
            {alwaysOnMenus.map(m => (
              <div key={m.key} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-warm-100 bg-warm-50">
                <span className="text-sm">{m.icon}</span>
                <span className="text-xs text-warm-600 font-medium">{m.label}</span>
                <span className="ml-auto text-[10px] text-emerald-500 font-semibold">Always on</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configurable modules */}
      <div>
        <h3 className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-3">Configurable modules</h3>
        <div className="space-y-2">
          {configMenus.map(m => {
            const enabled = !m.disabled
            return (
              <div
                key={m.key}
                onClick={() => toggle(m.key)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                  enabled
                    ? 'border-primary-200 bg-primary-50 hover:bg-primary-100'
                    : 'border-warm-200 bg-white hover:bg-warm-50 opacity-60'
                }`}
              >
                <span className="text-lg">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-warm-900">{m.label}</p>
                  <p className="text-xs text-warm-500">{m.desc || m.description}</p>
                </div>
                <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-primary-600' : 'bg-warm-200'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="btn-primary flex items-center gap-2 px-6 disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCheck className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Saved!' : saving ? 'Saving…' : 'Save menu config'}
      </button>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, iconBg, iconColor, icon: Icon }) {
  return (
    <div className="card p-4">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-sm font-semibold text-warm-900">{value}</p>
      <p className="text-xs font-medium text-warm-900 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-warm-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Tab 1: AI Config ──────────────────────────────────────────
function AIConfigTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [configs, setConfigs] = useState({ free: {}, paid: {} })

  useEffect(() => {
    adminApi.getAiConfig().then(res => {
      const d = res.data.data
      setData(d)
      const cfgMap = {}
      for (const c of d.configs || []) cfgMap[c.plan_type] = c
      setConfigs({
        free: { provider: cfgMap.free?.provider || 'groq', model_name: cfgMap.free?.model_name || '' },
        paid: { provider: cfgMap.paid?.provider || 'claude', model_name: cfgMap.paid?.model_name || '' },
      })
    }).catch(() => toast.error('Failed to load AI config'))
    .finally(() => setLoading(false))
  }, [])

  function setField(plan, field, value) {
    setConfigs(c => ({ ...c, [plan]: { ...c[plan], [field]: value } }))
  }

  function setProvider(plan, provider) {
    const firstModel = data?.providers?.[provider]?.models?.[0] || ''
    setConfigs(c => ({ ...c, [plan]: { provider, model_name: firstModel } }))
  }

  async function save() {
    setSaving(true)
    try {
      await adminApi.saveAiConfig([
        { plan_type: 'free', ...configs.free },
        { plan_type: 'paid', ...configs.paid },
      ])
      setSaved(true)
      toast.success('AI config saved!')
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
    </div>
  )

  const providers = Object.entries(data?.providers || {})

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Plan rows */}
      {[
        { key: 'free', label: 'Free Plan',  badgeCls: 'badge' },
        { key: 'paid', label: 'Paid Plan',  badgeCls: 'badge badge-purple' },
      ].map(({ key, label, badgeCls }) => {
        const cfg    = configs[key]
        const models = data?.providers?.[cfg.provider]?.models || []
        return (
          <div key={key} className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className={badgeCls}>{label}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">AI Provider</label>
                <div className="relative">
                  <select
                    value={cfg.provider}
                    onChange={e => setProvider(key, e.target.value)}
                    className="input appearance-none pr-8"
                  >
                    {providers.map(([pk, pv]) => (
                      <option key={pk} value={pk}>{pv.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-warm-400 absolute right-2.5 top-3 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="label">Model</label>
                <div className="relative">
                  <select
                    value={cfg.model_name}
                    onChange={e => setField(key, 'model_name', e.target.value)}
                    className="input appearance-none pr-8"
                  >
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-warm-400 absolute right-2.5 top-3 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Provider overview */}
      <div className="card p-5">
        <h3 className="section-title mb-3">Available Providers</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {providers.map(([pk, pv]) => {
            const inUse = configs.free.provider === pk || configs.paid.provider === pk
            return (
              <div key={pk} className={`rounded-xl border p-3 ${inUse ? 'border-primary-200 bg-primary-50' : 'border-warm-200 bg-warm-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${inUse ? 'bg-primary-500' : 'bg-warm-300'}`} />
                  <span className="text-xs font-semibold text-warm-900">{pv.label}</span>
                </div>
                <div className="space-y-0.5">
                  {pv.models.map(m => (
                    <p key={m} className="text-[11px] text-warm-400 truncate">{m}</p>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={save}
        disabled={saving}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
          saved ? 'bg-emerald-600 text-white' : 'btn-primary'
        } disabled:opacity-50`}
      >
        {saving   ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        : saved   ? <><CheckCheck className="w-4 h-4" /> Saved!</>
        : <><Save className="w-4 h-4" /> Save Changes</>}
      </button>
    </div>
  )
}

// ── Tab 2: User Stats ─────────────────────────────────────────
function UserStatsTab({ stats }) {
  if (!stats) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
    </div>
  )

  const { users } = stats

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users"   value={users.total}             icon={Users}      iconBg="bg-primary-100"  iconColor="text-primary-600" />
        <StatCard label="New This Week" value={users.newThisWeek}       icon={TrendingUp} iconBg="bg-emerald-100"  iconColor="text-emerald-600" />
        <StatCard label="Free"          value={users.byPlan?.free || 0} icon={Shield}     iconBg="bg-warm-100"     iconColor="text-warm-500" />
        <StatCard label="Paid"          value={users.byPlan?.paid || 0} icon={Crown}      iconBg="bg-amber-100"    iconColor="text-amber-600" />
      </div>

      {/* Mode breakdown */}
      <div className="card p-5">
        <h3 className="section-title mb-4">Users by Mode</h3>
        <div className="space-y-3">
          {[
            { key: 'personal', label: '👤 Personal', color: 'bg-warm-400' },
            { key: 'group',    label: '👥 Group',    color: 'bg-primary-500' },
            { key: 'team',     label: '🏢 Team',     color: 'bg-primary-700' },
            { key: 'org',      label: '🏗️ Org',      color: 'bg-amber-500'  },
          ].map(({ key, label, color }) => {
            const count = users.byMode?.[key] || 0
            const pct   = users.total > 0 ? Math.round((count / users.total) * 100) : 0
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-warm-900">{label}</span>
                  <span className="text-xs font-semibold text-warm-900">{count} <span className="text-warm-400 font-normal">({pct}%)</span></span>
                </div>
                <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent signups table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-warm-100">
          <h3 className="section-title">Recent Signups</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-warm-50">
              <tr>
                {['Email', 'Name', 'Mode', 'Plan', 'Joined'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-warm-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100">
              {(users.recent || []).map((u, idx) => (
                <tr key={u.id} className={`hover:bg-warm-50 transition-colors ${idx % 2 === 1 ? 'bg-warm-50/40' : ''}`}>
                  <td className="px-4 py-2.5 text-warm-900 font-medium">{u.email}</td>
                  <td className="px-4 py-2.5 text-warm-500">{u.name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="badge capitalize">{u.mode}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`badge capitalize ${u.plan === 'paid' ? 'badge-purple' : ''}`}>{u.plan}</span>
                  </td>
                  <td className="px-4 py-2.5 text-warm-400">
                    {u.created_at ? format(parseISO(u.created_at), 'MMM d, yyyy') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Mini stacked bar chart (pure SVG, no deps) ───────────────
function BarChart({ data, keys, colors, height = 140 }) {
  if (!data?.length) return <p className="text-xs text-warm-400 py-4 text-center">No data yet</p>
  const maxVal = Math.max(...data.map(d => keys.reduce((s, k) => s + (d[k] || 0), 0)), 1)
  const barW   = Math.max(16, Math.min(48, Math.floor(560 / data.length) - 8))
  const gap    = 8
  const totalW = data.length * (barW + gap)
  return (
    <div className="overflow-x-auto">
      <svg width={Math.max(totalW, 400)} height={height + 32} className="block mx-auto">
        {data.map((d, i) => {
          const x = i * (barW + gap) + gap / 2
          // Build segments bottom-up
          let segments = []
          let yOff = height
          for (let ki = 0; ki < keys.length; ki++) {
            const val = d[keys[ki]] || 0
            const h   = Math.round((val / maxVal) * height)
            yOff -= h
            segments.push({ key: keys[ki], val, h, y: yOff, color: colors[ki] })
          }
          return (
            <g key={i}>
              {segments.map(({ key, val, h, y, color }) => (
                <g key={key}>
                  <rect x={x} y={y} width={barW} height={h} fill={color} rx={3} opacity={0.85} />
                  {h > 14 && (
                    <text x={x + barW / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={9} fill="#fff" fontWeight="600">{val}</text>
                  )}
                </g>
              ))}
              <text x={x + barW / 2} y={height + 20} textAnchor="middle" fontSize={9} fill="#9ca3af">
                {String(d.label || '').slice(0, 10)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Horizontal progress bar ───────────────────────────────────
function HBar({ label, sub, value, max, color = 'bg-primary-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-warm-900 truncate max-w-[180px]">{label}</span>
          {sub && <span className="text-[11px] text-warm-400 hidden sm:inline">{sub}</span>}
        </div>
        <span className="text-xs font-bold text-warm-900 ml-2 shrink-0">{value}</span>
      </div>
      <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Chart legend ─────────────────────────────────────────────
function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
          <span className="text-[11px] text-warm-500">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tab 3: Usage Stats ────────────────────────────────────────
const CHART_COLORS = {
  tasks:       '#6366f1',
  discussions: '#10b981',
  topics:      '#f59e0b',
}

function UsageStatsTab({ stats }) {
  const [subTab,     setSubTab]     = useState('overview')
  const [detail,     setDetail]     = useState(null)
  const [detLoading, setDetLoading] = useState(true)

  useEffect(() => {
    adminApi.getDetailedUsage()
      .then(r => setDetail(r.data.data))
      .catch(() => {})
      .finally(() => setDetLoading(false))
  }, [])

  if (!stats) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
    </div>
  )

  const { content, users } = stats
  const paidUsers    = users?.byPlan?.paid  || 0
  const freeUsers    = (users?.total || 0) - paidUsers
  const estPaidCalls = paidUsers * 10
  const estFreeCalls = freeUsers * 10
  const estCostUSD   = (estPaidCalls * 2 * 0.003).toFixed(2)

  const SUB_TABS = [
    { id: 'overview', label: 'Overview'   },
    { id: 'user',     label: 'By User'    },
    { id: 'project',  label: 'By Project' },
    { id: 'trends',   label: 'Trends'     },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Sub-tab pills — styled as a segmented row */}
      <div className="flex gap-0 bg-warm-100 p-1 rounded-xl w-fit">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              subTab === t.id
                ? 'bg-white text-primary-700 shadow-sm font-semibold'
                : 'text-warm-500 hover:text-warm-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────── */}
      {subTab === 'overview' && (
        <div className="space-y-5">
          {/* All-time content totals — single row */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Platform Totals (All Time)</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {[
                { label: 'Discussions', value: content.discussions || 0, icon: MessageSquare, bg: 'bg-primary-50',  iconColor: 'text-primary-600',  border: 'border-primary-100' },
                { label: 'Tasks',       value: content.tasks        || 0, icon: CheckSquare2,  bg: 'bg-emerald-50', iconColor: 'text-emerald-600', border: 'border-emerald-100' },
                { label: 'Topics',      value: content.topics       || 0, icon: GitBranch,     bg: 'bg-amber-50',   iconColor: 'text-amber-600',   border: 'border-amber-100'  },
                { label: 'Projects',    value: content.projects     || 0, icon: FolderOpen,    bg: 'bg-warm-50',    iconColor: 'text-warm-500',    border: 'border-warm-200'   },
                { label: 'Conflicts',   value: content.conflicts    || 0, icon: AlertCircle,   bg: 'bg-red-50',     iconColor: 'text-red-500',     border: 'border-red-100'    },
              ].map(({ label, value, icon: Icon, bg, iconColor, border }) => (
                <div key={label} className={`rounded-xl ${bg} border ${border} p-3 text-center`}>
                  <Icon className={`w-5 h-5 ${iconColor} mx-auto mb-2`} />
                  <p className="text-sm font-semibold text-warm-900">{value}</p>
                  <p className="text-[11px] text-warm-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Activity by mode — last 8 weeks */}
          {detLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-primary-600 animate-spin" /></div>
          ) : detail && (() => {
            const allTot = Object.values(detail.byMode || {}).reduce((s, mm) => s + (mm.tasks || 0) + (mm.discussions || 0) + (mm.topics || 0), 0)
            const MODES = [
              { key: 'personal', label: '👤 Personal', color: 'bg-warm-400'     },
              { key: 'group',    label: '👥 Group',    color: 'bg-primary-500'  },
              { key: 'team',     label: '🏢 Team',     color: 'bg-primary-700'  },
              { key: 'org',      label: '🏗️ Org',      color: 'bg-amber-500'    },
            ]
            return (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="section-title">Activity by Mode</h3>
                  <span className="text-xs text-warm-400 bg-warm-50 px-2 py-1 rounded-lg border border-warm-100">Last 8 weeks</span>
                </div>
                {allTot === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-warm-400">No activity recorded in the last 8 weeks yet.</p>
                    <p className="text-xs text-warm-300 mt-1">Activity will appear here once users create tasks, discussions, or topics.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {MODES.map(({ key, label, color }) => {
                      const m   = detail.byMode?.[key] || {}
                      const tot = (m.tasks || 0) + (m.discussions || 0) + (m.topics || 0)
                      const pct = allTot > 0 ? Math.round((tot / allTot) * 100) : 0
                      return (
                        <div key={key} className="rounded-xl bg-warm-50 border border-warm-100 p-3">
                          <p className="text-sm font-semibold text-warm-900 mb-1">{label}</p>
                          <p className="text-sm font-semibold text-warm-900">{tot}</p>
                          <p className="text-[11px] text-warm-400 mt-0.5">{pct}% of activity</p>
                          <div className="mt-2 h-1.5 bg-warm-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-2 space-y-0.5">
                            <p className="text-[10px] text-warm-400">Tasks: <span className="font-semibold text-warm-700">{m.tasks||0}</span></p>
                            <p className="text-[10px] text-warm-400">Discussions: <span className="font-semibold text-warm-700">{m.discussions||0}</span></p>
                            <p className="text-[10px] text-warm-400">Topics: <span className="font-semibold text-warm-700">{m.topics||0}</span></p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

          {/* AI estimate */}
          <div className="card p-5">
            <h3 className="section-title mb-4">AI Usage Estimate (This Month)</h3>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div className="text-center p-3 bg-warm-50 rounded-xl border border-warm-100">
                <p className="text-sm font-semibold text-warm-900">{estFreeCalls}</p>
                <p className="text-xs text-warm-500 mt-1">Est. AI calls (Free)</p>
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Free tier</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-sm font-semibold text-warm-900">{estPaidCalls}</p>
                <p className="text-xs text-warm-500 mt-1">Est. AI calls (Paid)</p>
                <p className="text-[11px] text-amber-600 font-medium mt-0.5">Paid tier</p>
              </div>
              <div className="text-center p-3 bg-primary-50 rounded-xl border border-primary-100">
                <p className="text-sm font-semibold text-warm-900">${estCostUSD}</p>
                <p className="text-xs text-warm-500 mt-1">Est. AI cost</p>
                <p className="text-[11px] text-primary-600 font-medium mt-0.5">This month</p>
              </div>
            </div>
            <p className="text-xs text-warm-400">
              Estimates based on {users?.total || 0} users × ~10 AI calls/month × ~2k tokens/call.
            </p>
          </div>
        </div>
      )}

      {/* ── By User ──────────────────────────────────────── */}
      {subTab === 'user' && (
        <div className="space-y-5">
          {detLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary-600 animate-spin" /></div>
          ) : !detail?.byUser?.length ? (
            <p className="text-center text-warm-400 py-16 text-sm">No activity data yet (last 8 weeks)</p>
          ) : (
            <>
              <div className="card p-5">
                <h3 className="section-title mb-3">Top Contributors (Last 8 Weeks)</h3>
                <BarChart
                  data={detail.byUser.slice(0, 10).map(u => ({
                    label:       (u.name || u.email || '').split('@')[0].slice(0, 10),
                    tasks:       u.tasks,
                    discussions: u.discussions,
                    topics:      u.topics,
                  }))}
                  keys={['tasks', 'discussions', 'topics']}
                  colors={[CHART_COLORS.tasks, CHART_COLORS.discussions, CHART_COLORS.topics]}
                />
                <Legend items={[
                  { color: CHART_COLORS.tasks,       label: 'Tasks' },
                  { color: CHART_COLORS.discussions,  label: 'Discussions' },
                  { color: CHART_COLORS.topics,       label: 'Topics' },
                ]} />
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-warm-100">
                  <h3 className="section-title">All Users Activity</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-warm-50">
                      <tr>
                        {['User', 'Mode', 'Tasks', 'Discussions', 'Topics', 'Total'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-semibold text-warm-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-100">
                      {detail.byUser.map((u, idx) => (
                        <tr key={u.userId} className={`hover:bg-warm-50 transition-colors ${idx % 2 === 1 ? 'bg-warm-50/40' : ''}`}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-warm-900 truncate max-w-[160px]">{u.name || u.email}</p>
                            {u.name && <p className="text-warm-400 text-[11px] truncate max-w-[160px]">{u.email}</p>}
                          </td>
                          <td className="px-4 py-2.5"><span className="badge capitalize">{u.mode}</span></td>
                          <td className="px-4 py-2.5 font-semibold text-indigo-600">{u.tasks}</td>
                          <td className="px-4 py-2.5 font-semibold text-emerald-600">{u.discussions}</td>
                          <td className="px-4 py-2.5 font-semibold text-amber-600">{u.topics}</td>
                          <td className="px-4 py-2.5 font-bold text-warm-900">{u.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── By Project ───────────────────────────────────── */}
      {subTab === 'project' && (
        <div className="space-y-5">
          {detLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary-600 animate-spin" /></div>
          ) : !detail?.byProject?.length ? (
            <p className="text-center text-warm-400 py-16 text-sm">No activity data yet (last 8 weeks)</p>
          ) : (
            <>
              <div className="card p-5">
                <h3 className="section-title mb-3">Project Activity (Last 8 Weeks)</h3>
                <BarChart
                  data={detail.byProject.slice(0, 10).map(p => ({
                    label:       (p.name || '').slice(0, 10),
                    tasks:       p.tasks,
                    discussions: p.discussions,
                    topics:      p.topics,
                  }))}
                  keys={['tasks', 'discussions', 'topics']}
                  colors={[CHART_COLORS.tasks, CHART_COLORS.discussions, CHART_COLORS.topics]}
                />
                <Legend items={[
                  { color: CHART_COLORS.tasks,       label: 'Tasks' },
                  { color: CHART_COLORS.discussions,  label: 'Discussions' },
                  { color: CHART_COLORS.topics,       label: 'Topics' },
                ]} />
              </div>

              <div className="card p-5">
                <h3 className="section-title mb-4">All Projects</h3>
                {detail.byProject.map(p => (
                  <HBar
                    key={p.projectId}
                    label={p.name}
                    value={p.total}
                    max={detail.byProject[0]?.total || 1}
                    color="bg-primary-500"
                    sub={`Tasks:${p.tasks}  Discussions:${p.discussions}  Topics:${p.topics}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Trends ───────────────────────────────────────── */}
      {subTab === 'trends' && (
        <div className="space-y-5">
          {detLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary-600 animate-spin" /></div>
          ) : !detail?.trend?.length ? (
            <p className="text-center text-warm-400 py-16 text-sm">No trend data yet</p>
          ) : (
            <>
              <div className="card p-5">
                <h3 className="section-title mb-1">Weekly Activity (Last 8 Weeks)</h3>
                <p className="text-xs text-warm-400 mb-4">Tasks, discussions, and topics created per week</p>
                <BarChart
                  data={detail.trend}
                  keys={['tasks', 'discussions', 'topics']}
                  colors={[CHART_COLORS.tasks, CHART_COLORS.discussions, CHART_COLORS.topics]}
                  height={160}
                />
                <Legend items={[
                  { color: CHART_COLORS.tasks,       label: 'Tasks' },
                  { color: CHART_COLORS.discussions,  label: 'Discussions' },
                  { color: CHART_COLORS.topics,       label: 'Topics' },
                ]} />
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-warm-100">
                  <h3 className="section-title">Week-by-Week Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-warm-50">
                      <tr>
                        {['Week', 'Tasks', 'Discussions', 'Topics', 'Total'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-semibold text-warm-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-100">
                      {detail.trend.map((w, idx) => {
                        const total  = w.tasks + w.discussions + w.topics
                        const isLast = idx === detail.trend.length - 1
                        return (
                          <tr key={w.label} className={`hover:bg-warm-50 transition-colors ${idx % 2 === 1 ? 'bg-warm-50/40' : ''}`}>
                            <td className="px-4 py-2.5 font-medium text-warm-900">
                              {w.label} {isLast && <span className="badge text-[10px] px-1.5 ml-1">Current</span>}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-indigo-600">{w.tasks}</td>
                            <td className="px-4 py-2.5 font-semibold text-emerald-600">{w.discussions}</td>
                            <td className="px-4 py-2.5 font-semibold text-amber-600">{w.topics}</td>
                            <td className="px-4 py-2.5 font-bold text-warm-900">{total}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab 4: Plan Management ────────────────────────────────────
function PlanManagementTab() {
  const [search,   setSearch]   = useState('')
  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [updating, setUpdating] = useState(null)

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers(q)
      setUsers(res.data.data || [])
    } catch { toast.error('Failed to load users') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function updatePlan(userId, plan, mode) {
    setUpdating(userId)
    try {
      await adminApi.updateUserPlan(userId, { plan, mode })
      toast.success('Plan updated')
      load(search)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally { setUpdating(null) }
  }

  function handleSearch(e) {
    e.preventDefault()
    load(search)
  }

  const MODE_OPTIONS = ['personal', 'group', 'team', 'org']

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-warm-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="input pl-9"
          />
        </div>
        <button type="submit" className="btn-primary px-4">
          Search
        </button>
        <button
          type="button"
          onClick={() => { setSearch(''); load('') }}
          className="btn-ghost p-2.5"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </form>

      {/* User table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-warm-50">
                <tr>
                  {['Email', 'Name', 'Mode', 'Plan', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold text-warm-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-warm-400">No users found</td>
                  </tr>
                )}
                {users.map((u, idx) => (
                  <tr key={u.id} className={`hover:bg-warm-50 transition-colors ${idx % 2 === 1 ? 'bg-warm-50/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-warm-900">{u.email}</td>
                    <td className="px-4 py-3 text-warm-500">{u.name || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.mode}
                        disabled={!!updating}
                        onChange={e => updatePlan(u.id, u.plan, e.target.value)}
                        className="input py-1 text-xs"
                      >
                        {MODE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.plan}
                        disabled={!!updating}
                        onChange={e => updatePlan(u.id, e.target.value, u.mode)}
                        className={`input py-1 text-xs ${
                          u.plan === 'paid' ? 'border-amber-200 bg-amber-50 text-amber-700' : ''
                        }`}
                      >
                        <option value="free">free</option>
                        <option value="paid">paid</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-warm-400">
                      {u.created_at ? format(parseISO(u.created_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {updating === u.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-600" />
                        : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => updatePlan(u.id, 'paid', 'team')}
                              className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                              title="Upgrade to Team (paid)"
                            >
                              → Team
                            </button>
                            <button
                              onClick={() => updatePlan(u.id, 'free', 'personal')}
                              className="text-[11px] bg-warm-50 text-warm-500 border border-warm-200 px-2 py-1 rounded-lg hover:bg-warm-100 transition-colors"
                              title="Downgrade to Personal (free)"
                            >
                              ↓ Free
                            </button>
                          </div>
                        )
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline reply thread for a feedback card ───────────────────
function FeedbackThread({ feedbackId, onReplySent }) {
  const [replies,  setReplies]  = useState(null)   // null = not loaded yet
  const [open,     setOpen]     = useState(false)
  const [text,     setText]     = useState('')
  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState('')

  async function load() {
    if (replies !== null) return // already loaded
    try {
      const res = await adminApi.getFeedbackReplies(feedbackId)
      setReplies(res.data.data || [])
    } catch { setReplies([]) }
  }

  function toggle() {
    if (!open) load()
    setOpen(o => !o)
  }

  async function sendReply() {
    if (!text.trim()) return
    setSending(true)
    setError('')
    try {
      await adminApi.replyFeedback(feedbackId, text.trim())
      const newReply = { id: Date.now(), sender: 'admin', message: text.trim(), created_at: new Date().toISOString() }
      setReplies(prev => [...(prev || []), newReply])
      setText('')
      toast.success('Reply sent & user notified!')
      onReplySent?.()
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to send reply')
    } finally { setSending(false) }
  }

  const SENDER_STYLE = {
    system: { bg: 'bg-blue-50 border-blue-100',  label: 'System',  labelClass: 'text-blue-500' },
    admin:  { bg: 'bg-primary-50 border-primary-100', label: 'You', labelClass: 'text-primary-600' },
    user:   { bg: 'bg-warm-50 border-warm-100',   label: 'User',   labelClass: 'text-warm-600' },
  }

  return (
    <div className="mt-2 border-t border-warm-100 pt-2">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        <MessageSquare className="w-3 h-3" />
        {open ? 'Hide thread' : 'View / Reply'}
        {replies !== null && replies.length > 0 && (
          <span className="bg-primary-100 text-primary-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {replies.length}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Thread messages */}
          {replies === null ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
            </div>
          ) : replies.length === 0 ? (
            <p className="text-xs text-warm-400 italic">No messages yet.</p>
          ) : (
            replies.map(r => {
              const s = SENDER_STYLE[r.sender] || SENDER_STYLE.system
              return (
                <div key={r.id} className={`rounded-xl border px-3 py-2.5 ${s.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${s.labelClass}`}>{s.label}</span>
                    <span className="text-[10px] text-warm-400">
                      {r.created_at ? format(new Date(r.created_at), 'MMM d · h:mm a') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-warm-800 leading-relaxed">{r.message}</p>
                </div>
              )
            })
          )}

          {/* Reply input */}
          <div className="flex gap-2 pt-1">
            <textarea
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply() }}
              placeholder="Write a reply… (⌘Enter to send)"
              className="input flex-1 resize-none text-xs leading-relaxed"
            />
            <button
              onClick={sendReply}
              disabled={sending || !text.trim()}
              className="self-end flex items-center gap-1 btn-primary px-3 py-2 text-xs disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}

// ── Tab: Feedback ─────────────────────────────────────────────
const CATEGORY_COLORS = {
  bug:     'bg-red-100 text-red-700',
  feature: 'bg-purple-100 text-purple-700',
  general: 'bg-blue-100 text-blue-700',
}
const CATEGORY_LABELS = { bug: '🐛 Bug', feature: '✨ Feature', general: '💬 General' }

function FeedbackTab() {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await adminApi.getFeedback({ limit: 100 })
      setItems(res.data.data || [])
    } catch { toast.error('Failed to load feedback') }
    finally { setLoading(false) }
  }

  const filtered = filter === 'all' ? items : items.filter(f => f.category === filter)
  const counts   = { all: items.length, bug: 0, feature: 0, general: 0 }
  for (const f of items) if (counts[f.category] !== undefined) counts[f.category]++

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary-600 animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'bug', 'feature', 'general'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              filter === cat
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-warm-500 border-warm-200 hover:border-warm-300'
            }`}
          >
            {cat === 'all' ? `All (${counts.all})` : `${CATEGORY_LABELS[cat]} (${counts[cat]})`}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 rounded-lg hover:bg-warm-100 text-warm-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-warm-400 text-sm">No feedback yet</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => (
            <div key={f.id} className="card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[f.category] || 'bg-warm-100 text-warm-500'}`}>
                    {CATEGORY_LABELS[f.category] || f.category}
                  </span>
                  {f.rating && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-500 font-semibold">
                      {'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}
                      <span className="text-warm-400 font-normal ml-1">{f.rating}/5</span>
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-warm-400 flex-shrink-0">
                  {f.created_at ? format(parseISO(f.created_at), 'MMM d, yyyy · h:mm a') : ''}
                </span>
              </div>
              <p className="text-sm text-warm-800 leading-relaxed">{f.message}</p>
              {(f.name || f.email) && (
                <p className="text-xs text-warm-400">
                  From: {[f.name, f.email].filter(Boolean).join(' · ')}
                  {!f.user_id && <span className="ml-1 text-warm-300">(anonymous — no in-app notification)</span>}
                </p>
              )}
              <FeedbackThread feedbackId={f.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Donors ───────────────────────────────────────────────
const METHOD_COLORS = {
  upi:          'bg-green-100 text-green-700',
  paypal:       'bg-blue-100 text-blue-700',
  buymeacoffee: 'bg-amber-100 text-amber-700',
}
const METHOD_LABELS = { upi: '🇮🇳 UPI', paypal: '💳 PayPal', buymeacoffee: '☕ BMC' }

function DonorReplyForm({ donor, onSent }) {
  const [text,    setText]    = useState(`Hi ${donor.name.split(' ')[0]},\n\nThank you so much for your generous support! `)
  const [sending, setSending] = useState(false)
  const [done,    setDone]    = useState(false)

  async function send() {
    if (!text.trim()) return
    setSending(true)
    try {
      await adminApi.replyDonor(donor.id, text.trim())
      setDone(true)
      toast.success(`Thank-you message sent to ${donor.name}!`)
      onSent?.()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to send')
    } finally { setSending(false) }
  }

  if (done) return (
    <div className="mt-2 pt-2 border-t border-warm-100 flex items-center gap-2 text-xs text-emerald-600">
      <CheckCheck className="w-3.5 h-3.5" /> Thank-you message sent and donor marked as thanked.
    </div>
  )

  return (
    <div className="mt-2 pt-2 border-t border-warm-100 space-y-2">
      <p className="text-[11px] font-semibold text-warm-500 uppercase tracking-wide">Send thank-you</p>
      <div className="flex gap-2">
        <textarea
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
          className="input flex-1 resize-none text-xs leading-relaxed"
          placeholder="Write your thank-you message…"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="self-end flex items-center gap-1 btn-primary px-3 py-2 text-xs disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
      <p className="text-[10px] text-warm-400">⌘Enter to send · Delivers as in-app notification if user was logged in</p>
    </div>
  )
}

function DonorsTab() {
  const [donors,   setDonors]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('all') // 'all' | 'pending' | 'thanked'
  const [marking,  setMarking]  = useState(null)
  const [expanded, setExpanded] = useState(null)  // donor id with reply form open

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await adminApi.getDonors({ limit: 100 })
      setDonors(res.data.data || [])
    } catch { toast.error('Failed to load donors') }
    finally { setLoading(false) }
  }

  async function markThanked(id) {
    setMarking(id)
    try {
      await adminApi.markThanked(id)
      setDonors(prev => prev.map(d => d.id === id ? { ...d, thanked: true } : d))
      toast.success('Marked as thanked!')
    } catch { toast.error('Failed') }
    finally { setMarking(null) }
  }

  const filtered = filter === 'all' ? donors
    : filter === 'pending' ? donors.filter(d => !d.thanked)
    : donors.filter(d => d.thanked)

  const pendingCount = donors.filter(d => !d.thanked).length

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary-600 animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all',     label: `All (${donors.length})` },
          { key: 'pending', label: `Needs Thanks (${pendingCount})` },
          { key: 'thanked', label: `Thanked (${donors.length - pendingCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              filter === key
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-warm-500 border-warm-200 hover:border-warm-300'
            }`}
          >
            {label}
          </button>
        ))}
        <button onClick={load} className="ml-auto p-1.5 rounded-lg hover:bg-warm-100 text-warm-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {pendingCount > 0 && filter !== 'thanked' && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Mail className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>{pendingCount} donor{pendingCount > 1 ? 's' : ''}</strong> waiting for a thank-you. Reach out to them and mark as thanked.
          </p>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-warm-400 text-sm">No donors yet</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <div key={d.id} className={`card p-4 space-y-2 ${d.thanked ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${METHOD_COLORS[d.method] || 'bg-warm-100 text-warm-500'}`}>
                    {METHOD_LABELS[d.method] || d.method}
                  </span>
                  {d.amount && (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {d.amount}
                    </span>
                  )}
                  {d.thanked && (
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCheck className="w-3 h-3" /> Thanked
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-warm-400 flex-shrink-0">
                  {d.created_at ? format(parseISO(d.created_at), 'MMM d, yyyy') : ''}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-warm-900">{d.name}</p>
                  <a href={`mailto:${d.email}`} className="text-xs text-primary-600 hover:underline">{d.email}</a>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    className="flex items-center gap-1.5 text-xs bg-primary-50 text-primary-700 border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors font-medium"
                  >
                    <Send className="w-3 h-3" /> {d.thanked ? 'Reply Again' : 'Send Thanks'}
                  </button>
                  {!d.thanked && (
                    <button
                      onClick={() => markThanked(d.id)}
                      disabled={marking === d.id}
                      className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors font-medium disabled:opacity-50"
                    >
                      {marking === d.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <CheckCheck className="w-3 h-3" />
                      }
                      Mark Only
                    </button>
                  )}
                </div>
              </div>

              {d.message && (
                <p className="text-xs text-warm-500 italic bg-warm-50 rounded-lg px-3 py-2 leading-relaxed">
                  "{d.message}"
                </p>
              )}
              {!d.user_id && (
                <p className="text-[10px] text-warm-300">Anonymous donor — no in-app notification available</p>
              )}
              {expanded === d.id && (
                <DonorReplyForm
                  donor={d}
                  onSent={() => {
                    setExpanded(null)
                    setDonors(prev => prev.map(x => x.id === d.id ? { ...x, thanked: true } : x))
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab 5: Donation Config ─────────────────────────────────────
function DonateConfigTab() {
  const [cfg,     setCfg]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    adminApi.getDonateConfig()
      .then(res => setCfg(res.data.data))
      .catch(() => toast.error('Failed to load donation config'))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try {
      await adminApi.saveDonateConfig(cfg)
      setSaved(true)
      toast.success('Donation config saved')
      setTimeout(() => setSaved(false), 2500)
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  function update(method, field, value) {
    setCfg(prev => ({ ...prev, [method]: { ...prev[method], [field]: value } }))
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-primary-600 animate-spin" /></div>
  if (!cfg)    return <p className="text-center text-warm-400 py-20">Could not load config</p>

  return (
    <div className="max-w-xl space-y-5">

      {/* UPI */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇮🇳</span>
            <h3 className="text-sm font-semibold text-warm-900">UPI</h3>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-warm-500">Enable</span>
            <div
              onClick={() => update('upi', 'enabled', !cfg.upi?.enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${cfg.upi?.enabled ? 'bg-primary-600' : 'bg-warm-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.upi?.enabled ? 'translate-x-4' : ''}`} />
            </div>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-warm-500 mb-1 block">UPI ID</label>
            <input
              className="input text-sm w-full"
              placeholder="name@bank"
              value={cfg.upi?.id || ''}
              onChange={e => update('upi', 'id', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-warm-500 mb-1 block">Display Name</label>
            <input
              className="input text-sm w-full"
              placeholder="Your Name"
              value={cfg.upi?.name || ''}
              onChange={e => update('upi', 'name', e.target.value)}
            />
          </div>
        </div>
        {cfg.upi?.id && (
          <p className="text-xs text-warm-400">
            QR will link to: <span className="font-mono">upi://pay?pa={cfg.upi.id}&pn={cfg.upi.name}&cu=INR</span>
          </p>
        )}
      </div>

      {/* PayPal */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">💳</span>
            <h3 className="text-sm font-semibold text-warm-900">PayPal</h3>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-warm-500">Enable</span>
            <div
              onClick={() => update('paypal', 'enabled', !cfg.paypal?.enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${cfg.paypal?.enabled ? 'bg-primary-600' : 'bg-warm-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.paypal?.enabled ? 'translate-x-4' : ''}`} />
            </div>
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-warm-500 mb-1 block">PayPal.me URL</label>
          <input
            className="input text-sm w-full"
            placeholder="https://paypal.me/YourUsername"
            value={cfg.paypal?.url || ''}
            onChange={e => update('paypal', 'url', e.target.value)}
          />
        </div>
      </div>

      {/* Buy Me a Coffee */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">☕</span>
            <h3 className="text-sm font-semibold text-warm-900">Buy Me a Coffee</h3>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-warm-500">Enable</span>
            <div
              onClick={() => update('buymeacoffee', 'enabled', !cfg.buymeacoffee?.enabled)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${cfg.buymeacoffee?.enabled ? 'bg-primary-600' : 'bg-warm-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${cfg.buymeacoffee?.enabled ? 'translate-x-4' : ''}`} />
            </div>
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-warm-500 mb-1 block">Buy Me a Coffee URL</label>
          <input
            className="input text-sm w-full"
            placeholder="https://www.buymeacoffee.com/YourUsername"
            value={cfg.buymeacoffee?.url || ''}
            onChange={e => update('buymeacoffee', 'url', e.target.value)}
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="btn-primary flex items-center gap-2 px-5"
      >
        {saving
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : saved
            ? <CheckCheck className="w-4 h-4" />
            : <Save className="w-4 h-4" />
        }
        {saved ? 'Saved!' : 'Save Changes'}
      </button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [tab,     setTab]     = useState('ai')
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState(false)

  useEffect(() => {
    if (ADMIN_EMAIL && user?.email && user.email !== ADMIN_EMAIL) {
      setDenied(true)
      setLoading(false)
      return
    }

    adminApi.getStats().then(res => {
      setStats(res.data.data)
    }).catch(err => {
      if (err.response?.status === 403) setDenied(true)
      else toast.error('Failed to load admin data')
    }).finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
      </div>
    )
  }

  if (denied) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-32 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-warm-900 mb-2">Admin Access Only</h2>
        <p className="text-sm text-warm-500 mb-6">You don't have permission to access this page.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-ghost text-sm text-primary-600">
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-lg font-semibold text-warm-900">Admin Panel 🛡️</h1>
        <span className="badge">Admin</span>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab-pill flex items-center gap-2 ${tab === t.id ? 'active' : 'inactive'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'ai'       && <AIConfigTab />}
        {tab === 'users'    && <UserStatsTab stats={stats} />}
        {tab === 'usage'    && <UsageStatsTab stats={stats} />}
        {tab === 'plans'    && <PlanManagementTab />}
        {tab === 'menus'    && <MenuConfigTab />}
        {tab === 'donate'   && <DonateConfigTab />}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'donors'   && <DonorsTab />}
      </div>
    </div>
  )
}
