import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Send, Users, Keyboard, Bell, BellOff, Mic, MicOff, PhoneOff, Headphones, Phone, Lock, MonitorUp, MonitorX, Maximize2, Map as MapIcon, Expand } from 'lucide-react'
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
import { ScreenVideo } from './ScreenVideo'
import { DecorSprite } from './DecorSprite'
import { DecorPanel } from './DecorPanel'
import { useOfficeDecor } from '../../hooks/useOfficeDecor'
import { freeDesks, placeableTiles, deskSlot, DECOR_RADIUS, type MyDecor } from '../../utils/officeDecor'
import { totalUnread, type DMRow } from '../../utils/officeDM'
import { decodeRoom, encodeRoom, joinMuted, HEAR_RADIUS } from '../../utils/voiceProximity'

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
  /** ข้อความแจ้งผลสำเร็จ (เช่น บันทึกการตกแต่งแล้ว) — ไม่ส่งมา = ใช้ช่องเดียวกับ onError */
  onInfo?: (msg: string) => void
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

export function Office2D({ mapRows, members, meEmail, meName, onZoneChange, onError, onInfo }: Props) {
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
  const mutedRef = useRef(false)
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
      savePresence(rowId, { x: p.x, y: p.y, room: encodeRoom(zoneAt(map, p.x, p.y), micRef.current, mutedRef.current) }).catch(() => { dirty.current = true })
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
  const online = others.filter(r => isOnline(r.LastSeen, now)).map(r => ({ ...r, email: r.UserEmail, x: r.X, y: r.Y, mic: decodeRoom(r.Room).mic, muted: decodeRoom(r.Room).muted }))

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

  // ปิด/เปิดไมค์ → บอกคนอื่นผ่านตำแหน่ง (ป้าย 🔇 บนตัวเรา) · กดค้างพูดไม่นับ (สั้นเกินกว่าจะส่งทัน)
  useEffect(() => { mutedRef.current = voice.muted; dirty.current = true }, [voice.muted])

  // เข้าร่วมเสียง: ห้องที่มีคนได้ยินเรา 2 คนขึ้นไป → เริ่มแบบปิดไมค์
  const joinVoice = () => {
    const crowd = joinMuted(voice.peers.length || inMyZone.filter(o => o.mic).length)
    voice.start({ muted: crowd })
    if (crowd) onVoiceError('เข้าร่วมแบบปิดไมค์ไว้ก่อน เพราะในห้องมีหลายคน — กด M เพื่อเปิดไมค์ หรือกดค้าง Space เพื่อพูด')
  }

  // คีย์ลัด: M = เปิด/ปิดไมค์ · กดค้าง Space = พูดชั่วคราวตอนปิดไมค์ — ไม่ทำงานตอนพิมพ์ในช่องข้อความ
  const { micOn: vMicOn, toggleMute: vToggle, pushToTalk: vPtt } = voice
  useEffect(() => {
    if (!vMicOn) return
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); vToggle() }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) vPtt(true) }
    }
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') vPtt(false) }
    const blur = () => vPtt(false)   // สลับหน้าต่างระหว่างกดค้าง — อย่าค้างไมค์เปิดไว้
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [vMicOn, vToggle, vPtt])

  // รับสายส่วนตัวแล้วไมค์ยังปิด → เปิดให้เอง · สายจบแล้วไมค์ที่เปิดเพราะสาย → ปิดคืน
  const micForCall = useRef(false)
  const { micOn, start: startMic, stop: stopMic } = voice
  useEffect(() => {
    if (dm.callWith && !micOn) { micForCall.current = true; startMic() }
    if (!dm.callWith && micForCall.current) { micForCall.current = false; if (micOn) stopMic() }
  }, [dm.callWith, micOn, startMic, stopMic])
  const dmUnread = totalUnread(dm.convs)
  // ภาพหน้าจอที่คนอื่นแชร์มา — เลือกดูทีละคน (ค่าเริ่มต้น = คนแรกที่แชร์)
  const screens = voice.peers.filter(p => p.screen)
  const [watching, setWatching] = useState<string | null>(null)
  const shown = screens.find(p => p.email === watching) ?? screens[0] ?? null
  const stageRef = useRef<HTMLDivElement>(null)
  // โหมดโรงหนัง: มีคนแชร์ = จอที่แชร์กินพื้นที่หลักแทนแผนที่ (แบบ Teams/Gather) · ผู้ใช้กดกลับไปดูแผนที่ได้
  // จำว่า "ปิดโรงหนังให้จอของใคร" — คนใหม่เริ่มแชร์ หรือคนเดิมแชร์รอบใหม่ = ขยายให้อีกครั้งเอง
  const [theaterOffFor, setTheaterOffFor] = useState<MediaStream | null>(null)
  const theaterOn = !!shown?.screen && theaterOffFor !== shown.screen
  const fullscreen = () => stageRef.current?.requestFullscreen?.().catch(() => {})

  // ── ตกแต่งโต๊ะ ──
  const onDecorInfo = useCallback((msg: string) => (onInfo ?? cb.current.onError)(msg), [onInfo])
  const decor = useOfficeDecor({ meEmail, meName, map, onError: onVoiceError, onInfo: onDecorInfo })
  // ของแต่งทุกคน: คนอื่นจากที่บันทึกไว้ · ของเรา = ร่างระหว่างแต่ง (เห็นผลทันที)
  const allDecor: { email: string; name: string; decor: MyDecor }[] = [
    ...decor.others,
    { email: me, name: meName, decor: decor.mine },
  ]
  const hiTiles = decor.decorating
    ? (decor.movingDesk || !decor.draft.desk ? freeDesks(map, decor.others) : decor.kind ? placeableTiles(map, decor.draft, decor.others, decor.kind) : [])
    : []
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
          {!decor.decorating && (
            <button onClick={decor.begin} title="จองโต๊ะของคุณ แล้วแต่งด้วยของที่ชอบ — ทุกคนเห็น"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600">
              🎨 {decor.saved.desk ? 'ตกแต่งโต๊ะ' : 'จองโต๊ะ'}
            </button>
          )}
          {/* เสียง — เปิดไมค์แล้วได้ยินคนเปิดไมค์ที่อยู่ห้องเดียวกัน / โต๊ะใกล้กัน */}
          {!voice.micOn ? (
            <button onClick={joinVoice} title={`เข้าร่วมเสียง — คุยกับคนในห้องเดียวกัน หรือโต๊ะในระยะ ${HEAR_RADIUS} ช่อง (เฉพาะคนที่เข้าร่วมเสียง) · ห้องคนเยอะจะเข้าแบบปิดไมค์ไว้ก่อน`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-600 text-white hover:bg-primary-700">
              <Headphones size={12} /> เข้าร่วมเสียง
            </button>
          ) : (<>
            {/* ปุ่มบอก "สิ่งที่จะเกิดเมื่อกด" ไม่ใช่สถานะ — เดิมป้าย "ไมค์เปิด" ดูเหมือนแค่ป้ายบอก คนเลยหาปุ่มปิดไมค์ไม่เจอ */}
            <button onClick={voice.toggleMute} title={voice.muted ? 'เปิดไมค์ (กด M) · หรือกดค้าง Space เพื่อพูดชั่วคราว' : 'ปิดไมค์ (กด M) — ยังได้ยินคนอื่นตามปกติ'}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium shadow-sm ${voice.muted
                ? (voice.talking ? 'bg-green-600 text-white' : 'bg-red-600 text-white hover:bg-red-700')
                : `border ${voice.meSpeaking ? 'border-green-400 text-green-700 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:border-red-400 hover:text-red-600'}`}`}>
              {voice.muted && !voice.talking ? <MicOff size={13} /> : <Mic size={13} />}
              {voice.muted ? (voice.talking ? 'กำลังพูด…' : 'เปิดไมค์') : 'ปิดไมค์'}
              <kbd className={`text-[9px] px-1 rounded ${voice.muted ? 'bg-white/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>M</kbd>
            </button>
            {voice.canShare && (voice.sharing ? (
              <button onClick={voice.stopShare} title="หยุดแชร์หน้าจอ" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600 text-white hover:bg-red-700"><MonitorX size={12} /> หยุดแชร์</button>
            ) : (
              <button onClick={voice.startShare} title="แชร์หน้าจอให้คนที่กำลังคุยด้วย (ห้องเดียวกัน / สายส่วนตัว)"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600"><MonitorUp size={12} /> แชร์จอ</button>
            ))}
            <button onClick={voice.stop} title="ออกจากเสียง — วางทุกสาย คืนไมค์" className="p-1.5 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><PhoneOff size={13} /></button>
          </>)}
          <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">คุณอยู่: {ZONE_LABEL[myZone]}</span>
        </div>
        {/* จอที่แชร์ — ของคนอื่น (เลือกดูได้) + ตัวอย่างของเราเองว่ากำลังส่งอะไรอยู่ */}
        {(shown || voice.myScreen) && (
          <div ref={stageRef}
            className={`mb-2 rounded-xl overflow-hidden border border-gray-800 bg-black relative ${theaterOn ? 'flex items-center justify-center' : ''}`}
            style={theaterOn ? { height: 'calc(100vh - 12rem)', minHeight: 420 } : undefined}>
            {shown?.screen ? (
              <div onDoubleClick={fullscreen} title="ดับเบิลคลิก = เต็มจอ" className={theaterOn ? 'w-full h-full' : ''}>
                <ScreenVideo stream={shown.screen} className={theaterOn ? 'w-full h-full object-contain' : 'w-full max-h-[45vh] object-contain'} />
              </div>
            ) : (
              <div className="py-8 pr-44 pl-4 text-xs text-gray-300">
                {connected.length > 0
                  ? <>กำลังแชร์หน้าจอให้ <b>{connected.map(p => nameOf(p.email).split(/\s+/)[0]).join(', ')}</b></>
                  : <>ยังไม่มีใครเห็นจอคุณ — เดินเข้าห้องเดียวกับคนที่เปิดไมค์ หรือขอคุยเสียงในแชทส่วนตัว แล้วเขาจะเห็นเอง</>}
              </div>
            )}
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {screens.map(p => (
                <button key={p.email} onClick={() => setWatching(p.email)}
                  className={`text-[11px] px-2 py-0.5 rounded-full ${shown?.email === p.email ? 'bg-primary-600 text-white' : 'bg-black/60 text-white hover:bg-black/80'}`}>
                  🖥️ {nameOf(p.email)}
                </button>
              ))}
            </div>
            <div className="absolute top-2 right-2 flex gap-1">
              {shown?.screen && (theaterOn ? (
                <button onClick={() => setTheaterOffFor(shown.screen)} title="ย่อจอ — กลับไปเห็นแผนที่ออฟฟิศ"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-black/60 text-white hover:bg-black/80"><MapIcon size={12} /> แผนที่</button>
              ) : (
                <button onClick={() => setTheaterOffFor(null)} title="ขยายจอที่แชร์เต็มพื้นที่"
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-black/60 text-white hover:bg-black/80"><Expand size={12} /> ขยาย</button>
              ))}
              {shown?.screen && (
                <button onClick={fullscreen} title="เต็มจอ (หรือดับเบิลคลิกที่ภาพ) — Esc เพื่อออก"
                  className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"><Maximize2 size={13} /></button>
              )}
            </div>
            {voice.myScreen && (
              <div className="absolute bottom-2 right-2 w-40 rounded-lg overflow-hidden ring-2 ring-red-500 shadow-lg bg-black">
                <ScreenVideo stream={voice.myScreen} className="w-full" />
                <span className="absolute top-1 left-1 text-[10px] px-1.5 rounded bg-red-600 text-white">● กำลังแชร์</span>
              </div>
            )}
          </div>
        )}
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
        {voice.micOn && voice.muted && (
          <p className="mb-1 text-[11px] text-red-600">🔇 ปิดไมค์อยู่ — คนอื่นไม่ได้ยินคุณ · กดค้าง <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600">Space</kbd> เพื่อพูดชั่วคราว หรือกด <kbd className="px-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600">M</kbd> เปิดไมค์</p>
        )}
        {voice.micOn && !dm.callWith && (
          <div className="flex items-center gap-1.5 mb-2 text-[11px] flex-wrap">
            {voice.peers.length === 0
              ? <span className="text-gray-400">🎧 ยังไม่มีใครใกล้ ๆ ที่เปิดไมค์ — เดินเข้าห้องเดียวกัน หรือไปยืนข้างโต๊ะเพื่อน</span>
              : voice.peers.map(p => (
                <span key={p.email} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${p.state === 'connected' ? (p.speaking ? 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300') : 'border-dashed border-gray-300 text-gray-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.state === 'connected' ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
                  {nameOf(p.email)}
                  {p.screen && <span title="กำลังแชร์หน้าจอ">🖥️</span>}
                  {online.find(o => o.email.toLowerCase() === p.email)?.muted && <span title="ปิดไมค์อยู่">🔇</span>}
                  {p.state === 'connected' ? (p.volume < 1 ? <span className="text-gray-400">· {Math.round(p.volume * 100)}%</span> : null) : <span>· กำลังต่อ…</span>}
                </span>
              ))}
            {connected.length > 0 && <span className="text-gray-400 ml-1">เดินออกห่าง = เสียงเบาลง / วางสายเอง</span>}
          </div>
        )}
        <div ref={boardRef} tabIndex={0} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onClick={() => boardRef.current?.focus()}
          className={`hd-office-map relative overflow-auto rounded-2xl border-2 outline-none select-none ${theaterOn ? 'hidden' : ''} ${focused ? 'border-primary-400 ring-2 ring-primary-200 dark:ring-primary-900' : 'border-gray-200 dark:border-gray-800'}`}
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
                <div key={`${x},${y}`} onClick={e => {
                    if (decor.decorating) { e.stopPropagation(); decor.onTileClick({ x, y }); return }
                    if (walk) { e.stopPropagation(); boardRef.current?.focus(); walkTo({ x, y }) }
                  }}
                  className={`absolute ${decor.decorating ? 'cursor-crosshair' : walk ? 'cursor-pointer hd-tile-walk' : ''}`}
                  style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE, zIndex: 'dTPKW'.includes(ch) ? 1 : undefined }}>
                  <OfficeTile rows={map.rows} x={x} y={y} size={TILE} />
                </div>
              )
            }))}
            {/* ── ของแต่งของทุกคน + ป้ายชื่อโต๊ะ ── (ไม่ขวางการคลิก — คลิกตกลงที่ช่องข้างใต้) */}
            {allDecor.map(d => (<div key={d.email} className="contents">
              {d.decor.items.map(it => {
                const slot = deskSlot(d.decor, it)
                // ของบนโต๊ะ: ย่อลงครึ่งหนึ่ง วางซ้าย / ขวา / หน้าจอ — จอกลางโต๊ะยังเห็น
                const off = slot === 0 ? [-9, -2] : slot === 1 ? [9, -2] : slot === 2 ? [0, 7] : [0, 0]
                const size = slot >= 0 ? TILE * 0.5 : TILE
                const sel = decor.decorating && d.email === me && decor.selected === it.id
                return (
                  <div key={it.id} className={`absolute pointer-events-none ${sel ? 'hd-decor-sel' : ''}`}
                    style={{ left: it.x * TILE + (TILE - size) / 2 + off[0], top: it.y * TILE + (TILE - size) / 2 + off[1], width: size, height: size, zIndex: it.kind === 'rug' ? 1 : 3 }}>
                    <DecorSprite kind={it.kind} rot={it.rot} flip={it.flip} size={size} />
                  </div>
                )
              })}
              {d.decor.desk && (
                <div className="absolute pointer-events-none z-[4] flex justify-center" style={{ left: d.decor.desk.x * TILE - 8, top: d.decor.desk.y * TILE + TILE - 9, width: TILE + 16 }}>
                  <span className={`text-[8px] leading-none px-1 py-0.5 rounded shadow-sm truncate max-w-full ${d.email === me ? 'bg-primary-600 text-white' : 'bg-amber-900/85 text-amber-50'}`}>
                    {d.email === me ? 'โต๊ะฉัน' : d.name.split(/\s+/)[0]}
                  </span>
                </div>
              )}
            </div>))}
            {/* ระหว่างตกแต่ง: ช่องที่คลิกได้ (เขียว) + ขอบเขตรอบโต๊ะ */}
            {decor.decorating && decor.draft.desk && !decor.movingDesk && (
              <div className="absolute pointer-events-none z-[6] rounded-xl border-2 border-dashed border-primary-400/80"
                style={{ left: (decor.draft.desk.x - DECOR_RADIUS) * TILE, top: (decor.draft.desk.y - DECOR_RADIUS) * TILE, width: (DECOR_RADIUS * 2 + 1) * TILE, height: (DECOR_RADIUS * 2 + 1) * TILE }} />
            )}
            {hiTiles.map(t => (
              <div key={`hi${t.x},${t.y}`} className="absolute pointer-events-none z-[6] rounded-md hd-decor-hi" style={{ left: t.x * TILE + 2, top: t.y * TILE + 2, width: TILE - 4, height: TILE - 4 }} />
            ))}
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
                    {r.mic && <span className="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center shadow" title={r.muted ? 'ปิดไมค์อยู่' : 'เปิดไมค์อยู่'}>
                      {r.muted ? <MicOff size={8} className="text-red-600" /> : <Mic size={8} className="text-green-600" />}</span>}
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
                  {voice.micOn && voice.muted && !voice.talking && <span className="absolute right-0 top-4 w-3.5 h-3.5 rounded-full bg-red-600 flex items-center justify-center shadow" title="ปิดไมค์อยู่"><MicOff size={8} className="text-white" /></span>}
                  <span className="text-[9px] leading-tight px-1 rounded bg-primary-600 text-white whitespace-nowrap">ฉัน</span>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── แชท ── */}
      <div className="lg:w-80 flex flex-col border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden" style={{ minHeight: 320, maxHeight: theaterOn ? 'calc(100vh - 8rem)' : '70vh' }}>
        {decor.decorating ? (
          <DecorPanel draft={decor.draft} kind={decor.kind} pickKind={decor.pickKind} selectedLabel={decor.selectedLabel}
            hasSelection={!!decor.selectedItem} act={decor.act} movingDesk={decor.movingDesk} startMoveDesk={decor.startMoveDesk}
            releaseDesk={decor.releaseDesk} dirty={decor.dirty} saving={decor.saving} save={decor.save} cancel={decor.cancel} />
        ) : (<>
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
        </>)}
      </div>
    </div>
  )
}
