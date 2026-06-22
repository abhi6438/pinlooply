import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'

const router = Router()

// ── Helper: check membership ──────────────────────────────────────
async function getMember(groupId, userId) {
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('id, role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .single()
  return data
}

// ── POST /api/groups — create group + add owner ───────────────────
router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { name, description } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' })

  const { data: grp, error } = await supabaseAdmin
    .from('groups')
    .insert({ name: name.trim(), owner_id: userId })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  await supabaseAdmin
    .from('group_members')
    .insert({ group_id: grp.id, user_id: userId, role: 'owner' })

  res.json({ success: true, data: grp })
})

// ── GET /api/groups/invite/:inviteCode — validate invite (public) ─
router.get('/invite/:inviteCode', async (req, res) => {
  const { inviteCode } = req.params
  const { data: grp, error } = await supabaseAdmin
    .from('groups')
    .select('id, name, invite_code, owner_id')
    .eq('invite_code', inviteCode)
    .single()

  if (error || !grp) return res.status(404).json({ error: 'Invalid invite link' })

  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('id')
    .eq('group_id', grp.id)

  res.json({ success: true, data: { ...grp, member_count: members?.length ?? 0 } })
})

// ── GET /api/groups/:groupId — group details + members ────────────
router.get('/:groupId', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { groupId } = req.params

  const member = await getMember(groupId, userId)
  if (!member) return res.status(403).json({ error: 'Not a member' })

  const { data: grp } = await supabaseAdmin
    .from('groups')
    .select('id, name, invite_code, owner_id, created_at')
    .eq('id', groupId)
    .single()

  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('id, role, joined_at, users(id, name, email, avatar_url)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })

  // Per-member active task counts + last activity
  const memberIds = (members || []).map(m => m.users?.id).filter(Boolean)

  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('assigned_to, status, updated_at')
    .in('assigned_to', memberIds.length ? memberIds : ['none'])
    .neq('status', 'done')

  const { data: recentDiscs } = await supabaseAdmin
    .from('discussions')
    .select('user_id, created_at')
    .in('user_id', memberIds.length ? memberIds : ['none'])
    .order('created_at', { ascending: false })
    .limit(100)

  const enriched = (members || []).map(m => {
    const uid = m.users?.id
    const activeTasks = (tasks || []).filter(t => t.assigned_to === uid).length
    const lastDisc = (recentDiscs || []).find(d => d.user_id === uid)
    return { ...m, active_tasks: activeTasks, last_activity: lastDisc?.created_at || m.joined_at }
  })

  res.json({ success: true, data: { ...grp, members: enriched } })
})

// ── POST /api/groups/:groupId/join — join via invite code ─────────
router.post('/:groupId/join', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { groupId } = req.params
  const { invite_code } = req.body

  const { data: grp } = await supabaseAdmin
    .from('groups')
    .select('id, invite_code')
    .eq('id', groupId)
    .single()

  if (!grp) return res.status(404).json({ error: 'Group not found' })
  if (grp.invite_code !== invite_code) return res.status(403).json({ error: 'Invalid invite code' })

  // Already a member?
  const existing = await getMember(groupId, userId)
  if (existing) return res.json({ success: true, data: { already_member: true } })

  const { error } = await supabaseAdmin
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, role: 'member' })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, data: { joined: true } })
})

// ── POST /api/groups/:groupId/members — invite by email ──────────
router.post('/:groupId/members', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { groupId } = req.params
  const { email } = req.body

  const member = await getMember(groupId, userId)
  if (!member || !['owner', 'admin'].includes(member.role))
    return res.status(403).json({ error: 'Only owners/admins can invite' })

  if (!email?.trim()) return res.status(400).json({ error: 'Email required' })

  // Find user by email
  const { data: invitee } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!invitee) return res.status(404).json({ error: 'User not found — they must sign up first' })

  const existing = await getMember(groupId, invitee.id)
  if (existing) return res.status(409).json({ error: 'User is already a member' })

  const { error } = await supabaseAdmin
    .from('group_members')
    .insert({ group_id: groupId, user_id: invitee.id, role: 'member' })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true, data: invitee })
})

// ── PATCH /api/groups/:groupId/members/:memberId — change role ────
router.patch('/:groupId/members/:memberId', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { groupId, memberId } = req.params
  const { role } = req.body

  const requester = await getMember(groupId, userId)
  if (!requester || !['owner', 'admin'].includes(requester.role))
    return res.status(403).json({ error: 'Only owners/admins can change roles' })

  if (!['admin', 'member'].includes(role))
    return res.status(400).json({ error: 'Role must be admin or member' })

  const { error } = await supabaseAdmin
    .from('group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', memberId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// ── DELETE /api/groups/:groupId/members/:memberId — remove ────────
router.delete('/:groupId/members/:memberId', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { groupId, memberId } = req.params

  const requester = await getMember(groupId, userId)

  // Can remove self, or owner/admin can remove others
  const isSelf = userId === memberId
  const canManage = requester && ['owner', 'admin'].includes(requester.role)

  if (!isSelf && !canManage)
    return res.status(403).json({ error: 'Not allowed' })

  // Owners cannot be removed
  const target = await getMember(groupId, memberId)
  if (target?.role === 'owner')
    return res.status(403).json({ error: 'Cannot remove group owner' })

  const { error } = await supabaseAdmin
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', memberId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// ── GET /api/groups/:groupId/my-groups — groups current user is in
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('role, groups(id, name, invite_code, owner_id, created_at)')
    .eq('user_id', userId)

  const groups = (data || []).map(m => ({ ...m.groups, role: m.role })).filter(Boolean)
  res.json({ success: true, data: groups })
})

export default router
