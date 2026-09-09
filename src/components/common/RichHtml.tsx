import { useMemo } from 'react'
import { sanitizeHtml } from '../../utils/sanitizeDom'

interface Props {
  html: string
  className?: string
}

/**
 * แสดงเนื้อหาที่วางมาแบบมีรูปแบบ (ตาราง ลิงก์ ตัวหนา รูป)
 *
 * กรองซ้ำตอนแสดงทุกครั้ง ไม่ใช่เชื่อว่ากรองแล้วตอนวาง —
 * ข้อมูลใน SharePoint แก้จากทางอื่นได้ (หน้าเว็บ SharePoint เอง, Power Automate,
 * Add-in) การกรองครั้งเดียวตอนเขียนจึงไม่ใช่หลักประกันตอนอ่าน
 */
export function RichHtml({ html, className = '' }: Props) {
  const clean = useMemo(() => sanitizeHtml(html), [html])

  if (!clean.html) return null

  return (
    <div className={className}>
      {/* ตารางกว้างได้ — ให้เลื่อนในกรอบของตัวเอง ไม่ให้ทั้งหน้าเลื่อนซ้ายขวา */}
      <div
        className="hd-rich overflow-x-auto text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
        // ผ่าน sanitizeHtml แล้ว: เหลือแท็กในรายการขาว ไม่มี on* ไม่มี javascript:
        dangerouslySetInnerHTML={{ __html: clean.html }}
      />
      {clean.droppedImages > 0 && (
        <p className="mt-1 text-[11px] text-gray-400">
          มีรูป {clean.droppedImages} รูปในเนื้อหาที่คัดลอกมาไม่ได้ (อยู่ในเครื่องหรือกล่องเมลของผู้วาง) —
          ถ้าจำเป็นให้แนบเป็นไฟล์
        </p>
      )}
    </div>
  )
}
