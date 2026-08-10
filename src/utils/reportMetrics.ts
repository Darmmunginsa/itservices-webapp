// ตัวเลขทั้งหมดของหน้ารายงาน — แยกออกมาเป็น pure function เพราะเป็นตัวเลขที่เอาไปใช้
// ตัดสินใจเรื่องคน จึงต้องตรวจสอบได้ว่าคิดมาจากอะไร ไม่ใช่ฝังอยู่ใน JSX
import { inRange, type Range } from './period'
import { slaInfo, slaFailed, slaJudged } from './sla'

export interface TicketLike {
  id: number
  Title?: string
  Status?: string
  Priority?: string
  Category?: string
  DueDate?: string
  ResolvedDate?: string
  Created?: string
  AssignedEmail?: string
  AssignedTo?: { Title?: string } | string
  CustomerEmail?: string
  CustomerName?: string
}

export interface IncidentLike {
  id: number
  Severity?: string
  Status?: string
  AssignedEmail?: string
  ResolvedDate?: string
  Created?: string
  SLAHours?: number | string
  SLADue?: string
}

/**
 * SLA ขององค์กร — วัดที่ Incident เท่านั้น
 * Ticket คือ "คำขอให้ทำบางอย่าง" ไม่ใช่ปัญหา จึงไม่เอามาคิด SLA (ดู DueDate ของ Ticket แยกต่างหาก)
 * เคสที่ยังไม่ปิดและยังไม่เลยกำหนด ('running') ตัดสินไม่ได้ ต้องไม่อยู่ในตัวหาร
 */
export interface SlaStats {
  judged: number      // ตัดสินได้กี่เคส (ทัน + ไม่ทัน + ค้างจนเลยกำหนด)
  met: number
  failed: number
  pct: number | null  // % ที่ทัน SLA
  setPct: number | null   // % ของ incident ในช่วงที่กำหนด SLA ไว้ — ต่ำ = ตัวเลขข้างบนเชื่อได้น้อย
  running: number     // ยังนับถอยหลังอยู่
}

export function incidentSla(incidents: IncidentLike[], r: Range, now = new Date()): SlaStats {
  // เอาเคสที่ "เปิดในช่วง" หรือ "ปิดในช่วง" — ครอบคลุมเคสยาวข้ามเดือน
  const scope = incidents.filter(i => inRange(i.Created, r) || inRange(i.ResolvedDate, r))
  let judged = 0, met = 0, failed = 0, running = 0, withSla = 0
  for (const i of scope) {
    const info = slaInfo(i, now)
    if (info.state !== 'none') withSla++
    if (info.state === 'running') { running++; continue }
    if (!slaJudged(info.state)) continue
    judged++
    if (slaFailed(info.state)) failed++; else met++
  }
  return {
    judged, met, failed, running,
    pct: judged ? (met / judged) * 100 : null,
    setPct: scope.length ? (withSla / scope.length) * 100 : null,
  }
}

export interface TaskLike {
  id: number
  IsCompleted?: boolean
  AssignedEmail?: string
  DueDate?: string
}

export interface LeaveLike {
  LeaveDate?: string
  LeaveType?: string
  Status?: string
  RequestedEmail?: string
  RequestedBy?: string
}

export const isClosed = (t: TicketLike): boolean => t.Status === 'Resolved' || t.Status === 'Closed'

/** ชั่วโมงตั้งแต่เปิดจนปิด — null ถ้าข้อมูลไม่ครบหรือวันที่กลับหัว */
export function resolutionHours(t: TicketLike): number | null {
  if (!t.Created || !t.ResolvedDate) return null
  const ms = new Date(t.ResolvedDate).getTime() - new Date(t.Created).getTime()
  if (isNaN(ms) || ms < 0) return null
  return ms / 3600000
}

