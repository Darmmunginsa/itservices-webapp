import * as THREE from 'three'
import { DESK_ITEMS } from './realism3d'

// ── เฟส 3: ของแต่งโต๊ะ 25 ชิ้น · หุ่นยนต์ทำความสะอาด · นกในสวน (มุมมอง 3D) ──
// ทุกชิ้นสร้างในกรอบ 1 ช่อง จุดกำเนิด = กลางช่อง ระดับพื้น (ของบนโต๊ะ ผู้เรียกยกขึ้นไปวางบนหน้าโต๊ะเอง)

const cache = new Map<string, THREE.Material>()
const M = (color: string, emissive?: string, opacity = 1): THREE.Material => {
  const k = `${color}|${emissive ?? ''}|${opacity}`
  let m = cache.get(k)
  if (!m) { m = new THREE.MeshStandardMaterial({ color, emissive: emissive ?? '#000000', roughness: opacity < 1 ? 0.15 : 0.65, metalness: 0, transparent: opacity < 1, opacity }); cache.set(k, m) }
  return m
}

function kit(g: THREE.Group) {
  const put = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m
  }
  return {
    box: (w: number, h: number, d: number, c: string | THREE.Material, x: number, y: number, z: number) => put(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? M(c) : c, x, y + h / 2, z),
    cyl: (rt: number, rb: number, h: number, c: string | THREE.Material, x: number, y: number, z: number, s = 10) => put(new THREE.CylinderGeometry(rt, rb, h, s), typeof c === 'string' ? M(c) : c, x, y + h / 2, z),
    ball: (r: number, c: string | THREE.Material, x: number, y: number, z: number, s = 8) => put(new THREE.SphereGeometry(r, s, Math.max(6, s - 2)), typeof c === 'string' ? M(c) : c, x, y, z),
    cone: (r: number, h: number, c: string | THREE.Material, x: number, y: number, z: number, s = 8) => put(new THREE.ConeGeometry(r, h, s), typeof c === 'string' ? M(c) : c, x, y + h / 2, z),
  }
}

export interface Built { group: THREE.Group; tick?: (t: number) => void }

const plant = (k: ReturnType<typeof kit>, leaf: string, tall: number, pot = '#b45309') => {
  k.cyl(0.14, 0.11, 0.22, pot, 0, 0, 0)
  for (let i = 0; i < 5; i++) k.ball(0.15 + (i % 2) * 0.04, leaf, Math.cos(i * 1.3) * 0.1, 0.3 + tall * (0.4 + (i % 3) * 0.25), Math.sin(i * 1.3) * 0.1)
}

