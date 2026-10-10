import { memo, type ReactElement } from 'react'
import { shade, type Avatar, type Facing } from '../../utils/officeAvatar'

// ── ตัวละครแบบ Gather (หัวโตน่ารัก มุม 3/4 เดียวกับออฟฟิศ) ──
// viewBox 40×52 · หันได้ 4 ทิศ (ซ้าย = กลับด้านของขวา) · เดินแล้วแกว่งแขนขา ตัวเด้งตามจังหวะ

interface Props { a: Avatar; facing?: Facing; moving?: boolean; size?: number
  /** นั่งห้อยขา (บนม้านั่ง/โซฟา) — ขาสั้นลงแกว่งช้า ๆ ไม่มีเงาที่พื้น */
  sitting?: boolean }

const HEAD = { cx: 20, cy: 15, r: 11 }

/** ผมชั้นหลัง (อยู่หลังหัว) */
function hairBack(a: Avatar, up: boolean): ReactElement | null {
  const c = a.hairColor, d = shade(c, -0.25)
  switch (a.hair) {
    case 'long': return <path d="M7 14 Q7 2 20 2 Q33 2 33 14 L34 33 Q30 36 27 31 L13 31 Q10 36 6 33Z" fill={d} />
    case 'bob': return <path d="M7 14 Q7 2 20 2 Q33 2 33 14 L33 24 Q30 27 27 23 L13 23 Q10 27 7 24Z" fill={d} />
    case 'pony': return <g><ellipse cx={up ? 20 : 31} cy={up ? 27 : 21} rx="3.4" ry="8" fill={d} transform={up ? undefined : 'rotate(-12 31 21)'} /></g>
    case 'twin': return <g><circle cx="6.5" cy="21" r="4.2" fill={d} /><circle cx="33.5" cy="21" r="4.2" fill={d} /></g>
    default: return null
  }
}

/** ผมชั้นหน้า (หน้าม้า/ทรง) — มองจากหลัง = ผมคลุมทั้งหัว */
function hairFront(a: Avatar, up: boolean): ReactElement | null {
  const c = a.hairColor, hi = shade(c, 0.25)
  if (a.hair === 'bald') return <ellipse cx="16" cy="7.5" rx="3.5" ry="1.8" fill="#fff" opacity=".35" />
  if (up) {
    return (
      <g>
        <circle cx="20" cy="14.5" r="11.4" fill={c} />
        {a.hair === 'bun' && <circle cx="20" cy="3" r="4.5" fill={c} />}
        {a.hair === 'mohawk' && <rect x="17" y="-1" width="6" height="22" rx="3" fill={shade(c, -0.15)} />}
        {a.hair === 'curly' && [0, 1, 2, 3, 4, 5, 6].map(i => <circle key={i} cx={10 + i * 3.3} cy={6 + Math.abs(3 - i) * 1.4} r="3.6" fill={c} />)}
        <path d="M12 9 Q20 5 28 9" stroke={hi} strokeWidth="1.2" fill="none" opacity=".6" />
      </g>
    )
  }
  switch (a.hair) {
    case 'spiky': return <path d="M9 15 L9.5 6 L13 8 L14.5 1.5 L18 6 L20 0.5 L22.5 6 L26 1.5 L27 8 L30.5 6 L31 15 Q27 9 20 9.5 Q13 9 9 15Z" fill={c} />
    case 'side': return <g><path d="M8.6 17 Q7.5 3 21 3 Q32.5 3.5 31.4 17 Q30 8.5 24 8 Q16 11 8.6 17Z" fill={c} /><path d="M14 6 Q20 3.5 27 5.5" stroke={hi} strokeWidth="1" fill="none" opacity=".7" /></g>
    case 'bob': case 'long': case 'twin':
      return <g><path d="M8.6 15 Q8.6 3.5 20 3.5 Q31.4 3.5 31.4 15 Q27 9.5 20 10.5 Q13 9.5 8.6 15Z" fill={c} /><path d="M13 6 Q20 4 27 6" stroke={hi} strokeWidth="1" fill="none" opacity=".6" /></g>
    case 'curly': return <g>{[[10, 9], [13, 5.5], [17, 3.5], [21, 3], [25, 4], [28.5, 6.5], [31, 10], [9, 13], [31.5, 14]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={c} />)}</g>
    case 'mohawk': return <g><path d="M9.5 14 Q10 6 20 6 Q30 6 30.5 14 Q26 10 20 10 Q14 10 9.5 14Z" fill={shade(c, -0.35)} opacity=".45" /><path d="M17 11 L16.5 -1 Q20 -3 23.5 -1 L23 11Z" fill={c} /></g>
    case 'bun': return <g><circle cx="20" cy="2.8" r="4.6" fill={c} /><path d="M8.8 15 Q8.8 3.5 20 3.5 Q31.2 3.5 31.2 15 Q28 9 20 9 Q12 9 8.8 15Z" fill={c} /></g>
    case 'pony':
    case 'short':
    default:
      return <g><path d="M8.8 15 Q8.8 3.2 20 3.2 Q31.2 3.2 31.2 15 Q28.5 8.8 20 8.8 Q11.5 8.8 8.8 15Z" fill={c} /><path d="M13 6 Q20 4 27 6" stroke={hi} strokeWidth="1" fill="none" opacity=".6" /></g>
  }
}

