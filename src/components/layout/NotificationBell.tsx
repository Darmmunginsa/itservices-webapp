import { useEffect, useRef, useState } from 'react'
import { Bell, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'
import { getMyNotifications, dismissNotification, dismissAll, type AppNotification } from '../../services/notificationService'

const POLL_MS = 30_000

export function NotificationBell() {
  const { user } = useAppStore()
  const navigate = useNavigate()
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const seenIds = useRef<Set<number>>(new Set())
  const firstLoad = useRef(true)
  const boxRef = useRef<HTMLDivElement>(null)

  // ขอสิทธิ์ desktop notification ครั้งแรก
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Poll
  useEffect(() => {
    if (!user?.email) return
    let alive = true

    async function tick() {
      const rows = await getMyNotifications(user!.email)
      if (!alive) return
      // ตรวจของใหม่ (ยังไม่อ่าน + ไม่เคยเห็น) → desktop popup
      const fresh = rows.filter(r => !r.IsRead && !seenIds.current.has(r.id))
      if (!firstLoad.current && fresh.length && 'Notification' in window && Notification.permission === 'granted') {
        for (const n of fresh.slice(0, 3)) {
          try {
            const note = new Notification(n.Title, { body: n.Message, tag: `notif-${n.id}` })
            note.onclick = () => { window.focus(); navigate(n.LinkPath || '/') }
          } catch { /* ignore */ }
        }
      }
      rows.forEach(r => seenIds.current.add(r.id))
      firstLoad.current = false
      setItems(rows.filter(r => !r.IsRead))  // โชว์เฉพาะที่ยังไม่อ่าน
    }

    tick()
    const t = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [user?.email, navigate])

  // ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const unread = items.length  // โชว์เฉพาะที่ยังไม่อ่าน → จำนวน = ทั้งหมดที่ค้าง

  // เปิด = อ่านแล้ว → ลบทิ้งทันที (ไม่ให้ค้างปนของใหม่)
  async function openItem(n: AppNotification) {
    setOpen(false)
    setItems(prev => prev.filter(x => x.id !== n.id))
    dismissNotification(n.id)
    if (n.LinkPath) navigate(n.LinkPath)
  }

  async function readAll() {
    const ids = items.map(i => i.id)
    setItems([])
    await dismissAll(ids)
  }

  return (
    <div className="relative" ref={boxRef}>
      <button onClick={() => setOpen(o => !o)}
        className="relative p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
            <span className="text-sm font-semibold">การแจ้งเตือน</span>
            {unread > 0 && (
              <button onClick={readAll} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                <Check size={12} /> เคลียร์ทั้งหมด
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-400">ไม่มีการแจ้งเตือนใหม่</div>
          ) : (
            items.map(n => (
              <button key={n.id} onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${n.IsRead ? '' : 'bg-primary-50/40 dark:bg-primary-900/10'}`}>
                <div className="flex items-start gap-2">
                  {!n.IsRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />}
                  <div className={`min-w-0 flex-1 ${n.IsRead ? 'pl-4' : ''}`}>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{n.Title}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{n.Message}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{new Date(n.Created).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
