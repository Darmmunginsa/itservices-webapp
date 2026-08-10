import { useState } from 'react'
import { ExternalLink, ChevronRight } from 'lucide-react'
import { parseSections, parseInline, type NoteSection } from '../../utils/richNote'

/** ข้อความ 1 ย่อหน้า — URL กดได้ทั้งแบบเปล่าและแบบ [ชื่อ](url) */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((s, i) =>
        s.type === 'link' ? (
          <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-primary-600 dark:text-primary-400 hover:underline break-all">
            {s.text}<ExternalLink size={9} className="inline ml-0.5 -mt-0.5" />
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  )
}

/** เนื้อหาของหัวข้อหนึ่ง — รองรับ bullet ด้วย "- " หรือ "• " */
function Body({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: { bullet: boolean; lines: string[] }[] = []
  for (const line of lines) {
    const m = line.match(/^\s*[-•]\s+(.*)$/)
    const bullet = !!m
    const content = m ? m[1] : line
    const last = blocks[blocks.length - 1]
    if (last && last.bullet === bullet) last.lines.push(content)
    else blocks.push({ bullet, lines: [content] })
  }
  return (
    <>
      {blocks.map((b, i) => b.bullet ? (
        <ul key={i} className="list-disc pl-4 space-y-0.5 my-1">
          {b.lines.map((l, j) => <li key={j}><Inline text={l} /></li>)}
        </ul>
      ) : (
        <p key={i} className="whitespace-pre-wrap my-1"><Inline text={b.lines.join('\n')} /></p>
      ))}
    </>
  )
}

/**
 * โน้ตที่โตได้เรื่อย ๆ — แบ่งหัวข้อ มีสารบัญ และลิงก์กลางเนื้อหากดได้
 * หัวข้อเยอะ ๆ จะพับไว้ กดทีละหัวข้อ ไม่ต้องเลื่อนผ่านทั้งก้อน
 */
export function RichNote({ text, defaultOpenFirst = true, className = '' }: {
  text?: string
  defaultOpenFirst?: boolean   // การ์ดเปิดหัวข้อแรกให้เห็นก่อน 1 หัวข้อ
  className?: string
}) {
  const sections = parseSections(text)
  const titled = sections.filter(s => s.heading)
  // เปิดหัวข้อไหนอยู่บ้าง — เริ่มที่หัวข้อแรกเท่านั้น ที่เหลือพับ
  const [open, setOpen] = useState<Set<number>>(() =>
    new Set(defaultOpenFirst && titled.length > 1 ? [0] : sections.map((_, i) => i)))

  if (sections.length === 0) return null

  const toggle = (i: number) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i); else next.add(i)
    return next
  })

  const allOpen = sections.every((_, i) => open.has(i))

  return (
    <div className={`text-xs text-gray-600 dark:text-gray-300 leading-relaxed ${className}`}>
      {/* สารบัญ — มีตั้งแต่ 2 หัวข้อขึ้นไปถึงจะช่วย ต่ำกว่านั้นรกเปล่า ๆ */}
      {titled.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {sections.map((s, i) => s.heading && (
            <button key={i} onClick={() => { if (!open.has(i)) toggle(i) }}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                open.has(i)
                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary-300'}`}>
              {s.heading}
            </button>
          ))}
          <button onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((_, i) => i)))}
            className="text-[11px] text-gray-400 hover:text-primary-600 ml-0.5">
            {allOpen ? 'ย่อทั้งหมด' : 'กางทั้งหมด'}
          </button>
        </div>
      )}

      {sections.map((s, i) => (
        <Section key={i} section={s} open={open.has(i)} onToggle={() => toggle(i)} collapsible={titled.length > 1 && !!s.heading} />
      ))}
    </div>
  )
}

function Section({ section, open, onToggle, collapsible }: {
  section: NoteSection
  open: boolean
  onToggle: () => void
  collapsible: boolean
}) {
  if (!section.heading) return <Body text={section.body} />
  return (
    <div className="mt-2 first:mt-0">
      <button onClick={collapsible ? onToggle : undefined}
        className={`flex items-center gap-1 text-xs font-semibold text-gray-800 dark:text-gray-100 ${collapsible ? 'hover:text-primary-600' : 'cursor-default'}`}>
        {collapsible && (
          <ChevronRight size={12} className={`transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
        )}
        {section.heading}
      </button>
      {open && section.body && (
        <div className="border-l-2 border-gray-100 dark:border-gray-800 ml-1.5 mt-1 pl-2.5">
          <Body text={section.body} />
        </div>
      )}
    </div>
  )
}
