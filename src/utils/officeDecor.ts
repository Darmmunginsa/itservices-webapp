// ตกแต่งโต๊ะของตัวเองในออฟฟิศ 2D
//
// แต่ละคน "วางโต๊ะของตัวเอง" ขนาด 3×3 ช่อง ตรงไหนก็ได้บนพื้นโซนทำงาน/ห้องโฟกัส เลือกแบบโต๊ะ + ทิศได้
// (โต๊ะที่อยู่ในผังเดิม = โต๊ะส่วนกลาง hot desk ใช้ร่วมกัน ไม่มีเจ้าของ)
// ตัวโต๊ะ (6 ช่อง) ขวางทางเดิน แถวที่นั่ง (3 ช่อง) เดินเข้าไปนั่งได้ · วางที่ปิดทางเดินไม่ได้
// ของแต่งรอบโต๊ะเป็นของประดับ — เดินผ่านได้ ไม่ขวางทาง
// เก็บ 1 แถว/คน ใน HD_OfficeDecor (JSON) — โหลดทั้งทีมทีเดียว ทีมไม่กี่สิบคนเบามาก

import { tileAt, isWalkable, type OfficeMap, type Pos } from './officeMap'

/** รัศมีจากกลางโต๊ะ = โต๊ะ 3×3 + รอบโต๊ะอีก 2 ช่อง (พื้นที่ 7×7) */
export const DECOR_RADIUS = 3
export const MAX_ITEMS = 24

export type Surface = 'desk' | 'floor'
export type Rot = 0 | 90 | 180 | 270

export interface DecorDef { kind: string; label: string; surface: Surface; group: string }

// แคตตาล็อก — surface บอกว่าวางได้ที่ไหน: desk = บนโต๊ะ(ของตัวเอง) · floor = พื้นรอบโต๊ะ
export const CATALOG: DecorDef[] = [
  { kind: 'mug',        label: 'แก้วกาแฟ',      surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'laptop',     label: 'โน้ตบุ๊ก',       surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'dualscreen', label: 'จอคู่',          surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'lamp',       label: 'โคมไฟตั้งโต๊ะ',   surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'photo',      label: 'กรอบรูป',        surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'books',      label: 'กองหนังสือ',     surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'cactus',     label: 'กระบองเพชร',     surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'headphones', label: 'หูฟัง',          surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'trophy',     label: 'ถ้วยรางวัล',     surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'duck',       label: 'เป็ดยาง (debug)', surface: 'desk', group: 'บนโต๊ะ' },
  { kind: 'sticky',     label: 'โพสต์อิท',       surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'globe',      label: 'ลูกโลก',         surface: 'desk',  group: 'บนโต๊ะ' },
  { kind: 'monstera',   label: 'ต้นมอนสเตอร่า',  surface: 'floor', group: 'ต้นไม้' },
  { kind: 'fern',       label: 'เฟิร์น',          surface: 'floor', group: 'ต้นไม้' },
  { kind: 'snake',      label: 'ลิ้นมังกร',       surface: 'floor', group: 'ต้นไม้' },
  { kind: 'bookshelf',  label: 'ชั้นหนังสือ',     surface: 'floor', group: 'เฟอร์นิเจอร์' },
  { kind: 'rug',        label: 'พรมกลม',         surface: 'floor', group: 'เฟอร์นิเจอร์' },
  { kind: 'beanbag',    label: 'บีนแบ็ก',        surface: 'floor', group: 'เฟอร์นิเจอร์' },
  { kind: 'floorlamp',  label: 'โคมไฟตั้งพื้น',   surface: 'floor', group: 'เฟอร์นิเจอร์' },
  { kind: 'fridge',     label: 'ตู้เย็นมินิ',     surface: 'floor', group: 'เฟอร์นิเจอร์' },
  { kind: 'aquarium',   label: 'ตู้ปลา',         surface: 'floor', group: 'ของเล่น' },
  { kind: 'guitar',     label: 'กีตาร์',         surface: 'floor', group: 'ของเล่น' },
  { kind: 'cat',        label: 'แมวนอนขด',       surface: 'floor', group: 'ของเล่น' },
  { kind: 'arcade',     label: 'ตู้เกม',          surface: 'floor', group: 'ของเล่น' },
  { kind: 'bike',       label: 'จักรยาน',        surface: 'floor', group: 'ของเล่น' },
]
const DEF = new Map(CATALOG.map(d => [d.kind, d]))
export const defOf = (kind: string): DecorDef | undefined => DEF.get(kind)

