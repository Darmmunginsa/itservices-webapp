import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../../store/useAppStore'

/**
 * พลุเต็มจอตอนปิดงานได้
 *
 * ปิดงานคือช่วงเดียวของวันที่มีอะไรให้ดีใจ — ให้มันรู้สึกได้จริง ๆ
 *
 * วาดด้วย canvas ใบเดียว ยิงจรวดขึ้นจากขอบล่างพร้อมหางไฟ แล้วระเบิดเป็นดอก
 * ใช้ globalCompositeOperation = 'lighter' ให้ประกายที่ทับกันสว่างขึ้นเหมือนไฟจริง
 *
 * pointer-events: none เสมอ เพราะคนกดปิดงานแล้วมักทำงานต่อทันที
 * ไม่ควรต้องรอให้แอนิเมชันจบก่อนถึงจะกดอะไรได้
 */

const COLORS = [
  '#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#00c7be',
  '#0a84ff', '#5e5ce6', '#bf5af2', '#ff2d92', '#ffffff',
]
const DURATION = 5200          // ยิงถึงวินาทีที่ ~3.6 แล้วปล่อยให้ดอกสุดท้ายจางหมด
const LAUNCH_UNTIL = 3600
const GRAVITY = 0.038
const DRAG = 0.988
const TRAIL = 0.14             // ยิ่งน้อยยิ่งเห็นหางยาว

interface Spark {
  x: number; y: number; px: number; py: number
  vx: number; vy: number
  color: string; life: number; decay: number; size: number
  twinkle: boolean
}
interface Rocket {
  x: number; y: number; px: number; py: number
  vx: number; vy: number
  color: string; targetY: number; big: boolean
}

export function Celebration() {
  const nonce = useAppStore(s => s.celebration)
  const mode = useAppStore(s => s.celebrationFx)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // ปิดป้ายด้วย "nonce ที่แสดงจบแล้ว" แทน boolean — setState จึงเกิดใน callback ของ timer
  // ไม่ใช่ในตัว effect ตรง ๆ ซึ่งทำให้ render ซ้อนกัน
  const [doneNonce, setDoneNonce] = useState(0)

  const osReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  // 'always' = ผู้ใช้สั่งเองว่าเอาพลุ ให้ชนะค่าเครื่อง · 'auto' = ตามค่าเครื่อง · 'off' = ไม่เอาเลย
  const play = mode === 'always' ? true : mode === 'off' ? false : !osReduced
  const quiet = !play && nonce > 0 && doneNonce !== nonce

  useEffect(() => {
    if (!nonce) return
    if (!play) {
      const t = window.setTimeout(() => setDoneNonce(nonce), 1800)
      return () => clearTimeout(t)
    }
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
    const rockets: Rocket[] = []
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const pick = () => COLORS[Math.floor(Math.random() * COLORS.length)]

    function launch() {
      const big = Math.random() < 0.35
      const x = rand(W * 0.08, W * 0.92)
      rockets.push({
        x, y: H + 10, px: x, py: H + 10,
        vx: rand(-0.9, 0.9),
        vy: -rand(9.5, 13.5),
        color: pick(),
        targetY: rand(H * 0.08, H * 0.45),
        big,
      })
    }

    function explode(x: number, y: number, color: string, big: boolean) {
      const n = big ? 150 : 90
      // สองวงซ้อน วงในช้าวงนอกเร็ว ทำให้ดอกมีมิติแทนที่จะเป็นวงแบน ๆ
      for (let ring = 0; ring < 2; ring++) {
        const count = ring === 0 ? Math.round(n * 0.4) : n
        const base = ring === 0 ? (big ? 3.5 : 2.5) : (big ? 8.5 : 6)
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 * i) / count + rand(-0.08, 0.08)
          const speed = base * rand(0.55, 1.15)
          sparks.push({
            x, y, px: x, py: y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            // ส่วนใหญ่สีเดียวกันทั้งดอก แซมสีอื่นนิดหน่อยให้ไม่แบน
            color: Math.random() < 0.18 ? pick() : color,
            life: 1,
            decay: rand(0.0055, 0.011),
            size: rand(1.4, 3.0),
            twinkle: Math.random() < 0.4,
          })
        }
      }
    }

    // ยิงถี่ ๆ แบบสุ่มจังหวะ ให้เหมือนชุดพลุจริงมากกว่าการนับจังหวะเป๊ะ ๆ
    const timers: number[] = []
    let at = 0
    while (at < LAUNCH_UNTIL) {
      timers.push(window.setTimeout(launch, at))
      // ท้าย ๆ ยิงรัวขึ้น เป็นชุดปิดท้าย
      at += at > LAUNCH_UNTIL * 0.7 ? rand(90, 190) : rand(170, 380)
    }
    // เปิดฉากด้วยหลายลูกพร้อมกัน จะได้ไม่เงียบตอนเริ่ม
    timers.push(window.setTimeout(launch, 60))
    timers.push(window.setTimeout(launch, 110))

    let raf = 0
    const started = performance.now()
    const frame = (now: number) => {
      const elapsed = now - started

      // ลบทีละนิดแทนการล้างทั้งเฟรม — ของเดิมจึงเหลือค้างเป็นหางไฟ
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0,0,0,${TRAIL})`
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.px = r.x; r.py = r.y
        r.x += r.vx
        r.y += r.vy
        r.vy += GRAVITY * 3.2
        ctx.strokeStyle = r.color
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(r.px, r.py)
        ctx.lineTo(r.x, r.y)
        ctx.stroke()
        // ระเบิดตอนหมดแรงพุ่ง ดูเป็นธรรมชาติกว่าไประเบิดที่ความสูงตายตัว
        if (r.y <= r.targetY || r.vy >= -0.6) {
          explode(r.x, r.y, r.color, r.big)
          rockets.splice(i, 1)
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.px = s.x; s.py = s.y
        s.vx *= DRAG
        s.vy = s.vy * DRAG + GRAVITY
        s.x += s.vx
        s.y += s.vy
        s.life -= s.decay
        if (s.life <= 0) { sparks.splice(i, 1); continue }
        // ประกายบางเม็ดวิบวับตอนใกล้ดับ เหมือนปลายดอกพลุจริง
        const a = s.twinkle && s.life < 0.55 ? s.life * (0.4 + Math.random() * 0.6) : s.life
        ctx.globalAlpha = Math.max(0, a)
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.size
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(s.px, s.py)
        ctx.lineTo(s.x, s.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      if (elapsed < DURATION) raf = requestAnimationFrame(frame)
      else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.clearRect(0, 0, W, H)
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      timers.forEach(clearTimeout)
    }
  }, [nonce, play])

  if (!nonce) return null

  return createPortal(
    <>
      <canvas ref={canvasRef} aria-hidden
        className="fixed inset-0 z-[300] pointer-events-none w-full h-full" />
      {/* ไม่เล่นภาพเคลื่อนไหว — ป้ายนิ่ง ๆ แทนพลุ ยังรู้ว่าปิดงานสำเร็จ */}
      {quiet && (
        <div className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center">
          <div className="px-6 py-4 rounded-2xl bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl text-center">
            <p className="text-3xl leading-none">🎉</p>
            <p className="mt-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">ปิดงานสำเร็จ</p>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
