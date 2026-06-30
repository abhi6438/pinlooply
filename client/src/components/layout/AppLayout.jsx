import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useUIStore } from '../../stores/useUIStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { supabase } from '../../config/supabase'
import { notificationsApi } from '../../services/api'
import SearchModal from '../ui/SearchModal'
import {
  LayoutDashboard, FolderOpen, ListChecks,
  CalendarDays, Users, Settings, LogOut, Menu, ChevronLeft, Tag,
  Bell, CheckCheck, ClipboardList, BarChart3, Shield, FlaskConical,
  UserCheck, BarChart2, Timer, Search, HelpCircle, Send,
  Plus, X, Database, ChevronsUpDown,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Nav groups — grouped by purpose ───────────────────────────
function getNavGroups(mode, vocabulary = {}, enabledModules = null) {
  const allow = (key) => key === null || enabledModules === null || enabledModules.includes(key)

  const groups = [
    {
      label: 'Work',
      items: [
        { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard',                        moduleKey: null       },
        { to: '/projects',       icon: FolderOpen,      label: vocabulary.projects  || 'Projects', moduleKey: 'projects' },
        { to: '/lists',          icon: ListChecks,      label: vocabulary.tasks     || 'Tasks',    moduleKey: 'tasks'    },
        { to: '/timeline',       icon: CalendarDays,    label: vocabulary.timeline  || 'Timeline', moduleKey: 'timeline' },
      ].filter(i => allow(i.moduleKey)),
    },
    {
      label: 'Capture',
      items: [
        { to: '/log',            icon: Send,            label: 'Log Discussion',                   moduleKey: null       },
        { to: '/topics',         icon: Tag,             label: vocabulary.topics    || 'Topics',   moduleKey: 'topics'   },
        { to: '/standup',        icon: ClipboardList,   label: vocabulary.standup   || 'Standup',  moduleKey: 'standup'  },
        { to: '/weekly-summary', icon: BarChart3,       label: vocabulary.summary   || 'Summary',  moduleKey: 'summary'  },
        { to: '/test-cases',     icon: FlaskConical,    label: vocabulary.testcases || 'Test Cases', moduleKey: 'testcases' },
      ].filter(i => allow(i.moduleKey)),
    },
    {
      label: 'Personal',
      items: [
        { to: '/my-tasks',     icon: UserCheck, label: 'My Tasks',     moduleKey: null },
        { to: '/time-reports', icon: Timer,     label: 'Time Reports', moduleKey: null },
      ],
    },
  ]

  if (mode === 'team' || mode === 'org') {
    groups.push({
      label: 'Team',
      items: [
        { to: '/team',    icon: Users,    label: 'Team',    moduleKey: null },
        { to: '/manager', icon: BarChart2, label: 'Manager', moduleKey: null },
      ],
    })
  }

  // Bottom utilities — always shown
  groups.push({
    label: null, // no label = just a divider
    items: [
      { to: '/help',          icon: HelpCircle, label: 'Help',            moduleKey: null },
      { to: '/settings',      icon: Settings,   label: 'Settings',        moduleKey: null },
      { to: '/settings/data', icon: Database,   label: 'Data Management', moduleKey: null },
    ],
  })

  return groups
}

// ── Avatar ─────────────────────────────────────────────────────
function Avatar({ user, size = 8 }) {
  const name = user?.user_metadata?.full_name || user?.email || 'U'
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const sizeClass = `w-${size} h-${size}`
  if (user?.user_metadata?.avatar_url) {
    return <img src={user.user_metadata.avatar_url} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} alt="avatar" />
  }
  return (
    <div className={`${sizeClass} rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0`}>
      {initials}
    </div>
  )
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Notification Bell ─────────────────────────────────────────
function NotificationBell({ notifications, unreadCount, onMarkRead, onMarkAllRead, collapsed }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const typeIcon = { task_assigned: '📋', task_completed: '✅', task_overdue: '⚠️' }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-colors text-purple-200 hover:bg-[#312E81] hover:text-white ${open ? 'bg-[#312E81] text-white' : ''}`}
        title="Notifications"
      >
        <Bell className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">Notifications</span>}
        {unreadCount > 0 && (
          <span className="absolute top-1 left-6 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-12 w-80 bg-white border border-warm-200 rounded-2xl shadow-warm-md z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-warm-100">
            <span className="text-sm font-semibold text-warm-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-warm-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-warm-200 mx-auto mb-2" />
                <p className="text-sm text-warm-400">No notifications yet</p>
              </div>
            ) : notifications.map(n => (
              <button key={n.id} onClick={() => onMarkRead(n.id)}
                className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-warm-50 transition-colors ${!n.is_read ? 'bg-primary-50/40' : ''}`}>
                <span className="text-lg leading-none mt-0.5 flex-shrink-0">{typeIcon[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.is_read ? 'font-medium text-warm-900' : 'text-warm-700'}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-xs text-warm-500 mt-0.5 truncate">{n.body}</p>}
                  <p className="text-xs text-warm-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sidebar nav link ──────────────────────────────────────────
function SideNavLink({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `sidebar-link${isActive ? ' active' : ''} flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5`
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ user, userProfile, bellProps, onLogout, onSearchOpen }) {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { vocabulary, enabledModules, workspaceName, activeMode, activeGroupName } = useWorkspace()
  const navigate = useNavigate()
  const collapsed = !sidebarOpen

  // Active mode: use session choice, fall back to DB mode
  const effectiveMode = activeMode ?? userProfile?.mode ?? 'personal'
  const navGroups = getNavGroups(effectiveMode, vocabulary, enabledModules)

  // Display name: group name when in team mode, else workspace name
  const displayName = (effectiveMode === 'team' && activeGroupName)
    ? activeGroupName
    : (workspaceName || 'Pinlooply')

  // Workspace badge label
  const workspaceBadge = effectiveMode === 'team' ? 'Team' : 'Personal'

  return (
    <aside className={`hidden md:flex flex-col bg-[#1E1B4B] text-white transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo + workspace switcher + collapse */}
      <div className={`flex items-center h-16 px-4 border-b border-[#312E81] ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <button
            onClick={() => navigate('/choose-workspace')}
            className="flex items-center gap-2 min-w-0 flex-1 group hover:opacity-80 transition-opacity"
            title="Switch workspace"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{displayName[0]?.toUpperCase() || 'P'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm truncate leading-tight">{displayName}</p>
              <p className="text-purple-300 text-[10px] leading-tight">{workspaceBadge}</p>
            </div>
            <ChevronsUpDown className="w-3.5 h-3.5 text-purple-400 group-hover:text-white transition-colors flex-shrink-0" />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => navigate('/choose-workspace')}
            title="Switch workspace"
            className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <span className="text-white font-bold text-sm">{displayName[0]?.toUpperCase() || 'P'}</span>
          </button>
        )}
        <button onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-purple-300 hover:text-white transition-colors flex-shrink-0 ml-1"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Search */}
      <div className="px-2 pt-3 pb-1">
        <button
          onClick={onSearchOpen}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-purple-300 hover:bg-[#312E81] hover:text-white transition-colors ${collapsed ? 'justify-center' : ''}`}
          title="Search (⌘K)"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <kbd className="text-xs px-1.5 py-0.5 bg-[#312E81] rounded border border-[#4338CA] text-purple-400">⌘K</kbd>
            </>
          )}
        </button>
      </div>

      {/* Grouped nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {navGroups.map((group, gi) => {
          if (!group.items.length) return null
          const isUtility = group.label === null
          return (
            <div key={gi}>
              {/* Divider before utility group */}
              {isUtility
                ? <div className="h-px bg-[#312E81] mx-1 my-2" />
                : gi > 0 && !collapsed && <div className="h-px bg-[#312E81]/50 mx-1 my-2" />
              }
              {/* Section label */}
              {!collapsed && group.label && (
                <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-purple-400 select-none">
                  {group.label}
                </p>
              )}
              {/* Items */}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <SideNavLink key={item.to} {...item} collapsed={collapsed} />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Bottom: notifications + user */}
      <div className="px-3 py-4 border-t border-[#312E81] space-y-2">
        <NotificationBell {...bellProps} collapsed={collapsed} />

        {user?.email === import.meta.env.VITE_ADMIN_EMAIL && (
          <SideNavLink to="/admin" icon={Shield} label="Admin" collapsed={collapsed} />
        )}

        {collapsed ? (
          <div className="flex flex-col items-center gap-2 pt-1">
            <Avatar user={user} size={8} />
            <button onClick={onLogout} title="Sign out"
              className="p-1.5 text-purple-300 hover:text-red-400 transition-colors rounded-lg">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <Avatar user={user} size={8} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userProfile?.name || user?.user_metadata?.full_name || 'You'}
              </p>
              {userProfile?.plan && (
                <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-700 text-primary-200 leading-none mt-0.5">
                  {userProfile.plan}
                </span>
              )}
            </div>
            <button onClick={onLogout} title="Sign out"
              className="p-1.5 text-purple-300 hover:text-red-400 transition-colors rounded-lg flex-shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

// ── Mobile bottom nav ─────────────────────────────────────────
function BottomNav({ mode }) {
  const { vocabulary, enabledModules } = useWorkspace()
  // Show 5 most-used items on mobile
  const mobileItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    { to: '/projects',  icon: FolderOpen,      label: 'Projects' },
    { to: '/lists',     icon: ListChecks,      label: 'Tasks' },
    { to: '/log',       icon: Send,            label: 'Log' },
    { to: '/my-tasks',  icon: UserCheck,       label: 'Mine' },
  ].filter(item => {
    // basic module check for projects/tasks
    if (item.to === '/projects' && enabledModules && !enabledModules.includes('projects')) return false
    if (item.to === '/lists' && enabledModules && !enabledModules.includes('tasks')) return false
    return true
  }).slice(0, 5)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-warm-200 z-40">
      <div className="flex">
        {mobileItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                isActive ? 'text-primary-600' : 'text-warm-400'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// ── Mobile drawer ─────────────────────────────────────────────
function MobileDrawer({ open, onClose, user, userProfile, bellProps, onLogout }) {
  const { vocabulary, enabledModules, workspaceName } = useWorkspace()
  const navGroups = getNavGroups(userProfile?.mode, vocabulary, enabledModules)
  const displayName = workspaceName || 'Pinlooply'

  useEffect(() => { if (open) onClose() }, []) // eslint-disable-line

  if (!open) return null
  return (
    <>
      <div className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-[#1E1B4B] z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between h-14 px-4 border-b border-[#312E81]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{displayName[0]?.toUpperCase() || 'P'}</span>
            </div>
            <span className="text-white font-bold truncate">{displayName}</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-purple-300 hover:text-white rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {navGroups.map((group, gi) => {
            if (!group.items.length) return null
            return (
              <div key={gi}>
                {gi > 0 && <div className="h-px bg-[#312E81]/60 mx-1 my-2" />}
                {group.label && (
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-purple-400 select-none">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <NavLink key={item.to} to={item.to} onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive ? 'bg-primary-600 text-white' : 'text-purple-200 hover:bg-[#312E81] hover:text-white'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
          {user?.email === import.meta.env.VITE_ADMIN_EMAIL && (
            <NavLink to="/admin" onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-purple-200 hover:bg-[#312E81] hover:text-white'
                }`
              }
            >
              <Shield className="w-5 h-5 flex-shrink-0" />
              <span>Admin</span>
            </NavLink>
          )}
        </nav>

        <div className="px-3 py-4 border-t border-[#312E81]">
          <div className="flex items-center gap-3 mb-3">
            <Avatar user={user} size={9} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userProfile?.name || user?.user_metadata?.full_name || 'You'}
              </p>
              {userProfile?.plan && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-700 text-primary-200">
                  {userProfile.plan}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => { onClose(); onLogout() }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-300 hover:text-red-400 hover:bg-[#312E81] rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}

// ── Mobile header ─────────────────────────────────────────────
function MobileHeader({ user, bellProps, onMenuOpen }) {
  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white shadow-warm-sm sticky top-0 z-30">
      <button onClick={onMenuOpen} className="p-1.5 text-warm-600 hover:text-warm-900 rounded-lg transition-colors">
        <Menu className="w-5 h-5" />
      </button>
      <span className="text-base font-bold text-warm-900">Pinlooply</span>
      <div className="flex items-center gap-2">
        <NotificationBell {...bellProps} collapsed={true} />
        <Avatar user={user} size={8} />
      </div>
    </header>
  )
}

// ── Quick-Create FAB ──────────────────────────────────────────
function QuickCreateFAB() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const ref = useRef()

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const actions = [
    { icon: Send,      label: 'Log Discussion', desc: 'Paste notes or chat',  color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', to: '/log'      },
    { icon: FolderOpen, label: 'New Project',   desc: 'Start a new project', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     to: '/projects' },
    { icon: ListChecks, label: 'Add Task',      desc: 'Add to task board',   color: 'text-green-600',  bg: 'bg-green-50 border-green-200',   to: '/lists'    },
  ]

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-2 md:bottom-8 md:right-8">
      {/* Action items */}
      {open && (
        <div className="flex flex-col-reverse gap-2 mb-2">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => { navigate(a.to); setOpen(false) }}
              className={`flex items-center gap-3 pl-3 pr-5 py-2.5 rounded-2xl border shadow-md bg-white hover:shadow-lg transition-all text-left group animate-fade-in`}
              style={{ minWidth: 190 }}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${a.bg} border`}>
                <a.icon className={`w-4 h-4 ${a.color}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-warm-900 leading-tight">{a.label}</p>
                <p className="text-xs text-warm-400 leading-tight">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* FAB toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${
          open
            ? 'bg-warm-700 text-white rotate-45'
            : 'bg-primary-600 text-white hover:bg-primary-700 hover:scale-105'
        }`}
        title="Quick create"
        aria-label="Quick create"
      >
        {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  )
}

// ── AppLayout ─────────────────────────────────────────────────
export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const { fetchProjects } = useProjectStore()
  const navigate = useNavigate()
  const [userProfile, setUserProfile] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const [notifications, setNotifications] = useState([])
  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      const { data } = await supabase.from('users').select('name, mode, plan').eq('id', user.id).single()
      if (data) setUserProfile(data)
    }
    loadProfile()
    fetchProjects(user.id)

    async function loadNotifications() {
      try {
        const res = await notificationsApi.list()
        setNotifications(res.data.data || [])
      } catch { /* non-fatal */ }
    }
    loadNotifications()

    const channelName = `notif-${user.id}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
        toast(`${payload.new.title}${payload.new.body ? '\n' + payload.new.body : ''}`, { icon: '🔔' })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id]) // eslint-disable-line

  async function markRead(id) {
    setNotifications(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
    try { await notificationsApi.markRead(id) } catch { /* non-fatal */ }
  }

  async function markAllRead() {
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
    try { await notificationsApi.markAllRead() } catch { /* non-fatal */ }
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const bellProps = { notifications, unreadCount, onMarkRead: markRead, onMarkAllRead: markAllRead }

  // Cmd+K global shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen bg-warm-50 overflow-hidden">
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Sidebar
        user={user}
        userProfile={userProfile}
        bellProps={bellProps}
        onLogout={handleLogout}
        onSearchOpen={() => setSearchOpen(true)}
      />
      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        userProfile={userProfile}
        bellProps={bellProps}
        onLogout={handleLogout}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileHeader user={user} bellProps={bellProps} onMenuOpen={() => setMobileMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav mode={userProfile?.mode} />
      <QuickCreateFAB />
    </div>
  )
}
