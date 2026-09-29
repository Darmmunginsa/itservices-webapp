// ส่งเมล "ในนามบัญชีกลาง" (support@) — และถอยให้เป็นเมื่อบัญชีที่ล็อกอินไม่มีสิทธิ์ Send As
//
// อาการจริง: สร้าง Ticket แล้ว Graph ตอบ 403 ErrorSendAsDenied ลูกค้าไม่ได้เมลเลย
// ทั้งที่คนกดมีกล่องเมลของตัวเองที่ส่งได้แน่ ๆ — การส่งไม่ออกเลยแย่กว่าส่งจากชื่อคนกด
//
// ทางถอย: ส่งจากตัวเอง แต่ตั้ง reply-to = บัญชีกลาง
// ลูกค้ากด reply ยังกลับเข้ากล่องกลาง → flow เมลขาเข้ายังจับลงเป็นคอมเมนต์ได้เหมือนเดิม
// (ถ้าไม่ตั้ง reply-to คำตอบลูกค้าจะไหลเข้ากล่องส่วนตัวของคนกด แล้วหายจากระบบเงียบ ๆ)
//
// ไฟล์นี้มีสำเนาใน Add-in (scripts/check-addin-sync.mjs เทียบให้) — แก้ที่นี่แล้วคัดไป

export type SendAs = 'shared' | 'self'

export interface GraphMessageInput {
  to: string[]
  cc?: string[]
  subject: string
  html: string
  /** บัญชีกลาง — ว่าง = ส่งจากตัวเองเฉย ๆ */
  from?: string
  sendAs: SendAs
}

/** ประกอบ message ของ Graph sendMail ตามโหมดที่จะส่ง */
export function buildGraphMessage(i: GraphMessageInput): Record<string, unknown> {
  const addr = (a: string) => ({ emailAddress: { address: a } })
  const message: Record<string, unknown> = {
    subject: i.subject,
    body: { contentType: 'HTML', content: i.html },
    toRecipients: i.to.filter(Boolean).map(addr),
  }
  const cc = (i.cc ?? []).filter(Boolean)
  if (cc.length) message.ccRecipients = cc.map(addr)
  if (i.from) {
    if (i.sendAs === 'shared') message.from = addr(i.from)
    else message.replyTo = [addr(i.from)]   // ส่งจากตัวเอง แต่ให้ตอบกลับเข้ากล่องกลาง
  }
  return message
}

/** Graph ปฏิเสธเพราะไม่มีสิทธิ์ Send As บนกล่องกลาง — เคสเดียวที่ควร "ลองส่งจากตัวเอง" */
export function isSendAsDenied(status: number, bodyText: string): boolean {
  return status === 403 && /ErrorSendAsDenied/i.test(bodyText)
}

/** ข้อความบอกผู้ใช้/Admin เมื่อต้องถอยไปส่งจากตัวเอง */
export function sendAsFallbackText(from: string, me?: string): string {
  return `ส่งเมลแล้ว แต่ในนาม ${me || 'บัญชีของคุณ'} แทน ${from} — บัญชีคุณยังไม่มีสิทธิ์ Send As ของ ${from} ` +
    `(ให้ Admin เพิ่มใน Exchange admin center → Mailboxes → ${from} → Send as) · ลูกค้าตอบกลับจะยังเข้ากล่อง ${from}`
}

/** แปลข้อความดิบจาก Graph เป็นภาษาคน — ข้อความ JSON ยาว ๆ ใน toast อ่านไม่รู้เรื่องว่าต้องแก้ตรงไหน */
export function mailDetailText(detail: string | undefined, from?: string): string | undefined {
  if (!detail) return detail
  if (/ErrorSendAsDenied/i.test(detail)) {
    return `บัญชีคุณไม่มีสิทธิ์ Send As ของ ${from || 'บัญชีกลาง'} (ให้ Admin เพิ่มใน Exchange admin center)`
  }
  if (/MailboxNotEnabledForRESTAPI|MailboxNotHostedInExchangeOnline/i.test(detail)) {
    return 'บัญชีคุณไม่มีกล่องเมล Exchange Online — ส่งเมลจาก Graph ไม่ได้'
  }
  if (/ErrorMessageSizeExceeded/i.test(detail)) return 'เมลใหญ่เกินขนาดที่ Exchange รับ'
  if (/\b(401|InvalidAuthenticationToken)\b/.test(detail)) return 'session หมดอายุ — รีเฟรชหน้าแล้วลองใหม่'
  return detail
}
