// กล่อง "รอรับงาน" — งานที่คนอื่นมอบหมายมาแต่เรายังไม่ได้กดรับ
//
// ปัญหาที่แก้: งานที่ถูกมอบหมายมาโผล่ปนกับงานที่เรารับไว้แล้วทันที ทำให้แยกไม่ออกว่า
// อันไหน "เรารู้แล้วและกำลังทำ" กับอันไหน "มีคนโยนมาแต่เรายังไม่เห็น"
// และคนที่มอบหมายก็ไม่มีทางรู้ว่าปลายทางเห็นแล้วหรือยัง
//
// กติกา: ยังไม่กดรับ = อยู่ในกล่องนี้เท่านั้น ไม่โผล่ในรายการงานของเรา
// กดรับแล้ว = ออกจากกล่อง เข้ารายการงานตามปกติ และคนที่มอบหมายได้เมลแจ้ง

export type AckKind = 'Ticket' | 'Task' | 'Incident'

export interface AckLike {
  id: number
  Title: string
  IsAcknowledged?: boolean
  AssignedEmail?: string
  Status?: string
  IsCompleted?: boolean
  DueDate?: string
  Severity?: string
  Priority?: string | number
  ProjectID?: number
  Created?: string
  AssignedTo?: string
  /** ผู้แจ้ง — ใช้ส่งเมลกลับตอนกดรับ */
  Author?: { Title: string; EMail?: string }
  CreatedByEmail?: string
  CustomerEmail?: string
  CustomerName?: string
}

export interface AckRow {
  key: string
  kind: AckKind
  id: number
  title: string
  link: string
  /** ชื่อคนที่มอบหมาย/แจ้งงานมา — ว่างถ้าไม่รู้ */
  from: string
  fromEmail: string
  due?: string
  tag?: string          // ความสำคัญ/ความรุนแรง
  status?: string
  created?: string
  listName: string
}

/** งานที่ปิดแล้วไม่ต้องมารอรับ — ไม่มีอะไรให้ทำต่อ */
const DONE_TICKET = ['Resolved', 'Closed', 'Cancelled']
const DONE_INCIDENT = ['Resolved', 'Closed', 'Done', 'Completed']

const norm = (e?: string): string => (e ?? '').trim().toLowerCase()

/**
 * งานชิ้นนี้รอเรากดรับอยู่ไหม
 *
 * เงื่อนไข: มอบหมายให้เรา · ยังไม่ได้กดรับ · ยังไม่ปิด
 * งานที่เราสร้างเองและมอบหมายให้ตัวเองไม่ต้องรอรับ — เรารู้อยู่แล้ว จึงถือว่ารับแล้ว
 */
export function needsAck(item: AckLike, kind: AckKind, myEmail?: string): boolean {
  const me = norm(myEmail)
  if (!me || norm(item.AssignedEmail) !== me) return false
  if (item.IsAcknowledged) return false
  if (kind === 'Ticket' && DONE_TICKET.includes(item.Status ?? '')) return false
  if (kind === 'Incident' && DONE_INCIDENT.includes(item.Status ?? '')) return false
  if (kind === 'Task' && item.IsCompleted) return false
  // มอบหมายให้ตัวเอง = รู้อยู่แล้ว
  const submitter = norm(item.Author?.EMail || item.CreatedByEmail)
  if (submitter && submitter === me) return false
  return true
}

const LIST_OF: Record<AckKind, string> = {
  Ticket: 'HD_Tickets',
  Task: 'PM_Tasks',
  Incident: 'PM_Incidents',
}

function toRow(item: AckLike, kind: AckKind): AckRow {
  return {
    key: `${kind}-${item.id}`,
    kind,
    id: item.id,
    title: item.Title,
    // Task ยังไม่มีหน้าของตัวเอง → เปิดหน้าโครงการ
    link: kind === 'Ticket' ? `/tickets/${item.id}`
      : kind === 'Incident' ? `/incidents/${item.id}`
      : `/projects/${item.ProjectID ?? 0}`,
    from: item.Author?.Title || item.CustomerName || '',
    fromEmail: item.Author?.EMail || item.CreatedByEmail || item.CustomerEmail || '',
    due: item.DueDate,
    // Task ใช้ตัวเลขความสำคัญ แสดงเป็นป้ายก็ยังอ่านออก
    tag: item.Severity || (item.Priority != null ? String(item.Priority) : undefined),
    status: item.Status,
    created: item.Created,
    listName: LIST_OF[kind],
  }
}

