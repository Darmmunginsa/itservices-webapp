// แจ้งคนมอบหมายว่ารับงานแล้ว — ใช้ร่วมทุกที่ที่มีปุ่มรับทราบ
//
// มีปุ่มกดรับอยู่ 3 ที่ (กล่องรอรับงาน, หน้า Ticket, การ์ด Task ในโครงการ)
// ถ้าต่างที่ต่างส่งเอง จะกลายเป็นว่ากดจากบางที่แล้วคนสั่งงานไม่ได้รู้
// ซึ่งแย่กว่าไม่ส่งเลย เพราะคนกดเชื่อว่าแจ้งไปแล้ว
import { sendTemplateEmail } from './emailService'
import { createNotification } from './notificationService'
import { ackVars, type AckKind, type AckRow } from '../utils/ackInbox'

export interface AckNotifyInput {
  kind: AckKind
  id: number
  title: string
  link: string
  fromEmail?: string
  fromName?: string
  due?: string
  tag?: string
  status?: string
  agentName: string
  agentEmail: string
}

export type AckNotifyResult = { sent: boolean; reason?: 'no-recipient' | 'no-template' | 'failed' }

export async function notifyAcknowledged(i: AckNotifyInput): Promise<AckNotifyResult> {
  const to = (i.fromEmail ?? '').trim()
  // ไม่รู้ว่าใครสั่งงาน หรือสั่งงานตัวเอง — ไม่มีใครต้องแจ้ง
  if (!to || to.toLowerCase() === i.agentEmail.toLowerCase()) return { sent: false, reason: 'no-recipient' }

  createNotification({
    recipients: [to],
    title: `\u2705 ${i.agentName} รับงานแล้ว`,
    message: i.title,
    linkPath: i.link,
    eventType: 'work_acknowledged',
  })

  const row: AckRow = {
    key: `${i.kind}-${i.id}`, kind: i.kind, id: i.id, title: i.title, link: i.link,
    from: i.fromName ?? '', fromEmail: to, due: i.due, tag: i.tag, status: i.status,
    listName: '',
  }
  const res = await sendTemplateEmail(
    'work_acknowledged',
    ackVars(row, i.agentName, window.location.origin + window.location.pathname),
    [to],
  )
  return res.ok ? { sent: true } : { sent: false, reason: res.reason }
}

/** ข้อความบอกผู้ใช้เมื่อส่งไม่ได้ — เงียบไม่ได้ คนกดจะเชื่อว่าแจ้งไปแล้ว */
export function ackFailMessage(reason?: string): string | null {
  if (reason === 'no-recipient') return null   // ไม่มีใครต้องแจ้ง ไม่ใช่ความผิดพลาด
  if (reason === 'no-template') return 'รับงานแล้ว แต่ไม่ได้ส่งเมลแจ้ง — ยังไม่ได้เปิด template "work_acknowledged"'
  return 'รับงานแล้ว แต่ส่งเมลแจ้งไม่สำเร็จ — คนมอบหมายยังไม่รู้'
}
