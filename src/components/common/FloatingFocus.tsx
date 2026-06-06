import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Pin, X, ChevronRight } from 'lucide-react'
import { spGet } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import type { FocusItem } from '../../types/common'
import { getStatusColor } from '../../utils/colorUtils'
import { formatDate, getDueDateColor, getDueDateEmoji } from '../../utils/dateUtils'

const TYPE_ICON: Record<string, string> = {
  Ticket: '🎫',
  Task:   '✅',
  Project:'📁',
}

export function FloatingFocus() {
  const { user } = useAppStore()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<FocusItem[]>([])
  const ref = useRef<HTMLDivElement>(null)

  // โหลด Focus Items
  function load() {
    if (!user?.email) return
    spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}'`,
      'Id,Title,RefID,FocusType,FocusedEmail,FocusedBy,DueDate,Status,SortOrder',
      'SortOrder asc', 50)
      .then(setItems).catch(() => {})
  }

  useEffect(() => { load() }, [user?.email])

  // รีโหลดทุกครั้งที่ navigate (กลับมาหน้าใหม่อาจ pin เพิ่ม)
  useEffect(() => { load() }, [location.pathname])

  // ปิดเมื่อคลิกนอก
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  if (!user || items.length === 0) return null

  return (
    <div ref={ref} className="fixed bottom-[5.5rem] right-3 md:bottom-20 md:right-4 z-50">
      {/* Popup panel */}
      {open && (
        <div className="absolute bottom-12 right-0 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Pin size={14} className="text-primary-600" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Focus Items</span>
              <span className="text-[10px] bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full font-medium">{items.length}</span>
            </div>
            <button onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors">
              <X size={13} />
            </button>
          </div>

          {/* Items */}
          <div className="max-h-80 overflow-y-auto">
            {items.map(f => {
              const color = getDueDateColor(f.DueDate)
              const to = f.FocusType === 'Ticket' ? `/tickets/${f.RefID}` : `/projects/${f.RefID}`
              const isActive = location.pathname === to
              return (
                <Link key={f.id} to={to} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors group
                    ${isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}`}>
                  <span className="text-base flex-shrink-0">{getDueDateEmoji(color) || TYPE_ICON[f.FocusType] || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-200'}`}>
                      {f.Title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-400">{f.FocusType}</span>
                      {f.DueDate && <span className="text-[10px] text-gray-400">· {formatDate(f.DueDate)}</span>}
                      <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${getStatusColor(f.Status)}`}>{f.Status}</span>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-gray-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                </Link>
              )
            })}
          </div>

          {/* Footer */}
          <Link to="/" onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-t border-gray-100 dark:border-gray-800 font-medium">
            ดูทั้งหมดที่ Focus Items
          </Link>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Focus Items"
        className={`relative flex items-center justify-center w-11 h-11 rounded-full shadow-lg border transition-all duration-200
          ${open
            ? 'bg-primary-600 border-primary-500 text-white scale-95'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-primary-600 hover:shadow-xl hover:scale-105'}`}>
        <Pin size={18} className={open ? 'rotate-45 transition-transform' : 'transition-transform'} />
        {/* Badge */}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[1.1rem] min-h-[1.1rem] flex items-center justify-center text-[9px] font-bold bg-primary-600 text-white rounded-full border border-white dark:border-gray-900 leading-none px-1">
            {items.length}
          </span>
        )}
      </button>
    </div>
  )
}
