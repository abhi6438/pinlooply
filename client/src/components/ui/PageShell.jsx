export default function PageShell({ children, className = '' }) {
  return (
    <div className={`page-shell animate-fade-in ${className}`}>
      {children}
    </div>
  )
}
