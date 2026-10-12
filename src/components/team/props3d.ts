import * as THREE from 'three'
import { floorTexture } from './textures3d'
import { waterMaterial } from './detail3d'

// ── สิ่งของชิ้นใหญ่ในมุมมอง 3D (เฟส 2) — ทรงการ์ตูน สร้างจากรูปทรงพื้นฐาน ──
// พิกัดในชิ้น: x = 0..กว้าง (คอลัมน์), z = 0..ลึก (แถว), y = สูง · ด้านหลังของชิ้นอยู่ทาง z = 0 (ทิศเหนือ) หน้าหันมาทางกล้อง
// ชิ้นที่ขยับได้คืน tick(t) ให้ลูปวาดเรียกทุกเฟรม (น้ำไหล ชิงช้าแกว่ง เป็ดลอย ปลาว่าย จอกะพริบ)

export interface Built3D { group: THREE.Group; tick?: (t: number) => void }

const mats = new Map<string, THREE.Material>()
/** วัสดุแชร์ต่อสี — ชิ้นเหมือนกันหลายชิ้นใช้วัสดุตัวเดียว */
const M = (color: string, opts: { emissive?: string; opacity?: number } = {}): THREE.Material => {
  const k = `${color}|${opts.emissive ?? ''}|${opts.opacity ?? 1}`
  let m = mats.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, emissive: opts.emissive ?? '#000000', roughness: (opts.opacity ?? 1) < 1 ? 0.15 : 0.72, metalness: 0,
      transparent: (opts.opacity ?? 1) < 1, opacity: opts.opacity ?? 1,
    })
    mats.set(k, m)
  }
  return m
}

function kit(g: THREE.Group) {
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, cast = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m
  }
  return {
    /** กล่อง: ตำแหน่ง = มุมล่างตรงกลาง (y คือพื้นของกล่อง) */
    box: (w: number, h: number, d: number, color: string | THREE.Material, x: number, y: number, z: number) =>
      put(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? M(color) : color, x, y + h / 2, z),
    cyl: (rt: number, rb: number, h: number, color: string | THREE.Material, x: number, y: number, z: number, seg = 12) =>
      put(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'string' ? M(color) : color, x, y + h / 2, z),
    ball: (r: number, color: string | THREE.Material, x: number, y: number, z: number, seg = 10) =>
      put(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), typeof color === 'string' ? M(color) : color, x, y, z),
    put,
  }
}

/** น้ำไหล: เส้นขาวบนพื้นฟ้า เลื่อนลงด้วย offset ของ texture (ไม่ต้องสร้างรูปใหม่ทุกเฟรม) */
function fallsTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128
  const x = c.getContext('2d')!
  const g = x.createLinearGradient(0, 0, 64, 0)
  g.addColorStop(0, '#7dd3fc'); g.addColorStop(0.5, '#e0f2fe'); g.addColorStop(1, '#7dd3fc')
  x.fillStyle = g; x.fillRect(0, 0, 64, 128)
  x.fillStyle = 'rgba(255,255,255,.85)'
  for (let i = 0; i < 26; i++) x.fillRect(Math.random() * 62, Math.random() * 128, 1 + Math.random() * 2, 10 + Math.random() * 26)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function duck(g: THREE.Group, x: number, z: number) {
  const d = new THREE.Group(); d.position.set(x, 0.02, z); g.add(d)
  const k = kit(d)
  k.ball(0.16, '#fafafa', 0, 0.08, 0).scale.set(1.3, 0.8, 1)
  k.ball(0.09, '#fafafa', 0.14, 0.22, 0)
  k.box(0.08, 0.03, 0.06, '#f97316', 0.24, 0.19, 0)
  k.ball(0.015, '#111827', 0.19, 0.25, 0.05)
  return d
}

