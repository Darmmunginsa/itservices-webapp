import { NavLink } from 'react-router-dom'
import { cn } from '../../utils/colorUtils'
import { useT } from '../../i18n/useT'
import { useAppStore } from '../../store/useAppStore'
import { PAGE_BY_KEY } from '../../config/pages'

// เมนูล่าง (มือถือ) — แสดงตามลำดับนี้ เฉพาะหน้าที่ผู้ใช้มีสิทธิ์
const BOTTOM_KEYS = ['home', 'submit', 'my-work', 'projects', 'dashboard']

export function BottomNav() {
  const tr = useT()
  const { allowedPages } = useAppStore()
  const items = BOTTOM_KEYS
    .map(k => PAGE_BY_KEY.get(k))
    .filter((p): p is NonNullable<typeof p> => !!p && (allowedPages?.has(p.key) ?? false))

  if (items.length === 0) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex md:hidden z-40">
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) => cn(
            'flex-1 flex flex-col items-center py-2 text-xs transition-colors',
            isActive
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-500 dark:text-gray-400'
          )}
        >
          <item.icon size={20} />
          <span className="mt-0.5">{tr(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
