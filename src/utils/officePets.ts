import { petsOf, petHomes, type MyDecor, type PetKind } from './officeDecor'
import type { SeatFace } from './officeProps'

// ── ตำแหน่งสัตว์เลี้ยงในออฟฟิศ (ใช้ทั้ง 2D และ 3D) ──
// ตาม (follow) + เจ้าของออนไลน์ → อยู่ข้างหลังเจ้าของเยื้องกันคนละข้าง · เจ้าของนั่ง → หมอบข้างเก้าอี้
// ไม่ตาม หรือเจ้าของไม่อยู่ → นอนขดที่ข้างโต๊ะ · ไม่มีโต๊ะและไม่ได้ตาม → ไม่แสดง

export type PetMode = 'walk' | 'idle' | 'sit' | 'sleep'
export interface PetPlace { id: string; owner: string; kind: PetKind; x: number; y: number; mode: PetMode; face: SeatFace; /** วิ่งเล่นอิสระในสวน */ roam?: boolean }

export interface OwnerState { x: number; y: number; face: SeatFace; moving: boolean; sitting: boolean }

const BACK: Record<SeatFace, [number, number]> = { down: [0, -1], up: [0, 1], left: [1, 0], right: [-1, 0] }
const SIDE: Record<SeatFace, [number, number]> = { down: [1, 0], up: [1, 0], left: [0, 1], right: [0, 1] }
const ORDER: PetKind[] = ['dog', 'cat', 'rabbit']

export function placePets(
  all: { email: string; decor: MyDecor }[],
  owners: Map<string, OwnerState>,
  walkable: (x: number, y: number) => boolean,
  /** ช่องสวน (หญ้า/ทางเดินในสวน) — เจ้าของอยู่ในสวน = ปล่อยสัตว์วิ่งเล่นอิสระ */
  garden: (x: number, y: number) => boolean = () => false,
  now = Date.now(),
): PetPlace[] {
  const out: PetPlace[] = []
  for (const { email, decor } of all) {
    const pets = petsOf(decor).slice().sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
    if (!pets.length) continue
    const o = owners.get(email.toLowerCase())
    const homes = decor.desk ? petHomes(decor.desk) : []
    pets.forEach((p, i) => {
      const id = `${email}:${p.kind}`
      if (p.follow && o) {
        const [sx, sy] = SIDE[o.face]
        if (o.sitting) {
          // เจ้าของนั่งม้านั่ง/เก้าอี้ → สัตว์นั่งบนพื้นหน้าที่นั่ง เยื้องข้าง (ไม่มุดใต้ม้านั่ง)
          const [fx, fy] = BACK[o.face].map(v => -v) as [number, number]
          const lane = i === 0 ? -0.45 : i === 1 ? 0.45 : 0
          const cand: [number, number][] = [
            [o.x + fx * 0.85 + sx * lane, o.y + fy * 0.85 + sy * lane],
            [o.x + sx * (lane >= 0 ? 1 : -1), o.y + sy * (lane >= 0 ? 1 : -1)],
            [o.x - sx * (lane >= 0 ? 1 : -1), o.y - sy * (lane >= 0 ? 1 : -1)],
          ]
          const [x, y] = cand.find(([cx, cy]) => walkable(Math.round(cx), Math.round(cy))) ?? cand[0]
          out.push({ id, owner: email, kind: p.kind, x, y, mode: 'sit', face: o.face })
          return
        }
        if (garden(Math.round(o.x), Math.round(o.y))) {
          // ── วิ่งเล่นอิสระในสวน: สุ่มจุดใหม่ทุกไม่กี่วิ รอบตัวเจ้าของ (ไม่เกิน 4 ช่อง) ──
          // สุ่มจาก id + ช่วงเวลา → ทุกเครื่องเห็นตำแหน่งเดียวกัน
          const period = 3800 + i * 1300
          const k = Math.floor(now / period), phase = (now % period) / period
          let h = 2166136261; for (const ch of `${id}:${k}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
          const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h ^= h >>> 13; return ((h >>> 0) % 10000) / 10000 }
          let x = o.x + (i ? 1 : -1), y = o.y
          for (let n = 0; n < 12; n++) {
            const cx = Math.round(o.x + (rnd() - 0.5) * 8), cy = Math.round(o.y + (rnd() - 0.5) * 8)
            if (walkable(cx, cy) && garden(cx, cy)) { x = cx + (rnd() - 0.5) * 0.5; y = cy + (rnd() - 0.5) * 0.5; break }
          }
          // ช่วงแรกของรอบ = วิ่งไป · ที่เหลือ = ยืนดม/นั่งเล่น
          const mode: PetMode = phase < 0.35 ? 'walk' : rnd() < 0.5 ? 'sit' : 'idle'
          const face: SeatFace = x < o.x ? 'left' : 'right'
          out.push({ id, owner: email, kind: p.kind, x, y, mode, face, roam: true })
          return
        }
        const [bx, by] = BACK[o.face]
        const lane = i === 0 ? -0.55 : i === 1 ? 0.55 : 0
        const back = i === 2 ? 1.3 : 0.75
        let x = o.x + bx * back + sx * lane, y = o.y + by * back + sy * lane
        if (!walkable(Math.round(x), Math.round(y))) { x = o.x + sx * lane * 0.6; y = o.y + sy * lane * 0.6 }
        out.push({ id, owner: email, kind: p.kind, x, y, mode: o.sitting ? 'sit' : o.moving ? 'walk' : 'idle', face: o.face })
        return
      }
      const h = homes[i]
      if (h) out.push({ id, owner: email, kind: p.kind, x: h.x, y: h.y, mode: 'sleep', face: 'down' })
    })
  }
  return out
}
