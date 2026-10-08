// ออฟฟิศเสมือนบนหน้า "สถานะทีม" — แผนผังห้อง ที่อวาตาร์ของแต่ละคน "ย้ายห้องเอง" ตามสถานะ
//
// ไม่ใช่ Gather: ไม่มีเดินด้วยคีย์บอร์ด ไม่มีเสียงตามระยะ (เว็บ static ไม่มี server realtime)
// สิ่งที่ให้คือ "มองปราดเดียวรู้ว่าใครอยู่ไหน" และกดทักได้ทันทีผ่าน Teams ที่ทุกคนมีอยู่แล้ว
//
// ตรรกะอยู่ที่นี่เพื่อทดสอบได้ — การแมปสถานะ→ห้องถ้าผิด คนจะ "หาย" จากแผนผังทั้งที่ยังทำงานอยู่

import type { StatusType } from '../types/teamStatus'

export type RoomKey = 'desk' | 'focus' | 'meeting' | 'site' | 'lounge' | 'away'

export interface Room {
  key: RoomKey
  label: string
  icon: string
  hint: string
}

export const ROOMS: Room[] = [
  { key: 'desk',    label: 'โต๊ะทำงาน',   icon: '🪑', hint: 'ว่าง — ทักได้เลย' },
  { key: 'focus',   label: 'ห้องโฟกัส',   icon: '🎧', hint: 'ไม่ว่าง — ติดงานอยู่' },
  { key: 'meeting', label: 'ห้องประชุม',  icon: '🗣️', hint: 'ประชุม (ตั้งเอง หรือจาก Outlook)' },
  { key: 'site',    label: 'ไซต์ลูกค้า',  icon: '🚗', hint: 'ออกไซต์ / เดินทาง' },
  { key: 'lounge',  label: 'มุมพัก',      icon: '☕', hint: 'พักอยู่ — ทักได้ถ้าไม่ด่วน' },
  { key: 'away',    label: 'ไม่อยู่',     icon: '🌙', hint: 'เลิกงาน / ลา' },
]

export interface Occupant {
  statusType: StatusType | null   // slot ที่ตั้งเอง (null = ไม่ได้ตั้ง)
  calendarBusy: boolean           // มีนัดใน Outlook ครอบเวลานี้
}

/**
 * ห้องที่คนนี้อยู่ตอนนี้
 * สถานะที่ตั้งเองมาก่อนปฏิทิน — คนที่กด "ออกไซต์" ทั้งที่มีนัดใน Outlook ค้าง ก็ควรอยู่ไซต์
 */
export function roomOf(o: Occupant): RoomKey {
  switch (o.statusType) {
    case 'Busy':    return 'focus'
    case 'Meeting': return 'meeting'
    case 'OnSite':  return 'site'
    case 'Break':   return 'lounge'
    case 'Off':     return 'away'
    case 'Available':
    case null:
    default:
      return o.calendarBusy ? 'meeting' : 'desk'
  }
}

/** จัดคนลงห้อง — ทุกห้องมีอยู่เสมอ (ห้องว่างก็แสดง ให้แผนผังนิ่ง ไม่กระโดด) */
export function groupByRoom<T>(people: T[], occ: (p: T) => Occupant): Record<RoomKey, T[]> {
  const out = Object.fromEntries(ROOMS.map(r => [r.key, [] as T[]])) as Record<RoomKey, T[]>
  for (const p of people) out[roomOf(occ(p))].push(p)
  return out
}

// ── ทักผ่าน Teams — deep link แบบ https เปิดในแอป Teams ได้ถ้ามี ไม่มีก็เปิดเว็บ ──
const enc = (e: string) => encodeURIComponent(e.trim())

export function teamsChatLink(email: string, message?: string): string {
  const base = `https://teams.microsoft.com/l/chat/0/0?users=${enc(email)}`
  return message ? `${base}&message=${encodeURIComponent(message)}` : base
}

export function teamsCallLink(email: string): string {
  return `https://teams.microsoft.com/l/call/0/0?users=${enc(email)}`
}

/** อักษรย่อสำหรับอวาตาร์ — "สมชาย ใจดี" → "ส", "John Smith" → "JS" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const latin = /^[A-Za-z]/.test(parts[0])
  if (!latin) return parts[0].charAt(0)
  return parts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}
