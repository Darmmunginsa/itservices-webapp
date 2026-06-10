import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  Home, Send, ClipboardList, FolderOpen, BarChart2,
  Monitor, BookOpen, FileText, Pin, Briefcase,
  ChevronRight, ChevronDown, Bug, Settings, Notebook, X, PieChart
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useT } from '../../i18n/useT'
import { spGet } from '../../services/sharepoint'
import type { FocusItem } from '../../types/common'
import { cn } from '../../utils/colorUtils'

type Role = 'EndUser' | 'Agent' | 'Supervisor' | 'Boss' | 'Admin'
interface NavItem { to: string; icon: typeof Home; key: string; roles: Role[] }
interface NavGroup { titleKey: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  { titleKey: 'group.main', items: [
    { to: '/',         icon: Home,          key: 'nav.home',     roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
    { to: '/submit',   icon: Send,          key: 'nav.submit',   roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
    { to: '/my-work',  icon: ClipboardList, key: 'nav.myWork',   roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
    { to: '/tracking', icon: Pin,           key: 'nav.tracking', roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
  ]},
  { titleKey: 'group.work', items: [
    { to: '/projects',  icon: FolderOpen, key: 'nav.projects',  roles: ['Agent','Supervisor','Boss','Admin'] },
    { to: '/dashboard', icon: BarChart2,  key: 'nav.dashboard', roles: ['Agent','Supervisor','Boss','Admin'] },
    { to: '/reports',   icon: PieChart,   key: 'nav.reports',   roles: ['Agent','Supervisor','Boss','Admin'] },
  ]},
  { titleKey: 'group.resources', items: [
    { to: '/assets',    icon: Monitor,   key: 'nav.assets',   roles: ['Agent','Supervisor','Boss','Admin'] },
    { to: '/vendors',   icon: Briefcase, key: 'nav.vendors',  roles: ['Agent','Supervisor','Boss','Admin'] },
    { to: '/tools',     icon: Notebook,  key: 'nav.tools',    roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
    { to: '/skills',    icon: BookOpen,  key: 'nav.skills',   roles: ['EndUser','Agent','Supervisor','Boss','Admin'] },
    { to: '/contracts', icon: FileText,  key: 'nav.contacts', roles: ['Admin'] },
  ]},
  { titleKey: 'group.system', items: [
    { to: '/admin', icon: Settings, key: 'nav.admin',      roles: ['Boss','Admin'] },
    { to: '/debug', icon: Bug,      key: 'nav.diagnostic', roles: ['Boss','Admin'] },
  ]},
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAppStore()
  const t = useT()
  const role = (user?.role ?? 'EndUser') as Role

  // กลุ่มที่ย่อ (เก็บใน localStorage)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('navCollapsed') || '{}') } catch { return {} }
  })
  function toggleGroup(t: string) {
    setCollapsed(prev => { const next = { ...prev, [t]: !prev[t] }; localStorage.setItem('navCollapsed', JSON.stringify(next)); return next })
  }

  // โครงการที่ Pin ไว้ที่ Navigator
  const [pinnedProjects, setPinnedProjects] = useState<FocusItem[]>([])
  useEffect(() => {
    if (!user?.email) return
    spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}' and FocusType eq 'Project'`,
      'Id,Title,RefID,FocusType,PinTarget', undefined, 100)
      .then(rows => setPinnedProjects(rows.filter(r => r.PinTarget === 'Navigator')))
      .catch(() => {})
  }, [user?.email])

  const linkCls = ({ isActive }: { isActive: boolean }) => cn(
    'flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors group',
    isActive
      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
  )

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <span className="text-primary-600 font-bold text-lg leading-tight">iT Services</span>
        <p className="text-xs text-gray-400 mt-0.5">Helpdesk & PM</p>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_GROUPS.map(group => {
          const items = group.items.filter(n => n.roles.includes(role))
          if (items.length === 0) return null
          const isCol = collapsed[group.title]
          return (
            <div key={group.titleKey} className="mb-1">
              <button onClick={() => toggleGroup(group.titleKey)}
                className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <span>{t(group.titleKey)}</span>
                <ChevronDown size={12} className={`transition-transform ${isCol ? '-rotate-90' : ''}`} />
              </button>
              {!isCol && items.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onNavigate} className={linkCls}>
                  <item.icon size={16} />
                  <span className="flex-1">{t(item.key)}</span>
                  <ChevronRight size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                </NavLink>
              ))}
            </div>
          )
        })}

        {/* โครงการที่ Pin (Navigator shortcuts) */}
        {pinnedProjects.length > 0 && (
          <div className="mb-1 mt-1 border-t border-gray-100 dark:border-gray-800 pt-2">
            <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">📌 {t('nav.pinnedProjects')}</p>
            {pinnedProjects.map(p => (
              <Link key={p.id} to={`/projects/${p.RefID}`} onClick={onNavigate}
                className="flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 transition-colors">
                <FolderOpen size={15} className="flex-shrink-0 text-primary-500" />
                <span className="flex-1 truncate">{p.Title}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{user?.displayName}</p>
          <p className="text-xs text-gray-400 truncate">{user?.role}</p>
        </div>
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
