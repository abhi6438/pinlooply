export default function SectionTabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-warm-200 mb-6 overflow-x-auto">
      {tabs.map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`section-tab ${value === key ? 'active' : ''}`}
        >
          {Icon && <Icon className="w-4 h-4" />}
          {label}
        </button>
      ))}
    </div>
  )
}
