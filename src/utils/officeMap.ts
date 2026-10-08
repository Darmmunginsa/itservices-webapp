// ออฟฟิศ 2D แบบ Gather — แผนที่เป็นตัวอักษร เดินด้วยคีย์บอร์ด เข้าโซนแล้วสถานะเปลี่ยนเอง
//
// เฟส A: ตำแหน่งเก็บใน SharePoint (HD_OfficePresence) poll ทุก ~3 วิ — คนอื่นเลื่อนตามแบบ tween
// เฟส B (รองบ): เปลี่ยนตัวส่ง/รับเป็น Azure Web PubSub โดยไม่แตะไฟล์นี้
//
// ตรรกะล้วน ทดสอบได้: เดินทะลุกำแพง / โซนผิด = คน "หาย" หรือสถานะเพี้ยนทั้งทีม

import type { StatusType } from '../types/teamStatus'

/**
 * ตัวอักษรบนแผนที่
 *  #  กำแพง (เดินไม่ได้)        .  พื้นโซนโต๊ะทำงาน (ว่าง)
 *  M  พื้นห้องประชุม             F  พื้นห้องโฟกัส
 *  C  พื้นมุมกาแฟ               S  พื้นโซน "ออกไซต์" (หน้าประตู)
 *  d  โต๊ะ+คอม (เดินไม่ได้)      T  โต๊ะประชุม (เดินไม่ได้)
 *  P  ต้นไม้ · K เครื่องกาแฟ · W ไวท์บอร์ด · E ประตูออก (เดินได้ = ออกไซต์)
 */
export const DEFAULT_MAP = [
  '############################',
  '#..........#MMMMMMMMMMW....#',
  '#.dd.dd.dd.#MMMTTTTMMM.....#',
  '#..........#MMMTTTTMMM.PP..#',
  '#.dd.dd.dd.#MMMMMMMMMM.....#',
  '#..........####...####.....#',
  '#.dd.dd.dd.................#',
  '#..........P..........P....#',
  '#######..#######....########',
  '#FFFFF..FFF#CCCCCCCCCC#SSSE#',
  '#FFdFF..FdF#CKCCCCCCCC#SSSS#',
  '#FFFFF..FFF#CCCTTCCCCC#SSSS#',
  '#FFFFF..FFF#CCCCCCCCCC#SSSS#',
  '############################',
]

export type Zone = 'desk' | 'meeting' | 'focus' | 'cafe' | 'site'

export interface OfficeMap {
  rows: string[]
  width: number
  height: number
}

export function parseMap(rows: string[]): OfficeMap {
  const width = Math.max(...rows.map(r => r.length))
  // แถวสั้นเติมกำแพง — แผนที่ที่ Admin แก้เองอาจยาวไม่เท่ากัน ไม่ให้เดินตกขอบ
  return { rows: rows.map(r => r.padEnd(width, '#')), width, height: rows.length }
}

const WALKABLE = new Set(['.', 'M', 'F', 'C', 'S', 'E'])
const ZONE_OF: Record<string, Zone> = { '.': 'desk', M: 'meeting', F: 'focus', C: 'cafe', S: 'site', E: 'site' }

export const tileAt = (m: OfficeMap, x: number, y: number): string =>
  (y < 0 || y >= m.height || x < 0 || x >= m.width) ? '#' : m.rows[y][x]

export const isWalkable = (m: OfficeMap, x: number, y: number): boolean => WALKABLE.has(tileAt(m, x, y))

export const zoneAt = (m: OfficeMap, x: number, y: number): Zone => ZONE_OF[tileAt(m, x, y)] ?? 'desk'

/** โซน → สถานะที่ตั้งให้อัตโนมัติ (null = ว่าง / จบ slot ที่ตั้งไว้) */
export const ZONE_STATUS: Record<Zone, StatusType | null> = {
  desk: null, meeting: 'Meeting', focus: 'Busy', cafe: 'Break', site: 'OnSite',
}

export const ZONE_LABEL: Record<Zone, string> = {
  desk: 'โต๊ะทำงาน', meeting: 'ห้องประชุม', focus: 'ห้องโฟกัส', cafe: 'มุมกาแฟ', site: 'ออกไซต์',
}

export type Dir = 'up' | 'down' | 'left' | 'right'

export interface Pos { x: number; y: number }

