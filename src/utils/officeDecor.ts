// ตกแต่งโต๊ะของตัวเองในออฟฟิศ 2D
//
// แต่ละคน "วางโต๊ะของตัวเอง" ตรงไหนก็ได้บนพื้นโซนทำงาน/ห้องโฟกัส เลือกแบบโต๊ะ + ทิศได้
// (โต๊ะที่อยู่ในผังเดิม = โต๊ะส่วนกลาง hot desk ใช้ร่วมกัน ไม่มีเจ้าของ)
// แล้ววางของแต่งได้ในรัศมี DECOR_RADIUS ช่องรอบโต๊ะ (รวมบนโต๊ะเอง)
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

/** พื้นที่วางโต๊ะส่วนตัวได้: โซนโต๊ะทำงาน (.) และห้องโฟกัส (F) — ไม่วางกลางห้องประชุม/มุมกาแฟ/ทางออก */
const DESK_FLOORS = new Set(['.', 'F'])

/** วางโต๊ะของฉันที่ช่องนี้ได้ไหม */
export function canPlaceDesk(m: OfficeMap, mine: MyDecor, others: OthersDecor[], at: Pos): PlaceCheck {
  if (!DESK_FLOORS.has(tileAt(m, at.x, at.y))) return { ok: false, reason: 'วางโต๊ะได้บนพื้นโซนโต๊ะทำงาน หรือห้องโฟกัส' }
  if (others.some(o => o.decor.desk && o.decor.desk.x === at.x && o.decor.desk.y === at.y)) return { ok: false, reason: 'มีโต๊ะของคนอื่นอยู่แล้ว' }
  if (others.some(o => o.decor.items.some(i => i.x === at.x && i.y === at.y))) return { ok: false, reason: 'ตรงนี้เป็นของแต่งของคนอื่น' }
  // ชิดโต๊ะคนอื่นเกินไป = ของแต่งรอบโต๊ะจะทับกันหมด — เว้นอย่างน้อย 1 ช่อง
  if (others.some(o => o.decor.desk && dist(o.decor.desk, at) < 2)) return { ok: false, reason: 'ชิดโต๊ะคนอื่นเกินไป — เว้นอย่างน้อย 1 ช่อง' }
  if (mine.items.some(i => defOf(i.kind)?.surface === 'floor' && i.x === at.x && i.y === at.y)) return { ok: false, reason: 'มีของแต่งของคุณวางอยู่ — ย้ายออกก่อน' }
  return { ok: true }
}

/** ทุกช่องที่วางโต๊ะได้ — ไฮไลต์ตอนเลือกจุดวางโต๊ะ */
export function deskSpots(m: OfficeMap, mine: MyDecor, others: OthersDecor[]): Pos[] {
  const out: Pos[] = []
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (canPlaceDesk(m, mine, others, { x, y }).ok) out.push({ x, y })
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
  // โต๊ะส่วนตัววางบนพื้น ช่องโต๊ะจึงเป็นพื้นที่เดินได้ — ต้องกันของวางพื้นไม่ให้ทับโต๊ะตัวเอง
  if (def.surface === 'floor' && onMyDesk) return { ok: false, reason: `${def.label} วางบนพื้นรอบโต๊ะ ไม่ใช่บนโต๊ะ` }
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
export const rotateDesk = (mine: MyDecor): MyDecor =>
  mine.desk ? { ...mine, desk: { ...mine.desk, rot: ((mine.desk.rot + 90) % 360) as Rot } } : mine

/** ตำแหน่งของชิ้นบนโต๊ะ (0 ซ้าย · 1 ขวา · 2 หน้า) ตามลำดับที่วาง */
export function deskSlot(mine: MyDecor, item: DecorItem): number {
  if (!mine.desk || item.x !== mine.desk.x || item.y !== mine.desk.y) return -1
  return mine.items.filter(i => i.x === item.x && i.y === item.y).findIndex(i => i.id === item.id)
}