export interface DecorItem { id: string; kind: string; x: number; y: number; rot: Rot; flip: boolean }

// ── แบบโต๊ะ ──
export interface DeskStyle { style: string; label: string; hint: string }
export const DESK_STYLES: DeskStyle[] = [
  { style: 'classic',   label: 'ไม้คลาสสิก',     hint: 'โต๊ะไม้อบอุ่น เก้าอี้สำนักงาน' },
  { style: 'white',     label: 'มินิมอลขาว',      hint: 'ท็อปขาว ขาเหล็กบาง จอ all-in-one' },
  { style: 'standing',  label: 'โต๊ะยืน',         hint: 'ปรับระดับไฟฟ้า มีแผ่นรองยืน' },
  { style: 'gaming',    label: 'เกมมิ่ง RGB',      hint: 'ไฟ RGB วิ่ง จอโค้ง เก้าอี้เกมมิ่ง' },
  { style: 'executive', label: 'ผู้บริหาร',        hint: 'ไม้มะฮอกกานีเข้ม เก้าอี้หนัง โคมเขียว' },
  { style: 'lshape',    label: 'ตัว L',           hint: 'โต๊ะเข้ามุม จอสองจอ' },
  { style: 'glass',     label: 'กระจก',           hint: 'ท็อปกระจกใส ขาโครเมียม' },
  { style: 'drafting',  label: 'โต๊ะเขียนแบบ',     hint: 'ท็อปเอียง กระดาษแบบ เก้าอี้สูง' },
  { style: 'cafe',      label: 'โต๊ะกลมคาเฟ่',     hint: 'แนวฟรีแลนซ์ โน้ตบุ๊ก + กาแฟ' },
]
const STYLE_SET = new Set(DESK_STYLES.map(d => d.style))

export interface Desk extends Pos { style: string; rot: Rot }
export interface MyDecor { desk: Desk | null; items: DecorItem[] }
export const emptyDecor = (): MyDecor => ({ desk: null, items: [] })

/** อ่าน JSON จาก SharePoint แบบไม่เชื่อ — ของเสีย/ชนิดที่ไม่รู้จักทิ้ง ไม่ให้ทั้งแผนที่พัง */
export function parseDecor(raw?: string): MyDecor {
  try {
    const j = JSON.parse(raw || '{}') as { desk?: unknown; items?: unknown }
    const jd = j.desk as Partial<Desk> | undefined
    const desk: Desk | null = jd && typeof jd === 'object' && Number.isInteger(jd.x) && Number.isInteger(jd.y)
      ? {
          x: jd.x!, y: jd.y!,
          style: typeof jd.style === 'string' && STYLE_SET.has(jd.style) ? jd.style : 'classic',
          rot: ([0, 90, 180, 270] as const).includes(jd.rot as Rot) ? jd.rot as Rot : 0,
        }
      : null
    const items: DecorItem[] = Array.isArray(j.items) ? (j.items as Partial<DecorItem>[])
      .filter(i => i && typeof i.kind === 'string' && DEF.has(i.kind) && Number.isInteger(i.x) && Number.isInteger(i.y))
      .slice(0, MAX_ITEMS)
      .map((i, n) => ({
        id: typeof i.id === 'string' && i.id ? i.id : `i${n}`,
        kind: i.kind!, x: i.x!, y: i.y!,
        rot: ([0, 90, 180, 270] as const).includes(i.rot as Rot) ? i.rot as Rot : 0,
        flip: !!i.flip,
      })) : []
    return { desk, items }
  } catch { return emptyDecor() }
}

export const serializeDecor = (d: MyDecor): string => JSON.stringify(d)

export interface OthersDecor { email: string; name: string; decor: MyDecor }

const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
const k = (p: Pos) => `${p.x},${p.y}`

export type PlaceCheck = { ok: true } | { ok: false; reason: string }

// ── รูปทรงของโต๊ะ 3×3 ──
// พิกัดในโต๊ะ (dx,dy) -1..1 ก่อนหมุน: แถวบน dy=-1 + แถวกลาง dy=0 = ตัวโต๊ะ (เดินผ่านไม่ได้)
// แถวล่าง dy=1 = ที่นั่ง (เดินเข้าไปนั่งได้) · หมุนทั้งชุดรอบช่องกลางตามทิศของโต๊ะ
const ROT = (dx: number, dy: number, rot: Rot): [number, number] =>
  rot === 90 ? [-dy, dx] : rot === 180 ? [-dx, -dy] : rot === 270 ? [dy, -dx] : [dx, dy]
