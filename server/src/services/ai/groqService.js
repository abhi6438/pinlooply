import Groq from 'groq-sdk'

// ── Load all GROQ keys from env ───────────────────────────────
// Supports: GROQ_API_KEY, GROQ_API_KEY_1, GROQ_API_KEY_2, ...
function loadGroqKeys() {
  const keys = []
  // Primary key (backward-compatible)
  if (process.env.GROQ_API_KEY) keys.push(process.env.GROQ_API_KEY)
  // Numbered extras: GROQ_API_KEY_1, GROQ_API_KEY_2, ... up to 10
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`]
    if (k) keys.push(k)
  }
  return [...new Set(keys)] // deduplicate
}

const GROQ_KEYS = loadGroqKeys()

// Cache a Groq client per key so we don't recreate on every call
const clientCache = new Map()
function getClient(apiKey) {
  if (!clientCache.has(apiKey)) clientCache.set(apiKey, new Groq({ apiKey }))
  return clientCache.get(apiKey)
}

export class RateLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RateLimitError'
  }
}

// ── Call Groq with automatic key rotation on 429 ──────────────
export async function callGroq(prompt, model = 'llama3-8b-8192') {
  if (GROQ_KEYS.length === 0) {
    throw new Error('No Groq API keys configured. Set GROQ_API_KEY in your .env file.')
  }

  let lastError = null

  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const key = GROQ_KEYS[i]
    const client = getClient(key)
    const keyLabel = i === 0 ? 'primary' : `key #${i + 1}`

    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 4096,
      })
      // Success — log which key was used if not primary
      if (i > 0) console.log(`[Groq] Used ${keyLabel} after ${i} key(s) were rate-limited`)
      const text = completion.choices[0]?.message?.content?.trim() || ''
      return parseJSON(text)
    } catch (err) {
      const status = err?.status || err?.statusCode
      if (status === 429) {
        console.warn(`[Groq] ${keyLabel} hit rate limit — trying next key...`)
        lastError = err
        continue // try next key
      }
      throw err // non-429 error: propagate immediately
    }
  }

  // All keys exhausted
  const raw = lastError?.error?.message || lastError?.message || ''
  const match = raw.match(/([\d.]+m[\d.]+s|[\d]+\s*minute|[\d.]+s)/i)
  const retryMsg = match ? ` Try again in ${match[1]}.` : ' All API keys are rate-limited. Try again later.'
  throw new RateLimitError(
    `Groq rate limit reached on all ${GROQ_KEYS.length} key(s).${retryMsg}`
  )
}

// ── JSON parser ───────────────────────────────────────────────
function parseJSON(text) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error(`Groq returned non-JSON response: ${cleaned.slice(0, 200)}`)
  }
}
