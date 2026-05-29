import { Bell, Menu } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

interface HeaderProps {
  title: string
  onMenuClick?: () => void
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const { user } = useAppStore()

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center gap-3">
      <button
        onClick={onMenuClick}
        className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Menu size={20} />
      </button>
      <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex-1">{title}</h1>
      <div className="flex items-center gap-2">
        <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          <Bell size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold">
          {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
        </div>
      </div>
    </header>
  )
}
