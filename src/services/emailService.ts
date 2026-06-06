/**
 * Email Template Service
 * โหลด template จาก HD_EmailTemplates แล้ว sendMail ผ่าน Graph API
 */
import { spGet } from './sharepoint'
import { sendMail } from './graph'

export interface EmailTemplate {
  id: number
  Title: string
  EventKey: string
  Subject: string
  Body: string
  IsEnabled: boolean
  Recipients: string   // "customer" | "agent" | "approver" | "requester" | comma-separated
}

// Cache templates in memory (โหลดครั้งแรกครั้งเดียว)
let _cache: EmailTemplate[] | null = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000  // 5 min

// Cache sender address (บัญชีกลางที่ใช้ส่งอีเมล — เก็บใน HD_Options Category='EmailConfig')
let _sender: string | null = null
let _senderTime = 0

interface HDOption { id: number; Title: string; Category: string }

async function getTemplates(): Promise<EmailTemplate[]> {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) return _cache
  _cache = await spGet<EmailTemplate>('HD_EmailTemplates', undefined,
    'Id,Title,EventKey,Subject,Body,IsEnabled,Recipients')
  _cacheTime = now
  return _cache
}

// บัญชีกลาง default — ใช้เมื่อยังไม่ได้ตั้งค่าใน Admin (แก้ทับจาก HD_Options ได้)
const DEFAULT_SENDER = 'support@itservices.co.th'

/** ดึงบัญชีกลาง (sender) จาก HD_Options — ถ้าไม่ตั้งค่าจะใช้ DEFAULT_SENDER */
async function getSender(): Promise<string> {
  const now = Date.now()
  if (_sender !== null && now - _senderTime < CACHE_TTL) return _sender
  try {
    const opts = await spGet<HDOption>('HD_Options', "Category eq 'EmailConfig'", 'Id,Title,Category')
    _sender = opts[0]?.Title?.trim() || DEFAULT_SENDER
  } catch {
    _sender = DEFAULT_SENDER
  }
  _senderTime = now
  return _sender
}

/** ล้าง cache เมื่อ Admin บันทึก template หรือ sender ใหม่ */
export function clearEmailTemplateCache() {
  _cache = null
  _sender = null
}

/** แทนที่ {{variable}} ด้วยค่าจริง */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

/**
 * ส่ง email ตาม eventKey — ส่ง "ฉบับเดียว" เพื่อให้ทุกคนอยู่ใน thread เดียวกัน
 * @param eventKey   เช่น 'ticket_created'
 * @param vars       ตัวแปรสำหรับแทนใน template
 * @param recipients ผู้รับหลัก (To)
 * @param cc         ผู้รับ CC (อยู่ใน loop เดียวกัน reply ได้) — ตัดที่ซ้ำกับ To ออกอัตโนมัติ
 */
export async function sendTemplateEmail(
  eventKey: string,
  vars: Record<string, string>,
  recipients: string[],
  cc: string[] = [],
): Promise<void> {
  try {
    const templates = await getTemplates()
    const tpl = templates.find(t => t.EventKey === eventKey && t.IsEnabled)
    if (!tpl) return  // ไม่มี template หรือ disabled

    const subject = render(tpl.Subject || '', vars)
    const body    = render(tpl.Body    || '', vars)
    if (!subject || !body) return

    // dedupe (case-insensitive) + ตัด CC ที่ซ้ำกับ To
    const norm = (e: string) => e.trim().toLowerCase()
    const to = [...new Map(recipients.filter(Boolean).map(e => [norm(e), e])).values()]
    if (to.length === 0) return
    const toSet = new Set(to.map(norm))
    const ccFinal = [...new Map(cc.filter(Boolean).map(e => [norm(e), e])).values()]
      .filter(e => !toSet.has(norm(e)))

    const from = await getSender()
    await sendMail(to, subject, body, { from: from || undefined, cc: ccFinal })
  } catch {
    // email fail = non-critical, ไม่ throw
  }
}
