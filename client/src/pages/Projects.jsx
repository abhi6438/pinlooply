import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { projectsApi, tasksApi } from '../services/api'
import {
  Plus, FolderOpen, CheckSquare2, Tag, Clock,
  MoreVertical, Archive, Pencil, Loader2, Sparkles, ChevronLeft, GitBranch,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { UpgradeBanner } from '../components/shared/UpgradeGate'
import {
  PageShell, PageHeader, PageLoader, EmptyState, Modal, ModalButton,
} from '../components/ui'
import { useWorkspace } from '../context/WorkspaceContext'
import { getTemplatesForProfession, PROJECT_TEMPLATES } from '../config/projectTemplates'

const FREE_PROJECT_LIMIT = 3

// ── Confirm Modal ─────────────────────────────────────────────
function ConfirmModal({ icon: Icon = Archive, iconBg = 'bg-amber-50', iconColor = 'text-amber-500', title, message, confirmLabel = 'Confirm', confirmClass = 'bg-amber-500 text-white hover:bg-amber-600 border-amber-500', onConfirm, onCancel }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
        <h3 className="text-base font-semibold text-warm-900 text-center mb-1">{title}</h3>
        {message && <p className="text-sm text-warm-500 text-center mb-6">{message}</p>}
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="flex-1 btn btn-secondary">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 btn border ${confirmClass}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

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

// ── Template Gallery Modal ────────────────────────────────────
function TemplateGallery({ profession, onSelect, onClose }) {
  const [tab, setTab] = useState('mine')

  const profTemplates = getTemplatesForProfession(profession)
  const allTemplates  = PROJECT_TEMPLATES

  const tabs = [
    { key: 'mine', label: 'For You', templates: profTemplates },
    { key: 'all',  label: 'All',     templates: allTemplates  },
  ]
  const displayed = tabs.find(t => t.key === tab)?.templates || []

  return createPortal(
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-warm-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-500" />
            <h2 className="text-base font-semibold text-warm-900">Choose a Template</h2>
          </div>
          <button onClick={onClose} className="text-warm-400 hover:text-warm-700 text-sm">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === t.key
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-warm-500 hover:text-warm-800 hover:bg-warm-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="overflow-y-auto px-6 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
          {displayed.map(template => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="flex flex-col items-start p-4 rounded-xl border-2 border-warm-200 hover:border-primary-400 hover:bg-primary-50 text-left transition-all group"
            >
              <span className="text-2xl mb-2">{template.emoji}</span>
              <p className="text-sm font-semibold text-warm-900 group-hover:text-primary-800 leading-tight mb-1">
                {template.name}
              </p>
              <p className="text-xs text-warm-400 group-hover:text-primary-500 leading-snug">
                {template.desc}
              </p>
              {template.statuses && template.statuses.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {template.statuses.slice(0, 4).map(s => (
                    <span key={s.key} className="text-[10px] bg-warm-100 text-warm-500 px-1.5 py-0.5 rounded-full">
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-warm-100">
          <p className="text-xs text-warm-400 text-center">
            Pick a template to pre-load a status pipeline and starter tasks, or choose Blank to start empty.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Project Modal (create / edit) ─────────────────────────────
function ProjectModal({ project, template, onClose, onSave, onBack }) {
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

  const isCreate = !project

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          {isCreate && onBack && (
            <button onClick={onBack} className="text-warm-400 hover:text-warm-600 mr-1">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {isCreate && template ? (
            <span className="flex items-center gap-1.5">
              <span>{template.emoji}</span>
              <span>{template.name}</span>
            </span>
          ) : (
            project ? 'Edit Project' : 'New Project'
          )}
        </div>
      }
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
        {/* Template info banner */}
        {isCreate && template && template.id !== 'blank' && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-primary-50 border border-primary-100">
            <GitBranch className="w-3.5 h-3.5 text-primary-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary-700">Template: {template.name}</p>
              <p className="text-xs text-primary-500 mt-0.5">
                {template.statuses?.length} statuses
                {template.starter_tasks?.length > 0 ? ` · ${template.starter_tasks.length} starter tasks` : ''}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 border-2 border-white ring-2 ring-warm-200"
            style={{ background: color }} />
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder={isCreate && template ? `e.g. ${template.name}` : 'Project name'}
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

// ── Project Card ──────────────────────────────────────────────
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

// ── Main Page ─────────────────────────────────────────────────
export default function Projects() {
  const { profession } = useWorkspace()
  const [projects,      setProjects]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [modal,         setModal]         = useState(null)   // null | 'create' | project object
  const [templateStep,  setTemplateStep]  = useState(false)  // show template gallery
  const [selectedTpl,   setSelectedTpl]   = useState(null)   // chosen template
  const [upgradeMsg,    setUpgradeMsg]    = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)

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
      // Edit existing project — no template involved
      await projectsApi.update(modal.id, payload)
      toast.success('Project updated')
    } else {
      // Create new project — attach template statuses if chosen
      const createPayload = {
        ...payload,
        custom_statuses: selectedTpl && selectedTpl.id !== 'blank'
          ? selectedTpl.statuses
          : null,
      }
      let created
      try {
        const res = await projectsApi.create(createPayload)
        created = res.data?.data || res.data
        toast.success('Project created')
        setUpgradeMsg(null)
      } catch (err) {
        if (err.response?.status === 403 && err.response?.data?.upgrade) {
          setUpgradeMsg(err.response.data.message)
          setModal(null)
          setSelectedTpl(null)
          return
        }
        throw err
      }
      // Create starter tasks if template has them
      if (created?.id && selectedTpl?.starter_tasks?.length > 0) {
        try {
          await Promise.all(
            selectedTpl.starter_tasks.map((title, i) =>
              tasksApi.create({
                title,
                project_id: created.id,
                status: selectedTpl.statuses?.[0]?.key || 'todo',
              })
            )
          )
        } catch {
          // non-fatal — project was still created
        }
      }
    }
    setSelectedTpl(null)
    load()
  }

  function openCreate() {
    if (projects.length >= FREE_PROJECT_LIMIT) {
      setUpgradeMsg(`You've reached ${FREE_PROJECT_LIMIT} projects. Upgrade to Group (free) to add more.`)
      return
    }
    setTemplateStep(true)
  }

  function handleTemplateSelect(template) {
    setSelectedTpl(template)
    setTemplateStep(false)
    setModal('create')
  }

  function handleClose() {
    setModal(null)
    setSelectedTpl(null)
    setTemplateStep(false)
  }

  async function handleArchive(project) {
    setArchiveTarget(project)
  }

  async function doArchive() {
    const project = archiveTarget
    setArchiveTarget(null)
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

      {/* Template Gallery — step 1 of new project flow */}
      {templateStep && (
        <TemplateGallery
          profession={profession}
          onSelect={handleTemplateSelect}
          onClose={() => setTemplateStep(false)}
        />
      )}

      {/* Project Form — step 2 (or direct edit) */}
      {modal && (
        <ProjectModal
          project={modal !== 'create' ? modal : null}
          template={modal === 'create' ? selectedTpl : null}
          onClose={handleClose}
          onSave={handleSave}
          onBack={modal === 'create' ? () => { setModal(null); setTemplateStep(true) } : null}
        />
      )}

      {archiveTarget && (
        <ConfirmModal
          title={`Archive "${archiveTarget.name}"?`}
          message="The project will be hidden from your workspace. All data is preserved."
          confirmLabel="Archive"
          onConfirm={doArchive}
          onCancel={() => setArchiveTarget(null)}
        />
      )}
    </PageShell>
  )
}
