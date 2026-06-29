import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useWorkspace } from '../../context/WorkspaceContext'
import { PROFESSIONS, DEFAULT_VOCABULARY, getProfession } from '../../config/professions'
import { StatusPipelineEditor, CustomFieldsEditor } from '../../components/ui'
import { Loader2, Save, CheckCheck, LayoutDashboard, FolderOpen, ListChecks,
         CalendarDays, Tag, ClipboardList, BarChart3, FlaskConical, Wand2, GitBranch, SlidersHorizontal, Palette } from 'lucide-react'
import toast from 'react-hot-toast'
import { customFieldsApi } from '../../services/api'

const MODULE_LIST = [
  { key: 'projects',  icon: FolderOpen,    defaultLabel: 'Projects'   },
  { key: 'tasks',     icon: ListChecks,    defaultLabel: 'Tasks'      },
  { key: 'timeline',  icon: CalendarDays,  defaultLabel: 'Timeline'   },
  { key: 'topics',    icon: Tag,           defaultLabel: 'Topics'     },
  { key: 'standup',   icon: ClipboardList, defaultLabel: 'Standup'    },
  { key: 'summary',   icon: BarChart3,     defaultLabel: 'Summary'    },
  { key: 'testcases', icon: FlaskConical,  defaultLabel: 'Test Cases' },
]

const VOCAB_FIELDS = [
  { key: 'tasks',       label: 'Tasks menu item'       },
  { key: 'discussions', label: 'Notes/discussions'     },
  { key: 'topics',      label: 'Topics menu item'      },
  { key: 'projects',    label: 'Projects menu item'    },
  { key: 'standup',     label: 'Standup menu item'     },
  { key: 'summary',     label: 'Summary menu item'     },
  { key: 'testcases',   label: 'Test Cases menu item'  },
  { key: 'logAction',   label: '"Log" button label'    },
]

