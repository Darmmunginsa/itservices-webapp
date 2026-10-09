import type { ReactElement, ReactNode } from 'react'

// ── ต้นไม้ในผังออฟฟิศ — มองด้านข้าง (มุมตั้ง) พุ่มใหญ่ สูงล้นขึ้นไปช่องบนได้ ~2 ช่อง ──
// วาดในกรอบ x 0..36 · โคนต้นอยู่ที่ y≈33 (พื้นของช่อง) · ยอดสูงสุด y≈-34
// ใบไหวเบา ๆ ด้วย animateTransform (หมุนรอบโคน) — ให้ความรู้สึกมีลม มีชีวิต

const shadow = <ellipse cx="19" cy="33.5" rx="13" ry="3" fill="#000" opacity=".22" filter="url(#hd-blur)" />

/** กลุ่มใบไหว — หมุนไปมารอบจุด (cx,cy) */
const Sway = ({ cx, cy, deg = 2, dur = 4, children }: { cx: number; cy: number; deg?: number; dur?: number; children: ReactNode }) => (
  <g>
    {children}
    <animateTransform attributeName="transform" type="rotate" values={`${-deg} ${cx} ${cy};${deg} ${cx} ${cy};${-deg} ${cx} ${cy}`} dur={`${dur}s`} repeatCount="indefinite" />
  </g>
)

/** พุ่มใบเป็นก้อนเมฆ — หลายวงซ้อนกันหลายเฉด ให้ดูมีมิติ (มืดล่าง สว่างบนซ้าย) */
const Cloud = ({ blobs, dark, mid, light }: { blobs: [number, number, number][]; dark: string; mid: string; light: string }) => (
  <g>
    {blobs.map(([x, y, r], i) => <circle key={`d${i}`} cx={x + 1} cy={y + 1.5} r={r} fill={dark} />)}
    {blobs.map(([x, y, r], i) => <circle key={`m${i}`} cx={x} cy={y} r={r * 0.92} fill={mid} />)}
    {blobs.map(([x, y, r], i) => <circle key={`l${i}`} cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.42} fill={light} opacity=".75" />)}
  </g>
)

const pot = (color = '#c2410c', rim = '#ea580c', w = 16) => {
  const x = 18 - w / 2
  return <g><path d={`M${x} 24 h${w} l-2 9.5 h-${w - 4}z`} fill={color} /><rect x={x - 1} y="22.5" width={w + 2} height="3" rx="1.2" fill={rim} />
    <path d={`M${x + 2} 26 h2 l-1 6.5 h-1.5z`} fill="#fff" opacity=".18" /></g>
}

