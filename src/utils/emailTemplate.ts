// หา template อีเมลจากรายการที่โหลดมา — แยกจาก emailService เพราะเป็นตรรกะล้วน
//
// อยู่ในไฟล์ของตัวเองเพื่อให้ทดสอบใน node ได้ (emailService ลาก MSAL config มาด้วย)
// และเพราะกฎ "อันไหนนับว่าเปิด" เป็นเรื่องของข้อมูลที่คนกรอก ไม่ใช่เรื่องการส่งเมล

export interface TemplateRow {
  EventKey: string
  Subject?: string
  Body?: string
  IsEnabled?: unknown
}

const keyOf = (v: unknown): string => (typeof v === 'string' ? v : '').trim().toLowerCase()

/**
 * หา template ที่เปิดใช้อยู่ — เทียบแบบตัดช่องว่างและไม่สนตัวพิมพ์
 *
 * EventKey เป็นข้อความที่คนพิมพ์เองใน SharePoint ช่องว่างท้ายบรรทัดหรือ
 * ตัวพิมพ์ใหญ่หนึ่งตัวก็ทำให้หาไม่เจอ แล้วระบบจะบอกว่า "ยังไม่ได้เปิด template"
 * ทั้งที่แถวนั้นเปิดอยู่ตรงหน้า — คนจะไปนั่งกดเปิดซ้ำแล้วก็ยังไม่ได้ผล
 */
export function findTemplate<T extends TemplateRow>(templates: T[], eventKey: string): T | undefined {
  const want = keyOf(eventKey)
  return templates.find(t => keyOf(t.EventKey) === want && isOn(t.IsEnabled))
}

/**
 * IsEnabled เปิดอยู่ไหม
 *
 * คอลัมน์อาจถูกสร้างเป็น Yes/No (boolean) หรือ Choice/Text ("Yes"/"ใช่") แล้วแต่คนสร้าง
 * ถ้าไม่มีคอลัมน์นี้เลย ค่าจะเป็น undefined — ถือว่า "เปิด" เพราะการมีแถวอยู่
 * ก็คือความตั้งใจจะใช้แล้ว ดีกว่าเงียบเพราะคอลัมน์ที่ไม่มีอยู่จริง
 */
export function isOn(v: unknown): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toLowerCase()
  return !['false', 'no', '0', 'ไม่', 'ปิด', ''].includes(s)
}

/** อธิบายว่าทำไมหา template ไม่เจอ — ต้องชี้ไปที่สิ่งที่ต้องไปแก้จริง */
export function templateProblem(templates: TemplateRow[], eventKey: string): string {
  const want = keyOf(eventKey)
  const row = templates.find(t => keyOf(t.EventKey) === want)
  if (row) return `template "${eventKey}" มีอยู่ แต่ช่อง IsEnabled ถูกปิดไว้`
  // ชื่อใกล้เคียง = พิมพ์ผิด/ขีดหาย ซึ่งพบบ่อยกว่าลืมสร้างแถว
  const near = templates
    .map(t => (typeof t.EventKey === 'string' ? t.EventKey : ''))
    .filter(k => k && (keyOf(k).includes(want.slice(0, 6)) || want.includes(keyOf(k).slice(0, 6))))
  if (near.length) return `ไม่พบ EventKey "${eventKey}" — ที่ใกล้เคียงในลิสต์: ${near.join(', ')}`
  return `ไม่พบแถว EventKey "${eventKey}" ใน HD_EmailTemplates (มีทั้งหมด ${templates.length} แถว)`
}

