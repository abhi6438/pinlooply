import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { groupsApi } from '../services/api'
import { supabase } from '../config/supabase'
import { Users, User, ChevronRight, Loader2, LogOut } from 'lucide-react'

export default function WorkspaceSelect() {
  const { user, logout } = useAuth()
  const { setActiveWorkspace } = useWorkspace()
  const navigate = useNavigate()

  const [groups,    setGroups]    = useState([])
  const [userName,  setUserName]  = useState('')
  const [loading,   setLoading]   = useState(true)
  const [choosing,  setChoosing]  = useState(null) // id of card being clicked

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const [groupRes, userRes] = await Promise.all([
          groupsApi.list(),
          supabase.from('users').select('name').eq('id', user.id).single(),
        ])
        setGroups(groupRes.data.data || [])
        setUserName(userRes.data?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'You')
      } catch { /* non-fatal */ }
      finally { setLoading(false) }
    }
    load()
  }, [user])

  function pick(ws) {
    setChoosing(ws.mode === 'personal' ? 'personal' : ws.groupId)
    setActiveWorkspace(ws)
    navigate('/dashboard')
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-warm-900">Choose your workspace</h1>
          <p className="text-warm-500 mt-2 text-sm">
            You belong to multiple workspaces. Which one would you like to open?
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Personal workspace */}
            <button
              onClick={() => pick({ mode: 'personal', groupId: null, groupName: null })}
              disabled={!!choosing}
              className="w-full flex items-center gap-4 bg-white border-2 border-warm-200 hover:border-primary-400 hover:shadow-md rounded-2xl px-5 py-4 text-left transition-all group disabled:opacity-60"
            >
              <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-warm-900 text-sm">{userName}</p>
                <p className="text-xs text-warm-400 mt-0.5">Personal workspace · your own projects &amp; tasks</p>
              </div>
              {choosing === 'personal'
                ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
              }
            </button>

            {/* Divider */}
            {groups.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-warm-200" />
                <span className="text-xs text-warm-400 font-medium">Teams &amp; Organisations</span>
                <div className="flex-1 h-px bg-warm-200" />
              </div>
            )}

            {/* Group workspaces */}
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => pick({ mode: 'team', groupId: g.id, groupName: g.name })}
                disabled={!!choosing}
                className="w-full flex items-center gap-4 bg-white border-2 border-warm-200 hover:border-primary-400 hover:shadow-md rounded-2xl px-5 py-4 text-left transition-all group disabled:opacity-60"
              >
                <div className="w-11 h-11 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-warm-900 text-sm">{g.name}</p>
                  <p className="text-xs text-warm-400 mt-0.5">
                    Team workspace
                    {g.member_count ? ` · ${g.member_count} member${g.member_count !== 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                {choosing === g.id
                  ? <Loader2 className="w-4 h-4 text-primary-500 animate-spin flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-warm-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                }
              </button>
            ))}
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 mt-6 text-sm text-warm-400 hover:text-warm-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
