// เนื้อนัดหมายในปฏิทิน (Outlook / Teams) — รูปแบบทางการ สไตล์เดียวกับอีเมลของระบบ
//
// เดิมส่งคำอธิบายดิบ ๆ เข้าไปเป็น body ผู้เข้าร่วมเปิดนัดแล้วเห็นแค่ข้อความก้อนเดียว
// ไม่รู้ว่าเป็นงานประเภทไหน เลขที่อะไร ใครรับผิดชอบ กำหนดส่งเมื่อไหร่ — ต้องเปิดระบบดูอีกที
// ซึ่งลูกค้าที่ถูกเชิญทำไม่ได้ เพราะเข้าระบบไม่ได้
//
// ตัวนี้เป็นฟังก์ชันบริสุทธิ์: ข้อความทุกช่องที่คนพิมพ์ถูกหนีอักขระ (เนื้อนัดเป็น HTML
// ที่ Outlook แสดงตรง ๆ — พิมพ์ "<3" ในคำอธิบายแล้วนัดเพี้ยนไม่ได้)

import { escapeHtml } from './emailTemplate'

export type MeetingKind = 'Ticket' | 'Task' | 'Incident' | 'Meeting'

export interface MeetingInput {
  kind: MeetingKind
  title: string
  /** เลขที่ เช่น TK-0042 — ไม่มีก็ไม่แสดงแถว */
  ref?: string
  projectName?: string
  assigneeName?: string
  /** ลูกค้า / คนแจ้งสำรอง */
  customerName?: string
  /** ความสำคัญ (Ticket) หรือความรุนแรง (Incident) */
  priority?: string
  /** กำหนดส่ง / ครบ SLA — แสดงตามที่ส่งมา */
  due?: string
  /** รายละเอียด / โน้ต — หลายบรรทัดได้ */
  description?: string
  /** ลิงก์เข้าระบบ — ว่างได้ (เช่นนัดส่วนตัว) */
  link?: string
  /** ชื่อคนสร้างนัด */
  organizer?: string
  isOnlineMeeting?: boolean
}

const KIND_LABEL: Record<MeetingKind, string> = {
  Ticket: 'Ticket', Task: 'Task', Incident: 'Incident', Meeting: 'นัดหมาย',
}

/** สีแถบหัวตามชนิด — Incident เป็นสีเตือน อย่างอื่นสีน้ำเงินของระบบ */
const KIND_COLOR: Record<MeetingKind, { band: string; deep: string }> = {
  Ticket:   { band: '#2471a3', deep: '#1a5276' },
  Task:     { band: '#2471a3', deep: '#1a5276' },
  Incident: { band: '#c0392b', deep: '#922b21' },
  Meeting:  { band: '#1c2e4a', deep: '#14213a' },
}

const FONT = "font-family:'Segoe UI',Arial,sans-serif"

const row = (label: string, value: string | undefined, bold = false): string => {
  const v = (value ?? '').trim()
  if (!v) return ''   // แถวที่ไม่มีค่าไม่แสดง — ช่องว่างกลางตารางดูเหมือนระบบพัง
  return `<tr><td style="padding:5px 0;color:#888888;width:120px;vertical-align:top;">${escapeHtml(label)}</td>` +
    `<td style="padding:5px 0;color:#222222;${bold ? 'font-weight:bold;' : ''}">${escapeHtml(v)}</td></tr>`
}

/** HTML เนื้อนัดหมาย — ใช้ตรง ๆ กับ Graph (contentType HTML) */
export function meetingBody(i: MeetingInput): string {
  const c = KIND_COLOR[i.kind]
  const kind = KIND_LABEL[i.kind]
  const head = i.ref ? `${kind} · ${i.ref}` : kind
  const desc = escapeHtml((i.description ?? '').trim()).replace(/\r?\n/g, '<br>')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:20px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="${c.deep}" style="padding:8px 28px;${FONT};color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="${c.band}" style="padding:18px 28px;${FONT};color:#ffffff;">
        <div style="font-size:12px;letter-spacing:1px;opacity:.85;">${escapeHtml(head)}</div>
        <div style="font-size:19px;font-weight:bold;margin-top:4px;">${escapeHtml(i.title)}</div>
      </td></tr>
      <tr><td style="padding:24px 28px;${FONT};color:#333333;font-size:14px;line-height:1.7;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
          <tr><td style="padding:12px 18px 4px;${FONT};color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;">รายละเอียด</td></tr>
          <tr><td style="padding:0 18px 14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;${FONT}">
              ${row('โครงการ', i.projectName)}
              ${row('ผู้รับผิดชอบ', i.assigneeName, true)}
              ${row('ลูกค้า', i.customerName)}
              ${row(i.kind === 'Incident' ? 'ความรุนแรง' : 'ความสำคัญ', i.priority)}
              ${row(i.kind === 'Incident' ? 'ครบ SLA' : 'กำหนดส่ง', i.due)}
              ${row('ผู้นัด', i.organizer)}
            </table>
          </td></tr>
        </table>
        ${desc ? `<div style="margin-top:16px;padding:12px 16px;border-left:4px solid ${c.band};background-color:#fafbfc;color:#333333;font-size:14px;line-height:1.7;">${desc}</div>` : ''}
        ${i.isOnlineMeeting ? `<p style="margin:16px 0 0;color:#555555;font-size:13px;">🎥 ประชุมออนไลน์ผ่าน Microsoft Teams — ลิงก์เข้าร่วมอยู่ด้านล่างของนัดหมายนี้</p>` : ''}
        ${i.link ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
          <tr><td bgcolor="#1c2e4a" style="padding:10px 24px;"><a href="${escapeHtml(i.link)}" style="${FONT};color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">เปิดดูในระบบ</a></td></tr>
        </table>` : ''}
      </td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;${FONT};color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; นัดหมายนี้สร้างจากระบบ Helpdesk</td></tr>
    </table>
  </td></tr>
</table>`
}
