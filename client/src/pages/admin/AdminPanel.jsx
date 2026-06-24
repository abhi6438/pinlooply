import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { adminApi } from '../../services/api'
import {
  Settings, Users, BarChart3, Shield, Loader2,
  Save, CheckCheck, Search, ChevronDown, AlertCircle,
  Cpu, Crown, RefreshCw, TrendingUp, FolderOpen,
  MessageSquare, CheckSquare2, GitBranch,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

// ── Admin email (must match server ADMIN_EMAIL) ────────────────
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || ''

// ── Tab navigation ─────────────────────────────────────────────
const TABS = [
  { id: 'ai',    label: 'AI Config',       icon: Cpu      },
  { id: 'users', label: 'User Stats',      icon: Users    },
  { id: 'usage', label: 'Usage Stats',     icon: BarChart3},
  { id: 'plans', label: 'Plan Management', icon: Crown    },
]

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, iconBg, iconColor, icon: Icon }) {
  return (
    <div className="card p-4">
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className="text-2xl font-bold text-warm-900">{value}</p>
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

// ── Tab 3: Usage Stats ────────────────────────────────────────
function UsageStatsTab({ stats }) {
  if (!stats) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
    </div>
  )

  const { content, users } = stats

  const paidUsers    = users?.byPlan?.paid || 0
  const freeUsers    = (users?.total || 0) - paidUsers
  const estPaidCalls = paidUsers * 10
  const estFreeCalls = freeUsers * 10
  const estCostUSD   = (estPaidCalls * 2 * 0.003).toFixed(2)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Content stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Discussions" value={content.discussions || 0} icon={MessageSquare} iconBg="bg-primary-100"  iconColor="text-primary-600" />
        <StatCard label="Tasks"       value={content.tasks        || 0} icon={CheckSquare2}  iconBg="bg-emerald-100"  iconColor="text-emerald-600" />
        <StatCard label="Topics"      value={content.topics       || 0} icon={GitBranch}     iconBg="bg-primary-100"  iconColor="text-primary-600" />
        <StatCard label="Projects"    value={content.projects     || 0} icon={FolderOpen}    iconBg="bg-warm-100"     iconColor="text-warm-500" />
        <StatCard label="Conflicts"   value={content.conflicts    || 0} icon={AlertCircle}   iconBg="bg-red-100"      iconColor="text-red-500" />
      </div>

      {/* AI usage estimate */}
      <div className="card p-5">
        <h3 className="section-title mb-4">AI Usage Estimate (This Month)</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-warm-50 rounded-xl border border-warm-100">
            <p className="text-xl font-bold text-warm-900">{estFreeCalls}</p>
            <p className="text-xs text-warm-500 mt-1">Est. AI calls (Free)</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Free tier</p>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
            <p className="text-xl font-bold text-warm-900">{estPaidCalls}</p>
            <p className="text-xs text-warm-500 mt-1">Est. AI calls (Paid)</p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">Paid tier</p>
          </div>
          <div className="text-center p-3 bg-primary-50 rounded-xl border border-primary-100">
            <p className="text-xl font-bold text-warm-900">${estCostUSD}</p>
            <p className="text-xs text-warm-500 mt-1">Est. AI cost</p>
            <p className="text-[11px] text-primary-600 font-medium mt-0.5">This month</p>
          </div>
        </div>
        <p className="text-xs text-warm-400">
          Estimates based on {users?.total || 0} users × ~10 AI calls/week × ~2k tokens/call. Actual costs depend on real usage.
        </p>
      </div>
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
        <h1 className="text-2xl font-bold text-warm-900">Admin Panel 🛡️</h1>
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
        {tab === 'ai'    && <AIConfigTab />}
        {tab === 'users' && <UserStatsTab stats={stats} />}
        {tab === 'usage' && <UsageStatsTab stats={stats} />}
        {tab === 'plans' && <PlanManagementTab />}
      </div>
    </div>
  )
}
