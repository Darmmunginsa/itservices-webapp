// สถานะ "อ่านแล้ว" ของแต่ละคน — คอลัมน์ ReadState ใน HD_OfficeDecor (แถวเดียวกับโต๊ะ/ตัวละคร)

import { spGet, spCreate, spUpdate } from './sharepoint'
import { DECOR_LIST } from './officeDecor'

interface Row { id: number; UserEmail?: string; ReadState?: string }

export async function getAllReadStates(): Promise<Map<string, string>> {
  const rows = await spGet<Row>(DECOR_LIST, undefined, 'Id,UserEmail,ReadState', undefined, 500)
  const out = new Map<string, string>()
  for (const r of rows) if (r.UserEmail && r.ReadState) out.set(r.UserEmail.toLowerCase(), r.ReadState)
  return out
}

export async function saveMyReadState(email: string, name: string, json: string): Promise<void> {
  const esc = email.toLowerCase().replace(/'/g, "''")
  const rows = await spGet<Row>(DECOR_LIST, `UserEmail eq '${esc}'`, 'Id', undefined, 5)
  if (rows[0]) await spUpdate(DECOR_LIST, rows[0].id, { ReadState: json })
  else await spCreate(DECOR_LIST, { Title: email, UserEmail: email.toLowerCase(), UserName: name, ReadState: json })
}
