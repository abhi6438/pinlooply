import { Loader2 } from 'lucide-react'

export default function PageLoader({ className = 'py-20' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
    </div>
  )
}
