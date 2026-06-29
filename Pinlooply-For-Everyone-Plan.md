# Pinlooply for Everyone — Product Plan

> **Goal:** Transform Pinlooply from a dev-team tool into a universal workspace platform that any profession can adopt — school teachers, lawyers, designers, sales teams, healthcare workers, freelancers, and more — with full customization so it feels built for them.

---

## Current State

Pinlooply today is a solid project collaboration tool but it speaks "software developer":
- "Test Cases", "Discussions", "Standup" → dev-specific language
- Fixed task types and statuses built for engineering workflows
- AI prompts assume software context
- No way for a teacher or lawyer to rename things to match their world

**The shift:** Make every vocabulary, workflow, and AI feature configurable per workspace so any profession feels at home.

---

## Phase 1 — MVP: Profession Onboarding + Vocabulary (Ship ASAP)

### 1.1 Profession Selection at Onboarding

Add a new step to the existing onboarding flow where users pick their profession/use-case. This pre-loads sensible defaults.

**Professions to support:**

| Profession | Tasks become | Discussions become | Topics become | Projects become |
|---|---|---|---|---|
| Software / Dev | Tasks | Discussions | Topics | Projects |
| Education / Teacher | Assignments | Class Notes | Subjects | Courses |
| Law / Legal | Cases | Briefs | Matters | Clients |
| Marketing / Agency | Campaigns | Briefs | Themes | Accounts |
| Healthcare | Patient Tasks | Clinical Notes | Diagnoses | Patients |
| Freelancer / Creator | Deliverables | Client Notes | Ideas | Projects |
| Sales | Deals | Call Notes | Opportunities | Clients |
| Construction / PM | Tasks | Site Notes | Milestones | Sites |
| HR / Recruiting | Job Actions | Interview Notes | Roles | Teams |
| General / Other | Tasks | Notes | Topics | Projects |

