import { useCallback, useEffect, useRef, useState } from 'react'

// ── หน้าต่างลอย (Document Picture-in-Picture) — อยู่บนสุดเสมอ แม้ย่อหน้าต่างหลักลง ──
// รองรับ Chrome / Edge 116+ · เปิดได้เมื่อผู้ใช้กดปุ่ม (เบราว์เซอร์ไม่ยอมให้เปิดเองตอนย่อหน้าต่าง)
// เนื้อหาใส่ด้วย createPortal เข้า body ของหน้าต่างลอย · คัดลอก CSS ทั้งหมดไปให้หน้าตาเหมือนกัน

interface DocPip { requestWindow(opts?: { width?: number; height?: number }): Promise<Window>; window: Window | null }
const api = (): DocPip | null => (typeof window !== 'undefined' && 'documentPictureInPicture' in window ? (window as unknown as { documentPictureInPicture: DocPip }).documentPictureInPicture : null)

export const pipSupported = (): boolean => !!api()

function copyStyles(to: Document) {
  for (const sheet of [...document.styleSheets]) {
    try {
      const css = [...sheet.cssRules].map(r => r.cssText).join('\n')
      const s = to.createElement('style'); s.textContent = css; to.head.appendChild(s)
    } catch {
      // stylesheet ข้ามโดเมน อ่าน rule ไม่ได้ — ลิงก์ไปไฟล์เดิมแทน
      if (sheet.href) { const l = to.createElement('link'); l.rel = 'stylesheet'; l.href = sheet.href; to.head.appendChild(l) }
    }
  }
  to.documentElement.className = document.documentElement.className   // โหมดมืด
}

export function useDocPip() {
  const [win, setWin] = useState<Window | null>(null)
  const opening = useRef(false)

  const open = useCallback(async (width = 380, height = 300): Promise<boolean> => {
    const p = api()
    if (!p) return false
    if (p.window) { p.window.focus(); return true }
    if (opening.current) return true
    opening.current = true
    try {
      const w = await p.requestWindow({ width, height })
      copyStyles(w.document)
      w.document.title = 'ออฟฟิศ — Helpdesk'
      w.document.documentElement.style.height = '100%'
      w.document.body.style.cssText = 'margin:0;height:100%'
      w.document.body.className = 'bg-white dark:bg-gray-950'
      w.addEventListener('pagehide', () => setWin(null))
      setWin(w)
      return true
    } catch { return false } finally { opening.current = false }
  }, [])

  const close = useCallback(() => { api()?.window?.close(); setWin(null) }, [])
  useEffect(() => () => { api()?.window?.close() }, [])

  return { win, open, close }
}
