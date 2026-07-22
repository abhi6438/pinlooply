// ── Server-side profession defaults ───────────────────────────
// Mirrors client/src/config/professions.js — keep in sync.
// Used by the AI service to build profession-aware prompts.

export const DEFAULT_VOCABULARY = {
  task:        'Task',
  tasks:       'Tasks',
  discussion:  'Discussion',
  discussions: 'Discussions',
  topic:       'Topic',
  topics:      'Topics',
  project:     'Project',
  projects:    'Projects',
  logAction:   'Log Discussion',
  aiContext:   'a professional team',
}

export const PROFESSION_DEFAULTS = {
  software: {
    task: 'Task', tasks: 'Tasks',
    discussion: 'Discussion', discussions: 'Discussions',
    topic: 'Topic', topics: 'Topics',
    project: 'Project', projects: 'Projects',
    aiContext: 'a software development team',
  },
  education: {
    task: 'Assignment', tasks: 'Assignments',
    discussion: 'Class Note', discussions: 'Class Notes',
    topic: 'Subject', topics: 'Subjects',
    project: 'Course', projects: 'Courses',
    aiContext: 'an educational institution — teacher or lecturer',
  },
  legal: {
    task: 'Action Item', tasks: 'Action Items',
    discussion: 'Case Note', discussions: 'Case Notes',
    topic: 'Matter', topics: 'Matters',
    project: 'Client', projects: 'Clients',
    aiContext: 'a legal firm — lawyers and paralegals',
  },
  marketing: {
    task: 'Task', tasks: 'Tasks',
    discussion: 'Brief', discussions: 'Briefs',
    topic: 'Theme', topics: 'Themes',
    project: 'Campaign', projects: 'Campaigns',
    aiContext: 'a marketing team or creative agency',
  },
  healthcare: {
    task: 'Task', tasks: 'Tasks',
    discussion: 'Clinical Note', discussions: 'Clinical Notes',
    topic: 'Care Area', topics: 'Care Areas',
    project: 'Patient', projects: 'Patients',
    aiContext: 'a healthcare team — doctors, nurses, and care coordinators',
  },
  freelancer: {
    task: 'Deliverable', tasks: 'Deliverables',
    discussion: 'Client Note', discussions: 'Client Notes',
    topic: 'Idea', topics: 'Ideas',
    project: 'Project', projects: 'Projects',
    aiContext: 'a freelancer or independent creator',
  },
  sales: {
    task: 'Action', tasks: 'Actions',
    discussion: 'Call Note', discussions: 'Call Notes',
    topic: 'Opportunity', topics: 'Opportunities',
    project: 'Client', projects: 'Clients',
    aiContext: 'a sales team — account executives and business development reps',
  },
  hr: {
    task: 'Action', tasks: 'Actions',
    discussion: 'Interview Note', discussions: 'Interview Notes',
    topic: 'Role', topics: 'Roles',
    project: 'Hiring Round', projects: 'Hiring Rounds',
    aiContext: 'an HR or recruiting team',
  },
  construction: {
    task: 'Task', tasks: 'Tasks',
    discussion: 'Site Note', discussions: 'Site Notes',
    topic: 'Milestone', topics: 'Milestones',
    project: 'Site', projects: 'Sites',
    aiContext: 'a construction or project management team',
  },
  general: { ...DEFAULT_VOCABULARY },
}

/**
 * Resolve final vocabulary: profession defaults merged with any saved custom overrides.
 * @param {string} profession
 * @param {object} savedOverrides  — from users.vocabulary in DB (may be null / {})
 */
export function resolveVocabulary(profession, savedOverrides = {}) {
  const base = PROFESSION_DEFAULTS[profession] || DEFAULT_VOCABULARY
  return { ...DEFAULT_VOCABULARY, ...base, ...(savedOverrides || {}) }
}
