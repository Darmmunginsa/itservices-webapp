import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SmartText } from './SmartText'
import { splitQuoted } from '../../utils/emailQuote'

interface Props {
  text: string
  className?: string
}

/**
 * แสดงคอมเมนต์โดยพับเนื้อเมลเก่าที่ติดมากับการตอบกลับไว้
 *
 * พับ ไม่ใช่ลบ — ข้อความเต็มยังอยู่ใน SharePoint ครบ กดดูได้ตลอด
 * เพราะบางครั้งบริบทในเมลเก่าคือหลักฐานว่าใครตกลงอะไรไว้
 */
export function QuotedText({ text, className }: Props) {
  const [open, setOpen] = useState(false)
  const { visible, quoted } = splitQuoted(text)

  if (!quoted) return <SmartText text={visible} className={className} />

  const lines = quoted.split('\n').length
  return (
    <>
      <SmartText text={visible} className={className} />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        title="เนื้อเมลเก่าที่โปรแกรมเมลแนบมาด้วย"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? 'ซ่อนข้อความก่อนหน้า' : `ข้อความก่อนหน้า (${lines} บรรทัด)`}
      </button>
      {open && (
        <pre className="mt-1.5 p-2.5 text-[12px] leading-relaxed whitespace-pre-wrap break-words font-sans border-l-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 rounded-r">
          {quoted}
        </pre>
      )}
    </>
  )
}
