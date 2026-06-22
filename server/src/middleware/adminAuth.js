import { supabaseAdmin } from '../config/supabase.js'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

/**
 * Middleware: require both a valid JWT (via requireAuth) AND that the
 * authenticated user's email matches ADMIN_EMAIL in .env.
 *
 * Must be used AFTER requireAuth so req.user is already set.
 */
export async function requireAdmin(req, res, next) {
  if (!ADMIN_EMAIL) {
    return res.status(500).json({ error: 'ADMIN_EMAIL not configured on server' })
  }

  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  // Fetch email from public.users (synced from auth.users on signup)
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  if (!profile || profile.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access only' })
  }

  next()
}
