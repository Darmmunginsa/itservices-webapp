// หมดเวลาใช้งานอัตโนมัติ
//
// ปัญหาที่แก้: ล็อกอินทิ้งไว้ได้ยาวมาก จน token หมดอายุไปแล้วแต่หน้าจอยังค้างอยู่
// พอกดอะไรก็โหลดไม่ขึ้นโดยไม่มีอะไรบอกว่าเพราะอะไร — ดูเหมือนแอปพัง
//
// กติกา: ไม่ขยับ 55 นาที → เตือนพร้อมนับถอยหลัง · ครบ 60 นาที → ออกจากระบบให้
// นับจาก "ครั้งสุดท้ายที่ผู้ใช้ขยับ" ไม่ใช่เวลาที่ล็อกอิน — คนที่ทำงานอยู่ต้องไม่ถูกเตะออก

export const IDLE_LIMIT_MS = 60 * 60 * 1000      // 1 ชั่วโมง
export const WARN_BEFORE_MS = 5 * 60 * 1000      // เตือนก่อนหมด 5 นาที

export type IdleState = 'active' | 'warning' | 'expired'

export interface IdleStatus {
  state: IdleState
  /** เวลาที่เหลือก่อนถูกตัด (มิลลิวินาที) — 0 เมื่อหมดแล้ว */
  remainingMs: number
  idleMs: number
}

/**
 * สถานะจากเวลาที่ขยับล่าสุด
 * แยกออกมาเป็นฟังก์ชันล้วนเพื่อทดสอบได้ ไม่ต้องรอเวลาจริงเดิน
 */
export function idleStatus(
  lastActivity: number,
  now: number,
  limitMs = IDLE_LIMIT_MS,
  warnMs = WARN_BEFORE_MS,
): IdleStatus {
  // นาฬิกาเครื่องถูกปรับย้อนหลัง หรือ activity มาจากอนาคต (คนละแท็บ) — ถือว่าเพิ่งขยับ
  const idleMs = Math.max(0, now - lastActivity)
  const remainingMs = Math.max(0, limitMs - idleMs)
  if (remainingMs === 0) return { state: 'expired', remainingMs: 0, idleMs }
  if (remainingMs <= warnMs) return { state: 'warning', remainingMs, idleMs }
  return { state: 'active', remainingMs, idleMs }
}

/** นับถอยหลังแบบ ม:ss — ใช้ในกล่องเตือน */
export function countdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * ควรบันทึกเวลาขยับใหม่ไหม
 *
 * ไม่เขียนทุก event เพราะขยับเมาส์ทีเดียวยิงเป็นร้อยครั้ง จะเขียน localStorage รัว
 * แต่ตอนใกล้หมดเวลาต้องไวขึ้น ไม่งั้นคนขยับแล้วกล่องเตือนไม่ยอมหาย
 */
export function shouldBump(
  lastActivity: number,
  now: number,
  throttleMs = 30_000,
  limitMs = IDLE_LIMIT_MS,
  warnMs = WARN_BEFORE_MS,
): boolean {
  const idle = now - lastActivity
  if (idle >= limitMs - warnMs) return true   // อยู่ในช่วงเตือนแล้ว ตอบทันที
  return idle >= throttleMs
}

/** อ่านเวลาขยับล่าสุดที่แชร์กันข้ามแท็บ — ค่าเสียหายให้ถือว่าเพิ่งขยับ ไม่ใช่เตะออก */
export function readLastActivity(raw: string | null, now: number, limitMs = IDLE_LIMIT_MS): number {
  const n = Number(raw)
  if (!raw || !Number.isFinite(n) || n <= 0) return now
  // ค่าจากอนาคตไกล ๆ = นาฬิกาคนละเครื่องเพี้ยน อย่าเชื่อจนไม่ตัดสักที
  if (n > now + limitMs) return now
  return n
}
