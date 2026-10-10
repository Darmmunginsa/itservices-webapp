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
 *  g  หญ้า · p ทางเดินหิน (เดินได้ = โซนสวน) · w บ่อน้ำ · f แปลงดอกไม้ · h รั้วพุ่มไม้ (เดินไม่ได้)
 */
// โต๊ะส่วนกลาง (hot desk) แถวเดียว — พื้นที่ที่เหลือเปิดโล่งไว้ให้สมาชิกวางโต๊ะส่วนตัว 3×3 เอง
// สวนด้านขวา (x 28–38): หญ้า ทางเดินหิน บ่อ แปลงดอกไม้ รั้วพุ่มไม้ · น้ำตก/ม้านั่ง/น้ำพุ เป็น prop (officeProps.ts)
export const DEFAULT_MAP = [
  '########################################',
  '#..........#MMMMMMMMMMW...L#ggggggggggg#',
  '#.dd.dd.dd.#MMMTTTTMMM.....#ggggggggggg#',
  '#..........#MMMTTTTMMM.GY..#ggggggggggg#',
  '#..........#MMMMMMMMMM.....#ggggggggggg#',
  '#..........####...####.....#gffgggggffg#',
  '#...........................pppppppppgg#',
  '#N.........R..........J.....gggggpggggg#',
  '#######..#######....###..###gggggpggggg#',
  '#FFFFF..FFF#CCCCCCCCCC#SSSE#gwwwgpggggg#',
  '#FFFFF..FFZ#CKCCCCCCCC#SSSS#gwwwgpggggg#',
  '#FFFFF..FFF#CCCTTCCCCC#SSSS#ggggppppppg#',
  '#FFFFF..FFF#CCCCCCCCCC#SSSS#hhhhhhhhhhh#',
  '########################################',
]

/** ต้นไม้ทุกชนิด — วาดแบบมองด้านข้าง สูงล้นขึ้นไปช่องบนได้ · เดินผ่านไม่ได้ */
export const PLANT_TILES = 'PGYLRUZNJ'
/** ช่องเฟอร์นิเจอร์/ต้นไม้ — วางชั้นเหนือพื้น (วาดล้นขอบช่องได้โดยไม่ถูกช่องข้าง ๆ ทับ) */
export const FURNITURE_TILES = 'dTKWh' + PLANT_TILES
export const isFurnitureTile = (ch: string): boolean => FURNITURE_TILES.includes(ch)

export type Zone = 'desk' | 'meeting' | 'focus' | 'cafe' | 'site' | 'garden'

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

const WALKABLE = new Set(['.', 'M', 'F', 'C', 'S', 'E', 'g', 'p'])
const ZONE_OF: Record<string, Zone> = { '.': 'desk', M: 'meeting', F: 'focus', C: 'cafe', S: 'site', E: 'site', g: 'garden', p: 'garden' }

export const tileAt = (m: OfficeMap, x: number, y: number): string =>
  (y < 0 || y >= m.height || x < 0 || x >= m.width) ? '#' : m.rows[y][x]

export const isWalkable = (m: OfficeMap, x: number, y: number): boolean => WALKABLE.has(tileAt(m, x, y))

export const zoneAt = (m: OfficeMap, x: number, y: number): Zone => ZONE_OF[tileAt(m, x, y)] ?? 'desk'

/** โซน → สถานะที่ตั้งให้อัตโนมัติ (null = ว่าง / จบ slot ที่ตั้งไว้) */
export const ZONE_STATUS: Record<Zone, StatusType | null> = {
  desk: null, meeting: 'Meeting', focus: 'Busy', cafe: 'Break', site: 'OnSite', garden: 'Break',
}

