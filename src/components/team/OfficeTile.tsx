import { FURNITURE_TILES as FURNITURE, PLANT_TILES } from '../../utils/officeMap'
import { PlantArt } from './PlantArt'
import { memo } from 'react'

// ── สไปรต์ของช่องบนแผนที่ออฟฟิศ — มุมมอง 3/4 แบบ Gather ──
//
// ทุกช่องวาดใน viewBox 36×36 แล้วย่อขยายตาม size (ออฟฟิศ 36px · ตัวแก้ผัง 24px · จานสี 20px)
// มิติมาจาก 3 อย่าง: กำแพงมี "หน้าผนัง" ตรงที่ติดพื้น · เฟอร์นิเจอร์มีเงาตกบนพื้น · พื้นแต่ละโซนมีลาย
// เฟอร์นิเจอร์วางบน "พื้นของโซนรอบตัว" (ดูจากช่องข้าง ๆ) โต๊ะในห้องประชุมจึงอยู่บนพรม ไม่ใช่พื้นไม้

export type At = (dx: number, dy: number) => string

const FLOOR_OF = new Set(['.', 'M', 'F', 'C', 'S', 'E', 'g', 'p'])
/** ช่องที่วาดล้นออกนอกขอบ (เก้าอี้/เงา) — ผู้ใช้ควรวางชั้นให้สูงกว่าพื้น */

/** พื้นใต้เฟอร์นิเจอร์ = พื้นที่พบบ่อยที่สุดใน 4 ทิศ */
function floorUnder(at: At): string {
  const count = new Map<string, number>()
  for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
    const c = at(dx, dy)
    if (FLOOR_OF.has(c)) count.set(c === 'E' ? 'S' : c, (count.get(c === 'E' ? 'S' : c) ?? 0) + 1)
  }
  let best = '.', n = 0
  for (const [c, k] of count) if (k > n) { best = c; n = k }
  return best
}

// ── พื้น ─────────────────────────────────────────────
/** สุ่มคงที่ตามตำแหน่ง — ทุกช่องหน้าตาไม่ซ้ำ แต่วาดใหม่กี่รอบก็เหมือนเดิม */
const h = (x: number, y: number, k = 0) => Math.abs(Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453) % 1

function Grass({ x, y }: { x: number; y: number }) {
  return (<g>
    <rect width="36" height="36" fill={h(x, y) > .5 ? '#6fbf5b' : '#74c463'} />
    {Array.from({ length: 9 }, (_, i) => {
      const bx = h(x, y, i) * 34 + 1, by = h(x, y, i + 20) * 32 + 3, tall = 2.5 + h(x, y, i + 40) * 3
      return <path key={i} d={`M${bx} ${by} l-1 ${-tall} M${bx + 1.6} ${by} l.6 ${-tall - .6}`} stroke={i % 3 ? '#4d9b3c' : '#9be08a'} strokeWidth=".8" strokeLinecap="round" />
    })}
    {h(x, y, 99) > .82 && <g><circle cx={h(x, y, 5) * 28 + 4} cy={h(x, y, 6) * 26 + 5} r="1.6" fill={h(x, y, 7) > .5 ? '#fde047' : '#fafafa'} /><circle cx={h(x, y, 5) * 28 + 4} cy={h(x, y, 6) * 26 + 5} r=".6" fill="#f59e0b" /></g>}
  </g>)
}

