import { useState, useEffect, useRef } from 'react'

const STORAGE_KEY = 'pinlooply_fab_pos_v2'  // v2 — clears any old out-of-bounds saved positions
const EDGE        = 12   // min px from viewport edge
const EST_W       = 56   // estimated button width
const EST_H       = 180  // estimated total stack height (handle + 2 buttons + gaps)

// Six-dot grip icon
function GripDots() {
  return (
    <div className="flex gap-[3px] justify-center">
      {[0,1,2,3,4,5].map(i => (
        <span key={i} className="w-[3px] h-[3px] rounded-full bg-gray-400" />
      ))}
    </div>
  )
}

// Clamp x,y so the container (w×h) stays fully inside the viewport
function clamp(x, y, w = EST_W, h = EST_H) {
  return {
    x: Math.max(EDGE, Math.min(window.innerWidth  - w - EDGE, x)),
    y: Math.max(EDGE, Math.min(window.innerHeight - h - EDGE, y)),
  }
}

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (s && typeof s.x === 'number' && typeof s.y === 'number') return s
  } catch {}
  return null
}

function defaultPos() {
  // bottom-right, safely in bounds
  return clamp(window.innerWidth - 80, window.innerHeight - 200)
}

export default function DraggableFABStack({ children }) {
  const containerRef = useRef(null)
  const handleRef    = useRef(null)
  const dragging     = useRef(false)
  const startPtr     = useRef({ x: 0, y: 0 })
  const startPos     = useRef({ x: 0, y: 0 })

  const [pos,      setPos]      = useState(null)   // null until mounted
  const [stacksUp, setStacksUp] = useState(false)  // flip stack above handle?

  // Measure actual container and re-clamp pos
  function reclamp(rawPos) {
    const el = containerRef.current
    const w  = el ? el.offsetWidth  : EST_W
    const h  = el ? el.offsetHeight : EST_H
    const p  = clamp(rawPos.x, rawPos.y, w, h)
    // Stack upward when the FAB is in the bottom 55% of the screen
    setStacksUp(p.y > window.innerHeight * 0.45)
    return p
  }

  // Init: load saved pos (clamped) or use default
  useEffect(() => {
    const raw = loadSaved() || defaultPos()
    // First render — element isn't sized yet, use estimate
    const p = clamp(raw.x, raw.y)
    setPos(p)
    setStacksUp(p.y > window.innerHeight * 0.45)
  }, [])

  // After first paint, measure real size and re-clamp
  useEffect(() => {
    if (!pos) return
    const p = reclamp(pos)
    if (p.x !== pos.x || p.y !== pos.y) setPos(p)
  }, [pos === null]) // run once after pos is first set — eslint-disable-line

  // Re-clamp on window resize
  useEffect(() => {
    function onResize() {
      setPos(prev => {
        if (!prev) return prev
        return reclamp(prev)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Drag handlers ─────────────────────────────────────────────
  function onPointerDown(e) {
    e.preventDefault()
    handleRef.current.setPointerCapture(e.pointerId)
    dragging.current  = true
    startPtr.current  = { x: e.clientX, y: e.clientY }
    const rect = containerRef.current.getBoundingClientRect()
    startPos.current  = { x: rect.left, y: rect.top }
  }

  function onPointerMove(e) {
    if (!dragging.current) return
    const dx = e.clientX - startPtr.current.x
    const dy = e.clientY - startPtr.current.y
    const el = containerRef.current
    const w  = el ? el.offsetWidth  : EST_W
    const h  = el ? el.offsetHeight : EST_H
    const p  = clamp(startPos.current.x + dx, startPos.current.y + dy, w, h)
    // Direct DOM update for smooth drag — no React re-render during move
    el.style.left = p.x + 'px'
    el.style.top  = p.y + 'px'
  }

  function onPointerUp() {
    if (!dragging.current) return
    dragging.current = false
    const rect = containerRef.current.getBoundingClientRect()
    const p = reclamp({ x: rect.left, y: rect.top })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    setPos(p)
  }

  if (!pos) return null

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9100 }}
      className={`flex items-center gap-2 ${stacksUp ? 'flex-col-reverse' : 'flex-col'}`}
    >
      {/* Drag handle */}
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

      {/* FAB buttons — appear above or below handle based on screen position */}
      {children}
    </div>
  )
}
