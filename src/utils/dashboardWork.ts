// รวม Ticket / Incident / Task ให้อยู่ในรูปเดียวกัน สำหรับหน้า Agent Dashboard
//
// เดิมหน้านี้เห็นแค่ Ticket ซึ่งเป็นแค่ส่วนเดียวของงานที่คนหนึ่งถืออยู่จริง
// พอ Incident กับ Task ไม่โผล่ ตัวเลขบนหน้าจึงบอกภาระงานได้ไม่ครบ
// และหัวหน้าที่ดูหน้านี้เพื่อจ่ายงานก็ตัดสินจากข้อมูลครึ่งเดียว
//
// ทั้งสามอย่างมีคอลัมน์ไม่เหมือนกัน (Priority/Severity, DueDate/IncidentDate,
// Status ที่เป็นข้อความ กับ IsCompleted ที่เป็น yes/no) จึงแปลงเป็นรูปเดียวกันก่อน
// แล้วค่อยกรอง/นับ — ไม่งั้นต้องเขียนตรรกะกรองสามชุดที่เพี้ยนจากกันได้

export type WorkKind = 'ticket' | 'incident' | 'task'

export interface WorkRow {
  kind: WorkKind
  id: number
  title: string
  /** เลขอ้างอิงที่คนใช้เรียก เช่น TicketNumber — ไม่มีก็ใช้ #id */
  ref: string
  status: string
  /** ความเร่งด่วน: Ticket ใช้ Priority, Incident ใช้ Severity, Task ไม่มี */
  priority: string
  assignedName: string
  assignedEmail: string
  /** ผู้แจ้ง/ผู้สั่งงาน */
  requester: string
  due: string
  modified: string
  projectId?: number
  projectName: string
  /** ยังไม่กดรับงาน — ยังไม่มีใครเริ่มลงมือจริง */
  waitingAck: boolean
}

/** สถานะที่ถือว่าจบแล้ว ไม่ต้องตามอีก */
export const DONE_STATUS = ['Resolved', 'Closed', 'Completed', 'Cancelled']
export const isDone = (status: string): boolean => DONE_STATUS.includes(status)

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const norm = (v?: string): string => (v ?? '').trim().toLowerCase()

export interface ProjectName { id: number; Title: string }

const nameOf = (projects: ProjectName[], id?: number): string =>
  (id == null ? '' : projects.find(p => p.id === id)?.Title ?? '')

interface TicketLike {
  id: number; Title: string; TicketNumber?: string; Status?: string; Priority?: string
  AssignedToName?: string; AssignedEmail?: string; CustomerName?: string; CustomerEmail?: string
  DueDate?: string; Modified?: string; ProjectID?: number
  IsAcknowledged?: boolean
}

export function ticketRows(tickets: TicketLike[], projects: ProjectName[] = []): WorkRow[] {
  return tickets.map(t => ({
    kind: 'ticket' as const,
    id: t.id,
    title: s(t.Title),
    ref: s(t.TicketNumber) || `#${t.id}`,
    status: s(t.Status) || 'Open',
    priority: s(t.Priority),
    assignedName: s(t.AssignedToName),
    assignedEmail: s(t.AssignedEmail),
    requester: s(t.CustomerName) || s(t.CustomerEmail),
    due: s(t.DueDate),
    modified: s(t.Modified),
    projectId: t.ProjectID,
    projectName: nameOf(projects, t.ProjectID),
    waitingAck: !!s(t.AssignedEmail) && t.IsAcknowledged === false,
  }))
}

interface IncidentLike {
  id: number; Title: string; Status?: string; Severity?: string
  AssignedTo?: string; AssignedEmail?: string
  IncidentDate?: string; SLADue?: string; Modified?: string; ProjectID?: number
  Author?: { Title?: string }
  IsAcknowledged?: boolean
}

export function incidentRows(incidents: IncidentLike[], projects: ProjectName[] = []): WorkRow[] {
  return incidents.map(i => ({
    kind: 'incident' as const,
    id: i.id,
    title: s(i.Title),
    ref: `#${i.id}`,
    status: s(i.Status) || 'Open',
    // Severity คือความเร่งด่วนของ Incident — วางในคอลัมน์เดียวกับ Priority ของ Ticket
    priority: s(i.Severity),
    assignedName: s(i.AssignedTo),
    assignedEmail: s(i.AssignedEmail),
    requester: s(i.Author?.Title),
    // เส้นตายของ Incident คือ SLA ไม่ใช่วันที่เกิดเหตุ
    due: s(i.SLADue),
    modified: s(i.Modified),
    projectId: i.ProjectID,
    projectName: nameOf(projects, i.ProjectID),
    waitingAck: !!s(i.AssignedEmail) && i.IsAcknowledged === false,
  }))
}

