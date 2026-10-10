// หยุดภาพเคลื่อนไหวบนแผนที่เมื่อไม่มีใครดู — ลดภาระ GPU
//
// ภาพเคลื่อนไหวใน SVG (ต้นไม้ไหว ปลาว่าย น้ำตก ...) เบราว์เซอร์ต้องวาดใหม่ทุกเฟรม ~60 ครั้ง/วิ ไม่มีพัก
// และหน้าต่างแยก (pop-out) ที่วางเปิดไว้ เบราว์เซอร์ไม่ลดความถี่ให้ — จึงหยุดเองเมื่อ:
//   • หน้าถูกซ่อน (สลับแท็บ/ย่อหน้าต่าง) หรือหน้าต่างไม่ได้โฟกัส
//   • ไม่ได้ขยับเมาส์/กดคีย์เกิน 1 นาที
// ขยับเมาส์ กดคีย์ หรือกลับมาที่หน้าต่าง = เล่นต่อทันที (คนเดิน/ตำแหน่งยังอัปเดตตามปกติ — หยุดแค่ลวดลาย)

import { useEffect, type RefObject } from 'react'

export const IDLE_MS = 60_000

export function useMotionPause(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let paused = false
    let last = Date.now()
    const setSvgs = (root: ParentNode, pause: boolean) =>
      root.querySelectorAll('svg').forEach(s => { try { if (pause) s.pauseAnimations(); else s.unpauseAnimations() } catch { /* ไม่รองรับ */ } })
    const apply = (pause: boolean) => {
      if (pause === paused) return
      paused = pause
      el.classList.toggle('hd-paused', pause)
      setSvgs(el, pause)
    }
    const shouldPause = () => document.hidden || !document.hasFocus() || Date.now() - last > IDLE_MS
    const check = () => apply(shouldPause())
    const active = () => { last = Date.now(); if (paused) check() }
    // ชิ้นที่เพิ่งโผล่ระหว่างหยุด (คนเดินเข้ามา ของแต่งใหม่) ต้องหยุดตามด้วย
    const mo = new MutationObserver(recs => {
      if (!paused) return
      for (const r of recs) r.addedNodes.forEach(n => {
        if (n instanceof SVGSVGElement) { try { n.pauseAnimations() } catch { /* */ } }
        else if (n instanceof Element) setSvgs(n, true)
      })
    })
    mo.observe(el, { childList: true, subtree: true })
    const evs = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    evs.forEach(e => window.addEventListener(e, active, { passive: true }))
    window.addEventListener('focus', check); window.addEventListener('blur', check)
    document.addEventListener('visibilitychange', check)
    const t = window.setInterval(check, 5000)
    check()
    return () => {
      mo.disconnect(); window.clearInterval(t)
      evs.forEach(e => window.removeEventListener(e, active))
      window.removeEventListener('focus', check); window.removeEventListener('blur', check)
      document.removeEventListener('visibilitychange', check)
      apply(false)
    }
  }, [ref])
}
