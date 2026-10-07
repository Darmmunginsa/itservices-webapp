import { spGet, spCreate, spUpdate, spDelete } from './sharepoint'
import type { StatusType, TeamStatusSlot } from '../types/teamStatus'
import { DAY_END_HOUR } from '../types/teamStatus'

const LIST = 'HD_TeamStatus'
const SELECT = 'Id,Title,UserEmail,UserName,StatusType,StartTime,EndTime,Note,Created'

export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
export const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

/** สิ้นสุดวันทำงาน (preset "ถึงสิ้นวัน") */
export function endOfWorkday(from: Date): Date {
  const x = new Date(from)
  x.setHours(DAY_END_HOUR, 0, 0, 0)
  if (x <= from) return new Date(from.getTime() + 60 * 60_000)
  return x
}

/** slot ที่คาบเกี่ยวกับวันที่ระบุ — กรองหยาบที่ server แล้วคัดละเอียดฝั่ง client (กัน timezone เพี้ยน) */
export async function getSlotsForDay(day: Date): Promise<TeamStatusSlot[]> {
  const from = startOfDay(day)
  const to = endOfDay(day)
  const rows = await spGet<TeamStatusSlot>(
    LIST, `EndTime ge datetime'${from.toISOString()}'`, SELECT, 'StartTime asc', 500,
  )
  return rows.filter(s => {
    const st = new Date(s.StartTime).getTime()
    const en = new Date(s.EndTime).getTime()
    return en >= from.getTime() && st <= to.getTime()
  })
}

export async function createSlot(input: {
  userEmail: string; userName: string; statusType: StatusType
  reason: string; start: Date; end: Date; note?: string
}): Promise<{ id: number }> {
  return spCreate(LIST, {
    Title: input.reason.slice(0, 255) || input.statusType,
    UserEmail: input.userEmail,
    UserName: input.userName,
    StatusType: input.statusType,
    StartTime: input.start.toISOString(),
    EndTime: input.end.toISOString(),
    Note: input.note || undefined,
  })
}

/** จบ slot ก่อนกำหนด */
export async function endSlotNow(id: number): Promise<void> {
  return spUpdate(LIST, id, { EndTime: new Date().toISOString() })
}

export async function deleteSlot(id: number): Promise<void> {
  return spDelete(LIST, id)
}

/** slot ที่ครอบเวลา `at` — ซ้อนกันเอาอันที่เริ่มทีหลังสุด */
export function activeSlotAt(slots: TeamStatusSlot[], at = new Date()): TeamStatusSlot | null {
  const t = at.getTime()
  const hits = slots.filter(s => new Date(s.StartTime).getTime() <= t && new Date(s.EndTime).getTime() > t)
  if (!hits.length) return null
  return hits.reduce((a, b) => (new Date(a.StartTime) > new Date(b.StartTime) ? a : b))
}
