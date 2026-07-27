import { supabaseAdmin } from '../config/supabase.js'

const ALL_MODULE_KEYS = ['projects', 'tasks', 'timeline', 'topics', 'standup', 'summary', 'testcases']

/**
 * Compute effective menu keys for a user, merging global + group + user rules.
 * Falls back gracefully if the menus table doesn't exist yet.
 *
 * @param {string} userId
 * @param {string|null} groupId
 * @returns {Promise<string[]>} all enabled menu keys
 */
export async function getEffectiveMenuKeys(userId, groupId = null) {
  try {
    // Determine which group(s) rules to check.
    // If a specific groupId is given, use only that group.
    // Otherwise, fetch ALL groups the user belongs to and apply any of their restrictions —
    // this ensures group-level disables work even when the user hasn't explicitly "activated"
    // team mode in sessionStorage (fresh tab, new browser, etc.).
    let groupIds = []
    if (groupId) {
      groupIds = [groupId]
    } else {
      const { data: memberships } = await supabaseAdmin
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
      groupIds = (memberships || []).map(m => m.group_id)
    }

    // Fetch menus + relevant disabled rules in parallel
    const queries = [
      supabaseAdmin.from('menus').select('key, always_on').order('sort_order'),
      supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'global').is('target_id', null).eq('enabled', false),
      supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'user').eq('target_id', userId).eq('enabled', false),
    ]

    if (groupIds.length > 0) {
      queries.push(
        supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'group').in('target_id', groupIds).eq('enabled', false)
      )
    }

    const [menusRes, ...ruleResults] = await Promise.all(queries)

    if (menusRes.error) throw new Error(menusRes.error.message)

    // Collect all disabled keys across every level
    const disabledKeys = new Set(
      ruleResults.flatMap(r => (r.data || []).map(row => row.menu_key))
    )

    // Return: always_on menus always included; configurable menus only if not disabled
    return (menusRes.data || [])
      .filter(m => m.always_on || !disabledKeys.has(m.key))
      .map(m => m.key)
  } catch (err) {
    console.warn('[menuAccess] getEffectiveMenuKeys fallback:', err.message)
    return null  // caller falls back to old logic
  }
}

/**
 * Get menu config for display in a settings UI.
 * Returns all non-always_on menus with disabled flags per level.
 *
 * @param {string} userId
 * @param {string|null} groupId
 * @returns {Promise<Array>}  [{ key, label, icon, desc, always_on, disabled_global, disabled_group, disabled_user }]
 */
export async function getMenuConfigForUser(userId, groupId = null) {
  const queries = [
    supabaseAdmin.from('menus').select('key, label, icon, always_on, description').order('sort_order'),
    supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'global').is('target_id', null).eq('enabled', false),
    supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'user').eq('target_id', userId).eq('enabled', false),
  ]
  if (groupId) {
    queries.push(
      supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'group').eq('target_id', groupId).eq('enabled', false)
    )
  }

  const [menusRes, globalRes, userRes, groupRes] = await Promise.all(queries)
  if (menusRes.error) throw new Error(menusRes.error.message)

  const globalDisabled = new Set((globalRes.data || []).map(r => r.menu_key))
  const userDisabled   = new Set((userRes.data   || []).map(r => r.menu_key))
  const groupDisabled  = new Set((groupRes?.data  || []).map(r => r.menu_key))

  return (menusRes.data || [])
    .filter(m => !m.always_on)  // only configurable menus in settings UI
    .map(m => ({
      key:             m.key,
      label:           m.label,
      icon:            m.icon,
      desc:            m.description,
      disabled_global: globalDisabled.has(m.key),
      disabled_group:  groupDisabled.has(m.key),
      disabled_user:   userDisabled.has(m.key),
    }))
}

/**
 * Get menu config for admin UI (global level).
 * Returns all menus with always_on flag and global disabled status.
 */
export async function getMenuConfigForAdmin() {
  const [menusRes, globalRes] = await Promise.all([
    supabaseAdmin.from('menus').select('key, label, icon, always_on, description').order('sort_order'),
    supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'global').is('target_id', null).eq('enabled', false),
  ])
  if (menusRes.error) throw new Error(menusRes.error.message)

  const globalDisabled = new Set((globalRes.data || []).map(r => r.menu_key))

  return (menusRes.data || []).map(m => ({
    key:       m.key,
    label:     m.label,
    icon:      m.icon,
    desc:      m.description,
    always_on: m.always_on,
    disabled:  globalDisabled.has(m.key),
  }))
}

/**
 * Get menu config for group owner UI.
 * Returns configurable menus with disabled_global + disabled_group flags.
 */
export async function getMenuConfigForGroup(groupId) {
  const [menusRes, globalRes, groupRes] = await Promise.all([
    supabaseAdmin.from('menus').select('key, label, icon, always_on, description').order('sort_order'),
    supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'global').is('target_id', null).eq('enabled', false),
    supabaseAdmin.from('menu_access').select('menu_key').eq('level', 'group').eq('target_id', groupId).eq('enabled', false),
  ])
  if (menusRes.error) throw new Error(menusRes.error.message)

  const globalDisabled = new Set((globalRes.data || []).map(r => r.menu_key))
  const groupDisabled  = new Set((groupRes.data  || []).map(r => r.menu_key))

  return (menusRes.data || [])
    .filter(m => !m.always_on)
    .map(m => ({
      key:             m.key,
      label:           m.label,
      icon:            m.icon,
      desc:            m.description,
      disabled_global: globalDisabled.has(m.key),
      disabled_group:  groupDisabled.has(m.key),
    }))
}

/**
 * Persist disabled menu keys for a given level + target.
 * Replaces all existing rules for that level+target.
 *
 * @param {'global'|'group'|'user'} level
 * @param {string|null} targetId - null for global
 * @param {string[]} disabledKeys - keys to disable
 * @param {string|null} updatedBy - user id
 */
export async function saveMenuAccess(level, targetId, disabledKeys, updatedBy = null) {
  // Delete all current rules for this level+target
  let delQ = supabaseAdmin.from('menu_access').delete().eq('level', level)
  delQ = targetId ? delQ.eq('target_id', targetId) : delQ.is('target_id', null)
  const { error: delErr } = await delQ
  if (delErr) throw new Error(delErr.message)

  if (!disabledKeys?.length) return

  // Re-insert only the disabled ones (we never store "enabled" rows)
  const rows = disabledKeys.map(key => ({
    menu_key:   key,
    level,
    target_id:  targetId || null,
    enabled:    false,
    updated_by: updatedBy || null,
    updated_at: new Date().toISOString(),
  }))

  const { error: insErr } = await supabaseAdmin.from('menu_access').insert(rows)
  if (insErr) throw new Error(insErr.message)
}

export { ALL_MODULE_KEYS }
