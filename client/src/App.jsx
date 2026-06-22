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
import LogDiscussion from './pages/LogDiscussion'
import AIConfirm from './pages/AIConfirm'
import Topics from './pages/Topics'
import TopicDetail from './pages/TopicDetail'
import Lists from './pages/Lists'
import Timeline from './pages/Timeline'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import JoinGroup from './pages/JoinGroup'
import GroupMembers from './pages/GroupMembers'
import Standup from './pages/Standup'

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
          <AppLayout><LogDiscussion /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/log/confirm" element={
        <ProtectedRoute>
          <AppLayout><AIConfirm /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/log/:id" element={
        <ProtectedRoute>
          <AppLayout><Placeholder title="Discussion Detail" /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/projects" element={
        <ProtectedRoute>
          <AppLayout><Projects /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/projects/:id" element={
        <ProtectedRoute>
          <AppLayout><ProjectDetail /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/topics" element={
        <ProtectedRoute>
          <AppLayout><Topics /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/topics/:topicId" element={
        <ProtectedRoute>
          <AppLayout><TopicDetail /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/lists" element={
        <ProtectedRoute>
          <AppLayout><Lists /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/timeline" element={
        <ProtectedRoute>
          <AppLayout><Timeline /></AppLayout>
        </ProtectedRoute>
      } />
      {/* Public invite page — no auth wrapper */}
      <Route path="/invite/:inviteCode" element={<JoinGroup />} />

      <Route path="/team" element={
        <ProtectedRoute>
          <AppLayout><GroupMembers /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/standup" element={
        <ProtectedRoute>
          <AppLayout><Standup /></AppLayout>
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