interface TaskLike {
  id: number; Title: string; IsCompleted?: boolean
  AssignedTo?: string; AssignedEmail?: string
  DueDate?: string; Modified?: string; ProjectID?: number
  Author?: { Title?: string }
  IsAcknowledged?: boolean
}

export function taskRows(tasks: TaskLike[], projects: ProjectName[] = []): WorkRow[] {
  return tasks.map(t => ({
    kind: 'task' as const,
    id: t.id,
    title: s(t.Title),
    ref: `#${t.id}`,
    // Task เก็บสถานะเป็น yes/no — แปลงเป็นคำเดียวกับที่เหลือ ให้ตัวกรองเดียวใช้ได้ทั้งสาม
    status: t.IsCompleted ? 'Completed' : 'In Progress',
    priority: '',
    assignedName: s(t.AssignedTo),
    assignedEmail: s(t.AssignedEmail),
    requester: s(t.Author?.Title),
    due: s(t.DueDate),
    modified: s(t.Modified),
    projectId: t.ProjectID,
    projectName: nameOf(projects, t.ProjectID),
    waitingAck: !!s(t.AssignedEmail) && t.IsAcknowledged === false,
  }))
}

export interface WorkStats {
  total: number
  open: number
  inProgress: number
  unassigned: number
  done: number
}

/**
 * ตัวเลขสรุป — นับ "ยังไม่มีคนรับผิดชอบ" แทน Pending
 *
 * Pending มีเฉพาะ Ticket ตัวเลขจึงเทียบข้ามชนิดไม่ได้ ส่วนงานที่ยังไม่มีเจ้าของ
 * มีได้ทั้งสามชนิด และเป็นสิ่งที่ต้องลงมือจริง ๆ ไม่ใช่แค่ตัวเลขสวย ๆ
 */
export function workStats(rows: WorkRow[]): WorkStats {
  return {
    total: rows.length,
    open: rows.filter(r => r.status === 'Open').length,
    inProgress: rows.filter(r => r.status === 'In Progress').length,
    unassigned: rows.filter(r => !r.assignedEmail && !isDone(r.status)).length,
    done: rows.filter(r => isDone(r.status)).length,
  }
}

export interface WorkFilter {
  search?: string
  status?: string
  priority?: string
  /** กรองด้วยอีเมลผู้รับผิดชอบ (บางส่วนก็ได้) */
  assignee?: string
  /** ซ่อนงานที่จบแล้ว */
  hideDone?: boolean
}

/** กรองแบบเดียวกันทั้งสามชนิด — ตัวกรองชุดเดียว ไม่ใช่สามชุดที่เพี้ยนจากกันได้ */
export function filterWork(rows: WorkRow[], f: WorkFilter): WorkRow[] {
  const q = norm(f.search)
  const assignee = norm(f.assignee)
  return rows.filter(r => {
    if (f.status && r.status !== f.status) return false
    if (f.priority && r.priority !== f.priority) return false
    if (f.hideDone && isDone(r.status)) return false
    if (assignee && !norm(r.assignedEmail).includes(assignee)) return false
    if (!q) return true
    return norm(r.title).includes(q)
      || norm(r.ref).includes(q)
      || norm(r.projectName).includes(q)
      || norm(r.assignedName).includes(q)
      || norm(r.assignedEmail).includes(q)
      || norm(r.requester).includes(q)
  })
}

/** สถานะที่มีอยู่จริงในชุดนี้ — ตัวเลือกที่กรองแล้วไม่เจออะไรเลยไม่ควรมี */
export function statusOptions(rows: WorkRow[]): string[] {
  const order = ['Open', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Completed', 'Cancelled']
  const found = [...new Set(rows.map(r => r.status).filter(Boolean))]
  return found.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })
}

/** ความเร่งด่วนที่มีอยู่จริงในชุดนี้ เรียงจากด่วนสุด */
export function priorityOptions(rows: WorkRow[]): string[] {
  const order = ['Critical', 'High', 'Medium', 'Low']
  const found = [...new Set(rows.map(r => r.priority).filter(Boolean))]
  return found.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })
}

/** ลิงก์ของงานแต่ละชนิด — Task ยังไม่มีหน้าของตัวเอง จึงเปิดที่โครงการแทน */
export function workLink(r: WorkRow): string {
  if (r.kind === 'ticket') return `/tickets/${r.id}`
  if (r.kind === 'incident') return `/incidents/${r.id}`
  return r.projectId ? `/projects/${r.projectId}` : '/projects'
}
