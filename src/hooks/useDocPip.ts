import { useCallback, useEffect, useRef, useState } from 'react'

// ── หน้าต่างลอย (Document Picture-in-Picture) — อยู่บนสุดเสมอ แม้ย่อหน้าต่างหลักลง ──
// รองรับ Chrome / Edge 116+ · เปิดได้เมื่อผู้ใช้กดปุ่ม (เบราว์เซอร์ไม่ยอมให้เปิดเองตอนย่อหน้าต่าง)
// เนื้อหาใส่ด้วย createPortal เข้า body ของหน้าต่างลอย · คัดลอก CSS ทั้งหมดไปให้หน้าตาเหมือนกัน

interface DocPip { requestWindow(opts?: { width?: number; height?: number }): Promise<Window>; window: Window | null }
const api = (): DocPip | null => (typeof window !== 'undefined' && 'documentPictureInPicture' in window ? (window as unknown as { documentPictureInPicture: DocPip }).documentPictureInPicture : null)

export const pipSupported = (): boolean => !!api()

/** ทำไมเปิดหน้าต่างลอยไม่ได้ — บอกผู้ใช้ให้ตรงจุด (null = เปิดได้) */
export function pipBlockReason(): string | null {
  if (api()) return null
  const framed = (() => { try { return window.top !== window.self } catch { return true } })()
  if (framed) return 'หน้านี้เปิดอยู่ในกรอบของหน้าอื่น (iframe) — เปิด Helpdesk ตรง ๆ ในแท็บของตัวเองแล้วลองใหม่'
  if (!window.isSecureContext) return 'ต้องเปิดผ่าน https'
  const ua = navigator.userAgent
  const edge = /Edg\/(\d+)/.exec(ua), chrome = /Chrome\/(\d+)/.exec(ua)
  if (edge || chrome) return `เบราว์เซอร์รุ่นนี้ยังไม่รองรับ (${edge ? `Edge ${edge[1]}` : `Chrome ${chrome![1]}`}) — อัปเดตเป็นรุ่น 116 ขึ้นไป หรืออาจถูกปิดโดยนโยบายองค์กร`
  return 'ใช้ได้เฉพาะ Chrome หรือ Edge (Firefox / Safari ยังไม่รองรับหน้าต่างลอยแบบนี้)'
}

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

// ── หดหน้าต่างออฟฟิศตอนเปิดหน้าต่างลอย (ข้อ 2) ──
// หน้าเว็บสั่ง Minimize ไม่ได้ แต่ย่อขนาด/ย้ายหน้าต่างที่เปิดด้วย window.open (หน้าต่างออฟฟิศ) ได้
// จำขนาด/ตำแหน่งเดิมไว้ ปิดหน้าต่างลอยแล้วคืนให้เหมือนเดิม
export interface WinBox { x: number; y: number; w: number; h: number }
export const SHRUNK = { w: 320, h: 110 }

/** ตำแหน่งแถบเล็ก: มุมซ้ายล่างของจอ (หน้าต่างลอยมักอยู่มุมขวาล่าง จะได้ไม่ทับกัน) */
export function shrunkBox(screenW: number, screenH: number, left = 0, top = 0): WinBox {
  return { x: left + 8, y: top + Math.max(0, screenH - SHRUNK.h - 8), w: SHRUNK.w, h: SHRUNK.h }
}

/** หดได้ไหม — เฉพาะหน้าต่างที่เปิดด้วย window.open (หน้าต่างหลักของเบราว์เซอร์ หน้าเว็บย่อขนาดไม่ได้) */
export const canShrinkWindow = (): boolean => { try { return !!window.opener || /[?&]popout=1/.test(window.location.hash) } catch { return false } }

export function shrinkWindow(): WinBox | null {
  if (!canShrinkWindow()) return null
  const before: WinBox = { x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight }
  const sc = window.screen as Screen & { availLeft?: number; availTop?: number }
  const b = shrunkBox(sc.availWidth, sc.availHeight, sc.availLeft ?? 0, sc.availTop ?? 0)
  try { window.resizeTo(b.w, b.h); window.moveTo(b.x, b.y) } catch { return null }
  return before
}

export function restoreWindow(before: WinBox | null) {
  if (!before) return
  try { window.resizeTo(before.w, before.h); window.moveTo(before.x, before.y); window.focus() } catch { /* ปิดไปแล้ว */ }
}