const DECOR: Record<string, () => Built> = {
  // ── บนโต๊ะ (ขนาดเล็ก ราว 0.1–0.3) ──
  mug: () => { const g = new THREE.Group(), k = kit(g); k.cyl(0.06, 0.055, 0.12, '#f8fafc', 0, 0, 0); k.cyl(0.052, 0.052, 0.005, '#6b3a1e', 0, 0.112, 0); const h = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12), M('#f8fafc')); h.position.set(0.07, 0.06, 0); g.add(h); const steam = k.cyl(0.006, 0.012, 0.08, M('#ffffff', undefined, 0.45), 0, 0.13, 0); return { group: g, tick: t => { steam.position.y = 0.17 + (t % 1.5) * 0.04; (steam.material as THREE.MeshStandardMaterial).opacity = 0.45 * (1 - (t % 1.5) / 1.5) } } },
  laptop: () => { const g = new THREE.Group(), k = kit(g); k.box(0.36, 0.02, 0.25, '#cbd5e1', 0, 0, 0); for (let r = 0; r < 3; r++) k.box(0.3, 0.003, 0.04, '#334155', 0, 0.02, -0.05 + r * 0.05); k.box(0.1, 0.003, 0.05, '#94a3b8', 0, 0.02, 0.09); const s = k.box(0.36, 0.24, 0.012, '#94a3b8', 0, 0.02, -0.12); s.rotation.x = -0.25; const scr = k.box(0.32, 0.2, 0.004, M('#1e3a8a', '#2563eb'), 0, 0.035, -0.11); scr.rotation.x = -0.25; return { group: g } },
  dualscreen: () => { const g = new THREE.Group(), k = kit(g); for (const x of [-0.2, 0.2]) { k.box(0.36, 0.24, 0.02, M('#1e293b'), x, 0.12, -0.1); k.box(0.32, 0.2, 0.005, M('#2563eb', '#1e40af'), x, 0.14, -0.088) } k.box(0.06, 0.12, 0.06, '#334155', 0, 0, -0.1); return { group: g } },
  lamp: () => { const g = new THREE.Group(), k = kit(g); k.cyl(0.07, 0.08, 0.02, '#1f2937', 0, 0, 0); const a1 = k.cyl(0.01, 0.01, 0.2, '#1f2937', 0.03, 0.02, 0); a1.rotation.z = -0.3; const a2 = k.cyl(0.01, 0.01, 0.16, '#1f2937', 0.08, 0.2, 0); a2.rotation.z = 0.9; const head = k.cyl(0.03, 0.07, 0.08, M('#1f2937'), 0.15, 0.24, 0); head.rotation.z = 2.4; k.ball(0.025, M('#fef3c7', '#fbbf24'), 0.17, 0.22, 0, 8); return { group: g } },
  photo: () => { const g = new THREE.Group(), k = kit(g); const f = k.box(0.16, 0.2, 0.02, '#b45309', 0, 0, 0); f.rotation.x = -0.2; k.box(0.12, 0.15, 0.005, '#7dd3fc', 0, 0.025, 0.012); return { group: g } },
  books: () => { const g = new THREE.Group(), k = kit(g); ['#dc2626', '#2563eb', '#16a34a', '#f59e0b'].forEach((c, i) => k.box(0.26 - i * 0.02, 0.04, 0.18, c, 0, i * 0.04, 0)); return { group: g } },
  cactus: () => { const g = new THREE.Group(), k = kit(g); k.cyl(0.06, 0.05, 0.07, '#c2410c', 0, 0, 0); k.cyl(0.035, 0.04, 0.16, '#16a34a', 0, 0.07, 0); k.cyl(0.02, 0.02, 0.07, '#16a34a', 0.05, 0.13, 0); return { group: g } },
  headphones: () => { const g = new THREE.Group(), k = kit(g); const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 14, Math.PI), M('#111827')); t.position.y = 0.06; t.rotation.x = Math.PI / 2; g.add(t); for (const x of [-0.1, 0.1]) k.cyl(0.04, 0.04, 0.03, '#ef4444', x, 0.04, 0); return { group: g } },
  trophy: () => { const g = new THREE.Group(), k = kit(g); k.box(0.1, 0.04, 0.1, '#78350f', 0, 0, 0); k.cyl(0.015, 0.015, 0.08, '#facc15', 0, 0.04, 0); k.cyl(0.07, 0.03, 0.1, M('#facc15', '#a16207'), 0, 0.12, 0); return { group: g } },
  duck: () => { const g = new THREE.Group(), k = kit(g); k.ball(0.07, '#facc15', 0, 0.06, 0).scale.set(1.3, 0.9, 1); k.ball(0.045, '#facc15', 0.06, 0.14, 0); k.box(0.04, 0.015, 0.03, '#f97316', 0.11, 0.13, 0); return { group: g } },
  sticky: () => { const g = new THREE.Group(), k = kit(g); ['#fde047', '#f9a8d4', '#86efac'].forEach((c, i) => k.box(0.08, 0.004, 0.08, c, -0.06 + i * 0.06, i * 0.004, (i % 2) * 0.04)); return { group: g } },
  globe: () => { const g = new THREE.Group(), k = kit(g); k.cyl(0.05, 0.06, 0.02, '#78350f', 0, 0, 0); k.cyl(0.008, 0.008, 0.06, '#9ca3af', 0, 0.02, 0); const s = k.ball(0.08, '#3b82f6', 0, 0.16, 0, 12); return { group: g, tick: t => { s.rotation.y = t * 0.6 } } },
  // ── วางพื้น (ขนาดเต็มช่อง) ──
  monstera: () => { const g = new THREE.Group(); plant(kit(g), '#15803d', 0.8); return { group: g } },
  fern: () => { const g = new THREE.Group(); plant(kit(g), '#4d9a3c', 0.5); return { group: g } },
  snake: () => { const g = new THREE.Group(), k = kit(g); k.cyl(0.14, 0.11, 0.22, '#e7e5e4', 0, 0, 0); for (let i = 0; i < 6; i++) { const l = k.box(0.06, 0.55 + (i % 3) * 0.12, 0.02, i % 2 ? '#3f6212' : '#65a30d', Math.cos(i) * 0.06, 0.2, Math.sin(i) * 0.06); l.rotation.y = i } return { group: g } },
  bookshelf: () => { const g = new THREE.Group(), k = kit(g); k.box(0.85, 1.5, 0.35, '#92400e', 0, 0, -0.25); for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) k.box(0.08, 0.26, 0.24, ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#f8fafc'][(r + i) % 6], -0.3 + i * 0.12, 0.08 + r * 0.36, -0.12); return { group: g } },
  rug: () => { const g = new THREE.Group(), k = kit(g); k.cyl(0.46, 0.46, 0.01, '#f472b6', 0, 0.005, 0, 24); k.cyl(0.32, 0.32, 0.011, '#fbcfe8', 0, 0.006, 0, 24); return { group: g } },
  beanbag: () => { const g = new THREE.Group(), k = kit(g); k.ball(0.4, '#f97316', 0, 0.22, 0, 14).scale.set(1, 0.6, 1); k.ball(0.25, '#ea580c', 0, 0.38, -0.2, 12).scale.set(1.2, 0.8, 0.7); return { group: g } },
  floorlamp: () => { const g = new THREE.Group(), k = kit(g); k.cyl(0.16, 0.18, 0.04, '#1f2937', 0, 0, 0); k.cyl(0.02, 0.02, 1.4, '#1f2937', 0, 0.04, 0); k.cyl(0.12, 0.22, 0.25, M('#fef3c7', '#f59e0b'), 0, 1.4, 0); return { group: g } },
  fridge: () => { const g = new THREE.Group(), k = kit(g); k.box(0.55, 0.85, 0.5, '#e5e7eb', 0, 0, -0.1); k.box(0.03, 0.3, 0.03, '#6b7280', 0.2, 0.45, 0.16); k.box(0.12, 0.08, 0.005, '#f472b6', -0.1, 0.6, 0.155); return { group: g } },
  aquarium: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.88, 0.5, 0.42, '#1f2937', 0, 0, -0.2)
    k.box(0.85, 0.05, 0.38, '#d6c7a1', 0, 0.5, -0.2)   // กรวด
    k.box(0.85, 0.48, 0.4, M('#7dd3fc', undefined, 0.35), 0, 0.5, -0.2)
    k.box(0.88, 0.04, 0.42, '#1f2937', 0, 0.98, -0.2)
    for (const x of [-0.3, 0.25]) for (let i = 0; i < 3; i++) { const w = k.box(0.02, 0.18 + i * 0.05, 0.01, '#16a34a', x + i * 0.04, 0.55, -0.25); w.rotation.z = (i - 1) * 0.2 }
    k.ball(0.06, '#a8a29e', 0.05, 0.57, -0.15, 8)
    const fish = [0, 1, 2].map(i => k.ball(0.035, ['#f97316', '#facc15', '#ef4444'][i], 0, 0.75, -0.2, 8))
    fish.forEach(f => f.scale.set(1.8, 1, 0.6))
    const bubbles = [0, 1, 2, 3].map(i => k.ball(0.012, M('#ffffff', undefined, 0.7), 0.3, 0.6, -0.15 + i * 0.01, 6))
    return { group: g, tick: t => {
      fish.forEach((f, i) => { f.position.x = Math.sin(t * (0.6 + i * 0.2) + i) * 0.32; f.position.y = 0.65 + i * 0.09 + Math.sin(t + i) * 0.03; f.rotation.y = Math.cos(t * (0.6 + i * 0.2) + i) > 0 ? 0 : Math.PI })
      bubbles.forEach((b, i) => { b.position.y = 0.58 + ((t * 0.25 + i * 0.25) % 1) * 0.38 })
    } }
  },
  guitar: () => { const g = new THREE.Group(), k = kit(g); k.box(0.3, 0.04, 0.2, '#1f2937', 0, 0, 0); const b1 = k.ball(0.18, M('#c2410c'), 0, 0.3, 0, 14); b1.scale.set(1, 1.15, 0.35); const b2 = k.ball(0.13, M('#c2410c'), 0, 0.52, 0, 14); b2.scale.set(1, 1, 0.35); k.cyl(0.05, 0.05, 0.012, '#111827', 0, 0.42, 0.06).rotation.x = Math.PI / 2; k.box(0.05, 0.55, 0.03, '#78350f', 0, 0.6, 0); k.box(0.08, 0.13, 0.03, '#3f2a1c', 0, 1.15, 0); for (let i = 0; i < 4; i++) k.box(0.003, 0.75, 0.003, '#e5e7eb', -0.015 + i * 0.01, 0.32, 0.065); return { group: g } },
  cat: () => { const g = new THREE.Group(), k = kit(g); const body = k.ball(0.2, '#f59e0b', 0, 0.12, 0, 14); body.scale.set(1.3, 0.6, 1); for (let i = 0; i < 3; i++) { const st = k.box(0.04, 0.005, 0.2, '#c2410c', -0.12 + i * 0.1, 0.235, 0); st.rotation.y = 0.3 } const head = k.ball(0.11, '#f59e0b', 0.22, 0.14, 0.06, 12); for (const z of [0.0, 0.11]) k.cone(0.035, 0.07, '#f59e0b', 0.24, 0.22, z, 6); k.box(0.05, 0.005, 0.02, '#111827', 0.3, 0.15, 0.03); const tail = k.cyl(0.03, 0.03, 0.3, '#f59e0b', -0.25, 0.05, 0.12, 8); tail.rotation.set(Math.PI / 2, 0, 0.5); return { group: g, tick: t => { body.scale.y = 0.6 + Math.sin(t * 1.5) * 0.03; head.position.y = 0.14 + Math.sin(t * 1.5) * 0.005; tail.rotation.z = 0.5 + Math.sin(t * 0.8) * 0.25 } } },
  arcade: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.62, 1.55, 0.55, '#6d28d9', 0, 0, -0.15)
    k.box(0.64, 0.25, 0.57, M('#111827', '#7c3aed'), 0, 1.3, -0.15)   // ป้ายไฟด้านบน
    const scr = new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#0891b2', roughness: 0.2 })
    const s = k.box(0.45, 0.35, 0.02, scr, 0, 0.88, 0.13); s.rotation.x = -0.2
    k.box(0.56, 0.06, 0.28, '#111827', 0, 0.72, 0.18)
    k.cyl(0.012, 0.012, 0.08, '#e5e7eb', -0.15, 0.78, 0.2); k.ball(0.03, '#ef4444', -0.15, 0.86, 0.2)
    ;['#ef4444', '#facc15', '#22c55e', '#3b82f6'].forEach((c, i) => k.cyl(0.022, 0.022, 0.015, M(c, c), 0.02 + (i % 2) * 0.07, 0.78, 0.15 + Math.floor(i / 2) * 0.06))
    return { group: g, tick: t => { scr.emissive.setHSL(((t * 0.2) % 1), 0.8, 0.35 + Math.sin(t * 6) * 0.05) } }
  },
  bike: () => {
    const g = new THREE.Group(), k = kit(g)
    const wheel = (x: number) => {
      const w = new THREE.Group(); w.position.set(x, 0.22, 0); g.add(w)
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), M('#111827')); w.add(tire)
      for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.38, 0.005), M('#d1d5db')); sp.rotation.z = (i / 6) * Math.PI; w.add(sp) }
    }
    wheel(-0.32); wheel(0.32)
    const f1 = k.box(0.5, 0.03, 0.03, '#dc2626', 0, 0.38, 0); f1.rotation.z = 0.15
    const f2 = k.box(0.03, 0.3, 0.03, '#dc2626', -0.05, 0.22, 0); f2.rotation.z = 0.3
    const f3 = k.box(0.03, 0.32, 0.03, '#dc2626', 0.28, 0.2, 0); f3.rotation.z = -0.3
    k.box(0.13, 0.03, 0.07, '#111827', -0.12, 0.5, 0)   // อาน
    k.box(0.03, 0.03, 0.3, '#374151', 0.33, 0.55, 0)   // แฮนด์
    k.cyl(0.04, 0.04, 0.02, '#374151', -0.02, 0.18, 0.05).rotation.x = Math.PI / 2
    return { group: g }
  },
}