const world = (d: Pos & { rot: Rot }, dx: number, dy: number): Pos => {
  const [x, y] = ROT(dx, dy, d.rot)
  return { x: d.x + x, y: d.y + y }
}

/** ทั้ง 9 ช่องที่โต๊ะกิน */
export function deskFootprint(d: Pos): Pos[] {
  const out: Pos[] = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push({ x: d.x + dx, y: d.y + dy })
  return out
}

/** 6 ช่องที่เป็นตัวโต๊ะ (ขวางทาง) — ไม่รวมแถวที่นั่ง */
export function deskSurface(d: Pos & { rot: Rot }): Pos[] {
  const out: Pos[] = []
  for (const dy of [-1, 0]) for (const dx of [-1, 0, 1]) out.push(world(d, dx, dy))
  return out
}

/** จุดวางของบนโต๊ะ 4 จุด = มุมโต๊ะ (จอกลางแถวบน กับคีย์บอร์ดกลางโต๊ะ เป็นของโต๊ะอยู่แล้ว) */
export const DESK_ITEM_SLOTS = 4
export function deskItemSlots(d: Pos & { rot: Rot }): Pos[] {
  return [[-1, -1], [1, -1], [-1, 0], [1, 0]].map(([dx, dy]) => world(d, dx, dy))
}

/** ช่องที่ขวางทางเดินจากโต๊ะของทุกคน — ใช้สร้างแผนที่สำหรับเดิน */
export function blockedTiles(desks: (Desk | null | undefined)[]): Set<string> {
  const s = new Set<string>()
  for (const d of desks) if (d) for (const p of deskSurface(d)) s.add(k(p))
  return s
}

/** แผนที่สำหรับเดิน: ช่องที่เป็นตัวโต๊ะส่วนตัวกลายเป็น X (เดินไม่ได้) — แผนที่ที่วาดยังใช้ของเดิม */
export function walkableRows(rows: string[], blocked: Set<string>): string[] {
  if (!blocked.size) return rows
  return rows.map((r, y) => r.split('').map((ch, x) => (blocked.has(`${x},${y}`) ? 'X' : ch)).join(''))
}

/** นับกลุ่มพื้นที่เดินได้ที่ต่อถึงกัน — วางโต๊ะแล้วจำนวนเพิ่ม = ไปปิดทางจนบางส่วนเดินไปไม่ถึง */
function walkComponents(m: OfficeMap, blocked: Set<string>): number {
  const seen = new Set<string>()
  let n = 0
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    const key0 = `${x},${y}`
    if (seen.has(key0) || blocked.has(key0) || !isWalkable(m, x, y)) continue
    n++
    const q: Pos[] = [{ x, y }]
    seen.add(key0)
    while (q.length) {
      const c = q.shift()!
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = c.x + dx, ny = c.y + dy, nk = `${nx},${ny}`
        if (seen.has(nk) || blocked.has(nk) || !isWalkable(m, nx, ny)) continue
        seen.add(nk); q.push({ x: nx, y: ny })
      }
    }
  }
  return n
}

/** พื้นที่วางโต๊ะส่วนตัวได้: โซนโต๊ะทำงาน (.) และห้องโฟกัส (F) — ไม่วางกลางห้องประชุม/มุมกาแฟ/ทางออก */
const DESK_FLOORS = new Set(['.', 'F'])
/** ระยะห่างกึ่งกลางโต๊ะขั้นต่ำ = โต๊ะ 3 ช่อง + เว้นทางเดิน 1 ช่อง */
export const DESK_GAP = 4

