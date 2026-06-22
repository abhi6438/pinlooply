import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

const app = express()
const PORT = process.env.PORT || 5000

// ── CORS: allow localhost dev + Vercel production URL ────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.CLIENT_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Vercel internal)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
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
  res.json({ status: 'ok', app: 'Pinlooply' })
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

// ── Local dev server — skipped on Vercel serverless ─────────────────
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

export default app
