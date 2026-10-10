// สิ่งของชิ้นใหญ่บนผังออฟฟิศ (props) — น้ำตก ศาลา ม้านั่ง โต๊ะปิงปอง ...
//
// ผังเป็นตัวอักษร 1 ช่อง/1 ตัว จึงวาดของหลายช่อง (น้ำตก 8×4) เป็นภาพเดียวไม่ได้
// → เก็บเป็นชั้นแยก: ชนิด + มุมซ้ายบน · ภาพวาดทั้งชิ้นทีเดียว · ช่องไหนขวางทางกำหนดด้วย mask
// เก็บใน HD_Options Category='OfficeMapProps' 1 แถว/ชิ้น (Title = "ชนิด,x,y") — ไม่ต้องสร้างคอลัมน์ใหม่

import type { Pos } from './officeMap'

export type PropGroup = 'สวน' | 'สันทนาการ' | 'ครัว/คาเฟ่' | 'สำนักงาน'

export interface PropDef {
  kind: string
  label: string
  group: PropGroup
  w: number
  h: number
  /** แต่ละแถว: X = ขวางทาง · . = เดินผ่าน/ใต้ได้ — ไม่ใส่ = ขวางทั้งชิ้น */
  mask?: string[]
  hint: string
}

export const PROPS: PropDef[] = [
  // ── สวน ──
  { kind: 'waterfall', label: 'น้ำตก + บ่อปลา', group: 'สวน', w: 8, h: 4, hint: 'น้ำตกไหลลงบ่อ มีปลาคาร์ฟว่าย เป็ดลอย' },
  { kind: 'bench',     label: 'ม้านั่งสวน',      group: 'สวน', w: 2, h: 1, hint: 'ม้านั่งไม้ขาเหล็ก' },
  { kind: 'fountain',  label: 'น้ำพุ',           group: 'สวน', w: 2, h: 2, hint: 'น้ำพุหินพุ่งเป็นสาย' },
  { kind: 'gazebo',    label: 'ศาลาพักผ่อน',     group: 'สวน', w: 3, h: 3, mask: ['X.X', '...', 'X.X'], hint: 'ศาลาหลังคาจั่ว เดินเข้าไปนั่งข้างในได้' },
  { kind: 'arch',      label: 'ซุ้มดอกไม้',       group: 'สวน', w: 3, h: 1, mask: ['X.X'], hint: 'ซุ้มโค้งมีดอกไม้เลื้อย เดินลอดได้' },
  { kind: 'swing',     label: 'ชิงช้า',          group: 'สวน', w: 2, h: 2, hint: 'ชิงช้าไม้แกว่งเบา ๆ' },
  { kind: 'gardenlamp', label: 'โคมไฟสวน',      group: 'สวน', w: 1, h: 1, hint: 'เสาไฟสวนสไตล์วินเทจ' },
  { kind: 'birdbath',  label: 'อ่างน้ำนก',       group: 'สวน', w: 1, h: 1, hint: 'อ่างหินมีนกกระจอกเล่นน้ำ' },
  { kind: 'picnic',    label: 'โต๊ะปิกนิก',       group: 'สวน', w: 3, h: 2, hint: 'โต๊ะไม้มีม้านั่งสองฝั่ง ร่มกันแดด' },
  { kind: 'duck',      label: 'เป็ดว่ายน้ำ',      group: 'สวน', w: 1, h: 1, mask: ['.'], hint: 'วางบนบ่อน้ำ — ว่ายไปมา' },
  { kind: 'stones',    label: 'กองหินประดับ',     group: 'สวน', w: 2, h: 1, hint: 'หินแม่น้ำกับมอสเขียว' },
  // ── สันทนาการ ──
  { kind: 'pingpong',  label: 'โต๊ะปิงปอง',       group: 'สันทนาการ', w: 3, h: 2, hint: 'โต๊ะเขียวมีตาข่าย' },
  { kind: 'pool',      label: 'โต๊ะพูล',          group: 'สันทนาการ', w: 3, h: 2, hint: 'โต๊ะสนุ้กเกอร์ผ้าเขียว' },
  { kind: 'foosball',  label: 'โต๊ะฟุตบอล',       group: 'สันทนาการ', w: 2, h: 1, hint: 'โต๊ะโกล์หมุน' },
  { kind: 'sofa',      label: 'โซฟายาว',          group: 'สันทนาการ', w: 3, h: 1, hint: 'โซฟาผ้าสามที่นั่ง' },
  { kind: 'hammock',   label: 'เปลญวน',          group: 'สันทนาการ', w: 3, h: 1, hint: 'เปลผ้าห้อยระหว่างเสา' },
  { kind: 'tvwall',    label: 'จอทีวีใหญ่',       group: 'สันทนาการ', w: 3, h: 1, hint: 'ทีวีจอใหญ่บนตู้วาง' },
  // ── ครัว/คาเฟ่ ──
  { kind: 'bar',       label: 'เคาน์เตอร์บาร์',    group: 'ครัว/คาเฟ่', w: 4, h: 1, hint: 'บาร์ไม้กับเก้าอี้สูง' },
  { kind: 'vending',   label: 'ตู้ขายขนม',        group: 'ครัว/คาเฟ่', w: 1, h: 1, hint: 'ตู้กดขนม/น้ำ ไฟสว่าง' },
  { kind: 'bigfridge', label: 'ตู้เย็นสองประตู',   group: 'ครัว/คาเฟ่', w: 1, h: 1, hint: 'ตู้เย็นสแตนเลส' },
  { kind: 'microwave', label: 'ไมโครเวฟ',         group: 'ครัว/คาเฟ่', w: 1, h: 1, hint: 'บนชั้นวาง' },
  { kind: 'fruits',    label: 'ตะกร้าผลไม้',      group: 'ครัว/คาเฟ่', w: 1, h: 1, hint: 'ผลไม้สดบนโต๊ะเล็ก' },
  // ── สำนักงาน ──
  { kind: 'printer',   label: 'เครื่องพิมพ์',      group: 'สำนักงาน', w: 1, h: 1, hint: 'เครื่องพิมพ์ใหญ่ มีกระดาษออกมา' },
  { kind: 'cabinet',   label: 'ตู้เอกสาร',        group: 'สำนักงาน', w: 1, h: 1, hint: 'ตู้เหล็ก 4 ลิ้นชัก' },
  { kind: 'cooler',    label: 'ตู้กดน้ำ',          group: 'สำนักงาน', w: 1, h: 1, hint: 'ถังน้ำมีฟองลอย' },
  { kind: 'notice',    label: 'บอร์ดประกาศ',      group: 'สำนักงาน', w: 2, h: 1, hint: 'บอร์ดไม้ก๊อก ปักกระดาษ' },
  { kind: 'logo',      label: 'ป้ายโลโก้บริษัท',   group: 'สำนักงาน', w: 3, h: 1, hint: 'ป้ายเรืองแสง iT Services' },
  { kind: 'clock',     label: 'นาฬิกาตั้งพื้น',    group: 'สำนักงาน', w: 1, h: 1, hint: 'เข็มเดินตามเวลาจริง' },
]
const DEF = new Map(PROPS.map(p => [p.kind, p]))
export const propDef = (kind: string): PropDef | undefined => DEF.get(kind)
export const PROP_GROUPS: PropGroup[] = ['สวน', 'สันทนาการ', 'ครัว/คาเฟ่', 'สำนักงาน']