function Floor({ kind, x, y }: { kind: string; x: number; y: number }) {
  switch (kind) {
    case 'g': return <Grass x={x} y={y} />
    case 'p': // ทางเดินหินบนหญ้า
      return (<g><Grass x={x} y={y} />
        {[[9, 10, 7, 5], [25, 14, 6.5, 5], [13, 26, 7, 5.5], [28, 29, 5, 4]].map(([cx, cy, rx, ry], i) => (
          <g key={i}><ellipse cx={cx + 1} cy={cy + 1.2} rx={rx} ry={ry} fill="#000" opacity=".18" />
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={i % 2 ? '#d6d3d1' : '#e7e5e4'} transform={`rotate(${(h(x, y, i) - .5) * 40} ${cx} ${cy})`} />
            <ellipse cx={cx - rx * .3} cy={cy - ry * .3} rx={rx * .35} ry={ry * .3} fill="#fff" opacity=".45" /></g>
        ))}</g>)
    case 'M': // พรมห้องประชุม — น้ำเงินเทา ลายทอ
      return (<g>
        <rect width="36" height="36" fill="#cbd5e1" />
        <rect width="36" height="36" fill="url(#hd-weave)" opacity=".55" />
      </g>)
    case 'F': // พรมห้องโฟกัส — ชมพูอุ่น นุ่ม
      return (<g>
        <rect width="36" height="36" fill="#f6d5d8" />
        <rect width="36" height="36" fill="url(#hd-dots)" opacity=".5" />
      </g>)
    case 'C': { // กระเบื้องมุมกาแฟ — หมากรุกครึ่งช่อง
      const dark = (x + y) % 2 === 0
      return (<g>
        <rect width="36" height="36" fill={dark ? '#a5e4ea' : '#e8f8fa'} />
        <rect x="0" y="0" width="36" height="36" fill="none" stroke="#7fcbd3" strokeWidth=".6" />
        <rect x="1.5" y="1.5" width="33" height="2" fill="#fff" opacity=".35" />
      </g>)
    }
    case 'S': // ปูนขัดหน้าประตู
      return (<g>
        <rect width="36" height="36" fill="#ddd6fe" />
        <rect width="36" height="36" fill="url(#hd-speckle)" opacity=".6" />
      </g>)
    default: { // พื้นไม้โซนโต๊ะทำงาน — ไม้แผ่น สลับรอยต่อตามแถว
      const off = (y % 2) * 12
      return (<g>
        <rect width="36" height="36" fill="#f3dfb8" />
        <rect y="0" width="36" height="9" fill="#efd7aa" />
        <rect y="18" width="36" height="9" fill="#efd7aa" />
        {[9, 18, 27].map(yy => <line key={yy} x1="0" y1={yy} x2="36" y2={yy} stroke="#d8b982" strokeWidth=".7" />)}
        {[0, 9, 18, 27].map((yy, i) => {
          const sx = ((off + i * 7 + x * 5) % 24) + 6
          return <line key={i} x1={sx} y1={yy} x2={sx} y2={yy + 9} stroke="#d8b982" strokeWidth=".7" />
        })}
      </g>)
    }
  }
}

/** เงานุ่มใต้เฟอร์นิเจอร์ — ตกเฉียงลงขวานิดหน่อย ให้รู้สึกว่ามีแสงจากซ้ายบน */
const Shadow = ({ cx = 19, cy = 30, rx = 14, ry = 4.5, o = 0.22 }) =>
  <ellipse cx={cx} cy={cy} rx={rx + 1.6} ry={ry + 1.2} fill="url(#hd-shadow)" opacity={o} />

// ── กำแพง ────────────────────────────────────────────
function Wall({ at }: { at: At }) {
  const faceBelow = at(0, 1) !== '#'   // ข้างล่างเป็นพื้น → เห็นหน้าผนัง
  const edgeL = at(-1, 0) !== '#', edgeR = at(1, 0) !== '#', edgeT = at(0, -1) !== '#'
  return (<g>
    {/* หลังคากำแพง */}
    <rect width="36" height={faceBelow ? 16 : 36} fill="#475569" />
    {faceBelow && <rect width="36" height="16" fill="url(#hd-wallTop)" />}
    {edgeT && <rect width="36" height="2" fill="#64748b" />}
    {edgeL && <rect width="2" height={faceBelow ? 16 : 36} fill="#64748b" />}
    {edgeR && <rect x="34" width="2" height={faceBelow ? 16 : 36} fill="#334155" />}
    {faceBelow && (<g>
      {/* หน้าผนัง — ทาสีครีม มีบัวพื้นและเงาที่ฐาน */}
      <rect y="16" width="36" height="20" fill="#e7e1d6" />
      <rect y="16" width="36" height="20" fill="url(#hd-wallFace)" />
      <rect y="16" width="36" height="1.5" fill="#94a3b8" />
      <rect y="31" width="36" height="5" fill="#a8a29e" />
      <rect y="31" width="36" height="1" fill="#d6d3d1" />
    </g>)}
  </g>)
}

