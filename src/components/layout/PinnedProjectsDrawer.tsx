import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FolderOpen, X, ChevronLeft } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useT } from '../../i18n/useT'
import { spGet } from '../../services/sharepoint'
import type { FocusItem } from '../../types/common'

// ── ลิ้นชัก "📌 โครงการ" ขอบขวาของจอ ──
// แถบจับติดขอบขวา ตรึงกลางจอ (ไม่เลื่อนตามหน้า) · กดแล้วรายการโครงการที่ปักหมุดไว้เลื่อนออกมา
// ปิดได้ด้วย ✕ · คลิกข้างนอก · Esc · หรือกดเลือกโครงการ

export function PinnedProjectsDrawer() {
  const { user } = useAppStore()
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState<FocusItem[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  const email = user?.email
  const load = useCallback(() => {
    if (!email) return
    spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${email}' and FocusType eq 'Project'`,
      'Id,Title,RefID,FocusType,PinTarget', undefined, 100)
      .then(rows => setPinned(rows.filter(r => r.PinTarget === 'Navigator')))
      .catch(() => {})
  }, [email])

  useEffect(() => { load() }, [load])

  // ปิดเมื่อคลิกข้างนอก / กด Esc
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('keydown', key) }
  }, [open])

  if (!pinned.length) return null

  return (
    <div ref={boxRef} className="no-print fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center">
      {/* แถบจับ — ตัวหนังสือแนวตั้ง */}
      {!open && (
        <button onClick={() => { load(); setOpen(true) }} title="โครงการที่ปักหมุดไว้"
          className="flex flex-col items-center gap-1 py-3 px-1.5 rounded-l-xl bg-white dark:bg-gray-900 border border-r-0 border-gray-200 dark:border-gray-700 shadow-lg text-gray-600 dark:text-gray-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
          <ChevronLeft size={14} />
          <span className="text-[11px] font-semibold [writing-mode:vertical-rl]">📌 {t('nav.pinnedProjects')}</span>
          <span className="text-[10px] min-w-[18px] text-center px-1 rounded-full bg-primary-600 text-white">{pinned.length}</span>
        </button>
      )}
      {/* ลิ้นชัก */}
      <div className={`overflow-hidden transition-[width] duration-200 ease-out ${open ? 'w-64' : 'w-0'}`}>
        <div className="w-64 max-h-[70vh] flex flex-col rounded-l-2xl bg-white dark:bg-gray-900 border border-r-0 border-gray-200 dark:border-gray-700 shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <span className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-200">📌 {t('nav.pinnedProjects')} <span className="text-gray-400 font-normal">({pinned.length})</span></span>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" aria-label="ปิด"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-1.5">
            {pinned.map(p => (
              <Link key={p.id} to={`/projects/${p.RefID}`} onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 mx-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary-600 transition-colors">
                <FolderOpen size={15} className="flex-shrink-0 text-primary-500" />
                <span className="flex-1 truncate" title={p.Title}>{p.Title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
