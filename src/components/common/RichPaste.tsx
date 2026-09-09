import { useState } from 'react'
import { RichHtml } from './RichHtml'

interface ChipProps {
  html: string
  onFlatten: () => void
  onDiscard: () => void
}

/**
 * เนื้อหาที่วางมาแบบมีรูปแบบ — แสดงให้เห็นเลย ไม่พับ
 *
 * เดิมพับไว้เป็นค่าเริ่มต้น ผลคือช่องพิมพ์ว่างเปล่าและมีแต่ป้ายบรรทัดเดียว
 * ทั้งที่เนื้อหาถูกเก็บไว้จริง — ดูเหมือนวางไม่ติด ซึ่งแย่กว่าไม่มีฟีเจอร์นี้
 *
 * เปิดใหม่ทุกครั้งที่เนื้อหาเปลี่ยน (วางเพิ่ม) โดยจำว่าคนพับ "ก้อนไหน" ไว้
 * ไม่ได้เก็บเป็น true/false — ไม่งั้นพับครั้งเดียวแล้ววางใหม่จะยังพับอยู่
 */
export function RichPasteChip({ html, onFlatten, onDiscard }: ChipProps) {
  const [collapsedFor, setCollapsedFor] = useState('')
  if (!html) return null
  const open = collapsedFor !== html

  return (
    <div className="rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50/60 dark:bg-primary-900/20 p-2 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span className="font-medium text-primary-700 dark:text-primary-300">
          📋 เนื้อหาที่วางมา — จะถูกส่งพร้อมคอมเมนต์นี้
        </span>
        <button type="button" onClick={() => setCollapsedFor(open ? html : '')}
          className="text-primary-600 hover:underline">
          {open ? 'ย่อ' : 'ดูเนื้อหา'}
        </button>
        <button type="button" onClick={onFlatten} className="text-gray-500 hover:underline"
          title="ย้ายเป็นข้อความล้วนลงช่องพิมพ์ เพื่อแก้คำได้">
          แก้เป็นข้อความ
        </button>
        <button type="button" onClick={onDiscard} className="text-red-500 hover:underline">ทิ้ง</button>
      </div>
      {open && (
        <div className="bg-white dark:bg-gray-900 rounded-md p-2 max-h-64 overflow-auto">
          <RichHtml html={html} />
        </div>
      )}
    </div>
  )
}
