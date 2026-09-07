import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, LogOut, ShieldAlert } from 'lucide-react'
import { Button } from './Button'
import {
  idleStatus, countdown, shouldBump, readLastActivity,
  IDLE_LIMIT_MS, WARN_BEFORE_MS,
} from '../../utils/idleSession'

/** แชร์เวลาขยับล่าสุดข้ามแท็บ — ทำงานอยู่แท็บเดียวไม่ควรถูกตัดเพราะอีกแท็บนิ่ง */
const KEY = 'hdLastActivity'
const TICK_MS = 5_000

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

interface Props {
  /** ล็อกอินอยู่ไหม — ยังไม่ล็อกอินก็ไม่มีอะไรให้ตัด */
  active: boolean
  /** token ตายกลางทาง (401 จาก SharePoint) */
  expired?: boolean
  /** ตัดออกจากระบบ */
  onExpire: () => void
  /** ตั้งเวลาได้ ค่าเริ่มต้น 1 ชั่วโมง / เตือนก่อน 5 นาที */
  limitMs?: number
  warnMs?: number
}

/**
 * ตัด session อัตโนมัติเมื่อไม่มีการใช้งาน
 *
 * เหตุผลที่ต้องมี: ล็อกอินทิ้งไว้ได้ยาวจน token หมดอายุ แล้วหน้าจอค้างอยู่แบบ
 * โหลดอะไรก็ไม่ขึ้นโดยไม่บอกสาเหตุ — ตัดออกไปเลยตรงไปตรงมากว่า
 *
 * เตือนก่อน 5 นาทีพร้อมนับถอยหลัง ไม่ตัดเงียบ ๆ เพราะคนอาจกำลังพิมพ์อยู่ในอีกแท็บ
 * และงานที่พิมพ์ค้างไว้จะหายไปพร้อมกัน
 *
 * เก็บ "เวลาขยับล่าสุด" กับ "เวลาปัจจุบัน" ไว้ใน state แล้วคำนวณสถานะตอน render
 * ไม่เก็บสถานะแยกไว้อีกชุด — เคยทำแบบนั้นแล้วปุ่ม "อยู่ต่อ" ทำงานไม่แน่นอน
 * เพราะสถานะที่แสดงกับค่าที่ตัวจับเวลาอ่าน มาจากคนละที่และไม่ตรงกันเป็นบางจังหวะ
 */
export function SessionGuard({
  active,
  expired = false,
  onExpire,
  limitMs = IDLE_LIMIT_MS,
  warnMs = WARN_BEFORE_MS,
}: Props) {
  const [lastActivity, setLastActivity] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const loggingOut = useRef(false)
  // ผู้เรียกส่ง arrow ใหม่ทุก render — ใส่ใน deps จะทำให้ตัวจับเวลาถูกตั้งใหม่ไม่หยุด
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  /** เพิ่งขยับ — เขียนหน่วงไว้เพื่อไม่ให้ re-render รัวตอนเลื่อนเมาส์ */
  const bump = useCallback((force = false) => {
    const t = Date.now()
    setLastActivity(prev => {
      if (!force && !shouldBump(prev, t, undefined, limitMs, warnMs)) return prev
      try { localStorage.setItem(KEY, String(t)) } catch { /* โหมดส่วนตัวเขียนไม่ได้ก็ไม่เป็นไร */ }
      return t
    })
    setNow(t)
  }, [limitMs, warnMs])

  // เริ่มนับใหม่ตอนล็อกอิน — ค่าค้างจากเซสชันก่อนต้องไม่เตะคนที่เพิ่งเข้ามา
  // เขียนลง storage แล้วให้ effect หลักอ่านต่อ ไม่ setState ตรง ๆ ในนี้
  useEffect(() => {
    if (!active) return
    loggingOut.current = false
    try { localStorage.setItem(KEY, String(Date.now())) } catch { /* ignore */ }
  }, [active])

  useEffect(() => {
    if (!active) return

    const onActivity = () => bump()
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true })

    /** เวลาที่แชร์ไว้ — เดินหน้าเท่านั้น ไม่ย้อนกลับไปหาค่าเก่าของเซสชันก่อน */
    const adopt = () => {
      const stored = readLastActivity(localStorage.getItem(KEY), Date.now(), limitMs)
      setLastActivity(prev => (stored > prev ? stored : prev))
      setNow(Date.now())
    }

    // อีกแท็บขยับ = คนคนนี้ยังทำงานอยู่
    const onStorage = (e: StorageEvent) => { if (e.key === KEY && e.newValue) adopt() }
    window.addEventListener('storage', onStorage)

    // กลับมาที่แท็บนี้ = คำนวณใหม่ทันที ไม่รอ tick ถัดไป
    const onVisible = () => { if (document.visibilityState === 'visible') adopt() }
    document.addEventListener('visibilitychange', onVisible)

    adopt()
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS)

    return () => {
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [active, bump, limitMs])

  // สถานะเดียว คำนวณจากค่าที่แสดงอยู่จริง — ที่เห็นบนจอกับที่ตัดสินใจตัดตรงกันเสมอ
  const status = idleStatus(lastActivity, now, limitMs, warnMs)

  // ตัดออกเมื่อหมดเวลา — ทำใน effect ไม่ใช่ตอน render
  useEffect(() => {
    if (!active || status.state !== 'expired' || loggingOut.current) return
    loggingOut.current = true
    try { sessionStorage.setItem('hdLogoutReason', 'idle') } catch { /* ignore */ }
    onExpireRef.current()
  }, [active, status.state])

  const signOutNow = () => { loggingOut.current = true; onExpire() }

  // ── token ตายกลางทาง (401) — ต้องบอก ไม่ใช่ปล่อยหน้าจอว่างให้เดาเอง ──
  if (active && expired) {
    return createPortal(
      <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <ShieldAlert size={22} className="text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">เซสชันหมดอายุแล้ว</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            สิทธิ์เข้าถึงข้อมูลหมดอายุ ข้อมูลที่เห็นอยู่อาจไม่ครบหรือไม่อัปเดต
          </p>
          <p className="text-xs text-gray-400 mt-2 mb-4">
            เข้าสู่ระบบใหม่เพื่อใช้งานต่อ — ที่พิมพ์ค้างไว้ยังไม่ได้บันทึกจะหายไป
          </p>
          <Button className="w-full" onClick={signOutNow}>
            <LogOut size={14} /> เข้าสู่ระบบใหม่
          </Button>
        </div>
      </div>,
      document.body,
    )
  }

  if (!active || status.state !== 'warning') return null

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Clock size={22} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">ยังอยู่ไหมครับ</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          ไม่มีการใช้งานมา {Math.round((limitMs - warnMs) / 60_000)} นาที
          ระบบจะออกจากระบบให้อัตโนมัติในอีก {Math.round(warnMs / 60_000)} นาที
        </p>
        <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums my-3">
          {countdown(status.remainingMs)}
        </p>
        {/* งานที่พิมพ์ค้างไว้จะหายไปพร้อมกัน — ต้องบอกก่อน ไม่ใช่ให้รู้ตอนหาย */}
        <p className="text-xs text-gray-400 mb-4">
          ถ้ามีข้อความที่พิมพ์ค้างไว้ยังไม่ได้บันทึก กด "อยู่ต่อ" แล้วบันทึกก่อนครับ
        </p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => bump(true)}>อยู่ต่อ</Button>
          <Button variant="secondary" onClick={signOutNow}>
            <LogOut size={14} /> ออกเลย
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
