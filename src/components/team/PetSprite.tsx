import { memo } from 'react'
import type { PetKind } from '../../utils/officeDecor'
import type { PetMode } from '../../utils/officePets'

// ── สัตว์เลี้ยง 2D (มองด้านข้าง หันขวา · หันซ้ายใช้ flip) — viewBox 32×28 ──
// walk = เด้งตัว ขาก้าว หางกระดิก · idle = ยืน หางกระดิก · sit = นั่ง · sleep = นอนขด หายใจ + z

const COL: Record<PetKind, { body: string; dark: string; light: string }> = {
  dog: { body: '#c98a4b', dark: '#8a5a2b', light: '#f3dcc0' },
  cat: { body: '#f0a24a', dark: '#b8661e', light: '#fde7c8' },
  rabbit: { body: '#f4f1ec', dark: '#c9c2b8', light: '#ffd6e0' },
}

const wag = (cx: number, cy: number, dur = '0.5s') => (
  <animateTransform attributeName="transform" type="rotate" values={`-14 ${cx} ${cy};16 ${cx} ${cy};-14 ${cx} ${cy}`} dur={dur} repeatCount="indefinite" />
)
const step = (phase: number) => (
  <animateTransform attributeName="transform" type="translate" values={phase ? '1.2 0;-1.2 0;1.2 0' : '-1.2 0;1.2 0;-1.2 0'} dur="0.32s" repeatCount="indefinite" />
)

function Standing({ kind, walk }: { kind: PetKind; walk: boolean }) {
  const c = COL[kind]
  const legs = (xs: number[], top: number, len: number) => xs.map((x, i) => (
    <rect key={i} x={x} y={top} width="2.4" height={len} rx="1.1" fill={i % 2 ? c.dark : c.body}>{walk && step(i % 2)}</rect>
  ))
  if (kind === 'rabbit') return (
    <g>
      {legs([9, 19], 20, 4)}
      <ellipse cx="14" cy="17" rx="8" ry="5.5" fill={c.body} />
      <circle cx="6" cy="15" r="2.4" fill="#fff" />
      <circle cx="22" cy="12" r="4.2" fill={c.body} />
      <g>{walk && wag(21, 9, '0.6s')}<ellipse cx="20.5" cy="4" rx="1.5" ry="5" fill={c.body} transform="rotate(-12 20.5 4)" /><ellipse cx="20.5" cy="4.3" rx=".7" ry="3.6" fill={c.light} transform="rotate(-12 20.5 4)" />
        <ellipse cx="23.5" cy="4.5" rx="1.5" ry="5" fill={c.body} transform="rotate(10 23.5 4.5)" /></g>
      <circle cx="24" cy="11.5" r=".8" fill="#1f2937" /><circle cx="26" cy="13" r=".7" fill="#f472b6" />
    </g>
  )
  if (kind === 'cat') return (
    <g>
      {legs([8, 11, 18, 21], 18, 6)}
      <g>{wag(6, 15, '1.1s')}<path d="M6 15 q-5 -3 -3 -11" stroke={c.body} strokeWidth="2.4" fill="none" strokeLinecap="round" /></g>
      <ellipse cx="15" cy="16" rx="9" ry="4.4" fill={c.body} />
      <path d="M10 13 q2 4 0 7 M14 12 q2 4 0 8 M18 12 q2 4 0 8" stroke={c.dark} strokeWidth="1" fill="none" opacity=".6" />
      <circle cx="24" cy="11" r="4" fill={c.body} />
      <path d="M21 8.5 l0.6 -4 l2.6 3 z M25.4 7.6 l2.4 -3.4 l0.4 4.2 z" fill={c.body} />
      <path d="M21.8 7.8 l0.4 -2.4 l1.5 1.8 z" fill={c.light} />
      <circle cx="25.6" cy="10.4" r=".8" fill="#14532d" /><circle cx="27.6" cy="12" r=".6" fill="#f472b6" />
      <path d="M27 12.6 h3 M27 13.4 l3 .6" stroke="#fff" strokeWidth=".4" />
    </g>
  )
  return (
    <g>
      {legs([8, 11, 18, 21], 17, 7)}
      <g>{wag(7, 13, '0.35s')}<path d="M7 13 q-4 -2 -4 -7" stroke={c.body} strokeWidth="2.6" fill="none" strokeLinecap="round" /></g>
      <ellipse cx="15" cy="15" rx="9" ry="4.8" fill={c.body} />
      <ellipse cx="15" cy="17.5" rx="6" ry="2" fill={c.light} />
      <circle cx="24" cy="10" r="4.4" fill={c.body} />
      <ellipse cx="28" cy="11.5" rx="2.6" ry="1.9" fill={c.light} /><circle cx="30" cy="11" r=".9" fill="#1f2937" />
      <path d="M21.5 7.5 q-2.5 1 -1.8 6" stroke={c.dark} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="25.2" cy="8.8" r=".8" fill="#1f2937" />
      <rect x="19.5" y="12.5" width="3" height="1.4" rx=".7" fill="#dc2626" />
    </g>
  )
}

