import { NavLink } from 'react-router-dom'
import {
  Home, Send, ClipboardList, FolderOpen, BarChart2,
  Monitor, BookOpen, FileText, Pin, Moon, Sun, LogOut,
  ChevronRight
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../utils/colorUtils'

const navItems = [
  { to: '/',            icon: Home,          label: 'หน้าหลัก',        roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/submit',      icon: Send,          label: 'แจ้งงาน',          roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/my-work',     icon: ClipboardList, label: 'งานของฉัน',        roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/projects',    icon: FolderOpen,    label: 'โครงการ',          roles: ['Agent','Supervisor','Boss','Admin'] },
  { to: '/dashboard',   icon: BarChart2,     label: 'Agent Dashboard',  roles: ['Agent','Supervisor','Boss','Admin'] },
  { to: '/assets',      icon: Monitor,       label: 'IT Assets',        roles: ['Agent','Supervisor','Boss','Admin'] },
  { to: '/tracking',    icon: Pin,           label: 'My Tracking',      roles: ['Boss','Admin'] },
  { to: '/skills',      icon: BookOpen,      label: 'ทักษะ',            roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/contracts',   icon: FileText,      label: 'ลูกค้า (Contracts)',roles: ['Admin'] },
]

export function Sidebar() {
  const { user, isDarkMode, toggleDarkMode } = useAppStore()
  const { logout } = useAuth()
  const role = user?.role ?? 'EndUser'

  const visible = navItems.filter(n => n.roles.includes(role))

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-40 hidden md:flex">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <span className="text-primary-600 font-bold text-lg leading-tight">iT Services</span>
        <p className="text-xs text-gray-400 mt-0.5">Helpdesk & PM</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {visible.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors group',
              isActive
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
            )}
          >
            <item.icon size={16} />
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{user?.displayName}</p>
          <p className="text-xs text-gray-400 truncate">{user?.role}</p>
        </div>
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
        >
          <LogOut size={16} />
          ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
