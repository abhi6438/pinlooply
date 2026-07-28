import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { workspaceApi, adminApi, groupsApi } from '../services/api'
import { resolveVocabulary, DEFAULT_VOCABULARY, DEFAULT_MODULES, getProfession } from '../config/professions'
import { DEFAULT_STATUS_PIPELINES } from '../config/statuses'

// All configurable module keys (admin/group can restrict these)
export const ALL_MODULE_KEYS = ['projects', 'tasks', 'timeline', 'topics', 'standup', 'summary', 'testcases']

// Fallback merge: used only when server has NOT returned effective_menus
// (i.e. migration 021 not yet run — old system only)
function mergeModules(globalModules, groupModules, userModules) {
  const global = globalModules || ALL_MODULE_KEYS
  const group  = groupModules  || global  // null = inherits global
  return userModules.filter(m => global.includes(m) && group.includes(m))
}

const WorkspaceContext = createContext(null)

// ── Session workspace helpers ─────────────────────────────────
const SESSION_KEY = 'pw_active_workspace'

function readSessionWorkspace() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeSessionWorkspace(ws) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(ws)) } catch {}
}

export function clearSessionWorkspace() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch {}
}

export function WorkspaceProvider({ children }) {
  const { user } = useAuth()

  const [profession,      setProfession]      = useState('general')
  const [vocabulary,      setVocabulary]      = useState(DEFAULT_VOCABULARY)
  const [enabledModules,  setEnabledModules]  = useState(DEFAULT_MODULES)  // user's raw DB pref
  const [globalModules,   setGlobalModules]   = useState(ALL_MODULE_KEYS)  // admin-level (old system)
  const [groupModules,    setGroupModules]    = useState(null)              // team-level (old system)
  const [customStatuses,  setCustomStatuses]  = useState(null)
  const [workspaceName,   setWorkspaceName]   = useState(null)
  const [accentColor,     setAccentColor]     = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [rawVocab,        setRawVocab]        = useState({})
  const hasLoadedOnce = useRef(false)

  // ── DB-driven effective menus (migration 021+) ────────────────
  // When non-null, this is the authoritative list from the server.
  // It already incorporates global + group + user restrictions.
  // When null, fall back to old mergeModules logic.
  const [serverEffectiveMenus, setServerEffectiveMenus] = useState(null)

  // ── Session workspace (personal vs team) ─────────────────────
  const [activeWorkspace, setActiveWorkspaceState] = useState(() => readSessionWorkspace())

  function setActiveWorkspace(ws) {
    writeSessionWorkspace(ws)
    setActiveWorkspaceState(ws)
  }

  const activeMode      = activeWorkspace?.mode    ?? null
  const activeGroupId   = activeWorkspace?.groupId ?? null
  const activeGroupName = activeWorkspace?.groupName ?? null

  // ── Apply accent color CSS variables ─────────────────────────
  function applyAccentColor(hex) {
    if (!hex) {
      document.documentElement.style.removeProperty('--color-primary-500')
      document.documentElement.style.removeProperty('--color-primary-600')
      document.documentElement.style.removeProperty('--color-primary-700')
      document.documentElement.style.removeProperty('--color-primary-100')
      document.documentElement.style.removeProperty('--color-primary-50')
      return
    }
    document.documentElement.style.setProperty('--color-primary-500', hex)
    document.documentElement.style.setProperty('--color-primary-600', hex)
    document.documentElement.style.setProperty('--color-primary-700', hex)
    document.documentElement.style.setProperty('--accent-hex', hex)
  }

  const load = useCallback(async (groupId = null) => {
    if (!user) { setLoading(false); return }
    // Only show the skeleton on the very first load.
    // Subsequent silent refreshes keep the existing menu visible.
    if (!hasLoadedOnce.current) setLoading(true)
    try {
      const res = await workspaceApi.get(groupId)
      const d   = res.data.data || {}

      const prof    = d.profession      || 'general'
      const raw     = d.vocabulary      || {}
      const modules = d.enabled_modules || getProfession(prof)?.modules || DEFAULT_MODULES

      setProfession(prof)
      setRawVocab(raw)
      setVocabulary(resolveVocabulary(prof, raw))
      setEnabledModules(modules)
      setGlobalModules(d.global_modules || ALL_MODULE_KEYS)
      setGroupModules(d.group_modules ?? null)
      setCustomStatuses(d.custom_statuses || null)
      setWorkspaceName(d.workspace_name   || null)
      setAccentColor(d.accent_color       || null)
      applyAccentColor(d.accent_color     || null)

      // Store effective_menus directly — this is the authoritative list from the server.
      // It includes global + group + user restrictions already applied.
      // null = migration 021 not run yet; fall back to old mergeModules logic.
      setServerEffectiveMenus(Array.isArray(d.effective_menus) ? d.effective_menus : null)
    } catch {
      // Non-fatal — keep defaults
    } finally {
      hasLoadedOnce.current = true
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // Reset "has loaded" flag when workspace switches so the skeleton shows once for the new workspace
    hasLoadedOnce.current = false
    load(activeGroupId)
  }, [load, activeGroupId])

  // ── Save full workspace settings ─────────────────────────────
  // NOTE: we do NOT touch serverEffectiveMenus here — group/global restrictions
  // must persist even after the user saves their profile/vocabulary/colors.
  async function saveWorkspace({ profession: p, vocabulary: v, enabled_modules: m, custom_statuses: cs, workspace_name: wn, accent_color: ac }) {
    const payload = {}
    if (p  !== undefined) payload.profession       = p
    if (v  !== undefined) payload.vocabulary       = v
    if (m  !== undefined) payload.enabled_modules  = m
    if (cs !== undefined) payload.custom_statuses  = cs
    if (wn !== undefined) payload.workspace_name   = wn
    if (ac !== undefined) payload.accent_color     = ac

    const res = await workspaceApi.save(payload)
    const d   = res.data.data

    const newProf    = d.profession      || 'general'
    const newRaw     = d.vocabulary      || {}
    const newModules = d.enabled_modules || DEFAULT_MODULES

    setProfession(newProf)
    setRawVocab(newRaw)
    setVocabulary(resolveVocabulary(newProf, newRaw))
    setEnabledModules(newModules)
    setCustomStatuses(d.custom_statuses || null)
    setWorkspaceName(d.workspace_name   || null)
    setAccentColor(d.accent_color       || null)
    applyAccentColor(d.accent_color     || null)
    // ← intentionally NOT calling setServerEffectiveMenus here —
    //   restrictions from the DB stay in force until next full load()

    return d
  }

  // ── Quick-save profession (onboarding) ───────────────────────
  async function saveProfession(p) {
    const prof   = getProfession(p)
    const newVoc = resolveVocabulary(p, {})
    const mods   = prof?.modules || DEFAULT_MODULES
    setProfession(p)
    setVocabulary(newVoc)
    setRawVocab({})
    setEnabledModules(mods)
    // ← intentionally NOT touching serverEffectiveMenus
    await workspaceApi.save({ profession: p, vocabulary: {}, enabled_modules: mods })
  }

  // ── Effective modules — THE authoritative list for the sidebar ──
  // Priority: server-computed (migration 021+) > old merge logic
  const effectiveModules = serverEffectiveMenus
    ? serverEffectiveMenus.filter(k => ALL_MODULE_KEYS.includes(k))
    : mergeModules(globalModules, groupModules, enabledModules)

  function isModuleEnabled(moduleKey) {
    return effectiveModules.includes(moduleKey)
  }

  // ── Save group-level modules (old system, kept for compat) ───
  async function saveGroupModules(groupId, modules) {
    await groupsApi.saveModules(groupId, modules)
    setGroupModules(modules)
  }

  // ── Save global modules (old system, kept for compat) ────────
  async function saveGlobalModules(modules) {
    await adminApi.saveModuleConfig(modules)
    setGlobalModules(modules)
  }

  // ── Resolve status pipeline ───────────────────────────────────
  function getEffectiveStatuses(projectStatuses) {
    if (projectStatuses && Array.isArray(projectStatuses) && projectStatuses.length > 0) {
      return projectStatuses
    }
    if (customStatuses && Array.isArray(customStatuses) && customStatuses.length > 0) {
      return customStatuses
    }
    const profData = getProfession(profession)
    return profData?.defaultStatuses || DEFAULT_STATUS_PIPELINES.general
  }

  return (
    <WorkspaceContext.Provider value={{
      profession,
      vocabulary,
      rawVocab,
      enabledModules,           // user's raw DB pref (use for settings UI)
      effectiveModules,         // authoritative for nav — use this everywhere
      globalModules,
      groupModules,
      customStatuses,
      workspaceName,
      accentColor,
      loading,
      saveWorkspace,
      saveProfession,
      saveGroupModules,
      saveGlobalModules,
      isModuleEnabled,
      getEffectiveStatuses,
      reload: load,
      activeMode,
      activeGroupId,
      activeGroupName,
      setActiveWorkspace,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}

export function useVocabulary() {
  return useWorkspace().vocabulary
}
