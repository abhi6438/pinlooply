import { supabaseAdmin } from '../config/supabase.js'

// ── Plan definitions ──────────────────────────────────────────
// All plans are free — no payment required for any mode.
export const PLAN_LIMITS = {
  personal_free: {
    projects:       Infinity,
    group_members:  0,
    history_days:   Infinity,
    ai_provider:    'groq',
    label:          'Personal',
    mode:           'personal',
  },
  group_free: {
    projects:       Infinity,
    group_members:  Infinity,
    history_days:   Infinity,
    ai_provider:    'groq',
    label:          'Group',
    mode:           'group',
  },
  team_paid: {
    projects:       Infinity,
    group_members:  Infinity,
    history_days:   Infinity,
    ai_provider:    'groq',
    label:          'Team',
    mode:           'team',
  },
  org_paid: {
    projects:       Infinity,
    group_members:  Infinity,
    history_days:   Infinity,
    ai_provider:    'groq',
    label:          'Org',
    mode:           'org',
  },
}

// ── Derive plan key from user row ─────────────────────────────
export function getPlanKey(user) {
  const mode = user?.mode || 'personal'
  if (mode === 'personal') return 'personal_free'
  if (mode === 'group')    return 'group_free'
  if (mode === 'team')     return 'team_paid'
  if (mode === 'org')      return 'org_paid'
  return 'personal_free'
}

// ── Fetch user profile (plan + mode) ─────────────────────────
async function fetchProfile(userId) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, plan, mode')
    .eq('id', userId)
    .single()
  return data
}

// ── Middleware: check project creation limit ──────────────────
export async function checkProjectLimit(req, res, next) {
  try {
    const userId = req.user.id
    const profile = await fetchProfile(userId)
    const planKey = getPlanKey(profile)
    const limits  = PLAN_LIMITS[planKey]

    if (limits.projects === Infinity) return next()

    const { count } = await supabaseAdmin
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'archived')

    if ((count || 0) >= limits.projects) {
      return res.status(403).json({
        error:       `Project limit reached (${limits.projects}/${limits.projects})`,
        upgrade:     true,
        limit:       limits.projects,
        current:     count,
        plan:        planKey,
        upgrade_to:  planKey === 'personal_free' ? 'group_free' : 'team_paid',
        message:     `You've used all ${limits.projects} projects on the ${limits.label} plan. Upgrade to add more.`,
      })
    }

    // Attach counts to request for downstream use
    req.planInfo = { planKey, limits, projectCount: count }
    next()
  } catch (err) {
    console.error('planCheck error:', err)
    next() // non-fatal — don't block on plan-check failure
  }
}

// ── Middleware: check group member limit ──────────────────────
export async function checkMemberLimit(req, res, next) {
  try {
    const userId = req.user.id
    const { groupId } = req.params
    const profile = await fetchProfile(userId)
    const planKey = getPlanKey(profile)
    const limits  = PLAN_LIMITS[planKey]

    if (limits.group_members === Infinity) return next()
    if (limits.group_members === 0) {
      return res.status(403).json({
        error:    'Group features require the Group plan or higher',
        upgrade:  true,
        plan:     planKey,
        upgrade_to: 'group_free',
        message:  'Upgrade to Group (free) to invite team members and assign tasks.',
      })
    }

    const { count } = await supabaseAdmin
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)

    if ((count || 0) >= limits.group_members) {
      return res.status(403).json({
        error:    `Member limit reached (${count}/${limits.group_members})`,
        upgrade:  true,
        limit:    limits.group_members,
        current:  count,
        plan:     planKey,
        upgrade_to: planKey === 'group_free' ? 'team_paid' : 'org_paid',
        message:  `You've reached the ${limits.group_members}-member limit on the ${limits.label} plan.`,
      })
    }

    req.planInfo = { planKey, limits, memberCount: count }
    next()
  } catch (err) {
    console.error('planCheck member error:', err)
    next()
  }
}

// ── GET helper: return plan info for a user (used by /api/plan) ──
export async function getUserPlanInfo(userId) {
  const profile = await fetchProfile(userId)
  const planKey = getPlanKey(profile)
  const limits  = PLAN_LIMITS[planKey]

  // Count owned projects
  const { count: projectCount } = await supabaseAdmin
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'archived')

  // Count group members (if in a group)
  let memberCount = 0
  let groupId = null
  if (profile?.mode !== 'personal') {
    const { data: gm } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .limit(1)
      .single()
    if (gm?.group_id) {
      groupId = gm.group_id
      const { count: mc } = await supabaseAdmin
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId)
      memberCount = mc || 0
    }
  }

  return {
    planKey,
    label:        limits.label,
    mode:         profile?.mode || 'personal',
    plan:         profile?.plan || 'free',
    limits,
    usage: {
      projects:      { used: projectCount || 0, max: limits.projects },
      group_members: { used: memberCount,        max: limits.group_members },
    },
  }
}
