export default function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-warm-900">{title}</h1>
        {subtitle && <p className="text-sm text-warm-500 mt-1">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
