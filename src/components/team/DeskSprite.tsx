import { memo, type ReactElement } from 'react'
import type { Rot } from '../../utils/officeDecor'

// ── โต๊ะส่วนตัว 9 แบบ — viewBox 36×36 มุมมองเดียวกับออฟฟิศ · เก้าอี้อยู่ด้านล่าง (ทิศคนนั่ง) ──
// หมุนทั้งชุด (โต๊ะ + เก้าอี้) ตาม rot · ใช้ filter/gradient จาก <OfficeDefs />

const sh = (cx: number, cy: number, rx: number, ry: number, o = 0.22) =>
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" opacity={o} filter="url(#hd-blur)" />

/** เก้าอี้สำนักงานมองจากบน — พนักพิงอยู่ด้านล่าง (หันเข้าโต๊ะ) */
const chair = (fill = '#334155', back = '#1e293b', y = 28) => (
  <g>{sh(18, y + 6, 6.5, 1.8, .18)}<rect x="11.5" y={y - 3} width="13" height="8" rx="3.5" fill={fill} /><rect x="12" y={y + 3} width="12" height="3.4" rx="1.6" fill={back} /></g>
)
const screen = (x: number, y: number, w: number, h: number) => (
  <g><rect x={x} y={y} width={w} height={h} rx="1.2" fill="#1e293b" /><rect x={x + 1.1} y={y + 1.1} width={w - 2.2} height={h - 2.2} rx=".5" fill="url(#hd-screen)" />
    <rect x={x + 1.1} y={y + 1.1} width={w - 2.2} height={(h - 2.2) / 3} fill="#fff" opacity=".12" /></g>
)

const ART: Record<string, ReactElement> = {
  classic: <g>{sh(19, 24, 16, 4)}
    <rect x="4" y="18" width="2.5" height="7" fill="#8b6a43" /><rect x="29.5" y="18" width="2.5" height="7" fill="#8b6a43" />
    <rect x="2" y="7" width="32" height="13" rx="1.5" fill="#c79a63" /><rect x="2" y="18" width="32" height="3" rx="1" fill="#9c7444" />
    <rect x="3" y="7.8" width="30" height="1.2" fill="#e2bd88" opacity=".8" />
    <rect x="16.5" y="11" width="3" height="4" fill="#475569" />{screen(10, 1, 16, 11)}<rect x="12" y="15.5" width="12" height="2.4" rx=".6" fill="#e5e7eb" />
    {chair()}</g>,
  white: <g>{sh(19, 23, 16, 3.5)}
    <path d="M5 19 l-1 6 M31 19 l1 6" stroke="#94a3b8" strokeWidth="1.4" />
    <rect x="2" y="8" width="32" height="11" rx="1" fill="#f8fafc" stroke="#e2e8f0" /><rect x="2" y="17.5" width="32" height="2" fill="#e2e8f0" />
    <path d="M15 13 h6 l1 3 h-8z" fill="#cbd5e1" /><rect x="9" y="0" width="18" height="13" rx="1.4" fill="#e2e8f0" /><rect x="10" y="1" width="16" height="10" rx=".6" fill="url(#hd-screen)" />
    <rect x="13" y="15.2" width="10" height="2" rx=".8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth=".4" /><circle cx="26" cy="16" r="1.2" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth=".4" />
    <rect x="4" y="10" width="4" height="5" rx="1" fill="#bbf7d0" />{chair('#e5e7eb', '#cbd5e1')}</g>,
  standing: <g>{sh(19, 26, 14, 3.5)}
    <rect x="6" y="24" width="24" height="9" rx="2" fill="#475569" opacity=".85" /><rect x="7.5" y="25.5" width="21" height="6" rx="1.5" fill="#64748b" />
    <rect x="7" y="13" width="3" height="11" fill="#64748b" /><rect x="26" y="13" width="3" height="11" fill="#64748b" /><rect x="5" y="22" width="26" height="2" rx="1" fill="#475569" />
    <rect x="3" y="4" width="30" height="11" rx="1.5" fill="#d6d3d1" /><rect x="3" y="13" width="30" height="2.4" rx="1" fill="#a8a29e" />
    <path d="M11 13 h14 l-1.5 -6 h-11z" fill="#94a3b8" /><rect x="12" y="2" width="12" height="7" rx=".8" fill="url(#hd-screen)" />
    <rect x="28" y="6" width="3" height="5" rx=".6" fill="#22c55e" /><rect x="28.6" y="6.6" width="1.8" height="1" fill="#bbf7d0" /></g>,
  gaming: <g>{sh(19, 24, 17, 4, .3)}
    <rect x="1" y="6" width="34" height="14" rx="2" fill="#18181b" /><rect x="1" y="18" width="34" height="3" rx="1" fill="#09090b" />
    <rect x="1" y="19.5" width="34" height="1.2" fill="url(#hd-rgb)" />
    <path d="M6 9 q12 -9 24 0 v4 q-12 -8 -24 0z" fill="#0f172a" /><path d="M7.5 10 q10.5 -7.5 21 0 v1.6 q-10.5 -6.8 -21 0z" fill="#7c3aed" opacity=".85" />
    <rect x="9" y="14.5" width="14" height="3" rx=".8" fill="#27272a" /><rect x="9.5" y="15" width="13" height="2" rx=".5" fill="url(#hd-rgb)" opacity=".7" />
    <ellipse cx="27" cy="16" rx="2" ry="2.6" fill="#27272a" /><rect x="26.5" y="14.2" width="1" height="1.4" fill="#22d3ee" />
    <g>{sh(18, 35, 7, 1.8, .2)}<rect x="10.5" y="24" width="15" height="9" rx="4" fill="#dc2626" /><rect x="11" y="30" width="14" height="4" rx="2" fill="#111827" />
      <rect x="14" y="25" width="8" height="5" rx="2" fill="#111827" /></g></g>,
  executive: <g>{sh(19, 25, 18, 4.5, .28)}
    <rect x="0" y="6" width="36" height="16" rx="1.5" fill="#7c2d12" /><rect x="0" y="6" width="36" height="16" rx="1.5" fill="url(#hd-woodGrain)" opacity=".5" />
    <rect x="0" y="19" width="36" height="4" rx="1" fill="#431407" /><rect x="1" y="6.8" width="34" height="1.2" fill="#c2410c" opacity=".5" />
    <rect x="4" y="9" width="12" height="8" rx=".6" fill="#14532d" opacity=".9" /><rect x="5" y="10" width="10" height="6" fill="#166534" />
    <path d="M24 16 v-6" stroke="#ca8a04" strokeWidth="1.2" /><path d="M20 10 h8 l-1.5 -3 h-5z" fill="#15803d" /><ellipse cx="24" cy="11.5" rx="5" ry="2" fill="#fde68a" opacity=".3" />
    <rect x="29" y="11" width="3.5" height="6" rx=".6" fill="#f5f5f4" /><rect x="7" y="17.5" width="9" height="1.4" rx=".6" fill="#ca8a04" />
    <g>{sh(18, 35, 8, 2, .22)}<rect x="10" y="24" width="16" height="9" rx="4" fill="#292524" /><rect x="10.5" y="29.5" width="15" height="4.5" rx="2.2" fill="#1c1917" />
      <path d="M13 26 h10" stroke="#57534e" strokeWidth=".7" /></g></g>,
  lshape: <g>{sh(17, 24, 17, 4)}
    <path d="M1 4 h34 v12 h-14 v12 h-20z" fill="#d6c4a8" /><path d="M1 26 h20 v2 h-20z M21 14 h14 v2 h-14z" fill="#a8916c" />
    <path d="M1 4 h34" stroke="#efe3cf" strokeWidth="1.2" />
    {screen(4, 0, 13, 9)}{screen(19, 0, 13, 9)}<rect x="9" y="11" width="16" height="2.4" rx=".6" fill="#e5e7eb" />
    <rect x="4" y="16" width="7" height="8" rx="1" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".4" /><path d="M5 18 h5 M5 20 h4 M5 22 h5" stroke="#94a3b8" strokeWidth=".5" />
    <g transform="translate(9 0)">{chair()}</g></g>,
  glass: <g>{sh(19, 23, 16, 3, .15)}
    <path d="M6 19 v6 M30 19 v6" stroke="#cbd5e1" strokeWidth="1.6" /><path d="M6 25 h2 M28 25 h2" stroke="#94a3b8" strokeWidth="1.4" />
    <rect x="2" y="7" width="32" height="12" rx="1.5" fill="#bae6fd" opacity=".45" stroke="#7dd3fc" strokeWidth=".8" />
    <path d="M5 9 l6 -0 l-3 8z" fill="#fff" opacity=".45" />
    <rect x="16.5" y="10" width="3" height="5" fill="#94a3b8" opacity=".9" />{screen(10, 0, 16, 11)}<rect x="12" y="15" width="12" height="2.4" rx=".6" fill="#f1f5f9" />
    {chair('#64748b', '#334155')}</g>,
  drafting: <g>{sh(19, 25, 15, 3.5)}
    <path d="M7 19 l-2 7 M29 19 l2 7 M18 20 v6" stroke="#57534e" strokeWidth="1.6" />
    <path d="M3 5 h30 l2 14 h-34z" fill="#e7e5e4" /><path d="M1 19 h34" stroke="#a8a29e" strokeWidth="2" />
    <rect x="6" y="7" width="22" height="10" fill="#dbeafe" transform="rotate(-3 17 12)" />
    <path d="M8 10 h12 v5 h-12z M20 10 l5 5" fill="none" stroke="#1d4ed8" strokeWidth=".7" transform="rotate(-3 17 12)" />
    <path d="M7 16 l22 -2" stroke="#78350f" strokeWidth="1.2" /><rect x="29" y="7" width="1.6" height="8" rx=".8" fill="#f59e0b" transform="rotate(18 30 11)" />
    <g>{sh(18, 34, 5, 1.6, .2)}<circle cx="18" cy="29" r="5" fill="#57534e" /><circle cx="18" cy="29" r="3.6" fill="#78716c" /></g></g>,
  cafe: <g>{sh(19, 22, 13, 4)}
    <rect x="17" y="17" width="2" height="8" fill="#44403c" /><ellipse cx="18" cy="25" rx="6" ry="1.8" fill="#44403c" />
    <circle cx="18" cy="12" r="12" fill="#f5f5f4" /><circle cx="18" cy="12" r="12" fill="none" stroke="#d6d3d1" strokeWidth="1" />
    <path d="M10 7 h13 l-1.5 8 h-10z" fill="#94a3b8" /><rect x="11" y="3" width="11.5" height="7.5" rx=".6" fill="#475569" /><rect x="11.8" y="3.8" width="10" height="6" fill="url(#hd-screen)" />
    <circle cx="26" cy="14" r="2.6" fill="#fff" stroke="#e7e5e4" strokeWidth=".5" /><circle cx="26" cy="14" r="1.6" fill="#78350f" />
    <path d="M24 9 q-.8 -1.6 0 -3" stroke="#d6d3d1" strokeWidth=".7" fill="none"><animate attributeName="opacity" values=".1;.8;.1" dur="2.6s" repeatCount="indefinite" /></path>
    <g>{sh(18, 34, 5, 1.6, .2)}<circle cx="18" cy="29.5" r="4.6" fill="#b45309" /><circle cx="18" cy="29.5" r="3.2" fill="#d97706" /></g></g>,
}

interface Props { style: string; rot?: Rot; size: number }

export const DeskSprite = memo(function DeskSprite({ style, rot = 0, size }: Props) {
  const art = ART[style] ?? ART.classic
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <g transform={`rotate(${rot} 18 18)`}>{art}</g>
    </svg>
  )
})
