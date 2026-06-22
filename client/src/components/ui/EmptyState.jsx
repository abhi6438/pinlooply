export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      {icon && (
        typeof icon === 'string'
          ? <div className="empty-state-icon">{icon}</div>
          : <div className="mb-4 text-warm-300">{icon}</div>
      )}
      <p className="empty-state-title">{title}</p>
      {subtitle && <p className="empty-state-sub">{subtitle}</p>}
      {action}
    </div>
  )
}
