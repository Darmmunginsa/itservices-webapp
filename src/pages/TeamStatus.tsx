import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, Clock, CheckCircle2, ChevronLeft, ChevronRight, CalendarDays, ExternalLink } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { isPopout, openPopout } from '../utils/popout'
import { Header } from '../components/layout/Header'
import { ViewToggle, useViewMode } from '../components/common/ViewToggle'
import { VirtualOffice } from '../components/team/VirtualOffice'
import { Office2D } from '../components/team/Office2D'
import { getOfficeMapRows, getOfficeProps } from '../services/office'
import type { Prop } from '../utils/officeProps'
import { DEFAULT_MAP, ZONE_STATUS, ZONE_LABEL, type Zone } from '../utils/officeMap'
import { isPhotoFile } from '../components/common/PersonPhoto'
import { Button } from '../components/common/Button'
import { spGet } from '../services/sharepoint'
import { getSchedule } from '../services/graph'
import {
  activeSlotAt, AUTO_NOTE, createSlot, endMyAutoSlots, endOfDay, endOfWorkday, endSlotNow, getSlotsForDay, startOfDay,
} from '../services/teamStatus'
import { useAppStore } from '../store/useAppStore'
import type { AgentProfile } from '../types/common'
import {
  DAY_END_HOUR, DAY_START_HOUR, DURATION_PRESETS, REASON_PRESETS, STATUS_META, STATUS_ORDER,
  type CalendarBusySlot, type StatusType, type TeamStatusSlot,
} from '../types/teamStatus'

const HOUR_W = 64
const ROW_H = 34
const SPAN_H = DAY_END_HOUR - DAY_START_HOUR
const TRACK_W = SPAN_H * HOUR_W

