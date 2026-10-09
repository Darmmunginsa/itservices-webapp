import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMyDMs, sendDM } from '../services/officeDM'
import { conversations, incomingAsks, activeCallPartner, kindOf, textOf, type DMKind, type DMRow } from '../utils/officeDM'

// ── แชทส่วนตัว + ขอคุยเสียง — poll ทุก 3 วิ เหมือนแชทออฟฟิศ ──

const POLL_MS = 3000
const READ_KEY = 'hd-dm-read'

function loadRead(me: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(`${READ_KEY}:${me}`) || '{}') || {} } catch { return {} }
}

interface Args {
  meEmail: string
  meName: string
  onError: (msg: string) => void
  /** มีของใหม่จากอีกฝั่ง (ข้อความ / ขอคุยเสียง) — ให้ฝั่งออฟฟิศเด้งแจ้งเตือน */
  onIncoming: (row: DMRow) => void
}

export function useOfficeDM({ meEmail, meName, onError, onIncoming }: Args) {
  const me = meEmail.toLowerCase()
  const [rows, setRows] = useState<DMRow[]>([])
  const [readUpTo, setReadUpTo] = useState<Record<string, number>>(() => loadRead(me))
  const [now, setNow] = useState(() => Date.now())
  const seenMax = useRef<number | null>(null)
  const warned = useRef(false)
  const cb = useRef({ onError, onIncoming })
  useEffect(() => { cb.current = { onError, onIncoming } }, [onError, onIncoming])

  const refresh = useCallback(() => {
    if (!me) return
    getMyDMs(me).then(list => {
      setRows(list); setNow(Date.now())
      const max = list.reduce((m, r) => Math.max(m, r.id), 0)
      // รอบแรกแค่จำ id ล่าสุด — ของเก่าไม่นับเป็นของใหม่
      if (seenMax.current == null) { seenMax.current = max; return }
      const fresh = list.filter(r => r.id > seenMax.current! && r.FromEmail.toLowerCase() !== me).sort((a, b) => a.id - b.id)
      seenMax.current = Math.max(seenMax.current, max)
      for (const r of fresh) cb.current.onIncoming(r)
    }).catch(() => {
      if (warned.current) return
      warned.current = true
      cb.current.onError('แชทส่วนตัวใช้ไม่ได้ — ตรวจว่ามี list HD_OfficeDM (ดู docs/Team-Status.md)')
    })
  }, [me])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, POLL_MS)
    return () => clearInterval(t)
  }, [refresh])

  const send = useCallback(async (to: string, kind: DMKind, text?: string) => {
    try {
      const res = await sendDM({ from: me, fromName: meName, to, kind, text })
      // แสดงทันทีไม่รอรอบ poll — ตอนรับสายสำคัญที่สุด: สถานะต้องเปลี่ยนเดี๋ยวนั้น
      setRows(prev => [{ id: res.id, FromEmail: me, ToEmail: to.toLowerCase(), FromName: meName, Kind: kind, Title: (text ?? '').slice(0, 255) || kind, Message: (text ?? '').length > 255 ? text : undefined, Created: new Date().toISOString() }, ...prev])
      setNow(Date.now())
      if (seenMax.current != null) seenMax.current = Math.max(seenMax.current, res.id)
      return true
    } catch {
      cb.current.onError('ส่งไม่สำเร็จ — ตรวจว่ามี list HD_OfficeDM')
      return false
    }
  }, [me, meName])

  const markRead = useCallback((partner: string) => {
    const max = rows.filter(r => r.FromEmail.toLowerCase() === partner).reduce((m, r) => Math.max(m, r.id), 0)
    setReadUpTo(prev => {
      if ((prev[partner] ?? 0) >= max) return prev
      const next = { ...prev, [partner]: max }
      try { localStorage.setItem(`${READ_KEY}:${me}`, JSON.stringify(next)) } catch { /* โหมดส่วนตัว — แค่ไม่จำ */ }
      return next
    })
  }, [rows, me])

  const convs = useMemo(() => conversations(rows, me, readUpTo), [rows, me, readUpTo])
  const asks = useMemo(() => incomingAsks(rows, me, now), [rows, me, now])
  const callWith = useMemo(() => activeCallPartner(rows, me, now), [rows, me, now])

  return { rows, now, convs, asks, callWith, send, markRead }
}

/** ข้อความแจ้งเตือนสั้น ๆ ของแถว DM */
export function dmNotice(r: DMRow): string {
  const k = kindOf(r)
  if (k === 'voice-ask') return 'สะดวกคุยด้วยเสียงไหม? 📞'
  if (k === 'voice-yes') return 'รับสายแล้ว 🎧'
  if (k === 'voice-no') return `ยังไม่สะดวก${textOf(r) ? ` — ${textOf(r)}` : ''}`
  if (k === 'voice-end') return 'วางสายแล้ว'
  return textOf(r)
}