/**
 * กล่องรอรับงาน เรียงงานที่รอนานที่สุดขึ้นก่อน
 * ที่เรียงแบบนี้เพราะงานที่ค้างรอนานคือตัวที่คนมอบหมายกำลังสงสัยว่าถึงไหมแล้ว
 */
export function buildAckInbox(
  tickets: AckLike[],
  tasks: AckLike[],
  incidents: AckLike[],
  myEmail?: string,
): AckRow[] {
  const rows: AckRow[] = []
  for (const t of tickets) if (needsAck(t, 'Ticket', myEmail)) rows.push(toRow(t, 'Ticket'))
  for (const t of tasks) if (needsAck(t, 'Task', myEmail)) rows.push(toRow(t, 'Task'))
  for (const i of incidents) if (needsAck(i, 'Incident', myEmail)) rows.push(toRow(i, 'Incident'))
  return rows.sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''))
}

/** ตัวแปรของเมล "รับงานแล้ว" ที่ส่งกลับไปหาคนมอบหมาย */
export function ackVars(row: AckRow, agentName: string, baseUrl = ''): Record<string, string> {
  const base = baseUrl.replace(/\/+$/, '')
  return {
    work_kind: row.kind,
    work_title: row.title,
    agent_name: agentName,
    from_name: row.from || row.fromEmail || '-',
    due_date: (row.due ?? '').slice(0, 10) || 'ไม่ได้กำหนด',
    // ค่าที่ไม่มีต้องอ่านออก ไม่ใช่ช่องว่างกลางเมล
    tag: row.tag || '-',
    status: row.status || '-',
    link: `${base}/#${row.link}`,
  }
}

/** ฟิลด์ที่ต้องเขียนลง SharePoint ตอนกดรับ */
export const ackPayload = (byName: string): Record<string, unknown> => ({
  IsAcknowledged: true,
  AcknowledgedBy: byName,
  AcknowledgedDate: new Date().toISOString(),
})

/** ฟิลด์ที่ต้องล้างตอนโยนงานให้คนอื่น — ของคนก่อนหน้าใช้กับคนใหม่ไม่ได้ */
export const ackResetFields = (): Record<string, unknown> => ({
  IsAcknowledged: false,
  AcknowledgedBy: null,
  AcknowledgedDate: null,
})

export interface AssignFields {
  /** ฟิลด์ที่เขียนได้แน่ ๆ (ผู้รับผิดชอบ) */
  base: Record<string, unknown>
  /** ฟิลด์เรื่องการรับงาน — แยกไว้เพราะลิสต์ที่ยังไม่มีคอลัมน์นี้จะเขียนไม่ผ่าน */
  ack: Record<string, unknown>
}

/**
 * ฟิลด์ที่ต้องเขียนตอนมอบหมายงาน
 *
 * เหตุที่ต้องมีตัวกลาง: การมอบหมายเกิดได้จาก 5 ที่ (หน้า Ticket, หน้า Incident,
 * หน้าโครงการ, Agent Dashboard, ปฏิทิน) และทุกที่ "ลืม" ล้างสถานะการรับงาน
 * ผลคืองานที่คนก่อนหน้ากดรับไว้แล้ว พอโยนต่อ มันวิ่งเข้ารายการของคนใหม่ทันที
 * โดยไม่ต้องกดรับ — ประตูรับงานจึงเป็นแค่ของตอนสร้างงานใหม่ ไม่ใช่ตอนโยนงาน
 *
 * มอบหมายให้ตัวเอง = ถือว่ารับแล้ว ไม่ต้องเด้งเข้ากล่องรอรับงานของตัวเอง
 * (needsAck ก็ตัดเคสนี้อยู่แล้ว แต่เขียนค่าให้ตรงด้วย เพื่อไม่ให้ข้อมูลขัดกับหน้าจอ)
 */
export function assignFields(
  assigneeEmail: string,
  assigneeName: string,
  actorEmail: string | undefined,
  nameField: 'AssignedToName' | 'AssignedTo',
): AssignFields {
  const to = (assigneeEmail ?? '').trim()
  const self = !!to && norm(to) === norm(actorEmail)
  return {
    base: { AssignedEmail: to || null, [nameField]: assigneeName ?? '' },
    ack: self
      ? { IsAcknowledged: true, AcknowledgedBy: assigneeName ?? '', AcknowledgedDate: new Date().toISOString() }
      : ackResetFields(),
  }
}