const ART: Record<string, ReactElement> = {
  // มอนสเตอร่า — ใบใหญ่ฉีกเป็นแฉก กางออกเป็นพุ่ม
  P: <g>{shadow}{pot()}
    <Sway cx={18} cy={23} deg={1.6} dur={5}>
      {([[-70, -14, '#14532d'], [-52, -18, '#166534'], [-35, -24, '#15803d'], [-18, -21, '#166534'], [-4, -28, '#16a34a'], [12, -22, '#15803d'], [26, -26, '#16a34a'], [44, -19, '#166534'], [60, -16, '#15803d'], [76, -11, '#14532d']] as [number, number, string][]).map(([a, h, c], i) => (
        <g key={i} transform={`rotate(${a} 18 23)`}>
          <path d={`M18 23 V${23 + h * 0.4}`} stroke="#14532d" strokeWidth="1.1" />
          <path d={`M18 ${23 + h * 0.35} q-11 ${h * 0.3} 0 ${h * 0.65} q11 ${-h * 0.35} 0 ${-h * 0.65}`} fill={c} />
          <path d={`M18 ${23 + h * 0.4} V${23 + h}`} stroke="#bbf7d0" strokeWidth=".5" opacity=".7" />
          <path d={`M14 ${23 + h * 0.6} l3 1 M14.5 ${23 + h * 0.8} l3 .6 M22 ${23 + h * 0.62} l-3 1`} stroke="#052e16" strokeWidth=".9" opacity=".45" />
        </g>
      ))}
    </Sway></g>,
  // ปาล์ม — ลำต้นเป็นปล้องโค้งนิด ๆ ทางใบแผ่ออกทุกทิศ
  G: <g>{shadow}{pot('#a16207', '#ca8a04', 14)}
    <path d="M18 24 q-1 -12 1.5 -26 l2 0 q-2 14 -1.5 26z" fill="#a16207" />
    {[20, 14, 8, 2, -4, -10, -16].map(y => <path key={y} d={`M17.4 ${y} h3.6`} stroke="#713f12" strokeWidth=".8" />)}
    <Sway cx={20} cy={-3} deg={3} dur={5}>
      {[-150, -120, -85, -55, -25, 10, 35].map((a, i) => (
        <g key={i} transform={`rotate(${a} 20 -3)`}>
          <path d="M20 -3 q10 -3 19 4" fill="none" stroke="#15803d" strokeWidth="1.3" />
          {[0, 1, 2, 3, 4, 5].map(j => <path key={j} d={`M${22 + j * 3} ${-3.5 + j * 0.6} l1.5 4 M${22 + j * 3} ${-3.5 + j * 0.6} l2 -3`} stroke={j % 2 ? '#22c55e' : '#16a34a'} strokeWidth="1.4" strokeLinecap="round" />)}
        </g>
      ))}
      <circle cx="19" cy="-1" r="1.6" fill="#a16207" /><circle cx="21.5" cy="-.5" r="1.5" fill="#92400e" />
    </Sway></g>,
  // ไผ่ — หลายลำ มีข้อ ใบเรียวเป็นช่อ
  Y: <g>{shadow}<rect x="8" y="27" width="20" height="6.5" rx="1.5" fill="#57534e" /><rect x="7.5" y="26" width="21" height="2" rx="1" fill="#78716c" />
    {([[12, -30, '#65a30d'], [16, -34, '#4d7c0f'], [20, -26, '#65a30d'], [24, -31, '#4d7c0f']] as [number, number, string][]).map(([x, top, c], i) => (
      <Sway key={i} cx={x} cy={27} deg={1.5 + i * 0.3} dur={4 + i * 0.6}>
        <rect x={x - 1.2} y={top} width="2.4" height={27 - top} rx="1" fill={c} />
        {Array.from({ length: Math.floor((27 - top) / 7) }, (_, j) => <rect key={j} x={x - 1.5} y={27 - (j + 1) * 7} width="3" height="1.1" rx=".5" fill="#365314" />)}
        {[top + 3, top + 11, top + 19].map((ly, j) => (
          <g key={j} transform={`rotate(${j % 2 ? 35 : -35} ${x} ${ly})`}>
            <path d={`M${x} ${ly} q${j % 2 ? 6 : -6} -1 ${j % 2 ? 9 : -9} 2 q${j % 2 ? -5 : 5} 0 ${j % 2 ? -9 : 9} -2`} fill="#84cc16" />
            <path d={`M${x} ${ly + 1} q${j % 2 ? 5 : -5} 1 ${j % 2 ? 7 : -7} 4`} stroke="#65a30d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </Sway>
    ))}</g>,
  // ไทรใบสัก — ลำต้นเรียว ใบใหญ่รูปไวโอลินซ้อนเป็นชั้นขึ้นไป
  L: <g>{shadow}{pot('#e7e5e4', '#d6d3d1', 15)}
    <path d="M18 24 q-1.5 -14 0.5 -30" stroke="#78350f" strokeWidth="1.8" fill="none" />
    <Sway cx={18} cy={20} deg={1.4} dur={6}>
      {([[18, 15, -50], [17, 12, 45], [18.5, 7, -35], [17.5, 4, 40], [18, -1, -45], [18.5, -4, 30], [17.5, -9, -30], [18.5, -12, 42], [18, -17, -20], [18, -20, 22], [18, -24, 0]] as [number, number, number][]).map(([x, y, a], i) => (
        <g key={i} transform={`rotate(${a} ${x} ${y}) translate(${x} ${y}) scale(1.35) translate(${-x} ${-y})`}>
          <path d={`M${x} ${y} c-6 -2 -7 -9 -3 -11 c2 -1 3 1 3 1 c0 0 1 -2 3 -1 c4 2 3 9 -3 11z`} fill={['#14532d', '#166534', '#15803d'][i % 3]} />
          <path d={`M${x} ${y} v-10`} stroke="#86efac" strokeWidth=".5" opacity=".6" />
        </g>
      ))}
    </Sway></g>,
  // เฟื่องฟ้า — พุ่มกลมใหญ่ ดอกชมพูบานแน่นทั้งพุ่ม
  R: <g>{shadow}{pot('#9a3412', '#c2410c', 18)}
    <Sway cx={18} cy={22} deg={1.2} dur={5}>
      <Cloud dark="#14532d" mid="#15803d" light="#4ade80" blobs={[[10, 14, 7], [18, 9, 8], [26, 14, 7], [14, 3, 6], [23, 3, 6], [18, -3, 5.5], [18, 17, 7]]} />
      {[[8, 11], [12, 6], [16, 13], [21, 7], [26, 10], [29, 15], [11, 17], [24, 17], [17, 1], [22, -2], [14, -1], [19, 16], [27, 4], [9, 4]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="2.2" fill={i % 3 ? '#db2777' : '#f472b6'} /><circle cx={x - .6} cy={y - .6} r=".9" fill="#fbcfe8" /></g>
      ))}
    </Sway></g>,
  // กระบองเพชรยักษ์ (ซากัวโร) — ลำสูง มีแขน มีหนามเป็นจุด
  U: <g>{shadow}<path d="M9 26 h18 l-1.5 7.5 h-15z" fill="#d97706" /><rect x="8" y="24.5" width="20" height="2.5" rx="1" fill="#fbbf24" />
    <rect x="14.5" y="-24" width="7" height="50" rx="3.5" fill="#15803d" />
    <path d="M14.5 6 h-4 a3 3 0 0 1 -3 -3 v-12 a3 3 0 0 1 6 0 v9 h1" fill="#16a34a" />
    <path d="M21.5 -2 h3.5 a3 3 0 0 0 3 -3 v-10 a3 3 0 0 0 -6 0 v7 h-.5" fill="#15803d" />
    {[16, 18, 20].map(x => <path key={x} d={`M${x} -22 V24`} stroke="#14532d" strokeWidth=".6" opacity=".6" />)}
    {[-18, -10, -2, 6, 14].map(y => <g key={y}><circle cx="15.5" cy={y} r=".5" fill="#fef9c3" /><circle cx="20.5" cy={y + 4} r=".5" fill="#fef9c3" /></g>)}
    <circle cx="18" cy="-24.5" r="2" fill="#f472b6" /><circle cx="18" cy="-24.5" r=".8" fill="#fde047" /></g>,
  // บอนไซ — กระถางถาดเตี้ย ลำต้นบิดเกลียว พุ่มใบเป็นแพ ๆ
  Z: <g>{shadow}<rect x="4" y="27" width="28" height="5.5" rx="1" fill="#1e3a8a" /><rect x="3" y="26" width="30" height="2.2" rx="1" fill="#1d4ed8" />
    <rect x="6" y="25" width="24" height="2" rx="1" fill="#57534e" />
    <path d="M17 26 q-4 -6 1 -10 q5 -4 1 -9 q-2 -3 3 -6" stroke="#78350f" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M18 16 q5 -1 9 -4" stroke="#78350f" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <Sway cx={18} cy={20} deg={.8} dur={7}>
      <Cloud dark="#14532d" mid="#166534" light="#22c55e" blobs={[[8, 9, 4.5], [12, 7, 4], [27, 10, 4.5], [30, 9, 3.5], [21, -2, 5], [25, -3, 4], [17, -1, 3.5]]} />
    </Sway></g>,
  // สน — ชั้นใบสามเหลี่ยมซ้อนกัน ปลายแหลม
  N: <g>{shadow}{pot('#7c2d12', '#9a3412', 12)}
    <rect x="16.8" y="16" width="2.4" height="9" fill="#78350f" />
    <Sway cx={18} cy={20} deg={1} dur={6}>
      {([[18, 4, 15, '#14532d'], [12, -6, 12.5, '#166534'], [1, -15, 10, '#15803d'], [-9, -24, 7, '#16a34a']] as [number, number, number, string][]).map(([base, top, half, c], i) => (
        <g key={i}><path d={`M${18 - half} ${base + 14} L18 ${top} L${18 + half} ${base + 14}z`} fill={c} />
          <path d={`M18 ${top} L${18 + half} ${base + 14} L${18 + half * 0.4} ${base + 14}z`} fill="#000" opacity=".15" />
          <path d={`M${18 - half * 0.7} ${base + 12} q${half * 0.7} 2 ${half * 1.4} 0`} stroke="#bbf7d0" strokeWidth=".6" fill="none" opacity=".5" /></g>
      ))}
      <path d="M18 -29 l1 2.2 h2.3 l-1.9 1.4 l.7 2.3 l-2.1 -1.4 l-2.1 1.4 l.7 -2.3 l-1.9 -1.4 h2.3z" fill="#facc15" />
    </Sway></g>,
  // ลีลาวดี — กิ่งแตกเป็นง่ามอวบ ๆ ปลายกิ่งมีช่อใบกับดอกขาวเหลือง
  J: <g>{shadow}<ellipse cx="18" cy="32" rx="9" ry="2.5" fill="#57534e" />
    <path d="M18 32 V12 M18 18 q-6 -3 -8 -12 M18 15 q6 -3 7 -13 M18 12 q-1 -8 1 -16" stroke="#a8a29e" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    <path d="M18 32 V12 M18 18 q-6 -3 -8 -12 M18 15 q6 -3 7 -13 M18 12 q-1 -8 1 -16" stroke="#d6d3d1" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity=".6" />
    <Sway cx={18} cy={14} deg={1.6} dur={5}>
      {([[10, -6], [25, -2], [19, -4.5]] as [number, number][]).map(([x, y], i) => (
        <g key={i}>
          {[-100, -70, -45, -20, 0, 20, 45, 70, 100].map(a => <ellipse key={a} cx={x} cy={y - 6} rx="2.6" ry="7" fill={Math.abs(a) < 30 ? '#16a34a' : Math.abs(a) < 60 ? '#15803d' : '#166534'} transform={`rotate(${a} ${x} ${y})`} />)}
          {[[-2.5, -3], [2, -4], [0, -.5]].map(([dx, dy], j) => (
            <g key={j} transform={`translate(${x + dx} ${y + dy})`}>
              {[0, 72, 144, 216, 288].map(r => <ellipse key={r} cx="0" cy="-1.6" rx="1.1" ry="1.8" fill="#fefce8" transform={`rotate(${r})`} />)}
              <circle r=".9" fill="#facc15" />
            </g>
          ))}
        </g>
      ))}
    </Sway></g>,
}

/** ต้นไม้ 1 ต้น (ใช้ใน <svg viewBox="0 0 36 36"> ของช่อง — ล้นขึ้นไปช่องบนได้) */
export function PlantArt({ ch }: { ch: string }) {
  // ขยาย 1.5 เท่ารอบโคนต้น (18,33) — พุ่มใหญ่ล้นขึ้นช่องบนและกว้างออกข้าง แต่โคนยังอยู่ในช่องของตัวเอง
  return <g transform="translate(18 33) scale(1.5) translate(-18 -33)">{ART[ch] ?? ART.P}</g>
}
