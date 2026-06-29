// ── Project Templates ─────────────────────────────────────────
// Pre-built templates grouped by profession.
// Each template pre-loads: custom_statuses + starter task titles.

import { DEFAULT_STATUS_PIPELINES } from './statuses'

export const PROJECT_TEMPLATES = [
  // ── Software / Dev ──────────────────────────────────────────
  {
    id: 'sprint_board',
    profession: 'software',
    emoji: '🏃',
    name: 'Sprint Board',
    desc: 'Agile sprint with dev workflow',
    statuses: DEFAULT_STATUS_PIPELINES.software,
    starter_tasks: ['Define sprint goals', 'Review backlog', 'Setup CI/CD', 'Write unit tests'],
  },
  {
    id: 'bug_tracker',
    profession: 'software',
    emoji: '🐛',
    name: 'Bug Tracker',
    desc: 'Track and resolve issues',
    statuses: [
      { key: 'reported',    label: 'Reported',     color: 'warm',   is_done: false },
      { key: 'triaged',     label: 'Triaged',      color: 'blue',   is_done: false },
      { key: 'in_progress', label: 'In Progress',  color: 'violet', is_done: false },
      { key: 'resolved',    label: 'Resolved',     color: 'green',  is_done: true  },
    ],
    starter_tasks: ['Reproduce the issue', 'Identify root cause', 'Write fix', 'Add regression test'],
  },

  // ── Education ────────────────────────────────────────────────
  {
    id: 'course_planner',
    profession: 'education',
    emoji: '📚',
    name: 'Course Planner',
    desc: 'Plan a semester course',
    statuses: DEFAULT_STATUS_PIPELINES.education,
    starter_tasks: ['Design syllabus', 'Prepare Week 1 lesson', 'Create grading rubric', 'Schedule office hours'],
  },
  {
    id: 'assignment_tracker',
    profession: 'education',
    emoji: '✏️',
    name: 'Assignment Tracker',
    desc: 'Track class assignments',
    statuses: DEFAULT_STATUS_PIPELINES.education,
    starter_tasks: ['Post assignment instructions', 'Set submission deadline', 'Grade submissions', 'Return feedback'],
  },

  // ── Legal ────────────────────────────────────────────────────
  {
    id: 'case_management',
    profession: 'legal',
    emoji: '⚖️',
    name: 'Case Management',
    desc: 'Manage a legal case end-to-end',
    statuses: DEFAULT_STATUS_PIPELINES.legal,
    starter_tasks: ['Client intake', 'Review documents', 'Draft brief', 'Schedule hearing'],
  },

  // ── Marketing ────────────────────────────────────────────────
  {
    id: 'campaign_launch',
    profession: 'marketing',
    emoji: '🚀',
    name: 'Campaign Launch',
    desc: 'Plan and execute a marketing campaign',
    statuses: DEFAULT_STATUS_PIPELINES.marketing,
    starter_tasks: ['Define target audience', 'Create campaign brief', 'Design assets', 'Schedule posts', 'Review analytics'],
  },

  // ── Sales ────────────────────────────────────────────────────
  {
    id: 'sales_pipeline',
    profession: 'sales',
    emoji: '💰',
    name: 'Sales Pipeline',
    desc: 'Track deals from lead to close',
    statuses: DEFAULT_STATUS_PIPELINES.sales,
    starter_tasks: ['Identify prospect', 'Initial outreach', 'Discovery call', 'Send proposal', 'Follow up'],
  },

  // ── Healthcare ───────────────────────────────────────────────
  {
    id: 'care_plan',
    profession: 'healthcare',
    emoji: '🏥',
    name: 'Care Plan',
    desc: 'Patient care coordination',
    statuses: DEFAULT_STATUS_PIPELINES.healthcare,
    starter_tasks: ['Initial assessment', 'Create care plan', 'Schedule follow-up', 'Document notes'],
  },

  // ── Freelancer ───────────────────────────────────────────────
  {
    id: 'client_project',
    profession: 'freelancer',
    emoji: '🎨',
    name: 'Client Project',
    desc: 'Manage a client deliverable',
    statuses: DEFAULT_STATUS_PIPELINES.freelancer,
    starter_tasks: ['Kickoff meeting', 'Define scope', 'First draft', 'Client review', 'Final delivery'],
  },

  // ── Construction ─────────────────────────────────────────────
  {
    id: 'site_project',
    profession: 'construction',
    emoji: '🏗️',
    name: 'Site Project',
    desc: 'Construction site planning',
    statuses: DEFAULT_STATUS_PIPELINES.construction,
    starter_tasks: ['Site survey', 'Permits application', 'Foundation work', 'Frame inspection', 'Final walkthrough'],
  },

  // ── HR ───────────────────────────────────────────────────────
  {
    id: 'hiring_round',
    profession: 'hr',
    emoji: '👥',
    name: 'Hiring Round',
    desc: 'End-to-end recruitment process',
    statuses: DEFAULT_STATUS_PIPELINES.hr,
    starter_tasks: ['Post job description', 'Screen applications', 'Phone screens', 'Technical interviews', 'Offer letter'],
  },

  // ── General ──────────────────────────────────────────────────
  {
    id: 'blank',
    profession: 'general',
    emoji: '📋',
    name: 'Blank Project',
    desc: 'Start from scratch',
    statuses: DEFAULT_STATUS_PIPELINES.general,
    starter_tasks: [],
  },
]

// ── Helper: get templates for a profession ────────────────────
export function getTemplatesForProfession(profession) {
  const profTemplates = PROJECT_TEMPLATES.filter(t => t.profession === profession)
  const generalTemplates = PROJECT_TEMPLATES.filter(t => t.profession === 'general')
  // Always include general + profession-specific
  return [...profTemplates, ...generalTemplates.filter(t => !profTemplates.find(p => p.id === t.id))]
}

// ── Helper: get all unique professions that have templates ────
export function getTemplateProfessions() {
  const seen = new Set()
  const professions = []
  for (const t of PROJECT_TEMPLATES) {
    if (!seen.has(t.profession)) {
      seen.add(t.profession)
      professions.push(t.profession)
    }
  }
  return professions
}