**What gets loaded per profession:**
- Workspace vocabulary (rename nav items + labels throughout the app)
- Starter project template (e.g., "Course: Math 101" for teachers)
- AI prompt context (AI knows you're a teacher, lawyer, etc.)
- Default task statuses (e.g., To Do → In Progress → Done for most; or Open → Under Review → Closed for legal)
- Relevant nav items shown/hidden (e.g., hide Test Cases for non-dev users)

**Implementation:**
- Add `profession` and `vocabulary` (JSON) columns to `users` table
- Add profession step to `Onboarding.jsx` with illustrated cards
- Store vocabulary map: `{ task: "Assignment", discussion: "Note", topic: "Subject", project: "Course", standup: "Daily Check-in" }`
- Create a `useVocabulary()` hook used throughout the app to translate labels
- Server: expose vocabulary in user profile endpoint

---

### 1.2 Workspace Vocabulary — Rename Everything

A settings page where users can rename every core term to match their world.

**Settings → Workspace → Vocabulary:**

```
Tasks        → [___________]   e.g. "Assignments" / "Deals" / "Cases"
Discussions  → [___________]   e.g. "Notes" / "Briefs" / "Logs"
Topics       → [___________]   e.g. "Subjects" / "Themes" / "Matters"
Projects     → [___________]   e.g. "Courses" / "Clients" / "Sites"
Standup      → [___________]   e.g. "Daily Check-in" / "Morning Brief"
Summary      → [___________]   e.g. "Weekly Report" / "Progress Report"
```

Every label in the sidebar, headings, buttons, empty states, and AI responses uses these custom names.

**Implementation:**
- `useVocabulary()` hook reads from user profile / zustand store
- Replace all hardcoded "Task", "Discussion", "Topic" strings with `vocab.task`, `vocab.discussion`, etc.
- AI system prompts include the vocabulary so AI says "Assignment" not "Task" when user is a teacher

---

### 1.3 Navigation Module Toggle

Let users show/hide nav sections they don't need.

**Settings → Workspace → Modules:**

```
☑ Tasks (Assignments)
☑ Projects (Courses)  
☑ Discussions (Notes)
☑ Topics (Subjects)
☑ Timeline
☑ Daily Check-in
☑ Weekly Report
☐ Test Cases        ← hidden by default for non-dev professions
☐ Conflicts         ← hidden by default for non-dev professions
```

**Implementation:**
- Add `enabled_modules` (array) to user profile
- `AppLayout.jsx` filters nav items by `enabled_modules`
- Default set per profession (dev gets all, teacher gets most except Test Cases)

---

### 1.4 Custom Task Statuses

Currently: `pending → in_progress → done → released`

Let each workspace define their own status pipeline.

**Examples by profession:**

| Profession | Status Pipeline |
|---|---|
| General | To Do → In Progress → Done |
| Legal | Open → Under Review → Pending Court → Closed |
| Sales | Lead → Qualified → Proposal → Negotiation → Won / Lost |
| Education | Assigned → Submitted → Graded |
| Healthcare | Scheduled → In Progress → Completed → Followed Up |
| Creative | Concept → Draft → Review → Approved → Published |

**Implementation:**
- Add `custom_statuses` (JSON array) to `users` / `projects` table
- Task create/edit uses workspace statuses instead of hardcoded ones
- Board view columns generated from custom statuses
- AI-generated tasks default to first status in pipeline

---

## Phase 2 — Full Configurability (1–2 Months)

### 2.1 Project Templates Library

Pre-built project templates users can create from, per profession.

**Template Gallery (on "New Project"):**

```
🎓 Education
  ├── Course Semester Plan
  ├── Lesson Planner
  └── Student Assignment Tracker

📈 Business
  ├── Marketing Campaign
  ├── Sales Pipeline
  └── Product Launch

⚖️ Legal
  ├── Case Management
  └── Contract Review

🏗️ Construction
  ├── Site Project Plan
  └── Permit & Compliance Tracker

💻 Software
  ├── Sprint Board
  ├── Bug Tracker
  └── Product Roadmap

🎨 Creative
  ├── Content Calendar
  └── Client Project
```

Each template includes: pre-set task columns (statuses), starter tasks, AI context hint, suggested team roles.

**Implementation:**
- `project_templates` table: `{ id, name, profession, statuses[], starter_tasks[], ai_context }`
- Template gallery modal on "New Project" page
- Templates ship with the app (seeded), admin can add more via Admin Panel

---

### 2.2 Custom Task Fields

Add custom properties to tasks beyond title/description/assignee/due date.

**Examples:**
- Teacher: "Grade", "Student Name", "Subject"
- Sales: "Deal Value", "Company", "Close Probability"
- Legal: "Case Number", "Court Date", "Client Name"
- Healthcare: "Patient ID", "Severity", "Doctor"

**Field types:** Text, Number, Date, Dropdown (custom options), Checkbox, URL

**Implementation:**
- `custom_fields` table: `{ id, workspace_id, field_name, field_type, options[] }`
- `task_custom_values` table: `{ task_id, field_id, value }`
- Settings → Fields page to add/edit/remove fields
- Fields appear in task create/edit drawer
- Fields shown as columns in list view (togglable)
- AI can reference custom fields in summaries

---

### 2.3 AI Persona — Profession-Aware

The AI (standup generator, discussion processor, weekly summary) adapts its language and output format to the user's profession.

**Examples:**

*Teacher's standup:*
> "Yesterday: Completed grading 24 Math assignments. Today: Reviewing Chapter 5 lesson plan, running Science quiz. Blocker: Need projector room booking confirmed."

*Sales team standup:*
> "Yesterday: 3 discovery calls with Acme, TechCorp, BrightStar. Today: Sending proposals to Acme and TechCorp. Blocker: Waiting on legal approval for BrightStar contract."

*Lawyer's discussion summary:*
> "Client Meeting — Case #2041: Discussion covered settlement options. Key decision: Counter-offer of $85k approved. Action items: Draft counter-offer letter, schedule mediation."

**Implementation:**
- AI system prompt includes: `You are assisting a [profession] using a workspace called [workspace_name]. Use their vocabulary: tasks are called [vocab.task], etc.`
- Standup, summary, and discussion AI services receive `userContext: { profession, vocabulary, ai_context }` and inject it into prompts

---

### 2.4 Workspace Branding

Let teams personalize their workspace.

- **Workspace name** (shown in sidebar header instead of "Pinlooply")
- **Workspace logo** (upload small icon, shown in sidebar)
- **Accent color** (primary color used throughout the app)
- **Welcome message** on dashboard

**Implementation:**
- Add `workspace_name`, `workspace_logo_url`, `accent_color` to user profile
- CSS variables for accent color, updated via JS on login
- Dashboard greeting uses workspace name

---

## Phase 3 — Power Users & Teams (3–6 Months)

### 3.1 Role-Based Views

Different team members see different views based on their role.

- **Manager view:** Overview of all team members' work, blockers, completion rate
- **Individual view:** Only my tasks and assignments
- **Client view:** Read-only view of project progress (public link)

---

### 3.2 Automations / Rules

No-code automation rules:

```
WHEN  task status changes to "Submitted"
THEN  notify [teacher/manager]

WHEN  task due date passes and status is not "Done"
THEN  mark as Overdue + notify assignee

WHEN  new discussion logged
THEN  auto-generate summary and create tasks
```

---

### 3.3 Marketplace of Add-ons

Optional modules users can enable:

| Module | Who it's for |
|---|---|
| Grade Book | Teachers |
| CRM (Client Cards) | Sales, agencies, freelancers |
| Time Tracker | Freelancers, consultants |
| Invoice Generator | Freelancers |
| Lesson Planner | Teachers |
| Case Files | Legal |
| Shift Planner | Healthcare, retail |

Each add-on adds new nav items, data tables, and AI features specific to that profession.

---

### 3.4 Mobile App (PWA → Native)

Many professions (teachers, field workers, sales reps) are mobile-first.

- Progressive Web App (PWA) — add to home screen, offline support
- Push notifications for task assignments, overdue items, standup reminders
- Quick capture: "Log a note" from anywhere in 2 taps

---

## Implementation Priority (ASAP Order)

| # | Feature | Effort | Impact | Do First? |
|---|---|---|---|---|
| 1 | Profession selection at onboarding | Small | High | ✅ YES |
| 2 | `useVocabulary()` hook + vocabulary settings | Medium | High | ✅ YES |
| 3 | Navigation module toggle | Small | High | ✅ YES |
| 4 | Custom task statuses per workspace | Medium | High | ✅ YES |
| 5 | AI profession-aware prompts | Small | High | ✅ YES |
| 6 | Project templates library | Medium | Medium | Phase 2 |
| 7 | Custom task fields | Large | High | Phase 2 |
| 8 | Workspace branding | Small | Medium | Phase 2 |
| 9 | Role-based views | Large | High | Phase 3 |
| 10 | Automations | Very Large | High | Phase 3 |
| 11 | Add-on marketplace | Very Large | Very High | Phase 3 |
| 12 | Mobile PWA | Large | Very High | Phase 3 |

---

## Database Changes Required

```sql
-- Extend users table
ALTER TABLE users ADD COLUMN profession TEXT DEFAULT 'general';
ALTER TABLE users ADD COLUMN vocabulary JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN enabled_modules TEXT[] DEFAULT ARRAY['tasks','projects','discussions','topics','timeline','standup','summary'];
ALTER TABLE users ADD COLUMN custom_statuses JSONB DEFAULT NULL;
ALTER TABLE users ADD COLUMN workspace_name TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN workspace_logo_url TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN accent_color TEXT DEFAULT NULL;

-- Project templates
CREATE TABLE project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  profession TEXT NOT NULL,
  description TEXT,
  statuses JSONB NOT NULL,
  starter_tasks JSONB DEFAULT '[]',
  ai_context TEXT DEFAULT '',
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom fields
CREATE TABLE workspace_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','number','date','dropdown','checkbox','url')),
  field_options JSONB DEFAULT '[]',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_custom_values (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  field_id UUID REFERENCES workspace_custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  PRIMARY KEY (task_id, field_id)
);
```

---

## Key Design Principle

> **The app should feel like it was built for you, not adapted for you.**

A school teacher opening Pinlooply should see "Assignments", "Class Notes", "Courses" — not "Tasks", "Discussions", "Projects". The AI should talk like a teaching assistant, not a scrum master. The standup should say "Yesterday's lessons" not "Yesterday's commits".

This is achieved through vocabulary customization + AI context — **not** by building separate apps per profession. One codebase, infinite adaptations.

---

*Last updated: June 2026 | Pinlooply Product Roadmap*