/** วางโต๊ะของฉันโดยให้ช่องกลางอยู่ที่ at ได้ไหม (ทิศ = ทิศโต๊ะปัจจุบัน หรือ rot ที่ส่งมา) */
export function canPlaceDesk(m: OfficeMap, mine: MyDecor, others: OthersDecor[], at: Pos, rot: Rot = mine.desk?.rot ?? 0): PlaceCheck {
  const zone = tileAt(m, at.x, at.y)
  const fp = deskFootprint(at)
  if (!DESK_FLOORS.has(zone) || fp.some(p => tileAt(m, p.x, p.y) !== zone)) {
    return { ok: false, reason: 'โต๊ะกิน 3×3 ช่อง — ทั้ง 9 ช่องต้องอยู่บนพื้นโซนเดียวกัน (โซนโต๊ะทำงาน หรือห้องโฟกัส) ไม่ทับกำแพง/เฟอร์นิเจอร์' }
  }
  if (others.some(o => o.decor.desk && dist(o.decor.desk, at) < DESK_GAP)) return { ok: false, reason: 'ชิดโต๊ะคนอื่นเกินไป — ต้องเว้นทางเดินอย่างน้อย 1 ช่อง' }
  const fpSet = new Set(fp.map(k))
  if (others.some(o => o.decor.items.some(i => fpSet.has(k(i))))) return { ok: false, reason: 'ทับของแต่งของคนอื่น' }
  if (mine.items.some(i => defOf(i.kind)?.surface === 'floor' && fpSet.has(k(i)))) return { ok: false, reason: 'มีของแต่งของคุณวางอยู่ตรงนั้น — ย้ายออกก่อน' }
  // ห้ามปิดทาง: นับพื้นที่ที่ต่อถึงกันก่อน/หลังวาง
  const before = blockedTiles(others.map(o => o.decor.desk))
  const after = new Set(before)
  for (const p of deskSurface({ ...at, rot })) after.add(k(p))
  if (walkComponents(m, after) > walkComponents(m, before)) return { ok: false, reason: 'วางตรงนี้จะปิดทางเดิน จนบางส่วนของออฟฟิศเดินไปไม่ถึง' }
  return { ok: true }
}

/** ช่องกลางที่วางโต๊ะได้ — ไฮไลต์ตอนเลือกที่วางโต๊ะ */
export function deskSpots(m: OfficeMap, mine: MyDecor, others: OthersDecor[]): Pos[] {
  const out: Pos[] = []
  for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) if (canPlaceDesk(m, mine, others, { x, y }).ok) out.push({ x, y })
  return out
}

/** วางของชิ้นนี้ที่ช่องนี้ได้ไหม (มุมมองของฉัน) */
export function canPlace(m: OfficeMap, mine: MyDecor, others: OthersDecor[], kind: string, at: Pos, ignoreId?: string): PlaceCheck {
  const def = defOf(kind)
  if (!def) return { ok: false, reason: 'ไม่รู้จักของชิ้นนี้' }
  if (!mine.desk) return { ok: false, reason: 'วางโต๊ะก่อน แล้วค่อยแต่งรอบโต๊ะ' }
  if (dist(mine.desk, at) > DECOR_RADIUS) return { ok: false, reason: `วางได้เฉพาะรอบโต๊ะตัวเอง (${DECOR_RADIUS - 1} ช่องรอบโต๊ะ)` }
  const here = mine.items.filter(i => i.id !== ignoreId && i.x === at.x && i.y === at.y)
  if (def.surface === 'desk') {
    if (!deskItemSlots(mine.desk).some(p => p.x === at.x && p.y === at.y)) return { ok: false, reason: `${def.label} วางได้ที่มุมโต๊ะของคุณ (${DESK_ITEM_SLOTS} จุด)` }
    if (here.length) return { ok: false, reason: 'มุมโต๊ะนี้มีของอยู่แล้ว' }
  } else {
    if (deskFootprint(mine.desk).some(p => p.x === at.x && p.y === at.y)) return { ok: false, reason: `${def.label} วางบนพื้นรอบโต๊ะ ไม่ใช่บนโต๊ะ / ที่นั่ง` }
    if (!isWalkable(m, at.x, at.y)) return { ok: false, reason: `${def.label} ต้องวางบนพื้น` }
    // อยู่โซนเดียวกับโต๊ะเท่านั้น — รัศมีเลยกำแพงไปถึงห้องประชุม/มุมกาแฟ ซึ่งเป็นพื้นที่ส่วนกลาง
    if (tileAt(m, at.x, at.y) !== tileAt(m, mine.desk.x, mine.desk.y)) return { ok: false, reason: 'วางได้เฉพาะในโซนเดียวกับโต๊ะ — ห้องประชุม/มุมกาแฟเป็นพื้นที่ส่วนกลาง' }
    if (here.length) return { ok: false, reason: 'ช่องนี้มีของอยู่แล้ว' }
  }
  if (others.some(o => o.decor.items.some(i => i.x === at.x && i.y === at.y))) return { ok: false, reason: 'ช่องนี้เป็นของแต่งของคนอื่น' }
  if (others.some(o => o.decor.desk && deskFootprint(o.decor.desk).some(p => p.x === at.x && p.y === at.y))) return { ok: false, reason: 'โต๊ะของคนอื่น' }
  if (!ignoreId && mine.items.length >= MAX_ITEMS) return { ok: false, reason: `แต่งได้สูงสุด ${MAX_ITEMS} ชิ้น` }
  return { ok: true }
}