function SettingsNav() {
  const { pathname } = useLocation()
  const tabs = [
    { to: '/settings/plan',        label: 'Plan & Billing' },
    { to: '/settings/workspace',   label: 'Workspace'      },
    { to: '/settings/automations', label: 'Automations'    },
  ]
  return (
    <div className="flex gap-1 mb-6 bg-warm-100 p-1 rounded-xl w-fit">
      {tabs.map(t => (
        <Link
          key={t.to}
          to={t.to}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            pathname === t.to
              ? 'bg-white text-primary-700 shadow-sm font-semibold'
              : 'text-warm-500 hover:text-warm-800'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}

export default function WorkspaceSettings() {
  const { profession, rawVocab, enabledModules, customStatuses, workspaceName, accentColor, saveWorkspace, getEffectiveStatuses } = useWorkspace()

  const [localProfession,     setLocalProfession]     = useState(profession)
  const [localVocab,          setLocalVocab]          = useState({})
  const [localModules,        setLocalModules]        = useState([])
  const [localStatuses,       setLocalStatuses]       = useState([])
  const [localWorkspaceName,  setLocalWorkspaceName]  = useState('')
  const [saving,              setSaving]              = useState(false)
  const [saved,               setSaved]               = useState(false)
  const [localAccentColor,    setLocalAccentColor]    = useState('')
  const [customFields,        setCustomFields]        = useState([])
  const [fieldsLoading,       setFieldsLoading]       = useState(true)

  // Sync from context on mount / context change
  useEffect(() => {
    setLocalProfession(profession)
    setLocalVocab(rawVocab || {})
    setLocalModules(enabledModules || [])
    setLocalStatuses(getEffectiveStatuses(null))
    setLocalWorkspaceName(workspaceName || '')
    setLocalAccentColor(accentColor || '')
  }, [profession, rawVocab, enabledModules, customStatuses, workspaceName, accentColor])

  // Load custom fields on mount
  useEffect(() => {
    customFieldsApi.list()
      .then(res => setCustomFields(res.data.data || []))
      .catch(() => {})
      .finally(() => setFieldsLoading(false))
  }, [])

  // When profession changes, pre-fill vocabulary with profession defaults
  function handleProfessionChange(p) {
    setLocalProfession(p)
    const prof = getProfession(p)
    if (prof) {
      setLocalVocab({})
      setLocalModules(prof.modules || [])
      setLocalStatuses(prof.defaultStatuses || getEffectiveStatuses(null))
    }
  }

  function setVocabField(key, value) {
    setLocalVocab(v => ({ ...v, [key]: value }))
  }

  function toggleModule(key) {
    setLocalModules(m =>
      m.includes(key) ? m.filter(x => x !== key) : [...m, key]
    )
  }

  // Placeholder for a vocab field = profession default
  function vocabPlaceholder(key) {
    const prof = PROFESSIONS.find(p => p.value === localProfession)
    return prof?.vocabulary?.[key] || DEFAULT_VOCABULARY[key] || key
  }

  async function handleSave() {
    setSaving(true)
    try {
      await saveWorkspace({
        profession:      localProfession,
        vocabulary:      localVocab,
        enabled_modules: localModules,
        custom_statuses: localStatuses,
        workspace_name:  localWorkspaceName || null,
        accent_color:    localAccentColor   || null,
      })
      setSaved(true)
      toast.success('Workspace settings saved!')
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const selectedProf = PROFESSIONS.find(p => p.value === localProfession)

  return (
    <div className="px-6 py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-warm-900">Settings</h1>
        <p className="text-sm text-warm-500 mt-1">Manage your plan and workspace.</p>
      </div>
      <SettingsNav />
      <div className="space-y-8">

      {/* ── Workspace name ──────────────────────────────── */}
      <div className="card p-5">
        <h2 className="section-title mb-4">Workspace Name</h2>
        <div>
          <label className="label">Name shown in sidebar</label>
          <input
            type="text"
            value={localWorkspaceName}
            onChange={e => setLocalWorkspaceName(e.target.value)}
            placeholder="Pinlooply"
            maxLength={40}
            className="input"
          />
          <p className="text-xs text-warm-400 mt-1.5">Leave blank to keep "Pinlooply"</p>
        </div>
      </div>

      {/* ── Profession ──────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wand2 className="w-4 h-4 text-primary-500" />
          <h2 className="section-title">Profession</h2>
        </div>
        <p className="text-xs text-warm-500 mb-4">Choosing a profession auto-fills the vocabulary and module defaults below.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {PROFESSIONS.map(p => (
            <button
              key={p.value}
              onClick={() => handleProfessionChange(p.value)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                localProfession === p.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-warm-200 hover:border-warm-300 bg-white'
              }`}
            >
              <span className="text-xl">{p.emoji}</span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${localProfession === p.value ? 'text-primary-700' : 'text-warm-900'}`}>
                  {p.label}
                </p>
              </div>
            </button>
          ))}
        </div>
        {selectedProf && (
          <p className="text-xs text-warm-400 mt-3">
            Current: <strong className="text-warm-700">{selectedProf.emoji} {selectedProf.label}</strong> — {selectedProf.desc}
          </p>
        )}
      </div>

      {/* ── Vocabulary ──────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="section-title mb-1">Vocabulary</h2>
        <p className="text-xs text-warm-500 mb-4">Rename labels throughout the app to match your workflow. Leave blank to use profession defaults.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VOCAB_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="label text-[11px]">{label}</label>
              <input
                type="text"
                value={localVocab[key] || ''}
                onChange={e => setVocabField(key, e.target.value)}
                placeholder={vocabPlaceholder(key)}
                className="input py-2 text-sm"
                maxLength={30}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-warm-400 mt-3">Placeholder text = current profession default. Type to override.</p>
      </div>

      {/* ── Modules ─────────────────────────────────────── */}
      <div className="card p-5">
        <h2 className="section-title mb-1">Visible Modules</h2>
        <p className="text-xs text-warm-500 mb-4">Hide sections you don't need — they disappear from the sidebar.</p>
        <div className="space-y-2">
          {/* Dashboard always on */}
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-warm-50 border border-warm-100 opacity-50">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-4 h-4 text-warm-400" />
              <span className="text-sm text-warm-700 font-medium">Dashboard</span>
            </div>
            <span className="text-xs text-warm-400">Always on</span>
          </div>
          {MODULE_LIST.map(({ key, icon: Icon, defaultLabel }) => {
            const isOn   = localModules.includes(key)
            const vocLabel = localVocab[key] || vocabPlaceholder(key) || defaultLabel
            return (
              <div
                key={key}
                onClick={() => toggleModule(key)}
                className={`flex items-center justify-between py-2.5 px-3 rounded-xl border-2 cursor-pointer transition-all ${
                  isOn ? 'border-primary-200 bg-primary-50' : 'border-warm-200 bg-white hover:border-warm-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isOn ? 'text-primary-500' : 'text-warm-400'}`} />
                  <span className={`text-sm font-medium ${isOn ? 'text-primary-800' : 'text-warm-500'}`}>
                    {vocLabel}
                  </span>
                </div>
                {/* Toggle */}
                <div className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${isOn ? 'bg-primary-500' : 'bg-warm-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Status Pipeline ──────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch className="w-4 h-4 text-primary-500" />
          <h2 className="section-title">Status Pipeline</h2>
        </div>
        <p className="text-xs text-warm-500 mb-4">
          Define the stages tasks move through. The last stage is the completion status.
          Individual projects can override this with their own pipeline.
        </p>
        <StatusPipelineEditor
          statuses={localStatuses}
          onChange={setLocalStatuses}
        />
      </div>

      {/* ── Custom Fields ────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <SlidersHorizontal className="w-4 h-4 text-primary-500" />
          <h2 className="section-title">Custom Task Fields</h2>
        </div>
        <p className="text-xs text-warm-500 mb-4">
          Add extra fields to every task — text, numbers, dates, dropdowns, or checkboxes.
          Values are set per-task in the task detail panel.
        </p>
        {fieldsLoading ? (
          <div className="flex items-center gap-2 text-xs text-warm-400 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading fields…
          </div>
        ) : (
          <CustomFieldsEditor
            fields={customFields}
            onFieldsChange={setCustomFields}
          />
        )}
      </div>

      {/* ── Branding ─────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-primary-500" />
          <h2 className="section-title">Branding</h2>
        </div>
        <p className="text-xs text-warm-500 mb-4">
          Set an accent color to personalize buttons, highlights, and sidebar accents across your workspace.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Preset swatches */}
          {['#7C3AED','#2563eb','#0d9488','#16a34a','#ca8a04','#ea580c','#dc2626','#6366f1','#ec4899'].map(hex => (
            <button
              key={hex}
              onClick={() => setLocalAccentColor(localAccentColor === hex ? '' : hex)}
              className={`w-8 h-8 rounded-full transition-transform hover:scale-110 flex-shrink-0 ${
                localAccentColor === hex ? 'ring-2 ring-offset-2 ring-warm-400 scale-110' : ''
              }`}
              style={{ background: hex }}
              title={hex}
            />
          ))}
          {/* Custom color input */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={localAccentColor || '#7C3AED'}
              onChange={e => setLocalAccentColor(e.target.value)}
              className="w-8 h-8 rounded-full border-2 border-warm-200 cursor-pointer p-0 overflow-hidden"
              title="Custom color"
            />
            <span className="text-xs text-warm-400 font-mono">{localAccentColor || 'default'}</span>
            {localAccentColor && (
              <button
                onClick={() => setLocalAccentColor('')}
                className="text-xs text-warm-400 hover:text-warm-700 underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>
        {localAccentColor && (
          <div className="mt-3 p-3 rounded-xl border border-warm-100 bg-warm-50">
            <p className="text-xs text-warm-500 mb-2">Preview</p>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: localAccentColor }}>
                Button
              </div>
              <div className="px-3 py-1.5 rounded-lg text-xs font-semibold border-2" style={{ color: localAccentColor, borderColor: localAccentColor }}>
                Outlined
              </div>
              <span className="text-xs font-medium" style={{ color: localAccentColor }}>Link text</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Save ─────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
          saved ? 'bg-emerald-600 text-white' : 'btn-primary'
        } disabled:opacity-50`}
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
        : saved  ? <><CheckCheck className="w-4 h-4" /> Saved!</>
        :           <><Save className="w-4 h-4" /> Save Changes</>}
      </button>
      </div>
    </div>
  )
}
