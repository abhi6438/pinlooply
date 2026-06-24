import { create } from 'zustand'
import { supabase } from '../config/supabase'

const STALE_MS = 30_000 // 30 seconds

export const useTaskStore = create((set, get) => ({
  tasks: [],
  filter: { status: 'all', priority: 'all', projectId: null },
  loading: false,
  fetchedAt: null,
  fetchedProjectId: null, // track which project last loaded

  fetchTasksByProject: async (projectId, { force = false } = {}) => {
    const { fetchedAt, fetchedProjectId, loading } = get()
    if (loading) return
    // Skip re-fetch if same project and data is fresh
    if (!force && fetchedProjectId === projectId && fetchedAt && Date.now() - fetchedAt < STALE_MS) return

    set({ loading: true })
    const { data, error } = await supabase
      .from('tasks')
      .select('*, users!tasks_assigned_to_fkey(name, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (!error) set({ tasks: data ?? [], fetchedAt: Date.now(), fetchedProjectId: projectId })
    set({ loading: false })
  },

  fetchAllTasks: async (userId) => {
    set({ loading: true })
    // Let RLS handle visibility — fetch all tasks the user can see
    const { data, error } = await supabase
      .from('tasks')
      .select('*, projects(name, color)')
      .order('created_at', { ascending: false })
    if (!error) set({ tasks: data ?? [], fetchedAt: Date.now(), fetchedProjectId: null })
    set({ loading: false })
  },

  updateTaskStatus: async (taskId, status) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
    if (!error) {
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
      }))
    }
  },

  addTask: (task) =>
    set((state) => ({ tasks: [task, ...state.tasks] })),

  setFilter: (filter) =>
    set((state) => ({ filter: { ...state.filter, ...filter } })),

  invalidate: () => set({ fetchedAt: null }),
}))