/** ก้าวหนึ่งช่อง — ชนกำแพง/เฟอร์นิเจอร์ = อยู่ที่เดิม (คืน object เดิม ให้เทียบ === ได้ว่าไม่ขยับ) */
export function step(m: OfficeMap, p: Pos, dir: Dir): Pos {
  const nx = p.x + (dir === 'left' ? -1 : dir === 'right' ? 1 : 0)
  const ny = p.y + (dir === 'up' ? -1 : dir === 'down' ? 1 : 0)
  return isWalkable(m, nx, ny) ? { x: nx, y: ny } : p
}

export const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
}

/**
 * จุดเกิดคนที่ i — ช่องโต๊ะทำงานว่างไล่จากซ้ายบน ไม่ให้ทุกคนทับกันตรงช่องเดียว
 * ใช้เมื่อยังไม่มีแถวตำแหน่งของคนนั้น
 */
export function spawnPoint(m: OfficeMap, index: number): Pos {
  const spots: Pos[] = []
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (tileAt(m, x, y) === '.') spots.push({ x, y })
  if (!spots.length) return { x: 1, y: 1 }
  return spots[Math.max(0, index) % spots.length]
}

/** ออนไลน์ = มี heartbeat ภายใน 90 วิ (poll 3 วิ + heartbeat 30 วิ + เผื่อแท็บหลับ) */
export const ONLINE_MS = 90_000
export function isOnline(lastSeenIso: string | undefined, now: Date): boolean {
  if (!lastSeenIso) return false
  const t = new Date(lastSeenIso).getTime()
  return !isNaN(t) && now.getTime() - t <= ONLINE_MS
}

/** ตำแหน่งที่ส่งมาจาก SharePoint อาจนอกแผนที่ (แผนที่ถูกแก้ทีหลัง) → ดึงกลับจุดเกิด */
export function clampToMap(m: OfficeMap, p: Pos, fallbackIndex = 0): Pos {
  return isWalkable(m, p.x, p.y) ? p : spawnPoint(m, fallbackIndex)
}

// ── แชท ──
export interface ChatLike { Room?: string }

/** ข้อความที่เห็นในแท็บ: 'all' = ทั้งออฟฟิศ (Room ว่าง) · โซน = เฉพาะที่ส่งจากโซนนั้น */
export function chatVisible(msg: ChatLike, tab: 'all' | Zone): boolean {
  const room = (msg.Room ?? '').trim()
  return tab === 'all' ? room === '' : room === tab
}

/** คนในโซนเดียวกัน (ไม่นับตัวเอง) — ใช้บอกว่าแชท "ห้องนี้" จะถึงใครบ้าง */
export function sameZone<T extends { x: number; y: number; email: string }>(m: OfficeMap, me: { x: number; y: number; email: string }, others: T[]): T[] {
  const z = zoneAt(m, me.x, me.y)
  return others.filter(o => o.email.toLowerCase() !== me.email.toLowerCase() && zoneAt(m, o.x, o.y) === z)
}

/**
 * เส้นทางสั้นสุดจาก from → to (BFS 4 ทิศ) — คืนลำดับช่องที่ต้องเหยียบ ไม่รวมช่องเริ่ม
 * ไม่มีทาง / ปลายทางเดินไม่ได้ → [] · แผนที่เล็ก (≈ 400 ช่อง) BFS ทุกคลิกไม่หนัก
 */
export function findPath(m: OfficeMap, from: Pos, to: Pos): Pos[] {
  if (!isWalkable(m, to.x, to.y)) return []
  if (from.x === to.x && from.y === to.y) return []
  const key = (p: Pos) => p.y * m.width + p.x
  const prev = new Map<number, number>()
  const seen = new Set<number>([key(from)])
  const q: Pos[] = [from]
  const dirs: Dir[] = ['up', 'down', 'left', 'right']
  while (q.length) {
    const cur = q.shift()!
    for (const d of dirs) {
      const n = step(m, cur, d)
      if (n === cur) continue
      const k = key(n)
      if (seen.has(k)) continue
      seen.add(k); prev.set(k, key(cur))
      if (n.x === to.x && n.y === to.y) {
        const path: Pos[] = []
        let k2 = k
        while (k2 !== key(from)) { path.push({ x: k2 % m.width, y: Math.floor(k2 / m.width) }); k2 = prev.get(k2)! }
        return path.reverse()
      }
      q.push(n)
    }
  }
  return []
}
