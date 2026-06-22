import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

const app = express()
const PORT = process.env.PORT || 5000

// ── CORS ─────────────────────────────────────────────────────────────
// VERCEL_URL is auto-injected by Vercel as the deployment hostname (no https://)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.CLIENT_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // No origin header = server-to-server, curl, or same-origin GET (safe to allow)
    if (!origin) return callback(null, true)
    // Explicit allow list
    if (allowedOrigins.includes(origin)) return callback(null, true)
    // On Vercel, frontend and backend share the same domain — always allow
    if (process.env.VERCEL) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))

// Middleware
app.use(helmet())
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
})
app.use('/api', limiter)

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Pinlooply', env: { hasSupabaseUrl: !!process.env.SUPABASE_URL, hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY, vercelUrl: process.env.VERCEL_URL || 'not set' } })
})

// ── Routes ───────────────────────────────────────────────────────────
import discussionsRouter from './routes/discussions.js'
import topicsRouter from './routes/topics.js'
import tasksRouter from './routes/tasks.js'
import timelineRouter from './routes/timeline.js'
import projectsRouter from './routes/projects.js'
import groupsRouter from './routes/groups.js'
app.use('/api/discussions', discussionsRouter)
app.use('/api/topics', topicsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/timeline', timelineRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/groups', groupsRouter)

// ── Global JSON error handler — MUST be last ─────────────────────────
// Catches errors from middleware (e.g. CORS, body-parser) and returns JSON
// instead of Express's default HTML 500, so the client always gets { error }
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err.message)
  res.status(err.status || err.statusCode || 500).json({ error: err.message || 'Internal server error' })
})

// ── Local dev server — skipped on Vercel serverless ─────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

export default app
