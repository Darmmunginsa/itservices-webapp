// เก้าอี้ที่นั่งได้นอกจากสิ่งของชิ้นใหญ่: รอบโต๊ะประชุม + เก้าอี้ของโต๊ะส่วนตัว
// เก้าอี้พวกนี้อยู่บนช่องพื้น (เดินทับได้) — เดินไปยืนบนเก้าอี้แล้วนั่ง

import { tileAt, isWalkable, type OfficeMap } from './officeMap'
import type { Seat, SeatFace } from './officeProps'
import type { Desk } from './officeDecor'

/**
 * เก้าอี้รอบโต๊ะประชุม (ช่อง T) — ตรงกับที่ภาพวาดเก้าอี้ไว้: ช่องพื้นด้านบนและด้านล่างของโต๊ะ
 * ฝั่งบนนั่งหันหน้าลง (เข้าโต๊ะ) · ฝั่งล่างนั่งหันหลังให้เรา
 */
export function meetingSeats(m: OfficeMap): Seat[] {
  const out: Seat[] = []
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (tileAt(m, x, y) !== 'T') continue
    if (tileAt(m, x, y - 1) !== 'T' && isWalkable(m, x, y - 1)) out.push({ x, y: y - 1, face: 'down', kind: 'meeting', sy: 30, behind: false, walk: true })
    if (tileAt(m, x, y + 1) !== 'T' && isWalkable(m, x, y + 1)) out.push({ x, y: y + 1, face: 'up', kind: 'meeting', sy: 6, behind: false, walk: true })
  }
  return out
}

/** หมุนโต๊ะแล้วเก้าอี้ไปอยู่ไหน + นั่งหันไปทางไหน (หันเข้าหาโต๊ะ) */
const CHAIR: Record<number, { dx: number; dy: number; face: SeatFace }> = {
  0: { dx: 0, dy: 1, face: 'up' },
  90: { dx: -1, dy: 0, face: 'right' },
  180: { dx: 0, dy: -1, face: 'down' },
  270: { dx: 1, dy: 0, face: 'left' },
}

/** เก้าอี้ของโต๊ะส่วนตัวทุกคน — นั่งได้เฉพาะเจ้าของโต๊ะ */
export function deskSeats(desks: { email: string; desk: Desk | null | undefined }[]): Seat[] {
  const out: Seat[] = []
  for (const { email, desk } of desks) {
    if (!desk) continue
    const c = CHAIR[desk.rot] ?? CHAIR[0]
    out.push({ x: desk.x + c.dx, y: desk.y + c.dy, face: c.face, kind: 'desk', sy: 18, behind: false, walk: true, owner: email.toLowerCase() })
  }
  return out
}
