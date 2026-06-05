import { cn } from '../../utils/colorUtils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      style={{ background: 'var(--card-bg)', backdropFilter: 'var(--card-blur)' }}
      className={cn('bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

export function CardTitle({ children, className }: CardProps) {
  return <h3 className={cn('text-base font-semibold text-gray-900 dark:text-gray-100', className)}>{children}</h3>
}
