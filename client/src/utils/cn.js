import { clsx } from 'clsx'

/**
 * Utility for conditionally joining class names.
 * Usage: cn('base-class', condition && 'conditional-class', { 'object-class': true })
 */
export function cn(...inputs) {
  return clsx(inputs)
}
