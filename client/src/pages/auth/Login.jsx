import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace, clearSessionWorkspace } from '../../context/WorkspaceContext'
import api, { groupsApi } from '../../services/api'
import toast from 'react-hot-toast'

export default function Login() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteCode = searchParams.get('invite')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)
    try {
      // 1. Check if the email is registered BEFORE touching Supabase auth.
      //    This prevents Supabase from accidentally creating an unconfirmed session.
      let emailExists = true
      try {
        const check = await api.post('/api/auth/check-email', { email })
        emailExists = check.data.exists
      } catch {
        // If the check fails (network/server error), proceed and let Supabase decide
        emailExists = true
      }

      if (!emailExists) {
        setErrorMsg('No account found with this email address. Did you mean to sign up?')
        setLoading(false)
        return
      }

      // 2. Email exists — attempt login
      await login(email, password)

      // If coming from an invite, skip workspace selector
      if (inviteCode) {
        navigate(`/invite/${inviteCode}`)
        return
      }

      // 3. Check if user belongs to any groups — if yes, show workspace selector
      clearSessionWorkspace() // clear any previous session choice
      try {
        const res = await groupsApi.list()
        const groups = res.data.data || []
        if (groups.length > 0) {
          navigate('/choose-workspace')
          return
        }
      } catch { /* non-fatal — fall through to dashboard */ }

      navigate('/dashboard')
    } catch (err) {
      // login() threw — email exists but password is wrong
      setErrorMsg('Wrong password. Please try again or reset your password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    try {
      // Google OAuth redirect goes to invite page when present
      const redirectTo = inviteCode
        ? `${window.location.origin}/invite/${inviteCode}`
        : undefined
      await loginWithGoogle(redirectTo)
    } catch (err) {
      toast.error(err.message || 'Google login failed')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-[#1E1B4B] p-12 relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary-700 opacity-20 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-primary-600 opacity-15 translate-y-1/2 -translate-x-1/2" />

        {/* Top logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="text-white text-xl font-bold">Pinlooply</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Type what happened.<br/>
              <span className="text-primary-300">Pinloop remembers</span><br/>
              everything.
            </h2>
            <p className="text-purple-200 mt-4 text-lg leading-relaxed">
              AI-powered team memory that never forgets a decision.
            </p>
          </div>
          <div className="space-y-4">
            {[
              'AI extracts tasks automatically',
              'Team memory that never forgets',
              'Daily standup & weekly summaries',
              'Monthly reports in one click',
            ].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-purple-100 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-purple-400 text-sm">Trusted by dev teams worldwide 🌍</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-warm-50">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-bold text-xl">P</span>
            </div>
            <h1 className="text-xl font-bold text-warm-900">Pinlooply</h1>
          </div>

          <h2 className="text-2xl font-bold text-warm-900 mb-2">Welcome back 👋</h2>
          <p className="text-warm-500 mb-8">Sign in to your account to continue.</p>

          {/* Google button */}
          <button onClick={handleGoogle} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-warm-200 rounded-xl px-4 py-3 text-sm font-semibold text-warm-800 hover:bg-warm-50 hover:border-warm-300 transition-all shadow-warm-sm disabled:opacity-60 mb-6">
            <GoogleIcon />
            {googleLoading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-warm-200" />
            <span className="text-sm text-warm-400 font-medium">or</span>
            <div className="flex-1 h-px bg-warm-200" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input type="email" required value={email}
                onChange={e => { setEmail(e.target.value); setErrorMsg('') }}
                placeholder="you@example.com" className="input" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <Link to="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700 font-medium">Forgot password?</Link>
              </div>
              <input type="password" required value={password}
                onChange={e => { setPassword(e.target.value); setErrorMsg('') }}
                placeholder="••••••••" className="input" />
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary btn-lg w-full mt-2">
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <p className="text-center text-sm text-warm-500 mt-6">
            Don't have an account?{' '}
            <Link to={inviteCode ? `/signup?invite=${inviteCode}` : '/signup'} className="text-primary-600 font-semibold hover:text-primary-700">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}
