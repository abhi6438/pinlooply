import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }))
app.use(express.json())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
})
app.use('/api', limiter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Pinlooply' })
})

// Routes
import discussionsRouter from './routes/discussions.js'
import topicsRouter from './routes/topics.js'
import tasksRouter from './routes/tasks.js'
app.use('/api/discussions', discussionsRouter)
app.use('/api/topics', topicsRouter)
app.use('/api/tasks', tasksRouter)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