/** หน้า — side = หันข้าง (ตาเดียว เลื่อนไปทางที่หัน) */
function face(a: Avatar, side: boolean): ReactElement {
  const sx = side ? 3.5 : 0
  const eye = (x: number) => <g><ellipse cx={x} cy="16.5" rx="1.5" ry="2" fill="#1f2937" /><circle cx={x + .5} cy="15.7" r=".55" fill="#fff" /></g>
  const eyes = a.face === 'wink'
    ? <g>{!side && <path d="M14.5 16.8 q1.5 -1.4 3 0" stroke="#1f2937" strokeWidth="1.1" fill="none" strokeLinecap="round" />}{eye(24 + sx * .3)}</g>
    : a.face === 'cool'
      ? <g>{!side && <path d="M14.5 16.5 h3" stroke="#1f2937" strokeWidth="1.4" strokeLinecap="round" />}<path d={`M${22.5 + sx * .3} 16.5 h3`} stroke="#1f2937" strokeWidth="1.4" strokeLinecap="round" /></g>
      : <g>{!side && eye(16)}{eye(24 + sx * .3)}</g>
  const mx = 20 + sx
  const mouth = {
    smile: <path d={`M${mx - 2.2} 21 q2.2 2 4.4 0`} stroke="#9a3412" strokeWidth="1" fill="none" strokeLinecap="round" />,
    grin: <path d={`M${mx - 2.8} 20.4 q2.8 3.6 5.6 0z`} fill="#9a3412" />,
    calm: <path d={`M${mx - 1.6} 21.4 h3.2`} stroke="#9a3412" strokeWidth="1" strokeLinecap="round" />,
    wink: <path d={`M${mx - 2.2} 21 q2.2 2 4.4 0`} stroke="#9a3412" strokeWidth="1" fill="none" strokeLinecap="round" />,
    cat: <path d={`M${mx - 2.4} 20.8 q1.2 1.4 2.4 0 q1.2 1.4 2.4 0`} stroke="#9a3412" strokeWidth=".9" fill="none" strokeLinecap="round" />,
    cool: <path d={`M${mx - 2} 21.2 q2.4 1 4 -.6`} stroke="#9a3412" strokeWidth="1" fill="none" strokeLinecap="round" />,
  }[a.face]
  return (
    <g>
      {eyes}
      <ellipse cx={side ? 26 : 13.5} cy="19.5" rx="2" ry="1.2" fill="#fb7185" opacity=".35" />
      {!side && <ellipse cx="26.5" cy="19.5" rx="2" ry="1.2" fill="#fb7185" opacity=".35" />}
      {mouth}
    </g>
  )
}

