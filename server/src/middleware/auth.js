import { supabaseAdmin } from '../config/supabase.js'

/**
 * In-memory token cache — avoids hitting Supabase auth server on every request.
 * Cache entries expire after 5 minutes (tokens are valid for 1 hour by default).
 */
const tokenCache = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function getCached(token) {
  const entry = tokenCache.get(token)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { tokenCache.delete(token); return null }
  return entry.user
}

function setCache(token, user) {
  // Prune old entries if cache grows large
  if (tokenCache.size > 500) {
    const now = Date.now()
    for (const [k, v] of tokenCache) if (now > v.expiresAt) tokenCache.delete(k)
  }
  tokenCache.set(token, { user, expiresAt: Date.now() + CACHE_TTL_MS })
}

/**
 * Verifies the Supabase JWT. Uses an in-memory cache so the remote
 * Supabase auth call only happens once per token (not on every request).
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = authHeader.split(' ')[1]

  // Return cached user immediately — no network call
  const cached = getCached(token)
  if (cached) { req.user = cached; return next() }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' })

    setCache(token, user)
    req.user = user
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    return res.status(401).json({ error: 'Authentication failed' })
  }
}
