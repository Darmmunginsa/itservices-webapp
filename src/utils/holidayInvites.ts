import { spGet, spUpdate } from '../services/sharepoint'
import { createCalendarEvent } from '../services/graph'
import type { AgentProfile, Holiday } from '../types/common'

// ── วันหยุด (บริษัท/ราชการ) → ส่ง Calendar invite ให้ทุกคน "ล่วงหน้า 1 เดือน" ──
// ไม่มีเซิร์ฟเวอร์ตั้งเวลา: Admin/Boss คนใดเปิดเว็บ → เช็กวันหยุดใน 30 วันข้างหน้าที่ยังไม่ได้ส่ง แล้วส่งให้
// กันส่งซ้ำ: จอง CalendarEventId = "pending:<อีเมล>:<เวลา>" ก่อน → อ่านกลับ ถ้ายังเป็นของเราจึงส่ง
// (จองค้างเกิน 10 นาที = เครื่องนั้นปิดไปกลางทาง → คนอื่นส่งแทนได้)

export const INVITE_LEAD_DAYS = 30
const STALE_MS = 10 * 60_000
const THROTTLE_KEY = 'hd-holiday-invite-check'
const THROTTLE_MS = 3 * 60 * 60_000

const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** HolidayDate อาจมาเป็น 'yyyy-MM-dd' หรือ ISO เต็ม (คอลัมน์ DateTime) → วันตามเวลาไทย */
export const holidayDay = (h: Pick<Holiday, 'HolidayDate'>) => dayStart(new Date(h.HolidayDate.length <= 10 ? `${h.HolidayDate}T00:00:00` : h.HolidayDate))

/** อยู่ในช่วงต้องส่งแล้วหรือยัง (วันนี้ … อีก 30 วัน) */
export const withinLead = (h: Pick<Holiday, 'HolidayDate'>, now = new Date()) => {
  const d = holidayDay(h).getTime(), t = dayStart(now).getTime()
  return d >= t && d <= t + INVITE_LEAD_DAYS * 86_400_000
}

const needsInvite = (h: Holiday, now: number) => {
  const id = h.CalendarEventId ?? ''
  if (!id) return true
  if (!id.startsWith('pending:')) return false
  return now - Number(id.split(':')[2] ?? 0) > STALE_MS
}

/** ส่ง invite ของวันหยุดหนึ่งวันให้ทุกคน (ผู้ส่ง = คนที่เปิดอยู่) แล้วเก็บ id ไว้ใช้ตอนลบ */
export async function sendHolidayInvite(h: Pick<Holiday, 'id' | 'Title' | 'HolidayDate' | 'HolidayType'>): Promise<number> {
  const agents = await spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText')
  const attendees = [...new Set(agents.map(a => a.EmailText).filter(Boolean))]
  const start = holidayDay(h), end = new Date(start); end.setDate(end.getDate() + 1)
  const ev = await createCalendarEvent({
    subject: `🏖 ${h.HolidayType === 'ราชการ' ? '[วันหยุดราชการ]' : '[วันหยุดบริษัท]'} ${h.Title}`,
    start: `${ymd(start)}T00:00:00`,
    end: `${ymd(end)}T00:00:00`,
    attendees,
    isAllDay: true,
    showAs: 'oof',
    body: `วันหยุด${h.HolidayType}: ${h.Title}\nวันที่: ${ymd(start)}`,
  })
  // ส่งไปแล้ว — บันทึก id ไม่ได้ (เช่นยังไม่มีคอลัมน์) ก็ไม่ถือว่าล้มเหลว
  if (ev?.id) await spUpdate('HD_Holidays', h.id, { CalendarEventId: ev.id }).catch(() => {})
  return attendees.length
}

/** เช็กแล้วส่งวันหยุดที่ถึงกำหนด (เรียกตอน Admin/Boss เปิดเว็บ · จำกัดทุก 3 ชม.ต่อเครื่อง) — คืนจำนวนวันหยุดที่ส่ง */
export async function sendDueHolidayInvites(me: string, force = false): Promise<number> {
  try {
    if (!force) { const last = Number(localStorage.getItem(THROTTLE_KEY) ?? 0); if (Date.now() - last < THROTTLE_MS) return 0 }
    localStorage.setItem(THROTTLE_KEY, String(Date.now()))
  } catch { /* storage ปิด — เช็กทุกครั้งก็ไม่เป็นไร */ }
  // ต้องมีคอลัมน์ CalendarEventId (Single line of text) ในลิสต์ HD_Holidays ไว้จำว่าส่งแล้ว
  // ยังไม่มี → ไม่ส่งอัตโนมัติเลย (ไม่งั้นจะส่งซ้ำทุกรอบ)
  let all: Holiday[]
  try { all = await spGet<Holiday>('HD_Holidays', undefined, 'Id,Title,HolidayDate,HolidayType,CalendarEventId') }
  catch { return 0 }
  const now = Date.now()
  const due = all.filter(h => withinLead(h) && needsInvite(h, now))
  let sent = 0
  for (const h of due) {
    const claim = `pending:${me}:${Date.now()}`
    try {
      await spUpdate('HD_Holidays', h.id, { CalendarEventId: claim })
      await new Promise(r => setTimeout(r, 1500))
      const [back] = await spGet<Holiday>('HD_Holidays', `Id eq ${h.id}`, 'Id,CalendarEventId')
      if (back?.CalendarEventId !== claim) continue        // อีกเครื่องจองไปแล้ว
      await sendHolidayInvite(h)
      sent++
    } catch {
      // ส่งไม่สำเร็จ → ปล่อยจอง ให้รอบหน้าลองใหม่
      try { await spUpdate('HD_Holidays', h.id, { CalendarEventId: '' }) } catch { /* ignore */ }
    }
  }
  return sent
}
