// โต๊ะ + ของแต่งของแต่ละคน — HD_OfficeDecor (1 แถว/คน, Data = JSON)

import { spGet, spCreate, spUpdate } from './sharepoint'
import { parseDecor, serializeDecor, type MyDecor, type OthersDecor } from '../utils/officeDecor'

export const DECOR_LIST = 'HD_OfficeDecor'

interface Row { id: number; UserEmail: string; UserName?: string; Data?: string }

export interface DecorRow extends OthersDecor { id: number }

export async function getAllDecor(): Promise<DecorRow[]> {
  const rows = await spGet<Row>(DECOR_LIST, undefined, 'Id,UserEmail,UserName,Data', undefined, 500)
  return rows.filter(r => r.UserEmail).map(r => ({ id: r.id, email: r.UserEmail.toLowerCase(), name: r.UserName || r.UserEmail, decor: parseDecor(r.Data) }))
}

/** บันทึกของฉัน — มีแถวแล้วแก้ ไม่มีสร้าง */
export async function saveMyDecor(email: string, name: string, decor: MyDecor, existingId?: number): Promise<number> {
  const payload = { Title: email, UserEmail: email.toLowerCase(), UserName: name, Data: serializeDecor(decor) }
  if (existingId) { await spUpdate(DECOR_LIST, existingId, payload); return existingId }
  const r = await spCreate(DECOR_LIST, payload)
  return r.id
}