// ── เฟอร์นิเจอร์ ──────────────────────────────────────
function Desk({ at }: { at: At }) {
  const chairBelow = FLOOR_OF.has(at(0, 1))
  return (<g>
    <Shadow cy={27} rx={15} ry={4} />
    {/* ขาโต๊ะ */}
    <rect x="4" y="20" width="2.5" height="8" fill="#8b6a43" />
    <rect x="29.5" y="20" width="2.5" height="8" fill="#8b6a43" />
    {/* หน้าโต๊ะ + ขอบหนา */}
    <rect x="2" y="9" width="32" height="13" rx="1.5" fill="#c79a63" />
    <rect x="2" y="20" width="32" height="3" rx="1" fill="#9c7444" />
    <rect x="3" y="9.8" width="30" height="1.2" fill="#e2bd88" opacity=".8" />
    {/* จอ */}
    <rect x="16.5" y="13" width="3" height="4" fill="#475569" />
    <rect x="13" y="16.3" width="10" height="1.6" rx=".8" fill="#334155" />
    <rect x="9" y="2" width="18" height="12" rx="1.4" fill="#1e293b" />
    <rect x="10.3" y="3.3" width="15.4" height="9.4" rx=".6" fill="url(#hd-screen)" />
    <rect x="10.3" y="3.3" width="15.4" height="3" fill="#fff" opacity=".12" />
    {/* คีย์บอร์ด + เมาส์ + แก้ว */}
    <rect x="11" y="18.3" width="12" height="2.4" rx=".6" fill="#e5e7eb" />
    <rect x="25" y="18.6" width="2.6" height="2" rx="1" fill="#e5e7eb" />
    <rect x="5" y="13.5" width="3.4" height="4" rx=".8" fill="#f8fafc" />
    <rect x="5.4" y="14" width="2.6" height="1" fill="#7c3aed" opacity=".6" />
    {/* เก้าอี้ (ถ้าข้างล่างเป็นทางเดิน) */}
    {chairBelow && (<g>
      <ellipse cx="18" cy="35" rx="7" ry="2" fill="#000" opacity=".15" />
      <rect x="11.5" y="25" width="13" height="8" rx="3.5" fill="#334155" />
      <rect x="12.5" y="25.6" width="11" height="3" rx="1.5" fill="#475569" />
    </g>)}
  </g>)
}

/** เก้าอี้มองจากบน — พนักพิงหันออกจากโต๊ะ */
const Chair = ({ cx, cy, flip = false }: { cx: number; cy: number; flip?: boolean }) => (
  <g transform={`translate(${cx} ${cy})${flip ? ' rotate(180)' : ''}`}>
    <ellipse cx="0" cy="3.5" rx="5.5" ry="1.6" fill="#000" opacity=".15" />
    <rect x="-5" y="-3" width="10" height="7" rx="2.6" fill="#334155" />
    <rect x="-4.2" y="-5" width="8.4" height="3" rx="1.4" fill="#1e293b" />
    <rect x="-3.8" y="-1.8" width="7.6" height="2" rx="1" fill="#475569" />
  </g>
)

