import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { workspaceApi } from '../services/api'
import { resolveVocabulary, DEFAULT_VOCABULARY, DEFAULT_MODULES, getProfession } from '../config/professions'
import { DEFAULT_STATUS_PIPELINES } from '../config/statuses'

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
  const [enabledModules,  setEnabledModules]  = useState(DEFAULT_MODULES)
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

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      const res = await workspaceApi.get()
      const d   = res.data.data || {}

      const prof    = d.profession     || 'general'
      const raw     = d.vocabulary     || {}
      const modules = d.enabled_modules || getProfession(prof)?.modules || DEFAULT_MODULES

      setProfession(prof)
      setRawVocab(raw)
      setVocabulary(resolveVocabulary(prof, raw))
      setEnabledModules(modules)
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

  useEffect(() => { load() }, [load])

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

  // ── Convenience: is a module enabled? ────────────────────────
  function isModuleEnabled(moduleKey) {
    return enabledModules.includes(moduleKey)
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
      enabledModules,
      customStatuses,
      workspaceName,
      accentColor,
      loading,
      saveWorkspace,
      saveProfession,
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
