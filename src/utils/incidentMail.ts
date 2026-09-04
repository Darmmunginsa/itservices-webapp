// ประกอบผู้รับและตัวแปรของเมล Incident ให้ทุกหน้าที่สร้าง/แก้ Incident ใช้ชุดเดียวกัน
//
// มี 3 ทางที่แตะ Incident ได้ (หน้าโครงการ, หน้าแจ้งงาน, Add-in) ถ้าต่างคนต่างประกอบ
// ผู้รับเอง จะเพี้ยนกันจนบางคนได้เมลบางจังหวะเท่านั้น ซึ่งแย่กว่าไม่ได้เลย
// เพราะคนอ่านจะเชื่อว่าตัวเองได้ครบ

export interface IncidentMailInput {
  title: string
  severity: string
  status: string
  description?: string
  resolution?: string
  incidentDate?: string
  slaHours?: number | null
  projectName?: string
  projectId?: number | string
  assignedName?: string
  assignedEmail?: string
  /** ผู้แจ้ง/ผู้สร้างเคส */
  requesterEmail?: string
  /** คนอื่นที่ควรรู้ เช่นเจ้าของโครงการ สมาชิกทีม */
  watchers?: (string | undefined)[]
  /** คนที่กดปุ่ม — ไม่ต้องส่งเมลหาตัวเอง */
  actorEmail?: string
  baseUrl?: string
}

export interface IncidentMailPlan {
  to: string[]
  cc: string[]
  vars: Record<string, string>
}

const norm = (e?: string): string => (e ?? '').trim().toLowerCase()

/**
 * ผู้รับของเมล Incident
 *
 * To = คนที่ต้องลงมือ (ผู้รับผิดชอบ) · CC = คนที่ต้องรู้ (ผู้แจ้ง + ผู้เกี่ยวข้อง)
 * ถ้ายังไม่มีผู้รับผิดชอบ ผู้แจ้งจะเลื่อนขึ้นมาเป็น To แทน — เมลที่มีแต่ CC ไม่มี To ส่งไม่ได้
 */
export function incidentRecipients(i: IncidentMailInput): { to: string[]; cc: string[] } {
  const actor = norm(i.actorEmail)
  const seen = new Set<string>()
  const take = (list: (string | undefined)[]): string[] => {
    const out: string[] = []
    for (const raw of list) {
      const e = (raw ?? '').trim()
      const k = norm(e)
      // คนกดเองไม่ต้องได้เมลแจ้งสิ่งที่ตัวเองเพิ่งทำ
      if (!k || !k.includes('@') || k === actor || seen.has(k)) continue
      seen.add(k)
      out.push(e)
    }
    return out
  }

  let to = take([i.assignedEmail])
  const rest = take([i.requesterEmail, ...(i.watchers ?? [])])
  if (to.length === 0) {
    // ไม่มีผู้รับผิดชอบ — ส่งหาผู้แจ้งเป็นหลักแทนที่จะไม่ส่งเลย
    to = rest.slice(0, 1)
    return { to, cc: rest.slice(1) }
  }
  return { to, cc: rest }
}

const SLA_TEXT = (h?: number | null): string => {
  if (!h || h <= 0) return ''
  if (h < 24) return `${h} ชั่วโมง`
  const d = h / 24
  return Number.isInteger(d) ? `${d} วัน` : `${h} ชั่วโมง`
}

/** ตัวแปรที่ template ใช้แทนค่าได้ — ค่าที่ไม่มีให้เป็นสตริงว่าง ไม่ใช่ undefined */
export function incidentVars(i: IncidentMailInput): Record<string, string> {
  const base = (i.baseUrl ?? '').replace(/\/+$/, '')
  return {
    incident_title: i.title ?? '',
    severity: i.severity ?? '',
    status: i.status ?? '',
    description: i.description ?? '',
    resolution: i.resolution ?? '',
    incident_date: (i.incidentDate ?? '').slice(0, 10),
    sla_hours: SLA_TEXT(i.slaHours),
    project_name: i.projectName ?? '',
    assigned_name: i.assignedName || i.assignedEmail || '-',
    link: i.projectId ? `${base}/#/projects/${i.projectId}` : base,
  }
}

export function incidentMailPlan(i: IncidentMailInput): IncidentMailPlan {
  const { to, cc } = incidentRecipients(i)
  return { to, cc, vars: incidentVars(i) }
}

/** เปลี่ยนไปเป็น "ปิดแล้ว" จริงหรือไม่ — แก้เคสที่ปิดอยู่แล้วไม่ต้องส่งซ้ำ */
export const justResolved = (next: string, prev?: string): boolean =>
  ['Resolved', 'Closed', 'Done', 'Completed'].includes(next) &&
  !['Resolved', 'Closed', 'Done', 'Completed'].includes(prev ?? '')

/** เพิ่งเปลี่ยนผู้รับผิดชอบหรือไม่ — ต้องมีคนใหม่จริง ๆ ไม่ใช่แค่บันทึกซ้ำ */
export const justAssigned = (next?: string, prev?: string): boolean =>
  !!norm(next) && norm(next) !== norm(prev)