function accessory(a: Avatar, view: 'front' | 'side' | 'up'): ReactElement | null {
  const sx = view === 'side' ? 3.5 : 0
  switch (a.acc) {
    case 'glasses': return view === 'up' ? null : <g fill="none" stroke="#1f2937" strokeWidth=".9">{view === 'front' && <circle cx="16" cy="16.5" r="3" />}<circle cx={24 + sx * .3} cy="16.5" r="3" />{view === 'front' && <path d="M19 16.3 h2" />}</g>
    case 'sunglasses': return view === 'up' ? null : <g fill="#111827">{view === 'front' && <rect x="12.6" y="14.6" width="6.4" height="4" rx="1.6" />}<rect x={21 + sx * .3} y="14.6" width="6.4" height="4" rx="1.6" />{view === 'front' && <path d="M19 16 h2" stroke="#111827" strokeWidth="1" />}<path d={`M${22 + sx * .3} 15.4 l1.5 1`} stroke="#fff" strokeWidth=".6" opacity=".6" /></g>
    case 'headphones': return <g><path d="M8.5 16 Q8 2.5 20 2.5 Q32 2.5 31.5 16" stroke="#374151" strokeWidth="2.4" fill="none" />{view !== 'side' && <rect x="6" y="13" width="4.5" height="7" rx="2" fill="#ef4444" />}<rect x={view === 'side' ? 15 : 29.5} y="13" width="4.5" height="7" rx="2" fill="#ef4444" /></g>
    case 'cap': return <g><path d="M8.6 12 Q9 2 20 2 Q31 2 31.4 12Z" fill="#dc2626" />{view !== 'up' && <ellipse cx={20 + sx * 2} cy="12" rx={view === 'side' ? 8 : 12.5} ry="2.4" fill="#b91c1c" />}<circle cx="20" cy="2.4" r="1.2" fill="#b91c1c" /></g>
    case 'beanie': return <g><path d="M8.6 11 Q9 1 20 1 Q31 1 31.4 11Z" fill="#7c3aed" /><rect x="8" y="9" width="24" height="4" rx="2" fill="#6d28d9" /><circle cx="20" cy="0" r="2.6" fill="#ede9fe" /></g>
    case 'flower': return view === 'up' ? null : <g transform={`translate(${view === 'side' ? 15 : 29} 9)`}>{[0, 72, 144, 216, 288].map(r => <ellipse key={r} cx="0" cy="-2.2" rx="1.6" ry="2.4" fill="#f9a8d4" transform={`rotate(${r})`} />)}<circle r="1.4" fill="#fde047" /></g>
    case 'bow': return <g transform="translate(27 4)"><path d="M0 0 l-4.5 -3 v6z M0 0 l4.5 -3 v6z" fill="#ec4899" /><circle r="1.4" fill="#be185d" /></g>
    case 'crown': return <g><path d="M12 5 L13.5 -2 L17 2.5 L20 -3.5 L23 2.5 L26.5 -2 L28 5 Z" fill="#facc15" stroke="#ca8a04" strokeWidth=".6" /><circle cx="20" cy="2" r="1.1" fill="#ef4444" /><circle cx="14.5" cy="3" r=".8" fill="#3b82f6" /><circle cx="25.5" cy="3" r=".8" fill="#22c55e" /></g>
    case 'halo': return <ellipse className="hd-av-halo" cx="20" cy="-2.5" rx="8" ry="2.2" fill="none" stroke="#fde047" strokeWidth="1.6" />
    case 'helmet': return <g><path d="M8.4 12 Q8.4 0.5 20 0.5 Q31.6 0.5 31.6 12Z" fill="#facc15" /><rect x="6.5" y="10.6" width="27" height="2.8" rx="1.4" fill="#eab308" /><rect x="18.6" y="0.5" width="2.8" height="11" fill="#fde047" /></g>
    case 'catears': return <g fill={a.hairColor}><path d="M9.5 9 L10 -1 L17 5Z" /><path d="M30.5 9 L30 -1 L23 5Z" /><path d="M11 6.5 L11.3 1.5 L14.8 4.5Z" fill="#f9a8d4" /><path d="M29 6.5 L28.7 1.5 L25.2 4.5Z" fill="#f9a8d4" /></g>
    default: return null
  }
}