export interface Prop extends Pos { kind: string }

/** ช่องทั้งหมดที่ชิ้นนี้กิน */
export function propTiles(p: Prop): Pos[] {
  const d = propDef(p.kind)
  if (!d) return []
  const out: Pos[] = []
  for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) out.push({ x: p.x + dx, y: p.y + dy })
  return out
}

/** ช่องที่ขวางทางของทุกชิ้น */
export function propBlocked(props: Prop[]): Set<string> {
  const s = new Set<string>()
  for (const p of props) {
    const d = propDef(p.kind)
    if (!d) continue
    for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) {
      if ((d.mask?.[dy]?.[dx] ?? 'X') === 'X') s.add(`${p.x + dx},${p.y + dy}`)
    }
  }
  return s
}

export type PropCheck = { ok: true } | { ok: false; reason: string }

/** วางชิ้นนี้ที่มุมซ้ายบน at ได้ไหม */
export function canPlaceProp(rows: string[], props: Prop[], kind: string, at: Pos): PropCheck {
  const d = propDef(kind)
  if (!d) return { ok: false, reason: 'ไม่รู้จักของชิ้นนี้' }
  const h = rows.length, w = rows[0]?.length ?? 0
  if (at.x < 1 || at.y < 1 || at.x + d.w > w - 1 || at.y + d.h > h - 1) return { ok: false, reason: `${d.label} (${d.w}×${d.h}) ล้นขอบผัง` }
  const tiles = propTiles({ kind, ...at })
  if (tiles.some(t => rows[t.y][t.x] === '#')) return { ok: false, reason: 'ทับกำแพง' }
  if (kind === 'duck' && rows[at.y][at.x] !== 'w') return { ok: false, reason: 'เป็ดต้องอยู่บนบ่อน้ำ' }
  const taken = new Set(props.flatMap(p => propTiles(p)).map(t => `${t.x},${t.y}`))
  if (tiles.some(t => taken.has(`${t.x},${t.y}`))) return { ok: false, reason: 'ทับของชิ้นอื่น' }
  return { ok: true }
}

/** ชิ้นที่อยู่ตรงช่องนี้ (ใช้ตอนลบ) */
export function propAt(props: Prop[], at: Pos): Prop | undefined {
  return props.find(p => propTiles(p).some(t => t.x === at.x && t.y === at.y))
}

// ── เก็บ/อ่าน: 1 บรรทัด = "ชนิด,x,y" ──
export const serializeProp = (p: Prop): string => `${p.kind},${p.x},${p.y}`

/** อ่านแบบไม่เชื่อ — ชนิดไม่รู้จัก/ตัวเลขเสีย/ทับกัน ทิ้ง ไม่ให้ทั้งผังพัง */
export function parseProps(lines: string[], rows?: string[]): Prop[] {
  const out: Prop[] = []
  for (const line of lines) {
    const [kind, xs, ys] = (line ?? '').split(',').map(s => s.trim())
    const x = Number(xs), y = Number(ys)
    if (!propDef(kind) || !Number.isInteger(x) || !Number.isInteger(y)) continue
    const p = { kind, x, y }
    if (rows && !canPlaceProp(rows, out, kind, p).ok) continue
    out.push(p)
  }
  return out
}

/** ของในสวนของผังมาตรฐาน */
export const DEFAULT_PROPS: Prop[] = [
  { kind: 'waterfall', x: 29, y: 1 },
  { kind: 'bench', x: 31, y: 7 },
  { kind: 'bench', x: 35, y: 7 },
  { kind: 'fountain', x: 35, y: 9 },
  { kind: 'gardenlamp', x: 28, y: 7 },
  { kind: 'gardenlamp', x: 38, y: 11 },
  { kind: 'birdbath', x: 37, y: 9 },
  { kind: 'duck', x: 30, y: 9 },
  { kind: 'stones', x: 31, y: 5 },
  { kind: 'vending', x: 23, y: 1 },
]
