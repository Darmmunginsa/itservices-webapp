// หุ่นยนต์ดูดฝุ่นในออฟฟิศ — วิ่งเองตามเส้นทางที่คำนวณได้ซ้ำทุกเครื่อง
//
// ไม่ต้องส่งข้อมูลผ่าน SharePoint: ทุกเครื่องสร้างเส้นทางเดียวกันจากผังเดียวกัน (สุ่มแบบมี seed)
// แล้วดูว่าตอนนี้ควรอยู่ช่องไหนจากนาฬิกา → ทุกคนเห็นหุ่นอยู่ที่เดียวกันพร้อมกัน

import { findPath, isWalkable, tileAt, type OfficeMap, type Pos } from './officeMap'

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
export function robotAt(route: Pos[], now: number): { pos: Pos; deg: number; left: boolean } | null {
  if (!route.length) return null
  const n = route.length
  const i = Math.floor(now / ROBOT_STEP_MS) % n
  const a = route[i], b = route[(i + 1) % n]
  const deg = b.x > a.x ? 0 : b.x < a.x ? 180 : b.y > a.y ? 90 : -90
  // หันซ้าย/ขวาตามก้าวแนวนอนล่าสุด — เดินขึ้นลงไม่กลับตัวไปมา
  let left = false
  for (let k = 0; k < Math.min(n, 60); k++) {
    const p = route[(i - k + n) % n], q = route[(i - k + 1 + n) % n]
    if (q.x !== p.x) { left = q.x < p.x; break }
  }
  return { pos: a, deg, left }
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

// ── Request Cleaning / Request Coffee: เรียกหุ่นมาช่วย ──
// คำขอส่งผ่าน HD_OfficeChat (Room = 'robot' — ไม่โผล่ในแท็บแชท) ทุกเครื่องอ่านคำขอชุดเดียวกัน
// แล้วคำนวณภารกิจแบบเดียวกัน → ทุกคนเห็นหุ่นทำงานพร้อมกัน แล้วกลับไปวิ่งเส้นทางปกติต่อจากจุดเดิม (ไม่วาร์ป)
//   กวาด: เดินไปหา → กวาดรอบตัว → เดินกลับ
//   กาแฟ: เดินไปเครื่องกาแฟ → กดชง → ถือแก้วมาส่ง → ยื่นให้ → เดินกลับ

export const ROBOT_ROOM = 'robot'
export const SWEEP_STEPS = 12
export const BREW_STEPS = 6
export const GIVE_STEPS = 4
const MAX_PATH = 90

export type RobotJob = 'clean' | 'coffee'
export type RobotPhase = 'go' | 'sweep' | 'fetch' | 'brew' | 'carry' | 'give' | 'back'
export interface CleanRequest { at: number; x: number; y: number; by: string; byEmail: string; kind: RobotJob }
export interface Mission {
  start: number; steps: Pos[]; by: string; byEmail: string; target: Pos; kind: RobotJob
  /** ช่วงของแต่ละขั้น (ก้าวที่ < end) */
  phases: { phase: RobotPhase; end: number }[]
  /** ช่วงที่ทำงานอยู่ตรงหน้าคนเรียก (กวาด / ยื่นกาแฟ) */
  sweepFrom: number; sweepTo: number
}

/** อ่านคำขอจากแถวแชท — "clean:x,y" หรือ "coffee:x,y" */
export function parseCleanRequests(rows: { Title: string; UserName: string; UserEmail?: string; Room?: string; Created: string }[]): CleanRequest[] {
  const out: CleanRequest[] = []
  for (const r of rows) {
    if ((r.Room ?? '') !== ROBOT_ROOM) continue
    const m = /^(clean|coffee):(\d+),(\d+)$/.exec((r.Title || '').trim())
    const at = new Date(r.Created).getTime()
    if (m && Number.isFinite(at)) out.push({ at, x: +m[2], y: +m[3], by: r.UserName || '', byEmail: (r.UserEmail || '').toLowerCase(), kind: m[1] as RobotJob })
  }
  return out.sort((a, b) => a.at - b.at)
}

/** จุดยืนกดเครื่องกาแฟ — ช่องเดินได้ข้างเครื่อง K (เครื่องแรกที่เจอ) */
export function coffeeSpot(m: OfficeMap): Pos | null {
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if (tileAt(m, x, y) !== 'K') continue
    for (const d of DIRS) if (isWalkable(m, x + d.x, y + d.y)) return { x: x + d.x, y: y + d.y }
  }
  return null
}

/** กวาดไปมารอบปลายทาง (ช่องที่เดินได้รอบตัว) แล้วจบที่ปลายทาง */
function sweepAround(m: OfficeMap, t: Pos): Pos[] {
  const nb = DIRS.map(d => ({ x: t.x + d.x, y: t.y + d.y })).filter(p => isWalkable(m, p.x, p.y))
  if (!nb.length) return Array.from({ length: SWEEP_STEPS }, () => t)
  const out: Pos[] = []
  for (let i = 0; out.length < SWEEP_STEPS; i++) { out.push(nb[i % nb.length]); out.push(t) }
  return out
}

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y
/** ทางจาก a → b (รวมช่องปลาย) · ไปไม่ได้ = null */
function leg(m: OfficeMap, a: Pos, b: Pos): Pos[] | null {
  if (same(a, b)) return []
  const p = findPath(m, a, b)
  return p.length && p.length <= MAX_PATH ? p : null
}
const stay = (p: Pos, k: number): Pos[] => Array.from({ length: k }, () => p)

