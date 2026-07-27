import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'pinlooply_fab_pos_v3'
const EDGE = 16  // min px from any viewport edge

function GripDots() {
  return (
    <div className="flex gap-[3px] justify-center">
      {[0,1,2,3,4,5].map(i => (
        <span key={i} className="w-[3px] h-[3px] rounded-full bg-gray-400" />
      ))}
    </div>
  )
}

// Clamp a position so the container (w×h) stays fully inside the viewport
function clampToViewport(x, y, w, h) {
  return {
    x: Math.max(EDGE, Math.min(window.innerWidth  - w - EDGE, x)),
    y: Math.max(EDGE, Math.min(window.innerHeight - h - EDGE, y)),
  }
}

export default function DraggableFABStack({ children }) {
  const containerRef = useRef(null)
  const handleRef    = useRef(null)
  const dragging     = useRef(false)
  const startPtr     = useRef({ x: 0, y: 0 })
  const startPos     = useRef({ x: 0, y: 0 })

  const [pos, setPos] = useState(null)   // null = not yet mounted

  // Get actual container dimensions (falls back to safe estimates)
  function getSize() {
    const el = containerRef.current
    return {
      w: el ? el.offsetWidth  : 60,
      h: el ? el.offsetHeight : 130,
    }
  }

  // Clamp using actual container size and commit to state
  function snapToViewport(rawX, rawY) {
    const { w, h } = getSize()
    const p = clampToViewport(rawX, rawY, w, h)
    setPos(p)
    return p
  }

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    // Load saved position or default to bottom-right
    let raw = null
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (s && typeof s.x === 'number' && typeof s.y === 'number') raw = s
    } catch {}

    // Default: bottom-right, 80px from right, 100px from bottom
    if (!raw) {
      raw = {
        x: window.innerWidth  - 80,
        y: window.innerHeight - 200,
      }
    }

    // First clamp with estimated size so container appears on screen immediately
    const p = clampToViewport(raw.x, raw.y, 60, 130)
    setPos(p)
  }, [])

  // After first paint: re-clamp with actual measured dimensions
  useEffect(() => {
    if (!pos) return
    const { w, h } = getSize()
    const p = clampToViewport(pos.x, pos.y, w, h)
    if (p.x !== pos.x || p.y !== pos.y) setPos(p)
  }, [!!pos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-clamp when viewport resizes (orientation change, window resize)
  useEffect(() => {
    const handler = () => {
      setPos(prev => {
        if (!prev) return prev
        const { w, h } = getSize()
        return clampToViewport(prev.x, prev.y, w, h)
      })
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Drag ─────────────────────────────────────────────────────
  function onPointerDown(e) {
    e.preventDefault()
    handleRef.current.setPointerCapture(e.pointerId)
    dragging.current = true
    startPtr.current = { x: e.clientX, y: e.clientY }
    const rect = containerRef.current.getBoundingClientRect()
    startPos.current = { x: rect.left, y: rect.top }
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    const rawX = startPos.current.x + (e.clientX - startPtr.current.x)
    const rawY = startPos.current.y + (e.clientY - startPtr.current.y)
    const { w, h } = getSize()
    const p = clampToViewport(rawX, rawY, w, h)
    // Update DOM directly for 60fps drag — no React re-render mid-drag
    containerRef.current.style.left = p.x + 'px'
    containerRef.current.style.top  = p.y + 'px'
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    const rect = containerRef.current.getBoundingClientRect()
    const p = snapToViewport(rect.left, rect.top)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  }

  if (!pos) return null

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9100 }}
      className="flex flex-col items-center gap-2"
    >
      {/* Drag handle — grab to reposition */}
      <div
        ref={handleRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none', cursor: 'grab' }}
        title="Drag to reposition"
        className="w-10 h-5 flex items-center justify-center rounded-full bg-white/90 border border-warm-200 shadow-sm hover:bg-white hover:border-warm-300 active:cursor-grabbing transition-colors select-none"
      >
        <GripDots />
      </div>

      {/* Children (FeedbackWidget, QuickCreateFAB, etc.) */}
      {children}
    </div>
  )
}
