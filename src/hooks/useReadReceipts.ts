import { useCallback, useEffect, useRef, useState } from 'react'
import { getAllReadStates, saveMyReadState } from '../services/officeRead'
import { emptyRead, mergeRead, parseRead, serializeRead, type ReadState } from '../utils/readState'

// ── อ่านแล้ว / ยังไม่อ่าน ที่ตามไปทุกเครื่อง + คนส่งเห็นว่าใครอ่านแล้ว ──
// โหลดของทุกคนทุก 8 วิ · ของเรา = รวมของในเครื่อง + บน SharePoint (เอาที่อ่านไปไกลกว่า)
// อ่านเพิ่ม → บันทึกขึ้นไป (รอ 1.5 วิ รวมหลายครั้งเป็นครั้งเดียว) · ยังไม่มีคอลัมน์ = ใช้ในเครื่องอย่างเดียว

const POLL_MS = 8000
const LOCAL = 'hd-office-read'

const loadLocal = (me: string): ReadState => { try { return parseRead(localStorage.getItem(`${LOCAL}:${me}`)) } catch { return emptyRead() } }

export function useReadReceipts(meEmail: string, meName: string, onError?: (msg: string) => void) {
  const me = meEmail.toLowerCase()
  const [all, setAll] = useState<Map<string, ReadState>>(() => new Map())
  const [mine, setMine] = useState<ReadState>(() => loadLocal(me))
  const mineRef = useRef(mine)
  const timer = useRef<number | undefined>(undefined)
  const warned = useRef(false)
  const errRef = useRef(onError)
  useEffect(() => { errRef.current = onError }, [onError])

  const push = useCallback((r: ReadState) => {
    try { localStorage.setItem(`${LOCAL}:${me}`, serializeRead(r)) } catch { /* แค่ไม่จำในเครื่อง */ }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveMyReadState(me, meName, serializeRead(mineRef.current)).catch(() => {
        if (warned.current) return
        warned.current = true
        errRef.current?.('สถานะ "อ่านแล้ว" ยังไม่ซิงก์ข้ามเครื่อง — เพิ่มคอลัมน์ ReadState ใน HD_OfficeDecor (ดู docs/Team-Status.md)')
      })
    }, 1500)
  }, [me, meName])

  useEffect(() => {
    if (!me) return
    let alive = true
    const load = () => getAllReadStates().then(m0 => {
      if (!alive) return
      const parsed = new Map([...m0].map(([e, raw]) => [e, parseRead(raw)] as const))
      const server = parsed.get(me) ?? emptyRead()
      const merged = mergeRead(mineRef.current, server)
      parsed.set(me, merged)
      setAll(parsed)
      if (serializeRead(merged) !== serializeRead(mineRef.current)) { mineRef.current = merged; setMine(merged) }
    }).catch(() => { /* ยังไม่มีคอลัมน์ */ })
    load()
    const t = window.setInterval(load, POLL_MS)
    return () => { alive = false; window.clearInterval(t) }
  }, [me])

  const mark = useCallback((kind: 'c' | 'd', key: string, id: number) => {
    const k = key.toLowerCase()
    if (!id || (mineRef.current[kind][k] ?? 0) >= id) return
    const next: ReadState = { ...mineRef.current, [kind]: { ...mineRef.current[kind], [k]: id } }
    mineRef.current = next
    setMine(next)
    setAll(prev => new Map(prev).set(me, next))
    push(next)
  }, [me, push])

  const markChat = useCallback((room: string, id: number) => mark('c', room, id), [mark])
  const markDM = useCallback((partner: string, id: number) => mark('d', partner, id), [mark])

  return { all, mine, markChat, markDM }
}
