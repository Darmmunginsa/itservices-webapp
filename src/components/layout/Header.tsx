import { Bell, Menu, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { ProfileMenu } from './ProfileMenu'

interface HeaderProps {
  title: string
  backTo?: string      // route to go back to
  backLabel?: string   // breadcrumb parent label
}

export function Header({ title, backTo, backLabel }: HeaderProps) {
  const { setMobileNavOpen } = useAppStore()

  return (
    <header className="sticky top-0 z-[29] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 px-4 md:px-6 py-3 flex items-center gap-3">
      <button
        onClick={() => setMobileNavOpen(true)}
        className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Menu size={20} />
      </button>
      {backTo && (
        <Link to={backTo} title="กลับ"
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-primary-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
      )}
      <div className="flex-1 min-w-0">
        {backTo && backLabel && (
          <Link to={backTo} className="text-xs text-gray-400 hover:text-primary-600 transition-colors">{backLabel}</Link>
        )}
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          <Bell size={18} />
        </button>
        <ProfileMenu />
      </div>
    </header>
  )
}
