import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, Search, ChevronDown, ChevronUp, ChevronRight,
  LayoutDashboard, FolderOpen, ListChecks, MessageSquare,
  Timer, Zap, Users, Settings, Sparkles, Tag, CalendarDays,
  ClipboardList, BarChart3, Bell, Globe, RefreshCw, UserCheck,
  BarChart2, FlaskConical, Play, Square, Pencil, Plus,
} from 'lucide-react'

// ── Guide content ─────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'getting-started',
    icon: BookOpen,
    color: 'bg-primary-50 text-primary-600',
    title: 'Getting Started',
    summary: 'Set up your workspace in 3 steps',
    steps: [
      {
        title: '1. Pick your profession',
        body: `When you first sign up, Pinlooply asks what you do — software developer, teacher, lawyer, sales rep, and more. This pre-loads vocabulary and templates tailored to your work. A teacher sees "Assignments" and "Courses" instead of "Tasks" and "Projects".`,
      },
      {
        title: '2. Create your first project',
        body: `Go to Projects → click "New Project". You can start from a blank slate or pick a template from the gallery (sprint board, course plan, case management, campaign launch, etc.). Each template comes with pre-set task statuses and starter tasks.`,
      },
      {
        title: '3. Log your first discussion',
        body: `Click "Log" in the sidebar or use the text box on the Dashboard. Paste in meeting notes, emails, a conversation — anything. The AI will read it and extract tasks, decisions, topics, and action items. Review them on the confirmation screen and save.`,
      },
    ],
  },
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    color: 'bg-blue-50 text-blue-600',
    title: 'Dashboard',
    summary: 'Your daily command center',
    steps: [
      {
        title: 'Quick Log box',
        body: `The text area at the top of the Dashboard is a fast way to log a discussion without navigating to the Log page. Select a project, paste or type your notes, and hit Send. The AI processes it instantly.`,
      },
      {
        title: "Today's Priorities",
        body: `Shows your highest-priority open tasks sorted by urgency. Click the circle icon on any task to mark it done — it stays visible briefly (crossed out) so you see your progress, then disappears.`,
      },
      {
        title: '"What to work on next" (AI Suggestions)',
        body: `The AI looks at all your open tasks and ranks the top 5 by urgency — overdue first, then due soon, then by priority. Each suggestion includes a one-sentence reason. Hit the refresh icon to get a fresh ranking.`,
      },
      {
        title: 'Stats panel',
        body: `Shows total open tasks, tasks you completed today, overdue items, and your active projects. Use the filter tabs (Work / Test / All) to switch the count between different task types.`,
      },
      {
        title: 'Project Health',
        body: `Cards for each of your active projects showing open task counts. Click a project card to go straight to its task board.`,
      },
    ],
  },
  {
    id: 'projects',
    icon: FolderOpen,
    color: 'bg-violet-50 text-violet-600',
    title: 'Projects',
    summary: 'Organise work into focused workspaces',
    steps: [
      {
        title: 'Creating a project',
        body: `Go to Projects → New Project. The template gallery shows profession-matched templates first. Pick one or choose "Blank". Give it a name and color. The template's statuses and starter tasks are created automatically.`,
      },
      {
        title: 'Project detail & tabs',
        body: `Click any project card to open it. The Overview tab shows task progress. The Tasks tab is a board view. The Settings tab lets you override the status pipeline for that specific project (independent of your workspace defaults).`,
      },
      {
        title: 'Publishing a project (Client View)',
        body: `In Project Settings, toggle "Publish project". This generates a public URL (no login needed) you can share with clients or stakeholders. They see task progress, health, and open/done counts — but cannot edit anything.`,
      },
      {
        title: 'Status pipelines',
        body: `Each project can have its own status pipeline. Go to Project → Settings → Status Pipeline and drag statuses into the order you want. Or leave it blank to inherit your workspace-level pipeline.`,
      },
    ],
  },
  {
    id: 'tasks',
    icon: ListChecks,
    color: 'bg-green-50 text-green-600',
    title: 'Tasks (Lists view)',
    summary: 'Create, manage, and track your work',
    steps: [
      {
        title: 'Board vs List view',
        body: `Click the grid icon for Board (Kanban columns by status) or the list icon for a flat list. Both views show the same tasks — choose what works for you.`,
      },
      {
        title: 'Adding tasks',
        body: `Click "+ Add task" at the bottom of any board column, or the blue button in list view. Give it a title, priority, due date, and optionally assign it to a team member.`,
      },
      {
        title: 'Task detail panel',
        body: `Click any task to open the side panel. Here you can edit the title, description, priority, due date, assignee — and also log time, set recurrence, and fill custom fields.`,
      },
      {
        title: 'Recurrence',
        body: `In the task detail panel, scroll to "Recurrence". Set Repeat to Daily, Weekly, or Monthly. When you mark a recurring task done, a new copy is automatically created with the next due date. Set an End Date to stop the cycle.`,
      },
      {
        title: 'Custom fields',
        body: `Your workspace admin can add custom fields (text, number, date, dropdown, checkbox) via Settings → Workspace → Custom Task Fields. They appear in the task detail panel for every task.`,
      },
      {
        title: 'Bulk actions',
        body: `Check the boxes on multiple tasks in list view to bulk-update status, priority, or assignee all at once.`,
      },
    ],
  },
  {
    id: 'time-tracking',
    icon: Timer,
    color: 'bg-amber-50 text-amber-600',
    title: 'Time Tracking',
    summary: 'Log time on tasks, view reports, export CSV',
    steps: [
      {
        title: 'Starting the timer',
        body: `Open any task's detail panel and scroll to "Time Logged". Click the green Play button to start a live timer. The button shows your elapsed time. Click Stop when done — it logs the minutes automatically.`,
      },
      {
        title: 'Logging time manually',
        body: `Click the pencil "Log" button next to the timer. Enter the number of minutes and an optional note (e.g. "Drafted proposal"), then click Save.`,
      },
      {
        title: 'Time Reports page',
        body: `Go to Time Reports in the sidebar. Filter by date range and project. View time broken down by project (with progress bars) or by individual task. Switch to "Entry log" for a full chronological history.`,
      },
      {
        title: 'Exporting to CSV',
        body: `On the Time Reports page, click "Export CSV" to download a spreadsheet with all entries — date, task, project, minutes, hours, and notes. Great for invoicing clients.`,
      },
    ],
  },
  {
    id: 'log-discussion',
    icon: MessageSquare,
    color: 'bg-teal-50 text-teal-600',
    title: 'Log Discussion (AI Notes)',
    summary: 'Turn meeting notes into tasks automatically',
    steps: [
      {
        title: 'What to log',
        body: `Log any text that contains action items — meeting notes, email threads, voice transcripts, a quick brain-dump. The AI works best with 3–20 sentences that mention things like "we need to", "action: ", "by Friday", or person names.`,
      },
      {
        title: 'The AI confirmation screen',
        body: `After logging, you see a preview of what the AI extracted: tasks, topics, decisions, and people mentioned. Review each item. You can edit task titles, change priorities, assign tasks to team members, and remove anything incorrect.`,
      },
      {
        title: 'Saving',
        body: `Click "Save Discussion" to store everything. Tasks are created in the selected project. Topics and decisions are saved as a searchable knowledge base entry. The raw text is also saved so you can refer back to it.`,
      },
      {
        title: 'Auto-create tasks (Automation)',
        body: `If you enable the "Auto-create tasks from discussion" automation rule, tasks from discussions are created without the confirmation step — they appear directly in your project. See Automations for setup.`,
      },
    ],
  },
  {
    id: 'search',
    icon: Search,
    color: 'bg-indigo-50 text-indigo-600',
    title: 'Global Search',
    summary: 'Find anything across your whole workspace',
    steps: [
      {
        title: 'Opening search',
        body: `Press ⌘K (Mac) or Ctrl+K (Windows/Linux) anywhere in the app. Or click the Search button at the top of the sidebar.`,
      },
      {
        title: 'What gets searched',
        body: `Search finds tasks (by title and description), projects (by name), topics (by title and content), and discussions (by the raw text you logged). Results are grouped by type and matching words are highlighted.`,
      },
      {
        title: 'Navigating results',
        body: `Click any result to jump directly to it. Press Esc or click outside the modal to close. The search is instant — results appear as you type (after 2 characters).`,
      },
    ],
  },
  {
    id: 'automations',
    icon: Zap,
    color: 'bg-yellow-50 text-yellow-600',
    title: 'Automations',
    summary: 'Set up rules that run automatically',
    steps: [
      {
        title: 'What automations do',
        body: `Automations are "if this, then that" rules. Examples: when a task status changes to "Blocked", send you a notification. When a discussion is saved, auto-create tasks from it. When a task goes overdue, flag it and notify the assignee.`,
      },
      {
        title: 'Creating a rule',
        body: `Go to Settings → Automations → New Rule. Choose a trigger (status change, discussion saved, task overdue), configure the condition (e.g. "to status: blocked"), then choose an action (notify, auto-create tasks, mark overdue).`,
      },
      {
        title: 'Starter templates',
        body: `The Automations page has 4 one-click templates at the bottom: "Notify when task marked done", "Notify when task blocked", "Auto-create tasks from discussion", and "Flag overdue tasks". Click any template to create it instantly.`,
      },
      {
        title: 'Toggling rules on/off',
        body: `Each rule card has a toggle switch. Disable a rule temporarily without deleting it — useful for testing or seasonal workflows.`,
      },
      {
        title: 'Run overdue check manually',
        body: `The "Run overdue check" button on the Automations page triggers the overdue scan right now instead of waiting for the automated schedule. Useful after a weekend when tasks pile up.`,
      },
    ],
  },
  {
    id: 'team',
    icon: Users,
    color: 'bg-pink-50 text-pink-600',
    title: 'Team & Groups',
    summary: 'Collaborate with your team',
    steps: [
      {
        title: 'Creating a group',
        body: `Go to Team in the sidebar → Create Group. Give it a name and an optional invite code. Share the invite link with teammates — they join at /invite/[your-code].`,
      },
      {
        title: 'Assigning tasks to team members',
        body: `When creating or editing a task, use the "Assign to" dropdown to pick any group member. They get a notification instantly. The task appears in their My Tasks view.`,
      },
      {
        title: 'My Tasks (Individual view)',
        body: `Go to My Tasks in the sidebar. This shows only tasks assigned to you — nothing else. Filter by Active / Overdue / All, sort by due date, priority, or project. Click the circle to complete a task inline.`,
      },
      {
        title: 'Manager view',
        body: `Available to workspace owners and admins. Go to Manager in the sidebar to see a per-member breakdown: completion rate, total tasks, overdue count, and a list of their active tasks. Great for team standups and 1:1s.`,
      },
      {
        title: 'Notifications',
        body: `The bell icon in the sidebar shows unread notifications. You get notified when: a task is assigned to you, a task you assigned is completed, an automation rule fires, or a task goes overdue.`,
      },
    ],
  },
  {
    id: 'timeline',
    icon: CalendarDays,
    color: 'bg-cyan-50 text-cyan-600',
    title: 'Timeline',
    summary: 'See everything that happened over time',
    steps: [
      {
        title: 'What the Timeline shows',
        body: `The Timeline is an activity feed for your workspace. It shows: tasks created and completed, projects created, discussions logged, team members joining groups, and weekly summaries generated. Everything in chronological order.`,
      },
      {
        title: 'Filtering',
        body: `Use the date range pickers to narrow the timeline to a specific period. Useful for reviewing what happened last week, or preparing a status report.`,
      },
    ],
  },
  {
    id: 'topics',
    icon: Tag,
    color: 'bg-orange-50 text-orange-600',
    title: 'Topics (Knowledge Base)',
    summary: 'Decisions and recurring themes from your discussions',
    steps: [
      {
        title: 'What topics are',
        body: `When the AI processes a discussion, it extracts recurring themes or key decisions as Topics. A topic is a persistent record — like "API versioning strategy" or "Q3 budget decision". They build up into a searchable knowledge base over time.`,
      },
      {
        title: 'Topic detail',
        body: `Click a topic to see all the discussion entries where it appeared, the AI-generated summary, and the version history (how the topic evolved over time). You can change a topic's status (open, resolved, archived).`,
      },
    ],
  },
  {
    id: 'standup',
    icon: ClipboardList,
    color: 'bg-purple-50 text-purple-600',
    title: 'Standup & Summary',
    summary: 'Auto-generated status reports',
    steps: [
      {
        title: 'Daily Standup',
        body: `Go to Standup in the sidebar and click "Generate". The AI reads your recent task activity and writes a standup update: what you completed yesterday, what's planned today, and any blockers. Copy it to Slack, email, or a meeting.`,
      },
      {
        title: 'Weekly / Monthly Summary',
        body: `Go to Summary. Click "Generate Weekly Summary" to get a narrative of the week's progress — tasks done, discussions logged, topics resolved, team activity. A monthly summary is also available.`,
      },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    color: 'bg-warm-100 text-warm-600',
    title: 'Settings & Workspace',
    summary: 'Customise everything to match your workflow',
    steps: [
      {
        title: 'Workspace name & branding',
        body: `Go to Settings → Workspace → Branding. Set your workspace name (shown in the sidebar header instead of "Pinlooply") and pick an accent color. The color updates throughout the app — buttons, highlights, badges.`,
      },
      {
        title: 'Vocabulary (rename everything)',
        body: `In Settings → Workspace → Vocabulary, rename core terms to match your profession. Change "Tasks" to "Assignments", "Projects" to "Courses", "Discussions" to "Class Notes". These labels update everywhere in the app and in AI-generated text.`,
      },
      {
        title: 'Status pipeline',
        body: `In Settings → Workspace, define your default task status pipeline. Drag statuses to reorder, add new ones (with a color), mark one as the "done" status. Projects can override this with their own pipeline.`,
      },
      {
        title: 'Custom task fields',
        body: `In Settings → Workspace → Custom Task Fields, add fields that appear on every task: text, number, date, dropdown (with options), or checkbox. Examples: "Client Name", "Deal Value", "Grade", "Patient ID".`,
      },
      {
        title: 'Module visibility',
        body: `In Settings → Workspace → Modules, hide nav items you don't use. Disable "Test Cases" if you're not a developer. Disable "Standup" if you prefer async updates. Fewer nav items = less clutter.`,
      },
      {
        title: 'Plan & Billing',
        body: `Go to Settings → Plan to see your current plan (Free, Pro, or Team) and what features it includes. Upgrade to unlock higher AI usage limits, more team members, and advanced features.`,
      },
    ],
  },
  {
    id: 'ai-suggestions',
    icon: Sparkles,
    color: 'bg-rose-50 text-rose-600',
    title: 'AI Features',
    summary: 'How the AI helps you throughout the app',
    steps: [
      {
        title: 'Discussion processing',
        body: `The AI reads your raw text and extracts: action items (tasks), decisions made, topics/themes, and names of people who should own tasks. It understands context — "we need to" becomes a task, "we decided" becomes a decision.`,
      },
      {
        title: 'Task suggestions',
        body: `The "What to work on next" widget on the Dashboard scores your open tasks by urgency (overdue, due soon, priority, in-progress) and asks the AI to write a short reason for each. Hit refresh for a new ranking.`,
      },
      {
        title: 'Profession-aware AI',
        body: `All AI outputs (standup, summary, discussions) are aware of your profession and vocabulary. A teacher's standup mentions "lessons" and "grades". A lawyer's summary uses "briefs" and "case numbers". Set your profession in Settings → Workspace.`,
      },
      {
        title: 'Test case generator',
        body: `In the Test Cases section (software/dev workspaces), paste any feature description or requirement and the AI generates a full set of test cases: happy path, edge cases, failure scenarios. Save them directly to your project.`,
      },
    ],
  },
]

