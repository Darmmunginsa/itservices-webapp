import { memo } from 'react'

// ── ชีวิตเล็ก ๆ ในสวน: ใบไม้ร่วงบนหญ้า + นกกระจอกเดินจิกพื้น ──
// ตำแหน่งคำนวณจากผัง (สุ่มแบบคงที่ตามพิกัด) → ทุกเครื่องเห็นตรงกัน ไม่ต้องส่งข้อมูล
// มีคนเดินเข้ามาใกล้ 1 ช่อง = นกบินหนี · คนเดินไปแล้วค่อยกลับมาจิกต่อ
// แอนิเมชันเป็น CSS ล้วน (หยุดเองตอนไม่มีใครดู — ดู useMotionPause)

const h = (x: number, y: number, k = 0) => {
  let v = (x * 73856093) ^ (y * 19349663) ^ (k * 83492791)
  v = Math.imul(v ^ (v >>> 13), 1274126177)
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296
}

const LEAF_COLORS = ['#ca8a04', '#d97706', '#b45309', '#65a30d', '#a3a3a3', '#dc2626']

function Leaf({ x, y, r, c }: { x: number; y: number; r: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M0 -3.2 Q2.4 0 0 3.2 Q-2.4 0 0 -3.2Z" fill={c} opacity=".85" />
      <path d="M0 -3 V3" stroke="#000" strokeOpacity=".2" strokeWidth=".4" />
    </g>
  )
}

/** นกกระจอกมองข้าง — หัวก้มจิกพื้นเป็นจังหวะ */
function Sparrow({ flip, delay }: { flip: boolean; delay: number }) {
  return (
    <svg viewBox="0 0 20 16" width="23" height="18" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <ellipse cx="10" cy="14.6" rx="5.5" ry="1.1" fill="#000" opacity=".18" />
      <path d="M8 13 v1.6 M11 13 v1.6" stroke="#92400e" strokeWidth=".7" />
      <path d="M3 8.5 L0.5 6.5 L1.2 9.6Z" fill="#78350f" />
      <ellipse cx="8.5" cy="10" rx="6" ry="3.6" fill="#a16207" />
      <ellipse cx="9.5" cy="11.2" rx="4" ry="2" fill="#fef3c7" />
      <path d="M5 8.5 q3 -1.8 6 0" stroke="#78350f" strokeWidth="1" fill="none" />
      <g className="hd-bird-peck" style={{ transformOrigin: '13px 9px', animationDelay: `${delay}s` }}>
        <circle cx="14.6" cy="7" r="2.8" fill="#92400e" />
        <circle cx="14.2" cy="8.2" r="1.6" fill="#fef3c7" />
        <circle cx="15.6" cy="6.4" r=".55" fill="#111827" />
        <path d="M17.2 6.8 l2.2 .6 l-2.2 .7z" fill="#f59e0b" />
      </g>
    </svg>
  )
}

interface Props {
  rows: string[]
  /** ช่องที่มีของวางทับ (น้ำตก ม้านั่ง ...) — ไม่วางใบไม้/นกตรงนั้น */
  blocked: Set<string>
  /** ตำแหน่งคนทุกคนตอนนี้ — เข้าใกล้แล้วนกบินหนี */
  people: { x: number; y: number }[]
  /** คนที่กำลังหว่านอาหารนก — นกบินมารุมจิกรอบตัว ไม่หนี · เดินไปแล้วนกแยกย้ายกลับที่เดิม */
  feeders?: { x: number; y: number }[]
  tile: number
}

