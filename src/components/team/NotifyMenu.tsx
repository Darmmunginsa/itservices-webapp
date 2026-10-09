import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, BellRing, Volume2, VolumeX, X } from 'lucide-react'
import { loadAlertSettings, saveAlertSettings, desktopPerm, bellState, chime, type AlertSettings, type DesktopPerm } from '../../utils/officeAlerts'

// ── ปุ่มกระดิ่ง = เมนูตั้งค่าแจ้งเตือน (กดได้เสมอ) ──

export function NotifyMenu() {
  const [open, setOpen] = useState(false)
  const [s, setS] = useState<AlertSettings>(() => loadAlertSettings())
  const [perm, setPerm] = useState<DesktopPerm>(() => desktopPerm())
  const [tested, setTested] = useState('')
  // คอลัมน์แชทตัดขอบ (overflow-hidden) — เมนูจึงวางแบบ fixed ตามตำแหน่งปุ่ม ไม่ให้โดนตัด
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // ปิดเมื่อคลิกข้างนอก
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', down)
    return () => window.removeEventListener('mousedown', down)
  }, [open])

  const update = (next: AlertSettings) => { setS(next); saveAlertSettings(next) }
  const toggleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setAt({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
    setPerm(desktopPerm()); setTested(''); setOpen(o => !o)   // อ่านสิทธิ์ใหม่ทุกครั้ง — ผู้ใช้อาจไปแก้ในเบราว์เซอร์มา
  }   // อ่านสิทธิ์ใหม่ทุกครั้ง — ผู้ใช้อาจไปแก้ในเบราว์เซอร์มา

  function allow() {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then(p => {
      setPerm(p)
      if (p === 'granted') { update({ ...s, desktop: true }); testDesktop() }
    }).catch(() => {})
  }
  function testDesktop() {
    try {
      new Notification('Helpdesk · ทดสอบแจ้งเตือน', { body: 'ถ้าเห็นป้ายนี้ = แจ้งเตือนใช้งานได้แล้ว', tag: 'hd-test' })
      setTested('ส่งป้ายทดสอบแล้ว — ถ้าไม่เห็น ดูว่า Windows เปิดโหมด "ห้ามรบกวน / Focus" อยู่ไหม')
    } catch { setTested('เบราว์เซอร์ไม่ยอมแสดงป้าย') }
  }

  const state = bellState(s, perm)
  const Icon = state === 'on' ? BellRing : state === 'sound-only' ? Bell : BellOff
  const sw = (on: boolean) => `relative inline-flex w-8 h-[18px] flex-shrink-0 rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`
  const knob = (on: boolean) => `absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${on ? 'left-4' : 'left-0.5'}`

  return (
    <div ref={boxRef} className="relative flex">
      <button onClick={toggleOpen} title="ตั้งค่าแจ้งเตือนข้อความใหม่"
        className={`px-2.5 border-l border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 ${state === 'on' ? 'text-green-600' : state === 'sound-only' ? 'text-amber-600' : 'text-gray-400'}`}>
        <Icon size={13} />
      </button>
      {open && (
        <div style={at ? { position: 'fixed', top: at.top, right: at.right } : undefined} className="z-50 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3 text-xs space-y-3">
          <div className="flex items-center">
            <p className="font-semibold flex-1">แจ้งเตือนเมื่อมีข้อความใหม่</p>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
          </div>
          <p className="text-[11px] text-gray-500 -mt-2">เตือนเมื่อมีแชท/แชทส่วนตัว/ขอคุยเสียง ตอนที่คุณไม่ได้มองหน้าต่างนี้</p>

          {/* ป้ายบนเดสก์ท็อป */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <BellRing size={13} className="text-gray-500" />
              <span className="flex-1">ป้ายเด้งบนหน้าจอ (Windows)</span>
              {perm === 'granted' && (
                <button onClick={() => update({ ...s, desktop: !s.desktop })} className={sw(s.desktop)} aria-label="เปิด/ปิดป้ายแจ้งเตือน"><span className={knob(s.desktop)} /></button>
              )}
            </div>
            {perm === 'default' && (
              <button onClick={allow} className="w-full py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700">อนุญาตการแจ้งเตือน</button>
            )}
            {perm === 'granted' && s.desktop && (
              <button onClick={testDesktop} className="text-[11px] text-primary-600 hover:underline">ส่งป้ายทดสอบ</button>
            )}
            {perm === 'denied' && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2 text-[11px] text-red-700 dark:text-red-300 space-y-0.5">
                <p className="font-semibold">เบราว์เซอร์บล็อกการแจ้งเตือนของเว็บนี้ไว้</p>
                <p>1. คลิกไอคอน 🔒 (หรือ ⓘ) ด้านซ้ายของช่อง URL</p>
                <p>2. หัวข้อ "การแจ้งเตือน / Notifications" → เลือก <b>อนุญาต</b></p>
                <p>3. รีเฟรชหน้านี้</p>
                <p className="text-red-500/80 pt-0.5">ระหว่างนี้ยังใช้เสียงเตือนด้านล่างได้</p>
              </div>
            )}
            {perm === 'unsupported' && <p className="text-[11px] text-gray-400">เบราว์เซอร์นี้ไม่รองรับป้ายแจ้งเตือน — ใช้เสียงเตือนแทนได้</p>}
          </div>

          {/* เสียง */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            {s.sound ? <Volume2 size={13} className="text-gray-500" /> : <VolumeX size={13} className="text-gray-400" />}
            <span className="flex-1">เสียงเตือน "ติ๊ง-ต่อง"</span>
            <button onClick={() => chime()} className="text-[11px] text-primary-600 hover:underline">ลองฟัง</button>
            <button onClick={() => update({ ...s, sound: !s.sound })} className={sw(s.sound)} aria-label="เปิด/ปิดเสียงเตือน"><span className={knob(s.sound)} /></button>
          </div>
          {tested && <p className="text-[11px] text-gray-500">{tested}</p>}
        </div>
      )}
    </div>
  )
}
