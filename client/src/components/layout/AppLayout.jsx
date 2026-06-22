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
  Bell, CheckCheck, ClipboardList, BarChart3,
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
    <div className={`${sizeClass} rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold flex-shrink-0`}>
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
function NotificationBell({ notifications, unreadCount, onMarkRead, onMarkAllRead }) {
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
        className={`relative p-2 rounded-lg transition-colors ${
          open ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100 text-gray-500'
        }`}
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : notifications.map(n => (
              <button key={n.id} onClick={() => onMarkRead(n.id)}
                className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-indigo-50/50' : ''}`}>
                <span className="text-lg leading-none mt-0.5 flex-shrink-0">{typeIcon[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.is_read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                    {n.title}
                  </p>
                  {n.body && <p className="text-xs text-gray-500 mt-0.5 truncate">{n.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />}
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
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
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
    <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className={`flex items-center h-16 px-4 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && <span className="text-lg font-bold text-gray-900">Pinlooply</span>}
        <button onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => <SideNavLink key={item.to} {...item} collapsed={collapsed} />)}
      </nav>

      <div className={`border-t border-gray-100 p-3 space-y-2 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {/* Bell — desktop sidebar */}
        {collapsed ? (
          <NotificationBell {...bellProps} />
        ) : (
          <div className="flex items-center px-1">
            <NotificationBell {...bellProps} />
            <span className="text-xs text-gray-400 ml-2">Notifications</span>
          </div>
        )}

        {collapsed ? (
          <button onClick={onLogout} title="Sign out" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <LogOut className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar user={user} size={8} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {userProfile?.name || user?.user_metadata?.full_name || 'You'}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button onClick={onLogout} title="Sign out"
              className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-400 transition-colors flex-shrink-0">
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
      <div className="flex">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-500'
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
    <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 sticky top-0 z-30">
      <span className="text-base font-bold text-gray-900">Pinlooply</span>
      <div className="flex items-center gap-2">
        <NotificationBell {...bellProps} />
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
