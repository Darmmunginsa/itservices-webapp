// SLA ของ Incident — "ปัญหาต้องแก้ให้จบภายในกี่ชั่วโมง"
// วัดที่ Incident เท่านั้น (Ticket = คำขอให้ทำบางอย่าง ไม่ใช่ปัญหา จึงไม่มี SLA)
// เก็บ 2 ค่า: SLAHours (ผู้ใช้เลือก) และ SLADue (คำนวณตอนบันทึก) — เก็บ due ไว้ด้วย
// เพื่อให้ SharePoint กรอง/เรียงได้ตรง ๆ ไม่ต้องคำนวณใหม่ทุกครั้ง

export interface SlaOption { hours: number; labelTh: string }

/** ตัวเลือกที่ให้เลือกตอนสร้าง Incident — เริ่มที่ 1 ชั่วโมง */
export const SLA_OPTIONS: SlaOption[] = [
  { hours: 1,   labelTh: '1 ชั่วโมง' },
  { hours: 2,   labelTh: '2 ชั่วโมง' },
  { hours: 4,   labelTh: '4 ชั่วโมง' },
  { hours: 8,   labelTh: '8 ชั่วโมง (1 วันทำการ)' },
  { hours: 24,  labelTh: '24 ชั่วโมง' },
  { hours: 48,  labelTh: '2 วัน' },
  { hours: 72,  labelTh: '3 วัน' },
  { hours: 168, labelTh: '7 วัน' },
]

/** SLA ที่แนะนำตามความรุนแรง — เป็นแค่ค่าตั้งต้น ผู้ใช้เปลี่ยนได้ */
export const SLA_BY_SEVERITY: Record<string, number> = {
  Critical: 1, High: 4, Medium: 24, Low: 72,
}

export interface SlaInput {
  SLAHours?: number | string
  SLADue?: string
  Created?: string
  ResolvedDate?: string
  Status?: string
}

export type SlaState = 'none' | 'met' | 'breached' | 'running' | 'overdue'

export interface SlaInfo {
  state: SlaState
  /** เวลาที่เหลือ (ชม.) — ติดลบ = เลยกำหนดมาแล้ว ; null = ไม่มี SLA หรือปิดไปแล้ว */
  hoursLeft: number | null
  due: Date | null
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** เส้นตายจาก SLADue ที่บันทึกไว้ ถ้าไม่มีก็คำนวณจาก Created + SLAHours */
export function slaDue(inc: SlaInput): Date | null {
  if (inc.SLADue) {
    const d = new Date(inc.SLADue)
    if (!isNaN(d.getTime())) return d
  }
  const hours = num(inc.SLAHours)
  if (!hours || !inc.Created) return null
  const start = new Date(inc.Created)
  if (isNaN(start.getTime())) return null
  return new Date(start.getTime() + hours * 3600000)
}

/** คำนวณ SLADue ตอนบันทึก — เริ่มนับจากเวลาที่เปิดเคส ไม่ใช่เวลาที่มากดแก้ */
export function computeSlaDue(hours: number | null | undefined, createdIso?: string, now = new Date()): string | null {
  const h = num(hours)
  if (!h) return null
  const start = createdIso ? new Date(createdIso) : now
  const base = isNaN(start.getTime()) ? now : start
  return new Date(base.getTime() + h * 3600000).toISOString()
}

const isResolved = (inc: SlaInput): boolean =>
  inc.Status === 'Resolved' || !!inc.ResolvedDate

/**
 * สถานะ SLA ณ ตอนนี้
 *  met      — ปิดทันเวลา
 *  breached — ปิดช้ากว่ากำหนด
 *  running  — ยังไม่ปิด และยังไม่เลยกำหนด
 *  overdue  — ยังไม่ปิด และเลยกำหนดแล้ว (นับเป็นเสีย SLA เหมือนกัน)
 *  none     — ไม่ได้กำหนด SLA จึงตัดสินไม่ได้ (ไม่ใช่ "ผ่าน")
 */
export function slaInfo(inc: SlaInput, now = new Date()): SlaInfo {
  const due = slaDue(inc)
  if (!due) return { state: 'none', hoursLeft: null, due: null }

  if (isResolved(inc)) {
    // ปิดแล้วแต่ไม่รู้ว่าปิดเมื่อไหร่ → ตัดสินไม่ได้ ไม่เดาว่าทันหรือไม่ทัน
    // (ตอนบันทึกระบบจะประทับเวลาปิดให้อัตโนมัติ เคสแบบนี้จึงมีแค่ข้อมูลเก่า)
    const end = inc.ResolvedDate ? new Date(inc.ResolvedDate) : null
    if (!end || isNaN(end.getTime())) return { state: 'none', hoursLeft: null, due }
    return { state: end.getTime() <= due.getTime() ? 'met' : 'breached', hoursLeft: null, due }
  }

  const left = (due.getTime() - now.getTime()) / 3600000
  return { state: left >= 0 ? 'running' : 'overdue', hoursLeft: left, due }
}

/** เสีย SLA ไหม — ทั้งปิดช้าและค้างจนเลยกำหนด นับเป็นเสียทั้งคู่ */
export const slaFailed = (s: SlaState): boolean => s === 'breached' || s === 'overdue'

/** วัดได้ไหม — 'running' ยังตัดสินไม่ได้ ต้องไม่เอาไปหารใน % */
export const slaJudged = (s: SlaState): boolean => s === 'met' || s === 'breached' || s === 'overdue'

/** ข้อความเวลาที่เหลือ/ที่เลยมา แบบอ่านง่าย */
export function slaCountdown(hoursLeft: number | null): string {
  if (hoursLeft === null) return ''
  const abs = Math.abs(hoursLeft)
  const text = abs < 1 ? `${Math.max(1, Math.round(abs * 60))} นาที`
    : abs < 48 ? `${Math.round(abs)} ชม.`
    : `${Math.round(abs / 24)} วัน`
  return hoursLeft >= 0 ? `เหลือ ${text}` : `เลยมา ${text}`
}

export const SLA_STATE_META: Record<SlaState, { label: string; cls: string }> = {
  none:     { label: 'ไม่ได้กำหนด SLA', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  met:      { label: 'ทัน SLA',        cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  breached: { label: 'เกิน SLA',       cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  running:  { label: 'อยู่ในเวลา',      cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  overdue:  { label: 'เลยกำหนดแล้ว',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}
