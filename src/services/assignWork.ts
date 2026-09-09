// เขียนการมอบหมายงานลง SharePoint — ที่เดียวสำหรับทุกหน้าที่มอบหมายได้
//
// การมอบหมายเกิดได้จากหลายที่ (หน้า Ticket, หน้า Incident, หน้าโครงการ,
// Agent Dashboard) ก่อนหน้านี้แต่ละที่เขียนเอง และทุกที่ลืมล้างสถานะ "รับงานแล้ว"
// ผลคืองานที่คนก่อนกดรับไว้ พอโยนต่อก็วิ่งเข้ารายการของคนใหม่ทันทีโดยไม่ต้องกดรับ

import { spUpdate } from './sharepoint'
import { assignFields } from '../utils/ackInbox'

export interface AssignResult {
  /** เขียนผู้รับผิดชอบสำเร็จ */
  ok: boolean
  /** ล้าง/ตั้งสถานะการรับงานได้ด้วยหรือไม่ */
  ackApplied: boolean
  /** ลิสต์ที่ยังไม่มีคอลัมน์เรื่องการรับงาน — บอกให้ไปสร้าง */
  missingAckColumns?: boolean
}

/**
 * มอบหมายงาน พร้อมรีเซ็ตสถานะการรับงาน
 *
 * ถ้าลิสต์ยังไม่มีคอลัมน์ IsAcknowledged/AcknowledgedBy/AcknowledgedDate
 * (บางลิสต์ยังไม่ได้เพิ่ม) การเขียนรอบแรกจะไม่ผ่าน — เขียนซ้ำเฉพาะผู้รับผิดชอบ
 * แล้วรายงานกลับว่าคอลัมน์ขาด ดีกว่าปล่อยให้ "มอบหมายไม่ได้เลย" ทั้งที่ตัวงานเขียนได้
 */
export async function assignWork(
  listName: string,
  itemId: number,
  assigneeEmail: string,
  assigneeName: string,
  actorEmail: string | undefined,
  nameField: 'AssignedToName' | 'AssignedTo',
  extra: Record<string, unknown> = {},
): Promise<AssignResult> {
  const { base, ack } = assignFields(assigneeEmail, assigneeName, actorEmail, nameField)
  try {
    await spUpdate(listName, itemId, { ...base, ...extra, ...ack })
    return { ok: true, ackApplied: true }
  } catch {
    // ลองอีกครั้งโดยไม่แตะคอลัมน์เรื่องการรับงาน
    await spUpdate(listName, itemId, { ...base, ...extra })
    return { ok: true, ackApplied: false, missingAckColumns: true }
  }
}

/** ข้อความเตือนตอนล้างสถานะรับงานไม่ได้ — ต้องบอกชื่อคอลัมน์ที่ต้องไปสร้าง */
export const ackColumnWarning = (listName: string): string =>
  `มอบหมายแล้ว แต่ยังไม่ได้ตั้งเป็น "รอรับงาน" — ต้องเพิ่มคอลัมน์ IsAcknowledged (Yes/No), ` +
  `AcknowledgedBy (Text), AcknowledgedDate (Date) ใน ${listName} ก่อน`
