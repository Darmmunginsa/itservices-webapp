import * as THREE from 'three'

// ── รายละเอียดเพิ่ม (มุมมอง 3D): ต้นไม้ 9 พันธุ์ · โต๊ะ 9 แบบ · พุ่มไม้ · แปลงดอกไม้ · น้ำไหล ──
// ทรงการ์ตูนแต่ละเอียดขึ้น · วัสดุแชร์ต่อสี · ชิ้นที่ขยับได้คืน tick

const cache = new Map<string, THREE.Material>()
export const MAT = (color: string, o: { r?: number; m?: number; e?: string; op?: number } = {}): THREE.Material => {
  const k = `${color}|${o.r ?? 0.7}|${o.m ?? 0}|${o.e ?? ''}|${o.op ?? 1}`
  let m = cache.get(k)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.7, metalness: o.m ?? 0, emissive: o.e ?? '#000000', transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1 })
    cache.set(k, m)
  }
  return m
}

type C = string | THREE.Material
const mat = (c: C) => (typeof c === 'string' ? MAT(c) : c)

function kit(g: THREE.Object3D) {
  const put = (geo: THREE.BufferGeometry, c: C, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m
  }
  return {
    put,
    box: (w: number, h: number, d: number, c: C, x: number, y: number, z: number) => put(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z),
    cyl: (rt: number, rb: number, h: number, c: C, x: number, y: number, z: number, s = 14) => put(new THREE.CylinderGeometry(rt, rb, h, s), c, x, y + h / 2, z),
    ball: (r: number, c: C, x: number, y: number, z: number, s = 12) => put(new THREE.SphereGeometry(r, s, Math.max(8, s - 2)), c, x, y, z),
    cone: (r: number, h: number, c: C, x: number, y: number, z: number, s = 12) => put(new THREE.ConeGeometry(r, h, s), c, x, y + h / 2, z),
  }
}

const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

/** ใบไม้หนึ่งใบ (วงรีแบน) ชี้ออกจากจุดกำเนิดตามมุม */
function leaf(g: THREE.Object3D, color: C, len: number, wid: number, yaw: number, pitch: number, y: number) {
  const pivot = new THREE.Group(); pivot.position.y = y; pivot.rotation.y = yaw; g.add(pivot)
  const arm = new THREE.Group(); arm.rotation.x = pitch; pivot.add(arm)
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat(color))
  m.scale.set(wid, 0.02, len); m.position.z = len; m.castShadow = true
  arm.add(m)
  return pivot
}

/** กระถางเซรามิก: ทรงเรียว + ขอบปาก + ดิน */
function pot(k: ReturnType<typeof kit>, color: string, r = 0.2, h = 0.32) {
  k.cyl(r, r * 0.75, h, MAT(color, { r: 0.4 }), 0, 0, 0)
  k.cyl(r * 1.08, r * 1.08, 0.04, MAT(color, { r: 0.4 }), 0, h - 0.02, 0)
  k.cyl(r * 0.95, r * 0.95, 0.02, '#4a2f1c', 0, h - 0.01, 0)
}

