import { create } from 'zustand'
import { projectsApi } from '../services/api'

const STALE_MS = 30_000 // 30 seconds

export const useProjectStore = create((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,
  fetchedAt: null,
  lastGroupId: undefined, // track which workspace we last fetched for

  fetchProjects: async (userId, { force = false, groupId = null } = {}) => {
    const { fetchedAt, loading, lastGroupId } = get()
    if (loading) return
    // Force refetch when workspace changes
    const workspaceChanged = lastGroupId !== groupId
    if (!force && !workspaceChanged && fetchedAt && Date.now() - fetchedAt < STALE_MS) return

    set({ loading: true })
    try {
      const res = await projectsApi.list({ groupId })
      set({ projects: res.data.data ?? [], fetchedAt: Date.now(), lastGroupId: groupId })
    } catch (err) {
      console.error('[fetchProjects] error:', err.message)
    }
    set({ loading: false })
  },

  setActiveProject: (project) => set({ activeProject: project }),

  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects], fetchedAt: Date.now() })),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
}))
