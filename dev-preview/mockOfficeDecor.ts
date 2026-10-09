// preview เท่านั้น — HD_OfficeDecor ในหน่วยความจำ (มีโต๊ะของ "ก้อง" แต่งไว้ให้ดูเป็นตัวอย่าง)
import { parseDecor, serializeDecor, type MyDecor } from '../src/utils/officeDecor'
export const DECOR_LIST = 'HD_OfficeDecor'
interface Row { id: number; email: string; name: string; data: string }
let rows: Row[] = [{ id: 1, email: 'kong@x', name: 'ก้อง ทำงาน', data: JSON.stringify({ desk: { x: 4, y: 5, style: 'gaming', rot: 0 }, items: [
  { id: 'a', kind: 'mug', x: 4, y: 5, rot: 0, flip: false }, { id: 'b', kind: 'headphones', x: 4, y: 5, rot: 0, flip: false },
  { id: 'c', kind: 'monstera', x: 2, y: 5, rot: 0, flip: false }, { id: 'd', kind: 'arcade', x: 6, y: 5, rot: 0, flip: false },
  { id: 'e', kind: 'beanbag', x: 4, y: 7, rot: 0, flip: false } ] }) }]
let next = 10
export async function getAllDecor() { return rows.map(r => ({ id: r.id, email: r.email, name: r.name, decor: parseDecor(r.data) })) }
export async function saveMyDecor(email: string, name: string, decor: MyDecor, existingId?: number): Promise<number> {
  const data = serializeDecor(decor)
  if (existingId) { rows = rows.map(r => r.id === existingId ? { ...r, data } : r); return existingId }
  const id = next++; rows = [...rows, { id, email: email.toLowerCase(), name, data }]; return id
}
