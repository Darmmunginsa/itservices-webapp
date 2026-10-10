import { memo, type ReactElement } from 'react'
import { propDef } from '../../utils/officeProps'

// ── ภาพวาดสิ่งของชิ้นใหญ่ — viewBox = (กว้าง×36) × (สูง×36) มุมมองเดียวกับออฟฟิศ ──
// มีเงาตกบนพื้น · แสงจากซ้ายบน · บางชิ้นขยับได้ (น้ำไหล ปลาว่าย เป็ดลอย ชิงช้าแกว่ง นาฬิกาเดิน)

const sh = (cx: number, cy: number, rx: number, ry: number, o = 0.22) =>
  <ellipse cx={cx} cy={cy} rx={rx + 1.6} ry={ry + 1.2} fill="url(#hd-shadow)" opacity={o} />

const Bob = ({ dy = 1.2, dur = 3, children }: { dy?: number; dur?: number; children: ReactElement | ReactElement[] }) => (
  <g>{children}<animateTransform attributeName="transform" type="translate" values={`0 0;0 ${-dy};0 0`} dur={`${dur}s`} repeatCount="indefinite" additive="sum" /></g>
)

/** ปลาคาร์ฟว่ายตามเส้นทาง */
const Koi = ({ path, dur, color, spot }: { path: string; dur: number; color: string; spot: string }) => (
  <g>
    <g>
      <ellipse cx="0" cy="0" rx="7" ry="2.8" fill={color} />
      <ellipse cx="-1" cy="-.6" rx="2.2" ry="1.3" fill={spot} />
      <path d="M-7 0 l-4 -3 v6z" fill={color} opacity=".9" />
      <circle cx="4.5" cy="-.8" r=".6" fill="#111827" />
      <animateMotion path={path} dur={`${dur}s`} repeatCount="indefinite" rotate="auto" />
    </g>
  </g>
)

