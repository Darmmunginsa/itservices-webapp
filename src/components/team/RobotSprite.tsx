// หุ่นยนต์ดูดฝุ่น (มองจากด้านบน) + แท่นชาร์จ — หันหน้าไปทางขวาเป็นค่าเริ่มต้น

export function RobotSprite({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
      <ellipse cx="15.6" cy="17" rx="13" ry="12" fill="#000" opacity=".22" />
      {/* แปรงข้าง หมุนตลอด */}
      <g className="hd-robot-brush" style={{ transformOrigin: '24px 8px' }}>
        {[0, 120, 240].map(a => <line key={a} x1="24" y1="8" x2="29" y2="8" stroke="#94a3b8" strokeWidth="1" transform={`rotate(${a} 24 8)`} />)}
      </g>
      <circle cx="15" cy="15" r="13" fill="#334155" />
      <circle cx="15" cy="15" r="11.5" fill="#475569" />
      <circle cx="14" cy="14" r="8" fill="#64748b" />
      <circle cx="12.5" cy="12.5" r="4" fill="#94a3b8" opacity=".45" />
      {/* กันชนด้านหน้า */}
      <path d="M22 5.5 A13 13 0 0 1 22 24.5" stroke="#0f172a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* เซนเซอร์ + ไฟสถานะ */}
      <circle cx="15" cy="15" r="2.4" fill="#1e293b" />
      <circle cx="20.5" cy="15" r="1.3" className="hd-robot-led" fill="#4ade80" />
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
