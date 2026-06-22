export default function PageToolbar({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 mb-6 ${className}`}>
      {children}
    </div>
  )
}
