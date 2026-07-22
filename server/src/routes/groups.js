import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { supabaseAdmin } from '../config/supabase.js'
import { checkMemberLimit } from '../middleware/planCheck.js'

const router = Router()

// ── Helper: check membership ──────────────────────────────────────
async function getMember(groupId, userId) {
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('id, role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

// ── Helper: find user by email in public.users ────────────────────
// The trigger handle_new_user() populates public.users.email on signup,
// so this is the single reliable source of truth.
// Dropping the auth.admin.listUsers() fallback — it times out in Vercel serverless.
async function findUserByEmail(email) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, name, email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  return data  // null if not found
}

// ── POST /api/groups — create group + add owner ───────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { name } = req.body || {}
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
  } catch (err) {
    console.error('Create group error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ── GET /api/groups/invite/:inviteCode — validate invite (public) ─
router.get('/invite/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params
    const { data: grp, error } = await supabaseAdmin
      .from('groups')
      .select('id, name, invite_code, owner_id')
      .eq('invite_code', inviteCode)
      .maybeSingle()

    if (error || !grp) return res.status(404).json({ error: 'Invalid invite link' })

    const { data: members } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', grp.id)

    res.json({ success: true, data: { ...grp, member_count: members?.length ?? 0 } })
  } catch (err) {
    console.error('Validate invite error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ── GET /api/groups/:groupId — group details + members ────────────
router.get('/:groupId', requireAuth, async (req, res) => {
  try {
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
  } catch (err) {
    console.error('Get group error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ── POST /api/groups/:groupId/join — join via invite code ─────────
router.post('/:groupId/join', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { groupId } = req.params
    const { invite_code } = req.body || {}

    const { data: grp } = await supabaseAdmin
      .from('groups')
      .select('id, invite_code')
      .eq('id', groupId)
      .maybeSingle()

    if (!grp) return res.status(404).json({ error: 'Group not found' })
    if (grp.invite_code !== invite_code) return res.status(403).json({ error: 'Invalid invite code' })

    const existing = await getMember(groupId, userId)
    if (existing) return res.json({ success: true, data: { already_member: true } })

    const { error } = await supabaseAdmin
      .from('group_members')
      .insert({ group_id: groupId, user_id: userId, role: 'member' })

    if (error) return res.status(500).json({ error: error.message })
    res.json({ success: true, data: { joined: true } })
  } catch (err) {
    console.error('Join group error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ── POST /api/groups/:groupId/members — invite by email ──────────
// If the user already has an account → add them directly.
// If not → send a Supabase invite email so they sign up and land in the app.
router.post('/:groupId/members', requireAuth, checkMemberLimit, async (req, res) => {
  try {
    const userId = req.user.id
    const { groupId } = req.params
    const email = req.body?.email?.trim().toLowerCase()

    const member = await getMember(groupId, userId)
    if (!member || !['owner', 'admin'].includes(member.role))
      return res.status(403).json({ error: 'Only owners/admins can invite' })

    if (!email) return res.status(400).json({ error: 'Email required' })

    // Case 1: user already has an account — add them immediately
    const invitee = await findUserByEmail(email)
    if (invitee) {
      const existing = await getMember(groupId, invitee.id)
      if (existing) return res.status(409).json({ error: 'User is already a member' })

      const { error } = await supabaseAdmin
        .from('group_members')
        .insert({ group_id: groupId, user_id: invitee.id, role: 'member' })

      if (error) return res.status(500).json({ error: error.message })
      return res.json({ success: true, data: invitee, invited: false })
    }

    // Case 2: user doesn't have an account — send a Supabase invite email.
    // Pass group_id + invite_code in the redirectTo URL so the onboarding page
    // can auto-join the group after the user sets up their account.
    // We do NOT pre-create the group_members row here because public.users
    // doesn't exist yet for the invited user (trigger fires only on email confirm).
    const { data: grpData } = await supabaseAdmin
      .from('groups')
      .select('invite_code')
      .eq('id', groupId)
      .single()

    const inviteCode = grpData?.invite_code || ''
    const base = process.env.CLIENT_URL || 'http://localhost:5173'
    const redirectTo = `${base}/onboarding?group_id=${groupId}&invite_code=${inviteCode}`

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo })

    if (inviteError) {
      console.error('Invite email error:', inviteError)
      return res.status(500).json({ error: inviteError.message || 'Failed to send invite email' })
    }

    res.json({ success: true, data: { email }, invited: true })
  } catch (err) {
    console.error('Invite member error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ── PATCH /api/groups/:groupId/members/:memberId — change role ────
router.patch('/:groupId/members/:memberId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { groupId, memberId } = req.params
    const { role } = req.body || {}

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
  } catch (err) {
    console.error('Change role error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ── DELETE /api/groups/:groupId/members/:memberId — remove ────────
router.delete('/:groupId/members/:memberId', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { groupId, memberId } = req.params

    const requester = await getMember(groupId, userId)
    const isSelf = userId === memberId
    const canManage = requester && ['owner', 'admin'].includes(requester.role)

    if (!isSelf && !canManage)
      return res.status(403).json({ error: 'Not allowed' })

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
  } catch (err) {
    console.error('Remove member error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

// ── GET /api/groups — list groups current user is in ─────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { data } = await supabaseAdmin
      .from('group_members')
      .select('role, groups(id, name, invite_code, owner_id, created_at)')
      .eq('user_id', userId)

    const groups = (data || []).map(m => ({ ...m.groups, role: m.role })).filter(Boolean)
    res.json({ success: true, data: groups })
  } catch (err) {
    console.error('List groups error:', err)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

export default router
