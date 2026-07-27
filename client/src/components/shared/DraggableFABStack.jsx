import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'pinlooply_fab_pos'

function getDefault() {
  return {
    x: Math.max(8, window.innerWidth - 80),
    y: Math.max(8, window.innerHeight - 220),
  }
}

function loadPos() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (s && typeof s.x === 'number' && typeof s.y === 'number') return s
  } catch {}
  return null
}

// ── Six-dot grip icon ─────────────────────────────────────────
function GripDots() {
  return (
    <div className="flex gap-1 justify-center">
      {[0,1,2,3,4,5].map(i => (
        <span key={i} className="w-1 h-1 rounded-full bg-gray-400" />
      ))}
    </div>
  )
}

export default function DraggableFABStack({ children }) {
  const containerRef = useRef()
  const handleRef    = useRef()
  const dragging     = useRef(false)
  const startPtr     = useRef({ x: 0, y: 0 })
  const startPos     = useRef({ x: 0, y: 0 })

  const [pos, setPos] = useState(null)

  useEffect(() => {
    setPos(loadPos() || getDefault())
  }, [])

  const clamp = useCallback((x, y) => {
    const el = containerRef.current
    const w  = el ? el.offsetWidth  : 60
    const h  = el ? el.offsetHeight : 160
    return {
      x: Math.max(8, Math.min(window.innerWidth  - w - 8, x)),
      y: Math.max(8, Math.min(window.innerHeight - h - 8, y)),
    }
  }, [])

  function onHandlePointerDown(e) {
    e.preventDefault()
    handleRef.current.setPointerCapture(e.pointerId)
    dragging.current = true
    startPtr.current = { x: e.clientX, y: e.clientY }
    const rect = containerRef.current.getBoundingClientRect()
    startPos.current = { x: rect.left, y: rect.top }
  }

  function onHandlePointerMove(e) {
    if (!dragging.current) return
    const dx = e.clientX - startPtr.current.x
    const dy = e.clientY - startPtr.current.y
    const { x, y } = clamp(startPos.current.x + dx, startPos.current.y + dy)
    // Update DOM directly for smooth drag — no React re-render during move
    containerRef.current.style.left = x + 'px'
    containerRef.current.style.top  = y + 'px'
  }

  function onHandlePointerUp() {
    if (!dragging.current) return
    dragging.current = false
    const rect = containerRef.current.getBoundingClientRect()
    const p = { x: rect.left, y: rect.top }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
    setPos(p)
  }

  if (!pos) return null

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 50 }}
      className="flex flex-col items-center gap-2"
    >
      {/* Drag handle — grab this to reposition */}
      <div
        ref={handleRef}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onPointerCancel={onHandlePointerUp}
        title="Drag to move"
        style={{ touchAction: 'none', cursor: 'grab' }}
        className="w-10 h-5 flex items-center justify-center rounded-full bg-white/80 border border-warm-200 shadow-sm hover:bg-white hover:border-warm-300 active:cursor-grabbing transition-colors select-none"
      >
        <GripDots />
      </div>

      {/* FAB buttons — stacked below the handle */}
      {children}
    </div>
  )
}
