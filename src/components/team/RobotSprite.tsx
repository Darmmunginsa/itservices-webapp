// หุ่นยนต์ทำความสะอาด (ยืนถือไม้กวาด) + แท่นชาร์จ — หันขวาเป็นค่าเริ่มต้น

/** หุ่นยนต์ยืนถือไม้กวาด (มุมมอง 3/4 เหมือนคน) — หันขวาเป็นค่าเริ่มต้น · เดินเด้งเบา ๆ · ไม้กวาดปัดไปมา · ฝุ่นฟุ้ง */
export type RobotHolding = 'broom' | 'cup' | 'none'

export function RobotSprite({ size = 34, holding = 'broom' }: { size?: number; holding?: RobotHolding }) {
  return (
    <svg viewBox="0 0 40 44" width={size} height={size * 1.1} aria-hidden="true" overflow="visible">
      <ellipse cx="20" cy="41" rx="11" ry="2.6" fill="#000" opacity=".2" />
      {/* ฝุ่นที่ถูกกวาด */}
      {holding === 'broom' && <g className="hd-robot-dust">
        <circle cx="33" cy="39" r="1.6" fill="#a8a29e" /><circle cx="36" cy="37" r="1.1" fill="#d6d3d1" /><circle cx="31" cy="36.5" r=".9" fill="#a8a29e" />
      </g>}
      <g className="hd-robot-walk">
        {/* ขา */}
        <rect x="14" y="31" width="4" height="8" rx="1.5" fill="#64748b" className="hd-robot-legL" />
        <rect x="22" y="31" width="4" height="8" rx="1.5" fill="#475569" className="hd-robot-legR" />
        <rect x="13" y="37.5" width="6" height="2.5" rx="1" fill="#334155" /><rect x="21" y="37.5" width="6" height="2.5" rx="1" fill="#1e293b" />
        {/* ลำตัว */}
        <rect x="11" y="18" width="18" height="15" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth=".8" />
        <rect x="14" y="21.5" width="9" height="6" rx="1.5" fill="#0ea5e9" opacity=".85" />
        <circle cx="25.5" cy="23" r="1.2" fill="#f59e0b" /><circle cx="25.5" cy="27" r="1.2" fill="#22c55e" />
        {/* หัว */}
        <rect x="12" y="5" width="17" height="13" rx="5" fill="#f1f5f9" stroke="#94a3b8" strokeWidth=".8" />
        <rect x="16" y="8.5" width="12" height="6" rx="3" fill="#1e293b" />
        <circle cx="20" cy="11.5" r="1.4" fill="#67e8f9" className="hd-robot-led" /><circle cx="25" cy="11.5" r="1.4" fill="#67e8f9" className="hd-robot-led" />
        <line x1="20" y1="5" x2="20" y2="1.5" stroke="#94a3b8" strokeWidth="1" /><circle cx="20" cy="1.3" r="1.4" fill="#ef4444" className="hd-robot-led" />
        {/* แขน + ไม้กวาด (ปัดไปมาจากไหล่) */}
        {holding === 'broom' && <g className="hd-robot-broom" style={{ transformOrigin: '24px 22px' }}>
          <line x1="24" y1="22" x2="35" y2="38" stroke="#a16207" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M31 37 L38.5 34.5 L41 40.5 L33 42.5 Z" fill="#facc15" stroke="#ca8a04" strokeWidth=".7" />
          <path d="M34 37.5 l2 4.5 M36.5 36.5 l2 4.6" stroke="#ca8a04" strokeWidth=".6" />
          <rect x="22" y="20" width="9" height="4" rx="2" fill="#cbd5e1" transform="rotate(50 24 22)" />
          <circle cx="29" cy="28" r="2" fill="#94a3b8" />
        </g>}
        {/* ถือแก้วกาแฟยื่นไปข้างหน้า มีไอร้อนลอย */}
        {holding === 'cup' && <g>
          <rect x="24" y="21" width="10" height="3.6" rx="1.8" fill="#cbd5e1" />
          <path d="M31 17 h6 l-.8 6.5 h-4.4z" fill="#fff" stroke="#94a3b8" strokeWidth=".6" />
          <rect x="31" y="18.6" width="6" height="2" fill="#92400e" />
          <path d="M37 19 q2.2 .8 0 3" stroke="#94a3b8" strokeWidth=".8" fill="none" />
          <path className="hd-robot-steam" d="M33 15.5 q-1 -1.5 0 -3 M35.5 15.5 q1 -1.5 0 -3" stroke="#cbd5e1" strokeWidth=".8" fill="none" strokeLinecap="round" />
        </g>}
        {holding === 'none' && <rect x="23" y="20" width="9" height="4" rx="2" fill="#cbd5e1" transform="rotate(-25 24 22)" />}
      </g>
    </svg>
  )
}

export function RobotDock({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} aria-hidden="true">
      <rect x="9" y="6" width="18" height="9" rx="3" fill="#1e293b" />
      <rect x="11" y="8" width="14" height="3" rx="1.5" fill="#334155" />
      <circle cx="18" cy="12.5" r="1.1" fill="#38bdf8" />
      <rect x="11" y="15" width="14" height="12" rx="2" fill="#cbd5e1" opacity=".6" />
      <rect x="14" y="16" width="2" height="5" fill="#f59e0b" /><rect x="20" y="16" width="2" height="5" fill="#f59e0b" />
    </svg>
  )
}