export function buildDecor3D(kind: string): Built {
  const real = DESK_ITEMS[kind]   // รุ่นละเอียด (ของบนโต๊ะ) มาก่อน
  if (real) return real()
  const b = DECOR[kind]
  if (b) return b()
  const g = new THREE.Group(); kit(g).box(0.3, 0.3, 0.3, '#9ca3af', 0, 0, 0)
  return { group: g }
}

// ── หุ่นยนต์ทำความสะอาด ──
export interface RobotRig { group: THREE.Group; broom: THREE.Object3D; cup: THREE.Object3D; legL: THREE.Object3D; legR: THREE.Object3D; arm: THREE.Object3D }
export function buildRobot3D(): RobotRig {
  const g = new THREE.Group(), k = kit(g)
  const leg = (x: number) => { const p = new THREE.Group(); p.position.set(x, 0.32, 0); g.add(p); kit(p).box(0.09, 0.32, 0.09, '#64748b', 0, -0.32, 0); return p }
  const legL = leg(-0.08), legR = leg(0.08)
  k.box(0.38, 0.36, 0.28, '#e2e8f0', 0, 0.32, 0)
  k.box(0.18, 0.12, 0.01, M('#0ea5e9', '#0369a1'), 0, 0.42, 0.145)
  k.box(0.34, 0.26, 0.28, '#f1f5f9', 0, 0.7, 0)
  k.box(0.26, 0.1, 0.01, '#1e293b', 0, 0.78, 0.145)
  for (const x of [-0.06, 0.06]) k.ball(0.025, M('#67e8f9', '#22d3ee'), x, 0.83, 0.15)
  k.cyl(0.01, 0.01, 0.12, '#94a3b8', 0, 0.96, 0); k.ball(0.03, M('#ef4444', '#dc2626'), 0, 1.09, 0)
  const arm = new THREE.Group(); arm.position.set(0.22, 0.6, 0); g.add(arm)
  kit(arm).box(0.07, 0.25, 0.07, '#cbd5e1', 0, -0.25, 0)
  const broom = new THREE.Group(); arm.add(broom)
  const kb = kit(broom)
  const stick = kb.box(0.025, 0.75, 0.025, '#a16207', 0, -0.6, 0.12); stick.rotation.x = 0.5
  kb.box(0.22, 0.12, 0.06, '#facc15', 0, -0.62, 0.42)
  const cup = new THREE.Group(); cup.position.set(0, -0.3, 0.12); arm.add(cup)
  kit(cup).cyl(0.05, 0.04, 0.1, '#f8fafc', 0, 0, 0); kit(cup).cyl(0.045, 0.045, 0.01, '#92400e', 0, 0.09, 0)
  return { group: g, broom, cup, legL, legR, arm }
}

// ── นกกระจอก ──
export interface BirdRig { group: THREE.Group; head: THREE.Object3D }
export function buildBird3D(): BirdRig {
  const g = new THREE.Group(), k = kit(g)
  k.ball(0.08, '#a16207', 0, 0.07, 0).scale.set(1.4, 0.9, 1)
  k.ball(0.05, '#fef3c7', 0.02, 0.05, 0).scale.set(1.2, 0.8, 0.9)
  k.box(0.07, 0.02, 0.03, '#78350f', -0.12, 0.09, 0)
  const head = new THREE.Group(); head.position.set(0.09, 0.12, 0); g.add(head)
  const kh = kit(head)
  kh.ball(0.045, '#92400e', 0, 0, 0); kh.box(0.03, 0.012, 0.015, '#f59e0b', 0.05, -0.005, 0); kh.ball(0.008, '#111827', 0.03, 0.015, 0.03, 6)
  return { group: g, head }
}
