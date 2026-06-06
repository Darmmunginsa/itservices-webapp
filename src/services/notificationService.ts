/**
 * In-app Notification Service
 * เก็บใน SP list HD_Notifications — แทนการส่ง email สำหรับ event ภายในทีม
 *
 * คอลัมน์ HD_Notifications ที่ต้องมี:
 *   Title (Single line)          — ข้อความสั้น (หัวข้อ)
 *   RecipientEmail (Single line) — อีเมลผู้รับ
 *   EventType (Single line)      — เช่น comment_added, comment_mention
 *   Message (Multi-line, plain)  — รายละเอียด
 *   LinkPath (Single line)       — route ปลายทาง เช่น /tickets/12
 *   IsRead (Yes/No, default No)
 */
import { spGet, spCreate, spUpdate } from './sharepoint'

export interface AppNotification {
  id: number
  Title: string
  RecipientEmail: string
  EventType: string
  Message: string
  LinkPath: string
  IsRead: boolean
  Created: string
}

/** สร้าง notification ให้ผู้รับหลายคน (1 แถวต่อคน) — dedupe + ตัดอีเมลว่าง */
export async function createNotification(params: {
  recipients: string[]
  title: string
  message: string
  linkPath: string
  eventType: string
}): Promise<void> {
  const norm = (e: string) => e.trim().toLowerCase()
  const to = [...new Map(params.recipients.filter(Boolean).map(e => [norm(e), e])).values()]
  if (to.length === 0) return
  await Promise.all(to.map(email =>
    spCreate('HD_Notifications', {
      Title: params.title.slice(0, 255),
      RecipientEmail: email,
      EventType: params.eventType,
      Message: params.message,
      LinkPath: params.linkPath,
      IsRead: false,
    }).catch(() => {})  // non-critical
  ))
}

/** โหลด notification ล่าสุดของผู้ใช้ (case-insensitive ฝั่ง client) */
export async function getMyNotifications(email: string): Promise<AppNotification[]> {
  if (!email) return []
  try {
    const rows = await spGet<AppNotification>(
      'HD_Notifications',
      `RecipientEmail eq '${email}'`,
      'Id,Title,RecipientEmail,EventType,Message,LinkPath,IsRead,Created',
      'Created desc',
      50,
    )
    return rows
  } catch {
    return []
  }
}

export async function markRead(id: number): Promise<void> {
  try { await spUpdate('HD_Notifications', id, { IsRead: true }) } catch { /* ignore */ }
}

export async function markAllRead(ids: number[]): Promise<void> {
  await Promise.all(ids.map(id => markRead(id)))
}
