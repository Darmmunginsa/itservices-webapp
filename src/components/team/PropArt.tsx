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
    <defs>
      {/* ม่านน้ำ: ใสที่ขอบ ขาวขุ่นตรงกลาง เข้มขึ้นด้านล่างที่น้ำหนาขึ้น */}
      <linearGradient id="wf-curtain" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#bae6fd" stopOpacity=".55" /><stop offset=".18" stopColor="#f0f9ff" stopOpacity=".92" />
        <stop offset=".5" stopColor="#e0f2fe" stopOpacity=".88" /><stop offset=".82" stopColor="#f0f9ff" stopOpacity=".92" />
        <stop offset="1" stopColor="#7dd3fc" stopOpacity=".5" />
      </linearGradient>
      <linearGradient id="wf-depth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0c4a6e" stopOpacity=".35" /><stop offset=".25" stopColor="#0c4a6e" stopOpacity="0" />
        <stop offset=".85" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity=".7" />
      </linearGradient>
      {/* สายน้ำที่ตกลงมา — ลายเส้นขาวเลื่อนลงทั้งแผ่น (1 แอนิเมชันต่อชั้น — เบาเครื่อง) */}
      <pattern id="wf-streak" width="24" height="46" patternUnits="userSpaceOnUse">
        <rect x="1" y="0" width="1.6" height="18" rx=".8" fill="#fff" opacity=".9" />
        <rect x="6" y="20" width="1.2" height="22" rx=".6" fill="#fff" opacity=".7" />
        <rect x="10.5" y="6" width="2" height="14" rx="1" fill="#fff" opacity=".85" />
        <rect x="15" y="26" width="1.4" height="16" rx=".7" fill="#fff" opacity=".75" />
        <rect x="19.5" y="2" width="1.2" height="24" rx=".6" fill="#fff" opacity=".6" />
        <rect x="3.5" y="30" width="1" height="12" rx=".5" fill="#38bdf8" opacity=".5" />
        <rect x="13" y="38" width="1" height="8" rx=".5" fill="#38bdf8" opacity=".45" />
        <animateTransform attributeName="patternTransform" type="translate" values="0 0;0 46" dur=".9s" repeatCount="indefinite" />
      </pattern>
      <pattern id="wf-streak2" width="17" height="30" patternUnits="userSpaceOnUse">
        <rect x="2" y="0" width="1" height="12" rx=".5" fill="#fff" opacity=".55" />
        <rect x="8" y="14" width="1.4" height="12" rx=".7" fill="#fff" opacity=".6" />
        <rect x="13" y="4" width="1" height="9" rx=".5" fill="#e0f2fe" opacity=".6" />
        <animateTransform attributeName="patternTransform" type="translate" values="3 0;3 30" dur=".55s" repeatCount="indefinite" />
      </pattern>
      {/* บ่อ: ตื้นใสที่ขอบ ลึกเข้มตรงกลาง */}
      <radialGradient id="wf-pond" cx=".5" cy=".35" r=".75">
        <stop offset="0" stopColor="#bae6fd" /><stop offset=".25" stopColor="#38bdf8" />
        <stop offset=".7" stopColor="#0e7490" /><stop offset="1" stopColor="#155e75" />
      </radialGradient>
      <radialGradient id="wf-mist"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      <linearGradient id="wf-rock" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a8a29e" /><stop offset=".55" stopColor="#78716c" /><stop offset="1" stopColor="#44403c" />
      </linearGradient>
      <linearGradient id="wf-wet" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1c1917" stopOpacity="0" /><stop offset=".5" stopColor="#1c1917" stopOpacity=".45" /><stop offset="1" stopColor="#1c1917" stopOpacity="0" />
      </linearGradient>
    </defs>
    {sh(146, 138, 140, 8, .25)}

    {/* ═ หน้าผาหินเป็นชั้น ๆ (หลัง → หน้า) ═ */}
    <path d="M4 78 Q0 30 30 14 Q60 0 104 6 L186 6 Q232 -2 260 14 Q290 32 284 78 Z" fill="#57534e" />
    <path d="M10 76 Q8 36 36 22 Q66 10 104 14 L186 14 Q226 8 252 22 Q278 38 276 76 Z" fill="url(#wf-rock)" />
    {/* ชั้นหิน (strata) และรอยแตก */}
    {['M20 40 Q50 32 96 36', 'M14 58 Q44 50 92 56', 'M196 34 Q232 30 266 40', 'M200 54 Q238 50 272 60', 'M40 26 Q70 18 100 22', 'M192 22 Q222 16 248 26'].map((d, i) => (
      <path key={i} d={d} stroke="#44403c" strokeWidth="1.4" fill="none" opacity=".55" strokeLinecap="round" />
    ))}
    {['M60 30 l-4 12 l5 8', 'M234 36 l3 10 l-4 9', 'M30 48 l6 9'].map((d, i) => (
      <path key={i} d={d} stroke="#292524" strokeWidth="1" fill="none" opacity=".5" />
    ))}
    {/* ก้อนหินนูน: เงาล่าง + หน้าบนรับแสงจากซ้ายบน */}
    {[[26, 34, 15, 10], [62, 24, 13, 8], [84, 50, 11, 8], [222, 28, 15, 9], [254, 44, 13, 9], [206, 56, 10, 7], [22, 62, 12, 8], [266, 66, 11, 7]].map(([x, y, rx, ry], i) => (
      <g key={i}>
        <ellipse cx={x + 1.5} cy={y + 2.5} rx={rx} ry={ry} fill="#292524" opacity=".45" />
        <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#78716c" />
        <ellipse cx={x - rx * .25} cy={y - ry * .3} rx={rx * .65} ry={ry * .5} fill="#a8a29e" />
        <ellipse cx={x - rx * .4} cy={y - ry * .45} rx={rx * .25} ry={ry * .18} fill="#e7e5e4" opacity=".7" />
      </g>
    ))}
    {/* ลำธารด้านบนที่ไหลมาถึงขอบผา */}
    <path d="M112 4 Q146 -2 178 4 L182 16 Q146 12 108 16 Z" fill="#0e7490" />
    <path d="M116 6 Q146 2 174 6 L176 13 Q146 10 114 13 Z" fill="#38bdf8" opacity=".75" />
    <path d="M122 8 q8 -1.5 16 0 M150 7 q8 -1.5 16 0" stroke="#e0f2fe" strokeWidth="1" fill="none" opacity=".8" />
    {/* หินเปียกข้างม่านน้ำ (มันวาวเข้ม) */}
    <path d="M92 18 Q100 50 94 84 L104 84 Q108 50 104 18Z" fill="url(#wf-wet)" />
    <path d="M186 18 Q180 50 186 84 L196 84 Q192 50 198 18Z" fill="url(#wf-wet)" />

    {/* ═ น้ำตกเล็กแบบขั้นบันไดทางซ้าย ═ */}
    <path d="M58 40 h14 l1 10 h-16z M54 52 h20 l2 12 h-24z" fill="url(#wf-curtain)" />
    <path d="M58 40 h14 l1 10 h-16z M54 52 h20 l2 12 h-24z" fill="url(#wf-streak2)" />
    <path d="M57 40 h16 M53 52 h22" stroke="#f0f9ff" strokeWidth="2" strokeLinecap="round" />

    {/* ═ บ่อ ═ */}
    {/* ขอบบ่อหินก้อนกลม */}
    <path d="M2 86 Q6 64 60 66 L232 66 Q288 64 286 92 Q288 136 232 140 L60 140 Q0 136 2 86Z" fill="#78716c" />
    <path d="M10 88 Q14 72 62 74 L230 74 Q278 72 278 94 Q280 128 230 132 L62 132 Q8 130 10 88Z" fill="url(#wf-pond)" />
    {/* ขอบน้ำตื้นสว่าง */}
    <path d="M10 88 Q14 72 62 74 L230 74 Q278 72 278 94 Q280 128 230 132 L62 132 Q8 130 10 88Z" fill="none" stroke="#a5f3fc" strokeWidth="2.5" opacity=".55" />
    {[[14, 80, 7], [30, 70, 6], [50, 68, 5], [244, 69, 6], [264, 74, 7], [280, 96, 6], [276, 120, 7], [258, 134, 6], [36, 135, 6], [12, 118, 7], [6, 100, 5], [140, 136, 5], [196, 137, 6], [92, 137, 5]].map(([x, y, r], i) => (
      <g key={i}><ellipse cx={x} cy={y} rx={r * 1.25} ry={r} fill="#57534e" /><ellipse cx={x - r * .3} cy={y - r * .3} rx={r * .7} ry={r * .5} fill="#a8a29e" /></g>
    ))}
    {/* ═ ม่านน้ำตกหลัก — โค้งออกจากขอบผาแล้วบานลง ═ */}
    <path d="M106 15 Q146 10 184 15 Q190 48 196 90 L96 90 Q102 48 106 15Z" fill="url(#wf-curtain)" />
    <path d="M106 15 Q146 10 184 15 Q190 48 196 90 L96 90 Q102 48 106 15Z" fill="url(#wf-streak)" />
    <path d="M110 15 Q146 11 180 15 Q186 48 191 90 L101 90 Q106 48 110 15Z" fill="url(#wf-streak2)" />
    <path d="M106 15 Q146 10 184 15 Q190 48 196 90 L96 90 Q102 48 106 15Z" fill="url(#wf-depth)" />
    {/* ริมขอบผาที่น้ำม้วนตัวลง — แถบสว่าง */}
    <path d="M106 15 Q146 9 184 15" stroke="#f0f9ff" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    <path d="M108 17.5 Q146 12.5 182 17.5" stroke="#0369a1" strokeWidth="1" fill="none" opacity=".35" />

    {/* เงาสะท้อนม่านน้ำบนผิวน้ำ */}
    <path d="M102 86 L190 86 L184 112 L108 112Z" fill="url(#wf-streak2)" opacity=".35" />
    {/* ฟองน้ำขาวที่ตีนน้ำตก */}
    <ellipse cx="146" cy="88" rx="56" ry="9" fill="#f0f9ff" opacity=".9" />
    {[[104, 86, 9], [120, 90, 8], [138, 85, 10], [158, 90, 9], [176, 86, 10], [190, 89, 7], [112, 94, 6], [168, 95, 7], [146, 96, 8]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={i % 2 ? .75 : .95} />
    ))}
    {/* ฟองปั่นป่วน — เต้นเป็นจังหวะ */}
    {[[122, 86, 1.1], [152, 88, 1.4], [178, 87, 1.7]].map(([x, y, d], i) => (
      <circle key={i} cx={x} cy={y} r="6" fill="#fff">
        <animate attributeName="r" values="4;8;4" dur={`${d}s`} repeatCount="indefinite" />
      </circle>
    ))}
    {/* ไอน้ำฟุ้ง */}
    <ellipse cx="146" cy="78" rx="62" ry="16" fill="url(#wf-mist)" opacity=".7">
      <animate attributeName="opacity" values=".45;.8;.45" dur="4s" repeatCount="indefinite" />
    </ellipse>
    <ellipse cx="128" cy="70" rx="26" ry="10" fill="url(#wf-mist)" opacity=".5">
      <animateTransform attributeName="transform" type="translate" values="0 0;-6 -6;0 0" dur="5s" repeatCount="indefinite" />
    </ellipse>
    <ellipse cx="66" cy="66" rx="14" ry="6" fill="url(#wf-mist)" opacity=".6" />
    {/* วงน้ำกระเพื่อมออกจากตีนน้ำตก */}
    {[0, 1, 2].map(i => (
      <ellipse key={i} cx="146" cy="100" rx="40" ry="8" fill="none" stroke="#e0f2fe" strokeWidth="1.2">
        <animate attributeName="rx" values="40;110" dur="3.6s" begin={`${i * 1.2}s`} repeatCount="indefinite" />
        <animate attributeName="ry" values="8;26" dur="3.6s" begin={`${i * 1.2}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values=".8;0" dur="3.6s" begin={`${i * 1.2}s`} repeatCount="indefinite" />
      </ellipse>
    ))}
    {/* ประกายแสงบนผิวน้ำ */}
    {[[48, 104], [230, 108], [80, 122], [210, 124]].map(([x, y], i) => (
      <path key={i} d={`M${x} ${y} q5 -1.5 10 0`} stroke="#fff" strokeWidth="1" fill="none" opacity=".6" />
    ))}

    {/* ใบบัว (มีรอยแยก) + ดอกบัว */}
    {[[40, 100, 8], [250, 104, 9], [88, 124, 7], [226, 122, 6]].map(([x, y, r], i) => (
      <g key={i}>
        <ellipse cx={x + 1} cy={y + 1.5} rx={r} ry={r * .62} fill="#0c4a6e" opacity=".35" />
        <ellipse cx={x} cy={y} rx={r} ry={r * .62} fill="#16a34a" />
        <ellipse cx={x - r * .2} cy={y - r * .15} rx={r * .6} ry={r * .32} fill="#4ade80" opacity=".55" />
        <path d={`M${x} ${y} L${x + r} ${y - 2} L${x + r} ${y + 2}z`} fill="#0e7490" />
      </g>
    ))}
    <g transform="translate(250 99)">{[0, 60, 120, 180, 240, 300].map(a => <ellipse key={a} cx="0" cy="-3" rx="2" ry="4" fill="#f9a8d4" transform={`rotate(${a})`} />)}<circle r="1.6" fill="#fde047" /></g>
    {/* ปลาคาร์ฟ 3 ตัว */}
    <Koi path="M40 112 C 80 96, 140 126, 200 108 S 250 122, 230 114 S 120 130, 40 112" dur={16} color="#f97316" spot="#fff7ed" />
    <Koi path="M220 102 C 170 120, 110 98, 70 116 S 30 104, 60 102 S 180 94, 220 102" dur={19} color="#fafafa" spot="#ef4444" />
    <Koi path="M120 122 C 160 112, 200 126, 240 118 S 200 106, 160 112 S 90 128, 120 122" dur={13} color="#fbbf24" spot="#f97316" />
    {/* เป็ด 2 ตัว */}
    <Duck x={210} y={100} />
    <Duck x={64} y={96} flip />

    {/* เฟิร์นห้อยข้างผา + ต้นไม้ริมผา */}
    {[[94, 22, -1], [198, 20, 1], [40, 16, -1], [244, 14, 1]].map(([x, y, d], i) => (
      <g key={i}>
        {[0, 1, 2, 3].map(j => (
          <path key={j} d={`M${x} ${y} q${d * (6 + j * 3)} ${4 + j * 3} ${d * (4 + j * 4)} ${12 + j * 4}`} stroke={j % 2 ? '#16a34a' : '#15803d'} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ))}
      </g>
    ))}
    {[[16, 22], [76, 10], [214, 10], [272, 26], [8, 52], [280, 56]].map(([x, y], i) => (
      <g key={i}>
        <ellipse cx={x + 1} cy={y + 3} rx="12" ry="6" fill="#14532d" />
        <ellipse cx={x} cy={y} rx="11" ry="6" fill="#15803d" />
        <ellipse cx={x - 3} cy={y - 2} rx="6" ry="3" fill="#4ade80" opacity=".7" />
      </g>
    ))}
    {/* ดอกไม้ริมบ่อ */}
    {[[8, 104], [16, 124], [280, 108], [270, 128]].map(([x, y], i) => (
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
