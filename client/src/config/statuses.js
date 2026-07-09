// ── Status color palette ───────────────────────────────────────
// Each color name maps to Tailwind classes used throughout the app.

export const STATUS_COLORS = {
  warm:   { dot: 'bg-warm-400',    badge: 'bg-warm-100 text-warm-600',       header: 'bg-warm-100',    text: 'text-warm-600'   },
  blue:   { dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700',       header: 'bg-blue-100',    text: 'text-blue-700'   },
  violet: { dot: 'bg-violet-500',  badge: 'bg-violet-100 text-violet-700',   header: 'bg-violet-100',  text: 'text-violet-700' },
  green:  { dot: 'bg-green-500',   badge: 'bg-green-100 text-green-700',     header: 'bg-green-100',   text: 'text-green-700'  },
  red:    { dot: 'bg-red-500',     badge: 'bg-red-100 text-red-700',         header: 'bg-red-100',     text: 'text-red-700'    },
  amber:  { dot: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700',     header: 'bg-amber-100',   text: 'text-amber-700'  },
  orange: { dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700',   header: 'bg-orange-100',  text: 'text-orange-700' },
  teal:   { dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700',       header: 'bg-teal-100',    text: 'text-teal-700'   },
  pink:   { dot: 'bg-pink-500',    badge: 'bg-pink-100 text-pink-700',       header: 'bg-pink-100',    text: 'text-pink-700'   },
}

export const COLOR_OPTIONS = [
  { key: 'warm',   hex: '#9ca3af', label: 'Gray'   },
  { key: 'blue',   hex: '#3b82f6', label: 'Blue'   },
  { key: 'violet', hex: '#8b5cf6', label: 'Purple' },
  { key: 'green',  hex: '#22c55e', label: 'Green'  },
  { key: 'red',    hex: '#ef4444', label: 'Red'    },
  { key: 'amber',  hex: '#f59e0b', label: 'Amber'  },
  { key: 'orange', hex: '#f97316', label: 'Orange' },
  { key: 'teal',   hex: '#14b8a6', label: 'Teal'   },
  { key: 'pink',   hex: '#ec4899', label: 'Pink'   },
]

// ── Default status pipelines per profession ────────────────────
export const DEFAULT_STATUS_PIPELINES = {
  software: [
    { key: 'backlog',     label: 'Backlog',      color: 'warm',   is_done: false },
    { key: 'todo',        label: 'To Do',        color: 'warm',   is_done: false },
    { key: 'in_progress', label: 'In Progress',  color: 'blue',   is_done: false },
    { key: 'in_review',   label: 'In Review',    color: 'violet', is_done: false },
    { key: 'qa_testing',  label: 'QA Testing',   color: 'amber',  is_done: false },
    { key: 'uat',         label: 'UAT',          color: 'orange', is_done: false },
    { key: 'deployment',  label: 'Deployment',   color: 'teal',   is_done: false },
    { key: 'pilot',       label: 'Pilot',        color: 'pink',   is_done: false },
    { key: 'done',        label: 'Done / Prod',  color: 'green',  is_done: true  },
  ],
  education: [
    { key: 'assigned',    label: 'Assigned',    color: 'warm',   is_done: false },
    { key: 'in_progress', label: 'In Progress', color: 'blue',   is_done: false },
    { key: 'submitted',   label: 'Submitted',   color: 'violet', is_done: false },
    { key: 'graded',      label: 'Graded',      color: 'green',  is_done: true  },
  ],
  legal: [
    { key: 'open',        label: 'Open',         color: 'warm',   is_done: false },
    { key: 'in_review',   label: 'Under Review', color: 'blue',   is_done: false },
    { key: 'pending',     label: 'Pending',      color: 'amber',  is_done: false },
    { key: 'closed',      label: 'Closed',       color: 'green',  is_done: true  },
  ],
  marketing: [
    { key: 'todo',        label: 'To Do',       color: 'warm',   is_done: false },
    { key: 'in_progress', label: 'In Progress', color: 'blue',   is_done: false },
    { key: 'in_review',   label: 'In Review',   color: 'violet', is_done: false },
    { key: 'published',   label: 'Published',   color: 'green',  is_done: true  },
  ],
  healthcare: [
    { key: 'scheduled',   label: 'Scheduled',   color: 'warm',   is_done: false },
    { key: 'in_progress', label: 'In Progress', color: 'blue',   is_done: false },
    { key: 'completed',   label: 'Completed',   color: 'violet', is_done: false },
    { key: 'followed_up', label: 'Followed Up', color: 'green',  is_done: true  },
  ],
  freelancer: [
    { key: 'todo',        label: 'To Do',        color: 'warm',   is_done: false },
    { key: 'in_progress', label: 'In Progress',  color: 'blue',   is_done: false },
    { key: 'in_review',   label: 'Client Review',color: 'violet', is_done: false },
    { key: 'approved',    label: 'Approved',     color: 'green',  is_done: true  },
  ],
  sales: [
    { key: 'lead',        label: 'Lead',         color: 'warm',   is_done: false },
    { key: 'qualified',   label: 'Qualified',    color: 'blue',   is_done: false },
    { key: 'proposal',    label: 'Proposal',     color: 'violet', is_done: false },
    { key: 'negotiation', label: 'Negotiation',  color: 'amber',  is_done: false },
    { key: 'won',         label: 'Won',          color: 'green',  is_done: true  },
  ],
  hr: [
    { key: 'open',        label: 'Open',        color: 'warm',   is_done: false },
    { key: 'screening',   label: 'Screening',   color: 'blue',   is_done: false },
    { key: 'interview',   label: 'Interview',   color: 'violet', is_done: false },
    { key: 'hired',       label: 'Hired',       color: 'green',  is_done: true  },
  ],
  construction: [
    { key: 'todo',        label: 'To Do',       color: 'warm',   is_done: false },
    { key: 'in_progress', label: 'In Progress', color: 'blue',   is_done: false },
    { key: 'inspection',  label: 'Inspection',  color: 'amber',  is_done: false },
    { key: 'done',        label: 'Done',        color: 'green',  is_done: true  },
  ],
  general: [
    { key: 'backlog',     label: 'Backlog',      color: 'warm',   is_done: false },
    { key: 'todo',        label: 'To Do',        color: 'warm',   is_done: false },
    { key: 'in_progress', label: 'In Progress',  color: 'blue',   is_done: false },
    { key: 'in_review',   label: 'In Review',    color: 'violet', is_done: false },
    { key: 'qa_testing',  label: 'QA Testing',   color: 'amber',  is_done: false },
    { key: 'uat',         label: 'UAT',          color: 'orange', is_done: false },
    { key: 'deployment',  label: 'Deployment',   color: 'teal',   is_done: false },
    { key: 'pilot',       label: 'Pilot',        color: 'pink',   is_done: false },
    { key: 'done',        label: 'Done / Prod',  color: 'green',  is_done: true  },
  ],
}

// ── Helper: generate a slug key from a label ──────────────────
export function labelToKey(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

// ── Helper: get colors for a status object ────────────────────
export function getStatusColors(status) {
  return STATUS_COLORS[status?.color] || STATUS_COLORS.warm
}

// ── Helper: normalise a raw status value from DB ──────────────
// Maps legacy values and unknown keys to the first status in the pipeline
export function normalizeStatusKey(raw, pipeline) {
  if (!raw) return pipeline[0]?.key || 'todo'
  // Legacy mapping
  const legacyMap = { pending: 'todo', todo: 'todo' }
  const mapped = legacyMap[raw] || raw
  // Check if it exists in current pipeline
  if (pipeline.find(s => s.key === mapped)) return mapped
  // Fall back to first status
  return pipeline[0]?.key || 'todo'
}

// ── Helper: get done statuses from a pipeline ─────────────────
export function getDoneKeys(pipeline) {
  return pipeline.filter(s => s.is_done).map(s => s.key)
}

// ── Helper: is a status key "done" in the given pipeline ──────
export function isStatusDone(key, pipeline) {
  const s = pipeline.find(p => p.key === key)
  return s?.is_done ?? key === 'done'
}