// ── แทนค่าลง template ────────────────────────────────────────────────────────
// เดิม render() แทนค่าตรง ๆ ทุกตัวแปรถือเป็น HTML หมด — ชื่อลูกค้า คำอธิบาย
// ข้อความปิดงาน ถูกยัดเข้าเมลดิบ ๆ พิมพ์ "<3" เมลก็เพี้ยน และเป็นช่องให้คนใส่ HTML
// ที่ตัวเองเลือกเข้าเมลที่ส่งในนามบริษัท
//
// กฎใหม่: ตัวแปรเป็น "ข้อความ" เป็นค่าเริ่มต้น → หนีอักขระเสมอ
// ตัวที่ตั้งใจให้เป็น HTML (ตารางที่วางมา, คำอธิบายที่แปลง <br> แล้ว) ต้องห่อด้วย html()
// ให้เห็นชัดที่จุดเรียกว่า "ตัวนี้ผ่านการกรองมาแล้ว" ไม่ใช่เดาจากชื่อตัวแปร

/** ค่าที่เป็น HTML จริง ผ่านการกรอง/หนีอักขระมาแล้ว — ห้ามสร้างจากข้อความดิบ */
export interface HtmlVar { readonly __html: string }
export const html = (s: string): HtmlVar => ({ __html: s ?? '' })
export const isHtmlVar = (v: unknown): v is HtmlVar =>
  !!v && typeof v === 'object' && typeof (v as HtmlVar).__html === 'string'

export type MailVars = Record<string, string | HtmlVar | undefined>

export function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** ข้อความหลายบรรทัด → HTML ที่ปลอดภัย (หนีอักขระก่อน แล้วค่อยขึ้นบรรทัดใหม่) */
export const textToHtml = (s: string | undefined): HtmlVar =>
  html(escapeHtml(s ?? '').replace(/\r?\n/g, '<br>'))

export interface Rendered {
  text: string
  /** ตัวแปรใน template ที่โค้ดไม่ได้ส่งมา — ต้องบอก ไม่ใช่ปล่อยให้ {{x}} โผล่ในเมล */
  missing: string[]
}

/**
 * แทน {{ตัวแปร}} ลง template
 *
 * ตัวแปรที่ไม่รู้จัก: เดิมปล่อย {{sla_hours}} ไว้เป็นตัวหนังสือในเมลถึงลูกค้า
 * ตอนนี้ลบทิ้งแล้วรายงานชื่อกลับมา — ให้หน้า Diagnostic ชี้ให้เห็นก่อนถึงมือลูกค้า
 */
export function renderTemplate(template: string, vars: MailVars): Rendered {
  const missing: string[] = []
  const text = (template ?? '').replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key]
    if (v === undefined) { missing.push(key); return '' }
    return isHtmlVar(v) ? v.__html : escapeHtml(v)
  })
  return { text, missing: [...new Set(missing)] }
}

/** Subject เป็นข้อความล้วน ไม่ใช่ HTML — ไม่หนีอักขระ แต่ก็ไม่ให้แท็กหลุดเข้า */
export function renderSubject(template: string, vars: MailVars): string {
  return (template ?? '').replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key]
    if (v === undefined) return ''
    return (isHtmlVar(v) ? v.__html.replace(/<[^>]*>/g, '') : v).replace(/\s+/g, ' ').trim()
  })
}

