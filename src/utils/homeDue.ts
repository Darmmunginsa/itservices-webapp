// รายการ "งานที่ถึงกำหนด / เลยกำหนด" บนหน้าหลัก
// รวม Ticket + Task + Incident ที่ยังไม่ปิด — ทั้งของที่มอบหมายให้เรา และที่เราถูกเชิญเข้าไป
//
// กติกาที่ตั้งใจ: งานที่ "ไม่ได้กำหนดวันส่ง" ต้องไม่หายไปจากหน้าจอ
// เพราะไม่มีกำหนดส่งไม่ได้แปลว่าไม่ต้องทำ — มันคือกรณีที่หลุดง่ายที่สุด
import { daysUntil } from './dateUtils'
import { slaInfo } from './sla'

export type DueType = 'Ticket' | 'Task' | 'Incident'

export interface DueRow {
  key: string
  title: string
  type: DueType
  link: string
  due: string | null      // null = ไม่ได้กำหนดวันส่ง (Incident = ไม่ได้ตั้ง SLA)
  days: number | null     // ติดลบ = เลยกำหนดมาแล้ว ; null = ไม่มีกำหนด
  status?: string
  severity?: string
  invited?: boolean       // ถูกเชิญเข้ามา ไม่ใช่เจ้าของงาน — เดิมหลุดจากหน้าหลักทั้งหมด
}

export const DUE_WINDOW_DAYS = 7   // มองไปข้างหน้า 7 วัน — ไกลกว่านั้นยังไม่ต้องเร่ง

export interface TicketRow {
  id: number
  Title: string
  Status: string
  DueDate?: string
  AssignedEmail?: string
}
export interface TaskRow {
  id: number
  Title: string
  ProjectID: number
  IsCompleted?: boolean
  DueDate?: string
}
export interface IncidentRow {
  id: number
  Title: string
  ProjectID?: number
  Status?: string
  Severity?: string
  Created?: string
  ResolvedDate?: string
  SLAHours?: number | string
  SLADue?: string
}

const TICKET_DONE = ['Resolved', 'Closed']

export function buildDueRows(
  tickets: TicketRow[],
  tasks: TaskRow[],
  incidents: IncidentRow[],
  opts: { myEmail?: string; invitedTicketIds?: Set<number>; now?: Date } = {},
): DueRow[] {
  const now = opts.now ?? new Date()
  const me = (opts.myEmail ?? '').toLowerCase()
  const invited = opts.invitedTicketIds ?? new Set<number>()
  const rows: DueRow[] = []
  const seen = new Set<string>()

  const push = (r: DueRow) => {
    if (seen.has(r.key)) return    // ถูกมอบหมาย + ถูกเชิญ = งานเดียวกัน ต้องไม่ขึ้นสองแถว
    seen.add(r.key)
    rows.push(r)
  }

  for (const t of tickets) {
    if (TICKET_DONE.includes(t.Status)) continue
    const mine = !!me && (t.AssignedEmail ?? '').toLowerCase() === me
    push({
      key: `tk-${t.id}`,
      title: t.Title,
      type: 'Ticket',
      link: `/tickets/${t.id}`,
      due: t.DueDate ?? null,
      days: t.DueDate ? daysUntil(t.DueDate) : null,
      status: t.Status,
      invited: !mine && invited.has(t.id),
    })
  }

  for (const t of tasks) {
    if (t.IsCompleted) continue
    push({
      key: `ts-${t.id}`,
      title: t.Title,
      type: 'Task',
      link: `/projects/${t.ProjectID}`,
      due: t.DueDate ?? null,
      days: t.DueDate ? daysUntil(t.DueDate) : null,
    })
  }

  for (const i of incidents) {
    if (i.Status === 'Resolved' || i.ResolvedDate) continue
    // Incident ใช้นาฬิกา SLA เป็นกำหนดส่ง — ไม่ได้ตั้ง SLA ก็ยังต้องโผล่ (ไม่มีกำหนด)
    const info = slaInfo(i, now)
    push({
      key: `in-${i.id}`,
      title: i.Title,
      type: 'Incident',
      link: i.ProjectID ? `/projects/${i.ProjectID}` : '/my-work',
      due: info.due ? info.due.toISOString() : null,
      days: info.hoursLeft === null ? null : info.hoursLeft / 24,
      status: i.Status,
      severity: i.Severity,
    })
  }

  // ที่มีกำหนด: เอาเฉพาะที่ถึงใน 7 วันหรือเลยแล้ว เรียงด่วนสุดขึ้นก่อน
  // ที่ไม่มีกำหนด: เอาทั้งหมด ต่อท้าย เรียง Incident ก่อน (เป็นปัญหาที่ค้างอยู่)
  const dated = rows.filter(r => r.days !== null && r.days <= DUE_WINDOW_DAYS)
    .sort((a, b) => (a.days as number) - (b.days as number))
  const undated = rows.filter(r => r.days === null)
    .sort((a, b) => typeRank(a.type) - typeRank(b.type) || a.title.localeCompare(b.title, 'th'))

  return [...dated, ...undated]
}

const typeRank = (t: DueType): number => (t === 'Incident' ? 0 : t === 'Ticket' ? 1 : 2)

export const isOverdue = (r: DueRow): boolean => r.days !== null && r.days < 0
export const isUndated = (r: DueRow): boolean => r.days === null
