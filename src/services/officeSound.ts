// ค่าเสียง (เพลงห้องโฟกัส + เสียงสวน) ผูกกับบัญชี — เปิดเครื่องไหนก็ได้ระดับเดิม
// เก็บในคอลัมน์ Sound ของแถวเดียวกับโต๊ะใน HD_OfficeDecor (1 แถว/คน)

import { spGet, spCreate, spUpdate } from './sharepoint'
import { DECOR_LIST } from './officeDecor'

interface Row { id: number; Sound?: string }
const byEmail = (email: string) => `UserEmail eq '${email.toLowerCase().replace(/'/g, "''")}'`

export async function getMySound(email: string): Promise<string | null> {
  const rows = await spGet<Row>(DECOR_LIST, byEmail(email), 'Id,Sound', undefined, 5)
  return rows.find(r => r.Sound)?.Sound ?? null
}

/** มีแถวแล้วแก้เฉพาะ Sound (ไม่แตะโต๊ะ) · ยังไม่มีสร้างแถวใหม่ */
export async function saveMySound(email: string, name: string, json: string): Promise<void> {
  const rows = await spGet<Row>(DECOR_LIST, byEmail(email), 'Id', undefined, 5)
  if (rows[0]) await spUpdate(DECOR_LIST, rows[0].id, { Sound: json })
  else await spCreate(DECOR_LIST, { Title: email, UserEmail: email.toLowerCase(), UserName: name, Sound: json })
}
