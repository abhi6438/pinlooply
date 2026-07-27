import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { workspaceApi, adminApi, groupsApi } from '../services/api'
import { resolveVocabulary, DEFAULT_VOCABULARY, DEFAULT_MODULES, getProfession } from '../config/professions'
import { DEFAULT_STATUS_PIPELINES } from '../config/statuses'

// All configurable module keys (admin/group can restrict these)
export const ALL_MODULE_KEYS = ['projects', 'tasks', 'timeline', 'topics', 'standup', 'summary', 'testcases']

// Merge: effective = globalAllowed ∩ groupAllowed ∩ userEnabled
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
  const [enabledModules,  setEnabledModules]  = useState(DEFAULT_MODULES)  // user's own pref
  const [globalModules,   setGlobalModules]   = useState(ALL_MODULE_KEYS)  // admin-level
  const [groupModules,    setGroupModules]    = useState(null)              // team-level (null = inherit)
  const [customStatuses,  setCustomStatuses]  = useState(null)
  const [workspaceName,   setWorkspaceName]   = useState(null)
  const [accentColor,     setAccentColor]     = useState(null)
  const [loading,         setLoading]         = useState(true)
  const [rawVocab,        setRawVocab]        = useState({}) // user overrides (not merged)

  // ── Session workspace (personal vs team) — persists for browser session ──
  const [activeWorkspace, setActiveWorkspaceState] = useState(() => readSessionWorkspace())

  function setActiveWorkspace(ws) {
    writeSessionWorkspace(ws)
    setActiveWorkspaceState(ws)
  }

  // activeMode: the mode in effect right now (may differ from DB mode)
  const activeMode    = activeWorkspace?.mode    ?? null // null = not chosen yet
  const activeGroupId = activeWorkspace?.groupId ?? null
  const activeGroupName = activeWorkspace?.groupName ?? null

  // ── Apply accent color CSS variables ─────────────────────────
  function applyAccentColor(hex) {
    if (!hex) {
      // Reset to default purple
      document.documentElement.style.removeProperty('--color-primary-500')
      document.documentElement.style.removeProperty('--color-primary-600')
      document.documentElement.style.removeProperty('--color-primary-700')
      document.documentElement.style.removeProperty('--color-primary-100')
      document.documentElement.style.removeProperty('--color-primary-50')
      return
    }
    // Apply hex as base; derive lighter/darker shades via CSS filter tricks
    document.documentElement.style.setProperty('--color-primary-500', hex)
    document.documentElement.style.setProperty('--color-primary-600', hex)
    document.documentElement.style.setProperty('--color-primary-700', hex)
    // For lighter shades we use the hex with opacity via the CSS variable
    document.documentElement.style.setProperty('--accent-hex', hex)
  }

  const load = useCallback(async (groupId = null) => {
    if (!user) { setLoading(false); return }
    try {
      // Single request — workspace + global_modules + group_modules all in one
      const res = await workspaceApi.get(groupId)
      const d   = res.data.data || {}

      const prof    = d.profession      || 'general'
      const raw     = d.vocabulary      || {}
      const modules = d.enabled_modules || getProfession(prof)?.modules || DEFAULT_MODULES

      setProfession(prof)
      setRawVocab(raw)
      setVocabulary(resolveVocabulary(prof, raw))
      setEnabledModules(modules)
      // global_modules comes directly from the workspace response (server fetched it)
      setGlobalModules(d.global_modules || ALL_MODULE_KEYS)
      // group_modules: null means no restriction at group level
      setGroupModules(d.group_modules ?? null)
      setCustomStatuses(d.custom_statuses || null)
      setWorkspaceName(d.workspace_name   || null)
      setAccentColor(d.accent_color       || null)
      applyAccentColor(d.accent_color     || null)
    } catch {
      // Non-fatal — use defaults
    } finally {
      setLoading(false)
    }
  }, [user])

  // Load workspace (includes global_modules + group_modules from server)
  useEffect(() => { load(activeGroupId) }, [load, activeGroupId])

  // ── Save full workspace settings ─────────────────────────────
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
    await workspaceApi.save({ profession: p, vocabulary: {}, enabled_modules: mods })
  }

  // ── Effective modules: intersection of all three levels ──────
  const effectiveModules = mergeModules(globalModules, groupModules, enabledModules)

  // ── Convenience: is a module enabled? ────────────────────────
  function isModuleEnabled(moduleKey) {
    return effectiveModules.includes(moduleKey)
  }

  // ── Save group-level modules ──────────────────────────────────
  async function saveGroupModules(groupId, modules) {
    await groupsApi.saveModules(groupId, modules)
    setGroupModules(modules)
  }

  // ── Save global modules (admin only) ──────────────────────────
  async function saveGlobalModules(modules) {
    await adminApi.saveModuleConfig(modules)
    setGlobalModules(modules)
  }

  // ── Resolve status pipeline ───────────────────────────────────
  // Priority: projectStatuses → workspace customStatuses → profession defaults → general defaults
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
      enabledModules,       // user's own preference
      effectiveModules,     // merged: global ∩ group ∩ user — use this for nav
      globalModules,        // admin-level allowed modules
      groupModules,         // group-level allowed modules (null = inherit)
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
      // Session workspace
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

// ── Convenience hook — just the vocabulary ────────────────────
export function useVocabulary() {
  return useWorkspace().vocabulary
}
