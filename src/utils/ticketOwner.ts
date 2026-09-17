// ผู้แจ้ง (EndUser) จัดการ Ticket ของตัวเองได้แค่ไหน
//
// ปัญหา: คนที่เปิด Ticket เองแล้วปัญหาหายไปแล้ว ปิดงานเองไม่ได้ — กล่องจัดการทั้งใบ
// เป็นของ agent ผู้แจ้งเห็นแต่สถานะ ต้องรอให้ทีมมาปิดให้ ทั้งที่เขาคือคนที่รู้ดีที่สุดว่าจบแล้วหรือยัง
//
// ให้ได้เฉพาะสิ่งที่เจ้าของปัญหาควรตัดสิน: "จบแล้ว" กับ "ยังไม่จบ"
// ส่วน assign / priority / Pending ยังเป็นของทีม

export type TicketStatusLike = 'Open' | 'In Progress' | 'Pending' | 'Resolved' | 'Closed' | string

export interface TicketOwnerLike {
  CustomerEmail?: string
  CreatedByEmail?: string
  Author?: { EMail?: string }
}

const norm = (e?: string): string => (e ?? '').trim().toLowerCase()

/** คนนี้เป็นผู้แจ้ง/เจ้าของ Ticket ไหม — ลูกค้าในช่อง หรือคนที่กดสร้างแถว */
export function isTicketRequester(t: TicketOwnerLike, email?: string): boolean {
  const me = norm(email)
  if (!me) return false
  return [t.CustomerEmail, t.CreatedByEmail, t.Author?.EMail].some(e => norm(e) === me)
}

export interface RequesterAction {
  label: string
  status: 'Closed' | 'Open'
  tone: 'green' | 'amber'
  /** ควรมีช่องบอกเหตุผลไหม — เปิดกลับต้องบอกว่ายังติดอะไร ปิดไม่ต้อง */
  askNote: boolean
}

/**
 * ปุ่มที่ผู้แจ้งเห็นตามสถานะปัจจุบัน
 *
 * ยังไม่จบ → ปิดได้ (ปัญหาหายเอง / ไม่ต้องการแล้ว)
 * Resolved → ยืนยันปิด หรือบอกว่ายังไม่หาย
 * Closed → เปิดกลับได้ ถ้าปัญหากลับมา — ไม่ต้องเปิด Ticket ใหม่แล้วเสียประวัติ
 */
export function requesterActions(status: TicketStatusLike): RequesterAction[] {
  if (status === 'Closed') {
    return [{ label: 'ปัญหากลับมาอีก — เปิด Ticket นี้ใหม่', status: 'Open', tone: 'amber', askNote: true }]
  }
  if (status === 'Resolved') {
    return [
      { label: 'ยืนยัน แก้ไขเรียบร้อยแล้ว — ปิดงาน', status: 'Closed', tone: 'green', askNote: false },
      { label: 'ยังไม่หาย — ขอให้ดูต่อ', status: 'Open', tone: 'amber', askNote: true },
    ]
  }
  return [{ label: 'ปัญหาแก้ไขแล้ว / ไม่ต้องดำเนินการต่อ — ปิดงาน', status: 'Closed', tone: 'green', askNote: false }]
}

// ── Incident ──────────────────────────────────────────────────────────────────
// Incident มีสถานะแค่ Open / In Progress / Resolved (ไม่มี Closed แยก)
// ผู้แจ้ง = คนกดสร้าง หรือคนแจ้งสำรอง (ReporterEmail) — เจ้าของปัญหาจริง

export interface IncidentOwnerLike {
  CreatedByEmail?: string
  ReporterEmail?: string
  Author?: { EMail?: string }
}

export function isIncidentRequester(i: IncidentOwnerLike, email?: string): boolean {
  const me = norm(email)
  if (!me) return false
  return [i.CreatedByEmail, i.ReporterEmail, i.Author?.EMail].some(e => norm(e) === me)
}

export interface IncidentRequesterAction {
  label: string
  status: 'Resolved' | 'Open'
  tone: 'green' | 'amber'
  askNote: boolean
}

/** ยังไม่จบ → ปิดเคสได้ · จบแล้ว → บอกว่ายังไม่หายได้ (เปิดกลับ ไม่ต้องเปิดเคสใหม่) */
export function incidentRequesterActions(status: string): IncidentRequesterAction[] {
  if (['Resolved', 'Closed', 'Done', 'Completed'].includes(status)) {
    return [{ label: 'ยังไม่หาย — เปิดเคสนี้กลับ', status: 'Open', tone: 'amber', askNote: true }]
  }
  return [{ label: 'ปัญหาแก้ไขแล้ว — ปิดเคส', status: 'Resolved', tone: 'green', askNote: false }]
}
