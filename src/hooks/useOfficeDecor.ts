import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAllDecor, saveMyDecor, type DecorRow } from '../services/officeDecor'
import {
  canPlace, placeDesk, setDeskStyle, rotateDesk, placeItem, rotateItem, flipItem, removeItem, moveItem, emptyDecor, defOf, serializeDecor,
  type MyDecor, type OthersDecor,
} from '../utils/officeDecor'
import type { OfficeMap, Pos } from '../utils/officeMap'

// ── โหมดตกแต่งโต๊ะ: ร่างในเครื่อง → บันทึกทีเดียว (ยกเลิกได้ ไม่เขียน SharePoint ทุกคลิก) ──

const REFRESH_MS = 60_000   // ของแต่งคนอื่นเปลี่ยนไม่บ่อย

interface Args { meEmail: string; meName: string; map: OfficeMap; onError: (msg: string) => void; onInfo: (msg: string) => void }

export function useOfficeDecor({ meEmail, meName, map, onError, onInfo }: Args) {
  const me = meEmail.toLowerCase()
  const [rows, setRows] = useState<DecorRow[]>([])
  const [decorating, setDecorating] = useState(false)
  const [draft, setDraft] = useState<MyDecor>(emptyDecor())
  const [kind, setKind] = useState<string | null>(null)          // ของที่เลือกจากแคตตาล็อก (กำลังจะวาง)
  const [selected, setSelected] = useState<string | null>(null)  // ของที่วางแล้ว ที่เลือกอยู่
  const [movingDesk, setMovingDesk] = useState(false)
  // แบบโต๊ะที่เลือกไว้ก่อนวางโต๊ะครั้งแรก
  const [pendingStyle, setPendingStyle] = useState('classic')
  const [saving, setSaving] = useState(false)
  const warned = useRef(false)
  const cb = useRef({ onError, onInfo })
  useEffect(() => { cb.current = { onError, onInfo } }, [onError, onInfo])

  const load = useCallback(() => {
    getAllDecor().then(setRows).catch(() => {
      if (warned.current) return
      warned.current = true
      cb.current.onError('ตกแต่งโต๊ะยังใช้ไม่ได้ — ตรวจว่ามี list HD_OfficeDecor (ดู docs/Team-Status.md)')
    })
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  const myRow = rows.find(r => r.email === me)
  const saved = useMemo(() => myRow?.decor ?? emptyDecor(), [myRow])
  const others: OthersDecor[] = useMemo(() => rows.filter(r => r.email !== me), [rows, me])
  const mine = decorating ? draft : saved
  const dirty = decorating && serializeDecor(draft) !== serializeDecor(saved)

  const begin = useCallback(() => {
    setDraft(saved); setDecorating(true); setKind(null); setSelected(null); setMovingDesk(!saved.desk)
    load()
  }, [saved, load])
  const cancel = useCallback(() => { setDecorating(false); setKind(null); setSelected(null); setMovingDesk(false) }, [])

  const save = useCallback(async () => {
    setSaving(true)
    try {
      // โหลดใหม่ก่อนบันทึก — กันจองโต๊ะชนกับคนที่เพิ่งจองไปเมื่อกี้
      const fresh = await getAllDecor()
      const clash = draft.desk && fresh.some(r => r.email !== me && r.decor.desk?.x === draft.desk!.x && r.decor.desk?.y === draft.desk!.y)
      if (clash) { setRows(fresh); cb.current.onError('โต๊ะนี้เพิ่งมีคนจองไป — เลือกโต๊ะอื่น'); setMovingDesk(true); return }
      await saveMyDecor(me, meName, draft, fresh.find(r => r.email === me)?.id)
      setRows(await getAllDecor())
      setDecorating(false); setKind(null); setSelected(null); setMovingDesk(false)
      cb.current.onInfo('บันทึกการตกแต่งแล้ว — ทุกคนเห็นโต๊ะใหม่ของคุณ')
    } catch { cb.current.onError('บันทึกไม่สำเร็จ — ตรวจว่ามี list HD_OfficeDecor') }
    finally { setSaving(false) }
  }, [draft, me, meName])

  /** คลิกช่องบนแผนที่ระหว่างตกแต่ง */
  const onTileClick = useCallback((p: Pos) => {
    const err = (m: string) => cb.current.onError(m)
    // 1. วาง / ย้ายโต๊ะ — ตรงไหนก็ได้บนพื้นโซนทำงาน/ห้องโฟกัส ที่ไม่ชิดโต๊ะคนอื่น
    if (movingDesk || !draft.desk) {
      const r = placeDesk(map, draft, others, p, draft.desk ? undefined : pendingStyle)
      if ('error' in r) { err(r.error); return }
      setDraft(r.decor); setMovingDesk(false)
      if (r.dropped) cb.current.onInfo(`ย้ายโต๊ะแล้ว — ของ ${r.dropped} ชิ้นวางที่ใหม่ไม่ได้จึงเอาออก`)
      return
    }
    // 2. วางของที่เลือกจากแคตตาล็อก (เลือกค้างไว้ วางต่อได้หลายชิ้น)
    if (kind) {
      const c = canPlace(map, draft, others, kind, p)
      if (!c.ok) { err(c.reason); return }
      const next = placeItem(draft, kind, p)
      setDraft(next); setSelected(next.items[next.items.length - 1].id)
      return
    }
    // 3. ย้ายของที่เลือกอยู่ไปช่องอื่น — คลิกช่องที่มีของตัวเองอยู่ = เลือกชิ้นนั้นแทน
    const here = draft.items.filter(i => i.x === p.x && i.y === p.y)
    if (selected && !here.some(i => i.id === selected) && !here.length) {
      const it = draft.items.find(i => i.id === selected)
      if (it) {
        const c = canPlace(map, draft, others, it.kind, p, it.id)
        if (!c.ok) { err(c.reason); return }
        setDraft(moveItem(draft, it.id, p))
        return
      }
    }
    if (here.length) {
      // คลิกซ้ำบนโต๊ะ = วนเลือกชิ้นถัดไป
      const idx = here.findIndex(i => i.id === selected)
      setSelected(here[(idx + 1) % here.length].id)
      return
    }
    setSelected(null)
  }, [movingDesk, draft, others, map, kind, selected, pendingStyle])

  const act = useCallback((what: 'rotate' | 'flip' | 'remove') => {
    if (!selected) return
    setDraft(d => what === 'rotate' ? rotateItem(d, selected) : what === 'flip' ? flipItem(d, selected) : removeItem(d, selected))
    if (what === 'remove') setSelected(null)
  }, [selected])

  const releaseDesk = useCallback(() => {
    if (!window.confirm('คืนโต๊ะนี้? ของแต่งทั้งหมดจะถูกเอาออก (กดบันทึกถึงจะมีผล)')) return
    setDraft(emptyDecor()); setSelected(null); setKind(null); setMovingDesk(true)
  }, [])

  // คีย์ลัดระหว่างตกแต่ง: R หมุน · F กลับด้าน · Delete ลบ · Esc เลิกเลือก
  useEffect(() => {
    if (!decorating) return
    const down = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'r' || e.key === 'R') act('rotate')
      else if (e.key === 'f' || e.key === 'F') act('flip')
      else if (e.key === 'Delete' || e.key === 'Backspace') act('remove')
      else if (e.key === 'Escape') { setKind(null); setSelected(null) }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [decorating, act])

  const selectedItem = draft.items.find(i => i.id === selected) ?? null
  return {
    rows, others, mine, saved, decorating, draft, dirty, saving, kind, selected, selectedItem, movingDesk,
    begin, cancel, save, onTileClick, act, releaseDesk,
    deskStyle: draft.desk?.style ?? pendingStyle,
    pickDeskStyle: (st: string) => { if (draft.desk) setDraft(d => setDeskStyle(d, st)); else setPendingStyle(st) },
    turnDesk: () => {
      const r = rotateDesk(map, draft, others)
      if ('error' in r) cb.current.onError(r.error); else setDraft(r.decor)
    },
    pickKind: (k: string | null) => { setKind(k); setSelected(null) },
    startMoveDesk: () => { setMovingDesk(true); setKind(null); setSelected(null) },
    selectedLabel: selectedItem ? defOf(selectedItem.kind)?.label ?? '' : '',
  }
}
