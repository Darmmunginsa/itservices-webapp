import { NavLink } from 'react-router-dom'
import { Home, Send, ClipboardList, FolderOpen, BarChart2 } from 'lucide-react'
import { cn } from '../../utils/colorUtils'

const items = [
  { to: '/',         icon: Home,          label: 'หน้าหลัก' },
  { to: '/submit',   icon: Send,          label: 'แจ้งงาน' },
  { to: '/my-work',  icon: ClipboardList, label: 'งานของฉัน' },
  { to: '/projects', icon: FolderOpen,    label: 'โครงการ' },
  { to: '/dashboard',icon: BarChart2,     label: 'Dashboard' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex md:hidden z-40">
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => cn(
            'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
            isActive
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          )}
        >
          <item.icon size={20} />
          <span className="mt-0.5">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
