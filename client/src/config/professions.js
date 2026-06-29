// ── Profession definitions ────────────────────────────────────
// Each profession defines: vocabulary (label overrides), default enabled modules,
// and a default status pipeline.

import { DEFAULT_STATUS_PIPELINES } from './statuses'

export const DEFAULT_VOCABULARY = {
  task:        'Task',
  tasks:       'Tasks',
  discussion:  'Discussion',
  discussions: 'Discussions',
  topic:       'Topic',
  topics:      'Topics',
  project:     'Project',
  projects:    'Projects',
  standup:     'Standup',
  summary:     'Summary',
  testcases:   'Test Cases',
  timeline:    'Timeline',
  logAction:   'Log Discussion',    // CTA button label
  aiContext:   'a professional',    // used in AI system prompt
}

export const DEFAULT_MODULES = ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary']

export const PROFESSIONS = [
  {
    value:   'software',
    emoji:   '💻',
    label:   'Software / Dev',
    desc:    'Engineers, product teams, startups',
    vocabulary: {
      task: 'Task', tasks: 'Tasks',
      discussion: 'Discussion', discussions: 'Discussions',
      topic: 'Topic', topics: 'Topics',
      project: 'Project', projects: 'Projects',
      standup: 'Standup', summary: 'Weekly Summary',
      testcases: 'Test Cases', timeline: 'Timeline',
      logAction: 'Log Discussion',
      aiContext: 'a software development team',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary', 'testcases'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.software,
  },
  {
    value:   'education',
    emoji:   '🎓',
    label:   'Education',
    desc:    'Teachers, lecturers, tutors, students',
    vocabulary: {
      task: 'Assignment', tasks: 'Assignments',
      discussion: 'Class Note', discussions: 'Class Notes',
      topic: 'Subject', topics: 'Subjects',
      project: 'Course', projects: 'Courses',
      standup: 'Daily Check-in', summary: 'Progress Report',
      testcases: 'Quizzes', timeline: 'Schedule',
      logAction: 'Log Class Notes',
      aiContext: 'an educational institution — teacher or lecturer',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.education,
  },
  {
    value:   'legal',
    emoji:   '⚖️',
    label:   'Legal',
    desc:    'Lawyers, paralegals, legal teams',
    vocabulary: {
      task: 'Action Item', tasks: 'Action Items',
      discussion: 'Case Note', discussions: 'Case Notes',
      topic: 'Matter', topics: 'Matters',
      project: 'Client', projects: 'Clients',
      standup: 'Daily Brief', summary: 'Weekly Report',
      testcases: 'Filings', timeline: 'Case Timeline',
      logAction: 'Log Case Notes',
      aiContext: 'a legal firm — lawyers and paralegals',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.legal,
  },
  {
    value:   'marketing',
    emoji:   '📈',
    label:   'Marketing',
    desc:    'Marketing teams, agencies, brand managers',
    vocabulary: {
      task: 'Task', tasks: 'Tasks',
      discussion: 'Brief', discussions: 'Briefs',
      topic: 'Theme', topics: 'Themes',
      project: 'Campaign', projects: 'Campaigns',
      standup: 'Daily Sync', summary: 'Campaign Report',
      testcases: 'Content Tests', timeline: 'Campaign Timeline',
      logAction: 'Log Brief',
      aiContext: 'a marketing team or creative agency',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.marketing,
  },
  {
    value:   'healthcare',
    emoji:   '🏥',
    label:   'Healthcare',
    desc:    'Clinics, healthcare workers, care teams',
    vocabulary: {
      task: 'Task', tasks: 'Tasks',
      discussion: 'Clinical Note', discussions: 'Clinical Notes',
      topic: 'Care Area', topics: 'Care Areas',
      project: 'Patient', projects: 'Patients',
      standup: 'Shift Handover', summary: 'Weekly Review',
      testcases: 'Protocols', timeline: 'Care Timeline',
      logAction: 'Log Clinical Notes',
      aiContext: 'a healthcare team — doctors, nurses, and care coordinators',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.healthcare,
  },
  {
    value:   'freelancer',
    emoji:   '🎨',
    label:   'Freelancer / Creator',
    desc:    'Designers, writers, consultants, solopreneurs',
    vocabulary: {
      task: 'Deliverable', tasks: 'Deliverables',
      discussion: 'Client Note', discussions: 'Client Notes',
      topic: 'Idea', topics: 'Ideas',
      project: 'Project', projects: 'Projects',
      standup: 'Daily Log', summary: 'Weekly Wrap-up',
      testcases: 'Reviews', timeline: 'Project Timeline',
      logAction: 'Log Client Notes',
      aiContext: 'a freelancer or independent creator',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'summary'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.freelancer,
  },
  {
    value:   'sales',
    emoji:   '💼',
    label:   'Sales',
    desc:    'Sales reps, account managers, BDRs',
    vocabulary: {
      task: 'Action', tasks: 'Actions',
      discussion: 'Call Note', discussions: 'Call Notes',
      topic: 'Opportunity', topics: 'Opportunities',
      project: 'Client', projects: 'Clients',
      standup: 'Daily Huddle', summary: 'Pipeline Report',
      testcases: 'Scripts', timeline: 'Deal Timeline',
      logAction: 'Log Call Notes',
      aiContext: 'a sales team — account executives and business development reps',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.sales,
  },
  {
    value:   'hr',
    emoji:   '👔',
    label:   'HR / Recruiting',
    desc:    'HR teams, recruiters, people managers',
    vocabulary: {
      task: 'Action', tasks: 'Actions',
      discussion: 'Interview Note', discussions: 'Interview Notes',
      topic: 'Role', topics: 'Roles',
      project: 'Hiring Round', projects: 'Hiring Rounds',
      standup: 'Daily Check-in', summary: 'Hiring Report',
      testcases: 'Assessments', timeline: 'Hiring Timeline',
      logAction: 'Log Interview Notes',
      aiContext: 'an HR or recruiting team',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.hr,
  },
  {
    value:   'construction',
    emoji:   '🏗️',
    label:   'Construction / PM',
    desc:    'Project managers, site managers, contractors',
    vocabulary: {
      task: 'Task', tasks: 'Tasks',
      discussion: 'Site Note', discussions: 'Site Notes',
      topic: 'Milestone', topics: 'Milestones',
      project: 'Site', projects: 'Sites',
      standup: 'Site Brief', summary: 'Site Report',
      testcases: 'Inspections', timeline: 'Project Timeline',
      logAction: 'Log Site Notes',
      aiContext: 'a construction or project management team',
    },
    modules: ['tasks', 'projects', 'discussions', 'topics', 'timeline', 'standup', 'summary'],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.construction,
  },
  {
    value:   'general',
    emoji:   '🌐',
    label:   'Other / General',
    desc:    'Any team or personal use',
    vocabulary: { ...DEFAULT_VOCABULARY },
    modules: [...DEFAULT_MODULES],
    defaultStatuses: DEFAULT_STATUS_PIPELINES.general,
  },
]

// ── Helper: get profession by value ──────────────────────────
export function getProfession(value) {
  return PROFESSIONS.find(p => p.value === value) || PROFESSIONS.find(p => p.value === 'general')
}

// ── Merge saved vocabulary overrides on top of profession defaults
export function resolveVocabulary(profession, savedVocabulary = {}) {
  const base = getProfession(profession)?.vocabulary || DEFAULT_VOCABULARY
  return { ...base, ...savedVocabulary }
}