export function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function mean(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** ปิดทันกำหนดไหม — null = ไม่ได้ตั้ง due date จึงตัดสินไม่ได้ (ไม่ใช่ "สาย") */
export function closedOnTime(t: TicketLike): boolean | null {
  if (!t.DueDate || !t.ResolvedDate) return null
  return new Date(t.ResolvedDate).getTime() <= new Date(t.DueDate).getTime()
}

export interface PeriodStats {
  created: number         // รับเข้าในช่วง
  closed: number          // ปิดได้ในช่วง (นับจากวันปิด ไม่ใช่วันเปิด)
  closeRate: number | null// ปิดได้ / รับเข้า
  slaPct: number | null   // % ที่ปิดทันกำหนด (เฉพาะที่มี due date)
  slaSample: number       // ฐานที่ใช้คิด SLA — น้อยเกินไปก็อย่าเพิ่งเชื่อ
  dueSetPct: number | null// % ของงานที่ปิดในช่วงที่ "มีการตั้ง due date" — ความน่าเชื่อถือของ SLA ข้างบน
  avgHours: number | null
  medianHours: number | null
  backlogEnd: number      // ค้างอยู่ ณ สิ้นช่วง
  overdueNow: number      // ยังไม่ปิด และเลยกำหนดแล้ว (ณ ตอนดูรายงาน)
}

export function periodStats(tickets: TicketLike[], r: Range, now = new Date()): PeriodStats {
  const created = tickets.filter(t => inRange(t.Created, r))
  const closed  = tickets.filter(t => inRange(t.ResolvedDate, r))

  const judged = closed.map(closedOnTime).filter((v): v is boolean => v !== null)
  const hours  = closed.map(resolutionHours).filter((v): v is number => v !== null)

  // ค้าง ณ สิ้นช่วง = เปิดก่อนสิ้นช่วง และยังไม่ถูกปิดภายในสิ้นช่วงนั้น
  const backlogEnd = tickets.filter(t => {
    if (!t.Created) return false
    const c = new Date(t.Created).getTime()
    if (isNaN(c) || c > r.end.getTime()) return false
    if (!t.ResolvedDate) return true
    return new Date(t.ResolvedDate).getTime() > r.end.getTime()
  }).length

  const overdueNow = tickets.filter(t =>
    !isClosed(t) && !!t.DueDate && new Date(t.DueDate).getTime() < now.getTime()).length

  return {
    created: created.length,
    closed: closed.length,
    closeRate: created.length ? closed.length / created.length : null,
    slaPct: judged.length ? (judged.filter(Boolean).length / judged.length) * 100 : null,
    slaSample: judged.length,
    dueSetPct: closed.length ? (judged.length / closed.length) * 100 : null,
    avgHours: mean(hours),
    medianHours: median(hours),
    backlogEnd,
    overdueNow,
  }
}

/** เปลี่ยนไปกี่ % จากช่วงก่อน — null เมื่อเทียบไม่ได้ (ช่วงก่อนเป็น 0 หรือไม่มีข้อมูล) */
export function delta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

export interface PersonRow {
  email: string
  name: string
  assigned: number        // ถูกมอบหมายในช่วง (วัดปริมาณงานที่รับ)
  closed: number          // ปิดได้ในช่วง
  onTime: number
  late: number
  slaPct: number | null
  dueSetPct: number | null  // % ของงานที่ปิดที่มีการตั้ง due date — ต่ำ = SLA ข้างบนเชื่อไม่ได้เต็มปาก
  avgHours: number | null
  medianHours: number | null
  openNow: number
  overdueNow: number
  incidents: number       // incident ที่ปิดได้ในช่วง
  tasksDue: number        // งานโครงการที่ครบกำหนดในช่วง
  tasksDone: number
  leaveDays: number       // วันลาที่อนุมัติแล้วในช่วง
  sharePct: number        // สัดส่วนงานที่ปิดได้ เทียบกับทั้งทีม
  score: number | null    // คะแนนรวมถ่วงน้ำหนัก (ดู SCORE_WEIGHTS)
}

// น้ำหนักคะแนนรวม — เปิดเผยไว้ให้เห็นว่าคิดจากอะไร ไม่ใช่กล่องดำ
export const SCORE_WEIGHTS = { volume: 40, quality: 35, speed: 25 } as const

export const agentName = (t: TicketLike): string => {
  const raw = t.AssignedTo
  return (typeof raw === 'object' ? raw?.Title : raw) || t.AssignedEmail || ''
}

export function buildPersonRows(
  tickets: TicketLike[],
  incidents: IncidentLike[],
  tasks: TaskLike[],
  leaves: LeaveLike[],
  r: Range,
  now = new Date(),
): PersonRow[] {
  const map = new Map<string, { name: string; ts: TicketLike[] }>()
  for (const t of tickets) {
    const email = (t.AssignedEmail || '').toLowerCase()
    if (!email) continue                       // ยังไม่มอบหมาย → ไม่ผูกกับใคร
    if (!map.has(email)) map.set(email, { name: agentName(t), ts: [] })
    map.get(email)!.ts.push(t)
  }

  const totalClosed = tickets.filter(t => inRange(t.ResolvedDate, r) && t.AssignedEmail).length

  const rows: PersonRow[] = []
  for (const [email, { name, ts }] of map) {
    const closedTs = ts.filter(t => inRange(t.ResolvedDate, r))
    const judged = closedTs.map(closedOnTime).filter((v): v is boolean => v !== null)
    const hours = closedTs.map(resolutionHours).filter((v): v is number => v !== null)
    const onTime = judged.filter(Boolean).length

    rows.push({
      email,
      name,
      assigned: ts.filter(t => inRange(t.Created, r)).length,
      closed: closedTs.length,
      onTime,
      late: judged.length - onTime,
      slaPct: judged.length ? (onTime / judged.length) * 100 : null,
      dueSetPct: closedTs.length ? (judged.length / closedTs.length) * 100 : null,
      avgHours: mean(hours),
      medianHours: median(hours),
      openNow: ts.filter(t => !isClosed(t)).length,
      overdueNow: ts.filter(t => !isClosed(t) && !!t.DueDate && new Date(t.DueDate).getTime() < now.getTime()).length,
      incidents: incidents.filter(i => (i.AssignedEmail || '').toLowerCase() === email && inRange(i.ResolvedDate, r)).length,
      tasksDue: tasks.filter(k => (k.AssignedEmail || '').toLowerCase() === email && inRange(k.DueDate, r)).length,
      tasksDone: tasks.filter(k => (k.AssignedEmail || '').toLowerCase() === email && inRange(k.DueDate, r) && k.IsCompleted).length,
      leaveDays: leaves.filter(l => (l.RequestedEmail || '').toLowerCase() === email && l.Status === 'Approved' && inRange(l.LeaveDate, r)).length,
      sharePct: totalClosed ? (closedTs.length / totalClosed) * 100 : 0,
      score: null,
    })
  }

  return scoreRows(rows)
}

/**
 * คะแนนรวม 0–100 — เทียบกันเองภายในทีมในช่วงเวลานั้น ไม่ใช่มาตรฐานกลาง
 *  • ปริมาณ (volume) — งานที่ปิดได้ เทียบกับคนที่ปิดได้มากที่สุด
 *  • คุณภาพ (quality) — % ปิดทันกำหนด
 *  • ความเร็ว (speed)  — เวลาปิดกลาง (median) ยิ่งน้อยยิ่งดี เทียบกับคนที่เร็วที่สุด
 * ใครไม่มีข้อมูลพอในองค์ประกอบไหน จะไม่ถูกคิดคะแนนองค์ประกอบนั้น (แล้วหารด้วยน้ำหนักที่ใช้จริง)
 */
export function scoreRows(rows: PersonRow[]): PersonRow[] {
  const maxClosed = Math.max(0, ...rows.map(r => r.closed))
  const speeds = rows.map(r => r.medianHours).filter((v): v is number => v !== null && v > 0)
  const bestSpeed = speeds.length ? Math.min(...speeds) : null

  return rows.map(r => {
    // ไม่มีงานเลยในช่วงนี้ (เช่น ลาทั้งเดือน / เพิ่งเข้าทีม) → ไม่ให้คะแนน ไม่ใช่ให้ 0
    // 0 แปลว่า "มีงานแต่ทำไม่ได้" ซึ่งคนละเรื่องกับ "ไม่มีข้อมูลให้ตัดสิน"
    if (r.closed === 0 && r.assigned === 0) return { ...r, score: null }
    let sum = 0, used = 0
    if (maxClosed > 0) { sum += (r.closed / maxClosed) * SCORE_WEIGHTS.volume; used += SCORE_WEIGHTS.volume }
    if (r.slaPct !== null) { sum += (r.slaPct / 100) * SCORE_WEIGHTS.quality; used += SCORE_WEIGHTS.quality }
    if (bestSpeed !== null && r.medianHours !== null && r.medianHours > 0) {
      sum += Math.min(1, bestSpeed / r.medianHours) * SCORE_WEIGHTS.speed
      used += SCORE_WEIGHTS.speed
    }
    return { ...r, score: used ? Math.round((sum / used) * 100) : null }
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
}

/** จัดกลุ่มตามคีย์ แล้วเรียงมาก→น้อย (ใช้กับหมวดหมู่ / ลูกค้า) */
export function countBy<T>(items: T[], key: (x: T) => string): { label: string; value: number }[] {
  const m = new Map<string, number>()
  for (const it of items) {
    const k = key(it) || 'ไม่ระบุ'
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