/** เสื้อ (ลำตัว x11–29, y24–37) */
function top(a: Avatar, up: boolean): ReactElement {
  const c = a.topColor, dk = shade(c, -0.2), lt = shade(c, 0.3)
  const body = <rect x="11" y="24" width="18" height="14" rx="5" fill={c} />
  const shine = <path d="M13.5 26.5 q2 -1 4 -1" stroke={lt} strokeWidth="1.2" fill="none" opacity=".6" strokeLinecap="round" />
  if (up) {
    if (a.top === 'hoodie') return <g>{body}<path d="M13 24 Q20 32 27 24 Q20 21 13 24Z" fill={dk} /></g>
    if (a.top === 'dress') return <path d="M12 24 h16 l4 17 h-24z" fill={c} />
    if (a.top === 'lab') return <path d="M11 24 h18 l1.5 16 h-21z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".6" />
    return body
  }
  switch (a.top) {
    case 'hoodie': return <g>{body}<path d="M14 23.5 Q20 28 26 23.5" stroke={dk} strokeWidth="2.4" fill="none" /><path d="M18.5 26 v4 M21.5 26 v4" stroke="#f8fafc" strokeWidth=".7" /><rect x="15" y="31" width="10" height="4.5" rx="2" fill={dk} /></g>
    case 'shirt': return <g>{body}<path d="M16 24 l4 4 l4 -4" fill="#f8fafc" /><path d="M20 28 v9" stroke={dk} strokeWidth=".7" />{[30, 33, 36].map(y => <circle key={y} cx="20" cy={y} r=".55" fill={dk} />)}{shine}</g>
    case 'suit': return <g>{body}<path d="M16.5 24 L20 31 L23.5 24Z" fill="#f8fafc" /><path d="M19.2 25.5 h1.6 l.8 7 l-1.6 2 l-1.6 -2z" fill="#dc2626" /><path d="M16.5 24 L20 31 M23.5 24 L20 31" stroke={dk} strokeWidth="1" /></g>
    case 'polo': return <g>{body}<path d="M16 24 l2 3 h4 l2 -3" fill={lt} /><path d="M20 27 v3" stroke={dk} strokeWidth=".7" /><circle cx="25" cy="28.5" r="1.3" fill="#fff" opacity=".85" />{shine}</g>
    case 'stripe': return <g>{body}{[27, 30.5, 34].map(y => <rect key={y} x="11" y={y} width="18" height="1.6" fill="#f8fafc" opacity=".85" />)}</g>
    case 'dress': return <g><path d="M12.5 24 h15 l4.5 17 h-24z" fill={c} /><path d="M12.5 30 h15" stroke={dk} strokeWidth="1.4" /><path d="M14 33 l-2 7 M20 33 v8 M26 33 l2 7" stroke={dk} strokeWidth=".6" opacity=".6" /></g>
    case 'lab': return <g><path d="M11 24 h18 l1.5 16 h-21z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".6" /><path d="M17 24 L20 30 L23 24Z" fill={c} /><path d="M20 30 v10" stroke="#cbd5e1" strokeWidth=".7" /><rect x="22" y="31" width="4" height="3" rx=".6" fill="none" stroke="#cbd5e1" strokeWidth=".6" /><path d="M23 30.4 v1.6" stroke="#3b82f6" strokeWidth=".8" /></g>
    case 'tee':
    default: return <g>{body}<path d="M16.5 24 q3.5 3 7 0" fill={a.skin} />{shine}</g>
  }
}

const sleeveLong = (t: Avatar['top']) => t === 'hoodie' || t === 'shirt' || t === 'suit' || t === 'lab'