export const ZONE_LABEL: Record<Zone, string> = {
  desk: 'โต๊ะทำงาน', meeting: 'ห้องประชุม', focus: 'ห้องโฟกัส', cafe: 'มุมกาแฟ', site: 'ออกไซต์', garden: 'สวน',
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

// ── ตัวแก้ผังออฟฟิศ (Admin) ──
export interface TileDef { ch: string; label: string; walkable: boolean; hint: string; group?: 'พื้น/ห้อง' | 'ต้นไม้' | 'สวน' | 'เฟอร์นิเจอร์' }
export const TILE_PALETTE: TileDef[] = [
  { ch: '.', label: 'พื้นโต๊ะทำงาน', walkable: true,  hint: 'โซนว่าง — จุดเกิดของคนใหม่' },
  { ch: '#', label: 'กำแพง',        walkable: false, hint: 'เดินไม่ได้ กั้นห้อง' },
  { ch: 'M', label: 'ห้องประชุม',    walkable: true,  hint: 'เข้าแล้วสถานะ = ประชุม' },
  { ch: 'F', label: 'ห้องโฟกัส',     walkable: true,  hint: 'เข้าแล้วสถานะ = ไม่ว่าง' },
  { ch: 'C', label: 'มุมกาแฟ',       walkable: true,  hint: 'เข้าแล้วสถานะ = พัก' },
  { ch: 'S', label: 'โซนไซต์',       walkable: true,  hint: 'เข้าแล้วสถานะ = ออกไซต์' },
  { ch: 'E', label: 'ประตูออก',      walkable: true,  hint: 'เหมือนโซนไซต์ แต่มีรูปประตู' },
  { ch: 'd', label: 'โต๊ะ + คอม',     walkable: false, hint: 'เฟอร์นิเจอร์ (เดินไม่ได้)' },
  { ch: 'T', label: 'โต๊ะประชุม',    walkable: false, hint: 'เฟอร์นิเจอร์ (เดินไม่ได้)' },
  { ch: 'P', label: 'มอนสเตอร่า',    walkable: false, hint: 'ต้นไม้ — ใบใหญ่ฉีกแฉก พุ่มกว้าง' },
  { ch: 'G', label: 'ปาล์ม',         walkable: false, hint: 'ต้นไม้ — ลำต้นสูง ทางใบแผ่' },
  { ch: 'Y', label: 'ไผ่',           walkable: false, hint: 'ต้นไม้ — หลายลำ ใบเรียวไหวลม' },
  { ch: 'L', label: 'ไทรใบสัก',      walkable: false, hint: 'ต้นไม้ — ใบใหญ่ซ้อนเป็นชั้น' },
  { ch: 'R', label: 'เฟื่องฟ้า',      walkable: false, hint: 'ต้นไม้ — พุ่มกลม ดอกชมพูเต็มต้น' },
  { ch: 'U', label: 'กระบองเพชรยักษ์', walkable: false, hint: 'ต้นไม้ — ลำสูงมีแขน' },
  { ch: 'Z', label: 'บอนไซ',         walkable: false, hint: 'ต้นไม้ — ลำต้นบิด พุ่มเป็นแพ' },
  { ch: 'N', label: 'สน',            walkable: false, hint: 'ต้นไม้ — ชั้นใบสามเหลี่ยม' },
  { ch: 'J', label: 'ลีลาวดี',        walkable: false, hint: 'ต้นไม้ — กิ่งอวบ ดอกขาวเหลือง' },
  { ch: 'K', label: 'เครื่องกาแฟ',   walkable: false, hint: 'ตกแต่ง (เดินไม่ได้)' },
  { ch: 'W', label: 'ไวท์บอร์ด',     walkable: false, hint: 'ตกแต่ง (เดินไม่ได้)' },
  { ch: 'g', label: 'หญ้า',          walkable: true,  hint: 'สนามหญ้าเขียว — เดินเข้าแล้วสถานะ = พัก (โซนสวน)', group: 'สวน' },
  { ch: 'p', label: 'ทางเดินหิน',     walkable: true,  hint: 'แผ่นหินบนหญ้า (โซนสวน)', group: 'สวน' },
  { ch: 'w', label: 'บ่อน้ำ',         walkable: false, hint: 'น้ำกระเพื่อม มีปลา — ขอบบ่อต่อกันเอง', group: 'สวน' },
  { ch: 'f', label: 'แปลงดอกไม้',     walkable: false, hint: 'ดอกไม้หลากสี', group: 'สวน' },
  { ch: 'h', label: 'รั้วพุ่มไม้',      walkable: false, hint: 'พุ่มไม้ตัดแต่ง ต่อกันเป็นแนวรั้ว', group: 'สวน' },
]
const KNOWN_TILES = new Set(TILE_PALETTE.map(t => t.ch))

export const MAP_MIN = 8
export const MAP_MAX = 60

/** วางช่อง — คืน rows ใหม่ (ไม่แก้ของเดิม) · นอกขอบ = ไม่ทำอะไร */
export function setTile(rows: string[], x: number, y: number, ch: string): string[] {
  if (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length) return rows
  if (rows[y][x] === ch) return rows
  return rows.map((r, i) => (i === y ? r.slice(0, x) + ch + r.slice(x + 1) : r))
}

/** ย่อ/ขยาย — ช่องใหม่เป็นพื้น '.' และขอบนอกสุดเป็นกำแพงเสมอ (กันเดินตกขอบ) */
export function resizeMap(rows: string[], width: number, height: number): string[] {
  const w = Math.max(MAP_MIN, Math.min(MAP_MAX, Math.floor(width)))
  const h = Math.max(MAP_MIN, Math.min(MAP_MAX, Math.floor(height)))
  const out: string[] = []
  for (let y = 0; y < h; y++) {
    const src = rows[y] ?? ''
    let line = ''
    for (let x = 0; x < w; x++) line += src[x] ?? '.'
    out.push(line)
  }
  return out.map((r, y) => (y === 0 || y === h - 1) ? '#'.repeat(w) : '#' + r.slice(1, w - 1) + '#')
}

/** ผังเปล่า: กำแพงรอบ พื้นข้างใน */
export function blankMap(width: number, height: number): string[] {
  return resizeMap([], width, height)
}

export interface MapIssue { level: 'error' | 'warn'; text: string }

/** ตรวจก่อนบันทึก — error = บันทึกไม่ได้ · warn = บันทึกได้แต่ควรรู้ */
/** ทำให้ช่องที่ถูกสิ่งของขวางเป็น X (เดินไม่ได้) — ใช้ตรวจ/เดิน แต่ไม่ใช่ตอนวาดพื้น */
export function maskRows(rows: string[], blocked: Set<string>): string[] {
  if (!blocked.size) return rows
  return rows.map((r, y) => r.split('').map((ch, x) => (blocked.has(`${x},${y}`) ? 'X' : ch)).join(''))
}

export function validateMap(rows: string[], blocked: Set<string> = new Set()): MapIssue[] {
  const out: MapIssue[] = []
  if (rows.length < MAP_MIN) out.push({ level: 'error', text: `สูงอย่างน้อย ${MAP_MIN} แถว` })
  const w = rows[0]?.length ?? 0
  if (w < MAP_MIN) out.push({ level: 'error', text: `กว้างอย่างน้อย ${MAP_MIN} ช่อง` })
  if (rows.some(r => r.length !== w)) out.push({ level: 'error', text: 'ทุกแถวต้องยาวเท่ากัน' })
  const unknown = new Set<string>()
  for (const r of rows) for (const ch of r) if (!KNOWN_TILES.has(ch)) unknown.add(ch)
  if (unknown.size) out.push({ level: 'error', text: `มีตัวอักษรที่ไม่รู้จัก: ${[...unknown].join(' ')}` })
  if (out.some(i => i.level === 'error')) return out

  // สิ่งของชิ้นใหญ่ (น้ำตก ศาลา ...) ขวางทางเหมือนเฟอร์นิเจอร์ — ตรวจทางเดินบนผังที่มีของวางแล้ว
  const m = parseMap(maskRows(rows, blocked))
  const border = [...Array(m.width).keys()].every(x => tileAt(m, x, 0) === '#' && tileAt(m, x, m.height - 1) === '#')
    && [...Array(m.height).keys()].every(y => tileAt(m, 0, y) === '#' && tileAt(m, m.width - 1, y) === '#')
  if (!border) out.push({ level: 'error', text: 'ขอบนอกสุดต้องเป็นกำแพงทั้งหมด' })
  let spawns = 0, walkable = 0
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (tileAt(m, x, y) === '.') spawns++
    if (isWalkable(m, x, y)) walkable++
  }
  if (!spawns) out.push({ level: 'error', text: 'ต้องมีพื้นโต๊ะทำงาน (.) อย่างน้อย 1 ช่อง — เป็นจุดเกิด' })
  if (out.some(i => i.level === 'error')) return out

  // ช่องเดินได้ที่ไปไม่ถึงจากจุดเกิด = ห้องที่ถูกกำแพงล้อม คนจะเข้าไม่ได้ (หรือติดอยู่ข้างใน)
  const start = spawnPoint(m, 0)
  const seen = new Set<string>([`${start.x},${start.y}`])
  const q = [start]
  while (q.length) {
    const c = q.shift()!
    for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
      const n = step(m, c, d)
      const k = `${n.x},${n.y}`
      if (n !== c && !seen.has(k)) { seen.add(k); q.push(n) }
    }
  }
  const unreachable = walkable - seen.size
  if (unreachable > 0) out.push({ level: 'warn', text: `มีพื้นที่เดินได้ ${unreachable} ช่องที่เดินไปไม่ถึง (ถูกกำแพง/เฟอร์นิเจอร์ล้อม)` })
  for (const z of ['M', 'F', 'C'] as const) {
    if (!rows.some(r => r.includes(z))) out.push({ level: 'warn', text: `ไม่มี${TILE_PALETTE.find(t => t.ch === z)!.label} — สถานะนั้นจะตั้งด้วยการเดินไม่ได้` })
  }
  if (!rows.some(r => r.includes('S') || r.includes('E'))) out.push({ level: 'warn', text: 'ไม่มีโซนไซต์/ประตู — "ออกไซต์" จะตั้งด้วยการเดินไม่ได้' })
  return out
}
