// ออฟฟิศ 2D — ตำแหน่งคน (HD_OfficePresence) และแชท (HD_OfficeChat) บน SharePoint
//
// เฟส A ใช้ poll — ตั้งใจให้ทุกฟังก์ชันที่นี่เป็น "ท่อ" ที่เปลี่ยนเป็น Web PubSub ได้ทีหลัง
// โดยหน้าจอไม่ต้องรู้ว่าข้อมูลมาจากไหน

import { spGet, spCreate, spUpdate, spDelete } from './sharepoint'
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

// ── ผังออฟฟิศที่ Admin แก้เอง ──
// เก็บใน HD_Options: Category='OfficeMap', 1 แถว = 1 บรรทัดของแผนที่ (Title), SortOrder = ลำดับแถว
// ใช้คอลัมน์ที่ลิสต์มีอยู่แล้ว (Title ≤255 พอสำหรับกว้างสูงสุด 60 ช่อง) — ไม่ต้องสร้างคอลัมน์ใหม่
interface MapRow { id: number; Title: string; SortOrder?: number }
const MAP_CAT = 'OfficeMap'

export async function getOfficeMapRows(): Promise<string[]> {
  try {
    const rows = await spGet<MapRow>('HD_Options', `Category eq '${MAP_CAT}'`, 'Id,Title,SortOrder', 'SortOrder asc', 200)
    const lines = rows.map(r => (r.Title ?? '').replace(/\r/g, '')).filter(Boolean)
    return lines.length >= 3 ? lines : DEFAULT_MAP
  } catch { return DEFAULT_MAP }
}

/** บันทึกทั้งผัง — เขียนชุดใหม่ก่อน แล้วค่อยลบชุดเก่า (ล้มกลางทางยังมีผังใช้) */
export async function saveOfficeMap(lines: string[]): Promise<void> {
  const old = await spGet<MapRow>('HD_Options', `Category eq '${MAP_CAT}'`, 'Id', undefined, 200)
  for (let i = 0; i < lines.length; i++) await spCreate('HD_Options', { Title: lines[i], Category: MAP_CAT, SortOrder: i })
  for (const r of old) await spDelete('HD_Options', r.id).catch(() => {})
}

/** กลับไปใช้ผังในโค้ด */
export async function resetOfficeMap(): Promise<void> {
  const old = await spGet<MapRow>('HD_Options', `Category eq '${MAP_CAT}'`, 'Id', undefined, 200)
  for (const r of old) await spDelete('HD_Options', r.id)
}
