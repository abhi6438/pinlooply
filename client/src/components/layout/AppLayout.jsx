import { useState, useEffect, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useUIStore } from '../../stores/useUIStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { supabase } from '../../config/supabase'
import { notificationsApi } from '../../services/api'
import {
  LayoutDashboard, MessageSquarePlus, FolderOpen, ListChecks,
  CalendarDays, Users, Settings, LogOut, Menu, ChevronLeft, Tag,
  Bell, CheckCheck, ClipboardList, BarChart3, Shield, FlaskConical,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────
function getNavItems(mode) {
  const items = [
    { to: '/dashboard',  icon: LayoutDashboard,  label: 'Dashboard' },
    { to: '/log',        icon: MessageSquarePlus, label: 'Log Discussion' },
    { to: '/topics',     icon: Tag,               label: 'Topics' },
    { to: '/projects',   icon: FolderOpen,        label: 'Projects' },
    { to: '/lists',      icon: ListChecks,        label: 'Lists' },
    { to: '/timeline',   icon: CalendarDays,      label: 'Timeline' },
    { to: '/standup',        icon: ClipboardList, label: 'Standup' },
    { to: '/weekly-summary', icon: BarChart3,     label: 'Weekly Summary' },
    { to: '/test-cases',     icon: FlaskConical,  label: 'Test Cases' },
  ]
  if (mode === 'team' || mode === 'org') {
    items.push({ to: '/team', icon: Users, label: 'Team' })
  }
  items.push({ to: '/settings', icon: Settings, label: 'Settings' })
  return items
}

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

// ── Notification Bell (pure UI — state owned by AppLayout) ────
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
function Sidebar({ user, userProfile, bellProps, onLogout }) {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const collapsed = !sidebarOpen
  const items = getNavItems(userProfile?.mode)

  return (
    <aside className={`hidden md:flex flex-col bg-[#1E1B4B] text-white transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Top: logo + collapse button */}
      <div className={`flex items-center h-16 px-4 border-b border-[#312E81] ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-white font-bold text-lg">Pinlooply</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
        )}
        <button onClick={toggleSidebar}
          className="p-1.5 rounded-lg text-purple-300 hover:text-white transition-colors flex-shrink-0"
          title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {items.map((item) => <SideNavLink key={item.to} {...item} collapsed={collapsed} />)}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-[#312E81] space-y-2">
        {/* Notification Bell */}
        <NotificationBell {...bellProps} collapsed={collapsed} />

        {/* Admin link */}
        {user?.email === import.meta.env.VITE_ADMIN_EMAIL && (
          <SideNavLink to="/admin" icon={Shield} label="Admin" collapsed={collapsed} />
        )}

        {/* User section */}
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
  const items = getNavItems(mode).slice(0, 5)
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-warm-200 z-40">
      <div className="flex">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                isActive ? 'text-primary-600' : 'text-warm-400'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label.split(' ')[0]}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// ── Mobile header ─────────────────────────────────────────────
function MobileHeader({ user, bellProps }) {
  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white shadow-warm-sm sticky top-0 z-30">
      <button className="p-1.5 text-warm-600 rounded-lg">
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

// ── AppLayout — owns notification state + ONE realtime sub ────
export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const { fetchProjects } = useProjectStore()
  const navigate = useNavigate()
  const [userProfile, setUserProfile] = useState(null)

  // ── Notification state (single source of truth) ─────────────
  const [notifications, setNotifications] = useState([])
  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    if (!user) return

    // Load profile + projects
    async function loadProfile() {
      const { data } = await supabase.from('users').select('name, mode, plan').eq('id', user.id).single()
      if (data) setUserProfile(data)
    }
    loadProfile()
    fetchProjects(user.id)

    // Load notifications
    async function loadNotifications() {
      try {
        const res = await notificationsApi.list()
        setNotifications(res.data.data || [])
      } catch { /* non-fatal */ }
    }
    loadNotifications()

    // ONE realtime subscription per AppLayout mount — unique channel name
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

  return (
    <div className="flex h-screen bg-warm-50 overflow-hidden">
      <Sidebar user={user} userProfile={userProfile} bellProps={bellProps} onLogout={handleLogout} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileHeader user={user} bellProps={bellProps} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav mode={userProfile?.mode} />
    </div>
  )
}