function MeetingTable({ at, x, y }: { at: At; x: number; y: number }) {
  // ต่อกันเป็นโต๊ะยาวผืนเดียว — โค้งมุมเฉพาะด้านที่ไม่มีโต๊ะต่อ
  const n = at(0, -1) === 'T', s = at(0, 1) === 'T', w = at(-1, 0) === 'T', e = at(1, 0) === 'T'
  const x0 = w ? 0 : 3, x1 = e ? 36 : 33, y0 = n ? 0 : 4, y1 = s ? 36 : 30
  // ของบนโต๊ะสุ่มคงที่ตามตำแหน่ง — ไม่ให้ทุกช่องมีกระดาษ/แก้ววางตรงเดียวกันเหมือนปั๊ม
  const h = Math.abs(x * 7 + y * 13) % 4
  const floorN = !n && at(0, -1) !== '#', floorS = !s && at(0, 1) !== '#'
  return (<g>
    {/* เก้าอี้รอบโต๊ะ — ล้นออกนอกช่องไปอยู่บนพื้น (ช่องเฟอร์นิเจอร์อยู่ชั้นบนพื้น จึงไม่ถูกทับ) */}
    {floorN && <Chair cx={18} cy={y0 - 3} />}
    {floorS && <Chair cx={18} cy={y1 + 4} flip />}
    {!s && <rect x={x0 + 2} y={y1 - 1} width={x1 - x0} height="5" fill="#000" opacity=".18" filter="url(#hd-blur)" />}
    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={(!n && !w) || (!n && !e) || (!s && !w) || (!s && !e) ? 3 : 0} fill="#a16207" />
    <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="url(#hd-woodGrain)" opacity=".55" />
    {!n && <rect x={x0 + 1} y={y0 + .8} width={x1 - x0 - 2} height="1.3" fill="#ca8a04" opacity=".7" />}
    {!s && <rect x={x0} y={y1 - 3} width={x1 - x0} height="3" fill="#713f12" />}
    {h === 0 && <rect x="9" y={y0 + 5} width="8" height="6" rx=".6" fill="#f8fafc" transform={`rotate(-9 13 ${y0 + 8})`} />}
    {h === 0 && <path d={`M11 ${y0 + 7} h4 M11 ${y0 + 9} h3`} stroke="#94a3b8" strokeWidth=".6" transform={`rotate(-9 13 ${y0 + 8})`} />}
    {h === 1 && <g><rect x="20" y={y0 + 6} width="10" height="6.5" rx=".8" fill="#334155" /><rect x="21" y={y0 + 6.8} width="8" height="4.6" rx=".4" fill="url(#hd-screen)" /></g>}
    {h === 2 && <circle cx="24" cy={(y0 + y1) / 2} r="2.6" fill="#fff" stroke="#e5e7eb" strokeWidth=".6" />}
    {h === 2 && <circle cx="24" cy={(y0 + y1) / 2} r="1.6" fill="#78350f" opacity=".75" />}
    {h === 3 && <g><rect x="12" y={(y0 + y1) / 2 - 1} width="9" height="1.4" rx=".7" fill="#2563eb" transform={`rotate(20 16 ${(y0 + y1) / 2})`} /><rect x="8" y={(y0 + y1) / 2 - 3} width="6" height="7" rx=".5" fill="#fde68a" /></g>}
  </g>)
}

function Coffee() {
  return (<g>
    {/* เคาน์เตอร์ */}
    <Shadow cy={31} rx={16} ry={3.5} />
    <rect x="1" y="16" width="34" height="14" rx="1.5" fill="#e7e5e4" />
    <rect x="1" y="27" width="34" height="4" rx="1" fill="#a8a29e" />
    <rect x="2" y="16.6" width="32" height="1.4" fill="#fff" opacity=".7" />
    {/* เครื่องชง */}
    <rect x="7" y="2" width="16" height="20" rx="2" fill="#27272a" />
    <rect x="8.2" y="3.2" width="13.6" height="5" rx="1" fill="#3f3f46" />
    <circle cx="11" cy="5.7" r="1.1" fill="#22c55e" />
    <circle cx="14.2" cy="5.7" r="1.1" fill="#f59e0b" />
    <rect x="12" y="10" width="6" height="2.5" rx=".6" fill="#52525b" />
    <rect x="10" y="17.5" width="10" height="1.4" fill="#52525b" />
    {/* แก้ว + ไอร้อนลอย */}
    <rect x="12.5" y="13.5" width="5" height="4.5" rx="1" fill="#fafaf9" />
    <path d="M17.5 14.6 q2 0 2 1.6 t-2 1.4" fill="none" stroke="#fafaf9" strokeWidth=".9" />
    <path d="M14 11 q-1.2 -2 0 -4 t0 -4" fill="none" stroke="#fff" strokeWidth=".9" strokeLinecap="round" opacity=".7">
      <animate attributeName="opacity" values=".1;.75;.1" dur="2.6s" repeatCount="indefinite" />
      <animateTransform attributeName="transform" type="translate" values="0 1;0 -1.5;0 1" dur="2.6s" repeatCount="indefinite" />
    </path>
    {/* แก้วกระดาษข้าง ๆ */}
    <path d="M26 19 h5 l-.7 7 h-3.6z" fill="#fef3c7" />
    <rect x="25.6" y="18" width="5.8" height="1.4" rx=".5" fill="#92400e" />
  </g>)
}

