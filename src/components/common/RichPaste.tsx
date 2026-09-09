import { useState } from 'react'
import { RichHtml } from './RichHtml'

interface ChipProps {
  html: string
  onFlatten: () => void
  onDiscard: () => void
}

/**
 * ป้ายบอกว่ารูปแบบถูกเก็บไว้ พร้อมตัวอย่าง
 *
 * ต้องมี เพราะช่องพิมพ์เป็นข้อความล้วน ถ้าไม่บอกจะดูเหมือนวางไม่ติด
 * แล้วคนจะวางซ้ำหรือเลิกใช้ไปเลย
 */
export function RichPasteChip({ html, onFlatten, onDiscard }: ChipProps) {
  const [open, setOpen] = useState(false)
  if (!html) return null
  return (
    <div className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20 p-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span className="font-medium text-primary-700 dark:text-primary-300">
          📋 เก็บรูปแบบต้นฉบับไว้แล้ว (ตาราง/ลิงก์/รูป)
        </span>
        <button type="button" onClick={() => setOpen(o => !o)} className="text-primary-600 hover:underline">
          {open ? 'ซ่อนตัวอย่าง' : 'ดูตัวอย่าง'}
        </button>
        <button type="button" onClick={onFlatten} className="text-gray-500 hover:underline"
          title="เอาแต่ข้อความ ทิ้งตาราง/รูปแบบ">
          ล้างรูปแบบ
        </button>
        <button type="button" onClick={onDiscard} className="text-red-500 hover:underline">ทิ้งทั้งบล็อก</button>
      </div>
      {open && (
        <div className="bg-white dark:bg-gray-900 rounded-md p-2 max-h-64 overflow-auto">
          <RichHtml html={html} />
        </div>
      )}
    </div>
  )
}
