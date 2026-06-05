import { useEffect, useRef, useState } from 'react'
import { Video, X, GripVertical } from 'lucide-react'

interface Props {
  embed: string          // YouTube embed URL
  storageKey: string     // localStorage key (per user)
}

interface BoxState { x: number; y: number; w: number; h: number; hidden?: boolean }

const DEFAULT: BoxState = { x: 24, y: 0, w: 360, h: 250 }

export function FloatingVideo({ embed, storageKey }: Props) {
  const [box, setBox] = useState<BoxState>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      if (saved && typeof saved.x === 'number') return saved
    } catch { /* ignore */ }
    // default: bottom-left
    return { ...DEFAULT, y: Math.max(80, window.innerHeight - DEFAULT.h - 24) }
  })
  const [dragging, setDragging] = useState(false)
  const boxRef = useRef(box)
  boxRef.current = box

  // persist
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(box)) } catch { /* ignore */ }
  }, [box, storageKey])

  function onDragStart(e: React.PointerEvent) {
    e.preventDefault()
    setDragging(true)
    const startX = e.clientX, startY = e.clientY
    const orig = { ...boxRef.current }
    function move(ev: PointerEvent) {
      const nx = Math.max(0, Math.min(window.innerWidth - 60, orig.x + (ev.clientX - startX)))
      const ny = Math.max(0, Math.min(window.innerHeight - 40, orig.y + (ev.clientY - startY)))
      setBox(b => ({ ...b, x: nx, y: ny }))
    }
    function up() {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // capture resize from CSS resize handle
  function onResizeEnd(e: React.SyntheticEvent<HTMLDivElement>) {
    const el = e.currentTarget
    setBox(b => ({ ...b, w: el.offsetWidth, h: el.offsetHeight }))
  }

  if (box.hidden) {
    return (
      <button onClick={() => setBox(b => ({ ...b, hidden: false }))}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-3.5 py-2 shadow-lg hover:shadow-xl transition-shadow text-sm font-medium text-gray-700 dark:text-gray-300">
        <Video size={15} className="text-red-600" /> วิดีโอ
      </button>
    )
  }

  return (
    <div
      onMouseUp={onResizeEnd}
      className="fixed z-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h, minWidth: 240, minHeight: 180, resize: 'both' }}
    >
      {/* Drag handle / header */}
      <div onPointerDown={onDragStart}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 cursor-move select-none flex-shrink-0">
        <GripVertical size={14} className="text-gray-400" />
        <Video size={14} className="text-red-600" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex-1">วิดีโอแนะนำ</span>
        <button onClick={() => setBox(b => ({ ...b, hidden: true }))} className="text-gray-400 hover:text-red-500"><X size={15} /></button>
      </div>
      {/* Video body */}
      <div className="flex-1 relative bg-black">
        <iframe
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: dragging ? 'none' : 'auto' }}
          src={embed}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  )
}
