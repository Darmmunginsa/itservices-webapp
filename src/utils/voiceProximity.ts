// เสียงตามระยะแบบ Gather — ตัดสินว่าใครได้ยินใคร และดังแค่ไหน
//
// ห้องปิด (ประชุม / โฟกัส / กาแฟ / ไซต์) = ทุกคนในห้องได้ยินกันเต็มเสียง คนนอกห้องไม่ได้ยิน
// โซนโต๊ะทำงาน (โถงเปิด) = ได้ยินคนในรัศมี HEAR_RADIUS ช่อง เบาลงตามระยะ
//
// ตรรกะล้วน ทดสอบได้ — ถ้าผิด จะมีคน "แอบได้ยิน" ห้องประชุม ซึ่งร้ายแรงกว่าคุยไม่ได้

import { zoneAt, type OfficeMap, type Zone } from './officeMap'

export const HEAR_RADIUS = 3
/** สูงสุดกี่สายพร้อมกัน — เครื่องต่อเครื่องทุกคู่ (mesh) เกินนี้ CPU/เน็ตเริ่มหนัก */
export const MAX_PEERS = 6

export interface VoicePos { email: string; x: number; y: number }

const PRIVATE: Zone[] = ['meeting', 'focus', 'cafe', 'site']

/** ระยะแบบตาราง (ก้าวทแยงนับ 1) */
export const tileDistance = (a: VoicePos, b: VoicePos): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** ได้ยินกันไหม — ต้องอยู่โซนเดียวกัน; โซนโต๊ะต้องใกล้พอด้วย */
export function canHear(m: OfficeMap, a: VoicePos, b: VoicePos): boolean {
  const za = zoneAt(m, a.x, a.y), zb = zoneAt(m, b.x, b.y)
  if (za !== zb) return false
  if (PRIVATE.includes(za)) return true
  return tileDistance(a, b) <= HEAR_RADIUS
}

/** ความดัง 0–1 — ห้องปิดดังเต็ม · โต๊ะทำงานเบาลงตามระยะ (ติดกัน = เต็ม) */
export function volumeFor(m: OfficeMap, a: VoicePos, b: VoicePos): number {
  if (!canHear(m, a, b)) return 0
  if (PRIVATE.includes(zoneAt(m, a.x, a.y))) return 1
  const d = tileDistance(a, b)
  return d <= 1 ? 1 : d === 2 ? 0.6 : 0.3
}

/** คนที่ควรต่อสายด้วยตอนนี้ — ใกล้สุดก่อน ไม่เกิน MAX_PEERS */
export function peersToConnect(m: OfficeMap, me: VoicePos, others: VoicePos[]): string[] {
  return others
    .filter(o => o.email.toLowerCase() !== me.email.toLowerCase() && canHear(m, me, o))
    .sort((a, b) => tileDistance(me, a) - tileDistance(me, b))
    .slice(0, MAX_PEERS)
    .map(o => o.email.toLowerCase())
}

/**
 * ใครเป็นฝ่ายโทรออก (ส่ง offer) — อีเมลที่น้อยกว่าเสมอ
 * ต้องตกลงกันได้โดยไม่ต้องคุยกัน ไม่งั้นทั้งสองฝั่งโทรหากันพร้อมกันแล้วสายชน
 */
export const isCaller = (me: string, other: string): boolean => me.toLowerCase() < other.toLowerCase()

// ── สถานะไมค์ฝากไว้ในช่อง Room ของ HD_OfficePresence ──
//   "meeting"        ไม่ได้เข้าร่วมเสียง
//   "meeting:mic"    เข้าร่วมเสียง ไมค์เปิด
//   "meeting:muted"  เข้าร่วมเสียง ปิดไมค์อยู่ (ยังได้ยินคนอื่น — คนอื่นเห็นป้าย 🔇)
// ไม่ต้องสร้างคอลัมน์ใหม่ — ถ้าเพิ่มคอลัมน์แล้วลิสต์ยังไม่มี การบันทึกตำแหน่งจะพังทั้งแถว
export function encodeRoom(zone: string, mic: boolean, muted = false): string {
  return mic ? `${zone}:${muted ? 'muted' : 'mic'}` : zone
}

export function decodeRoom(raw?: string): { zone: string; mic: boolean; muted: boolean } {
  const s = (raw ?? '').trim()
  if (s.endsWith(':mic')) return { zone: s.slice(0, -4), mic: true, muted: false }
  if (s.endsWith(':muted')) return { zone: s.slice(0, -6), mic: true, muted: true }
  return { zone: s, mic: false, muted: false }
}

/** ห้องคนเยอะ — เข้าร่วมเสียงแบบปิดไมค์ไว้ก่อน ไม่โผล่มาส่งเสียงกลางวง */
export const CROWD_SIZE = 3
export const joinMuted = (othersInEarshot: number): boolean => othersInEarshot + 1 >= CROWD_SIZE

/** สิทธิ์ใช้เสียงของหน้าต่างหนึ่ง (คนเดียวเปิดหลายหน้าต่าง) — prio: 2 = กดเอง · 1 = เปิดอัตโนมัติในหน้าต่างที่โฟกัส · 0 = อัตโนมัติ ไม่โฟกัส */
export interface VoiceClaim { id: string; ts: number; prio: number }
/** a ชนะ b ไหม — กดเองชนะอัตโนมัติ · โฟกัสชนะไม่โฟกัส · เท่ากัน = ใหม่กว่าชนะ */
export const claimBeats = (a: VoiceClaim, b: VoiceClaim): boolean =>
  a.prio !== b.prio ? a.prio > b.prio : a.ts !== b.ts ? a.ts > b.ts : a.id > b.id