function GardenLifeBase({ rows, blocked, people, feeders = [], tile }: Props) {
  const grass: { x: number; y: number }[] = []
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === 'g' && !blocked.has(`${x},${y}`)) grass.push({ x, y }) })
  if (!grass.length) return null

  // ใบไม้: ราว 1 ใน 3 ของช่องหญ้า ช่องละ 1–3 ใบ
  const leaves = grass.filter(p => h(p.x, p.y) < 0.34)
  // นก: 5 ตัว อยู่ช่องหญ้าที่สุ่มได้ค่าน้อยสุด และไม่ติดกัน
  const birds: { x: number; y: number }[] = []
  for (const p of [...grass].sort((a, b) => h(a.x, a.y, 7) - h(b.x, b.y, 7))) {
    if (birds.length >= 5) break
    if (birds.every(b => Math.abs(b.x - p.x) + Math.abs(b.y - p.y) > 2)) birds.push(p)
  }
  const near = (b: { x: number; y: number }) => people.some(p => Math.abs(p.x - b.x) <= 1 && Math.abs(p.y - b.y) <= 1)
  // ให้อาหาร: นกแต่ละตัวบินไปหาคนให้อาหารที่ใกล้สุด (ในระยะ 12 ช่อง) ยืนล้อมเป็นวง
  const feedSpot = (b: { x: number; y: number }, i: number) => {
    let best: { x: number; y: number } | null = null, bd = 13
    for (const f of feeders) { const d = Math.abs(f.x - b.x) + Math.abs(f.y - b.y); if (d < bd) { bd = d; best = f } }
    if (!best) return null
    const a = (i / 5) * Math.PI * 2 + 0.6
    const cx = best.x * tile + tile / 2 - 11
    return { left: cx + Math.cos(a) * 22, top: best.y * tile + tile - 14 + Math.sin(a) * 12, cx }
  }

  return (
    <>
      {leaves.map(p => {
        const n = 1 + Math.floor(h(p.x, p.y, 1) * 3)
        return (
          <svg key={`lf${p.x},${p.y}`} className="absolute pointer-events-none" aria-hidden="true"
            style={{ left: p.x * tile, top: p.y * tile, width: tile, height: tile, zIndex: 0 }} viewBox="0 0 36 36">
            {Array.from({ length: n }, (_, i) => (
              <Leaf key={i} x={5 + h(p.x, p.y, 10 + i) * 26} y={5 + h(p.x, p.y, 20 + i) * 26} r={h(p.x, p.y, 30 + i) * 360}
                c={LEAF_COLORS[Math.floor(h(p.x, p.y, 40 + i) * LEAF_COLORS.length)]} />
            ))}
          </svg>
        )
      })}
      {/* เมล็ดข้าวที่หว่าน */}
      {feeders.map(f => (
        <svg key={`seed${f.x},${f.y}`} className="absolute pointer-events-none" aria-hidden="true" viewBox="0 0 72 48"
          style={{ left: f.x * tile - tile / 2, top: f.y * tile + tile / 2 - 6, width: tile * 2, height: tile * 1.33, zIndex: 0 }}>
          {Array.from({ length: 26 }, (_, i) => (
            <ellipse key={i} cx={8 + h(f.x, f.y, 50 + i) * 56} cy={8 + h(f.x, f.y, 80 + i) * 32} rx="1.3" ry=".8"
              transform={`rotate(${h(f.x, f.y, 110 + i) * 180} ${8 + h(f.x, f.y, 50 + i) * 56} ${8 + h(f.x, f.y, 80 + i) * 32})`}
              fill={i % 3 ? '#fde68a' : '#d6a35a'} />
          ))}
        </svg>
      ))}
      {birds.map((b, i) => {
        const spot = feedSpot(b, i)
        const away = !spot && near(b)
        const home = { left: b.x * tile + 6 + h(b.x, b.y, 3) * 10, top: b.y * tile + 10 + h(b.x, b.y, 4) * 10 }
        const at = spot ?? home
        // ไปรุมกิน: หันหน้าเข้าหาคนให้อาหาร · บินไป-กลับลื่น ๆ ด้วย transition
        const flip = spot ? spot.left > spot.cx : h(b.x, b.y, 6) < 0.5   // นกหันขวาเป็นค่าเริ่มต้น — อยู่ขวาของคน = กลับหันซ้าย
        return (
          <div key={`bd${i}`} className={`absolute pointer-events-none ${away ? 'hd-bird-away' : spot ? '' : 'hd-bird-hop'}`} aria-hidden="true"
            style={{ left: at.left, top: at.top, zIndex: spot ? 9 : 0, transition: 'left 1.6s ease-in-out, top 1.6s ease-in-out', animationDelay: away || spot ? undefined : `${-h(b.x, b.y, 5) * 9}s` }}>
            <Sparrow flip={flip} delay={spot ? i * 0.25 : h(b.x, b.y, 8) * 1.4} />
          </div>
        )
      })}
    </>
  )
}

export const GardenLife = memo(GardenLifeBase)
