import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useUIStore } from '../../stores/useUIStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { supabase } from '../../config/supabase'
import {
  LayoutDashboard, MessageSquarePlus, FolderOpen, ListChecks,
  CalendarDays, Users, Settings, LogOut, Menu, ChevronLeft,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────
function getNavItems(mode) {
  const items = [
    { to: '/dashboard',  icon: LayoutDashboard,  label: 'Dashboard' },
    { to: '/log',        icon: MessageSquarePlus, label: 'Log Discussion' },
    { to: '/projects',   icon: FolderOpen,        label: 'Projects' },
    { to: '/lists',      icon: ListChecks,        label: 'Lists' },
    { to: '/timeline',   icon: CalendarDays,      label: 'Timeline' },
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
    return (
      <img
        src={user.user_metadata.avatar_url}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
        alt="avatar"
      />
    )
  }
  return (
    <div className={`${sizeClass} rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold flex-shrink-0`}>
      {initials}
    </div>
  )
}

// ── Sidebar nav link ──────────────────────────────────────────
function SideNavLink({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-700 font-medium'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ user, userProfile, onLogout }) {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const collapsed = !sidebarOpen
  const items = getNavItems(userProfile?.mode)

  return (
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo + toggle */}
      <div className={`flex items-center h-16 px-4 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <span className="text-lg font-bold text-gray-900">Pinlooply</span>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => (
          <SideNavLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* User */}
      <div className={`border-t border-gray-100 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <button
            onClick={onLogout}
            title="Sign out"
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
          >
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
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-gray-400 transition-colors flex-shrink-0"
            >
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
          <NavLink
            key={to}
            to={to}
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
function MobileHeader({ user }) {
  return (
    <header className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 sticky top-0 z-30">
      <span className="text-base font-bold text-gray-900">Pinlooply</span>
      <Avatar user={user} size={8} />
    </header>
  )
}

// ── AppLayout ─────────────────────────────────────────────────
export default function AppLayout({ children }) {
  const { user, logout } = useAuth()
  const { fetchProjects } = useProjectStore()
  const navigate = useNavigate()
  const [userProfile, setUserProfile] = useState(null)

  // Fetch user profile + projects on mount
  useEffect(() => {
    if (!user) return

    async function loadProfile() {
      const { data } = await supabase
        .from('users')
        .select('name, mode, plan')
        .eq('id', user.id)
        .single()
      if (data) setUserProfile(data)
    }

    loadProfile()
    fetchProjects(user.id)
  }, [user]) // eslint-disable-line

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar user={user} userProfile={userProfile} onLogout={handleLogout} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileHeader user={user} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      <BottomNav mode={userProfile?.mode} />
    </div>
  )
}
