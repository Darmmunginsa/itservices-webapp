// ตกแต่งโต๊ะของตัวเองในออฟฟิศ 2D
//
// แต่ละคน "จอง" โต๊ะ 1 ตัว แล้ววางของแต่งได้ในรัศมี DECOR_RADIUS ช่องรอบโต๊ะ (รวมบนโต๊ะเอง)
// ของแต่งเป็นของประดับ — เดินผ่านได้ ไม่ขวางทาง (ไม่งั้นแต่งจนปิดทางเดินคนอื่น หรือขังตัวเองไว้ได้)
// เก็บ 1 แถว/คน ใน HD_OfficeDecor (JSON) — โหลดทั้งทีมทีเดียว ทีมไม่กี่สิบคนเบามาก

import { tileAt, isWalkable, type OfficeMap, type Pos } from './officeMap'

export const DECOR_RADIUS = 2
export const MAX_ITEMS = 16
/** ของบนโต๊ะวางได้กี่ชิ้น — ซ้าย / ขวา / หน้า (จอกลางโต๊ะเป็นของโต๊ะอยู่แล้ว) */
export const DESK_SLOTS = 3

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
export interface MyDecor { desk: Pos | null; items: DecorItem[] }
export const emptyDecor = (): MyDecor => ({ desk: null, items: [] })

/** อ่าน JSON จาก SharePoint แบบไม่เชื่อ — ของเสีย/ชนิดที่ไม่รู้จักทิ้ง ไม่ให้ทั้งแผนที่พัง */
export function parseDecor(raw?: string): MyDecor {
  try {
    const j = JSON.parse(raw || '{}') as { desk?: unknown; items?: unknown }
    const desk = j.desk && typeof j.desk === 'object' && Number.isInteger((j.desk as Pos).x) && Number.isInteger((j.desk as Pos).y)
      ? { x: (j.desk as Pos).x, y: (j.desk as Pos).y } : null
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

const key = (p: Pos) => `${p.x},${p.y}`
const dist = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** โต๊ะ (ช่อง d) ที่ยังไม่มีใครจอง */
export function freeDesks(m: OfficeMap, others: OthersDecor[]): Pos[] {
  const taken = new Set(others.filter(o => o.decor.desk).map(o => key(o.decor.desk!)))
  const out: Pos[] = []
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (tileAt(m, x, y) === 'd' && !taken.has(`${x},${y}`)) out.push({ x, y })
  }
  return out
}

export type PlaceCheck = { ok: true } | { ok: false; reason: string }

/** วางของชิ้นนี้ที่ช่องนี้ได้ไหม (มุมมองของฉัน) */
export function canPlace(m: OfficeMap, mine: MyDecor, others: OthersDecor[], kind: string, at: Pos, ignoreId?: string): PlaceCheck {
  const def = defOf(kind)
  if (!def) return { ok: false, reason: 'ไม่รู้จักของชิ้นนี้' }
  if (!mine.desk) return { ok: false, reason: 'จองโต๊ะก่อน แล้วค่อยแต่งรอบโต๊ะ' }
  if (dist(mine.desk, at) > DECOR_RADIUS) return { ok: false, reason: `วางได้เฉพาะรอบโต๊ะตัวเอง ${DECOR_RADIUS} ช่อง` }
  const onMyDesk = at.x === mine.desk.x && at.y === mine.desk.y
  if (def.surface === 'desk' && !onMyDesk) return { ok: false, reason: `${def.label} วางได้บนโต๊ะของคุณเท่านั้น` }
  if (def.surface === 'floor' && !isWalkable(m, at.x, at.y)) return { ok: false, reason: `${def.label} ต้องวางบนพื้น` }
  const here = mine.items.filter(i => i.id !== ignoreId && i.x === at.x && i.y === at.y)
  if (onMyDesk ? here.length >= DESK_SLOTS : here.length > 0) return { ok: false, reason: onMyDesk ? `บนโต๊ะวางได้ ${DESK_SLOTS} ชิ้น` : 'ช่องนี้มีของอยู่แล้ว' }
  if (others.some(o => o.decor.items.some(i => i.x === at.x && i.y === at.y))) return { ok: false, reason: 'ช่องนี้เป็นของแต่งของคนอื่น' }
  if (others.some(o => o.decor.desk && o.decor.desk.x === at.x && o.decor.desk.y === at.y)) return { ok: false, reason: 'โต๊ะของคนอื่น' }
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

/** จองโต๊ะ — ย้ายโต๊ะ = ของแต่งเดิมย้ายตามโดยรักษาตำแหน่งสัมพัทธ์ ตัวที่ย้ายไปแล้ววางไม่ได้ทิ้ง */
export function claimDesk(m: OfficeMap, mine: MyDecor, others: OthersDecor[], desk: Pos): { decor: MyDecor; dropped: number } | { error: string } {
  if (tileAt(m, desk.x, desk.y) !== 'd') return { error: 'จองได้เฉพาะช่องที่เป็นโต๊ะ' }
  if (others.some(o => o.decor.desk && o.decor.desk.x === desk.x && o.decor.desk.y === desk.y)) return { error: 'โต๊ะนี้มีคนจองแล้ว' }
  if (!mine.desk) return { decor: { desk, items: [] }, dropped: 0 }
  const dx = desk.x - mine.desk.x, dy = desk.y - mine.desk.y
  let next: MyDecor = { desk, items: [] }
  let dropped = 0
  for (const i of mine.items) {
    const at = { x: i.x + dx, y: i.y + dy }
    if (canPlace(m, next, others, i.kind, at).ok) next = { ...next, items: [...next.items, { ...i, ...at }] }
    else dropped++
  }
  return { decor: next, dropped }
}

/** ตำแหน่งของชิ้นบนโต๊ะ (0 ซ้าย · 1 ขวา · 2 หน้า) ตามลำดับที่วาง */
export function deskSlot(mine: MyDecor, item: DecorItem): number {
  if (!mine.desk || item.x !== mine.desk.x || item.y !== mine.desk.y) return -1
  return mine.items.filter(i => i.x === item.x && i.y === item.y).findIndex(i => i.id === item.id)
}