/** ช่องที่ของชิ้นนี้วางได้ — ใช้ไฮไลต์ตอนเลือกของ */
export function placeableTiles(m: OfficeMap, mine: MyDecor, others: OthersDecor[], kind: string): Pos[] {
  if (!mine.desk) return []
  const out: Pos[] = []
  for (let dy = -DECOR_RADIUS; dy <= DECOR_RADIUS; dy++) for (let dx = -DECOR_RADIUS; dx <= DECOR_RADIUS; dx++) {
    const p = { x: mine.desk.x + dx, y: mine.desk.y + dy }
    if (canPlace(m, mine, others, kind, p).ok) out.push(p)
  }
  return out
}

let seq = 0
export function placeItem(mine: MyDecor, kind: string, at: Pos): MyDecor {
  const id = `${Date.now().toString(36)}${(seq++).toString(36)}`
  return { ...mine, items: [...mine.items, { id, kind, x: at.x, y: at.y, rot: 0, flip: false }] }
}

export const rotateItem = (mine: MyDecor, id: string): MyDecor => ({
  ...mine, items: mine.items.map(i => (i.id === id ? { ...i, rot: ((i.rot + 90) % 360) as Rot } : i)),
})
export const flipItem = (mine: MyDecor, id: string): MyDecor => ({
  ...mine, items: mine.items.map(i => (i.id === id ? { ...i, flip: !i.flip } : i)),
})
export const removeItem = (mine: MyDecor, id: string): MyDecor => ({ ...mine, items: mine.items.filter(i => i.id !== id) })
export const moveItem = (mine: MyDecor, id: string, at: Pos): MyDecor => ({
  ...mine, items: mine.items.map(i => (i.id === id ? { ...i, x: at.x, y: at.y } : i)),
})

/** วาง / ย้ายโต๊ะ — ของแต่งเดิมย้ายตามโดยรักษาตำแหน่งสัมพัทธ์ ตัวที่ที่ใหม่วางไม่ได้ทิ้ง (บอกจำนวน) */
export function placeDesk(m: OfficeMap, mine: MyDecor, others: OthersDecor[], at: Pos, style?: string): { decor: MyDecor; dropped: number } | { error: string } {
  const c = canPlaceDesk(m, { ...mine, items: [] }, others, at)
  if (!c.ok) return { error: c.reason }
  const desk: Desk = { x: at.x, y: at.y, style: style ?? mine.desk?.style ?? 'classic', rot: mine.desk?.rot ?? 0 }
  if (!mine.desk) return { decor: { desk, items: [] }, dropped: 0 }
  const dx = at.x - mine.desk.x, dy = at.y - mine.desk.y
  let next: MyDecor = { desk, items: [] }
  let dropped = 0
  for (const i of mine.items) {
    const to = { x: i.x + dx, y: i.y + dy }
    if (canPlace(m, next, others, i.kind, to).ok) next = { ...next, items: [...next.items, { ...i, ...to }] }
    else dropped++
  }
  return { decor: next, dropped }
}

export const setDeskStyle = (mine: MyDecor, style: string): MyDecor =>
  mine.desk && STYLE_SET.has(style) ? { ...mine, desk: { ...mine.desk, style } } : mine

/**
 * หมุนโต๊ะ 90° — ของบนมุมโต๊ะหมุนตาม (ยังอยู่มุมเดิมของโต๊ะ) · ของวางพื้นอยู่ที่เดิม
 * ทิศใหม่อาจไปปิดทางเดิน (ตัวโต๊ะย้ายแถว) → ปฏิเสธพร้อมเหตุผล
 */
export function rotateDesk(m: OfficeMap, mine: MyDecor, others: OthersDecor[]): { decor: MyDecor } | { error: string } {
  if (!mine.desk) return { error: 'ยังไม่มีโต๊ะ' }
  const d = mine.desk
  const rot = ((d.rot + 90) % 360) as Rot
  const c = canPlaceDesk(m, { ...mine, items: mine.items.filter(i => !deskFootprint(d).some(p => p.x === i.x && p.y === i.y)) }, others, d, rot)
  if (!c.ok) return { error: c.reason }
  const turn = (p: Pos): Pos => { const [x, y] = ROT(p.x - d.x, p.y - d.y, 90); return { x: d.x + x, y: d.y + y } }
  const onDesk = (i: DecorItem) => defOf(i.kind)?.surface === 'desk'
  return { decor: { desk: { ...d, rot }, items: mine.items.map(i => (onDesk(i) ? { ...i, ...turn(i) } : i)) } }
}
