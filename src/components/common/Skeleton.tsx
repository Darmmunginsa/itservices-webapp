import { cn } from '../../utils/colorUtils'

interface SkeletonProps { className?: string }

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-gray-800', className)} />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  )
}
