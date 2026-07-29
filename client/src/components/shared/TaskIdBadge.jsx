import toast from 'react-hot-toast'

export function getProjectPrefix(projectName) {
  if (!projectName) return 'TSK'
  const words = projectName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 4)
}

export default function TaskIdBadge({ taskNumber, projectName, className = '' }) {
  if (!taskNumber) return null
  const prefix = getProjectPrefix(projectName)
  const id = `${prefix}-${taskNumber}`

  function copy(e) {
    e.stopPropagation()
    navigator.clipboard?.writeText(id).catch(() => {})
    toast.success(`Copied ${id}`, { duration: 1500 })
  }

  return (
    <button
      onClick={copy}
      title={`Task ID: ${id} — click to copy`}
      className={`inline-flex items-center font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-warm-100 text-warm-500 hover:bg-primary-100 hover:text-primary-600 transition-colors select-none ${className}`}
    >
      {id}
    </button>
  )
}