function Whiteboard() {
  return (<g>
    <Shadow cy={33} rx={13} ry={2.5} o={.18} />
    {/* ขาตั้ง */}
    <rect x="8" y="22" width="1.8" height="11" fill="#94a3b8" />
    <rect x="26.2" y="22" width="1.8" height="11" fill="#94a3b8" />
    {/* กระดาน */}
    <rect x="3" y="3" width="30" height="21" rx="1.2" fill="#cbd5e1" />
    <rect x="4.3" y="4.3" width="27.4" height="18.4" rx=".6" fill="#ffffff" />
    <rect x="4.3" y="4.3" width="27.4" height="5" fill="#f1f5f9" opacity=".7" />
    {/* ลายมือบนกระดาน */}
    <path d="M7 9 q4 -2 8 0 t8 0" fill="none" stroke="#2563eb" strokeWidth="1" strokeLinecap="round" />
    <path d="M7 13 h11" stroke="#dc2626" strokeWidth="1" strokeLinecap="round" />
    <rect x="21" y="11.5" width="8" height="6" rx="1" fill="none" stroke="#16a34a" strokeWidth=".9" />
    <path d="M7 17 h7 M7 19.5 h5" stroke="#64748b" strokeWidth=".8" strokeLinecap="round" />
    <rect x="9" y="23" width="18" height="1.6" rx=".6" fill="#94a3b8" />
    <rect x="12" y="22.6" width="3" height="1.2" rx=".5" fill="#2563eb" />
    <rect x="16" y="22.6" width="3" height="1.2" rx=".5" fill="#dc2626" />
  </g>)
}

function Door() {
  return (<g>
    {/* พรมเช็ดเท้า */}
    <rect x="5" y="27" width="26" height="7" rx="1.5" fill="#57534e" />
    <rect x="6.5" y="28.3" width="23" height="4.4" rx="1" fill="none" stroke="#78716c" strokeWidth=".7" strokeDasharray="1.5 1" />
    {/* วงกบ + บานประตู */}
    <rect x="6" y="1" width="24" height="26" rx="1" fill="#78350f" />
    <rect x="8" y="3" width="20" height="24" fill="#b45309" />
    <rect x="8" y="3" width="20" height="24" fill="url(#hd-woodGrain)" opacity=".5" />
    <rect x="10.5" y="5.5" width="15" height="8" rx=".6" fill="none" stroke="#92400e" strokeWidth=".9" />
    <rect x="10.5" y="15.5" width="15" height="9" rx=".6" fill="none" stroke="#92400e" strokeWidth=".9" />
    <circle cx="24.5" cy="16" r="1.3" fill="#fde68a" />
    {/* ป้ายทางออก เรืองแสง */}
    <rect x="12" y="-1" width="12" height="3.6" rx=".6" fill="#16a34a" />
    <rect x="12" y="-1" width="12" height="3.6" rx=".6" fill="#4ade80" opacity=".5">
      <animate attributeName="opacity" values=".2;.65;.2" dur="3s" repeatCount="indefinite" />
    </rect>
  </g>)
}

// ── สวน: บ่อน้ำ · แปลงดอกไม้ · รั้วพุ่มไม้ ──
/** บ่อน้ำ — ขอบหินเฉพาะด้านที่ติดฝั่ง (ช่องข้าง ๆ ไม่ใช่น้ำ) บ่อหลายช่องจึงต่อเป็นผืนเดียว */
function Water({ at, x, y }: { at: At; x: number; y: number }) {
  const n = at(0, -1) !== 'w', s2 = at(0, 1) !== 'w', w = at(-1, 0) !== 'w', e = at(1, 0) !== 'w'
  const fish = h(x, y, 3) > .55
  return (<g>
    <rect width="36" height="36" fill="#38bdf8" /><rect width="36" height="36" fill="url(#hd-pond)" />
    <path d={`M4 ${10 + h(x, y) * 8} q6 -3 12 0 t12 0`} stroke="#e0f2fe" strokeWidth="1" fill="none" opacity=".7">
      <animateTransform attributeName="transform" type="translate" values="0 0;3 1;0 0" dur={`${3 + h(x, y, 1) * 2}s`} repeatCount="indefinite" /></path>
    {fish && <g><ellipse rx="4.5" ry="1.8" fill={h(x, y, 4) > .5 ? '#f97316' : '#fafafa'} /><path d="M-4.5 0 l-2.6 -2 v4z" fill="#fb923c" />
      <animateMotion path={`M8 ${12 + h(x, y, 8) * 12} q10 -6 20 0 q-10 6 -20 0`} dur={`${6 + h(x, y, 9) * 4}s`} repeatCount="indefinite" rotate="auto" /></g>}
    {h(x, y, 11) > .7 && <g><circle cx={8 + h(x, y, 12) * 18} cy={8 + h(x, y, 13) * 18} r="5" fill="#16a34a" /><path d={`M${8 + h(x, y, 12) * 18} ${8 + h(x, y, 13) * 18} l5 -1.5 v3z`} fill="#38bdf8" /></g>}
    {n && <rect width="36" height="5" fill="#a8a29e" />}{n && <rect y="4" width="36" height="1.5" fill="#0369a1" opacity=".35" />}
    {s2 && <rect y="31" width="36" height="5" fill="#a8a29e" />}
    {w && <rect width="5" height="36" fill="#a8a29e" />}{e && <rect x="31" width="5" height="36" fill="#a8a29e" />}
    {(n || w) && <rect width="5" height="5" fill="#78716c" />}{(n || e) && <rect x="31" width="5" height="5" fill="#78716c" />}
  </g>)
}

