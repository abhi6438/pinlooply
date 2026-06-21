import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

// Auth pages
import Login from './pages/auth/Login'
import Signup from './pages/auth/Signup'
import ForgotPassword from './pages/auth/ForgotPassword'

// App pages
import Dashboard from './pages/Dashboard'
import Onboarding from './pages/Onboarding'

// Placeholder pages (will be built in future prompts)
function Placeholder({ title }) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 text-sm">{title} — coming soon</p>
    </div>
  )
}

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Onboarding — protected but no AppLayout */}
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      {/* App — protected + AppLayout */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/log" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Log Discussion" /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/log/:id" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Discussion Detail" /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/projects" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Projects" /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/projects/:id" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Project Detail" /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/lists" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Lists" /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/timeline" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Timeline" /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/team" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Team" /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Settings" /></AppLayout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
