import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../services/api'
import {
  Plus, FolderOpen, CheckSquare2, Tag, Clock,
  MoreVertical, Archive, Pencil, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { UpgradeBanner } from '../components/shared/UpgradeGate'
import {
  PageShell, PageHeader, PageLoader, EmptyState, Modal, ModalButton,
} from '../components/ui'

const FREE_PROJECT_LIMIT = 3

const COLORS = [
  '#7C3AED', '#2563eb', '#0d9488', '#16a34a',
  '#ca8a04', '#ea580c', '#dc2626', '#6366f1',
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
    <Modal
      title={project ? 'Edit Project' : 'New Project'}
      onClose={onClose}
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton variant="primary" onClick={handleSave} loading={saving} disabled={!name.trim()}>
            {project ? 'Save Changes' : 'Create Project'}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 border-2 border-white ring-2 ring-warm-200"
            style={{ background: color }} />
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Project name"
            className="input flex-1"
          />
        </div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="input resize-none"
        />
        <div>
          <p className="label">Color</p>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-primary-400 scale-110' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ProjectCard({ project, onEdit, onArchive }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const health = HEALTH[project.health] ?? HEALTH.good

  return (
    <div
      className="card card-hover p-0 overflow-hidden group"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="h-1.5 w-full" style={{ background: project.color }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: project.color + '22' }}>
              <FolderOpen className="w-4 h-4" style={{ color: project.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-warm-900 truncate">{project.name}</h3>
              {project.description && (
                <p className="text-xs text-warm-400 truncate mt-0.5">{project.description}</p>
              )}
            </div>
          </div>
          <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-warm-400 hover:text-warm-600 hover:bg-warm-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 w-36 bg-white border border-warm-200 rounded-xl shadow-lg z-10 py-1">
                <button
                  onClick={() => { setMenuOpen(false); onEdit(project) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-warm-700 hover:bg-warm-50"
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
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mb-4 ${health.bg} ${health.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
          {health.label}
        </div>
        <div className="flex items-center gap-4 text-xs text-warm-500">
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

export default function Projects() {
  const [projects,   setProjects]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null)
  const [upgradeMsg, setUpgradeMsg] = useState(null)

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
      await projectsApi.update(modal.id, payload)
      toast.success('Project updated')
    } else {
      try {
        await projectsApi.create(payload)
        toast.success('Project created')
        setUpgradeMsg(null)
      } catch (err) {
        if (err.response?.status === 403 && err.response?.data?.upgrade) {
          setUpgradeMsg(err.response.data.message)
          setModal(null)
          return
        }
        throw err
      }
    }
    load()
  }

  function openCreate() {
    if (projects.length >= FREE_PROJECT_LIMIT) {
      setUpgradeMsg(`You've reached ${FREE_PROJECT_LIMIT} projects. Upgrade to Group (free) to add more.`)
      return
    }
    setModal('create')
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
    <PageShell>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        actions={
          <button onClick={openCreate} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" /> New Project
          </button>
        }
      />

      {upgradeMsg && (
        <div className="mb-4">
          <UpgradeBanner message={upgradeMsg} plan="group_free" onDismiss={() => setUpgradeMsg(null)} />
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="w-12 h-12" />}
          title="No projects yet"
          subtitle="Create your first project to get started"
          action={
            <button onClick={openCreate} className="btn-primary btn-sm mt-4">
              <Plus className="w-4 h-4" /> Create project
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} onEdit={setModal} onArchive={handleArchive} />
          ))}
        </div>
      )}

      {modal && (
        <ProjectModal
          project={modal !== 'create' ? modal : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </PageShell>
  )
}
