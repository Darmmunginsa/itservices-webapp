import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Users, Keyboard, Bell, BellOff, Mic, MicOff, PhoneOff, Headphones, Phone, Lock } from 'lucide-react'
import { PersonPhoto } from '../common/PersonPhoto'
import {
  parseMap, tileAt, zoneAt, step, spawnPoint, clampToMap, isOnline, chatVisible, sameZone, findPath,
  KEY_DIR, ZONE_LABEL, type Zone, type Pos, type Dir,
} from '../../utils/officeMap'
import { ensureMyPresence, getPresence, savePresence, heartbeat, getChat, sendChat, type PresenceRow, type ChatRow } from '../../services/office'
import { STATUS_META, type StatusType, type TeamStatusSlot } from '../../types/teamStatus'
import { unreadTitle } from '../../utils/popout'
import { OfficeTile, OfficeDefs } from './OfficeTile'
import { useOfficeVoice } from '../../hooks/useOfficeVoice'
import { useOfficeDM, dmNotice } from '../../hooks/useOfficeDM'
import { OfficeDMPanel } from './OfficeDMPanel'
import { totalUnread, type DMRow } from '../../utils/officeDM'
import { decodeRoom, encodeRoom, HEAR_RADIUS } from '../../utils/voiceProximity'

// ── ออฟฟิศ 2D แบบ Gather (เฟส A: poll SharePoint ทุก 3 วิ) ──
//
// ตัวเองเดินลื่น (ขยับทันที) · คนอื่น tween ไปตำแหน่งใหม่ภายใน ~2.5 วิ ให้ดูเหมือนเดิน ไม่วาร์ป
// เข้าโซน → แจ้ง onZoneChange ให้หน้าแม่ตั้งสถานะ · แชท 2 แท็บ: ทั้งออฟฟิศ / ห้องที่ยืนอยู่

const TILE = 36
const POLL_MS = 3000
const FLUSH_MS = 1500
const HEARTBEAT_MS = 30_000

export interface OfficeMember {
  email: string
  name: string
  profileId: number
  photoFile?: string
  slot: TeamStatusSlot | null
}

interface Props {
  mapRows: string[]
  members: OfficeMember[]
  meEmail: string
  meName: string
  onZoneChange: (zone: Zone) => void
  onError: (msg: string) => void
}

const ZONE_CHAR: Record<Zone, string> = { desk: '.', meeting: 'M', focus: 'F', cafe: 'C', site: 'S' }

