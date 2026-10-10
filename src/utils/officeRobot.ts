// หุ่นยนต์ดูดฝุ่นในออฟฟิศ — วิ่งเองตามเส้นทางที่คำนวณได้ซ้ำทุกเครื่อง
//
// ไม่ต้องส่งข้อมูลผ่าน SharePoint: ทุกเครื่องสร้างเส้นทางเดียวกันจากผังเดียวกัน (สุ่มแบบมี seed)
// แล้วดูว่าตอนนี้ควรอยู่ช่องไหนจากนาฬิกา → ทุกคนเห็นหุ่นอยู่ที่เดียวกันพร้อมกัน

import { isWalkable, tileAt, type OfficeMap, type Pos } from './officeMap'

export const ROBOT_STEP_MS = 900
/** ช่องที่หุ่นไม่ลงไป (สวน: หญ้า/ทางเดินหิน — หุ่นดูดฝุ่นใช้ในอาคาร) */
const OUTDOOR = new Set(['g', 'p'])

const canClean = (m: OfficeMap, x: number, y: number) => isWalkable(m, x, y) && !OUTDOOR.has(tileAt(m, x, y))

/** แท่นชาร์จ — ช่องในอาคารแรกที่เจอ (มุมกาแฟก่อน) */
export function robotDock(m: OfficeMap): Pos | null {
  for (const want of ['C', '.']) {
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (tileAt(m, x, y) === want && canClean(m, x, y)) return { x, y }
    }
  }
  return null
}

const DIRS: Pos[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]

/** สุ่มแบบมี seed (mulberry32) — ทุกเครื่องได้ลำดับเดียวกัน */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * เส้นทางแบบหุ่นดูดฝุ่นจริง: วิ่งตรงไปจนชนแล้วเลี้ยว · บางทีเลี้ยวเอง
 * ไป-กลับ (ย้อนทางเดิม) ให้วนต่อได้ไม่สะดุด
 */
export function robotRoute(m: OfficeMap, steps = 1500, seed = 2026): Pos[] {
  const dock = robotDock(m)
  if (!dock) return []
  const r = rng(seed)
  const out: Pos[] = [dock]
  let p = dock, d = 0
  for (let i = 0; i < steps; i++) {
    const open = DIRS.map((v, k) => ({ v, k })).filter(({ v }) => canClean(m, p.x + v.x, p.y + v.y))
    if (!open.length) break
    const ahead = open.find(o => o.k === d)
    if (!ahead || r() < 0.12) {
      const noBack = open.filter(o => o.k !== (d + 2) % 4)
      const pool = noBack.length ? noBack : open
      d = pool[Math.floor(r() * pool.length)].k
    }
    p = { x: p.x + DIRS[d].x, y: p.y + DIRS[d].y }
    out.push(p)
  }
  return out.concat(out.slice(1, -1).reverse())
}

/** ตอนนี้หุ่นอยู่ช่องไหน + หันไปทางไหน (องศา, 0 = ขวา) */
export function robotAt(route: Pos[], now: number): { pos: Pos; deg: number } | null {
  if (!route.length) return null
  const i = Math.floor(now / ROBOT_STEP_MS) % route.length
  const a = route[i], b = route[(i + 1) % route.length]
  const deg = b.x > a.x ? 0 : b.x < a.x ? 180 : b.y > a.y ? 90 : -90
  return { pos: a, deg }
}

export const ROBOT_LINES = [
  '🤖 บี๊บ ๆ กำลังดูดฝุ่นอยู่นะครับ',
  '🤖 ขอทางหน่อยครับ พื้นตรงนี้ยังไม่สะอาด',
  '🤖 แบตเหลือเยอะ ทำงานได้ทั้งวัน',
  '🤖 เจอเศษขนมใต้โต๊ะอีกแล้ว…',
  '🤖 อย่าลืมพักสายตาด้วยนะครับ',
]

/** แผนของหุ่น (แท่นชาร์จ + เส้นทาง) จำไว้ต่อผัง — ผังเดิมไม่คำนวณซ้ำทุกเฟรม */
const planCache = new WeakMap<OfficeMap, { dock: Pos | null; route: Pos[] }>()
export function robotPlan(m: OfficeMap): { dock: Pos | null; route: Pos[] } {
  let p = planCache.get(m)
  if (!p) { p = { dock: robotDock(m), route: robotRoute(m) }; planCache.set(m, p) }
  return p
}
