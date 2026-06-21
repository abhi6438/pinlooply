import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../config/supabase'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    </div>
  )
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [onboardingDone, setOnboardingDone] = useState(null) // null = unknown

  useEffect(() => {
    if (!user) { setOnboardingDone(null); return }

    async function check() {
      const { data } = await supabase
        .from('users')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single()
      setOnboardingDone(data?.onboarding_complete ?? false)
    }
    check()
  }, [user])

  // Still checking auth
  if (loading) return <Spinner />

  // Not logged in
  if (!user) return <Navigate to="/login" replace />

  // Logged in but onboarding status not fetched yet
  if (onboardingDone === null) return <Spinner />

  // Logged in, onboarding incomplete, not already on /onboarding
  if (!onboardingDone && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
