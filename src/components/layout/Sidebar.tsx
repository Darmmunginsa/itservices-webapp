import { NavLink } from 'react-router-dom'
import {
  Home, Send, ClipboardList, FolderOpen, BarChart2,
  Monitor, BookOpen, FileText, Pin, Moon, Sun, LogOut,
  ChevronRight, Bug, Settings, Notebook, X, PieChart
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { AccentColor } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../utils/colorUtils'

const navItems = [
  { to: '/',            icon: Home,          label: 'หน้าหลัก',           roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/submit',      icon: Send,          label: 'แจ้งงาน',             roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/my-work',     icon: ClipboardList, label: 'งานของฉัน',           roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/projects',    icon: FolderOpen,    label: 'โครงการ',             roles: ['Agent','Supervisor','Boss','Admin'] },
  { to: '/dashboard',   icon: BarChart2,     label: 'Agent Dashboard',     roles: ['Agent','Supervisor','Boss','Admin'] },
  { to: '/reports',     icon: PieChart,      label: 'รายงาน (Reports)',    roles: ['Agent','Supervisor','Boss','Admin'] },
  { to: '/assets',      icon: Monitor,       label: 'IT Assets',           roles: ['Agent','Supervisor','Boss','Admin'] },
  { to: '/tracking',    icon: Pin,           label: 'My Tracking',         roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/skills',      icon: BookOpen,      label: 'ทักษะ',               roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/tools',       icon: Notebook,      label: 'Tools & Notes',       roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  { to: '/contracts',   icon: FileText,      label: 'ลูกค้า (Contracts)',  roles: ['Admin'] },
  { to: '/admin',       icon: Settings,      label: 'Admin',               roles: ['Boss','Admin'] },
  { to: '/debug',       icon: Bug,           label: 'Diagnostic',          roles: ['Boss','Admin'] },
]

const ACCENT_OPTIONS: { value: AccentColor; bg: string; label: string }[] = [
  { value: 'blue',   bg: '#0F4C81', label: 'Blue'   },
  { value: 'teal',   bg: '#0d9488', label: 'Teal'   },
  { value: 'violet', bg: '#7c3aed', label: 'Violet' },
  { value: 'rose',   bg: '#e11d48', label: 'Rose'   },
  { value: 'amber',  bg: '#d97706', label: 'Amber'  },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, isDarkMode, toggleDarkMode, accentColor, setAccentColor, customAccent, customBg, setCustomAccent, setCustomBg, cardBg, cardOpacity, setCardStyle } = useAppStore()
  const { logout } = useAuth()
  const role = user?.role ?? 'EndUser'
  const visible = navItems.filter(n => n.roles.includes(role))

  return (
    <div className="flex flex-col h-full">
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
            onClick={onNavigate}
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

        {/* Accent color picker */}
        <div className="px-3 py-2">
          <p className="text-[10px] text-gray-400 mb-1.5">สีธีม</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {ACCENT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                title={opt.label}
                onClick={() => { setCustomAccent(null); setAccentColor(opt.value) }}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                style={{ backgroundColor: opt.bg, boxShadow: (!customAccent && accentColor === opt.value) ? `0 0 0 2px white, 0 0 0 3px ${opt.bg}` : undefined }}
              />
            ))}
            {/* Free accent picker */}
            <label title="เลือกสีเอง" className="relative w-5 h-5 rounded-full cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600"
              style={{ background: customAccent ?? 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' }}>
              <input type="color" value={customAccent ?? '#0F4C81'} onChange={e => setCustomAccent(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>

          {/* Background picker */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-400">พื้นหลัง</span>
            <label title="เลือกสีพื้นหลัง" className="relative w-5 h-5 rounded cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600"
              style={{ background: customBg ?? '#f8fafc' }}>
              <input type="color" value={customBg ?? '#f8fafc'} onChange={e => setCustomBg(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
            {(customAccent || customBg) && (
              <button onClick={() => { setCustomAccent(null); setCustomBg(null) }}
                className="text-[10px] text-gray-400 hover:text-red-500 underline">รีเซ็ต</button>
            )}
          </div>

          {/* Card / panel style */}
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">การ์ด</span>
              <label title="สีพื้นหลังการ์ด" className="relative w-5 h-5 rounded cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600"
                style={{ background: cardBg ?? '#ffffff' }}>
                <input type="color" value={cardBg ?? '#ffffff'} onChange={e => setCardStyle(e.target.value, cardOpacity)}
                  className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              {cardBg && (
                <button onClick={() => setCardStyle(null, 100)} className="text-[10px] text-gray-400 hover:text-red-500 underline">รีเซ็ต</button>
              )}
            </div>
            {cardBg && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-9">ทึบ</span>
                <input type="range" min={20} max={100} value={cardOpacity}
                  onChange={e => setCardStyle(cardBg, Number(e.target.value))}
                  className="flex-1 accent-primary-600 h-1" />
                <span className="text-[10px] text-gray-400 w-7 text-right">{cardOpacity}%</span>
              </div>
            )}
          </div>
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
    </div>
  )
}

export function Sidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useAppStore()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 h-full w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-40 hidden md:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          {/* Drawer */}
          <div className="relative w-64 bg-white dark:bg-gray-900 h-full flex flex-col shadow-xl">
            <button
              onClick={() => setMobileNavOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}
