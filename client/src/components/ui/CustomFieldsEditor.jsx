// ── CustomFieldsEditor ────────────────────────────────────────
// Manages workspace-level custom task field definitions.
// Calls the API directly (not a local-only component).
// Props:
//   fields       — array of field definition objects (from server)
//   onFieldsChange — (fields) => void, called after any add/edit/delete

import { useState } from 'react'
import { Plus, Trash2, GripVertical, Type, Hash, Calendar, ChevronDown, ToggleLeft } from 'lucide-react'
import { customFieldsApi } from '../../services/api'
import toast from 'react-hot-toast'

const FIELD_TYPES = [
  { value: 'text',     label: 'Text',     icon: Type       },
  { value: 'number',   label: 'Number',   icon: Hash       },
  { value: 'date',     label: 'Date',     icon: Calendar   },
  { value: 'select',   label: 'Dropdown', icon: ChevronDown },
  { value: 'checkbox', label: 'Checkbox', icon: ToggleLeft  },
]

function typeIcon(type) {
  const t = FIELD_TYPES.find(f => f.value === type)
  const Icon = t?.icon || Type
  return <Icon className="w-3.5 h-3.5" />
}

function AddFieldForm({ onAdded, existingCount }) {
  const [label,      setLabel]      = useState('')
  const [fieldType,  setFieldType]  = useState('text')
  const [options,    setOptions]    = useState('')  // comma-separated for select
  const [saving,     setSaving]     = useState(false)

  const showOptions = fieldType === 'select'

  async function handleAdd() {
    if (!label.trim()) return toast.error('Label required')
    setSaving(true)
    try {
      // auto-generate key from label
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const optionsArr = showOptions
        ? options.split(',').map(s => s.trim()).filter(Boolean)
        : null
      const res = await customFieldsApi.create({
        key,
        label: label.trim(),
        field_type: fieldType,
        options: optionsArr?.length ? optionsArr : null,
        position: existingCount,
      })
      onAdded(res.data.data)
      setLabel('')
      setOptions('')
      setFieldType('text')
      toast.success('Field added')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add field')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-2 border-dashed border-warm-200 rounded-xl p-3 space-y-2.5 bg-warm-50/40">
      <p className="text-xs font-semibold text-warm-600">Add a field</p>
      <div className="flex gap-2">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder='e.g. "Client Name"'
          className="input py-2 text-sm flex-1"
        />
        <select
          value={fieldType}
          onChange={e => setFieldType(e.target.value)}
          className="input py-2 text-sm w-32"
        >
          {FIELD_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      {showOptions && (
        <div>
          <input
            value={options}
            onChange={e => setOptions(e.target.value)}
            placeholder="Options (comma-separated): Red, Green, Blue"
            className="input py-2 text-sm w-full"
          />
        </div>
      )}
      <button
        onClick={handleAdd}
        disabled={!label.trim() || saving}
        className="btn-primary btn-sm flex items-center gap-1.5 disabled:opacity-50"
      >
        <Plus className="w-3.5 h-3.5" />
        {saving ? 'Adding…' : 'Add Field'}
      </button>
    </div>
  )
}

export default function CustomFieldsEditor({ fields, onFieldsChange }) {
  const [deleting, setDeleting] = useState(null)

  async function handleDelete(field) {
    setDeleting(field.id)
    try {
      await customFieldsApi.delete(field.id)
      onFieldsChange(fields.filter(f => f.id !== field.id))
      toast.success('Field deleted')
    } catch {
      toast.error('Failed to delete field')
    } finally {
      setDeleting(null)
    }
  }

  function handleAdded(newField) {
    onFieldsChange([...fields, newField])
  }

  return (
    <div className="space-y-3">
      {/* Existing fields list */}
      {fields.length > 0 ? (
        <div className="space-y-1.5">
          {fields.map(field => (
            <div
              key={field.id}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-warm-200 bg-white group"
            >
              <GripVertical className="w-3.5 h-3.5 text-warm-300 flex-shrink-0" />
              <span className="text-warm-400 flex-shrink-0">{typeIcon(field.field_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-warm-900 truncate">{field.label}</p>
                <p className="text-[10px] text-warm-400 font-mono">{field.key}</p>
              </div>
              {field.options?.length > 0 && (
                <div className="hidden sm:flex gap-1 flex-wrap max-w-[150px]">
                  {field.options.slice(0, 3).map(o => (
                    <span key={o} className="text-[10px] bg-warm-100 text-warm-500 px-1.5 py-0.5 rounded-full">
                      {o}
                    </span>
                  ))}
                  {field.options.length > 3 && (
                    <span className="text-[10px] text-warm-400">+{field.options.length - 3}</span>
                  )}
                </div>
              )}
              <span className="text-[10px] text-warm-400 capitalize hidden sm:block">{field.field_type}</span>
              <button
                onClick={() => handleDelete(field)}
                disabled={deleting === field.id}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-warm-300 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-warm-400 text-center py-3">
          No custom fields yet. Add one below.
        </p>
      )}

      {/* Add new field form */}
      <AddFieldForm onAdded={handleAdded} existingCount={fields.length} />
    </div>
  )
}
