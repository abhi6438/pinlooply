export default function FilterPills({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`tab-pill ${value === opt.value ? 'active' : 'inactive'}`}
        >
          {opt.icon && <opt.icon className="w-3.5 h-3.5" />}
          {opt.label}
          {opt.count != null && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${
              value === opt.value ? 'bg-white/20 text-white' : 'bg-warm-100 text-warm-500'
            }`}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
