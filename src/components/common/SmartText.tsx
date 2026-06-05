import { detectDates } from '../../utils/detectDates'
import { useAppStore } from '../../store/useAppStore'

interface SmartTextProps {
  text: string
  className?: string
}

export function SmartText({ text, className = '' }: SmartTextProps) {
  const openDateTaskModal = useAppStore(s => s.openDateTaskModal)
  const matches = detectDates(text)

  if (matches.length === 0) {
    return <p className={`whitespace-pre-wrap ${className}`}>{text}</p>
  }

  const segments: { plain: string; isMatch: boolean; idx: number }[] = []
  let cursor = 0

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (cursor < m.start) segments.push({ plain: text.slice(cursor, m.start), isMatch: false, idx: i })
    segments.push({ plain: m.text, isMatch: true, idx: i })
    cursor = m.end
  }
  if (cursor < text.length) segments.push({ plain: text.slice(cursor), isMatch: false, idx: -1 })

  return (
    <p className={`whitespace-pre-wrap ${className}`}>
      {segments.map((seg, i) =>
        seg.isMatch ? (
          <mark
            key={i}
            onClick={() => openDateTaskModal(matches[seg.idx])}
            title="คลิกเพื่อสร้าง Task"
            className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300
                       rounded px-0.5 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-800/60
                       transition-colors not-italic font-medium"
          >
            {seg.plain}
          </mark>
        ) : (
          <span key={i}>{seg.plain}</span>
        )
      )}
    </p>
  )
}
