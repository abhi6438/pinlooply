import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { groupsApi } from '../services/api'
import {
  Users, Copy, Check, Loader2, Crown, Shield,
  UserMinus, ChevronDown, Plus, Clock, X,
  Mail, Link2, Send, AlertCircle, UserCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { PageShell, PageLoader, EmptyState, Modal, ModalButton } from '../components/ui'

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
}

const ROLE_CFG = {
  owner:  { label: 'Owner',  Icon: Crown,  color: 'text-amber-600 bg-amber-50 border-amber-200'  },
  admin:  { label: 'Admin',  Icon: Shield, color: 'text-blue-600 bg-blue-50 border-blue-200'     },
  member: { label: 'Member', Icon: Users,  color: 'text-warm-600 bg-warm-100 border-warm-200'    },
}

function Avatar({ name, size = 'md' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  const colors = [
    'bg-purple-100 text-purple-700', 'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',   'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',     'bg-teal-100 text-teal-700',
  ]
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ── Delete confirm modal ───────────────────────────────────────
function RemoveConfirmModal({ name, onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <UserMinus className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-warm-900 text-center mb-1">Remove member?</h3>
        <p className="text-sm text-warm-500 text-center mb-6">{name} will lose access to all shared projects.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="flex-1 btn bg-red-500 text-white hover:bg-red-600 border-red-500">Remove</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Portal role dropdown ──────────────────────────────────────
function RoleDropdown({ member, currentRole, groupId, onUpdate }) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [pos, setPos]         = useState({ top: 0, left: 0 })
  const btnRef = useRef()
  const role = ROLE_CFG[member.role] ?? ROLE_CFG.member
  const u = member.users || {}
  const canManage = ['owner', 'admin'].includes(currentRole) && member.role !== 'owner'

  useEffect(() => {
    if (!open) return
    function outside(e) { if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  function openDropdown() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left })
    setOpen(true)
  }

  async function changeRole(newRole) {
    setOpen(false)
    if (newRole === member.role) return
    setLoading(true)
    try {
      await groupsApi.updateRole(groupId, u.id, newRole)
      onUpdate(u.id, newRole)
      toast.success('Role updated')
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }

  if (!canManage) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${role.color}`}>
        <role.Icon className="w-3 h-3" />{role.label}
      </span>
    )
  }

  return (
    <div ref={btnRef}>
      <button
        onClick={openDropdown}
        className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border transition-colors hover:opacity-80 ${role.color}`}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <role.Icon className="w-3 h-3" />}
        {role.label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-36 bg-white border border-warm-200 rounded-xl shadow-xl py-1">
          {['admin', 'member'].map(r => {
            const RoleIcon = ROLE_CFG[r].Icon
            return (
              <button key={r} onClick={() => changeRole(r)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-warm-50 transition-colors ${member.role === r ? 'font-semibold text-primary-600' : 'text-warm-700'}`}>
                {RoleIcon && <RoleIcon className="w-3 h-3" />}
                {ROLE_CFG[r].label}
                {member.role === r && <Check className="w-3 h-3 ml-auto" />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Member Row ────────────────────────────────────────────────
function MemberRow({ member, currentRole, currentUserId, groupId, onUpdate, onRemove }) {
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const u = member.users || {}
  const isSelf = u.id === currentUserId
  const canManage = ['owner', 'admin'].includes(currentRole) && member.role !== 'owner'

  async function doRemove() {
    setConfirmRemove(false)
    setRemoving(true)
    try {
      await groupsApi.removeMember(groupId, u.id)
      onRemove(u.id)
      toast.success('Member removed')
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed') }
    finally { setRemoving(false) }
  }

  return (
    <>
      {confirmRemove && (
        <RemoveConfirmModal
          name={u.name || u.email}
          onConfirm={doRemove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-warm-50/60 transition-colors group">
        <Avatar name={u.name || u.email} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-warm-900 truncate">{u.name || 'Unknown'}</p>
            {isSelf && <span className="text-xs text-warm-400 bg-warm-100 px-1.5 py-0.5 rounded-full">you</span>}
          </div>
          <p className="text-xs text-warm-400 truncate">{u.email}</p>
        </div>

        {/* Activity */}
        <div className="hidden lg:flex flex-col items-end text-xs text-warm-400 mr-1 flex-shrink-0">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(member.last_activity)}</span>
          <span>{member.active_tasks ?? 0} active task{member.active_tasks !== 1 ? 's' : ''}</span>
        </div>

        {/* Role */}
        <div className="flex-shrink-0">
          <RoleDropdown member={member} currentRole={currentRole} groupId={groupId} onUpdate={onUpdate} />
        </div>

        {/* Remove */}
        {(canManage || isSelf) && member.role !== 'owner' && (
          <button
            onClick={() => setConfirmRemove(true)}
            disabled={removing}
            className="p-1.5 text-warm-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
          >
            {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
          </button>
        )}
      </div>
    </>
  )
}

// ── Create Group Modal ────────────────────────────────────────
function CreateGroupModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try { await onCreate(name.trim()); onClose() }
    catch { toast.error('Failed to create group') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Create a Team" onClose={onClose}
      footer={<>
        <ModalButton onClick={onClose}>Cancel</ModalButton>
        <ModalButton variant="primary" onClick={handleCreate} loading={saving} disabled={!name.trim()}>Create Team</ModalButton>
      </>}>
      <div>
        <label className="label">Team name</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="e.g. Engineering" className="input" />
      </div>
    </Modal>
  )
}

// ── Invite Panel ──────────────────────────────────────────────
function InvitePanel({ active, myRole, onMembersRefresh }) {
  const [emails,    setEmails]    = useState([]) // confirmed email tags
  const [input,     setInput]     = useState('')
  const [inviting,  setInviting]  = useState(false)
  const [copied,    setCopied]    = useState(false)
  const [results,   setResults]   = useState([]) // per-email invite results

  const inviteLink = active?.invite_code
    ? `${window.location.origin}/invite/${active.invite_code}`
    : ''

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function addEmail() {
    const val = input.trim().toLowerCase()
    if (!val) return
    if (!isValidEmail(val)) { toast.error('Invalid email address'); return }
    if (emails.includes(val)) { setInput(''); return }
    setEmails(e => [...e, val])
    setInput('')
  }

  function removeEmail(e) { setEmails(es => es.filter(x => x !== e)) }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail() }
    if (e.key === 'Backspace' && !input && emails.length) {
      setEmails(es => es.slice(0, -1))
    }
  }

  async function handleInviteAll() {
    const toInvite = [...emails]
    if (input.trim() && isValidEmail(input.trim())) {
      toInvite.push(input.trim().toLowerCase())
      setInput('')
    }
    if (!toInvite.length || !active) return
    setInviting(true)
    setResults([])

    const res = []
    for (const email of toInvite) {
      try {
        await groupsApi.inviteMember(active.id, email)
        res.push({ email, status: 'success' })
      } catch (err) {
        const msg = err?.response?.data?.error || 'Failed'
        const notFound = msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('sign up')
        res.push({ email, status: notFound ? 'not_found' : 'error', msg })
      }
    }

    setResults(res)
    const succeeded = res.filter(r => r.status === 'success')
    if (succeeded.length) {
      setEmails(emails.filter(e => !succeeded.find(r => r.email === e)))
      toast.success(`${succeeded.length} member${succeeded.length !== 1 ? 's' : ''} added!`)
      onMembersRefresh()
    }
    setInviting(false)
  }

  const isAdmin = ['owner', 'admin'].includes(myRole)
  const canSend = (emails.length > 0 || isValidEmail(input.trim())) && !inviting

  return (
    <div className="space-y-5">
      {/* Invite Link */}
      {inviteLink && isAdmin && (
        <div className="bg-white border border-warm-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Link2 className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-warm-900">Invite Link</p>
              <p className="text-xs text-warm-400">Anyone with this link can join</p>
            </div>
          </div>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-warm-50 border border-warm-200 rounded-xl px-3 py-2.5 text-warm-600 truncate">
              {inviteLink}
            </code>
            <button onClick={copyLink} className={`btn btn-sm flex-shrink-0 transition-all ${copied ? 'btn-primary' : 'btn-secondary'}`}>
              {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
            </button>
          </div>
        </div>
      )}

      {/* Email Invite */}
      {isAdmin && (
        <div className="bg-white border border-warm-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-warm-900">Invite by Email</p>
              <p className="text-xs text-warm-400">Add multiple — press Enter or comma to add each</p>
            </div>
          </div>

          {/* Tag input */}
          <div
            className="min-h-[52px] border border-warm-200 rounded-xl px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-text focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-primary-400 transition-all bg-white"
            onClick={() => document.getElementById('email-input').focus()}
          >
            {emails.map(e => (
              <span key={e} className="flex items-center gap-1 bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-lg font-medium">
                {e}
                <button onClick={() => removeEmail(e)} className="hover:text-primary-900 ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              id="email-input"
              type="email"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={addEmail}
              placeholder={emails.length ? '' : 'teammate@example.com, another@example.com…'}
              className="flex-1 min-w-[160px] text-sm outline-none text-warm-900 placeholder:text-warm-300 bg-transparent py-0.5"
            />
          </div>

          <button
            onClick={handleInviteAll}
            disabled={!canSend}
            className="btn btn-primary btn-sm w-full justify-center mt-3"
          >
            {inviting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
            {inviting
              ? 'Sending invites…'
              : emails.length > 1
                ? `Send ${emails.length} Invites`
                : 'Send Invite'}
          </button>

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {results.map(r => (
                <div key={r.email} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-xl ${
                  r.status === 'success' ? 'bg-green-50 text-green-700' :
                  r.status === 'not_found' ? 'bg-amber-50 text-amber-700' :
                  'bg-red-50 text-red-600'}`}>
                  {r.status === 'success'
                    ? <UserCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                  <span>
                    <strong>{r.email}</strong>
                    {r.status === 'success' && ' — added to team'}
                    {r.status === 'not_found' && ' — not signed up yet. Share the invite link above so they can join.'}
                    {r.status === 'error' && ` — ${r.msg}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-warm-400 mt-3 leading-relaxed">
            Members are added instantly if they have an account. Otherwise share the invite link.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function GroupMembers() {
  const { user } = useAuth()
  const [groups,     setGroups]     = useState([])
  const [active,     setActive]     = useState(null)
  const [members,    setMembers]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const res = await groupsApi.list()
      const list = res.data.data || []
      setGroups(list)
      if (list.length) await selectGroup(list[0].id)
    } catch { toast.error('Failed to load groups') }
    finally { setLoading(false) }
  }

  async function handleCreateGroup(name) {
    await groupsApi.create({ name })
    toast.success('Team created!')
    load()
  }

  async function selectGroup(groupId) {
    try {
      const res = await groupsApi.get(groupId)
      const g = res.data.data
      setActive(g)
      setMembers(g.members || [])
    } catch { toast.error('Failed to load group') }
  }

  function onUpdate(userId, newRole) {
    setMembers(ms => ms.map(m => m.users?.id === userId ? { ...m, role: newRole } : m))
  }
  function onRemove(userId) {
    setMembers(ms => ms.filter(m => m.users?.id !== userId))
  }

  const myMembership = members.find(m => m.users?.id === user?.id)
  const myRole = myMembership?.role || 'member'

  if (loading) return <PageLoader />

  if (!groups.length) return (
    <PageShell>
      <EmptyState
        icon={<Users className="w-12 h-12" />}
        title="No team yet"
        subtitle="Create a team to collaborate and invite others"
        action={
          <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm mt-4">
            <Plus className="w-4 h-4" /> Create your first team
          </button>
        }
      />
      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreateGroup} />}
    </PageShell>
  )

  return (
    <PageShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold text-warm-900">Team</h1>
            <p className="text-xs text-warm-400 mt-0.5">
              {members.length} member{members.length !== 1 ? 's' : ''}
              {active?.name && <span className="ml-1.5 text-warm-300">· {active.name}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {groups.length > 1 && (
            <select value={active?.id || ''} onChange={e => selectGroup(e.target.value)}
              className="input py-2 text-sm w-auto">
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowCreate(true)} className="btn btn-secondary btn-sm">
            <Plus className="w-4 h-4" /> New Team
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Left — Members list (takes 60%) */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-warm-100 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-warm-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide">Members</p>
              <span className="text-xs font-medium text-warm-500 bg-warm-100 px-2 py-0.5 rounded-full">
                {members.length}
              </span>
            </div>
            <div className="divide-y divide-warm-50">
              {members.map(m => (
                <MemberRow
                  key={m.id}
                  member={m}
                  currentRole={myRole}
                  currentUserId={user?.id}
                  groupId={active?.id}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right — Invite panel (fixed ~360px) */}
        <div className="w-80 xl:w-96 flex-shrink-0">
          <InvitePanel
            active={active}
            myRole={myRole}
            onMembersRefresh={() => selectGroup(active?.id)}
          />
        </div>
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreateGroup} />}
    </PageShell>
  )
}