const Duck = ({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) => (
  <g transform={`translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}`}>
    <Bob dy={1} dur={2.6}>
      <ellipse cx="0" cy="3" rx="9" ry="2" fill="#0369a1" opacity=".35" />
      <ellipse cx="0" cy="0" rx="8" ry="5" fill="#fafafa" />
      <path d="M-8 -1 q-3 -3 -1 -5 q2 3 3 4z" fill="#e5e7eb" />
      <circle cx="5.5" cy="-5" r="3.6" fill="#fafafa" />
      <path d="M8.5 -5 l4 1 l-4 1.6z" fill="#f97316" />
      <circle cx="6.4" cy="-6" r=".7" fill="#111827" />
      <path d="M-4 0 q3 2 6 0" stroke="#d1d5db" strokeWidth="1" fill="none" />
    </Bob>
  </g>
)

const ART: Record<string, ReactElement> = {
  // ═════ น้ำตก + บ่อปลา 8×4 (288×144) ═════
  waterfall: <g>
    {sh(150, 138, 140, 8, .25)}
    {/* หน้าผาหิน */}
    <path d="M6 70 Q4 20 40 10 Q70 -2 110 8 L178 8 Q222 -4 252 10 Q286 22 282 70 Z" fill="#78716c" />
    <path d="M14 66 Q16 30 46 20 Q80 10 112 18 L176 18 Q214 8 246 20 Q274 32 272 66Z" fill="#a8a29e" />
    {[[30, 30, 14], [62, 22, 12], [228, 26, 15], [258, 40, 11], [24, 52, 10], [264, 58, 9]].map(([x, y, r], i) => (
      <g key={i}><ellipse cx={x} cy={y} rx={r} ry={r * 0.7} fill="#57534e" /><ellipse cx={x - r * .3} cy={y - r * .25} rx={r * .45} ry={r * .3} fill="#d6d3d1" opacity=".6" /></g>
    ))}
    {/* มอสและเฟิร์นบนหิน */}
    {[[20, 18], [74, 10], [210, 12], [270, 30], [12, 44]].map(([x, y], i) => (
      <g key={i}><ellipse cx={x} cy={y} rx="10" ry="5" fill="#15803d" /><ellipse cx={x - 3} cy={y - 2} rx="5" ry="2.5" fill="#4ade80" opacity=".7" /></g>
    ))}
    {/* บ่อ */}
    <path d="M4 82 Q10 62 60 64 L230 64 Q284 62 284 90 Q286 132 230 138 L60 138 Q2 134 4 82Z" fill="#a8a29e" />
    <path d="M12 86 Q16 70 62 72 L228 72 Q276 70 276 92 Q278 126 228 130 L62 130 Q10 128 12 86Z" fill="#0ea5e9" />
    <path d="M12 86 Q16 70 62 72 L228 72 Q276 70 276 92 Q278 126 228 130 L62 130 Q10 128 12 86Z" fill="url(#hd-pond)" />
    {/* สายน้ำตก 3 สาย ไหลลงตลอด */}
    {[[100, 22], [134, 30], [170, 22]].map(([x, wdt], i) => (
      <g key={i}>
        <rect x={x} y="14" width={wdt} height="64" rx="4" fill="#e0f2fe" opacity=".95" />
        <rect x={x} y="14" width={wdt} height="64" rx="4" fill="url(#hd-falls)" />
        <ellipse cx={x + wdt / 2} cy="80" rx={wdt * 0.9} ry="6" fill="#fff" opacity=".85">
          <animate attributeName="rx" values={`${wdt * .75};${wdt};${wdt * .75}`} dur={`${1.2 + i * .3}s`} repeatCount="indefinite" />
        </ellipse>
      </g>
    ))}
    {/* ละอองน้ำ */}
    {[118, 150, 184].map((x, i) => (
      <circle key={i} cx={x} cy="76" r="3" fill="#fff" opacity=".6">
        <animate attributeName="cy" values="80;66;80" dur={`${1.6 + i * .4}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values=".7;0;.7" dur={`${1.6 + i * .4}s`} repeatCount="indefinite" />
      </circle>
    ))}
    {/* วงน้ำกระเพื่อม */}
    {[[60, 108], [230, 112], [150, 118]].map(([x, y], i) => (
      <ellipse key={i} cx={x} cy={y} rx="6" ry="2" fill="none" stroke="#e0f2fe" strokeWidth="1.2">
        <animate attributeName="rx" values="3;16" dur="3s" begin={`${i}s`} repeatCount="indefinite" />
        <animate attributeName="ry" values="1;5" dur="3s" begin={`${i}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values=".9;0" dur="3s" begin={`${i}s`} repeatCount="indefinite" />
      </ellipse>
    ))}
    {/* ใบบัว + ดอกบัว */}
    {[[40, 96, 8], [250, 100, 9], [88, 120, 7]].map(([x, y, r], i) => (
      <g key={i}><circle cx={x} cy={y} r={r} fill="#16a34a" /><path d={`M${x} ${y} L${x + r} ${y - 2} L${x + r} ${y + 2}z`} fill="#0ea5e9" /></g>
    ))}
    <g transform="translate(250 96)">{[0, 60, 120, 180, 240, 300].map(a => <ellipse key={a} cx="0" cy="-3" rx="2" ry="4" fill="#f9a8d4" transform={`rotate(${a})`} />)}<circle r="1.6" fill="#fde047" /></g>
    {/* ปลาคาร์ฟ 3 ตัว */}
    <Koi path="M40 110 C 80 90, 140 125, 200 104 S 250 120, 230 112 S 120 130, 40 110" dur={16} color="#f97316" spot="#fff7ed" />
    <Koi path="M220 96 C 170 118, 110 92, 70 112 S 30 100, 60 96 S 180 86, 220 96" dur={19} color="#fafafa" spot="#ef4444" />
    <Koi path="M120 118 C 160 108, 200 124, 240 116 S 200 100, 160 108 S 90 128, 120 118" dur={13} color="#fbbf24" spot="#f97316" />
    {/* เป็ด 2 ตัว */}
    <Duck x={196} y={96} />
    <Duck x={72} y={92} flip />
    {/* ดอกไม้ริมบ่อ */}
    {[[8, 100], [14, 116], [278, 104], [272, 122]].map(([x, y], i) => (
      <g key={i}><circle cx={x} cy={y} r="4" fill="#15803d" />{[0, 1, 2].map(j => <circle key={j} cx={x - 2 + j * 2} cy={y - 3 + (j % 2) * 2} r="1.6" fill={['#f472b6', '#facc15', '#a78bfa', '#fb7185'][i]} />)}</g>
    ))}
  </g>,
  // ═════ สวน ═════
  bench: <g>{sh(38, 30, 32, 4)}
    <path d="M10 20 v10 M62 20 v10" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
    <rect x="4" y="4" width="64" height="5" rx="2" fill="#a16207" /><rect x="4" y="10" width="64" height="5" rx="2" fill="#ca8a04" />
    <rect x="4" y="17" width="64" height="5" rx="2" fill="#a16207" /><rect x="4" y="17" width="64" height="2" rx="1" fill="#fde68a" opacity=".5" />
    <path d="M6 8 q-3 6 0 12 M66 8 q3 6 0 12" stroke="#1f2937" strokeWidth="2.5" fill="none" /></g>,
  fountain: <g>{sh(38, 66, 30, 5)}
    <ellipse cx="36" cy="54" rx="32" ry="13" fill="#a8a29e" /><ellipse cx="36" cy="52" rx="27" ry="10" fill="#38bdf8" />
    <ellipse cx="36" cy="52" rx="27" ry="10" fill="url(#hd-pond)" />
    <rect x="31" y="22" width="10" height="30" rx="3" fill="#d6d3d1" /><ellipse cx="36" cy="24" rx="14" ry="5" fill="#a8a29e" /><ellipse cx="36" cy="23" rx="11" ry="3.5" fill="#7dd3fc" />
    {[-1, 1].map(d => (
      <path key={d} d={`M36 14 q${d * 12} -6 ${d * 18} 12`} stroke="#e0f2fe" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".9">
        <animate attributeName="opacity" values=".5;1;.5" dur="1.4s" repeatCount="indefinite" />
      </path>
    ))}
    <path d="M36 22 V6" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round"><animate attributeName="stroke-width" values="2;3.5;2" dur="1s" repeatCount="indefinite" /></path>
    <circle cx="36" cy="5" r="3" fill="#fff" opacity=".8" /></g>,
  gazebo: <g>{sh(56, 104, 50, 6, .25)}
    <rect x="6" y="40" width="96" height="62" rx="4" fill="#d6c4a8" /><rect x="10" y="44" width="88" height="54" fill="#e7dcc6" />
    <path d="M10 44 h88 M10 62 h88 M10 80 h88" stroke="#c4b393" strokeWidth=".8" />
    {[[10, 40], [90, 40], [10, 90], [90, 90]].map(([x, y], i) => <rect key={i} x={x - 2} y={y - 32} width="8" height="44" rx="2" fill="#92400e" />)}
    <path d="M-4 18 L54 -18 L112 18 Z" fill="#991b1b" /><path d="M54 -18 L112 18 L84 18 Z" fill="#7f1d1d" />
    <path d="M-4 18 h116 v5 h-116z" fill="#78350f" />
    <path d="M4 18 L54 -12 M104 18 L54 -12" stroke="#b91c1c" strokeWidth="1.2" />
    <rect x="40" y="58" width="28" height="18" rx="2" fill="#a16207" /><rect x="44" y="62" width="6" height="5" rx="1" fill="#fafafa" /><circle cx="60" cy="66" r="3" fill="#fde047" />
    <path d="M14 70 h18 M76 70 h18" stroke="#78350f" strokeWidth="4" strokeLinecap="round" /></g>,
  arch: <g>{sh(54, 34, 46, 4)}
    <path d="M10 34 V14 Q54 -26 98 14 V34" stroke="#f5f5f4" strokeWidth="6" fill="none" />
    <path d="M10 34 V14 Q54 -26 98 14 V34" stroke="#e7e5e4" strokeWidth="2" fill="none" />
    {Array.from({ length: 16 }, (_, i) => {
      const t = i / 15, a = Math.PI * (1 - t)
      const x = 54 + Math.cos(a) * 44, y = 14 - Math.sin(a) * 26 + (t < .1 || t > .9 ? 10 : 0)
      return <g key={i}><circle cx={x} cy={y} r="5" fill="#16a34a" /><circle cx={x + 2} cy={y - 2} r="2.2" fill={['#f472b6', '#fb7185', '#fda4af', '#f9a8d4'][i % 4]} /></g>
    })}
    {[[10, 26], [98, 26], [10, 20], [98, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill="#15803d" />)}</g>,
  swing: <g>{sh(36, 66, 30, 5)}
    <path d="M6 70 L18 4 L30 70 M42 70 L54 4 L66 70" stroke="#78350f" strokeWidth="4" strokeLinejoin="round" fill="none" />
    <rect x="12" y="2" width="48" height="5" rx="2" fill="#92400e" />
    <g><path d="M28 6 V44 M44 6 V44" stroke="#a8a29e" strokeWidth="1.2" /><rect x="24" y="43" width="24" height="5" rx="1.5" fill="#dc2626" />
      <animateTransform attributeName="transform" type="rotate" values="-10 36 6;10 36 6;-10 36 6" dur="3s" repeatCount="indefinite" /></g></g>,
  gardenlamp: <g>{sh(18, 33, 7, 2)}
    <rect x="15" y="8" width="6" height="25" fill="#1f2937" /><rect x="12" y="30" width="12" height="4" rx="1" fill="#111827" />
    <path d="M10 8 h16 l-3 -7 h-10z" fill="#111827" /><rect x="12" y="1" width="12" height="8" rx="1" fill="#fde68a" opacity=".9" />
    <circle cx="18" cy="5" r="12" fill="#fde68a" opacity=".22"><animate attributeName="opacity" values=".15;.3;.15" dur="4s" repeatCount="indefinite" /></circle></g>,
  birdbath: <g>{sh(18, 33, 9, 2.5)}
    <path d="M14 33 h8 l-1.5 -14 h-5z" fill="#d6d3d1" /><ellipse cx="18" cy="18" rx="15" ry="5" fill="#a8a29e" /><ellipse cx="18" cy="17" rx="12" ry="3.5" fill="#7dd3fc" />
    <g transform="translate(22 13)"><Bob dy={1.5} dur={1.4}><ellipse cx="0" cy="0" rx="4" ry="2.8" fill="#92400e" /><circle cx="3.5" cy="-2" r="2" fill="#a16207" /><path d="M5.3 -2 l2 .5 l-2 .6z" fill="#facc15" /></Bob></g></g>,
  picnic: <g>{sh(56, 66, 50, 5)}
    <rect x="6" y="6" width="96" height="8" rx="2" fill="#a16207" /><rect x="6" y="58" width="96" height="8" rx="2" fill="#a16207" />
    <rect x="12" y="20" width="84" height="32" rx="3" fill="#ca8a04" /><path d="M12 30 h84 M12 41 h84" stroke="#a16207" strokeWidth="1" />
    <circle cx="40" cy="34" r="5" fill="#fff" stroke="#e5e7eb" /><circle cx="68" cy="38" r="5" fill="#fff" stroke="#e5e7eb" /><rect x="50" y="26" width="10" height="6" rx="1" fill="#dc2626" />
    <circle cx="56" cy="36" r="24" fill="#ef4444" opacity=".2" /><path d="M56 12 v48" stroke="#9ca3af" strokeWidth="1.5" /></g>,
  duck: <g><Duck x={18} y={20} /></g>,
  stones: <g>{sh(38, 30, 32, 4)}
    {[[14, 22, 11, 7, '#78716c'], [34, 20, 13, 9, '#a8a29e'], [56, 24, 10, 6, '#57534e'], [46, 28, 7, 4, '#d6d3d1']].map(([x, y, rx, ry, c], i) => (
      <g key={i}><ellipse cx={x} cy={y} rx={rx} ry={ry} fill={c as string} /><ellipse cx={(x as number) - 3} cy={(y as number) - 3} rx={(rx as number) * .4} ry={(ry as number) * .35} fill="#fff" opacity=".35" />
        <ellipse cx={(x as number) + 2} cy={(y as number) - (ry as number) + 1} rx={(rx as number) * .6} ry="2" fill="#4d7c0f" opacity=".8" /></g>
    ))}</g>,
  // ═════ สันทนาการ ═════
  pingpong: <g>{sh(56, 68, 50, 5)}
    <rect x="6" y="8" width="96" height="56" rx="3" fill="#15803d" /><rect x="8" y="10" width="92" height="52" fill="none" stroke="#fff" strokeWidth="1.5" />
    <path d="M54 10 v52" stroke="#fff" strokeWidth="1" /><path d="M54 4 v64" stroke="#e5e7eb" strokeWidth="3" /><path d="M54 4 v64" stroke="#111827" strokeWidth="1" strokeDasharray="2 2" />
    <circle cx="30" cy="36" r="2.4" fill="#fff"><animate attributeName="cx" values="22;86;22" dur="2s" repeatCount="indefinite" /><animate attributeName="cy" values="30;42;30" dur="2s" repeatCount="indefinite" /></circle>
    <g transform="translate(14 30)"><circle r="6" fill="#dc2626" /><rect x="-1.5" y="5" width="3" height="8" fill="#78350f" /></g>
    <g transform="translate(94 40)"><circle r="6" fill="#111827" /><rect x="-1.5" y="5" width="3" height="8" fill="#78350f" /></g></g>,
  pool: <g>{sh(56, 68, 50, 5)}
    <rect x="4" y="6" width="100" height="60" rx="6" fill="#78350f" /><rect x="11" y="13" width="86" height="46" rx="2" fill="#166534" />
    <rect x="11" y="13" width="86" height="46" rx="2" fill="url(#hd-dots)" opacity=".15" />
    {[[11, 13], [54, 11], [97, 13], [11, 59], [54, 61], [97, 59]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#111827" />)}
    {[[70, 30, '#facc15'], [74, 34, '#dc2626'], [70, 38, '#2563eb'], [66, 34, '#7c3aed'], [78, 30, '#ea580c'], [78, 38, '#16a34a']].map(([x, y, c], i) => <circle key={i} cx={x as number} cy={y as number} r="3" fill={c as string} />)}
    <circle cx="32" cy="36" r="3" fill="#fafafa" /><path d="M8 50 L30 38" stroke="#d6a26b" strokeWidth="2" strokeLinecap="round" /></g>,
  foosball: <g>{sh(38, 32, 32, 4)}
    <rect x="4" y="6" width="64" height="24" rx="3" fill="#1f2937" /><rect x="8" y="9" width="56" height="18" fill="#16a34a" />
    {[16, 28, 44, 56].map((x, i) => <g key={x}><path d={`M${x} 2 V34`} stroke="#9ca3af" strokeWidth="1.6" />{[12, 18, 24].map(y => <rect key={y} x={x - 2} y={y - 2} width="4" height="4" rx="1" fill={i % 2 ? '#2563eb' : '#dc2626'} />)}</g>)}
    <circle cx="36" cy="18" r="1.8" fill="#fff" /></g>,
  sofa: <g>{sh(56, 32, 50, 4)}
    <rect x="4" y="4" width="100" height="14" rx="6" fill="#4338ca" /><rect x="2" y="12" width="104" height="18" rx="6" fill="#6366f1" />
    {[10, 42, 74].map(x => <rect key={x} x={x} y="14" width="26" height="11" rx="4" fill="#818cf8" />)}
    <rect x="16" y="6" width="12" height="9" rx="3" fill="#fbbf24" transform="rotate(-10 22 10)" /></g>,
  hammock: <g>{sh(56, 32, 46, 4)}
    <rect x="2" y="2" width="6" height="32" rx="2" fill="#78350f" /><rect x="100" y="2" width="6" height="32" rx="2" fill="#78350f" />
    <g><path d="M8 8 Q54 34 100 8 L100 12 Q54 40 8 12z" fill="#f97316" /><path d="M8 10 Q54 37 100 10" stroke="#fde68a" strokeWidth="1" fill="none" strokeDasharray="3 3" />
      <animateTransform attributeName="transform" type="rotate" values="-1.5 54 8;1.5 54 8;-1.5 54 8" dur="4s" repeatCount="indefinite" /></g></g>,
  tvwall: <g>{sh(56, 33, 50, 3)}
    <rect x="4" y="24" width="100" height="10" rx="2" fill="#78350f" /><rect x="40" y="26" width="28" height="5" rx="1" fill="#1f2937" />
    <rect x="10" y="0" width="88" height="24" rx="2" fill="#111827" /><rect x="12" y="2" width="84" height="20" rx="1" fill="url(#hd-screen)" />
    <path d="M18 16 l10 -8 l8 6 l10 -10 l12 12" stroke="#a7f3d0" strokeWidth="1.5" fill="none" /><circle cx="84" cy="8" r="3" fill="#fde047" /></g>,
  // ═════ ครัว/คาเฟ่ ═════
  bar: <g>{sh(74, 34, 68, 3)}
    <rect x="2" y="2" width="140" height="14" rx="3" fill="#78350f" /><rect x="2" y="2" width="140" height="4" rx="2" fill="#a16207" />
    {[16, 50, 84, 118].map(x => <g key={x}><circle cx={x} cy="27" r="6" fill="#1f2937" /><circle cx={x} cy="27" r="4" fill="#dc2626" /></g>)}
    {[20, 60, 104].map((x, i) => <g key={x}><rect x={x} y="5" width="6" height="7" rx="1" fill={['#fef3c7', '#bbf7d0', '#fecaca'][i]} /><path d={`M${x + 3} 5 v-3`} stroke="#9ca3af" strokeWidth=".8" /></g>)}</g>,
  vending: <g>{sh(18, 34, 12, 2.5)}
    <rect x="5" y="0" width="26" height="34" rx="2" fill="#dc2626" /><rect x="8" y="3" width="15" height="24" rx="1" fill="#e0f2fe" />
    {[0, 1, 2, 3].map(r => [0, 1, 2].map(c => <rect key={`${r}${c}`} x={9.5 + c * 4.5} y={5 + r * 5.5} width="3.4" height="4" rx=".6" fill={['#facc15', '#22c55e', '#3b82f6', '#f97316'][(r + c) % 4]} />))}
    <rect x="24.5" y="6" width="4" height="8" rx="1" fill="#1f2937" /><rect x="8" y="29" width="15" height="3" rx="1" fill="#1f2937" />
    <rect x="8" y="3" width="15" height="24" fill="#fff" opacity=".2"><animate attributeName="opacity" values=".1;.3;.1" dur="3s" repeatCount="indefinite" /></rect></g>,
  bigfridge: <g>{sh(18, 34, 12, 2.5)}
    <rect x="5" y="0" width="26" height="34" rx="2" fill="#cbd5e1" /><path d="M18 0 v34" stroke="#94a3b8" strokeWidth="1" />
    <rect x="14" y="10" width="1.5" height="10" rx=".7" fill="#64748b" /><rect x="20.5" y="10" width="1.5" height="10" rx=".7" fill="#64748b" />
    <rect x="7" y="2" width="4" height="30" fill="#fff" opacity=".35" /><rect x="22" y="4" width="6" height="5" rx="1" fill="#0ea5e9" /></g>,
  microwave: <g>{sh(18, 34, 13, 2.5)}
    <rect x="3" y="24" width="30" height="10" rx="1" fill="#78350f" />
    <rect x="4" y="8" width="28" height="16" rx="2" fill="#e5e7eb" /><rect x="6" y="10" width="17" height="12" rx="1" fill="#1f2937" />
    <rect x="6" y="10" width="17" height="12" rx="1" fill="#fde68a" opacity=".25"><animate attributeName="opacity" values=".05;.35;.05" dur="2s" repeatCount="indefinite" /></rect>
    <rect x="25" y="11" width="5" height="3" rx=".5" fill="#22c55e" /><circle cx="27.5" cy="18" r="1.5" fill="#9ca3af" /></g>,
  fruits: <g>{sh(18, 34, 12, 2.5)}
    <rect x="6" y="22" width="24" height="12" rx="2" fill="#a16207" />
    <path d="M7 22 q11 8 22 0" fill="#d97706" /><circle cx="12" cy="18" r="4.5" fill="#dc2626" /><circle cx="20" cy="16" r="4.5" fill="#f97316" /><circle cx="26" cy="19" r="4" fill="#84cc16" />
    <path d="M14 12 q6 -8 12 0" stroke="#facc15" strokeWidth="3.5" fill="none" strokeLinecap="round" /><circle cx="17" cy="20" r="2.4" fill="#7c3aed" /></g>,
  // ═════ สำนักงาน ═════
  printer: <g>{sh(18, 34, 14, 2.5)}
    <rect x="2" y="12" width="32" height="20" rx="2" fill="#d1d5db" /><rect x="2" y="12" width="32" height="5" rx="2" fill="#9ca3af" />
    <rect x="8" y="4" width="20" height="10" fill="#fafafa" stroke="#e5e7eb" /><rect x="7" y="27" width="22" height="3" rx="1" fill="#6b7280" />
    <g><rect x="9" y="24" width="18" height="8" fill="#fff" stroke="#e5e7eb" /><path d="M11 27 h12 M11 29 h9" stroke="#9ca3af" strokeWidth=".8" />
      <animateTransform attributeName="transform" type="translate" values="0 -4;0 2;0 2;0 -4" dur="4s" repeatCount="indefinite" /></g>
    <circle cx="29" cy="20" r="1.5" fill="#22c55e" /></g>,
  cabinet: <g>{sh(18, 34, 12, 2.5)}
    <rect x="6" y="0" width="24" height="34" rx="2" fill="#64748b" />
    {[2, 10, 18, 26].map(y => <g key={y}><rect x="8" y={y} width="20" height="7" rx="1" fill="#94a3b8" /><rect x="15" y={y + 2.5} width="6" height="2" rx="1" fill="#334155" /></g>)}</g>,
  cooler: <g>{sh(18, 34, 9, 2.5)}
    <rect x="9" y="16" width="18" height="18" rx="2" fill="#e5e7eb" /><rect x="11" y="22" width="5" height="3" rx="1" fill="#2563eb" /><rect x="20" y="22" width="5" height="3" rx="1" fill="#dc2626" />
    <path d="M10 16 q8 -4 16 0 v-12 q-8 -4 -16 0z" fill="#7dd3fc" opacity=".85" /><path d="M12 4 v10" stroke="#fff" strokeWidth="1.5" opacity=".5" />
    <circle cx="17" cy="12" r="1.2" fill="#fff" opacity=".9"><animate attributeName="cy" values="14;4" dur="2.5s" repeatCount="indefinite" /></circle></g>,
  notice: <g>{sh(38, 34, 30, 2.5)}
    <rect x="4" y="2" width="64" height="30" rx="2" fill="#a16207" /><rect x="7" y="5" width="58" height="24" fill="#d6a26b" />
    {[[10, 7, '#fef9c3', -4], [26, 9, '#fecaca', 3], [42, 6, '#bbf7d0', -2], [54, 12, '#bfdbfe', 5], [16, 17, '#fff', 2]].map(([x, y, c, r], i) => (
      <g key={i} transform={`rotate(${r} ${(x as number) + 6} ${(y as number) + 5})`}><rect x={x as number} y={y as number} width="12" height="10" fill={c as string} /><circle cx={(x as number) + 6} cy={(y as number) + 1.5} r="1.2" fill="#dc2626" /></g>
    ))}</g>,
  logo: <g>{sh(56, 34, 50, 2.5)}
    <rect x="4" y="2" width="100" height="28" rx="4" fill="#0f172a" />
    <text x="54" y="22" textAnchor="middle" fontSize="15" fontWeight="bold" fill="#38bdf8" fontFamily="sans-serif">iT Services
      <animate attributeName="opacity" values=".75;1;.75" dur="3s" repeatCount="indefinite" /></text>
    <rect x="4" y="2" width="100" height="28" rx="4" fill="none" stroke="#38bdf8" strokeWidth="1" opacity=".6" /></g>,
  clock: <ClockArt />,
}

/** นาฬิกาตั้งพื้น — เข็มชี้เวลาจริงตอนวาด แล้วหมุนต่อด้วย animation (ชั่วโมง/นาที) */
function ClockArt() {
  const now = new Date()
  const m = now.getMinutes(), h = (now.getHours() % 12) + m / 60
  return (
    <g>{sh(18, 34, 9, 2.5)}
      <rect x="10" y="10" width="16" height="24" rx="2" fill="#78350f" /><rect x="13" y="20" width="10" height="12" rx="1" fill="#451a03" />
      <g><path d="M18 22 v8" stroke="#ca8a04" strokeWidth="1.2" /><circle cx="18" cy="30" r="2" fill="#ca8a04" />
        <animateTransform attributeName="transform" type="rotate" values="-12 18 22;12 18 22;-12 18 22" dur="2s" repeatCount="indefinite" /></g>
      <circle cx="18" cy="9" r="9" fill="#78350f" /><circle cx="18" cy="9" r="7.4" fill="#fefce8" />
      <path d="M18 9 V4.5" stroke="#111827" strokeWidth="1.3" strokeLinecap="round" transform={`rotate(${h * 30} 18 9)`}>
        <animateTransform attributeName="transform" type="rotate" from={`${h * 30} 18 9`} to={`${h * 30 + 360} 18 9`} dur="43200s" repeatCount="indefinite" /></path>
      <path d="M18 9 V3" stroke="#111827" strokeWidth=".9" strokeLinecap="round" transform={`rotate(${m * 6} 18 9)`}>
        <animateTransform attributeName="transform" type="rotate" from={`${m * 6} 18 9`} to={`${m * 6 + 360} 18 9`} dur="3600s" repeatCount="indefinite" /></path>
      <circle cx="18" cy="9" r="1" fill="#111827" />
    </g>
  )
}

/** ภาพของ 1 ชิ้น — size = ขนาดช่อง (px) ภาพจะกว้าง w×size สูง h×size */
export const PropSprite = memo(function PropSprite({ kind, size }: { kind: string; size: number }) {
  const d = propDef(kind)
  if (!d) return null
  return (
    <svg width={d.w * size} height={d.h * size} viewBox={`0 0 ${d.w * 36} ${d.h * 36}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      {ART[kind]}
    </svg>
  )
})
