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

export type AckNotifyResult = {
  sent: boolean
  reason?: 'no-recipient' | 'no-template' | 'failed'
  /** สาเหตุที่แท้จริงจาก emailService — ต้องส่งต่อถึงหน้าจอ ไม่ใช่ทิ้ง */
  detail?: string
}

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
  return res.ok ? { sent: true } : { sent: false, reason: res.reason, detail: res.detail }
}

/** ข้อความบอกผู้ใช้เมื่อส่งไม่ได้ — เงียบไม่ได้ คนกดจะเชื่อว่าแจ้งไปแล้ว */
export function ackFailMessage(reason?: string, detail?: string): string | null {
  if (reason === 'no-recipient') return null   // ไม่มีใครต้องแจ้ง ไม่ใช่ความผิดพลาด
  // detail บอกว่าเป็น "ไม่มีแถว" / "ปิดอยู่" / "เนื้อว่าง" — คนละที่ที่ต้องไปแก้
  // เดิมบอกว่า "ยังไม่ได้เปิด template" ทุกกรณี คนที่เปิดไว้แล้วจึงไปหาผิดจุด
  if (reason === 'no-template') {
    return `รับงานแล้ว แต่ไม่ได้ส่งเมลแจ้ง — ${detail ?? 'ยังไม่ได้เปิด template "work_acknowledged"'}`
  }
  return `รับงานแล้ว แต่ส่งเมลแจ้งไม่สำเร็จ — คนมอบหมายยังไม่รู้${detail ? ` (${detail})` : ''}`
}

/**
 * แจ้งคนที่ถูกมอบหมายว่ามีงานรออยู่
 *
 * กล่อง "รอรับงาน" ไม่มีความหมายถ้าปลายทางไม่รู้ว่ามีงานเข้า — เขาต้องบังเอิญ
 * เปิดหน้างานของฉันถึงจะเห็น ซึ่งก็คือกลับไปเป็นการโยนงานแล้วหวังว่าอีกฝ่ายจะเจอ
 *
 * Incident ไม่ใช้ทางนี้ เพราะมีเมล incident_assigned ของตัวเองที่มีบริบทของเคส
 * (ความรุนแรง, SLA, โครงการ) — ส่งสองฉบับเรื่องเดียวกันแย่กว่าส่งฉบับเดียวที่ดี
 */
export async function notifyAssigned(i: AckNotifyInput): Promise<AckNotifyResult> {
  const to = (i.agentEmail ?? '').trim()
  // มอบหมายให้ตัวเอง = รู้อยู่แล้ว ไม่ต้องส่งหาตัวเอง
  if (!to || to.toLowerCase() === (i.fromEmail ?? '').toLowerCase()) {
    return { sent: false, reason: 'no-recipient' }
  }

  createNotification({
    recipients: [to],
    title: `\u{1F4E5} มีงานรอให้คุณรับ: ${i.title}`,
    message: `จาก ${i.fromName || i.fromEmail || '-'}`,
    linkPath: i.link,
    eventType: 'work_assigned',
  })

  const row: AckRow = {
    key: `${i.kind}-${i.id}`, kind: i.kind, id: i.id, title: i.title, link: i.link,
    from: i.fromName ?? '', fromEmail: i.fromEmail ?? '', due: i.due, tag: i.tag, status: i.status,
    listName: '',
  }
  const res = await sendTemplateEmail(
    'work_assigned',
    ackVars(row, i.agentName, window.location.origin + window.location.pathname),
    [to],
  )
  return res.ok ? { sent: true } : { sent: false, reason: res.reason, detail: res.detail }
}

/** ข้อความบอกผู้ใช้เมื่อแจ้งคนรับงานไม่ได้ — มอบหมายสำเร็จ กับ แจ้งไม่ถึง คนละเรื่อง */
export function assignFailMessage(reason?: string, detail?: string): string | null {
  if (reason === 'no-recipient') return null
  if (reason === 'no-template') {
    return `มอบหมายแล้ว แต่ไม่ได้ส่งเมลแจ้ง — ${detail ?? 'ยังไม่ได้ตั้ง template "work_assigned"'}`
  }
  return `มอบหมายแล้ว แต่ส่งเมลแจ้งไม่สำเร็จ — ผู้รับงานยังไม่รู้${detail ? ` (${detail})` : ''}`
}
