// ตัวละครของแต่ละคน — คอลัมน์ Avatar ใน HD_OfficeDecor (แถวเดียวกับโต๊ะ, 1 แถว/คน)

import { spGet, spCreate, spUpdate } from './sharepoint'
import { DECOR_LIST } from './officeDecor'

interface Row { id: number; UserEmail?: string; Avatar?: string }

/** ตัวละครที่ทุกคนบันทึกไว้: อีเมล (ตัวเล็ก) → JSON · ยังไม่มีคอลัมน์ = โยน error (หน้าจอใช้ตัวละครเริ่มต้นแทน) */
export async function getAllAvatars(): Promise<Map<string, string>> {
  const rows = await spGet<Row>(DECOR_LIST, undefined, 'Id,UserEmail,Avatar', undefined, 500)
  const out = new Map<string, string>()
  for (const r of rows) if (r.UserEmail && r.Avatar) out.set(r.UserEmail.toLowerCase(), r.Avatar)
  return out
}

/** บันทึกตัวละครของฉัน — แก้เฉพาะคอลัมน์ Avatar (ไม่แตะโต๊ะ/ค่าเสียง) */
export async function saveMyAvatar(email: string, name: string, json: string): Promise<void> {
  const esc = email.toLowerCase().replace(/'/g, "''")
  const rows = await spGet<Row>(DECOR_LIST, `UserEmail eq '${esc}'`, 'Id', undefined, 5)
  if (rows[0]) await spUpdate(DECOR_LIST, rows[0].id, { Avatar: json })
  else await spCreate(DECOR_LIST, { Title: email, UserEmail: email.toLowerCase(), UserName: name, Avatar: json })
}
