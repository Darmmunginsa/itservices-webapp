// "แนะนำตัว" ก่อนต่อสายเสียง (WebRTC signaling) ผ่าน SharePoint — HD_OfficeSignal
//
// เสียงจริงวิ่งตรงเครื่องต่อเครื่อง ไม่ผ่าน SharePoint · ลิสต์นี้ใช้แค่ส่ง offer/answer คนละ 1 ข้อความต่อการต่อสาย
// (รวบ ICE ไว้ใน SDP แล้วส่งทีเดียว จึงไม่ต้องส่ง candidate ทีละตัว) อ่านแล้วลบทิ้งทันที ลิสต์จึงเกือบว่างตลอด
//
// เฟส B (Web PubSub) แทนที่ไฟล์นี้ไฟล์เดียว — ต่อสายจะเร็วขึ้นจาก ~3 วิ เหลือ <1 วิ

import { spGet, spCreate, spDelete } from './sharepoint'

export const SIGNAL_LIST = 'HD_OfficeSignal'

export type SignalKind = 'offer' | 'answer' | 'bye'

export interface SignalRow {
  id: number
  Title: string        // kind
  FromEmail: string
  ToEmail: string
  Payload?: string     // SDP (JSON)
  Created: string
}

const esc = (s: string) => s.replace(/'/g, "''")

export function sendSignal(from: string, to: string, kind: SignalKind, payload?: string): Promise<{ id: number }> {
  return spCreate(SIGNAL_LIST, { Title: kind, FromEmail: from.toLowerCase(), ToEmail: to.toLowerCase(), Payload: payload })
}

/** ข้อความถึงฉัน เก่าก่อน — แล้วลบทิ้ง (ล้มก็ไม่เป็นไร รอบหน้าจะทิ้งเพราะเก่าเกิน) */
export async function takeSignals(me: string): Promise<SignalRow[]> {
  const rows = await spGet<SignalRow>(SIGNAL_LIST, `ToEmail eq '${esc(me.toLowerCase())}'`, 'Id,Title,FromEmail,ToEmail,Payload,Created', 'Created asc', 50)
  for (const r of rows) spDelete(SIGNAL_LIST, r.id).catch(() => {})
  // เก่ากว่า 60 วิ = อีกฝั่งเลิกรอไปแล้ว (หมดเวลาต่อสาย 20 วิ) ใช้ต่อไม่ได้
  const cutoff = Date.now() - 60_000
  return rows.filter(r => new Date(r.Created).getTime() >= cutoff)
}
