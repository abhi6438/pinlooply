import axios from 'axios'
import { supabase } from '../config/supabase'

// Empty string = relative paths (/api/*) — Vite proxy in dev, Vercel routing in prod
const API_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: API_URL })

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

export const groupsApi = {
  list: () => api.get('/api/groups'),
  create: (payload) => api.post('/api/groups', payload),
  get: (groupId) => api.get(`/api/groups/${groupId}`),
  validateInvite: (inviteCode) => api.get(`/api/groups/invite/${inviteCode}`),
  join: (groupId, invite_code) => api.post(`/api/groups/${groupId}/join`, { invite_code }),
  inviteMember: (groupId, email) => api.post(`/api/groups/${groupId}/members`, { email }),
  getGroupMembers: (groupId) => api.get(`/api/groups/${groupId}`),
  updateRole: (groupId, memberId, role) => api.patch(`/api/groups/${groupId}/members/${memberId}`, { role }),
  removeMember: (groupId, memberId) => api.delete(`/api/groups/${groupId}/members/${memberId}`),
}

export const projectsApi = {
  list: () => api.get('/api/projects'),
  create: (payload) => api.post('/api/projects', payload),
  update: (projectId, payload) => api.patch(`/api/projects/${projectId}`, payload),
  archive: (projectId) => api.delete(`/api/projects/${projectId}`),
  stats: (projectId) => api.get(`/api/projects/${projectId}/stats`),
}

export const timelineApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`/api/timeline${qs ? `?${qs}` : ''}`)
  },
}

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

  assign: (taskId, assignedTo) =>
    api.patch(`/api/tasks/${taskId}/assign`, { assigned_to: assignedTo }),
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

export const notificationsApi = {
  list: () => api.get('/api/notifications'),
  markRead: (id) => api.patch(`/api/notifications/${id}/read`),
  markAllRead: () => api.patch('/api/notifications/read-all'),
}

export const standupApi = {
  generate: () => api.post('/api/standup/generate'),
}

export const summaryApi = {
  weekly: (week) => api.get(`/api/summary/weekly${week ? `?week=${week}` : ''}`),
}

export const planApi = {
  get:     () => api.get('/api/plan'),
  upgrade: (mode) => api.post('/api/plan/upgrade', { mode }),
}

export const adminApi = {
  getAiConfig:    ()             => api.get('/api/admin/ai-config'),
  saveAiConfig:   (configs)      => api.put('/api/admin/ai-config', { configs }),
  getStats:       ()             => api.get('/api/admin/stats'),
  getUsers:       (search = '')  => api.get(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  updateUserPlan: (userId, body) => api.patch(`/api/admin/users/${userId}/plan`, body),
}

export const publishApi = {
  getStatus: (projectId) => api.get(`/api/projects/${projectId}/publish-status`),
  enable:    (projectId) => api.post(`/api/projects/${projectId}/publish`),
  disable:   (projectId) => api.delete(`/api/projects/${projectId}/publish`),
}
