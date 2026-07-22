import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import {
  FolderOpen, ListChecks, Users, UsersRound, Trash2,
  Loader2, AlertTriangle, GitMerge, ChevronRight, X,
  Search, RefreshCw, ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, PageHeader } from '../../components/ui'

// ── API helpers ───────────────────────────────────────────────
const dmApi = {
  resetAll: ()       => api.post('/api/data-management/reset-all'),
  projects: ()       => api.get('/api/data-management/projects'),
  tasks:    (pid)    => api.get('/api/data-management/tasks', { params: pid ? { project_id: pid } : {} }),
  members:  ()       => api.get('/api/data-management/members'),
  groups:   ()       => api.get('/api/data-management/groups'),
  deleteProject: (id)  => api.delete(`/api/data-management/projects/${id}`),
  deleteTask:    (id)  => api.delete(`/api/data-management/tasks/${id}`),
  deleteMember:  (id)  => api.delete(`/api/data-management/members/${id}`),
  deleteGroup:   (id)  => api.delete(`/api/data-management/groups/${id}`),
  mergeGroups: (target, source) => api.post('/api/data-management/groups/merge', {
    target_group_id: target, source_group_id: source,
  }),
}

// ── Confirm Delete Dialog ─────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-bold text-warm-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-warm-500 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading} className="flex-1 btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 btn bg-red-600 text-white hover:bg-red-700 border-red-600 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Merge Dialog ──────────────────────────────────────────────
function MergeDialog({ groups, onMerge, onClose, loading }) {
  const [targetId, setTargetId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const canMerge = targetId && sourceId && targetId !== sourceId

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-base font-bold text-warm-900">Merge Groups</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-warm-400 hover:text-warm-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
          <p className="text-xs text-amber-700">
            All members of the <strong>source</strong> group will be moved into the <strong>target</strong> group. The source group will be permanently deleted.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Target group <span className="text-warm-400 font-normal">(keep this one)</span></label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} className="input">
              <option value="">Select group…</option>
              {groups.map(g => (
                <option key={g.id} value={g.id} disabled={g.id === sourceId}>
                  {g.name} ({g.member_count} members)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Source group <span className="text-warm-400 font-normal">(will be deleted)</span></label>
            <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="input">
              <option value="">Select group…</option>
              {groups.map(g => (
                <option key={g.id} value={g.id} disabled={g.id === targetId}>
                  {g.name} ({g.member_count} members)
                </option>
              ))}
            </select>
          </div>
        </div>

        {targetId && sourceId && targetId !== sourceId && (
          <div className="mt-4 bg-primary-50 border border-primary-100 rounded-xl p-3">
            <p className="text-xs text-primary-700">
              Merging <strong>{groups.find(g => g.id === sourceId)?.name}</strong> →{' '}
              <strong>{groups.find(g => g.id === targetId)?.name}</strong>
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={loading} className="flex-1 btn btn-secondary">Cancel</button>
          <button
            onClick={() => canMerge && onMerge(targetId, sourceId)}
            disabled={!canMerge || loading}
            className="flex-1 btn bg-primary-600 text-white hover:bg-primary-700 border-primary-600 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
            Merge
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Projects ─────────────────────────────────────────────
function ProjectsTab() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [confirm, setConfirm]   = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await dmApi.projects()
      setProjects(res.data.data || [])
    } catch { toast.error('Failed to load projects') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleDelete() {
    setDeleting(true)
    try {
      await dmApi.deleteProject(confirm.id)
      toast.success('Project deleted')
      setProjects(p => p.filter(x => x.id !== confirm.id))
      setConfirm(null)
    } catch (err) { toast.error(err?.response?.data?.error || 'Delete failed') }
    finally { setDeleting(false) }
  }

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects…" className="input pl-9" />
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-warm-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No projects found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-white border border-warm-200 rounded-xl px-4 py-3 hover:border-warm-300 transition-colors">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#6366f1' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-900 truncate">{p.name}</p>
                <p className="text-xs text-warm-400">{p.task_count} task{p.task_count !== 1 ? 's' : ''} · Created {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => setConfirm(p)}
                className="p-1.5 text-warm-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="Delete project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={`Delete "${confirm.name}"?`}
          message={`This will permanently delete the project and all its ${confirm.task_count} tasks and discussions. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}

// ── Tab: Tasks ────────────────────────────────────────────────
function TasksTab() {
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [confirm, setConfirm]   = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await dmApi.tasks()
      setTasks(res.data.data || [])
    } catch { toast.error('Failed to load tasks') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleDelete() {
    setDeleting(true)
    try {
      await dmApi.deleteTask(confirm.id)
      toast.success('Task deleted')
      setTasks(t => t.filter(x => x.id !== confirm.id))
      setConfirm(null)
    } catch (err) { toast.error(err?.response?.data?.error || 'Delete failed') }
    finally { setDeleting(false) }
  }

  const STATUS_COLORS = {
    todo: 'bg-warm-100 text-warm-600', in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700', blocked: 'bg-red-100 text-red-700',
  }
  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.projects?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks or projects…" className="input pl-9" />
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-warm-400">
          <ListChecks className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="flex items-center gap-3 bg-white border border-warm-200 rounded-xl px-4 py-3 hover:border-warm-300 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-900 truncate">{t.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {t.projects && (
                    <span className="text-xs text-warm-400 truncate">{t.projects.name}</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || 'bg-warm-100 text-warm-600'}`}>
                    {t.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setConfirm(t)}
                className="p-1.5 text-warm-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={`Delete "${confirm.title}"?`}
          message="This will permanently delete this task. This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}

// ── Tab: Members ──────────────────────────────────────────────
function MembersTab() {
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [confirm, setConfirm]   = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await dmApi.members()
      setMembers(res.data.data || [])
    } catch { toast.error('Failed to load members') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleRemove() {
    setDeleting(true)
    try {
      await dmApi.deleteMember(confirm.id)
      toast.success('Member removed')
      setMembers(m => m.filter(x => x.id !== confirm.id))
      setConfirm(null)
    } catch (err) { toast.error(err?.response?.data?.error || 'Remove failed') }
    finally { setDeleting(false) }
  }

  const ROLE_COLORS = { owner: 'bg-primary-100 text-primary-700', admin: 'bg-violet-100 text-violet-700', member: 'bg-warm-100 text-warm-600' }
  const filtered = members.filter(m =>
    (m.users?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.users?.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.groups?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or group…" className="input pl-9" />
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-warm-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No members found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const u = m.users || {}
            const initials = (u.name || u.email || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            return (
              <div key={m.id} className="flex items-center gap-3 bg-white border border-warm-200 rounded-xl px-4 py-3 hover:border-warm-300 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                  {u.avatar_url ? <img src={u.avatar_url} className="w-9 h-9 rounded-full object-cover" alt={u.name} /> : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-warm-900 truncate">{u.name || u.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-warm-400 truncate">{m.groups?.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] || ROLE_COLORS.member}`}>
                      {m.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setConfirm(m)}
                  className="p-1.5 text-warm-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  title="Remove member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={`Remove ${confirm.users?.name || confirm.users?.email}?`}
          message={`They will be removed from "${confirm.groups?.name}". They can rejoin with an invite link.`}
          onConfirm={handleRemove}
          onCancel={() => setConfirm(null)}
          loading={deleting}
        />
      )}
    </div>
  )
}

// ── Tab: Groups ───────────────────────────────────────────────
function GroupsTab() {
  const [groups, setGroups]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [confirm, setConfirm]   = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showMerge, setShowMerge] = useState(false)
  const [merging, setMerging]   = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await dmApi.groups()
      setGroups(res.data.data || [])
    } catch { toast.error('Failed to load groups') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleDelete() {
    setDeleting(true)
    try {
      await dmApi.deleteGroup(confirm.id)
      toast.success('Group deleted')
      setGroups(g => g.filter(x => x.id !== confirm.id))
      setConfirm(null)
    } catch (err) { toast.error(err?.response?.data?.error || 'Delete failed') }
    finally { setDeleting(false) }
  }

  async function handleMerge(targetId, sourceId) {
    setMerging(true)
    try {
      const res = await dmApi.mergeGroups(targetId, sourceId)
      const moved = res.data.merged_members || 0
      toast.success(`Groups merged! ${moved} new member${moved !== 1 ? 's' : ''} added.`)
      setShowMerge(false)
      load()
    } catch (err) { toast.error(err?.response?.data?.error || 'Merge failed') }
    finally { setMerging(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={load} className="btn btn-secondary btn-sm"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        {groups.length >= 2 && (
          <button onClick={() => setShowMerge(true)} className="btn btn-sm bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100 flex items-center gap-1.5">
            <GitMerge className="w-4 h-4" /> Merge Groups
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-warm-400">
          <UsersRound className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No groups found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(g => (
            <div key={g.id} className="flex items-center gap-3 bg-white border border-warm-200 rounded-xl px-4 py-3 hover:border-warm-300 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
                <UsersRound className="w-5 h-5 text-primary-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-900 truncate">{g.name}</p>
                <p className="text-xs text-warm-400">
                  {g.member_count} member{g.member_count !== 1 ? 's' : ''} · Created {new Date(g.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setConfirm(g)}
                className="p-1.5 text-warm-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                title="Delete group"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={`Delete "${confirm.name}"?`}
          message={`This will permanently delete the group and remove all ${confirm.member_count} members. This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
          loading={deleting}
        />
      )}

      {showMerge && (
        <MergeDialog
          groups={groups}
          onMerge={handleMerge}
          onClose={() => setShowMerge(false)}
          loading={merging}
        />
      )}
    </div>
  )
}

// ── Danger Zone — Delete All Data ────────────────────────────
function DangerZone() {
  const [step, setStep]       = useState(0)   // 0=idle 1=confirm-dialog 2=type-confirm
  const [typed, setTyped]     = useState('')
  const [loading, setLoading] = useState(false)
  const CONFIRM_PHRASE = 'delete my data'

  async function handleReset() {
    if (typed.trim().toLowerCase() !== CONFIRM_PHRASE) return
    setLoading(true)
    try {
      await dmApi.resetAll()
      toast.success('All data deleted. Reloading…')
      setTimeout(() => window.location.replace('/dashboard'), 1500)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Reset failed')
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 border-2 border-red-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 bg-red-50 px-5 py-4 border-b border-red-200">
        <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-700">Danger Zone</p>
          <p className="text-xs text-red-500 mt-0.5">These actions are irreversible. Proceed with extreme caution.</p>
        </div>
      </div>
      <div className="px-5 py-4 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-warm-900">Delete all my data</p>
            <p className="text-xs text-warm-500 mt-1">
              Permanently removes all your projects, tasks, topics, discussions, test cases, time entries, groups, and workspace settings.
              Your account remains but the workspace will be empty.
            </p>
          </div>
          <button
            onClick={() => setStep(1)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Everything
          </button>
        </div>
      </div>

      {/* Step 1 — initial confirm dialog */}
      {step === 1 && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-warm-900 text-center mb-1">Delete all data?</h3>
            <p className="text-sm text-warm-500 text-center mb-5">
              This will permanently erase every project, task, topic, discussion, test case, group, and time entry from your account. <strong>This cannot be undone.</strong>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex-1 btn btn-secondary">Cancel</button>
              <button
                onClick={() => { setTyped(''); setStep(2) }}
                className="flex-1 btn bg-red-600 text-white hover:bg-red-700 border-red-600"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — type-to-confirm */}
      {step === 2 && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-warm-900">Final confirmation</h3>
              <button onClick={() => setStep(0)} className="p-1.5 text-warm-400 hover:text-warm-700 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-warm-500 mb-4">
              Type <strong className="text-warm-900 font-mono">{CONFIRM_PHRASE}</strong> to confirm:
            </p>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="input mb-5"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} disabled={loading} className="flex-1 btn btn-secondary">Cancel</button>
              <button
                onClick={handleReset}
                disabled={typed.trim().toLowerCase() !== CONFIRM_PHRASE || loading}
                className="flex-1 btn bg-red-600 text-white hover:bg-red-700 border-red-600 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
const TABS = [
  { key: 'projects', label: 'Projects', icon: FolderOpen },
  { key: 'tasks',    label: 'Tasks',    icon: ListChecks  },
  { key: 'members',  label: 'Members',  icon: Users       },
  { key: 'groups',   label: 'Groups',   icon: UsersRound  },
]

export default function DataManagement() {
  const [activeTab, setActiveTab] = useState('projects')
  const navigate = useNavigate()

  return (
    <PageShell>
      <PageHeader
        title="Data Management"
        subtitle="View, delete, and manage all your workspace data."
        actions={
          <div className="flex items-center gap-2">
            {['Plan', 'Workspace', 'Automations'].map(t => (
              <button key={t}
                onClick={() => navigate(`/settings/${t.toLowerCase()}`)}
                className="text-xs text-warm-500 hover:text-warm-800 px-2.5 py-1.5 rounded-lg hover:bg-warm-100 transition-colors">
                {t}
              </button>
            ))}
            <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg border border-primary-100">
              Data
            </span>
          </div>
        }
      />

      {/* Warning banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-700">
          Deletions here are <strong>permanent and cannot be undone</strong>. Please be careful.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-warm-100 rounded-2xl p-1 mb-6 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-medium transition-all ${
              activeTab === key
                ? 'bg-white text-warm-900 shadow-sm'
                : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card">
        {activeTab === 'projects' && <ProjectsTab />}
        {activeTab === 'tasks'    && <TasksTab />}
        {activeTab === 'members'  && <MembersTab />}
        {activeTab === 'groups'   && <GroupsTab />}
      </div>

      <DangerZone />
    </PageShell>
  )
}