// ═════════ ต้นไม้ 9 พันธุ์ (ตัวอักษรเดียวกับผัง 2D) ═════════
const PLANTS: Record<string, () => THREE.Group> = {
  // มอนสเตอร่า — ใบใหญ่แผ่ออกรอบทิศ
  P: () => { const g = new THREE.Group(), k = kit(g); pot(k, '#e7e5e4'); for (let i = 0; i < 9; i++) leaf(g, i % 2 ? '#166534' : '#15803d', 0.3 + (i % 3) * 0.06, 0.2, i * 0.7, -0.5 - (i % 3) * 0.25, 0.4 + (i % 4) * 0.12); return g },
  // ปาล์ม — ลำต้นเป็นปล้อง + ทางใบโค้ง
  G: () => {
    const g = new THREE.Group(), k = kit(g); pot(k, '#c2410c', 0.24, 0.36)
    for (let i = 0; i < 7; i++) k.cyl(0.07 - i * 0.004, 0.08 - i * 0.004, 0.2, '#8b5e34', Math.sin(i * 0.4) * 0.03, 0.34 + i * 0.19, 0)
    for (let i = 0; i < 8; i++) leaf(g, i % 2 ? '#3f9d4b' : '#2f8a3f', 0.55, 0.09, i * 0.8, 0.35, 1.68)
    return g
  },
  // ไผ่ — หลายลำ มีข้อ + ใบเล็กเรียว
  Y: () => {
    const g = new THREE.Group(), k = kit(g); k.box(0.5, 0.18, 0.5, MAT('#78716c', { r: 0.9 }), 0, 0, 0)
    for (let s = 0; s < 5; s++) {
      const x = Math.cos(s * 1.3) * 0.13, z = Math.sin(s * 1.3) * 0.13, h = 1.2 + (s % 3) * 0.3
      k.cyl(0.025, 0.03, h, '#65a30d', x, 0.18, z)
      for (let n = 1; n < 5; n++) k.cyl(0.032, 0.032, 0.02, '#4d7c0f', x, 0.18 + n * h / 5, z)
      for (let l = 0; l < 3; l++) leaf(g, '#84cc16', 0.16, 0.035, s + l * 2.1, -0.9, 0.18 + h * (0.6 + l * 0.15)).position.set(x, 0.18 + h * (0.6 + l * 0.15), z)
    }
    return g
  },
  // ไทรใบสัก — ลำต้นตรง ใบกลมใหญ่ซ้อนชั้น
  L: () => {
    const g = new THREE.Group(), k = kit(g); pot(k, '#f8fafc', 0.2, 0.34)
    k.cyl(0.035, 0.045, 0.9, '#6b4423', 0, 0.32, 0)
    for (let i = 0; i < 14; i++) { const m = k.ball(0.13, i % 3 ? '#3f7d3a' : '#2e6b2e', Math.cos(i * 1.7) * 0.18, 0.75 + (i % 5) * 0.12, Math.sin(i * 1.7) * 0.18, 10); m.scale.set(1, 0.35, 0.8); m.rotation.set(0.6, i, 0) }
    return g
  },
  // เฟื่องฟ้า — พุ่มเขียวมีดอกชมพูบานแซม
  R: () => {
    const g = new THREE.Group(), k = kit(g); pot(k, '#b45309', 0.22, 0.3)
    const R = rnd(5)
    for (let i = 0; i < 7; i++) k.ball(0.2 + R() * 0.07, i % 2 ? '#3f9d4b' : '#4caf50', (R() - 0.5) * 0.35, 0.52 + R() * 0.35, (R() - 0.5) * 0.35, 10)
    for (let i = 0; i < 26; i++) k.ball(0.05, ['#db2777', '#ec4899', '#f472b6'][i % 3], (R() - 0.5) * 0.55, 0.45 + R() * 0.55, (R() - 0.5) * 0.55, 6)
    return g
  },
  // กระบองเพชรยักษ์ — ลำหลัก + 2 แขน มีร่อง
  U: () => {
    const g = new THREE.Group(), k = kit(g); pot(k, '#d6b88a', 0.24, 0.26)
    const ribbed = (r: number, h: number, x: number, y: number, z: number) => { const m = k.put(new THREE.CylinderGeometry(r, r, h, 10), MAT('#3f8f4a', { r: 0.6 }), x, y + h / 2, z); k.ball(r, '#3f8f4a', x, y + h, z, 10); return m }
    ribbed(0.11, 1.2, 0, 0.24, 0)
    k.cyl(0.07, 0.07, 0.22, '#3f8f4a', -0.17, 0.75, 0).rotation.z = Math.PI / 2
    ribbed(0.07, 0.35, -0.28, 0.78, 0)
    k.cyl(0.07, 0.07, 0.2, '#3f8f4a', 0.16, 0.6, 0).rotation.z = Math.PI / 2
    ribbed(0.07, 0.3, 0.26, 0.62, 0)
    for (let i = 0; i < 3; i++) k.ball(0.03, '#fde047', Math.cos(i * 2) * 0.05, 1.47, Math.sin(i * 2) * 0.05, 6)
    return g
  },
  // บอนไซ — กระถางถาดตื้น ลำต้นบิด ใบเป็นแผ่น
  Z: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.6, 0.1, 0.4, MAT('#334155', { r: 0.4 }), 0, 0.2, 0); k.box(0.66, 0.2, 0.46, '#7c5c3e', 0, 0, 0)
    const t1 = k.cyl(0.04, 0.06, 0.35, '#5b3a22', -0.05, 0.3, 0); t1.rotation.z = 0.4
    const t2 = k.cyl(0.03, 0.04, 0.3, '#5b3a22', 0.05, 0.55, 0); t2.rotation.z = -0.6
    for (const [x, y, z, s] of [[-0.18, 0.66, 0, 1.2], [0.18, 0.78, 0.05, 1], [0.02, 0.9, -0.05, 0.8]] as const) { const p = k.ball(0.15, '#2f6b2f', x, y, z, 10); p.scale.set(s * 1.2, 0.45, s) }
    return g
  },
  // สน — ชั้นใบทรงกรวยซ้อน 3 ชั้น
  N: () => {
    const g = new THREE.Group(), k = kit(g); pot(k, '#7c2d12', 0.22, 0.28)
    k.cyl(0.05, 0.06, 0.4, '#5b3a22', 0, 0.28, 0)
    ;[[0.42, 0.55, 0.5], [0.34, 0.5, 0.85], [0.24, 0.42, 1.15]].forEach(([r, h, y], i) => k.cone(r, h, i % 2 ? '#14532d' : '#166534', 0, y, 0, 10))
    k.ball(0.04, '#fde047', 0, 1.6, 0, 6)
    return g
  },
  // ลีลาวดี — กิ่งแตกเป็นง่าม ปลายกิ่งมีพุ่มใบและดอกขาวเหลือง
  J: () => {
    const g = new THREE.Group(), k = kit(g); pot(k, '#a16207', 0.24, 0.3)
    k.cyl(0.05, 0.07, 0.55, '#9a8478', 0, 0.3, 0)
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1, bx = Math.cos(a) * 0.22, bz = Math.sin(a) * 0.22
      const br = k.cyl(0.03, 0.04, 0.45, '#9a8478', bx / 2, 0.75, bz / 2); br.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6)
      for (let l = 0; l < 6; l++) leaf(g, '#3f7d3a', 0.17, 0.06, l * 1.05, -0.6, 1.15).position.set(bx, 1.15, bz)
      for (let f = 0; f < 4; f++) { k.ball(0.035, '#fefce8', bx + Math.cos(f * 1.6) * 0.06, 1.2, bz + Math.sin(f * 1.6) * 0.06, 6); k.ball(0.015, '#facc15', bx + Math.cos(f * 1.6) * 0.06, 1.23, bz + Math.sin(f * 1.6) * 0.06, 5) }
    }
    return g
  },
}
export function buildPlant3D(ch: string): THREE.Group | null { return PLANTS[ch]?.() ?? null }

