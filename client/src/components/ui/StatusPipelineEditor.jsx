// ── StatusPipelineEditor ──────────────────────────────────────
// Reusable drag-reorder pipeline editor.
// Props:
//   statuses  – array of { key, label, color, is_done }
//   onChange  – called with new array on any change
//   compact   – smaller UI for project detail
import { useState } from 'react'
import { GripVertical, Plus, Trash2, Check } from 'lucide-react'
import { COLOR_OPTIONS, STATUS_COLORS, labelToKey } from '../../config/statuses'

function ColorDot({ color, size = 'w-3 h-3' }) {
  const c = STATUS_COLORS[color] || STATUS_COLORS.warm
  return <span className={`${size} rounded-full flex-shrink-0 ${c.dot}`} />
}

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {COLOR_OPTIONS.map(c => (
        <button
          key={c.key}
          type="button"
          title={c.label}
          onClick={() => onChange(c.key)}
          className={`w-5 h-5 rounded-full border-2 transition-all ${value === c.key ? 'border-primary-600 scale-110' : 'border-transparent hover:scale-105'}`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  )
}

export default function StatusPipelineEditor({ statuses = [], onChange, compact = false }) {
  const [dragIdx, setDragIdx] = useState(null)
  const [editingColor, setEditingColor] = useState(null) // index of open color picker

  function update(idx, patch) {
    const next = statuses.map((s, i) => i === idx ? { ...s, ...patch } : s)
    onChange(next)
  }

  function remove(idx) {
    if (statuses.length <= 1) return
    onChange(statuses.filter((_, i) => i !== idx))
  }

  function addStatus() {
    const newStatus = {
      key:     `status_${Date.now()}`,
      label:   'New Status',
      color:   'warm',
      is_done: false,
    }
    onChange([...statuses, newStatus])
  }

  function markAsDone(idx) {
    // Toggle is_done; if marking done, unmark all others
    const next = statuses.map((s, i) => ({
      ...s,
      is_done: i === idx ? !s.is_done : (statuses[idx].is_done ? s.is_done : false),
    }))
    onChange(next)
  }

  // ── Drag & drop reorder ───────────────────────────────────────
  function handleDragStart(e, idx) {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const next = [...statuses]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setDragIdx(idx)
    onChange(next)
  }

  function handleDragEnd() {
    setDragIdx(null)
  }

  return (
    <div className="space-y-2">
      {statuses.map((s, idx) => (
        <div
          key={s.key + idx}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragOver={e => handleDragOver(e, idx)}
          onDragEnd={handleDragEnd}
          className={`flex items-start gap-2 p-2.5 rounded-xl border transition-all ${
            dragIdx === idx ? 'opacity-50 border-primary-300' : 'border-warm-200 bg-white hover:border-warm-300'
          }`}
        >
          {/* Drag handle */}
          <button type="button" className="mt-0.5 text-warm-300 hover:text-warm-500 cursor-grab active:cursor-grabbing flex-shrink-0">
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Color dot + label */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingColor(editingColor === idx ? null : idx)}
                className="flex-shrink-0"
                title="Change color"
              >
                <ColorDot color={s.color} />
              </button>
              <input
                type="text"
                value={s.label}
                onChange={e => {
                  const label = e.target.value
                  update(idx, { label, key: labelToKey(label) || s.key })
                }}
                className="flex-1 text-sm font-medium text-warm-900 bg-transparent border-b border-transparent focus:border-warm-300 focus:outline-none py-0.5"
                maxLength={30}
              />
            </div>
            {editingColor === idx && (
              <ColorPicker
                value={s.color}
                onChange={c => { update(idx, { color: c }); setEditingColor(null) }}
              />
            )}
          </div>

          {/* Done toggle */}
          <button
            type="button"
            title={s.is_done ? 'Unmark as done' : 'Mark as completion status'}
            onClick={() => markAsDone(idx)}
            className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
              s.is_done ? 'bg-green-100 text-green-700' : 'bg-warm-100 text-warm-500 hover:bg-green-50 hover:text-green-600'
            }`}
          >
            <Check className="w-3 h-3" />
            {!compact && <span>{s.is_done ? 'Done' : 'Set done'}</span>}
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => remove(idx)}
            disabled={statuses.length <= 1}
            className="flex-shrink-0 text-warm-300 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed mt-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addStatus}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-warm-300 text-sm text-warm-500 hover:border-primary-400 hover:text-primary-600 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Add status
      </button>

      <p className="text-xs text-warm-400">
        Drag to reorder · Click the dot to change color · Check ✓ marks the completion status
      </p>
    </div>
  )
}
