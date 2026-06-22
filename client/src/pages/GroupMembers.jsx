import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { groupsApi } from '../services/api'
import {
  Users, Copy, Check, Loader2, Crown, Shield,
  UserMinus, ChevronDown, Plus, Clock, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso)
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ROLE_CFG = {
  owner: { label: 'Owner', Icon: Crown,  color: 'text-amber-600 bg-amber-50'  },
  admin: { label: 'Admin', Icon: Shield, color: 'text-blue-600 bg-blue-50'    },
  member:{ label: 'Member',Icon: Users,  color: 'text-gray-600 bg-gray-100'   },
}

function Avatar({ name, avatar }) {
  if (avatar) return <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover" />
  return (
    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ── Member Row ────────────────────────────────────────────────────
function MemberRow({ member, currentRole, currentUserId, groupId, onUpdate, onRemove }) {
  const [roleOpen, setRoleOpen] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const u = member.users || {}
  const role = ROLE_CFG[member.role] ?? ROLE_CFG.member
  const isSelf = u.id === currentUserId
  const canManage = ['owner', 'admin'].includes(currentRole) && member.role !== 'owner'

  async function changeRole(newRole) {
    setRoleOpen(false)
    if (newRole === member.role) return
    setLoading(true)
    try {
      await groupsApi.updateRole(groupId, u.id, newRole)
      onUpdate(u.id, newRole)
      toast.success('Role updated')
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }

  async function remove() {
    if (!confirm(`Remove ${u.name} from the group?`)) return
    setLoading(true)
    try {
      await groupsApi.removeMember(groupId, u.id)
      onRemove(u.id)
      toast.success('Member removed')
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50 rounded-xl">
      <Avatar name={u.name} avatar={u.avatar_url} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-gray-900 truncate">{u.name || 'Unknown'}</p>
          {isSelf && <span className="text-xs text-gray-400">(you)</span>}
        </div>
        <p className="text-xs text-gray-400 truncate">{u.email}</p>
      </div>

      {/* Activity */}
      <div className="hidden sm:flex flex-col items-end text-xs text-gray-400 mr-2">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />{timeAgo(member.last_activity)}
        </span>
        <span>{member.active_tasks ?? 0} active tasks</span>
      </div>

      {/* Role badge / dropdown */}
      <div className="relative flex-shrink-0">
        {canManage ? (
          <button
            onClick={() => setRoleOpen(o => !o)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${role.color}`}
          >
            <role.Icon className="w-3 h-3" />
            {role.label}
            <ChevronDown className="w-3 h-3" />
          </button>
        ) : (
          <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${role.color}`}>
            <role.Icon className="w-3 h-3" />{role.label}
          </span>
        )}
        {roleOpen && (
          <div className="absolute right-0 top-8 w-32 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
            {['admin','member'].map(r => (
              <button key={r} onClick={() => changeRole(r)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 ${member.role === r ? 'font-semibold text-indigo-600' : 'text-gray-700'}`}>
                {ROLE_CFG[r].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Remove */}
      {(canManage || isSelf) && member.role !== 'owner' && (
        <button onClick={remove} disabled={loading}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}

// ── Invite Link Box ───────────────────────────────────────────────
function InviteLinkBox({ inviteCode }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/invite/${inviteCode}`

  function copy() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
      <p className="text-xs font-semibold text-indigo-700 mb-2">Invite Link</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-white border border-indigo-200 rounded-lg px-3 py-2 text-gray-700 truncate">
          {link}
        </code>
        <button onClick={copy}
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 flex-shrink-0">
          {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
        </button>
      </div>
      <p className="text-xs text-indigo-500 mt-2">Anyone with this link can join your group.</p>
    </div>
  )
}

// ── Create Group Modal ────────────────────────────────────────────
function CreateGroupModal({ onClose, onCreate }) {
  const [name,    setName]    = useState('')
  const [saving,  setSaving]  = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onCreate(name.trim())
      onClose()
    } catch { toast.error('Failed to create group') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Create a Team</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Team name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Engineering"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={handleCreate} disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Team
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function GroupMembers() {
  const { user } = useAuth()
  const [groups,      setGroups]      = useState([])
  const [active,      setActive]      = useState(null)
  const [members,     setMembers]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [invEmail,    setInvEmail]    = useState('')
  const [inviting,    setInviting]    = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const res = await groupsApi.list()
      const list = res.data.data || []
      setGroups(list)
      if (list.length) selectGroup(list[0].id)
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

  const myMembership = members.find(m => m.users?.id === user?.id)
  const myRole = myMembership?.role || 'member'

  async function handleInvite() {
    if (!invEmail.trim() || !active) return
    setInviting(true)
    try {
      await groupsApi.inviteMember(active.id, invEmail.trim())
      toast.success('Member added!')
      setInvEmail('')
      selectGroup(active.id)
    } catch (err) { toast.error(err?.response?.data?.error || 'Failed to invite') }
    finally { setInviting(false) }
  }

  function onUpdate(userId, newRole) {
    setMembers(ms => ms.map(m => m.users?.id === userId ? { ...m, role: newRole } : m))
  }
  function onRemove(userId) {
    setMembers(ms => ms.filter(m => m.users?.id !== userId))
  }

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /></div>
  )

  if (!groups.length) return (
    <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Team</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Create Team
        </button>
      </div>
      <div className="text-center py-20">
        <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
        <p className="text-sm font-medium text-gray-500">No team yet</p>
        <p className="text-xs text-gray-400 mt-1 mb-4">Create a team to collaborate with others</p>
        <button onClick={() => setShowCreate(true)}
          className="text-sm text-indigo-500 hover:underline">+ Create your first team</button>
      </div>
      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreateGroup} />}
    </div>
  )

  return (
    <div className="px-4 sm:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="text-xs text-gray-400 mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
        {/* Group selector if multiple groups */}
        {groups.length > 1 && (
          <select
            value={active?.id || ''}
            onChange={e => selectGroup(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
          <Plus className="w-4 h-4" /> New Team
        </button>
        </div>
      </div>

      {/* Invite link */}
      {active?.invite_code && ['owner','admin'].includes(myRole) && (
        <div className="mb-6">
          <InviteLinkBox inviteCode={active.invite_code} />
        </div>
      )}

      {/* Invite by email */}
      {['owner','admin'].includes(myRole) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Add Member by Email</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={invEmail}
              onChange={e => setInvEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              placeholder="teammate@example.com"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button onClick={handleInvite} disabled={inviting || !invEmail.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 disabled:opacity-40">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Invite
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">The person must have a Pinlooply account.</p>
        </div>
      )}

      {/* Members list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Members</p>
        </div>
        <div className="divide-y divide-gray-50">
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

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreateGroup} />}
    </div>
  )
}