const fmtTime = (iso: string | Date) => {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function remaining(endIso: string, now: Date): string {
  const mins = Math.round((new Date(endIso).getTime() - now.getTime()) / 60_000)
  if (mins <= 0) return 'กำลังจะเสร็จ'
  if (mins < 60) return `เหลืออีก ${mins} นาที`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `เหลืออีก ${h} ชม. ${m} นาที` : `เหลืออีก ${h} ชม.`
}

function xOf(iso: string, day: Date): number {
  const base = new Date(day); base.setHours(DAY_START_HOUR, 0, 0, 0)
  const mins = (new Date(iso).getTime() - base.getTime()) / 60_000
  return Math.max(0, Math.min(TRACK_W, (mins / 60) * HOUR_W))
}

// รูปจาก attachment ของ HD_AgentProfiles (ตัวเดียวกับผังองค์กร) — ไม่มีก็เป็นอวาตาร์ตัวอักษร
type AgentRow = AgentProfile & { AttachmentFiles?: { FileName: string }[] }

interface Member {
  email: string; name: string; supportGroup?: string
  profileId: number; photoFile?: string
  slot: TeamStatusSlot | null; calBusy: CalendarBusySlot | null
  slots: TeamStatusSlot[]; calendar: CalendarBusySlot[]
}

export default function TeamStatus() {
  const { user, addToast } = useAppStore()
  const [agents, setAgents] = useState<AgentRow[]>([])
  // card = ออฟฟิศเสมือน · table = รายการ
  const [view, setView] = useViewMode('team-status')
  // office = ออฟฟิศ 2D เดินได้ (ค่าเริ่มต้น) · board = สถานะ/ไทม์ไลน์
  // หน้าต่างที่ดึงออกไปอีกจอ — ชื่อแท็บเป็นของตัวเอง และไม่มีปุ่ม "เปิดอีกหน้าต่าง" ซ้อน
  const popout = isPopout(useLocation().search)
  useEffect(() => { if (popout) document.title = 'สถานะทีม — Helpdesk' }, [popout])
  // หน้าหลัก = "สถานะ & ไทม์ไลน์" เสมอ · ออฟฟิศ 2D เปิดในหน้าต่างแยกเท่านั้น
  // (ออฟฟิศมีได้ที่เดียว → ไมค์/สายเสียงไม่ซ้อนกันหลายหน้าต่าง และสลับเมนูในหน้าหลักแล้วเสียงไม่หลุด)
  const [mode, setMode] = useState<'office' | 'board'>(popout ? 'office' : 'board')
  const pickMode = (m: 'office' | 'board') => {
    if (m === 'office' && !popout) {
      if (!openPopout('/team-status')) addToast('error', 'เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up ให้เว็บนี้แล้วกดอีกครั้ง')
      return
    }
    setMode(m)
  }
  const [mapRows, setMapRows] = useState<string[]>(DEFAULT_MAP)
  const [mapProps, setMapProps] = useState<Prop[]>([])
  useEffect(() => {
    getOfficeMapRows().then(r => { setMapRows(r); return getOfficeProps(r).then(setMapProps) }).catch(() => {})
  }, [])
  // slot ที่เกิดจาก "การเดินเข้าโซน" — เดินออกจบเฉพาะอันนี้ สถานะที่ตั้งมือไว้ไม่โดนแตะ
  const zoneSeq = useRef(0)
  const zoneChain = useRef<Promise<unknown>>(Promise.resolve())
  const [slots, setSlots] = useState<TeamStatusSlot[]>([])
  const [calendar, setCalendar] = useState<CalendarBusySlot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dayOffset, setDayOffset] = useState(0)
  const [now, setNow] = useState(() => new Date())

  // composer
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<StatusType>('Busy')
  const [reason, setReason] = useState('')
  const [minutes, setMinutes] = useState(30)

  const day = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + dayOffset); return d }, [dayOffset])

  // นาฬิกาเดินเพื่อให้ "เหลืออีก N นาที" และเส้นตอนนี้ขยับเอง
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    // ShowInTeamStatus = false → Admin ซ่อนคนนั้นไว้ (เช่น ผู้บริหาร)
    // ไม่มีคอลัมน์/ยังไม่ตั้งค่า = แสดงตามปกติ จึงไม่กระทบของเดิม
    // '*' ครอบคลุม ShowInTeamStatus ถ้ามี (ไม่มีก็ไม่พัง) + รูปจาก AttachmentFiles ในคำขอเดียว
    spGet<AgentRow>('HD_AgentProfiles', undefined, '*,AttachmentFiles/FileName', 'Title asc', 500, 'AttachmentFiles')
      .then(rows => setAgents(rows.filter(a => a.ShowInTeamStatus !== false)))
      .catch(() => {
        // expand ไม่ได้ (สิทธิ์/ลิสต์แปลก) → ชุดเดิมไม่มีรูป
        spGet<AgentRow>('HD_AgentProfiles', undefined, 'Id,Title,EmailText,SupportGroup,Role', 'Title asc')
          .then(setAgents).catch(() => {})
      })
  }, [])

  // setState ใน .then เท่านั้น (ไม่ await แล้ว set ตรง ๆ) — กฎ lint ของโปรเจกต์
  const loadSlots = useCallback(() => {
    getSlotsForDay(day).then(setSlots).catch(() => { /* list อาจยังไม่ถูกสร้าง */ }).finally(() => setLoading(false))
  }, [day])

  // polling 30 วิ = realtime พอสำหรับการใช้งานจริง
  useEffect(() => {
    loadSlots()
    const t = setInterval(loadSlots, 30_000)
    const onFocus = () => loadSlots()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [loadSlots])

  // ปฏิทิน Outlook (รีเฟรชช้ากว่า เพราะเปลี่ยนไม่บ่อย)
  useEffect(() => {
    const emails = agents.map(a => a.EmailText).filter(Boolean)
    if (!emails.length) return
    let alive = true
    const load = async () => {
      const map = await getSchedule(emails, startOfDay(day), endOfDay(day))
      if (!alive) return
      const out: CalendarBusySlot[] = []
      for (const [email, items] of Object.entries(map))
        for (const it of items)
          out.push({ UserEmail: email, Title: it.subject || 'ประชุม (Outlook)', StartTime: it.start, EndTime: it.end, Kind: it.status })
      setCalendar(out)
    }
    load()
    const t = setInterval(load, 5 * 60_000)
    return () => { alive = false; clearInterval(t) }
  }, [agents, day])

  const members = useMemo<Member[]>(() => {
    const byUser = new Map<string, TeamStatusSlot[]>()
    for (const s of slots) {
      const k = (s.UserEmail ?? '').toLowerCase(); if (!k) continue
      byUser.set(k, [...(byUser.get(k) ?? []), s])
    }
    const calBy = new Map<string, CalendarBusySlot[]>()
    for (const c of calendar) {
      const k = c.UserEmail.toLowerCase()
      calBy.set(k, [...(calBy.get(k) ?? []), c])
    }
    const meLc = (user?.email ?? '').toLowerCase()
    const t = now.getTime()
    return agents.filter(a => a.EmailText).map<Member>(a => {
      const k = a.EmailText.toLowerCase()
      const mine = byUser.get(k) ?? []
      const cal = calBy.get(k) ?? []
      return {
        email: a.EmailText, name: a.Title, supportGroup: a.SupportGroup,
        profileId: a.id, photoFile: a.AttachmentFiles?.find(f => isPhotoFile(f.FileName))?.FileName,
        slot: activeSlotAt(mine, now),
        calBusy: cal.find(c => new Date(c.StartTime).getTime() <= t && new Date(c.EndTime).getTime() > t) ?? null,
        slots: mine, calendar: cal,
      }
    }).sort((a, b) => {
      if (a.email.toLowerCase() === meLc) return -1
      if (b.email.toLowerCase() === meLc) return 1
      const ab = a.slot || a.calBusy ? 0 : 1, bb = b.slot || b.calBusy ? 0 : 1
      if (ab !== bb) return ab - bb
      return a.name.localeCompare(b.name, 'th')
    })
  }, [agents, slots, calendar, now, user?.email])

  const meLc = (user?.email ?? '').toLowerCase()
  const mine = members.find(m => m.email.toLowerCase() === meLc)
  const freeCount = members.filter(m => !m.slot && !m.calBusy).length

  async function submitStatus() {
    if (!user) return
    setSaving(true)
    try {
      const start = new Date()
      const end = minutes === 0 ? endOfWorkday(start) : new Date(start.getTime() + minutes * 60_000)
      await createSlot({
        userEmail: user.email, userName: user.displayName || user.email,
        statusType: type, reason: reason.trim() || STATUS_META[type].label, start, end,
      })
      setOpen(false); setReason('')
      addToast('success', 'ตั้งสถานะแล้ว — ทีมเห็นทันที')
      loadSlots()
    } catch {
      addToast('error', 'ตั้งสถานะไม่สำเร็จ — ตรวจว่ามี list HD_TeamStatus แล้ว')
    } finally { setSaving(false) }
  }

  // เข้าโซน → ตั้งสถานะอัตโนมัติ · ทำทีละคำสั่งตามลำดับ (เดินผ่านหลายโซนเร็ว ๆ ไม่ค้างสถานะเก่า)
  // ก่อนตั้งใหม่ จบสถานะอัตโนมัติของฉันทั้งหมดจาก SharePoint — กลับโต๊ะ = ว่างเสมอ
  const onZoneChange = useCallback((zone: Zone) => {
    const status = ZONE_STATUS[zone]
    const my = ++zoneSeq.current
    zoneChain.current = zoneChain.current.then(async () => {
      if (my !== zoneSeq.current || !user) return      // มีโซนใหม่กว่ารอคิวอยู่ — ให้ตัวนั้นจัดการ
      await endMyAutoSlots(user.email).catch(() => {})
      if (!status || my !== zoneSeq.current) return
      const start = new Date()
      await createSlot({
        userEmail: user.email, userName: user.displayName || user.email,
        statusType: status, reason: ZONE_LABEL[zone], start, end: endOfWorkday(start), note: AUTO_NOTE,
      })
    }).catch(() => {}).then(() => loadSlots())
  }, [user, loadSlots])

  async function endNow(id: number) {
    try { await endSlotNow(id); addToast('success', 'กลับมาว่างแล้ว'); loadSlots() }
    catch { addToast('error', 'อัปเดตไม่สำเร็จ') }
  }

  const hours = Array.from({ length: SPAN_H }, (_, i) => DAY_START_HOUR + i)
  const isToday = day.toDateString() === now.toDateString()
  const nowX = isToday ? xOf(now.toISOString(), day) : -1
  const dayLabel = dayOffset === 0 ? 'วันนี้' : dayOffset === 1 ? 'พรุ่งนี้' : dayOffset === -1 ? 'เมื่อวาน'
    : day.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

  return (
    <div>
      <Header title="สถานะทีม" />
      <div className="p-4 md:p-6 space-y-4">

      {/* สถานะของฉัน */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">สถานะของฉัน</p>
        {mine?.slot ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-3 h-3 rounded-full" style={{ background: STATUS_META[mine.slot.StatusType]?.color }} />
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {STATUS_META[mine.slot.StatusType]?.label} · {mine.slot.Title}
            </span>
            <span className="text-sm text-gray-500">
              {remaining(mine.slot.EndTime, now)} (ถึง {fmtTime(mine.slot.EndTime)})
            </span>
            <div className="ml-auto flex gap-2">
              <Button onClick={() => endNow(mine.slot!.id)}>
                <CheckCircle2 size={15} /> เสร็จแล้ว / ว่าง
              </Button>
              <Button variant="secondary" onClick={() => setOpen(true)}>ตั้งใหม่</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-green-600">🟢 ว่าง — ทีมติดต่อได้</span>
            <div className="ml-auto">
              <Button onClick={() => setOpen(true)}><Clock size={15} /> แจ้งว่าไม่ว่าง</Button>
            </div>
          </div>
        )}
      </div>

      {/* สลับ กระดานสถานะ / ออฟฟิศ 2D (หน้าหลัก: ออฟฟิศเปิดหน้าต่างแยก) */}
      <div className="flex gap-1 text-xs items-center flex-wrap">
        {([['board', '📋 สถานะ & ไทม์ไลน์'], ['office', '🏢 ออฟฟิศ']] as const).map(([k, label]) => (
          <button key={k} onClick={() => pickMode(k)}
            title={k === 'office' && !popout ? 'เปิดออฟฟิศ 2D ในหน้าต่างใหม่ (มีแชท เสียง แชร์จอ) — เปิดซ้ำ = กลับไปหน้าต่างเดิม' : undefined}
            className={`px-3 py-1.5 rounded-lg border ${mode === k ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>{label}{k === 'office' && !popout && <ExternalLink size={11} className="inline ml-1 -mt-0.5" />}</button>
        ))}
      </div>

      {/* ซ่อนแทนปิด — สลับไปดู "สถานะ & ไทม์ไลน์" แล้วเสียง/แชร์จอ/แชทยังไม่หลุด */}
      {popout && <div className={mode === 'office' ? undefined : 'hidden'}>
        <Office2D mapRows={mapRows} mapProps={mapProps} members={members} meEmail={user?.email ?? ''} meName={user?.displayName || user?.email || ''}
          onZoneChange={onZoneChange} onError={msg => addToast('error', msg)} onInfo={msg => addToast('success', msg)} />
      </div>}

      {mode === 'board' && (<>
      {/* เลือกวัน + สรุป */}
      <div className="flex items-center gap-2">
        <button onClick={() => setDayOffset(d => d - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft size={16} /></button>
        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5"><CalendarDays size={15} /> {dayLabel}</span>
        <button onClick={() => setDayOffset(d => d + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight size={16} /></button>
        {dayOffset !== 0 && <button onClick={() => setDayOffset(0)} className="text-xs text-primary-600">กลับวันนี้</button>}
        <span className="ml-auto text-sm text-gray-500">ว่าง <b className="text-green-600">{freeCount}</b>/{members.length} คน</span>
        {dayOffset === 0 && <ViewToggle mode={view} onChange={setView} />}
        <button onClick={loadSlots} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" title="รีเฟรช"><RefreshCw size={15} /></button>
      </div>

      {/* ออฟฟิศเสมือน — อวาตาร์ย้ายห้องตามสถานะ กดคนแล้วทัก/โทรผ่าน Teams */}
      {dayOffset === 0 && view === 'card' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">ออฟฟิศเสมือน — กดที่คนเพื่อทัก</p>
          <VirtualOffice people={members} meEmail={user?.email ?? ''} now={now} remaining={remaining} fmtTime={fmtTime}
            onEndMine={endNow} onSetMine={() => setOpen(true)} />
          {!loading && members.length === 0 && <p className="text-sm text-gray-400 py-4">ยังไม่มีข้อมูลทีม</p>}
        </div>
      )}

      {/* ตอนนี้ใครว่าง — แบบรายการ */}
      {dayOffset === 0 && view === 'table' && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {members.map(m => {
            const meta = m.slot ? STATUS_META[m.slot.StatusType] : null
            const free = !m.slot && !m.calBusy
            return (
              <div key={m.email} className="flex items-center gap-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: free ? STATUS_META.Available.color : meta?.color ?? '#6366f1' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {m.name}{m.email.toLowerCase() === meLc ? ' (ฉัน)' : ''}
                    {m.supportGroup && <span className="ml-1 text-[11px] font-normal text-gray-400">· {m.supportGroup}</span>}
                  </p>
                  {m.slot ? (
                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                      {meta?.label} · {m.slot.Title} · {remaining(m.slot.EndTime, now)}
                    </p>
                  ) : m.calBusy ? (
                    <p className="text-xs text-indigo-600 dark:text-indigo-300 truncate">📅 {m.calBusy.Title} · ถึง {fmtTime(m.calBusy.EndTime)}</p>
                  ) : (
                    <p className="text-xs text-green-600">ว่าง</p>
                  )}
                </div>
                {m.email.toLowerCase() === meLc && m.slot && (
                  <button onClick={() => endNow(m.slot!.id)} className="text-[11px] font-semibold text-green-600 border border-green-500 rounded-full px-2.5 py-1 hover:bg-green-50 dark:hover:bg-green-900/20">
                    เสร็จแล้ว
                  </button>
                )}
              </div>
            )
          })}
          {!loading && members.length === 0 && <p className="text-sm text-gray-400 py-4">ยังไม่มีข้อมูลทีม</p>}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">ไทม์ไลน์ {dayLabel}</p>
        <div className="flex">
          <div className="shrink-0" style={{ width: 110 }}>
            <div style={{ height: 22 }} />
            {members.map(m => (
              <div key={m.email} style={{ height: ROW_H }} className="flex items-center pr-2">
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{m.name}</span>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto flex-1">
            <div style={{ width: TRACK_W }}>
              <div style={{ height: 22 }} className="flex">
                {hours.map(h => (
                  <div key={h} style={{ width: HOUR_W }} className="text-[10px] text-gray-400">{String(h).padStart(2, '0')}:00</div>
                ))}
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex pointer-events-none">
                  {hours.map(h => <div key={h} style={{ width: HOUR_W }} className="border-l border-gray-100 dark:border-gray-800" />)}
                </div>
                {members.map(m => (
                  <div key={m.email} style={{ height: ROW_H }} className="flex items-center">
                    <div className="relative w-full rounded bg-gray-50 dark:bg-gray-800/40" style={{ height: ROW_H - 10 }}>
                      {m.calendar.map((c, i) => {
                        const left = xOf(c.StartTime, day), w = Math.max(3, xOf(c.EndTime, day) - left)
                        return <div key={`c${i}`} title={`${c.Title} (Outlook)`} className="absolute top-0 bottom-0 rounded"
                          style={{ left, width: w, background: '#c7d2fe', opacity: .75 }} />
                      })}
                      {m.slots.map(s => {
                        const left = xOf(s.StartTime, day), w = Math.max(3, xOf(s.EndTime, day) - left)
                        const meta = STATUS_META[s.StatusType] ?? STATUS_META.Busy
                        return (
                          <div key={s.id} title={`${meta.label} · ${s.Title} (${fmtTime(s.StartTime)}–${fmtTime(s.EndTime)})`}
                            className="absolute top-0 bottom-0 rounded px-1 flex items-center overflow-hidden"
                            style={{ left, width: w, background: meta.color }}>
                            {w > 46 && <span className="text-[9px] font-medium text-white truncate">{s.Title}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {nowX >= 0 && <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none" style={{ left: nowX }} />}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {(['Busy', 'Meeting', 'OnSite', 'Break', 'Off'] as StatusType[]).map(s => (
            <span key={s} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_META[s].color }} /> {STATUS_META[s].label}
            </span>
          ))}
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#c7d2fe' }} /> ประชุมใน Outlook
          </span>
        </div>
      </div>

      </>)}

      {/* composer */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">ตั้งสถานะของฉัน</h3>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">สถานะ</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.filter(s => s !== 'Available').map(s => {
                  const meta = STATUS_META[s], on = type === s
                  return (
                    <button key={s} onClick={() => { setType(s); setReason('') }}
                      className="text-xs font-medium rounded-full border px-3 py-1.5"
                      style={on ? { background: meta.color, borderColor: meta.color, color: '#fff' } : { borderColor: meta.color, color: meta.color }}>
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">กำลังทำอะไร</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(REASON_PRESETS[type] ?? []).map(p => (
                  <button key={p} onClick={() => setReason(p)}
                    className={`text-xs rounded-full border px-3 py-1.5 ${reason === p ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="เช่น ประชุมลูกค้า ABC (ไม่ใส่ก็ได้)"
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 outline-none focus:border-primary-500" />
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase mb-2">นานเท่าไหร่</p>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map(d => (
                  <button key={d.label} onClick={() => setMinutes(d.minutes)}
                    className={`text-xs rounded-full border px-3 py-1.5 ${minutes === d.minutes ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={submitStatus} disabled={saving} className="flex-1 justify-center">
                {saving ? 'กำลังบันทึก…' : 'ตั้งสถานะ'}
              </Button>
              <Button variant="secondary" onClick={() => setOpen(false)}>ยกเลิก</Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
