// แชทส่วนตัวในออฟฟิศ — HD_OfficeDM
//
// ดึงเฉพาะแถวที่ฉันเป็นผู้ส่งหรือผู้รับ (กรองที่ server) — แอปไม่โหลดข้อความของคู่อื่นมาที่เครื่องเรา
// ⚠ แต่ลิสต์ SharePoint ยังเป็นสิทธิ์ระดับลิสต์: คนที่มีสิทธิ์อ่านลิสต์เปิดดูตรง ๆ ได้ — เรื่องลับใช้ Teams

import { spGet, spCreate } from './sharepoint'
import type { DMKind, DMRow } from '../utils/officeDM'

export const DM_LIST = 'HD_OfficeDM'
const esc = (s: string) => s.toLowerCase().replace(/'/g, "''")

export async function getMyDMs(me: string): Promise<DMRow[]> {
  const m = esc(me)
  return spGet<DMRow>(DM_LIST, `(FromEmail eq '${m}') or (ToEmail eq '${m}')`,
    'Id,Title,FromEmail,ToEmail,FromName,Kind,Message,Created', 'Id desc', 300)
}

export function sendDM(input: { from: string; fromName: string; to: string; kind: DMKind; text?: string }): Promise<{ id: number }> {
  const text = (input.text ?? '').trim()
  return spCreate(DM_LIST, {
    Title: text.slice(0, 255) || input.kind,
    Message: text.length > 255 ? text : undefined,
    FromEmail: input.from.toLowerCase(), ToEmail: input.to.toLowerCase(),
    FromName: input.fromName, Kind: input.kind,
  })
}