function AvatarSpriteBase({ a, facing = 'down', moving = false, size = 36, sitting = false }: Props) {
  const up = facing === 'up', side = facing === 'left' || facing === 'right'
  const view = up ? 'up' : side ? 'side' : 'front'
  const skinDk = shade(a.skin, -0.12)
  const sleeve = a.top === 'lab' ? '#f8fafc' : a.topColor
  const long = sleeveLong(a.top)
  const bc = a.bottomColor
  const legs = a.bottom === 'shorts' || a.bottom === 'skirt' || a.top === 'dress' ? a.skin : bc
  const arm = (x: number, cls: string) => (
    <g className={moving ? cls : undefined} style={{ transformOrigin: `${x + 1.6}px 25px` }}>
      <rect x={x} y="24.5" width="3.4" height={long ? 10 : 5.5} rx="1.7" fill={sleeve} />
      {!long && <rect x={x + .3} y="29" width="2.8" height="5.5" rx="1.4" fill={a.skin} />}
      <circle cx={x + 1.7} cy="35" r="1.9" fill={a.skin} />
    </g>
  )
  return (
    <svg viewBox="0 0 40 52" width={size} height={size * 1.3} overflow="visible" aria-hidden="true"
      style={facing === 'left' ? { transform: 'scaleX(-1)' } : undefined}>
      {!sitting && <ellipse cx="20" cy="49" rx="10" ry="2.6" fill="#000" opacity=".2" />}
      <g className={moving && !sitting ? 'hd-av-bob' : undefined}>
        {/* ขา + กางเกง/กระโปรง */}
        <g className={sitting ? 'hd-av-dangleL' : moving ? 'hd-av-legL' : undefined} style={{ transformOrigin: '16.5px 37px' }}>
          <rect x="14.5" y="36" width="4.5" height={sitting ? 7 : 10} rx="2" fill={legs} />
          {a.bottom === 'jeans' && <path d={`M16.8 37 v${sitting ? 5 : 8}`} stroke={shade(bc, 0.35)} strokeWidth=".5" />}
          <ellipse cx="16.6" cy={sitting ? 43.4 : 46.6} rx="3.2" ry="1.8" fill={a.shoes} />
        </g>
        <g className={sitting ? 'hd-av-dangleR' : moving ? 'hd-av-legR' : undefined} style={{ transformOrigin: '23.5px 37px' }}>
          <rect x="21" y="36" width="4.5" height={sitting ? 7 : 10} rx="2" fill={legs} />
          {a.bottom === 'jeans' && <path d={`M23.2 37 v${sitting ? 5 : 8}`} stroke={shade(bc, 0.35)} strokeWidth=".5" />}
          <ellipse cx="23.4" cy={sitting ? 43.4 : 46.6} rx="3.2" ry="1.8" fill={a.shoes} />
        </g>
        {a.top !== 'dress' && a.bottom === 'shorts' && <path d="M13 35 h14 v5 h-6 l-1 -2 l-1 2 h-6z" fill={bc} />}
        {a.top !== 'dress' && a.bottom === 'skirt' && <path d="M12.5 34 h15 l2.5 7.5 h-20z" fill={bc} />}
        {a.top !== 'dress' && (a.bottom === 'pants' || a.bottom === 'jeans') && <rect x="13" y="34" width="14" height="4" rx="1.5" fill={bc} />}
        {/* แขนหลัง → ตัว → แขนหน้า */}
        {!side && arm(8, sitting ? '' : 'hd-av-armL')}
        {top(a, up)}
        {side ? arm(18.5, sitting ? '' : 'hd-av-armL') : arm(28.6, sitting ? '' : 'hd-av-armR')}
        {/* คอ + หัว */}
        <rect x="17.5" y="22" width="5" height="3.5" fill={skinDk} />
        {hairBack(a, up)}
        {!side && <><circle cx="8.6" cy="16.5" r="2.4" fill={skinDk} /><circle cx="31.4" cy="16.5" r="2.4" fill={skinDk} /></>}
        {side && <circle cx="15" cy="16.5" r="2.4" fill={skinDk} />}
        <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill={a.skin} />
        <ellipse cx="16" cy="10" rx="5" ry="3" fill="#fff" opacity=".18" />
        {!up && face(a, side)}
        {hairFront(a, up)}
        {accessory(a, view)}
      </g>
    </svg>
  )
}

export const AvatarSprite = memo(AvatarSpriteBase)
