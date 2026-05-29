import { cn } from '../../utils/colorUtils'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary:   'bg-primary-600 hover:bg-primary-700 text-white',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200',
    danger:    'bg-red-600 hover:bg-red-700 text-white',
    ghost:     'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
    outline:   'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  }
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  )
}