function FlowerBed({ x, y }: { x: number; y: number }) {
  const colors = ['#f472b6', '#facc15', '#a78bfa', '#fb7185', '#f97316', '#fafafa']
  return (<g>
    <rect x="1" y="3" width="34" height="31" rx="4" fill="#78350f" /><rect x="2" y="4" width="32" height="28" rx="3" fill="#92400e" />
    {Array.from({ length: 10 }, (_, i) => {
      const cx = 5 + (i % 4) * 8.5 + h(x, y, i) * 3, cy = 8 + Math.floor(i / 4) * 9 + h(x, y, i + 9) * 3
      const c = colors[Math.floor(h(x, y, i + 30) * colors.length)]
      return (<g key={i}><path d={`M${cx} ${cy + 4} v-4`} stroke="#15803d" strokeWidth="1.2" /><ellipse cx={cx - 2} cy={cy + 2} rx="2" ry="1" fill="#16a34a" />
        {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx={cx} cy={cy - 1.4} rx="1.3" ry="2" fill={c} transform={`rotate(${a} ${cx} ${cy})`} />)}
        <circle cx={cx} cy={cy} r=".9" fill="#fde047" /></g>)
    })}
  </g>)
}

/** รั้วพุ่มไม้ตัดแต่ง — มีความสูง (ล้นขึ้นช่องบน) ต่อกับช่องข้างเคียงเป็นแนวเดียว */
function Hedge({ at }: { at: At }) {
  const w = at(-1, 0) === 'h', e = at(1, 0) === 'h'
  const x0 = w ? 0 : 3, x1 = e ? 36 : 33
  return (<g>
    <ellipse cx="18" cy="34" rx="19.6" ry="4.2" fill="url(#hd-shadow)" opacity=".2" />
    <rect x={x0} y="6" width={x1 - x0} height="28" rx={w && e ? 0 : 7} fill="#166534" />
    <rect x={x0} y="-6" width={x1 - x0} height="20" rx={w && e ? 0 : 8} fill="#15803d" />
    {[6, 16, 26].map(cx => <circle key={cx} cx={cx} cy={-1 + (cx % 3)} r="5" fill="#16a34a" />)}
    {[8, 20, 30].map(cx => <circle key={cx} cx={cx} cy={-3} r="2" fill="#4ade80" opacity=".6" />)}
  </g>)
}

