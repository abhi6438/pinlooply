import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../config/supabase'
import { groupsApi } from '../services/api'
import { Users, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function JoinGroup() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [group,   setGroup]   = useState(null)
  const [status,  setStatus]  = useState('loading') // loading | ready | joining | joined | error
  const [errMsg,  setErrMsg]  = useState('')

  // Load group info from invite code
  useEffect(() => {
    if (!inviteCode) { setStatus('error'); setErrMsg('Invalid invite link'); return }
    groupsApi.validateInvite(inviteCode)
      .then(r => { setGroup(r.data.data); setStatus('ready') })
      .catch(() => { setStatus('error'); setErrMsg('This invite link is invalid or expired') })
  }, [inviteCode])

  async function handleJoin() {
    if (!user) {
      // Keep localStorage as fallback for same-browser flow
      localStorage.setItem('pendingInvite', JSON.stringify({ groupId: group.id, inviteCode }))
      navigate(`/signup?invite=${inviteCode}`)
      return
    }
    setStatus('joining')
    try {
      await groupsApi.join(group.id, inviteCode)

      // Complete onboarding so ProtectedRoute doesn't bounce them back
      const { data: userData } = await supabase
        .from('users')
        .select('onboarding_complete, name')
        .eq('id', user.id)
        .single()

      if (!userData?.onboarding_complete) {
        const name = userData?.name || user.user_metadata?.full_name || ''
        // Don't overwrite mode — user keeps their personal mode in DB.
        // The workspace selector on login will let them choose which context to use.
        await supabase.from('users').update({
          onboarding_complete: true,
          onboarding_step: 4,
          ...(name && { name }),
        }).eq('id', user.id)
      }

      localStorage.removeItem('pendingInvite')
      setStatus('joined')
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to join')
      setStatus('ready')
    }
  }

  // Auto-join if user just signed up via invite
  useEffect(() => {
    if (!user || !group || status !== 'ready') return
    const pending = localStorage.getItem('pendingInvite')
    if (!pending) return
    const { groupId, inviteCode: code } = JSON.parse(pending)
    if (groupId === group.id && code === inviteCode) {
      localStorage.removeItem('pendingInvite')
      handleJoin()
    }
  }, [user, group, status]) // eslint-disable-line

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invite</h1>
          <p className="text-gray-500 text-sm mb-6">{errMsg}</p>
          <button onClick={() => navigate('/')} className="text-indigo-500 hover:underline text-sm">
            Go to Pinlooply
          </button>
        </div>
      </div>
    )
  }

  if (status === 'joined') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">You're in!</h1>
          <p className="text-gray-500 text-sm">Taking you to {group?.name}…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md text-center">
        {/* Logo */}
        <div className="text-lg font-bold text-gray-900 mb-8">Pinlooply</div>

        {/* Group avatar */}
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <Users className="w-8 h-8 text-indigo-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Join {group?.name} on Pinlooply
        </h1>

        {group?.description && (
          <p className="text-sm text-gray-500 mb-2">{group.description}</p>
        )}

        <p className="text-xs text-gray-400 mb-8">
          {group?.member_count ?? 0} member{group?.member_count !== 1 ? 's' : ''} already inside
        </p>

        {user ? (
          <button
            onClick={handleJoin}
            disabled={status === 'joining'}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {status === 'joining'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
              : `Join ${group?.name}`
            }
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/signup?invite=${inviteCode}`)}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl text-sm font-medium hover:bg-indigo-700"
            >
              Sign up to join
            </button>
            <button
              onClick={() => navigate(`/login?invite=${inviteCode}`)}
              className="w-full border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50"
            >
              Already have an account? Log in
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6">
          By joining, you'll have access to shared projects and team discussions.
        </p>
      </div>
    </div>
  )
}
