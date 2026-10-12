import * as THREE from 'three'

// ── ลายพื้น/ท้องฟ้าสำหรับมุมมอง 3D — วาดเองด้วย canvas (ไม่มีไฟล์รูป ไม่มีลิขสิทธิ์) ──
// สร้างครั้งเดียวแล้วจำไว้ · ขนาดเล็ก (128px) เบาเครื่อง แต่ทำให้พื้นดูเป็นวัสดุจริง

const cache = new Map<string, THREE.Texture>()

function make(key: string, size: number, draw: (x: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas'); c.width = c.height = size
  draw(c.getContext('2d')!, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  cache.set(key, t)
  return t
}

/** สุ่มแบบคงที่ — ลายเหมือนเดิมทุกครั้ง */
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

const noise = (x: CanvasRenderingContext2D, s: number, base: string, spread: string[], n: number, seed: number, r = 1.2) => {
  x.fillStyle = base; x.fillRect(0, 0, s, s)
  const R = rnd(seed)
  for (let i = 0; i < n; i++) { x.fillStyle = spread[i % spread.length]; x.globalAlpha = 0.25 + R() * 0.35; x.beginPath(); x.arc(R() * s, R() * s, R() * r + 0.4, 0, Math.PI * 2); x.fill() }
  x.globalAlpha = 1
}

export const floorTexture = (ch: string): THREE.Texture | null => {
  switch (ch) {
    case '.': case 'd':   // พื้นไม้ปาร์เก้ (โต๊ะทำงาน)
      return make('wood', 128, (x, s) => {
        const R = rnd(7)
        for (let i = 0; i < 4; i++) {
          const tone = ['#d9b98a', '#d2ae7c', '#dcc093', '#cfa874'][i]
          x.fillStyle = tone; x.fillRect(0, i * s / 4, s, s / 4)
          x.strokeStyle = 'rgba(120,80,40,.18)'
          for (let k = 0; k < 6; k++) { x.beginPath(); const y = i * s / 4 + R() * s / 4; x.moveTo(0, y); x.bezierCurveTo(s * .3, y + 2, s * .6, y - 2, s, y + 1); x.stroke() }
          x.fillStyle = 'rgba(90,60,30,.35)'; x.fillRect(0, i * s / 4, s, 1.2)
          x.fillRect(((i * 53) % 100) / 100 * s, i * s / 4, 1.2, s / 4)
        }
      })
    case 'M':   // พรมห้องประชุม (เทาฟ้า มีเส้นใย)
      return make('carpet-blue', 128, (x, s) => noise(x, s, '#b9c8dc', ['#a7b8cf', '#c9d6e6', '#9fb1c9'], 900, 11, 0.9))
    case 'F':   // พรมชมพูห้องโฟกัส
      return make('carpet-pink', 128, (x, s) => noise(x, s, '#f0c9d3', ['#e8b7c4', '#f6d8e0', '#e3aebd'], 900, 13, 0.9))
    case 'C': case 'K':   // กระเบื้องมุมกาแฟ
      return make('tile', 128, (x, s) => {
        x.fillStyle = '#e9f6f8'; x.fillRect(0, 0, s, s)
        x.fillStyle = '#c4ecf1'; x.fillRect(0, 0, s / 2, s / 2); x.fillRect(s / 2, s / 2, s / 2, s / 2)
        x.strokeStyle = 'rgba(80,120,130,.35)'; x.lineWidth = 2; x.strokeRect(0, 0, s, s); x.beginPath(); x.moveTo(s / 2, 0); x.lineTo(s / 2, s); x.moveTo(0, s / 2); x.lineTo(s, s / 2); x.stroke()
      })
    case 'S':   // พื้นยางหน้าประตู
      return make('vinyl', 128, (x, s) => noise(x, s, '#d9d1f3', ['#cfc5ee', '#e4ddf7'], 500, 17, 1.4))
    case 'g': case 'h':   // หญ้า
      return make('grass', 128, (x, s) => {
        noise(x, s, '#6fb553', ['#5fa344', '#86c96b', '#4f9a3a', '#9bd27e'], 1400, 19, 1.1)
        const R = rnd(23); x.strokeStyle = 'rgba(40,100,30,.35)'
        for (let i = 0; i < 160; i++) { const px = R() * s, py = R() * s; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - .5) * 3, py - 3 - R() * 3); x.stroke() }
      })
    case 'p':   // ทางเดินหิน: พื้นกรวดละเอียด + มอส/หญ้าแทรก (แผ่นหินจริงวางทับเป็น 3D)
      return make('stone', 256, (x, s) => {
        noise(x, s, '#6f6a60', ['#827c70', '#5c574e', '#948e80', '#4d4942'], 5200, 29, 1.6)
        const R = rnd(37)
        for (let i = 0; i < 26; i++) { x.fillStyle = ['rgba(92,140,60,.55)', 'rgba(70,120,48,.5)'][i % 2]; x.beginPath(); x.ellipse(R() * s, R() * s, 6 + R() * 14, 3 + R() * 8, R() * 3, 0, Math.PI * 2); x.fill() }
      })
    case 'f':   // แปลงดอกไม้ (ดิน)
      return make('soil', 128, (x, s) => noise(x, s, '#6b4226', ['#7a4a2a', '#5a3820', '#8a5a35'], 900, 31, 1.3))
    case 'w':   // น้ำ
      return make('water', 128, (x, s) => {
        const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, '#5bb7e6'); g.addColorStop(1, '#2f8fc6'); x.fillStyle = g; x.fillRect(0, 0, s, s)
        x.strokeStyle = 'rgba(255,255,255,.35)'; const R = rnd(37)
        for (let i = 0; i < 10; i++) { const y = R() * s, px = R() * s; x.beginPath(); x.moveTo(px, y); x.quadraticCurveTo(px + 8, y - 3, px + 16, y); x.stroke() }
      })
    case 'E':
      return make('door', 128, (x, s) => noise(x, s, '#a8794e', ['#946a43', '#b98a5d'], 300, 41, 1.5))
    default:
      return null
  }
}

/** ท้องฟ้าไล่สี (ฟ้าอ่อนด้านบน → ขาวอมส้มที่ขอบฟ้า) */
export const skyTexture = () => make('sky', 256, (x, s) => {
  const g = x.createLinearGradient(0, 0, 0, s)
  g.addColorStop(0, '#7cb8ef'); g.addColorStop(0.55, '#cfe6fb'); g.addColorStop(1, '#fbeee0')
  x.fillStyle = g; x.fillRect(0, 0, s, s)
})

/** พื้นดินรอบตึก (หญ้าสีอ่อน) */
export const groundTexture = () => {
  const t = make('ground', 128, (x, s) => noise(x, s, '#9fcf86', ['#8fc475', '#acd796', '#86bb6c'], 900, 43, 1.4))
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
