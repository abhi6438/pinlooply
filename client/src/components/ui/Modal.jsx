import { X } from 'lucide-react'
import { Loader2 } from 'lucide-react'

export default function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
          <h2 className="text-base font-semibold text-warm-900">{title}</h2>
          <button onClick={onClose} className="text-warm-400 hover:text-warm-600 p-1 rounded-lg hover:bg-warm-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-warm-200 bg-warm-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ModalButton({ variant = 'secondary', loading, disabled, children, ...props }) {
  const cls = variant === 'primary' ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'
  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
}