const BUILD: Record<string, (w: number, h: number) => Built3D> = {
  // ═══ สวน ═══
  waterfall: (w) => {
    const g = new THREE.Group(), k = kit(g)
    // หน้าผาหินเป็นชั้น ๆ (2 แถวหลัง)
    const rock = ['#57534e', '#78716c', '#a8a29e']
    for (let i = 0; i < w; i++) {
      const tall = 1.4 + ((i * 37) % 5) * 0.12
      k.box(1.02, tall, 1.02, rock[i % 3], i + 0.5, 0, 0.5)
      k.box(1.0, tall * 0.55, 0.9, rock[(i + 1) % 3], i + 0.5, 0, 1.45)
      k.ball(0.32, '#2f7a3a', i + 0.5, tall + 0.05, 0.45).scale.set(1, 0.5, 1)   // มอสบนหิน
    }
    // บ่อ: ขอบหิน + น้ำ
    for (let i = 0; i < w; i++) for (const z of [2, 3]) k.box(1, 0.06, 1, '#155e75', i + 0.5, -0.05, z + 0.5)
    const wm = waterMaterial(floorTexture('w')!)   // ผิวน้ำไหล สะท้อนแสง เหมือนบ่อในสวน
    const water = k.box(w - 0.3, 0.02, 1.8, wm.material, w / 2, 0.02, 2.95)
    water.receiveShadow = true
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      k.ball(0.14 + (i % 3) * 0.04, rock[i % 3], w / 2 + Math.cos(a) * (w / 2 - 0.1), 0.08, 2.95 + Math.sin(a) * 0.95)
    }
    // ม่านน้ำตก (เลื่อนลงตลอด) + ฟองที่ตีน
    const tex = fallsTexture()
    const fallsMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 })
    const falls = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.7), fallsMat)
    falls.position.set(w / 2, 0.9, 1.92); g.add(falls)
    const foam: THREE.Mesh[] = []
    for (let i = 0; i < 6; i++) foam.push(k.ball(0.16, M('#ffffff', { opacity: 0.9 }), w / 2 - 0.75 + i * 0.3, 0.08, 2.15, 8))
    // ใบบัว + ปลาคาร์ฟ + เป็ด
    for (const [x, z] of [[1.4, 2.6], [6.3, 3.3], [2.6, 3.5]]) k.cyl(0.22, 0.22, 0.02, '#16a34a', x, 0.04, z)
    const koi = [0, 1, 2].map(i => k.ball(0.08, ['#f97316', '#fafafa', '#fbbf24'][i], 0, 0.04, 0, 8))
    koi.forEach(f => f.scale.set(1.8, 0.6, 0.8))
    const ducks = [duck(g, 2.0, 2.8), duck(g, 6.0, 3.0)]
    return {
      group: g,
      tick: t => {
        tex.offset.y = (t * 0.9) % 1
        wm.tick(t)
        foam.forEach((f, i) => f.scale.setScalar(0.8 + Math.abs(Math.sin(t * 3 + i)) * 0.5))
        koi.forEach((f, i) => {
          const a = t * (0.35 + i * 0.1) + i * 2
          f.position.set(w / 2 + Math.cos(a) * (2.2 - i * 0.5), 0.03, 2.95 + Math.sin(a) * 0.55)
          f.rotation.y = -a - Math.PI / 2
        })
        ducks.forEach((d, i) => { d.position.y = 0.02 + Math.sin(t * 2 + i) * 0.02; d.position.x += Math.sin(t * 0.3 + i) * 0.002; d.rotation.y = Math.sin(t * 0.4 + i) * 0.6 })
      },
    }
  },
  bench: (w) => {
    const g = new THREE.Group(), k = kit(g)
    for (const z of [0.42, 0.55, 0.68]) k.box(w - 0.15, 0.05, 0.11, '#b07a3a', w / 2, 0.42, z)
    k.box(w - 0.15, 0.32, 0.06, '#a16207', w / 2, 0.5, 0.3)
    for (const x of [0.2, w - 0.2]) k.box(0.06, 0.42, 0.5, '#1f2937', x, 0, 0.55)
    return { group: g }
  },
  fountain: () => {
    const g = new THREE.Group(), k = kit(g)
    k.cyl(0.95, 1.0, 0.35, '#a8a29e', 1, 0, 1)
    k.cyl(0.85, 0.85, 0.02, M('#38bdf8', { opacity: 0.85 }), 1, 0.33, 1)
    k.cyl(0.12, 0.16, 0.8, '#d6d3d1', 1, 0.35, 1)
    k.cyl(0.4, 0.3, 0.12, '#a8a29e', 1, 1.1, 1)
    const jet = k.cyl(0.04, 0.12, 0.5, M('#e0f2fe', { opacity: 0.75 }), 1, 1.2, 1)
    return { group: g, tick: t => { jet.scale.y = 0.8 + Math.sin(t * 6) * 0.25 } }
  },
  gazebo: (w, h) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.2, 0.12, h - 0.2, '#d6b88a', w / 2, 0, h / 2)
    for (const [x, z] of [[0.35, 0.35], [w - 0.35, 0.35], [0.35, h - 0.35], [w - 0.35, h - 0.35]]) k.cyl(0.08, 0.08, 1.9, '#f8fafc', x, 0.1, z)
    const roof = k.put(new THREE.ConeGeometry(2.3, 1.0, 4), M('#b45309'), w / 2, 2.5, h / 2)
    roof.rotation.y = Math.PI / 4
    k.box(w - 0.6, 0.08, 0.3, '#a16207', w / 2, 0.45, 0.45)   // ม้านั่งข้างใน
    return { group: g }
  },
  arch: (w) => {
    const g = new THREE.Group(), k = kit(g)
    for (const x of [0.5, w - 0.5]) k.box(0.15, 1.8, 0.15, '#f8fafc', x, 0, 0.5)
    const a = k.put(new THREE.TorusGeometry((w - 1) / 2, 0.07, 6, 18, Math.PI), M('#f8fafc'), w / 2, 1.8, 0.5)
    a.rotation.z = 0
    for (let i = 0; i < 14; i++) {
      const an = (i / 13) * Math.PI
      k.ball(0.09, ['#f472b6', '#fb7185', '#fde047'][i % 3], w / 2 + Math.cos(an) * (w - 1) / 2, 1.8 + Math.sin(an) * (w - 1) / 2, 0.5 + ((i % 2) ? 0.08 : -0.08), 6)
    }
    return { group: g }
  },
  swing: (w, h) => {
    const g = new THREE.Group(), k = kit(g)
    for (const x of [0.25, w - 0.25]) { k.box(0.08, 1.7, 0.08, '#92400e', x, 0, 0.4); k.box(0.08, 1.7, 0.08, '#92400e', x, 0, h - 0.4) }
    k.box(w - 0.3, 0.08, 0.08, '#78350f', w / 2, 1.7, h / 2).scale.z = (h - 0.7) / 0.08
    const seat = new THREE.Group(); seat.position.set(w / 2, 1.7, h / 2); g.add(seat)
    const ks = kit(seat)
    for (const x of [-0.3, 0.3]) ks.box(0.02, 1.2, 0.02, '#d6d3d1', x, -1.2, 0)
    ks.box(0.75, 0.05, 0.3, '#b45309', 0, -1.25, 0)
    return { group: g, tick: t => { seat.rotation.x = Math.sin(t * 1.4) * 0.35 } }
  },
  gardenlamp: () => {
    const g = new THREE.Group(), k = kit(g)
    k.cyl(0.05, 0.08, 1.5, '#1f2937', 0.5, 0, 0.5)
    k.ball(0.14, M('#fef3c7', { emissive: '#fbbf24' }), 0.5, 1.6, 0.5)
    k.cyl(0.16, 0.06, 0.1, '#1f2937', 0.5, 1.72, 0.5)
    return { group: g }
  },
  birdbath: () => {
    const g = new THREE.Group(), k = kit(g)
    k.cyl(0.08, 0.14, 0.6, '#a8a29e', 0.5, 0, 0.5)
    k.cyl(0.35, 0.2, 0.12, '#d6d3d1', 0.5, 0.6, 0.5)
    k.cyl(0.3, 0.3, 0.02, M('#38bdf8', { opacity: 0.85 }), 0.5, 0.7, 0.5)
    const bird = new THREE.Group(); bird.position.set(0.68, 0.75, 0.5); g.add(bird)
    kit(bird).ball(0.06, '#a16207', 0, 0.04, 0).scale.set(1.4, 1, 1)
    kit(bird).ball(0.04, '#92400e', 0.07, 0.08, 0)
    return { group: g, tick: t => { bird.rotation.z = Math.max(0, Math.sin(t * 3)) * 0.5 } }
  },
  picnic: (w, h) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.4, 0.07, 0.9, '#b07a3a', w / 2, 0.7, h / 2)
    for (const z of [0.25, h - 0.25]) k.box(w - 0.4, 0.06, 0.28, '#a16207', w / 2, 0.42, z)
    for (const x of [0.5, w - 0.5]) k.box(0.08, 0.7, 0.8, '#78350f', x, 0, h / 2)
    k.box(0.5, 0.01, 0.5, '#ef4444', w / 2, 0.77, h / 2)
    return { group: g }
  },
  duck: () => {
    const g = new THREE.Group()
    const d = duck(g, 0.5, 0.5)
    return { group: g, tick: t => { d.position.y = 0.02 + Math.sin(t * 2) * 0.02; d.rotation.y = Math.sin(t * 0.5) * 0.8 } }
  },
  stones: (w) => {
    const g = new THREE.Group(), k = kit(g)
    for (const [x, r, c] of [[0.5, 0.3, '#78716c'], [1.0, 0.36, '#a8a29e'], [1.5, 0.25, '#57534e']] as const) k.ball(r, c, x * (w / 2), r * 0.6, 0.5).scale.y = 0.7
    k.ball(0.22, '#4d7c0f', w / 2, 0.38, 0.45).scale.set(1.4, 0.3, 1)
    return { group: g }
  },
  // ═══ สันทนาการ ═══
  pingpong: (w, h) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.2, 0.06, h - 0.3, '#15803d', w / 2, 0.72, h / 2)
    k.box(0.02, 0.15, h - 0.3, '#f8fafc', w / 2, 0.78, h / 2)
    for (const [x, z] of [[0.3, 0.3], [w - 0.3, 0.3], [0.3, h - 0.3], [w - 0.3, h - 0.3]]) k.box(0.06, 0.72, 0.06, '#1f2937', x, 0, z)
    const ball = k.ball(0.04, '#fff7ed', 0, 0.9, h / 2, 8)
    return { group: g, tick: t => { const p = (Math.sin(t * 2.5) + 1) / 2; ball.position.set(0.4 + p * (w - 0.8), 0.85 + Math.abs(Math.sin(t * 5)) * 0.2, h / 2 + Math.sin(t * 1.3) * 0.4) } }
  },
  pool: (w, h) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.1, 0.15, h - 0.1, '#78350f', w / 2, 0.65, h / 2)
    k.box(w - 0.4, 0.02, h - 0.4, '#166534', w / 2, 0.8, h / 2)
    for (const [x, z] of [[0.3, 0.3], [w - 0.3, 0.3], [0.3, h - 0.3], [w - 0.3, h - 0.3]]) k.box(0.15, 0.65, 0.15, '#78350f', x, 0, z)
    ;['#facc15', '#dc2626', '#2563eb', '#7c3aed', '#16a34a', '#ea580c'].forEach((c, i) => k.ball(0.05, c, w * 0.62 + (i % 3) * 0.1, 0.87, h / 2 - 0.1 + Math.floor(i / 3) * 0.1, 8))
    k.ball(0.05, '#fafafa', w * 0.3, 0.87, h / 2, 8)
    return { group: g }
  },
  foosball: (w) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.2, 0.3, 0.8, '#1f2937', w / 2, 0.6, 0.5)
    k.box(w - 0.35, 0.02, 0.65, '#16a34a', w / 2, 0.88, 0.5)
    for (let i = 0; i < 4; i++) k.box(0.03, 0.03, 1.1, '#9ca3af', 0.45 + i * (w - 0.9) / 3, 0.85, 0.5)
    for (const x of [0.3, w - 0.3]) k.box(0.1, 0.6, 0.6, '#111827', x, 0, 0.5)
    return { group: g }
  },
  sofa: (w) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.1, 0.25, 0.75, '#4f46e5', w / 2, 0.15, 0.55)
    k.box(w - 0.1, 0.55, 0.22, '#4338ca', w / 2, 0.15, 0.25)
    for (const x of [0.12, w - 0.12]) k.box(0.2, 0.42, 0.75, '#4338ca', x, 0.15, 0.55)
    for (let i = 0; i < 3; i++) k.box((w - 0.5) / 3 - 0.05, 0.12, 0.6, '#818cf8', 0.25 + (w - 0.5) / 6 + i * (w - 0.5) / 3, 0.4, 0.58)
    k.box(0.3, 0.25, 0.1, '#fbbf24', 0.5, 0.52, 0.42)
    return { group: g }
  },
  hammock: (w) => {
    const g = new THREE.Group(), k = kit(g)
    for (const x of [0.1, w - 0.1]) k.box(0.15, 1.4, 0.15, '#78350f', x, 0, 0.5)
    const bed = new THREE.Group(); bed.position.set(w / 2, 0.75, 0.5); g.add(bed)
    const curve = new THREE.Mesh(new THREE.TorusGeometry(w / 2 - 0.2, 0.18, 6, 20, Math.PI), M('#f97316'))
    curve.rotation.z = Math.PI; curve.scale.set(1, 0.35, 1.6); bed.add(curve)
    return { group: g, tick: t => { bed.rotation.x = Math.sin(t * 1.2) * 0.12 } }
  },
  tvwall: (w) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.3, 0.5, 0.4, '#374151', w / 2, 0, 0.35)
    k.box(w - 0.2, 1.1, 0.08, '#111827', w / 2, 0.85, 0.2)
    const screen = k.box(w - 0.35, 0.95, 0.02, M('#1d4ed8', { emissive: '#1e40af' }), w / 2, 0.92, 0.25)
    const mat = new THREE.MeshLambertMaterial({ color: '#1d4ed8', emissive: '#1e40af' })
    screen.material = mat
    return { group: g, tick: t => { mat.emissive.setHSL(0.6 + Math.sin(t * 0.3) * 0.08, 0.7, 0.25 + Math.sin(t * 1.7) * 0.05) } }
  },
  // ═══ ครัว/คาเฟ่ ═══
  bar: (w) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.1, 1.0, 0.55, '#7c2d12', w / 2, 0, 0.35)
    k.box(w, 0.06, 0.7, '#a16207', w / 2, 1.0, 0.38)
    for (let i = 0; i < w; i++) { k.cyl(0.16, 0.16, 0.05, '#dc2626', i + 0.5, 0.7, 0.85); k.cyl(0.03, 0.03, 0.7, '#9ca3af', i + 0.5, 0, 0.85) }
    return { group: g }
  },
  vending: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.85, 1.8, 0.7, '#dc2626', 0.5, 0, 0.45)
    k.box(0.55, 1.1, 0.02, M('#bae6fd', { emissive: '#0c4a6e', opacity: 0.85 }), 0.4, 0.5, 0.81)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) k.box(0.1, 0.12, 0.1, ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899'][(r + c) % 4], 0.22 + c * 0.17, 0.6 + r * 0.25, 0.7)
    return { group: g }
  },
  bigfridge: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.85, 1.9, 0.7, '#e5e7eb', 0.5, 0, 0.45)
    k.box(0.02, 1.8, 0.02, '#9ca3af', 0.5, 0.05, 0.81)
    for (const x of [0.42, 0.58]) k.box(0.03, 0.4, 0.04, '#6b7280', x, 0.9, 0.83)
    return { group: g }
  },
  microwave: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.85, 0.8, 0.6, '#d6b88a', 0.5, 0, 0.5)
    k.box(0.6, 0.32, 0.45, '#9ca3af', 0.5, 0.8, 0.5)
    k.box(0.36, 0.22, 0.02, M('#111827', { emissive: '#0f172a' }), 0.43, 0.85, 0.74)
    return { group: g }
  },
  fruits: () => {
    const g = new THREE.Group(), k = kit(g)
    k.cyl(0.4, 0.4, 0.05, '#c79a63', 0.5, 0.7, 0.5); k.cyl(0.06, 0.08, 0.7, '#8b6a43', 0.5, 0, 0.5)
    k.cyl(0.25, 0.18, 0.12, '#b45309', 0.5, 0.75, 0.5)
    ;['#ef4444', '#f59e0b', '#84cc16', '#facc15', '#f97316'].forEach((c, i) => k.ball(0.08, c, 0.5 + Math.cos(i * 1.3) * 0.12, 0.92, 0.5 + Math.sin(i * 1.3) * 0.12, 8))
    return { group: g }
  },
  // ═══ สำนักงาน ═══
  printer: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.8, 0.6, 0.6, '#94a3b8', 0.5, 0, 0.5)
    k.box(0.75, 0.3, 0.55, '#e5e7eb', 0.5, 0.6, 0.5)
    k.box(0.5, 0.02, 0.3, '#f8fafc', 0.5, 0.9, 0.6)
    k.box(0.12, 0.05, 0.02, M('#22c55e', { emissive: '#16a34a' }), 0.7, 0.75, 0.78)
    return { group: g }
  },
  cabinet: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.7, 1.3, 0.6, '#94a3b8', 0.5, 0, 0.5)
    for (let i = 0; i < 4; i++) { k.box(0.62, 0.02, 0.01, '#64748b', 0.5, 0.3 + i * 0.3, 0.81); k.box(0.15, 0.03, 0.03, '#475569', 0.5, 0.18 + i * 0.3, 0.82) }
    return { group: g }
  },
  cooler: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.45, 0.95, 0.45, '#e5e7eb', 0.5, 0, 0.5)
    k.cyl(0.18, 0.18, 0.45, M('#7dd3fc', { opacity: 0.7 }), 0.5, 0.95, 0.5)
    k.box(0.08, 0.06, 0.04, '#3b82f6', 0.43, 0.6, 0.74); k.box(0.08, 0.06, 0.04, '#ef4444', 0.57, 0.6, 0.74)
    return { group: g }
  },
  notice: (w) => {
    const g = new THREE.Group(), k = kit(g)
    for (const x of [0.2, w - 0.2]) k.box(0.06, 1.3, 0.06, '#78350f', x, 0, 0.5)
    k.box(w - 0.3, 0.8, 0.06, '#c2895a', w / 2, 0.8, 0.5)
    ;['#fde68a', '#fecaca', '#bfdbfe', '#bbf7d0', '#fde68a'].forEach((c, i) => k.box(0.22, 0.28, 0.01, c, 0.4 + i * (w - 0.8) / 4, 1.0 + (i % 2) * 0.2, 0.54))
    return { group: g }
  },
  logo: (w) => {
    const g = new THREE.Group(), k = kit(g)
    k.box(w - 0.2, 0.2, 0.3, '#334155', w / 2, 0, 0.5)
    k.box(w - 0.2, 0.9, 0.12, '#0f172a', w / 2, 0.6, 0.5)
    const glow = new THREE.MeshLambertMaterial({ color: '#60a5fa', emissive: '#2563eb' })
    k.box(w - 0.6, 0.3, 0.02, glow, w / 2, 0.9, 0.57)
    return { group: g, tick: t => { glow.emissive.setHSL(0.6, 0.8, 0.35 + Math.sin(t * 2) * 0.08) } }
  },
  clock: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.5, 1.9, 0.4, '#78350f', 0.5, 0, 0.5)
    k.cyl(0.18, 0.18, 0.02, '#fef3c7', 0.5, 1.45, 0.71).rotation.x = Math.PI / 2
    const pend = new THREE.Group(); pend.position.set(0.5, 1.15, 0.71); g.add(pend)
    kit(pend).box(0.02, 0.5, 0.02, '#facc15', 0, -0.5, 0)
    kit(pend).ball(0.06, '#facc15', 0, -0.55, 0)
    return { group: g, tick: t => { pend.rotation.z = Math.sin(t * Math.PI) * 0.3 } }
  },
}

/** สร้างสิ่งของชิ้นหนึ่ง (ยังไม่มีแบบ = กล่องสีเทาตามขนาด) */
export function buildProp3D(kind: string, w: number, h: number): Built3D {
  const b = BUILD[kind]
  if (b) return b(w, h)
  const g = new THREE.Group()
  kit(g).box(w - 0.1, 0.8, h - 0.1, '#9ca3af', w / 2, 0, h / 2)
  return { group: g }
}
