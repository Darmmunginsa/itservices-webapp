// preview เท่านั้น — จำลอง HD_OfficePresence / HD_OfficeChat ในหน่วยความจำ ไม่แตะ SharePoint
import { DEFAULT_MAP, parseMap, isWalkable } from '../src/utils/officeMap'

export const PRESENCE_LIST = 'HD_OfficePresence'
export const CHAT_LIST = 'HD_OfficeChat'
export interface PresenceRow { id: number; Title: string; UserEmail: string; UserName: string; X: number; Y: number; Room?: string; LastSeen?: string }
export interface ChatRow { id: number; Title: string; Message?: string; UserEmail: string; UserName: string; Room?: string; Created: string }

const map = parseMap(DEFAULT_MAP)
const now = () => new Date().toISOString()
const rows: PresenceRow[] = [
  { id: 2, Title: 'aree@x', UserEmail: 'aree@x', UserName: 'อารีย์ สุขใจ', X: 14, Y: 3, Room: 'meeting', LastSeen: now() },
  { id: 3, Title: 'boss@x', UserEmail: 'boss@x', UserName: 'บอส ใหญ่', X: 13, Y: 10, Room: 'cafe', LastSeen: now() },
  { id: 4, Title: 'kong@x', UserEmail: 'kong@x', UserName: 'ก้อง ทำงาน', X: 5, Y: 5, Room: 'desk', LastSeen: now() },
  { id: 5, Title: 'old@x', UserEmail: 'old@x', UserName: 'คนออฟไลน์', X: 2, Y: 7, Room: 'desk', LastSeen: '2020-01-01T00:00:00Z' },
]
let chat: ChatRow[] = [
  { id: 1, Title: 'สวัสดีตอนเช้าครับทุกคน', UserEmail: 'kong@x', UserName: 'ก้อง ทำงาน', Room: '', Created: now() },
  { id: 2, Title: 'ใครว่างช่วยดู Ticket 287 หน่อย', UserEmail: 'aree@x', UserName: 'อารีย์ สุขใจ', Room: '', Created: now() },
  { id: 3, Title: 'ข้อความเฉพาะห้องประชุม', UserEmail: 'aree@x', UserName: 'อารีย์ สุขใจ', Room: 'meeting', Created: now() },
]
let nextId = 100
let me: PresenceRow | null = null

// คนอื่นเดินสุ่มทุกครั้งที่ poll — ไว้ดู tween
function wander(r: PresenceRow) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  const [dx, dy] = dirs[Math.floor(Math.random() * 4)]
  if (Math.random() < 0.5 && isWalkable(map, r.X + dx, r.Y + dy)) { r.X += dx; r.Y += dy }
  r.LastSeen = now()
}

export async function getPresence(): Promise<PresenceRow[]> {
  rows.slice(0, 3).forEach(wander)
  return [...rows, ...(me ? [me] : [])]
}
export async function ensureMyPresence(email: string, name: string, spawn: { x: number; y: number }): Promise<PresenceRow> {
  me = me ?? { id: 1, Title: email, UserEmail: email, UserName: name, X: spawn.x, Y: spawn.y, Room: 'desk', LastSeen: now() }
  return me
}
export async function savePresence(_id: number, p: { x: number; y: number; room: string }): Promise<void> {
  if (me) { me.X = p.x; me.Y = p.y; me.Room = p.room; me.LastSeen = now() }
  console.log('[mock] savePresence', p)
}
export async function heartbeat(): Promise<void> {}
export async function getChat(): Promise<ChatRow[]> { return chat.slice().reverse() }
export async function sendChat(input: { email: string; name: string; text: string; room: string }): Promise<{ id: number }> {
  const id = nextId++
  chat = [...chat, { id, Title: input.text, UserEmail: input.email, UserName: input.name, Room: input.room, Created: now() }]
  return { id }
}
export async function getOfficeMapRows(): Promise<string[]> { return DEFAULT_MAP }
