// preview เท่านั้น — HD_OfficeDM ในหน่วยความจำ
import type { DMKind, DMRow } from '../src/utils/officeDM'
export const DM_LIST = 'HD_OfficeDM'
let rows: DMRow[] = [
  { id: 1, FromEmail: 'aree@x', ToEmail: 'me@x', FromName: 'อารีย์ สุขใจ', Kind: 'text', Title: 'ว่างไหมคะ อยากปรึกษาเรื่อง Ticket 287', Created: new Date().toISOString() },
]
let next = 10
export async function getMyDMs(me: string): Promise<DMRow[]> {
  return rows.filter(r => r.FromEmail === me || r.ToEmail === me).sort((a, b) => b.id - a.id)
}
export async function sendDM(i: { from: string; fromName: string; to: string; kind: DMKind; text?: string }): Promise<{ id: number }> {
  const id = next++
  rows = [...rows, { id, FromEmail: i.from, ToEmail: i.to, FromName: i.fromName, Kind: i.kind, Title: i.text || i.kind, Created: new Date().toISOString() }]
  return { id }
}
/** ให้หน้าทดสอบจำลองอีกฝั่งส่งมา */
;(window as unknown as { __dmFrom: (from: string, name: string, kind: DMKind, text?: string) => void }).__dmFrom =
  (from, name, kind, text) => { sendDM({ from, fromName: name, to: 'me@x', kind, text }) }
