import { memo, type ReactElement } from 'react'
import type { Rot } from '../../utils/officeDecor'

// ── ของแต่งโต๊ะ — สไปรต์ SVG มุมมองเดียวกับออฟฟิศ (viewBox 36×36 · แสงจากซ้ายบน · มีเงา) ──
// ใช้เงาไล่สี "hd-shadow" จาก <OfficeDefs /> ที่วางไว้ครั้งเดียวต่อแผนที่

const sh = (cx: number, cy: number, rx: number, ry: number, o = 0.22) =>
  <ellipse cx={cx} cy={cy} rx={rx + 1.6} ry={ry + 1.2} fill="url(#hd-shadow)" opacity={o} />

const ART: Record<string, ReactElement> = {
  // ── บนโต๊ะ ──
  mug: <g>{sh(19, 27, 8, 2.5)}<rect x="11" y="12" width="13" height="15" rx="2.5" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".8" />
    <path d="M24 15 q5 0 5 4.5 t-5 4.5" fill="none" stroke="#e2e8f0" strokeWidth="2.2" /><ellipse cx="17.5" cy="13" rx="5.6" ry="1.6" fill="#78350f" />
    <rect x="13" y="17" width="9" height="4" rx="1" fill="#2563eb" opacity=".85" />
    <path d="M15 9 q-1.5 -2.5 0 -5" stroke="#fff" strokeWidth="1" fill="none" opacity=".7"><animate attributeName="opacity" values=".1;.7;.1" dur="2.4s" repeatCount="indefinite" /></path></g>,
  laptop: <g>{sh(18, 29, 14, 3)}<rect x="5" y="4" width="26" height="17" rx="1.6" fill="#475569" /><rect x="6.5" y="5.5" width="23" height="14" rx=".6" fill="url(#hd-screen)" />
    <path d="M9 9 h10 M9 12 h14 M9 15 h7" stroke="#e0f2fe" strokeWidth="1" opacity=".8" /><path d="M2 21 h32 l-2.5 6 h-27z" fill="#94a3b8" /><rect x="13" y="23" width="10" height="2" rx=".8" fill="#64748b" /></g>,
  dualscreen: <g>{sh(18, 28, 16, 3)}<rect x="1" y="5" width="16" height="12" rx="1" fill="#1e293b" /><rect x="2.2" y="6.2" width="13.6" height="9.6" fill="url(#hd-screen)" />
    <rect x="19" y="5" width="16" height="12" rx="1" fill="#1e293b" /><rect x="20.2" y="6.2" width="13.6" height="9.6" fill="#0f172a" />
    <path d="M22 9 h6 M22 11.5 h9 M22 14 h4" stroke="#4ade80" strokeWidth="1" /><rect x="7.5" y="17" width="3" height="6" fill="#475569" /><rect x="25.5" y="17" width="3" height="6" fill="#475569" />
    <rect x="4" y="22" width="28" height="3" rx="1.2" fill="#334155" /></g>,
  lamp: <g>{sh(18, 30, 8, 2.5)}<ellipse cx="18" cy="28" rx="7" ry="2.4" fill="#334155" /><path d="M18 28 L14 14 L20 7" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
    <path d="M17 5 l10 3 l-3 6 l-9 -3z" fill="#f59e0b" /><ellipse cx="25" cy="16" rx="7" ry="5" fill="#fde68a" opacity=".35"><animate attributeName="opacity" values=".25;.4;.25" dur="3s" repeatCount="indefinite" /></ellipse></g>,
  photo: <g>{sh(19, 29, 9, 2.5)}<rect x="9" y="5" width="18" height="22" rx="1.2" fill="#a16207" /><rect x="11" y="7" width="14" height="18" fill="#bae6fd" />
    <circle cx="18" cy="13" r="3" fill="#fde68a" /><path d="M11 25 l5 -6 l3 3 l3 -4 l3 7z" fill="#16a34a" /><circle cx="15" cy="19" r="1.6" fill="#f472b6" /></g>,
  books: <g>{sh(18, 29, 13, 3)}<rect x="5" y="20" width="26" height="6" rx="1" fill="#2563eb" /><rect x="7" y="14" width="23" height="6" rx="1" fill="#dc2626" />
    <rect x="6" y="8" width="21" height="6" rx="1" fill="#16a34a" /><path d="M5 23 h26 M7 17 h23 M6 11 h21" stroke="#fff" strokeWidth=".6" opacity=".5" /></g>,
  cactus: <g>{sh(18, 30, 7, 2.2)}<path d="M12 22 h12 l-1.5 8 h-9z" fill="#ea580c" /><rect x="15" y="6" width="6" height="17" rx="3" fill="#15803d" />
    <path d="M15 14 h-3 a2 2 0 0 1 -2 -2 v-3" fill="none" stroke="#15803d" strokeWidth="3" strokeLinecap="round" /><path d="M21 12 h3 a2 2 0 0 0 2 -2 v-2" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
    <circle cx="18" cy="5.5" r="1.8" fill="#f472b6" /></g>,
  headphones: <g>{sh(18, 29, 11, 2.5)}<path d="M8 22 v-6 a10 10 0 0 1 20 0 v6" fill="none" stroke="#1f2937" strokeWidth="2.6" />
    <rect x="5" y="18" width="7" height="10" rx="3" fill="#7c3aed" /><rect x="24" y="18" width="7" height="10" rx="3" fill="#7c3aed" /><rect x="6.5" y="20" width="2" height="6" rx="1" fill="#a78bfa" /></g>,
  trophy: <g>{sh(18, 30, 8, 2.4)}<rect x="12" y="26" width="12" height="4" rx="1" fill="#78350f" /><rect x="16.5" y="19" width="3" height="7" fill="#ca8a04" />
    <path d="M10 5 h16 v5 a8 8 0 0 1 -16 0z" fill="#facc15" /><path d="M10 7 h-3 a3 3 0 0 0 3 5 M26 7 h3 a3 3 0 0 1 -3 5" fill="none" stroke="#eab308" strokeWidth="1.6" />
    <path d="M13 7 v4" stroke="#fef9c3" strokeWidth="1.4" strokeLinecap="round" /></g>,
  duck: <g>{sh(18, 29, 9, 2.5)}<ellipse cx="18" cy="22" rx="10" ry="6.5" fill="#facc15" /><circle cx="22" cy="12" r="5.5" fill="#facc15" />
    <path d="M27 12 l5 1 l-5 2z" fill="#f97316" /><circle cx="23.5" cy="11" r="1" fill="#111827" /><path d="M10 20 q4 3 8 0" stroke="#eab308" strokeWidth="1.2" fill="none" /></g>,
  sticky: <g>{sh(18, 29, 12, 2.5, .15)}<rect x="5" y="9" width="12" height="12" fill="#fde047" transform="rotate(-6 11 15)" /><rect x="17" y="12" width="12" height="12" fill="#f9a8d4" transform="rotate(5 23 18)" />
    <rect x="11" y="17" width="12" height="12" fill="#86efac" transform="rotate(-2 17 23)" /><path d="M13 21 h7 M13 24 h5" stroke="#166534" strokeWidth=".9" opacity=".7" /></g>,
  globe: <g>{sh(18, 30, 8, 2.4)}<rect x="12" y="27" width="12" height="3" rx="1" fill="#78350f" /><rect x="17" y="21" width="2" height="6" fill="#a16207" />
    <circle cx="18" cy="13" r="9" fill="#3b82f6" /><path d="M12 9 q3 -2 5 1 t5 -1 l1 4 q-4 2 -6 0 t-5 2z M14 17 q3 0 4 3 l-3 1z" fill="#22c55e" />
    <path d="M9 13 a9 9 0 0 0 18 0" fill="none" stroke="#a16207" strokeWidth="1.2" /><circle cx="15" cy="9" r="2.4" fill="#fff" opacity=".25" /></g>,
  // ── ต้นไม้ ──
  monstera: <g>{sh(19, 32, 12, 3.5, .25)}<path d="M11 24 h14 l-2 10 h-10z" fill="#e7e5e4" /><rect x="10" y="22.5" width="16" height="3" rx="1" fill="#d6d3d1" />
    {[[-38, '#15803d'], [-8, '#16a34a'], [24, '#15803d'], [52, '#22c55e']].map(([a, c], i) => (
      <g key={i} transform={`rotate(${a} 18 22)`}><path d="M18 22 q-1 -9 0 -18 q9 4 0 18" fill={c as string} /><path d="M18 21 v-15" stroke="#14532d" strokeWidth=".6" /><path d="M18 11 l3 -2 M18 15 l3 -1.5" stroke="#14532d" strokeWidth=".6" /></g>
    ))}</g>,
  fern: <g>{sh(18, 32, 11, 3.2, .25)}<path d="M11 25 h14 l-2 8 h-10z" fill="#92400e" /><rect x="10" y="23.5" width="16" height="2.6" rx="1" fill="#b45309" />
    {[-60, -35, -12, 12, 35, 60].map((a, i) => (
      <path key={i} d="M18 24 q-2 -10 0 -19" fill="none" stroke={i % 2 ? '#22c55e' : '#16a34a'} strokeWidth="3.4" strokeDasharray="2.4 0.8" strokeLinecap="round" transform={`rotate(${a} 18 24)`} />
    ))}</g>,
  snake: <g>{sh(18, 32, 9, 3, .25)}<rect x="11" y="24" width="14" height="9" rx="1.5" fill="#f8fafc" stroke="#e2e8f0" />
    {[[-14, 13, '#166534'], [-4, 18, '#15803d'], [6, 15, '#166534'], [14, 11, '#15803d']].map(([a, h, c], i) => (
      <path key={i} d={`M18 25 q-3 ${-(h as number) / 2} 0 ${-(h as number)} q3 ${(h as number) / 2} 0 ${h as number}`} fill={c as string} stroke="#bef264" strokeWidth=".7" transform={`rotate(${a} 18 25)`} />
    ))}</g>,
  // ── เฟอร์นิเจอร์ ──
  bookshelf: <g>{sh(19, 33, 16, 3)}<rect x="3" y="1" width="30" height="31" rx="1.5" fill="#92400e" /><rect x="5" y="3" width="26" height="27" fill="#78350f" />
    {[3, 12, 21].map((y, r) => <g key={r}>
      {[0, 1, 2, 3, 4, 5].map(i => <rect key={i} x={5.5 + i * 4.2} y={y + 1 + (i % 3)} width="3.4" height={7 - (i % 3)} fill={['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2'][(i + r) % 6]} />)}
      <rect x="5" y={y + 8} width="26" height="1.4" fill="#a16207" /></g>)}</g>,
  rug: <g><ellipse cx="18" cy="18" rx="17" ry="14" fill="#c084fc" opacity=".85" /><ellipse cx="18" cy="18" rx="13" ry="10.5" fill="none" stroke="#f5d0fe" strokeWidth="1.6" />
    <ellipse cx="18" cy="18" rx="8" ry="6" fill="#a855f7" opacity=".7" /><ellipse cx="18" cy="18" rx="17" ry="14" fill="none" stroke="#7e22ce" strokeWidth=".8" strokeDasharray="1.5 1.5" /></g>,
  beanbag: <g>{sh(18, 30, 15, 4, .28)}<path d="M4 27 q-2 -14 14 -19 q16 5 14 19 q-14 6 -28 0z" fill="#f97316" />
    <path d="M9 22 q9 -8 18 0" fill="none" stroke="#c2410c" strokeWidth="1.2" /><ellipse cx="13" cy="15" rx="4" ry="2" fill="#fdba74" opacity=".7" /></g>,
  floorlamp: <g>{sh(18, 33, 7, 2.2)}<ellipse cx="18" cy="32" rx="6" ry="2" fill="#334155" /><rect x="17" y="10" width="2" height="22" fill="#475569" />
    <path d="M10 11 h16 l-3 -9 h-10z" fill="#fef3c7" stroke="#fcd34d" strokeWidth=".8" /><ellipse cx="18" cy="12" rx="14" ry="6" fill="#fde68a" opacity=".22"><animate attributeName="opacity" values=".15;.3;.15" dur="4s" repeatCount="indefinite" /></ellipse></g>,
  fridge: <g>{sh(19, 33, 12, 3)}<rect x="7" y="3" width="22" height="29" rx="3" fill="#e2e8f0" /><rect x="7" y="3" width="22" height="29" rx="3" fill="none" stroke="#94a3b8" strokeWidth=".8" />
    <path d="M7 13 h22" stroke="#94a3b8" strokeWidth=".8" /><rect x="25" y="6" width="1.6" height="5" rx=".8" fill="#64748b" /><rect x="25" y="16" width="1.6" height="8" rx=".8" fill="#64748b" />
    <rect x="10" y="17" width="5" height="4" fill="#fde047" transform="rotate(-8 12 19)" /><rect x="8.5" y="4.5" width="4" height="27" fill="#fff" opacity=".35" /></g>,
  aquarium: <g>{sh(18, 32, 16, 3)}<rect x="1" y="25" width="34" height="7" rx="1" fill="#1f2937" /><rect x="2" y="5" width="32" height="20" rx="1.5" fill="#7dd3fc" opacity=".85" />
    <rect x="2" y="5" width="32" height="3" fill="#0ea5e9" /><path d="M4 25 q4 -6 8 0 M24 25 q3 -8 6 0" fill="#16a34a" />
    <g><path d="M0 0 l5 -3 v6z M5 0 a4 2.6 0 1 0 0.01 0" fill="#f97316" /><animateTransform attributeName="transform" type="translate" values="22 14;10 16;22 14" dur="6s" repeatCount="indefinite" /></g>
    <circle cx="8" cy="12" r="1" fill="#fff" opacity=".7"><animate attributeName="cy" values="22;7" dur="3s" repeatCount="indefinite" /></circle></g>,
  guitar: <g>{sh(20, 32, 9, 2.5)}<g transform="rotate(18 18 18)"><rect x="16.5" y="1" width="3" height="16" fill="#78350f" /><rect x="15.5" y="0" width="5" height="3" rx="1" fill="#451a03" />
    <ellipse cx="18" cy="21" rx="7.5" ry="5.5" fill="#d97706" /><ellipse cx="18" cy="27" rx="8.5" ry="6.5" fill="#d97706" /><circle cx="18" cy="23" r="2.4" fill="#451a03" />
    <path d="M17.2 3 v26 M18.8 3 v26" stroke="#fef3c7" strokeWidth=".35" /></g></g>,
  cat: <g>{sh(18, 27, 12, 3.5, .25)}<ellipse cx="18" cy="23" rx="12" ry="7" fill="#fb923c" /><path d="M8 22 q-2 6 6 7" fill="none" stroke="#ea580c" strokeWidth="3" strokeLinecap="round" />
    <circle cx="25" cy="18" r="5.5" fill="#fb923c" /><path d="M21 14 l1 -4 l3 3z M27 13 l2 -3 l1 4z" fill="#fb923c" />
    <path d="M23 18 q1 1 2 0 M26.5 18 q1 1 2 0" stroke="#7c2d12" strokeWidth=".8" fill="none" /><path d="M12 21 q3 -2 6 0 M14 25 q3 -2 6 0" stroke="#ea580c" strokeWidth="1" fill="none" />
    <text x="29" y="10" fontSize="5" fill="#64748b">z<animate attributeName="opacity" values="0;1;0" dur="2.5s" repeatCount="indefinite" /></text></g>,
  arcade: <g>{sh(19, 33, 12, 3)}<path d="M8 2 h20 v30 h-20z" fill="#7c3aed" /><path d="M8 2 h20 v5 h-20z" fill="#4c1d95" /><text x="11" y="6" fontSize="3.6" fill="#fde047" fontWeight="bold">ARCADE</text>
    <rect x="10.5" y="8.5" width="15" height="11" fill="#0f172a" /><rect x="12" y="10" width="3" height="3" fill="#22c55e"><animate attributeName="x" values="12;21;12" dur="2s" repeatCount="indefinite" /></rect>
    <rect x="17" y="15" width="2" height="2" fill="#f43f5e" /><path d="M8 21 h20 l-2 4 h-16z" fill="#6d28d9" /><circle cx="14" cy="22.5" r="1.4" fill="#ef4444" /><circle cx="20" cy="22.5" r="1.1" fill="#facc15" /><circle cx="23" cy="22.5" r="1.1" fill="#3b82f6" /></g>,
  bike: <g>{sh(18, 30, 15, 2.5)}<circle cx="9" cy="23" r="6.5" fill="none" stroke="#1f2937" strokeWidth="2" /><circle cx="27" cy="23" r="6.5" fill="none" stroke="#1f2937" strokeWidth="2" />
    <path d="M9 23 l7 -10 h9 l2 10 M16 13 l4 10 l5 -10 M14 11 h5 M25 13 l-1 -4 h3" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="20" cy="23" r="1.4" fill="#374151" /></g>,
}

interface Props { kind: string; rot?: Rot; flip?: boolean; size: number }

/** ของแต่ง 1 ชิ้น — หมุนรอบกลางช่อง / กลับซ้ายขวา */
export const DecorSprite = memo(function DecorSprite({ kind, rot = 0, flip = false, size }: Props) {
  const art = ART[kind]
  if (!art) return null
  const t = `rotate(${rot} 18 18)${flip ? ' translate(36 0) scale(-1 1)' : ''}`
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <g transform={t}>{art}</g>
    </svg>
  )
})



