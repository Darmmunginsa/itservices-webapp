// สถานะอัตโนมัติจากผังออฟฟิศ — ตรรกะล้วน (ทดสอบได้ ไม่แตะ SharePoint)
import type { TeamStatusSlot } from '../types/teamStatus'

export const AUTO_NOTE = 'auto:office'

/** slot อัตโนมัติจากผังออฟฟิศของฉันที่ยังไม่จบ ณ เวลา now */
export function myOpenAutoSlots(slots: TeamStatusSlot[], email: string, now = new Date()): TeamStatusSlot[] {
  const me = email.toLowerCase(), t = now.getTime()
  return slots.filter(s => (s.UserEmail || '').toLowerCase() === me && s.Note === AUTO_NOTE && new Date(s.EndTime).getTime() > t)
}

// ── วันลา → แสดงในสถานะทีม/ไทม์ไลน์ (กันติดต่อไปโดยไม่รู้ว่าเขาลา) ──
export interface LeaveLike { id: number; LeaveDate: string; LeaveType?: string; RequestedEmail?: string; Status?: string }
export const LEAVE_NOTE = 'leave'

const sameLocalDay = (iso: string, day: Date) => {
  const d = new Date(iso)
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()
}

/** วันลาของวันนั้น → slot "ลา" ทั้งวัน (ไม่รวมที่ถูกปฏิเสธ · รออนุมัติจะบอกไว้ในชื่อ) */
export function leaveSlotsForDay(leaves: LeaveLike[], day: Date): TeamStatusSlot[] {
  const start = new Date(day); start.setHours(0, 0, 0, 0)
  const end = new Date(day); end.setHours(23, 59, 59, 0)
  const seen = new Set<string>()
  const out: TeamStatusSlot[] = []
  for (const l of leaves) {
    const email = (l.RequestedEmail ?? '').toLowerCase()
    if (!email || l.Status === 'Rejected' || !l.LeaveDate || !sameLocalDay(l.LeaveDate, day)) continue
    if (seen.has(email)) continue                      // ขอลาซ้ำวันเดียวกัน — แสดงครั้งเดียว
    seen.add(email)
    out.push({
      id: -l.id, Title: `🏖️ ${l.LeaveType || 'ลา'}${l.Status === 'Pending' ? ' (รออนุมัติ)' : ''}`,
      UserEmail: email, UserName: '', StatusType: 'Off',
      StartTime: start.toISOString(), EndTime: end.toISOString(), Note: LEAVE_NOTE,
    })
  }
  return out
}
