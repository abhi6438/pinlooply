import { create } from 'zustand'
import { supabase } from '../config/supabase'

export const useProjectStore = create((set, get) => ({
  projects: [],
  activeProject: null,
  loading: false,

  fetchProjects: async (userId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (!error) set({ projects: data ?? [] })
    set({ loading: false })
  },

  setActiveProject: (project) => set({ activeProject: project }),

  addProject: (project) =>
    set((state) => ({ projects: [project, ...state.projects] })),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
}))