function Sitting({ kind }: { kind: PetKind }) {
  const c = COL[kind]
  return (
    <g>
      <ellipse cx="15" cy="18" rx="6.5" ry="6" fill={c.body} />
      <rect x="17" y="18" width="2.4" height="6" rx="1.1" fill={c.body} /><rect x="20" y="18" width="2.4" height="6" rx="1.1" fill={c.dark} />
      <circle cx="19" cy="9" r="4.4" fill={c.body} />
      {kind === 'rabbit' && <><ellipse cx="17.5" cy="1.5" rx="1.5" ry="5" fill={c.body} /><ellipse cx="20.5" cy="1.8" rx="1.5" ry="5" fill={c.body} /></>}
      {kind === 'cat' && <path d="M16 6.5 l0.5 -4 l2.6 3 z M20.5 5.6 l2.4 -3.4 l0.4 4.2 z" fill={c.body} />}
      {kind === 'dog' && <path d="M16.5 6.5 q-2.5 1 -1.8 6" stroke={c.dark} strokeWidth="2.6" fill="none" strokeLinecap="round" />}
      <circle cx="20.8" cy="8.4" r=".8" fill="#1f2937" />
      <g>{wag(9, 22, kind === 'dog' ? '0.4s' : '1.4s')}<path d="M9 22 q-4 0 -5 -4" stroke={c.body} strokeWidth="2.4" fill="none" strokeLinecap="round" /></g>
    </g>
  )
}

function Sleeping({ kind }: { kind: PetKind }) {
  const c = COL[kind]
  return (
    <g>
      <g>
        <animateTransform attributeName="transform" type="scale" values="1 1;1.03 1.06;1 1" dur="2.6s" repeatCount="indefinite" additive="sum" />
        <ellipse cx="16" cy="19" rx="10" ry="5.5" fill={c.body} />
        <path d="M7 21 q9 5 18 -1" stroke={c.dark} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="22" cy="17" r="4" fill={c.body} />
        {kind === 'rabbit' && <ellipse cx="18" cy="14" rx="5" ry="1.5" fill={c.body} transform="rotate(-15 18 14)" />}
        {kind === 'cat' && <path d="M20 14 l0.5 -3 l2.2 2.4 z M23.6 13.6 l2 -2.6 l0.2 3.2 z" fill={c.body} />}
        {kind === 'dog' && <path d="M20 14.5 q-2 1 -1 4" stroke={c.dark} strokeWidth="2.2" fill="none" strokeLinecap="round" />}
        <path d="M22.5 17 q1 .8 2 0" stroke="#1f2937" strokeWidth=".7" fill="none" />
      </g>
      <text x="26" y="10" fontSize="6" fontWeight="700" fill="#6366f1" opacity=".8">z
        <animate attributeName="y" values="11;5;11" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;.9;0" dur="2.6s" repeatCount="indefinite" /></text>
    </g>
  )
}

export const PetSprite = memo(function PetSprite({ kind, mode, left, size = 26 }: { kind: PetKind; mode: PetMode; left: boolean; size?: number }) {
  return (
    <svg width={size} height={size * 28 / 32} viewBox="0 0 32 28" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <ellipse cx="16" cy="25.5" rx="10" ry="2" fill="#000" opacity=".18" />
      <g transform={left ? 'translate(32 0) scale(-1 1)' : undefined}>
        {mode === 'sleep' ? <Sleeping kind={kind} /> : mode === 'sit' ? <Sitting kind={kind} />
          : <g>{mode === 'walk' && <animateTransform attributeName="transform" type="translate" values="0 0;0 -1.6;0 0" dur="0.32s" repeatCount="indefinite" />}<Standing kind={kind} walk={mode === 'walk'} /></g>}
      </g>
    </svg>
  )
})
