import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../services/api'
import {
  Plus, FolderOpen, CheckSquare2, Tag, Clock,
  MoreVertical, Archive, Pencil, X, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────────
const COLORS = [
  '#6366f1', '#2563eb', '#0d9488', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#7c3aed',
]

const HEALTH = {
  good:    { label: 'Good',    dot: 'bg-green-500',  text: 'text-green-600',  bg: 'bg-green-50'  },
  at_risk: { label: 'At Risk', dot: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50' },
  behind:  { label: 'Behind',  dot: 'bg-red-500',    text: 'text-red-600',    bg: 'bg-red-50'    },
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso)
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Project Modal ─────────────────────────────────────────────────
function ProjectModal({ project, onClose, onSave }) {
  const [name,        setName]        = useState(project?.name        || '')
  const [description, setDescription] = useState(project?.description || '')
  const [color,       setColor]       = useState(project?.color       || COLORS[0])
  const [saving,      setSaving]      = useState(false)

  async function handleSave() {
    if (!name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      await onSave({ name, description, color })
      onClose()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {project ? 'Edit Project' : 'New Project'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Color + Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex-shrink-0 border-2 border-white ring-2 ring-gray-200"
              style={{ background: color }} />
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Project name"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Description */}
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />

          {/* Color picker */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Color</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {project ? 'Save Changes' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Project Card ──────────────────────────────────────────────────
function ProjectCard({ project, onEdit, onArchive }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const health = HEALTH[project.health] ?? HEALTH.good

  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ background: project.color }} />

      <div className="p-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: project.color + '22' }}>
              <FolderOpen className="w-4 h-4" style={{ color: project.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{project.description}</p>
              )}
            </div>
          </div>

          {/* Menu */}
          <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(project) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onArchive(project) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Health badge */}
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mb-4 ${health.bg} ${health.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
          {health.label}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <CheckSquare2 className="w-3.5 h-3.5" />
            {project.pending_tasks} tasks
          </span>
          <span className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" />
            {project.topics_count} topics
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            {timeAgo(project.last_activity)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null) // null | 'create' | project object

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await projectsApi.list()
      setProjects(res.data.data || [])
    } catch { toast.error('Failed to load projects') }
    finally { setLoading(false) }
  }

  async function handleSave(payload) {
    if (modal && modal !== 'create') {
      // Edit
      await projectsApi.update(modal.id, payload)
      toast.success('Project updated')
    } else {
      // Create
      await projectsApi.create(payload)
      toast.success('Project created')
    }
    load()
  }

  async function handleArchive(project) {
    if (!confirm(`Archive "${project.name}"? It will be hidden from your workspace.`)) return
    try {
      await projectsApi.archive(project.id)
      toast.success('Project archived')
      load()
    } catch { toast.error('Failed to archive') }
  }

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
          <p className="text-xs text-gray-400 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium text-gray-500">No projects yet</p>
          <p className="text-xs mt-1">Create your first project to get started</p>
          <button
            onClick={() => setModal('create')}
            className="mt-4 text-sm text-indigo-500 hover:underline"
          >
            + Create project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p}
              onEdit={setModal}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ProjectModal
          project={modal !== 'create' ? modal : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