// ═════════ พุ่มไม้ (h) + แปลงดอกไม้ (f) ═════════
export function buildHedge3D(seed: number): THREE.Group {
  const g = new THREE.Group(), k = kit(g), R = rnd(seed * 31 + 7)
  k.box(0.98, 0.45, 0.98, MAT('#2f7a3a', { r: 0.95 }), 0, 0, 0)
  for (let i = 0; i < 9; i++) k.ball(0.22 + R() * 0.08, i % 3 ? '#2f7a3a' : '#3c8f45', (R() - 0.5) * 0.7, 0.5 + R() * 0.12, (R() - 0.5) * 0.7, 9)
  if (R() < 0.35) for (let i = 0; i < 5; i++) k.ball(0.035, '#fafafa', (R() - 0.5) * 0.7, 0.7, (R() - 0.5) * 0.7, 5)
  return g
}
export function buildFlowerBed3D(seed: number): THREE.Group {
  const g = new THREE.Group(), k = kit(g), R = rnd(seed * 17 + 3)
  k.box(0.96, 0.12, 0.96, MAT('#5a3820', { r: 1 }), 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const x = (R() - 0.5) * 0.75, z = (R() - 0.5) * 0.75, h = 0.15 + R() * 0.15
    k.cyl(0.01, 0.01, h, '#3f7d3a', x, 0.12, z, 5)
    const col = ['#f472b6', '#facc15', '#a78bfa', '#fb7185', '#f97316', '#fafafa'][Math.floor(R() * 6)]
    const head = k.ball(0.06, col, x, 0.12 + h, z, 7); head.scale.y = 0.55
  }
  return g
}

