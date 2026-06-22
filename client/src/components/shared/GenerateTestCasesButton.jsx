import { useNavigate } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'

/**
 * Reusable "Generate Test Cases" button.
 * Place on any task card or topic detail page.
 *
 * Props:
 *   taskId   (string)  — pre-fills the generator with this task
 *   label    (string)  — button text, default "Generate Tests"
 *   size     ('sm'|'md') — controls padding/text size
 *   variant  ('outline'|'ghost') — visual style
 */
export default function GenerateTestCasesButton({
  taskId,
  label = 'Generate Tests',
  size = 'sm',
  variant = 'outline',
}) {
  const navigate = useNavigate()

  function handleClick(e) {
    e.stopPropagation() // don't bubble to parent card clicks
    if (taskId) {
      navigate(`/test-cases/${taskId}`)
    } else {
      navigate('/test-cases')
    }
  }

  const sizeClass = size === 'sm'
    ? 'text-xs px-2 py-1 gap-1'
    : 'text-sm px-3 py-1.5 gap-1.5'

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  const variantClass = variant === 'ghost'
    ? 'text-indigo-600 hover:bg-indigo-50'
    : 'border border-indigo-200 text-indigo-600 bg-white hover:bg-indigo-50'

  return (
    <button
      onClick={handleClick}
      title="Generate test cases for this task"
      className={`flex items-center rounded-lg font-medium transition-colors flex-shrink-0 ${sizeClass} ${variantClass}`}
    >
      <FlaskConical className={iconSize} />
      🧪 {label}
    </button>
  )
}
