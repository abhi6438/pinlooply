import axios from 'axios'
import { supabase } from '../config/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({ baseURL: API_URL })

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

export const tasksApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`/api/tasks${qs ? `?${qs}` : ''}`)
  },

  create: (payload) =>
    api.post('/api/tasks', payload),

  update: (taskId, payload) =>
    api.patch(`/api/tasks/${taskId}`, payload),

  delete: (taskId) =>
    api.delete(`/api/tasks/${taskId}`),

  bulk: (payload) =>
    api.patch('/api/tasks/bulk', payload),
}

export const topicsApi = {
  list: (projectId) =>
    api.get(`/api/topics/${projectId}`),

  detail: (topicId) =>
    api.get(`/api/topics/detail/${topicId}`),

  updateStatus: (topicId, status) =>
    api.patch(`/api/topics/${topicId}/status`, { status }),

  versions: (topicId) =>
    api.get(`/api/topics/${topicId}/versions`),
}

export const discussionsApi = {
  process: (rawText, projectId, source) =>
    api.post('/api/discussions/process', { rawText, projectId, source }),

  save: (rawText, projectId, source, aiResult) =>
    api.post('/api/discussions/save', { rawText, projectId, source, aiResult }),

  list: (projectId) =>
    api.get(`/api/discussions/${projectId}`),
}

export default api
