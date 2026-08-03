import axios from 'axios'
import { supabase } from '../config/supabase'

// Empty string = relative paths (/api/*) — Vite proxy in dev, Vercel routing in prod
const API_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: API_URL })

// Attach Supabase JWT to every request (always get a fresh token)
api.interceptors.request.use(async (config) => {
  // getUser() validates with Supabase server and triggers refresh if needed
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// On 401 — refresh session and retry once
api.interceptors.response.use(
  res => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { data: { session } } = await supabase.auth.refreshSession()
        if (session?.access_token) {
          original.headers.Authorization = `Bearer ${session.access_token}`
          return api(original)
        }
      } catch {
        // Refresh failed — sign out and redirect to login
        await supabase.auth.signOut()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

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
  saveModules: (groupId, modules) => api.patch(`/api/groups/${groupId}/modules`, { modules }),
  // New DB-driven menu access
  getMenus: (groupId) => api.get(`/api/groups/${groupId}/menus`),
  saveMenus: (groupId, disabledKeys) => api.put(`/api/groups/${groupId}/menus`, { disabled_keys: disabledKeys }),
}

export const projectsApi = {
  list: ({ groupId } = {}) => api.get('/api/projects', { params: groupId ? { group_id: groupId } : { group_id: 'personal' } }),
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

  suggestUpdate: (taskId, existingText) =>
    api.post(`/api/tasks/${taskId}/suggest-update`, existingText ? { existing_text: existingText } : {}),
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
  generate: (payload = {}) => api.post('/api/standup/generate', payload),
}

export const summaryApi = {
  weekly:  (week, extraParams = {})  => api.get('/api/summary/weekly',  { params: { week,  ...extraParams } }),
  monthly: (month, extraParams = {}) => api.get('/api/summary/monthly', { params: { month, ...extraParams } }),
}

export const planApi = {
  get:     () => api.get('/api/plan'),
  upgrade: (mode) => api.post('/api/plan/upgrade', { mode }),
}

export const workspaceApi = {
  get:      (groupId) => api.get('/api/workspace', { params: groupId ? { group_id: groupId } : {} }),
  save:     (payload) => api.patch('/api/workspace', payload),
  // DB-driven personal menu access
  getMenus:  (groupId) => api.get('/api/workspace/menus', { params: groupId ? { group_id: groupId } : {} }),
  saveMenus: (disabledKeys) => api.put('/api/workspace/menus', { disabled_keys: disabledKeys }),
}

export const adminApi = {
  getAiConfig:       ()             => api.get('/api/admin/ai-config'),
  saveAiConfig:      (configs)      => api.put('/api/admin/ai-config', { configs }),
  getStats:          ()             => api.get('/api/admin/stats'),
  getDetailedUsage:  ()             => api.get('/api/admin/usage-detail'),
  getUsers:          (search = '')  => api.get(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  updateUserPlan:    (userId, body) => api.patch(`/api/admin/users/${userId}/plan`, body),
  getDonateConfig:   ()             => api.get('/api/admin/donate-config'),
  saveDonateConfig:  (config)       => api.put('/api/admin/donate-config', config),
  getFeedback:       (params = {})  => api.get('/api/admin/feedback',  { params }),
  getDonors:         (params = {})  => api.get('/api/admin/donors',    { params }),
  markThanked:       (id)           => api.patch(`/api/admin/donors/${id}/thanked`),
  getFeedbackReplies: (id)          => api.get(`/api/admin/feedback/${id}/replies`),
  replyFeedback:     (id, text)     => api.post(`/api/admin/feedback/${id}/reply`, { replyText: text }),
  replyDonor:        (id, text)     => api.post(`/api/admin/donors/${id}/reply`,   { replyText: text }),
  getModuleConfig:   ()             => api.get('/api/admin/module-config'),
  saveModuleConfig:  (modules)      => api.put('/api/admin/module-config', { modules }),
  // New DB-driven menu access
  getMenus:              ()             => api.get('/api/admin/menus'),
  saveMenus:             (disabledKeys) => api.put('/api/admin/menus', { disabled_keys: disabledKeys }),
  backfillTaskNumbers:   ()             => api.post('/api/admin/backfill-task-numbers'),
}

export const feedbackApi = {
  submit: (body) => fetch('/api/public/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
}

export const donorApi = {
  notify: (body) => fetch('/api/public/donor-notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),

  razorpayCreateOrder: (amount, user_id) => fetch('/api/public/razorpay/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, user_id }),
  }).then(r => r.json()),

  razorpayVerify: (body) => fetch('/api/public/razorpay/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json()),
}

export const publishApi = {
  getStatus: (projectId) => api.get(`/api/projects/${projectId}/publish-status`),
  enable:    (projectId) => api.post(`/api/projects/${projectId}/publish`),
  disable:   (projectId) => api.delete(`/api/projects/${projectId}/publish`),
}

export const collectionsApi = {
  get:    (groupId) => api.get('/api/collections',  { headers: groupId ? { 'x-group-id': groupId } : {} }),
  save:   (body, groupId) => api.post('/api/collections', body, { headers: groupId ? { 'x-group-id': groupId } : {} }),
  remove: (groupId) => api.delete('/api/collections', { headers: groupId ? { 'x-group-id': groupId } : {} }),
}

export const testCasesApi = {
  generate:     (payload)         => api.post('/api/testcases/generate', payload),
  save:         (payload)         => api.post('/api/testcases/save', payload),
  list:         (projectId)       => api.get(`/api/testcases/${projectId}`),
  updateStatus: (id, status)      => api.patch(`/api/testcases/${id}/status`, { status }),
  delete:       (id)              => api.delete(`/api/testcases/${id}`),
}

export const managerApi = {
  overview:    (params = {}) => api.get('/api/manager/overview', { params }),
  memberTasks: (memberId)    => api.get(`/api/manager/member/${memberId}/tasks`),
}

export const customFieldsApi = {
  // Field definitions
  list:   ()            => api.get('/api/custom-fields'),
  create: (payload)     => api.post('/api/custom-fields', payload),
  update: (id, payload) => api.patch(`/api/custom-fields/${id}`, payload),
  delete: (id)          => api.delete(`/api/custom-fields/${id}`),
  // Task values
  getValues:  (taskId)          => api.get(`/api/custom-fields/task-values/${taskId}`),
  saveValues: (taskId, values)  => api.patch(`/api/custom-fields/task-values/${taskId}`, { values }),
}

export const automationsApi = {
  list:       ()            => api.get('/api/automations'),
  create:     (payload)     => api.post('/api/automations', payload),
  update:     (id, payload) => api.patch(`/api/automations/${id}`, payload),
  delete:     (id)          => api.delete(`/api/automations/${id}`),
  runOverdue: ()            => api.post('/api/automations/run-overdue'),
}

export const timeEntriesApi = {
  list:    (params = {})   => api.get('/api/time-entries',        { params }),
  report:  (params = {})   => api.get('/api/time-entries/report', { params }),
  worklog: (params = {})   => api.get('/api/time-entries/worklog', { params }),
  create:  (payload)       => api.post('/api/time-entries', payload),
  update:  (id, payload)   => api.patch(`/api/time-entries/${id}`, payload),
  delete:  (id)            => api.delete(`/api/time-entries/${id}`),
}

export const taskUpdatesApi = {
  list:          (taskId)                              => api.get(`/api/tasks/${taskId}/updates`),
  create:        (taskId, content, updateType)         => api.post(`/api/tasks/${taskId}/updates`, { content, update_type: updateType }),
  update:        (taskId, updateId, content, type)     => api.patch(`/api/tasks/${taskId}/updates/${updateId}`, { content, update_type: type }),
  delete:        (taskId, updateId)                    => api.delete(`/api/tasks/${taskId}/updates/${updateId}`),
  suggestImprove: (taskId, existing_text)              => api.post(`/api/tasks/${taskId}/suggest-update`, { existing_text }),
}

export const taskLinksApi = {
  list:   (taskId)                                  => api.get(`/api/tasks/${taskId}/links`),
  create: (taskId, targetTaskId, linkType, note)    => api.post(`/api/tasks/${taskId}/links`, { target_task_id: targetTaskId, link_type: linkType, note }),
  delete: (taskId, linkId)                          => api.delete(`/api/tasks/${taskId}/links/${linkId}`),
}

export const searchApi = {
  query: (q, { groupId, limit = 20 } = {}) => api.get('/api/search', {
    params: { q, limit, group_id: groupId || 'personal' },
  }),
}

export const suggestionsApi = {
  get: ({ groupId } = {}) => api.get('/api/suggestions', {
    params: groupId ? { group_id: groupId } : { group_id: 'personal' },
  }),
}
