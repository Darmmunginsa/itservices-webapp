import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../../store/useAppStore'

/**
 * พลุเต็มจอตอนปิดงานได้
 *
 * ปิดงานคือช่วงเดียวของวันที่มีอะไรให้ดีใจ — ให้มันรู้สึกได้หน่อย
 *
 * วาดด้วย canvas ใบเดียวแล้วถอดทิ้ง ไม่ค้างไว้กิน CPU
 * pointer-events: none เสมอ เพราะคนกดปิดงานแล้วมักจะทำงานต่อทันที
 * ไม่ควรต้องรอให้แอนิเมชันจบก่อนถึงจะกดอะไรได้
 */

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#facc15']
const DURATION = 2600
const GRAVITY = 0.055
const DRAG = 0.985

interface Spark {
  x: number; y: number; vx: number; vy: number
  color: string; life: number; size: number
}

export function Celebration() {
  const nonce = useAppStore(s => s.celebration)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!nonce) return
    // เคารพการตั้งค่าของเครื่อง — บางคนเวียนหัวกับภาพเคลื่อนไหว และนี่ไม่ใช่ข้อมูลที่จำเป็น
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const sparks: Spark[] = []
    const burst = (x: number, y: number) => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const n = 48 + Math.floor(Math.random() * 20)
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2
        const speed = 4.5 + Math.random() * 7.5
        sparks.push({
          x, y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          color: Math.random() < 0.25 ? COLORS[Math.floor(Math.random() * COLORS.length)] : color,
          life: 1,
          size: 1.8 + Math.random() * 2.4,
        })
      }
    }

    // ยิงทีละลูกให้ไล่กันขึ้น เหมือนพลุจริง ดีกว่าระเบิดพร้อมกันหมดแล้วจบ
    const timers: number[] = []
    const shots = [0, 220, 430, 700, 980, 1250, 1500]
    shots.forEach((delay, i) => {
      timers.push(window.setTimeout(() => {
        burst(W * (0.12 + Math.random() * 0.76), H * (0.18 + Math.random() * 0.42))
        if (i === 0) burst(W * 0.5, H * 0.3)
      }, delay))
    })

    let raf = 0
    const started = performance.now()
    const frame = (now: number) => {
      const elapsed = now - started
      ctx.clearRect(0, 0, W, H)
      for (const s of sparks) {
        s.vx *= DRAG
        s.vy = s.vy * DRAG + GRAVITY
        s.x += s.vx
        s.y += s.vy
        s.life -= 0.0085
        if (s.life <= 0) continue
        ctx.globalAlpha = Math.max(0, s.life)
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (elapsed < DURATION) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
    }
  }, [nonce])

  if (!nonce) return null

  return createPortal(
    <canvas ref={canvasRef} aria-hidden
      className="fixed inset-0 z-[300] pointer-events-none w-full h-full" />,
    document.body,
  )
}