/** ดึงชื่อตัวแปรที่ template ใช้ — ให้ Diagnostic เทียบกับที่โค้ดส่งจริง */
export const placeholdersOf = (s: string | undefined): string[] =>
  [...new Set([...(s ?? '').matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]

/**
 * ตัวแปรที่โค้ดส่งให้แต่ละ event จริง ๆ — ที่เดียว ใช้ทั้ง Diagnostic และเอกสาร
 *
 * เอกสารเคยมี template ที่โค้ดไม่เคยส่ง (ticket_status_changed, task_assigned,
 * comment_mention, incident_status_changed) คนสร้างไปก็ไม่มีอะไรเกิดขึ้น
 * รายการนี้คือความจริงจากโค้ด ไม่ใช่จากความตั้งใจ
 */
export const EVENT_VARS: Record<string, readonly string[]> = {
  ticket_created:    ['ticket_number', 'ticket_title', 'priority', 'category', 'description', 'customer_name', 'assigned_name', 'link'],
  comment_added:     ['ticket_number', 'ticket_title', 'customer_name', 'assigned_name', 'comment_text', 'link'],
  incident_created:  ['incident_title', 'severity', 'status', 'description', 'resolution', 'incident_date', 'sla_hours', 'project_name', 'assigned_name', 'link', 'incident_status'],
  incident_assigned: ['incident_title', 'severity', 'status', 'description', 'resolution', 'incident_date', 'sla_hours', 'project_name', 'assigned_name', 'link', 'incident_status'],
  incident_resolved: ['incident_title', 'severity', 'status', 'description', 'resolution', 'incident_date', 'sla_hours', 'project_name', 'assigned_name', 'link', 'incident_status'],
  work_assigned:     ['work_kind', 'work_title', 'agent_name', 'from_name', 'due_date', 'tag', 'status', 'link'],
  work_acknowledged: ['work_kind', 'work_title', 'agent_name', 'from_name', 'due_date', 'tag', 'status', 'link'],
  leave_requested:   ['requester_name', 'leave_type', 'leave_date', 'approver_name', 'link'],
  leave_decision:    ['requester_name', 'leave_type', 'leave_date', 'leave_status', 'approver_name', 'link'],
  // สี่ตัวนี้เคยมีแต่ template ไม่มีโค้ดส่ง — ต่อสายแล้ว
  ticket_status_changed:   ['ticket_number', 'ticket_title', 'ticket_status', 'customer_name', 'assigned_name', 'link'],
  task_assigned:           ['task_title', 'assigned_name', 'due_date', 'task_note', 'link',
                            'work_kind', 'work_title', 'agent_name', 'from_name', 'tag', 'status'],
  comment_mention:         ['ticket_number', 'ticket_title', 'comment_text', 'mentioned_by', 'link'],
  incident_status_changed: ['incident_title', 'severity', 'status', 'incident_status', 'description', 'resolution',
                            'incident_date', 'sla_hours', 'project_name', 'assigned_name', 'link'],
}

export const KNOWN_EVENTS = Object.keys(EVENT_VARS)

/**
 * ลิงก์เข้าแอปสำหรับใส่ในเมล
 *
 * เดิม 6 จุดใช้ window.location.origin → ได้ https://itservices.co.th ไม่มี /helpdesk/
 * ปุ่ม "เปิดดูในระบบ" จึงพาไปหน้าราก ส่วนอีก 2 จุดใช้ origin+pathname ซึ่งถูก —
 * สองมาตรฐานในโปรเจกต์เดียว ที่นี่จึงมีทางเดียว
 */
export function appLink(route = '', loc: { origin: string; pathname: string } = window.location): string {
  // pathname ตอนอยู่ในแอปคือ /helpdesk/ (หรือ /helpdesk/index.html) — เอาแค่โฟลเดอร์
  const dir = loc.pathname.replace(/[^/]*$/, '').replace(/\/+$/, '')
  const base = `${loc.origin}${dir}`
  const r = (route ?? '').trim()
  if (!r) return base || loc.origin
  return `${base}/#${r.startsWith('/') ? r : `/${r}`}`
}

/** ข้อความบอกผู้ใช้เมื่อเมลไม่ออก — ต้องบอกเหตุจริง ไม่ใช่ "ยังไม่ได้เปิด template" ทุกกรณี */
export function mailFailText(
  prefix: string,
  res: { ok: boolean; reason?: string; detail?: string },
  eventKey: string,
  whoMisses: string,
): string | null {
  if (res.ok || res.reason === 'no-recipient') return null
  if (res.reason === 'no-template') return `${prefix} แต่ไม่ได้ส่งเมล — ${res.detail ?? `ยังไม่มี template "${eventKey}"`}`
  return `${prefix} แต่ส่งเมลไม่สำเร็จ — ${whoMisses}${res.detail ? ` (${res.detail})` : ''}`
}
