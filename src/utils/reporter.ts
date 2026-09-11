// "คนแจ้งสำรอง" — คนนอก (ลูกค้า/คู่ค้า) ที่ทีมรับเรื่องมาแล้วเปิดเคสแทน
//
// ทีมส่วนใหญ่รับเรื่องจากคนนอกแล้วมาเปิดเคสเอง ระบบจึงเห็นแต่ "คนกดสร้าง" ซึ่งเป็นคนใน
// พอจะถามกลับว่าเรื่องนี้ใครเป็นเจ้าของปัญหาจริง ก็ต้องไปหาในเมลเก่า
//
// Ticket มีช่องนี้อยู่แล้ว (CustomerName/CustomerEmail) — ใช้ต่อ ไม่สร้างซ้ำ
// Task กับ Incident ไม่มี จึงเพิ่ม ReporterName/ReporterEmail
// ฟอร์มแจ้งงานใช้ช่องกรอกชุดเดียวกันทั้งสามชนิด แล้วค่อยแปลงชื่อคอลัมน์ตอนบันทึก

export type ReporterKind = 'Ticket' | 'Task' | 'Incident'

export interface Reporter {
  name: string
  email: string
}

const clean = (v?: string): string => (v ?? '').trim()

/** ไม่ได้ระบุคนแจ้งสำรอง = แจ้งเอง */
export const isBlankReporter = (r: Reporter): boolean => !clean(r.name) && !clean(r.email)

/**
 * ฟิลด์ที่เขียนลง SharePoint ตามชนิดงาน
 * Ticket ใช้ชื่อคอลัมน์เดิม เพื่อให้เมลถึงลูกค้าและรายงานที่มีอยู่ยังทำงานเหมือนเดิม
 */
export function reporterFields(kind: ReporterKind, r: Reporter): Record<string, string> {
  const name = clean(r.name), email = clean(r.email)
  if (!name && !email) return {}
  if (kind === 'Ticket') {
    const out: Record<string, string> = {}
    if (name) out.CustomerName = name
    if (email) out.CustomerEmail = email
    return out
  }
  const out: Record<string, string> = {}
  if (name) out.ReporterName = name
  if (email) out.ReporterEmail = email
  return out
}

/** ชื่อคอลัมน์ที่ต้องมีในลิสต์ — ใช้บอกตอนเขียนไม่ผ่าน */
export const REPORTER_COLUMNS: Record<ReporterKind, string> = {
  Ticket: 'CustomerName, CustomerEmail (มีอยู่แล้ว)',
  Task: 'ReporterName (Text), ReporterEmail (Text) ใน PM_Tasks',
  Incident: 'ReporterName (Text), ReporterEmail (Text) ใน PM_Incidents',
}

/** บรรทัดแสดงผล "แจ้งแทน: ชื่อ (อีเมล)" — ว่างถ้าไม่มี */
export function reporterLine(name?: string, email?: string): string {
  const n = clean(name), e = clean(email)
  if (!n && !e) return ''
  if (n && e) return `${n} (${e})`
  return n || e
}

/**
 * อีเมลที่ควรได้รับแจ้งเรื่องเคสนี้ด้วย — คนแจ้งสำรองคือเจ้าของปัญหาจริง
 * ต้องได้เมลตอนเปิด/มอบหมาย/ปิด เหมือนลูกค้าของ Ticket
 */
export const reporterWatchers = (email?: string): string[] => (clean(email) ? [clean(email)] : [])
