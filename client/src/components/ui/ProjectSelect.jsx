import { ChevronDown } from 'lucide-react'

export default function ProjectSelect({
  value,
  onChange,
  projects,
  showAll = false,
  allLabel = 'All Projects',
  className = '',
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input py-2 text-sm pr-8 appearance-none min-w-[140px]"
      >
        {showAll && <option value="">{allLabel}</option>}
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-400 pointer-events-none" />
    </div>
  )
}