function hashIndex(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const fmtClock = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function Office2D({ mapRows, members, meEmail, meName, onZoneChange, onError }: Props) {
  const map = useMemo(() => parseMap(mapRows), [mapRows])
  const me = meEmail.toLowerCase()
  const [rowId, setRowId] = useState<number | null>(null)
  const [pos, setPos] = useState<Pos | null>(null)
  const [others, setOthers] = useState<PresenceRow[]>([])
  const [chat, setChat] = useState<ChatRow[]>([])
  const [tab, setTab] = useState<'all' | Zone | 'dm'>('all')
  const [dmWith, setDmWith] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [focused, setFocused] = useState(false)
  const [now, setNow] = useState(() => new Date())
  // แชทใหม่ตอนไม่ได้มองหน้าต่าง — นับขึ้นชื่อแท็บ "(3) …" และเด้ง Notification ถ้าอนุญาต
  const [unread, setUnread] = useState(0)
  const [notifyPerm, setNotifyPerm] = useState<NotificationPermission | 'unsupported'>(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))
  const seenMaxId = useRef<number | null>(null)
  const baseTitle = useRef(document.title)
  const dirty = useRef(false)
  const posRef = useRef<Pos | null>(null)
  // ไมค์เปิดอยู่ไหม — ฝากไปกับตำแหน่ง (ช่อง Room = "desk:mic") ให้คนอื่นรู้ว่าต่อสายได้
  const micRef = useRef(false)
  const zoneRef = useRef<Zone | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const meRef = useRef<HTMLDivElement>(null)
  const errored = useRef(false)

  // callback จากหน้าแม่เก็บใน ref — หน้าแม่สร้าง arrow ใหม่ทุก render (นาฬิกาเดินทุก 20 วิ)
  // ถ้าเอาไปเป็น deps effect "เข้าออฟฟิศ" จะรันซ้ำแล้วดึงตำแหน่งกลับจุดเดิมกลางทางเดิน
  const cb = useRef({ onZoneChange, onError })
  useEffect(() => { cb.current = { onZoneChange, onError } }, [onZoneChange, onError])
  const fail = useCallback((msg: string) => {
    // บอกครั้งเดียว — poll ทุก 3 วิ ถ้าลิสต์ยังไม่ได้สร้างจะเด้งไม่หยุด
    if (errored.current) return
    errored.current = true
    cb.current.onError(msg)
  }, [])
  const enterZone = useCallback((z: Zone) => {
    if (z === zoneRef.current) return
    zoneRef.current = z
    cb.current.onZoneChange(z)
  }, [])

  // เข้าออฟฟิศ: หาแถวของฉัน (ไม่มีก็สร้างที่จุดเกิด) — จุดเกิดกระจายตามอีเมล ไม่ทับกัน
  useEffect(() => {
    if (!meEmail) return
    const spawn = spawnPoint(map, hashIndex(me))
    ensureMyPresence(meEmail, meName, spawn)
      .then(r => {
        const p = clampToMap(map, { x: r.X, y: r.Y }, hashIndex(me))
        posRef.current = p
        setRowId(r.id); setPos(p)
        zoneRef.current = zoneAt(map, p.x, p.y)
      })
      .catch(() => fail('เข้าออฟฟิศไม่ได้ — ตรวจว่ามี list HD_OfficePresence แล้ว (ดู docs/Team-Status.md)'))
  }, [map, me, meEmail, meName, fail])

  // poll ตำแหน่งคนอื่น + แชท
  useEffect(() => {
    let alive = true
    const tick = () => {
      Promise.all([getPresence().catch(() => null), getChat().catch(() => null)]).then(([p, c]) => {
        if (!alive) return
        setNow(new Date())
        if (p) setOthers(p.filter(r => (r.UserEmail ?? '').toLowerCase() !== me))
        if (c) {
          const list = c.slice().reverse()
          setChat(list)
          // รอบแรกแค่จำ id ล่าสุด — ไม่นับของเก่าเป็น "ใหม่"
          const maxId = list.reduce((m, r) => Math.max(m, r.id), 0)
          if (seenMaxId.current == null) seenMaxId.current = maxId
          else if (maxId > seenMaxId.current) {
            const fresh = list.filter(r => r.id > seenMaxId.current! && (r.UserEmail ?? '').toLowerCase() !== me)
            seenMaxId.current = maxId
            if (fresh.length && (document.hidden || !document.hasFocus())) {
              setUnread(u => u + fresh.length)
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                const last = fresh[fresh.length - 1]
                try { new Notification(`${last.UserName} · ${last.Room ? 'ห้อง' : 'ทั้งออฟฟิศ'}`, { body: (last.Message || last.Title).slice(0, 120), tag: 'hd-office-chat' }).onclick = () => window.focus() } catch { /* บางเบราว์เซอร์ไม่ให้สร้างจาก tab */ }
              }
            }
          }
        }
        if (!p) fail('อ่านตำแหน่งทีมไม่ได้ — ตรวจว่ามี list HD_OfficePresence')
        else if (!c) fail('อ่านแชทไม่ได้ — ตรวจว่ามี list HD_OfficeChat')
      })
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(t) }
  }, [me, fail])

  // เขียนตำแหน่งเมื่อขยับ (รวมหลายก้าวเป็นครั้งเดียว) + heartbeat
  useEffect(() => {
    if (rowId == null) return
    const flush = () => {
      if (!dirty.current || !posRef.current) return
      dirty.current = false
      const p = posRef.current
      savePresence(rowId, { x: p.x, y: p.y, room: encodeRoom(zoneAt(map, p.x, p.y), micRef.current) }).catch(() => { dirty.current = true })
    }
    const f = setInterval(flush, FLUSH_MS)
    const h = setInterval(() => { if (!dirty.current) heartbeat(rowId).catch(() => {}) }, HEARTBEAT_MS)
    return () => { clearInterval(f); clearInterval(h); flush() }
  }, [rowId, map])

  const walkTimer = useRef<number | null>(null)
  const stopWalk = useCallback(() => {
    const t = walkTimer.current
    walkTimer.current = null
    if (t != null) clearInterval(t)
  }, [])

  const move = useCallback((dir: Dir) => {
    const cur = posRef.current
    if (!cur) return
    stopWalk()
    const next = step(map, cur, dir)
    if (next === cur) return
    posRef.current = next
    dirty.current = true
    setPos(next)
    enterZone(zoneAt(map, next.x, next.y))
  }, [map, enterZone, stopWalk])

  // คีย์บอร์ด — เฉพาะตอนแผนที่โฟกัส (พิมพ์แชทอยู่จะไม่เดิน)
  useEffect(() => {
    if (!focused) return
    const held = new Set<Dir>()
    let timer: number | null = null
    const run = () => { for (const d of held) move(d) }
    const down = (e: KeyboardEvent) => {
      const d = KEY_DIR[e.key]
      if (!d) return
      e.preventDefault()
      if (!held.has(d)) { held.add(d); move(d) }
      if (timer == null) timer = window.setInterval(run, 140)
    }
    const up = (e: KeyboardEvent) => {
      const d = KEY_DIR[e.key]
      if (d) held.delete(d)
      if (!held.size && timer != null) { clearInterval(timer); timer = null }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); if (timer != null) clearInterval(timer) }
  }, [focused, move])

  // คลิกช่องว่าง = เดินไปเอง (BFS อ้อมกำแพง) ทีละก้าวให้เห็นเดินจริงและเข้า/ออกโซนตามทาง
  const walkTo = useCallback((target: Pos) => {
    if (!posRef.current) return
    stopWalk()
    const path = findPath(map, posRef.current, target)
    if (!path.length) return
    const queue = [...path]
    const tick = () => {
      const p = queue.shift()
      if (!p) { stopWalk(); return }
      posRef.current = p; dirty.current = true; setPos(p)
      enterZone(zoneAt(map, p.x, p.y))
    }
    tick()
    walkTimer.current = window.setInterval(tick, 110)
  }, [map, enterZone, stopWalk])
  useEffect(() => stopWalk, [stopWalk])

  async function submit() {
    const t = text.trim()
    if (!t || !meEmail) return
    setSending(true)
    try {
      const room = tab === 'all' || tab === 'dm' ? '' : tab
      const res = await sendChat({ email: meEmail, name: meName, text: t, room })
      setChat(prev => [...prev, { id: res.id, Title: t.slice(0, 255), Message: t.length > 255 ? t : undefined, UserEmail: meEmail, UserName: meName, Room: room, Created: new Date().toISOString() }])
      setText('')
    } catch { cb.current.onError('ส่งข้อความไม่สำเร็จ — ตรวจว่ามี list HD_OfficeChat') }
    finally { setSending(false) }
  }

  // กลับมามอง = อ่านแล้ว
  useEffect(() => {
    const clear = () => setUnread(0)
    const vis = () => { if (!document.hidden) clear() }
    window.addEventListener('focus', clear)
    document.addEventListener('visibilitychange', vis)
    return () => { window.removeEventListener('focus', clear); document.removeEventListener('visibilitychange', vis) }
  }, [])
  useEffect(() => {
    const base = baseTitle.current
    document.title = unreadTitle(base, unread)
    return () => { document.title = base }
  }, [unread])
  function askNotify() {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then(p => setNotifyPerm(p)).catch(() => {})
  }

  const memberBy = useMemo(() => new Map(members.map(m => [m.email.toLowerCase(), m])), [members])
  const myZone: Zone = pos ? zoneAt(map, pos.x, pos.y) : 'desk'
  const online = others.filter(r => isOnline(r.LastSeen, now)).map(r => ({ ...r, email: r.UserEmail, x: r.X, y: r.Y, mic: decodeRoom(r.Room).mic }))

  // ── เสียงตามระยะ ──
  const onMicChange = useCallback((on: boolean) => { micRef.current = on; dirty.current = true }, [])
  const onVoiceError = useCallback((msg: string) => cb.current.onError(msg), [])

  // ── แชทส่วนตัว + ขอคุยเสียง ──
  // ของใหม่ตอนไม่ได้มอง/ไม่ได้เปิดห้องนั้น → นับขึ้นชื่อแท็บ + Notification (ใช้ระบบเดียวกับแชทออฟฟิศ)
  const dmOpenRef = useRef<{ tab: string; dmWith: string | null }>({ tab: 'all', dmWith: null })
  useEffect(() => { dmOpenRef.current = { tab, dmWith } }, [tab, dmWith])
  const onDMIncoming = useCallback((r: DMRow) => {
    const looking = !document.hidden && document.hasFocus()
    const inThread = dmOpenRef.current.tab === 'dm' && dmOpenRef.current.dmWith === r.FromEmail.toLowerCase()
    if (looking && inThread) return
    if (!looking) setUnread(u => u + 1)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && !looking) {
      try { new Notification(`💬 ${r.FromName || r.FromEmail.split('@')[0]}`, { body: dmNotice(r).slice(0, 120), tag: `hd-dm-${r.FromEmail}` }).onclick = () => window.focus() } catch { /* */ }
    }
  }, [])
  const dm = useOfficeDM({ meEmail, meName, onError: onVoiceError, onIncoming: onDMIncoming })
  const openDM = useCallback((email: string) => { setTab('dm'); setDmWith(email.toLowerCase()) }, [])

  const voice = useOfficeVoice({ map, meEmail, mePos: pos, others: online, onError: onVoiceError, onMicChange, privatePeer: dm.callWith })

  // รับสายส่วนตัวแล้วไมค์ยังปิด → เปิดให้เอง · สายจบแล้วไมค์ที่เปิดเพราะสาย → ปิดคืน
  const micForCall = useRef(false)
  const { micOn, start: startMic, stop: stopMic } = voice
  useEffect(() => {
    if (dm.callWith && !micOn) { micForCall.current = true; startMic() }
    if (!dm.callWith && micForCall.current) { micForCall.current = false; if (micOn) stopMic() }
  }, [dm.callWith, micOn, startMic, stopMic])
  const dmUnread = totalUnread(dm.convs)
  const speakingSet = new Set(voice.peers.filter(p => p.speaking).map(p => p.email))
  const connected = voice.peers.filter(p => p.state === 'connected')
  const nameOf = (email: string) => online.find(o => o.email.toLowerCase() === email)?.UserName ?? memberBy.get(email)?.name ?? email.split('@')[0]
  const inMyZone = pos ? sameZone(map, { x: pos.x, y: pos.y, email: meEmail }, online) : []
  const visibleChat = tab === 'dm' ? [] : chat.filter(c => chatVisible(c, tab))

  useEffect(() => { chatEndRef.current?.scrollIntoView({ block: 'nearest' }) }, [visibleChat.length, tab])
  // จอแคบ (มือถือ) แผนที่กว้างกว่าจอ — เลื่อนตามตัวเองไว้เสมอ
  useEffect(() => { meRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }, [pos])

  // ป้ายชื่อโซน — วางที่ช่องแรก (ซ้ายบน) ของโซนนั้น
  const zoneLabels = useMemo(() => {
    const out: { zone: Zone; x: number; y: number }[] = []
    for (const z of Object.keys(ZONE_CHAR) as Zone[]) {
      const ch = ZONE_CHAR[z]
      outer: for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (tileAt(map, x, y) === ch) { out.push({ zone: z, x, y }); break outer }
    }
    return out
  }, [map])

  const statusDot = (slot: TeamStatusSlot | null | undefined) =>
    slot ? STATUS_META[slot.StatusType as StatusType]?.color ?? '#6366f1' : STATUS_META.Available.color

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      {/* ── แผนที่ ── */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 flex-wrap">
          <span className="inline-flex items-center gap-1"><Keyboard size={12} /> ลูกศร / WASD เดิน · คลิกช่องว่างเพื่อเดินไป</span>
          <span className="ml-auto inline-flex items-center gap-1"><Users size={12} /> ออนไลน์ {online.length + (pos ? 1 : 0)} คน</span>
          {/* เสียง — เปิดไมค์แล้วได้ยินคนเปิดไมค์ที่อยู่ห้องเดียวกัน / โต๊ะใกล้กัน */}
          {!voice.micOn ? (
            <button onClick={voice.start} title={`เปิดไมค์ — คุยกับคนในห้องเดียวกัน หรือโต๊ะในระยะ ${HEAR_RADIUS} ช่อง (เฉพาะคนที่เปิดไมค์)`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-600 text-white hover:bg-primary-700">
              <Headphones size={12} /> เข้าร่วมเสียง
            </button>
          ) : (<>
            <button onClick={voice.toggleMute} title={voice.muted ? 'เปิดเสียงไมค์' : 'ปิดเสียงไมค์ (ยังได้ยินคนอื่น)'}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${voice.muted ? 'border-red-300 text-red-600 bg-red-50 dark:bg-red-900/20' : voice.meSpeaking ? 'border-green-400 text-green-700 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
              {voice.muted ? <MicOff size={12} /> : <Mic size={12} />} {voice.muted ? 'ปิดไมค์อยู่' : 'ไมค์เปิด'}
            </button>
            <button onClick={voice.stop} title="ออกจากเสียง — วางทุกสาย คืนไมค์" className="p-1.5 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><PhoneOff size={13} /></button>
          </>)}
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">คุณอยู่: {ZONE_LABEL[myZone]}</span>
        </div>
        {/* มีคนขอคุยเสียง — เด้งเหนือแผนที่ ไม่ต้องเปิดแชทก่อนถึงจะเห็น */}
        {dm.asks.slice(0, 1).map(a => (
          <div key={a.askId} className="mb-2 p-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-xs flex items-center gap-2 flex-wrap shadow-sm">
            <span className="text-base animate-bounce">📞</span>
            <span className="flex-1 min-w-0"><b>{a.name}</b> ถามว่า สะดวกคุยด้วยเสียงไหม?</span>
            <button onClick={async () => { if (dm.callWith && dm.callWith !== a.partner) await dm.send(dm.callWith, 'voice-end'); dm.send(a.partner, 'voice-yes'); openDM(a.partner) }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-600 text-white hover:bg-green-700"><Phone size={11} /> สะดวก</button>
            <button onClick={() => openDM(a.partner)} className="px-2.5 py-1 rounded-full border border-gray-300 dark:border-gray-600">ตอบในแชท</button>
          </div>
        ))}
        {dm.callWith && (
          <div className="mb-2 p-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs flex items-center gap-2">
            <Lock size={12} className="text-green-600" />
            <span className="flex-1 min-w-0">กำลังคุยส่วนตัวกับ <b>{nameOf(dm.callWith)}</b> — คนรอบตัวไม่ได้ยิน
              {voice.peers.find(p => p.email === dm.callWith)?.state !== 'connected' && <span className="text-gray-400"> · กำลังต่อสาย…</span>}</span>
            <button onClick={() => dm.send(dm.callWith!, 'voice-end')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white hover:bg-red-700"><PhoneOff size={11} /> วางสาย</button>
          </div>
        )}
        {voice.micOn && !dm.callWith && (
          <div className="flex items-center gap-1.5 mb-2 text-[11px] flex-wrap">
            {voice.peers.length === 0
              ? <span className="text-gray-400">🎧 ยังไม่มีใครใกล้ ๆ ที่เปิดไมค์ — เดินเข้าห้องเดียวกัน หรือไปยืนข้างโต๊ะเพื่อน</span>
              : voice.peers.map(p => (
                <span key={p.email} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${p.state === 'connected' ? (p.speaking ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300') : 'border-dashed border-gray-300 text-gray-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.state === 'connected' ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
                  {nameOf(p.email)}
                  {p.state === 'connected' ? (p.volume < 1 ? <span className="text-gray-400">· {Math.round(p.volume * 100)}%</span> : null) : <span>· กำลังต่อ…</span>}
                </span>
              ))}
            {connected.length > 0 && <span className="text-gray-400 ml-1">เดินออกห่าง = เสียงเบาลง / วางสายเอง</span>}
          </div>
        )}
        <div ref={boardRef} tabIndex={0} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onClick={() => boardRef.current?.focus()}
          className={`hd-office-map relative overflow-auto rounded-2xl border-2 outline-none select-none ${focused ? 'border-primary-400 ring-2 ring-primary-200 dark:ring-primary-900' : 'border-gray-200 dark:border-gray-800'}`}
          style={{ maxHeight: '70vh' }}>
          {!focused && pos && (
            <div className="absolute z-20 top-2 left-1/2 -translate-x-1/2 text-[11px] px-2 py-1 rounded-full bg-black/60 text-white pointer-events-none">คลิกที่แผนที่แล้วใช้ลูกศรเดิน</div>
          )}
          <div className="relative" style={{ width: map.width * TILE, height: map.height * TILE }}>
            {/* พื้น */}
            <OfficeDefs />
            {map.rows.map((row, y) => row.split('').map((ch, x) => {
              const walk = 'MFCS.E'.includes(ch)
              return (
                <div key={`${x},${y}`} onClick={e => { if (walk) { e.stopPropagation(); boardRef.current?.focus(); walkTo({ x, y }) } }}
                  className={`absolute ${walk ? 'cursor-pointer hd-tile-walk' : ''}`}
                  style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE, zIndex: 'dTPKW'.includes(ch) ? 1 : undefined }}>
                  <OfficeTile rows={map.rows} x={x} y={y} size={TILE} />
                </div>
              )
            }))}
            {/* แสงจากหน้าต่างซ้ายบน + ขอบมืด — ให้ทั้งห้องดูมีความลึก */}
            <div className="absolute inset-0 pointer-events-none z-[2]" style={{
              background: 'radial-gradient(ellipse at 18% 8%, rgba(255,248,220,.28), transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(15,23,42,.22) 100%)',
            }} />
            {/* ป้ายโซน — แผ่นป้ายติดผนัง */}
            {zoneLabels.map(l => (
              <div key={l.zone} className="absolute pointer-events-none z-[5] text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/85 dark:bg-gray-900/85 text-gray-700 dark:text-gray-200 shadow-sm border border-black/5"
                style={{ left: l.x * TILE + 3, top: l.y * TILE + 3 }}>{ZONE_LABEL[l.zone]}</div>
            ))}
            {/* คนอื่น — เลื่อนไปตำแหน่งใหม่ช้า ๆ ให้ดูเหมือนเดิน */}
            {online.map(r => {
              const m = memberBy.get(r.email.toLowerCase())
              const p = clampToMap(map, { x: r.X, y: r.Y }, hashIndex(r.email))
              return (
                <button key={r.id} onClick={e => { e.stopPropagation(); openDM(r.UserEmail) }}
                  title={`${r.UserName}${m?.slot ? ` · ${STATUS_META[m.slot.StatusType as StatusType]?.label} · ${m.slot.Title}` : ' · ว่าง'} — คลิกเพื่อแชทส่วนตัว`}
                  className="absolute z-10 flex flex-col items-center hd-avatar cursor-pointer"
                  style={{ left: p.x * TILE, top: p.y * TILE - 8, width: TILE, transition: 'left 2.4s linear, top 2.4s linear' }}>
                  <span className="hd-avatar-shadow" />
                  <span className={`relative rounded-full ring-2 shadow-md ${speakingSet.has(r.email.toLowerCase()) ? 'hd-speaking' : ''}`} style={{ ['--tw-ring-color' as string]: statusDot(m?.slot) }}>
                    <PersonPhoto itemId={m?.profileId ?? 0} fileName={m?.photoFile} name={r.UserName} size={28} />
                    {r.mic && <span className="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center shadow" title="เปิดไมค์อยู่"><Mic size={8} className="text-green-600" /></span>}
                  </span>
                  <span className="text-[9px] leading-tight px-1 rounded bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 whitespace-nowrap">{r.UserName.split(/\s+/)[0]}</span>
                  {dm.callWith === r.email.toLowerCase() && <span className="absolute -top-2 -right-1 text-[10px]" title="กำลังคุยส่วนตัว">🔒</span>}
                </button>
              )
            })}
            {/* ฉัน */}
            {pos && (() => {
              const m = memberBy.get(me)
              return (
                <div ref={meRef} className="absolute z-10 flex flex-col items-center pointer-events-none hd-avatar"
                  style={{ left: pos.x * TILE, top: pos.y * TILE - 8, width: TILE, transition: 'left .12s linear, top .12s linear' }}>
                  <span className="hd-avatar-shadow" />
                  {/* key ตามตำแหน่ง = เล่นแอนิเมชันเด้ง 1 ครั้งทุกก้าว */}
                  <span key={`${pos.x},${pos.y}`} className={`hd-step rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 shadow-md ${voice.meSpeaking ? 'hd-speaking' : ''}`} style={{ ['--tw-ring-color' as string]: statusDot(m?.slot) }}>
                    <PersonPhoto itemId={m?.profileId ?? 0} fileName={m?.photoFile} name={meName} size={28} />
                  </span>
                  <span className="text-[9px] leading-tight px-1 rounded bg-primary-600 text-white whitespace-nowrap">ฉัน</span>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── แชท ── */}
      <div className="lg:w-80 flex flex-col border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden" style={{ minHeight: 320, maxHeight: '70vh' }}>
        <div className="flex text-xs border-b border-gray-200 dark:border-gray-800 items-stretch">
          <button onClick={() => setTab('all')} className={`flex-1 py-2 ${tab === 'all' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-500'}`}>ทั้งออฟฟิศ</button>
          <button onClick={() => setTab(myZone)} className={`flex-1 py-2 ${tab !== 'all' && tab !== 'dm' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-500'}`}>
            {ZONE_LABEL[myZone]} ({inMyZone.length + 1})
          </button>
          <button onClick={() => setTab('dm')} className={`flex-1 py-2 relative ${tab === 'dm' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-500'}`}>
            ส่วนตัว
            {dmUnread > 0 && <span className="ml-1 text-[10px] px-1.5 rounded-full bg-red-500 text-white">{dmUnread}</span>}
          </button>
          {/* แจ้งเตือนแชทใหม่ตอนหน้าต่างไม่ได้โฟกัส — มีความหมายที่สุดตอนดึงไปอีกจอ */}
          {notifyPerm !== 'unsupported' && (
            <button onClick={askNotify} disabled={notifyPerm !== 'default'}
              title={notifyPerm === 'granted' ? 'แจ้งเตือนเปิดอยู่ — เด้งเมื่อมีแชทใหม่ตอนไม่ได้มองหน้าต่างนี้' : notifyPerm === 'denied' ? 'ถูกบล็อกในเบราว์เซอร์ — เปิดได้ที่ไอคอนกุญแจหน้า URL' : 'เปิดแจ้งเตือนเมื่อมีแชทใหม่'}
              className={`px-2.5 border-l border-gray-200 dark:border-gray-800 ${notifyPerm === 'granted' ? 'text-green-600' : notifyPerm === 'denied' ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}>
              {notifyPerm === 'denied' ? <BellOff size={13} /> : <Bell size={13} />}
            </button>
          )}
        </div>
        {tab === 'dm' ? (
          <OfficeDMPanel me={me} rows={dm.rows} convs={dm.convs} now={dm.now} openWith={dmWith} setOpenWith={setDmWith}
            send={dm.send} markRead={dm.markRead} callWith={dm.callWith}
            people={members.map(mm => ({ email: mm.email, name: mm.name, profileId: mm.profileId, photoFile: mm.photoFile, online: online.some(o => o.email.toLowerCase() === mm.email.toLowerCase()) }))} />
        ) : (<>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gray-50/60 dark:bg-gray-900/40">
          {visibleChat.length === 0 && <p className="text-[11px] text-gray-400 text-center py-6">{tab === 'all' ? 'ยังไม่มีข้อความ — ทักทายทีมได้เลย' : `ข้อความในนี้เห็นเฉพาะคนที่อยู่${ZONE_LABEL[myZone]}`}</p>}
          {visibleChat.map(c => {
            const mine = (c.UserEmail ?? '').toLowerCase() === me
            return (
              <div key={c.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && <span className="text-[10px] text-gray-400 px-1">{c.UserName}</span>}
                <div className={`max-w-[85%] px-2.5 py-1.5 rounded-2xl text-xs whitespace-pre-wrap break-words ${mine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-700'}`}>
                  {c.Message || c.Title}
                </div>
                <span className="text-[9px] text-gray-300 px-1">{fmtClock(c.Created)}</span>
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-1.5 p-2 border-t border-gray-200 dark:border-gray-800">
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            placeholder={tab === 'all' ? 'พิมพ์ถึงทั้งออฟฟิศ…' : `พิมพ์ถึงคนใน${ZONE_LABEL[myZone]}…`}
            className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <button onClick={submit} disabled={sending || !text.trim()} className="px-2.5 rounded-lg bg-primary-600 text-white disabled:opacity-50"><Send size={13} /></button>
        </div>
        </>)}
      </div>
    </div>
  )
}
