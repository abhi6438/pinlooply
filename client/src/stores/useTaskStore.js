import { create } from 'zustand'
import { supabase } from '../config/supabase'

export const useTaskStore = create((set, get) => ({
  tasks: [],
  filter: { status: 'all', priority: 'all', projectId: null },
  loading: false,

  fetchTasksByProject: async (projectId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('tasks')
      .select('*, users!tasks_assigned_to_fkey(name, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (!error) set({ tasks: data ?? [] })
    set({ loading: false })
  },

  fetchAllTasks: async (userId) => {
    set({ loading: true })
    // Let RLS handle visibility — fetch all tasks the user can see across all their projects
    const { data, error } = await supabase
      .from('tasks')
      .select('*, projects(name, color)')
      .order('created_at', { ascending: false })
    if (!error) set({ tasks: data ?? [] })
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
}))