// ═════════ น้ำไหล (ใช้กับพื้นน้ำ + บ่อ) ═════════
export function waterMaterial(tex: THREE.Texture): { material: THREE.MeshStandardMaterial; tick: (t: number) => void } {
  const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true
  const material = new THREE.MeshStandardMaterial({ map: t, color: '#ffffff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9, envMapIntensity: 1.6 })
  return { material, tick: (time: number) => { t.offset.set(Math.sin(time * 0.15) * 0.08, time * 0.05); material.opacity = 0.86 + Math.sin(time * 1.3) * 0.04 } }
}

// ═════════ โต๊ะส่วนตัว 9 แบบ ═════════
// กรอบในชิ้น: ศูนย์กลางโต๊ะ 3×3 = (0,0) · หน้าโต๊ะ 6 ช่อง: x -1.5..1.5, z -1.5..0.5 · เก้าอี้ที่ z = +1 (หันเข้าโต๊ะ)
function officeChair(k: ReturnType<typeof kit>, seat: string, back: string, high = false) {
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.box(0.04, 0.03, 0.26, MAT('#1f2937', { m: 0.6, r: 0.3 }), Math.cos(a) * 0.12, 0.02, 1 + Math.sin(a) * 0.12).rotation.y = -a }
  k.cyl(0.025, 0.025, 0.35, MAT('#9ca3af', { m: 0.8, r: 0.25 }), 0, 0.04, 1)
  k.box(0.46, 0.08, 0.44, MAT(seat, { r: 0.55 }), 0, 0.42, 1)
  k.box(0.44, high ? 0.75 : 0.5, 0.07, MAT(back, { r: 0.55 }), 0, 0.5, 1.22)
  for (const x of [-0.24, 0.24]) k.box(0.04, 0.04, 0.3, '#1f2937', x, 0.62, 1.02)
}
function monitor(k: ReturnType<typeof kit>, x: number, z: number, w = 0.62, curved = false) {
  k.box(0.18, 0.02, 0.12, '#1f2937', x, 0.77, z)
  k.box(0.03, 0.2, 0.03, '#334155', x, 0.77, z)
  const s = k.box(w, 0.36, 0.035, MAT('#111827', { r: 0.3 }), x, 0.92, z)
  if (curved) s.scale.x = 1.15
  k.box(w - 0.05, 0.31, 0.005, MAT('#1e40af', { e: '#1d4ed8', r: 0.15 }), x, 0.945, z + 0.02)
}
function keyboard(k: ReturnType<typeof kit>, x: number, z: number, rgb = false) {
  k.box(0.42, 0.025, 0.14, rgb ? MAT('#111827', { e: '#6d28d9' }) : '#e5e7eb', x, 0.77, z)
  k.box(0.06, 0.02, 0.09, rgb ? '#111827' : '#e5e7eb', x + 0.32, 0.77, z)
}

export function buildDesk3D(style: string): { group: THREE.Group; tick?: (t: number) => void } {
  const g = new THREE.Group(), k = kit(g)
  const top = (c: C, y = 0.72, th = 0.06, x0 = -1.45, x1 = 1.45, z0 = -1.4, z1 = 0.45) => k.box(x1 - x0, th, z1 - z0, c, (x0 + x1) / 2, y, (z0 + z1) / 2)
  const legs = (c: C, h = 0.72, r = 0.035, inset = 0.12) => { for (const [x, z] of [[-1.45 + inset, -1.4 + inset], [1.45 - inset, -1.4 + inset], [-1.45 + inset, 0.45 - inset], [1.45 - inset, 0.45 - inset]]) k.cyl(r, r, h, c, x, 0, z, 10) }
  let tick: ((t: number) => void) | undefined
  switch (style) {
    case 'white':
      top(MAT('#f8fafc', { r: 0.35 })); legs(MAT('#111827', { m: 0.7, r: 0.3 }), 0.72, 0.025)
      monitor(k, 0, -0.9); keyboard(k, 0, -0.2); officeChair(k, '#e5e7eb', '#f8fafc'); break
    case 'standing': {
      top(MAT('#d6b88a', { r: 0.5 }), 0.98)
      for (const x of [-1.1, 1.1]) { k.box(0.1, 0.98, 0.1, MAT('#9ca3af', { m: 0.7, r: 0.3 }), x, 0, -0.45); k.box(0.12, 0.04, 1.4, '#374151', x, 0, -0.45) }
      k.box(0.1, 0.03, 0.04, MAT('#22c55e', { e: '#16a34a' }), 1.2, 1.0, 0.43)
      const g2 = new THREE.Group(); g2.position.y = 0.21; g.add(g2); monitor(kit(g2), 0, -0.9); keyboard(kit(g2), 0, -0.2)
      k.cyl(0.18, 0.18, 0.55, '#334155', 0, 0, 1)   // เก้าอี้สตูลสูง
      k.cyl(0.2, 0.2, 0.06, '#475569', 0, 0.55, 1)
      break
    }
    case 'gaming': {
      top(MAT('#111827', { r: 0.25 })); legs('#111827', 0.72, 0.04)
      const rgb = new THREE.MeshStandardMaterial({ color: '#ec4899', emissive: '#ec4899', roughness: 0.3 })
      k.box(2.9, 0.02, 0.02, rgb, 0, 0.72, 0.46)
      monitor(k, 0, -0.9, 0.9, true); keyboard(k, 0, -0.2, true)
      k.box(0.12, 0.3, 0.12, MAT('#111827', { e: '#2563eb' }), -1.15, 0.78, -1.0)   // ลำโพงไฟ
      k.box(0.12, 0.3, 0.12, MAT('#111827', { e: '#2563eb' }), 1.15, 0.78, -1.0)
      officeChair(k, '#dc2626', '#111827', true)
      tick = t => { rgb.color.setHSL((t * 0.15) % 1, 0.9, 0.55); rgb.emissive.setHSL((t * 0.15) % 1, 0.9, 0.45) }
      break
    }
    case 'executive':
      top(MAT('#5b2a12', { r: 0.25 }), 0.72, 0.08)
      k.box(2.8, 0.66, 0.05, MAT('#4a2210', { r: 0.4 }), 0, 0.04, -1.38)   // แผงหน้าโต๊ะ
      for (const x of [-1.15, 1.15]) k.box(0.5, 0.7, 1.7, MAT('#4a2210', { r: 0.4 }), x, 0.02, -0.47)
      k.box(0.8, 0.005, 0.5, '#14532d', 0, 0.8, -0.4)   // แผ่นรองเขียนหนัง
      monitor(k, -0.6, -1.0); k.cyl(0.05, 0.05, 0.12, MAT('#facc15', { m: 0.8, r: 0.2 }), 0.9, 0.8, -1.0)
      officeChair(k, '#3f2a1c', '#3f2a1c', true); break
    case 'lshape':
      top(MAT('#c79a63', { r: 0.45 })); top(MAT('#c79a63', { r: 0.45 }), 0.72, 0.06, 0.9, 1.45, 0.45, 1.4)
      legs('#475569', 0.72, 0.03)
      monitor(k, -0.45, -0.95); monitor(k, 0.35, -0.95); keyboard(k, 0, -0.2); officeChair(k, '#334155', '#1e293b'); break
    case 'glass': {
      top(MAT('#bae6fd', { r: 0.02, m: 0.1, op: 0.35 }), 0.72, 0.03)
      for (const x of [-1.3, 1.3]) { const a = k.box(0.04, 0.04, 1.8, MAT('#e5e7eb', { m: 0.9, r: 0.15 }), x, 0.68, -0.47); a.rotation.x = 0; k.box(0.04, 0.7, 0.04, MAT('#e5e7eb', { m: 0.9, r: 0.15 }), x, 0, -1.3); k.box(0.04, 0.7, 0.04, MAT('#e5e7eb', { m: 0.9, r: 0.15 }), x, 0, 0.35) }
      monitor(k, 0, -0.9); keyboard(k, 0, -0.2); officeChair(k, '#f8fafc', '#e5e7eb'); break
    }
    case 'drafting': {
      const t = top(MAT('#e7dcc6', { r: 0.6 }), 0.86, 0.05, -1.3, 1.3, -1.3, 0.35); t.rotation.x = -0.28
      legs(MAT('#78350f'), 0.82, 0.04, 0.25)
      k.box(0.7, 0.003, 0.5, '#f8fafc', -0.3, 0.95, -0.5).rotation.x = -0.28   // กระดาษเขียนแบบ
      k.box(0.9, 0.02, 0.03, '#94a3b8', 0.2, 1.0, -0.4).rotation.x = -0.28   // ไม้ที
      officeChair(k, '#78350f', '#78350f'); break
    }
    case 'cafe': {
      k.cyl(0.85, 0.85, 0.05, MAT('#e7c9a3', { r: 0.45 }), 0, 0.72, -0.5, 28)
      k.cyl(0.06, 0.06, 0.72, '#1f2937', 0, 0, -0.5); k.cyl(0.35, 0.35, 0.04, '#1f2937', 0, 0, -0.5, 20)
      const lap = new THREE.Group(); lap.position.set(0, 0.77, -0.55); g.add(lap)
      kit(lap).box(0.36, 0.02, 0.25, '#9ca3af', 0, 0, 0); const s = kit(lap).box(0.36, 0.24, 0.015, MAT('#1e3a8a', { e: '#1d4ed8' }), 0, 0.02, -0.12); s.rotation.x = -0.25
      k.cyl(0.05, 0.04, 0.1, '#f8fafc', 0.45, 0.77, -0.3)
      k.cyl(0.22, 0.22, 0.05, '#92400e', 0, 0.45, 1); for (let i = 0; i < 4; i++) k.cyl(0.015, 0.015, 0.45, '#1f2937', Math.cos(i * 1.57) * 0.15, 0, 1 + Math.sin(i * 1.57) * 0.15)
      break
    }
    case 'classic':
    default:
      top(MAT('#b07a4a', { r: 0.45 }))
      k.box(0.5, 0.68, 1.6, MAT('#9a6538', { r: 0.5 }), 1.15, 0.02, -0.47)   // ตู้ลิ้นชัก
      for (let i = 0; i < 3; i++) k.box(0.15, 0.03, 0.02, '#e5e7eb', 1.15, 0.18 + i * 0.2, 0.34)
      legs('#7a4a2a', 0.72, 0.04)
      monitor(k, -0.2, -0.9); keyboard(k, -0.2, -0.2); officeChair(k, '#334155', '#1e293b')
  }
  return { group: g, tick }
}
