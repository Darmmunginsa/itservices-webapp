// ตำแหน่งนกในสวน (ใช้ร่วมกันระหว่าง 2D และ 3D — สุ่มแบบคงที่ตามพิกัด ทุกเครื่องเห็นตรงกัน)
// ตัวเลขตรงกับ GardenLife.tsx: นก 5 ตัว อยู่ช่องหญ้าที่สุ่มได้ค่าน้อยสุด และไม่ติดกัน

export const gh = (x: number, y: number, k = 0) => {
  let v = (x * 73856093) ^ (y * 19349663) ^ (k * 83492791)
  v = Math.imul(v ^ (v >>> 13), 1274126177)
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296
}

export interface BirdHome { x: number; y: number; fx: number; fz: number; flip: boolean }

/** บ้านของนกแต่ละตัว — fx/fz คือตำแหน่งกลางตัวนกเป็นหน่วยช่อง (ทศนิยม) */
export function birdHomes(rows: string[], blocked: Set<string>, tile = 36): BirdHome[] {
  const grass: { x: number; y: number }[] = []
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'g' && !blocked.has(`${x},${y}`)) grass.push({ x, y }) })
  const birds: { x: number; y: number }[] = []
  for (const p of [...grass].sort((a, b) => gh(a.x, a.y, 7) - gh(b.x, b.y, 7))) {
    if (birds.length >= 5) break
    if (birds.every(b => Math.abs(b.x - p.x) + Math.abs(b.y - p.y) > 2)) birds.push(p)
  }
  return birds.map(b => ({
    x: b.x, y: b.y,
    fx: b.x + (6 + gh(b.x, b.y, 3) * 10 + 11.5) / tile,
    fz: b.y + (10 + gh(b.x, b.y, 4) * 10 + 9) / tile,
    flip: gh(b.x, b.y, 6) < 0.5,
  }))
}

/** จุดยืนรุมกินรอบคนให้อาหาร (หน่วยช่อง) · null = ไม่มีใครให้อาหารในระยะ 12 ช่อง */
export function birdFeedSpot(b: { x: number; y: number }, i: number, feeders: { x: number; y: number }[]): { fx: number; fz: number; cx: number } | null {
  let best: { x: number; y: number } | null = null
  let bd = 13
  for (const f of feeders) { const d = Math.abs(f.x - b.x) + Math.abs(f.y - b.y); if (d < bd) { bd = d; best = f } }
  if (!best) return null
  const a = (i / 5) * Math.PI * 2 + 0.6
  return { fx: best.x + 0.5 + Math.cos(a) * 0.62, fz: best.y + 0.85 + Math.sin(a) * 0.34, cx: best.x + 0.5 }
}
