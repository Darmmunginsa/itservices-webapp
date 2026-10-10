// สถานะอัตโนมัติจากผังออฟฟิศ — ตรรกะล้วน (ทดสอบได้ ไม่แตะ SharePoint)
import type { TeamStatusSlot } from '../types/teamStatus'

export const AUTO_NOTE = 'auto:office'

/** slot อัตโนมัติจากผังออฟฟิศของฉันที่ยังไม่จบ ณ เวลา now */
export function myOpenAutoSlots(slots: TeamStatusSlot[], email: string, now = new Date()): TeamStatusSlot[] {
  const me = email.toLowerCase(), t = now.getTime()
  return slots.filter(s => (s.UserEmail || '').toLowerCase() === me && s.Note === AUTO_NOTE && new Date(s.EndTime).getTime() > t)
}