/** ภารกิจทั้งหมดตามลำดับ — คิวต่อกัน (คำขอระหว่างหุ่นไม่ว่าง = ทำต่อจากงานก่อน) */
export function planMissions(m: OfficeMap, route: Pos[], reqs: CleanRequest[]): Mission[] {
  if (!route.length) return []
  const n = route.length
  const spot = coffeeSpot(m)
  const out: Mission[] = []
  let shift = 0, busyUntil = -Infinity
  for (const r of reqs) {
    const start = Math.max(Math.floor(r.at / ROBOT_STEP_MS) + 1, busyUntil)
    const from = route[(((start - shift) % n) + n) % n]
    const target = { x: r.x, y: r.y }
    const parts: { phase: RobotPhase; steps: Pos[] }[] = []
    if (r.kind === 'coffee') {
      if (!spot) continue
      const fetch = leg(m, from, spot), carry = leg(m, spot, target), back = leg(m, target, from)
      if (!fetch || !carry || !back) continue
      parts.push({ phase: 'fetch', steps: fetch }, { phase: 'brew', steps: stay(spot, BREW_STEPS) },
        { phase: 'carry', steps: carry }, { phase: 'give', steps: stay(target, GIVE_STEPS) }, { phase: 'back', steps: back.length ? back : [from] })
    } else {
      const go = leg(m, from, target)
      if (!go) continue
      const back = go.slice(0, -1).reverse().concat([from])
      parts.push({ phase: 'go', steps: go }, { phase: 'sweep', steps: sweepAround(m, target) }, { phase: 'back', steps: back })
    }
    const steps: Pos[] = []
    const phases: Mission['phases'] = []
    for (const pt of parts) { steps.push(...pt.steps); phases.push({ phase: pt.phase, end: steps.length }) }
    const work = r.kind === 'coffee' ? 'give' : 'sweep'
    const wi = phases.findIndex(p => p.phase === work)
    const sweepFrom = wi > 0 ? phases[wi - 1].end : 0, sweepTo = phases[wi].end
    out.push({ start, steps, by: r.by, byEmail: r.byEmail, target, kind: r.kind, phases, sweepFrom, sweepTo })
    shift += steps.length
    busyUntil = start + steps.length
  }
  return out
}

/** ตำแหน่ง ณ ก้าวที่ step (รวมภารกิจ) */
function posAtStep(route: Pos[], missions: Mission[], step: number): { pos: Pos; mission: Mission | null; k: number } {
  const n = route.length
  let shift = 0
  for (const ms of missions) {
    if (step < ms.start) break
    if (step < ms.start + ms.steps.length) return { pos: ms.steps[step - ms.start], mission: ms, k: step - ms.start }
    shift += ms.steps.length
  }
  return { pos: route[(((step - shift) % n) + n) % n], mission: null, k: 0 }
}

export interface RobotNow { pos: Pos; left: boolean; mission: Mission | null; phase: RobotPhase | null; sweeping: boolean; returning: boolean }
export function robotNow(route: Pos[], missions: Mission[], now: number): RobotNow | null {
  if (!route.length) return null
  const step = Math.floor(now / ROBOT_STEP_MS)
  const cur = posAtStep(route, missions, step)
  let left = false
  for (let k = 0; k < 40; k++) {
    const a = posAtStep(route, missions, step - k - 1).pos, b = posAtStep(route, missions, step - k).pos
    if (a.x !== b.x) { left = b.x < a.x; break }
  }
  const phase = cur.mission ? cur.mission.phases.find(p => cur.k < p.end)?.phase ?? 'back' : null
  return { pos: cur.pos, left, mission: cur.mission, phase, sweeping: phase === 'sweep', returning: phase === 'back' }
}

/** ป้ายเหนือหัวหุ่น — nameOf: แปลงคนเรียกเป็นชื่อที่โชว์ (ชื่อเล่น) ไม่ให้เห็นชื่อจริง */
export function robotLabel(r: RobotNow, nameOf?: (email: string, realName: string) => string): string | null {
  if (!r.mission) return null
  const who = nameOf ? nameOf(r.mission.byEmail, r.mission.by) : r.mission.by.split(/\s+/)[0]
  switch (r.phase) {
    case 'go': return `→ ไปกวาดให้ ${who}`
    case 'sweep': return `🧹 กวาดให้ ${who}`
    case 'fetch': return `☕ ไปชงกาแฟให้ ${who}`
    case 'brew': return '☕ กำลังกดชง… ฟู่ววว'
    case 'carry': return `☕ ถือกาแฟไปส่ง ${who}`
    case 'give': return `☕ กาแฟมาแล้วครับ ${who}!`
    default: return r.mission.kind === 'coffee' ? '😊 ส่งแล้ว กลับไปทำงานต่อ' : '✨ สะอาดแล้ว กลับไปทำงานต่อ'
  }
}
