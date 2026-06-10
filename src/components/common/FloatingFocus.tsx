import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Pin, X, ChevronRight, GripVertical } from 'lucide-react'
import { spGet } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import type { FocusItem } from '../../types/common'
import { getStatusColor } from '../../utils/colorUtils'
import { formatDate, getDueDateColor, getDueDateEmoji } from '../../utils/dateUtils'
import { useT } from '../../i18n/useT'

const TYPE_ICON: Record<string, string> = {
  Ticket: '🎫', Task: '✅', Project: '📁', Note: '📝',
}

interface Pos { x: number; y: number }

function defaultPos(): Pos {
  return {
    x: window.innerWidth - 64,
    y: window.innerHeight - 200,
  }
}

const STORAGE_KEY = 'floatingFocusPos'

function loadPos(): Pos {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (s && typeof s.x === 'number') return s
  } catch { /**/ }
  return defaultPos()
}

export function FloatingFocus() {
  const { user } = useAppStore()
  const tr = useT()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<FocusItem[]>([])
  const [pos, setPos] = useState<Pos>(loadPos)
  const [dragging, setDragging] = useState(false)
  const posRef = useRef(pos)
  posRef.current = pos
  const popupRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const didDrag = useRef(false)   // บอกว่า pointer-up นี้มาจาก drag หรือ click

  // บันทึกตำแหน่ง
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)) } catch { /**/ }
  }, [pos])

  function load() {
    if (!user?.email) return
    spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}'`,
      'Id,Title,RefID,FocusType,FocusedEmail,FocusedBy,DueDate,Status,SortOrder,PinTarget',
      'SortOrder asc', 50)
      .then(rows => setItems(rows.filter(r => r.PinTarget !== 'Navigator'))).catch(() => {})
  }

  useEffect(() => { load() }, [user?.email])
  useEffect(() => { load() }, [location.pathname])

  // ปิด popup เมื่อคลิกนอก
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Drag (pointer events)
  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    didDrag.current = false
    setDragging(true)
    const startX = e.clientX, startY = e.clientY
    const orig = { ...posRef.current }

    function move(ev: PointerEvent) {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true
      const nx = Math.max(8, Math.min(window.innerWidth - 52, orig.x + dx))
      const ny = Math.max(8, Math.min(window.innerHeight - 52, orig.y + dy))
      setPos({ x: nx, y: ny })
    }
    function up() {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onButtonClick() {
    if (didDrag.current) return   // ไม่เปิด popup ถ้า drag
    setOpen(o => !o)
  }

  if (!user || items.length === 0) return null

  // คำนวณตำแหน่ง popup (เปิดไปทางที่มีที่ว่าง)
  const popupOnLeft = pos.x > window.innerWidth / 2
  const popupOnTop  = pos.y > window.innerHeight / 2

  return (
    <div
      style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 210 }}
      className={dragging ? 'select-none' : ''}
    >
      {/* Popup */}
      {open && (
        <div
          ref={popupRef}
          style={{
            position: 'absolute',
            ...(popupOnLeft  ? { right: 52 } : { left: 52 }),
            ...(popupOnTop   ? { bottom: 0 } : { top: 0 }),
          }}
          className="w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Pin size={14} className="text-primary-600" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Focus Items</span>
              <span className="text-[10px] bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded-full font-medium">
                {items.length}
              </span>
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
              const to = f.FocusType === 'Ticket' ? `/tickets/${f.RefID}`
                : f.FocusType === 'Note' ? `/tools?note=${f.RefID}`
                : `/projects/${f.RefID}`
              const isActive = location.pathname === to
              return (
                <Link key={f.id} to={to} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors group
                    ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}`}>
                  <span className="text-base flex-shrink-0">{getDueDateEmoji(color) || TYPE_ICON[f.FocusType] || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-800 dark:text-gray-200'}`}>
                      {f.Title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-gray-400">{f.FocusType}</span>
                      {f.DueDate && <span className="text-[10px] text-gray-400">· {formatDate(f.DueDate)}</span>}
                      <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${getStatusColor(f.Status)}`}>{f.Status}</span>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-gray-300 group-hover:text-primary-500 flex-shrink-0 transition-colors" />
                </Link>
              )
            })}
          </div>

          {/* Footer */}
          <Link to="/" onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 py-2.5 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-t border-gray-100 dark:border-gray-800 font-medium">
            {tr('ff.viewAll')}
          </Link>
        </div>
      )}

      {/* FAB — ลากได้ */}
      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        onClick={onButtonClick}
        title={tr('ff.fab')}
        className={`relative flex items-center justify-center w-11 h-11 rounded-full shadow-lg border transition-all duration-150
          ${dragging ? 'cursor-grabbing shadow-xl scale-110 opacity-80' : 'cursor-grab'}
          ${open
            ? 'bg-primary-600 border-primary-500 text-white'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-primary-600 hover:shadow-xl hover:scale-105'}`}
      >
        <Pin size={18} className={open ? 'rotate-45 transition-transform' : 'transition-transform'} />
        {/* Badge */}
        {!open && (
          <span className="absolute -top-1 -right-1 min-w-[1.1rem] min-h-[1.1rem] flex items-center justify-center text-[9px] font-bold bg-primary-600 text-white rounded-full border border-white dark:border-gray-900 px-1 leading-none">
            {items.length}
          </span>
        )}
        {/* Grip hint */}
        {!open && (
          <GripVertical size={10} className="absolute -bottom-0.5 text-gray-300 dark:text-gray-600" />
        )}
      </button>
    </div>
  )
}
