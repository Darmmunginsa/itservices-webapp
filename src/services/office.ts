// ออฟฟิศ 2D — ตำแหน่งคน (HD_OfficePresence) และแชท (HD_OfficeChat) บน SharePoint
//
// เฟส A ใช้ poll — ตั้งใจให้ทุกฟังก์ชันที่นี่เป็น "ท่อ" ที่เปลี่ยนเป็น Web PubSub ได้ทีหลัง
// โดยหน้าจอไม่ต้องรู้ว่าข้อมูลมาจากไหน

import { spGet, spCreate, spUpdate } from './sharepoint'
import { DEFAULT_MAP } from '../utils/officeMap'

export const PRESENCE_LIST = 'HD_OfficePresence'
export const CHAT_LIST = 'HD_OfficeChat'

export interface PresenceRow {
  id: number
  Title: string        // อีเมล (ใช้ค้น)
  UserEmail: string
  UserName: string
  X: number
  Y: number
  Room?: string
  LastSeen?: string
}

export interface ChatRow {
  id: number
  Title: string        // ข้อความ (≤255) — ข้อความยาวอยู่ใน Message
  Message?: string
  UserEmail: string
  UserName: string
  Room?: string        // '' = ทั้งออฟฟิศ · ชื่อโซน = เฉพาะห้อง
  Created: string
}

const P_SELECT = 'Id,Title,UserEmail,UserName,X,Y,Room,LastSeen'
const C_SELECT = 'Id,Title,Message,UserEmail,UserName,Room,Created'

export async function getPresence(): Promise<PresenceRow[]> {
  // เอาเฉพาะคนที่เคยเข้าใน 1 วัน — แถวเก่าไม่ต้องดึงมาทุก 3 วิ
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  return spGet<PresenceRow>(PRESENCE_LIST, `LastSeen ge datetime'${since}'`, P_SELECT, undefined, 500)
}

/** แถวของฉัน — ไม่มีก็สร้างที่จุดเกิดที่ส่งมา */
export async function ensureMyPresence(email: string, name: string, spawn: { x: number; y: number }): Promise<PresenceRow> {
  const rows = await spGet<PresenceRow>(PRESENCE_LIST, `UserEmail eq '${email.replace(/'/g, "''")}'`, P_SELECT, undefined, 1)
  if (rows[0]) return rows[0]
  const payload = { Title: email, UserEmail: email, UserName: name, X: spawn.x, Y: spawn.y, Room: 'desk', LastSeen: new Date().toISOString() }
  const created = await spCreate(PRESENCE_LIST, payload)
  return { id: created.id, ...payload }
}

export function savePresence(id: number, p: { x: number; y: number; room: string }): Promise<void> {
  return spUpdate(PRESENCE_LIST, id, { X: p.x, Y: p.y, Room: p.room, LastSeen: new Date().toISOString() })
}

export function heartbeat(id: number): Promise<void> {
  return spUpdate(PRESENCE_LIST, id, { LastSeen: new Date().toISOString() })
}

/** ข้อความล่าสุด (ใหม่→เก่า) — หน้าจอกลับลำดับเอง */
export async function getChat(top = 150): Promise<ChatRow[]> {
  return spGet<ChatRow>(CHAT_LIST, undefined, C_SELECT, 'Created desc', top)
}

export async function sendChat(input: { email: string; name: string; text: string; room: string }): Promise<{ id: number }> {
  const text = input.text.trim()
  return spCreate(CHAT_LIST, {
    Title: text.slice(0, 255),
    Message: text.length > 255 ? text : undefined,
    UserEmail: input.email, UserName: input.name,
    Room: input.room || undefined,
  })
}

/** แผนที่ที่ Admin แก้ทับได้ใน HD_Options (Category='OfficeMap', Title=บรรทัดคั่นด้วย \n) — ไม่มี = ใช้ค่าในโค้ด */
export async function getOfficeMapRows(): Promise<string[]> {
  try {
    const rows = await spGet<{ Title: string; Value?: string }>('HD_Options', "Category eq 'OfficeMap'", 'Id,Title,Value,Category', undefined, 1)
    const raw = (rows[0]?.Value || rows[0]?.Title || '').replace(/\r/g, '')
    const lines = raw.split('\n').map(l => l.trimEnd()).filter(Boolean)
    return lines.length >= 3 ? lines : DEFAULT_MAP
  } catch { return DEFAULT_MAP }
}
