// Lightweight dependency-free charts (SVG/CSS)

interface Slice { label: string; value: number; color: string }

export function Donut({ data, size = 140 }: { data: Slice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = size / 2 - 12
  const cx = size / 2, cy = size / 2
  const C = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="14" className="text-gray-100 dark:text-gray-800" />
        {data.map((d, i) => {
          const len = (d.value / total) * C
          const seg = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="14"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          )
          offset += len
          return seg
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100" style={{ fontSize: 22, fontWeight: 700 }}>{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-gray-400" style={{ fontSize: 10 }}>รวม</text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <span className="text-gray-600 dark:text-gray-300 flex-1">{d.label}</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-24 text-gray-500 dark:text-gray-400 flex-shrink-0 truncate">{d.label}</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
            <div className="h-full rounded-full flex items-center justify-end pr-2 text-[10px] font-medium text-white transition-all"
              style={{ width: `${Math.max(6, (d.value / max) * 100)}%`, background: d.color || 'var(--primary-600, #0F4C81)' }}>
              {d.value > 0 ? d.value : ''}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Simple column trend (last N periods)
export function Columns({ data, color = '#0F4C81' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-300">{d.value || ''}</span>
          <div className="w-full rounded-t transition-all" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 4 : 0, background: color }} />
          <span className="text-[10px] text-gray-400">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
