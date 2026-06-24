import { create } from 'zustand'
import { supabase } from '../config/supabase'

const STALE_MS = 30_000 // 30 seconds — skip re-fetch if data is this fresh

export const useProjectStore = create((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,
  fetchedAt: null,

  fetchProjects: async (userId, { force = false } = {}) => {
    const { fetchedAt, loading } = get()
    // Skip if already loading or data is fresh (unless forced)
    if (loading) return
    if (!force && fetchedAt && Date.now() - fetchedAt < STALE_MS) return

    set({ loading: true })
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[fetchProjects] error:', error.message)
    } else {
      set({ projects: data ?? [], fetchedAt: Date.now() })
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
