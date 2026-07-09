export default function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-warm-900">{title}</h1>
        {subtitle && <p className="text-xs text-warm-400 mt-0.5">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