// ── Section card ──────────────────────────────────────────────
function SectionCard({ section, isOpen, onToggle, query }) {
  const SIcon = section.icon
  const matchesQuery = !query ||
    section.title.toLowerCase().includes(query.toLowerCase()) ||
    section.summary.toLowerCase().includes(query.toLowerCase()) ||
    section.steps.some(s =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.body.toLowerCase().includes(query.toLowerCase())
    )

  if (!matchesQuery) return null

  return (
    <div className="bg-white rounded-2xl border border-warm-200 overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-warm-50 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${section.color}`}>
          <SIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-warm-900">{section.title}</h2>
          <p className="text-sm text-warm-500">{section.summary}</p>
        </div>
        <div className="text-warm-400 shrink-0">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-warm-100 px-6 py-5 space-y-5">
          {section.steps.map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-warm-100 text-warm-500 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-warm-900 mb-1">{step.title}</p>
                <p className="text-sm text-warm-600 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Quick nav sidebar ─────────────────────────────────────────
function QuickNav({ sections, activeId, onJump }) {
  return (
    <nav className="hidden xl:block w-56 shrink-0">
      <div className="sticky top-6 space-y-0.5">
        <p className="text-xs font-semibold text-warm-400 uppercase tracking-wide px-3 mb-2">Jump to</p>
        {sections.map(s => {
          const SIcon = s.icon
          return (
            <button
              key={s.id}
              onClick={() => onJump(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeId === s.id
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-warm-500 hover:bg-warm-100 hover:text-warm-800'
              }`}
            >
              <SIcon className="w-3.5 h-3.5 shrink-0" />
              {s.title}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function Help() {
  const [query,    setQuery]    = useState('')
  const [openIds,  setOpenIds]  = useState(new Set(['getting-started']))
  const [activeId, setActiveId] = useState('getting-started')
  const sectionRefs = useRef({})

  function toggleSection(id) {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function jumpTo(id) {
    setOpenIds(prev => new Set([...prev, id]))
    setActiveId(id)
    setTimeout(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // Open all sections when searching
  useEffect(() => {
    if (query) setOpenIds(new Set(SECTIONS.map(s => s.id)))
    else setOpenIds(new Set(['getting-started']))
  }, [query])

  const visibleCount = SECTIONS.filter(s =>
    !query ||
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.summary.toLowerCase().includes(query.toLowerCase()) ||
    s.steps.some(st =>
      st.title.toLowerCase().includes(query.toLowerCase()) ||
      st.body.toLowerCase().includes(query.toLowerCase())
    )
  ).length

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-[#1E1B4B] to-[#4338CA] px-6 py-12 text-center">
        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">How to Use Pinlooply</h1>
        <p className="text-purple-200 text-base mb-6 max-w-lg mx-auto">
          Everything you need to know — from first login to advanced automations. Search below or browse by topic.
        </p>
        {/* Search */}
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the guide… (e.g. timer, team, AI)"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-warm-900 placeholder-warm-400 text-sm outline-none border border-warm-200 shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600 text-xs"
            >✕</button>
          )}
        </div>
        {query && (
          <p className="text-purple-300 text-xs mt-3">
            {visibleCount} section{visibleCount !== 1 ? 's' : ''} match "{query}"
          </p>
        )}
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
        <QuickNav sections={SECTIONS} activeId={activeId} onJump={jumpTo} />

        <div className="flex-1 space-y-4 min-w-0">
          {/* Quick-start banner */}
          {!query && (
            <div className="bg-gradient-to-r from-primary-50 to-violet-50 border border-primary-200 rounded-2xl px-6 py-5">
              <h2 className="text-base font-bold text-primary-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                Quick start — 3 steps
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { step: '1', icon: FolderOpen, label: 'Create a project', desc: 'Go to Projects → New Project → pick a template', to: '/projects', color: 'text-violet-600' },
                  { step: '2', icon: MessageSquare, label: 'Log a discussion', desc: 'Paste meeting notes → AI extracts your tasks', to: '/log', color: 'text-teal-600' },
                  { step: '3', icon: ListChecks, label: 'Work your tasks', desc: 'Open Tasks to manage your board or list view', to: '/lists', color: 'text-green-600' },
                ].map(item => (
                  <Link
                    key={item.step}
                    to={item.to}
                    className="flex items-start gap-3 p-3 bg-white rounded-xl border border-warm-200 hover:border-primary-300 hover:shadow-sm transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center shrink-0">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-warm-900 group-hover:text-primary-600 transition-colors">{item.label}</p>
                      <p className="text-xs text-warm-500 mt-0.5">{item.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Section cards */}
          {SECTIONS.map(section => (
            <div
              key={section.id}
              ref={el => sectionRefs.current[section.id] = el}
            >
              <SectionCard
                section={section}
                isOpen={openIds.has(section.id)}
                onToggle={() => toggleSection(section.id)}
                query={query}
              />
            </div>
          ))}

          {query && visibleCount === 0 && (
            <div className="text-center py-16 text-warm-400">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No results for "{query}"</p>
              <p className="text-sm mt-1">Try different keywords or browse all sections above.</p>
            </div>
          )}

          {/* Footer tip */}
          {!query && (
            <div className="text-center py-8 text-warm-400 text-sm border-t border-warm-200 mt-6">
              <p>Still stuck? Use <kbd className="px-1.5 py-0.5 bg-warm-100 rounded border border-warm-200 text-xs">⌘K</kbd> to search anything in the app, or check the <strong className="text-warm-600">Automations</strong> and <strong className="text-warm-600">Workspace</strong> settings for more power features.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
