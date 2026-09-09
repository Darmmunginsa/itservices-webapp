import { useCallback, useState } from 'react'
import { htmlToPlain, hasBlockMarkup } from '../utils/richComment'
import { sanitizeHtml } from '../utils/sanitizeDom'

/**
 * รับรูปแบบต้นฉบับที่วางลงช่องข้อความ — ใช้ร่วมกันทุกที่ที่มีช่องพิมพ์ยาว
 * (คอมเมนต์ Ticket / Incident / Project และเนื้อหาใน Tools & Note)
 *
 * ทำเป็นที่เดียวเพราะถ้าก็อปไปวางแต่ละหน้า กฎการกรองจะเริ่มต่างกันทีละนิด
 * แล้วหน้าที่ถูกลืมอัปเดตจะกลายเป็นช่องโหว่ที่ไม่มีใครรู้
 */
export function useRichPaste(onNote?: (msg: string) => void) {
  const [html, setHtml] = useState('')

  /**
   * เก็บรูปแบบจากคลิปบอร์ด — คืน true ถ้าเก็บไว้จริง
   * กรองทันทีตอนวาง ไม่เก็บ HTML ดิบไว้เลยแม้ชั่วคราว
   */
  const capture = useCallback((raw: string): boolean => {
    // เอาเฉพาะรูปแบบระดับบล็อก (ตาราง/รายการ/หัวข้อ/รูป) — ลิงก์หรือตัวหนาเดี่ยว ๆ
    // ปล่อยให้ข้อความลงช่องพิมพ์ตามปกติ จะแก้คำและใช้ @mention ได้
    if (!hasBlockMarkup(raw)) return false
    const clean = sanitizeHtml(raw)
    if (!clean.html.trim()) return false
    // วางหลายครั้งให้ต่อกัน ไม่ทับของเดิม — คนมักวางตารางสองอันติดกัน
    setHtml(prev => (prev ? `${prev}\n<hr>\n${clean.html}` : clean.html))
    if (clean.droppedImages > 0) {
      onNote?.(`เก็บรูปแบบไว้แล้ว แต่มีรูป ${clean.droppedImages} รูปคัดลอกมาไม่ได้ — แนบเป็นไฟล์ได้`)
    }
    return true
  }, [onNote])

  const clear = useCallback(() => setHtml(''), [])

  /** ทิ้งรูปแบบ เอาแต่ข้อความไปต่อท้ายที่พิมพ์อยู่ */
  const flatten = useCallback((append: (text: string) => void) => {
    const text = htmlToPlain(html)
    setHtml('')
    if (text) append(text)
  }, [html])

  return { html, setHtml, capture, clear, flatten }
}