// ── defs (ลาย/เกรเดียนต์) — วางครั้งเดียวต่อแผนที่ ──
export function OfficeDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {/* เงานุ่มแบบไล่สีไว้ล่วงหน้า — แทน blur ที่ต้องคำนวณใหม่ทุกเฟรมในภาพที่ขยับ */}
        <radialGradient id="hd-shadow"><stop offset="0" stopColor="#000" /><stop offset=".55" stopColor="#000" stopOpacity=".85" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <filter id="hd-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4" /></filter>
        <pattern id="hd-weave" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#94a3b8" /><rect x="2" y="2" width="2" height="2" fill="#94a3b8" />
        </pattern>
        <pattern id="hd-dots" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r=".9" fill="#e11d48" opacity=".35" />
        </pattern>
        <pattern id="hd-speckle" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r=".6" fill="#7c3aed" opacity=".35" /><circle cx="7" cy="6" r=".5" fill="#6d28d9" opacity=".3" />
          <circle cx="5" cy="1" r=".4" fill="#fff" opacity=".6" />
        </pattern>
        <pattern id="hd-woodGrain" width="36" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 2 q9 -1.5 18 0 t18 0" fill="none" stroke="#78350f" strokeWidth=".5" opacity=".5" />
          <path d="M0 5 q9 1 18 0 t18 0" fill="none" stroke="#fde68a" strokeWidth=".4" opacity=".4" />
        </pattern>
        <linearGradient id="hd-wallTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".08" /><stop offset="1" stopColor="#000" stopOpacity=".12" />
        </linearGradient>
        <linearGradient id="hd-wallFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".1" /><stop offset=".25" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".06" />
        </linearGradient>
        <linearGradient id="hd-rgb" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="36" y2="0" spreadMethod="reflect">
          <stop offset="0" stopColor="#ef4444" /><stop offset=".2" stopColor="#f59e0b" /><stop offset=".4" stopColor="#22c55e" />
          <stop offset=".6" stopColor="#06b6d4" /><stop offset=".8" stopColor="#6366f1" /><stop offset="1" stopColor="#d946ef" />
          <animateTransform attributeName="gradientTransform" type="translate" values="0 0;36 0" dur="3s" repeatCount="indefinite" />
        </linearGradient>
        <radialGradient id="hd-pond" cx=".5" cy=".4" r=".8">
          <stop offset="0" stopColor="#7dd3fc" stopOpacity=".55" /><stop offset=".7" stopColor="#0284c7" stopOpacity=".15" /><stop offset="1" stopColor="#075985" stopOpacity=".45" />
        </radialGradient>
        <linearGradient id="hd-falls" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="16" spreadMethod="repeat">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset=".5" stopColor="#7dd3fc" stopOpacity=".5" /><stop offset="1" stopColor="#fff" stopOpacity=".9" />
          <animateTransform attributeName="gradientTransform" type="translate" values="0 0;0 16" dur=".8s" repeatCount="indefinite" />
        </linearGradient>
        <linearGradient id="hd-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#38bdf8" /><stop offset=".6" stopColor="#2563eb" /><stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
    </svg>
  )
}

interface Props {
  /** แถวของแผนที่ทั้งผืน — อ้างอิงคงที่ (useMemo) memo จึงข้ามช่องที่ไม่เปลี่ยนได้ */
  rows: string[]
  x: number
  y: number
  size: number
}

/** ช่องเดียวบนแผนที่ — ดูช่องข้าง ๆ เพื่อรู้ว่าต้องวางหน้าผนัง / ต่อโต๊ะ / พื้นแบบไหน */
export const OfficeTile = memo(function OfficeTile({ rows, x, y, size }: Props) {
  const at = makeAt(rows, x, y)
  const ch = at(0, 0)
  const furniture = FURNITURE.includes(ch)
  const floor = ch === '#' || ch === 'w' ? null : furniture ? floorUnder(at) : ch === 'E' ? 'S' : ch === 'f' ? 'g' : ch
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      {floor && <Floor kind={floor} x={x} y={y} />}
      {ch === '#' && <Wall at={at} />}
      {ch === 'd' && <Desk at={at} />}
      {ch === 'T' && <MeetingTable at={at} x={x} y={y} />}
      {PLANT_TILES.includes(ch) && <PlantArt ch={ch} />}
      {ch === 'K' && <Coffee />}
      {ch === 'W' && <Whiteboard />}
      {ch === 'E' && <Door />}
      {ch === 'w' && <Water at={at} x={x} y={y} />}
      {ch === 'f' && <FlowerBed x={x} y={y} />}
      {ch === 'h' && <Hedge at={at} />}
    </svg>
  )
})

/** ตัวช่วยสร้าง at() จากแถวของแผนที่ — นอกขอบ = กำแพง */
function makeAt(rows: string[], x: number, y: number): At {
  return (dx, dy) => rows[y + dy]?.[x + dx] ?? '#'
}
