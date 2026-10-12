import * as THREE from 'three'

// ── สมจริงขึ้นอีกขั้น (มุมมอง 3D) ──
// ลายวาดเอง: ใบไม้ เปลือกไม้ ใบปาล์ม/ใบไผ่ (โปร่งใส) รูปบนโต๊ะ แผนที่โลก ป้ายบริษัท ตู้ขนม
// ชิ้นงาน: พุ่มไม้ ต้นไม้ 9 พันธุ์ (สน/ไผ่สูงขึ้น) เก้าอี้ประชุม เครื่องชงกาแฟ ตู้ขนม ป้ายบริษัท ชิงช้าตัว A ของบนโต๊ะ

// ═════════ ลาย (canvas → texture · สร้างครั้งเดียว) ═════════
const tcache = new Map<string, THREE.Texture>()
function tex(key: string, w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, repeat = false): THREE.Texture {
  const hit = tcache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  tcache.set(key, t)
  return t
}
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

/** ใบไม้ซ้อนกันแน่น (ใช้กับพุ่ม/ทรงพุ่มต้นไม้) — สีถูกคูณด้วยสีวัสดุ */
const leafTex = () => tex('leaf', 256, 256, x => {
  x.fillStyle = '#6f8f5a'; x.fillRect(0, 0, 256, 256)
  const R = rnd(101)
  for (let i = 0; i < 520; i++) {
    const px = R() * 256, py = R() * 256, a = R() * Math.PI * 2, l = 7 + R() * 10
    const shade = 0.55 + R() * 0.6
    x.fillStyle = `rgb(${Math.round(120 * shade)},${Math.round(190 * shade)},${Math.round(95 * shade)})`
    x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.ellipse(0, 0, l, l * 0.42, 0, 0, Math.PI * 2); x.fill()
    x.strokeStyle = 'rgba(30,60,20,.35)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(-l, 0); x.lineTo(l, 0); x.stroke(); x.restore()
  }
}, true)
/** เปลือกไม้ร่องแนวตั้ง */
const barkTex = () => tex('bark', 128, 256, x => {
  x.fillStyle = '#6b4a30'; x.fillRect(0, 0, 128, 256)
  const R = rnd(202)
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${40 + R() * 30},${25 + R() * 20},${15},${0.4 + R() * 0.4})`; x.lineWidth = 1 + R() * 3; const px = R() * 128; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + (R() - .5) * 20, 80, px + (R() - .5) * 20, 170, px + (R() - .5) * 10, 256); x.stroke() }
  for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(140,110,80,${R() * 0.25})`; x.fillRect(R() * 128, R() * 256, 2, 4) }
}, true)
/** ใบปาล์มทั้งทาง (โปร่งใสระหว่างใบย่อย) */
const frondTex = () => tex('frond', 128, 512, x => {
  x.clearRect(0, 0, 128, 512)
  x.strokeStyle = '#6b8f3a'; x.lineWidth = 4; x.beginPath(); x.moveTo(64, 512); x.lineTo(64, 0); x.stroke()
  for (let y = 20; y < 500; y += 9) {
    const len = 58 * Math.sin((y / 512) * Math.PI) + 6
    for (const d of [-1, 1]) {
      x.fillStyle = y % 2 ? '#3f8a35' : '#4c9a3c'
      x.beginPath(); x.moveTo(64, y); x.quadraticCurveTo(64 + d * len * 0.6, y - 10, 64 + d * len, y + 14); x.quadraticCurveTo(64 + d * len * 0.5, y + 2, 64, y + 5); x.fill()
    }
  }
})
/** ใบไผ่เรียวยาวหลายใบ (โปร่งใส) */
const bambooLeafTex = () => tex('bamboo-leaf', 128, 128, x => {
  x.clearRect(0, 0, 128, 128)
  const R = rnd(303)
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 2.2
    x.save(); x.translate(64, 120); x.rotate(a + Math.PI / 2)
    x.fillStyle = ['#7cb342', '#689f38', '#8bc34a'][i % 3]
    x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(7, -45, 0, -95 - R() * 15); x.quadraticCurveTo(-7, -45, 0, 0); x.fill()
    x.restore()
  }
})
const photoTex = () => tex('photo', 96, 128, x => {
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#7cc4f2'); g.addColorStop(0.6, '#cdeafc'); g.addColorStop(1, '#a3d39c')
  x.fillStyle = g; x.fillRect(0, 0, 96, 128)
  x.fillStyle = '#6b7c8f'; x.beginPath(); x.moveTo(0, 90); x.lineTo(30, 45); x.lineTo(55, 80); x.lineTo(75, 55); x.lineTo(96, 88); x.lineTo(96, 128); x.lineTo(0, 128); x.fill()
  x.fillStyle = '#f8fafc'; x.beginPath(); x.moveTo(24, 54); x.lineTo(30, 45); x.lineTo(36, 54); x.fill()
  x.fillStyle = '#fde047'; x.beginPath(); x.arc(72, 22, 9, 0, Math.PI * 2); x.fill()
  x.fillStyle = '#4d7c0f'; x.fillRect(0, 110, 96, 18)
})
const worldTex = () => tex('world', 256, 128, x => {
  x.fillStyle = '#2b7bd3'; x.fillRect(0, 0, 256, 128)
  x.fillStyle = '#58a84b'
  const blob = (cx: number, cy: number, rx: number, ry: number) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill() }
  blob(55, 40, 28, 18); blob(70, 75, 14, 24); blob(128, 38, 20, 14); blob(135, 72, 16, 26); blob(185, 40, 40, 18); blob(205, 88, 16, 10); blob(128, 120, 90, 6)
  x.strokeStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke() }
})
export const logoTex = (text: string) => tex(`logo-${text}`, 512, 128, x => {
  const g = x.createLinearGradient(0, 0, 512, 0); g.addColorStop(0, '#0f172a'); g.addColorStop(1, '#1e293b')
  x.fillStyle = g; x.fillRect(0, 0, 512, 128)
  x.font = 'bold 72px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
  x.shadowColor = '#60a5fa'; x.shadowBlur = 24; x.fillStyle = '#e0f2fe'; x.fillText(text, 256, 60)
  x.shadowBlur = 0; x.font = '600 22px system-ui, sans-serif'; x.fillStyle = '#93c5fd'; x.fillText('HELPDESK & PM', 256, 108)
})
const vendingTex = () => tex('vending-front', 128, 256, x => {
  x.fillStyle = '#0b1220'; x.fillRect(0, 0, 128, 256)
  const items = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#facc15', '#14b8a6']
  for (let r = 0; r < 5; r++) {
    x.fillStyle = '#94a3b8'; x.fillRect(4, 40 + r * 42, 120, 3)
    for (let c = 0; c < 5; c++) { x.fillStyle = items[(r * 5 + c) % items.length]; x.fillRect(8 + c * 23, 14 + r * 42, 17, 26); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(9 + c * 23, 15 + r * 42, 4, 24) }
  }
  x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(50, 0); x.lineTo(0, 120); x.fill()
})

// ═════════ วัสดุ ═════════
const mcache = new Map<string, THREE.Material>()
function mat(key: string, make: () => THREE.Material) { let m = mcache.get(key); if (!m) { m = make(); mcache.set(key, m) } return m }
export const M = (color: string, o: { r?: number; m?: number; e?: string; op?: number } = {}) =>
  mat(`c|${color}|${o.r ?? 0.7}|${o.m ?? 0}|${o.e ?? ''}|${o.op ?? 1}`, () => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.7, metalness: o.m ?? 0, emissive: o.e ?? '#000000', transparent: (o.op ?? 1) < 1, opacity: o.op ?? 1 }))
const foliage = (color: string) => mat(`fol|${color}`, () => { const t = leafTex(); return new THREE.MeshStandardMaterial({ map: t, color, roughness: 0.85, flatShading: true }) })
const bark = (color = '#ffffff') => mat(`bark|${color}`, () => new THREE.MeshStandardMaterial({ map: barkTex(), color, roughness: 0.95 }))
const cutout = (t: () => THREE.Texture, color = '#ffffff') => mat(`cut|${color}|${t.name}`, () => new THREE.MeshStandardMaterial({ map: t(), color, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 }))

type C = string | THREE.Material
const asMat = (c: C) => (typeof c === 'string' ? M(c) : c)
function kit(g: THREE.Object3D) {
  const put = (geo: THREE.BufferGeometry, c: C, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, asMat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m }
  return {
    put,
    box: (w: number, h: number, d: number, c: C, x: number, y: number, z: number) => put(new THREE.BoxGeometry(w, h, d), c, x, y + h / 2, z),
    cyl: (rt: number, rb: number, h: number, c: C, x: number, y: number, z: number, s = 16) => put(new THREE.CylinderGeometry(rt, rb, h, s), c, x, y + h / 2, z),
    ball: (r: number, c: C, x: number, y: number, z: number, s = 14) => put(new THREE.SphereGeometry(r, s, Math.max(8, s - 4)), c, x, y, z),
    cone: (r: number, h: number, c: C, x: number, y: number, z: number, s = 12) => put(new THREE.ConeGeometry(r, h, s), c, x, y + h / 2, z),
  }
}

/** กลุ่มใบไม้หนาแน่น: ก้อนทรงหลายเหลี่ยมซ้อนกัน หลายเฉดเขียว + ลายใบไม้ */
function canopy(g: THREE.Object3D, cx: number, cy: number, cz: number, rad: number, n: number, colors: string[], seed: number, squash = 1) {
  const R = rnd(seed)
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rad * 0.75
    const r = rad * (0.32 + R() * 0.28)
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), foliage(colors[i % colors.length]))
    m.position.set(cx + Math.cos(a) * d, cy + (R() - 0.35) * rad * 0.7 * squash, cz + Math.sin(a) * d)
    m.rotation.set(R() * 3, R() * 3, R() * 3); m.scale.y = squash
    m.castShadow = true; m.receiveShadow = true
    g.add(m)
  }
}

/** กระถางเซรามิกเคลือบ ขอบปาก + ดิน + หินโรยหน้า */
function pot(g: THREE.Object3D, color: string, r = 0.2, h = 0.34) {
  const k = kit(g)
  const pts = [new THREE.Vector2(r * 0.72, 0), new THREE.Vector2(r * 0.8, h * 0.15), new THREE.Vector2(r, h * 0.85), new THREE.Vector2(r * 1.08, h * 0.9), new THREE.Vector2(r * 1.08, h), new THREE.Vector2(r * 0.95, h)]
  k.put(new THREE.LatheGeometry(pts, 24), M(color, { r: 0.35 }), 0, 0, 0)
  k.cyl(r * 0.94, r * 0.94, 0.02, '#3d2817', 0, h - 0.03, 0)
  const R = rnd(Math.round(r * 1000))
  for (let i = 0; i < 6; i++) k.ball(0.018, '#d6d3d1', (R() - 0.5) * r, h - 0.005, (R() - 0.5) * r, 6)
}

/** ใบรูปหัวใจมีช่อง (มอนสเตอร่า) */
function monsteraLeafGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0); s.bezierCurveTo(0.22, 0.05, 0.3, 0.3, 0.18, 0.5); s.bezierCurveTo(0.1, 0.6, 0, 0.55, 0, 0.45); s.bezierCurveTo(0, 0.55, -0.1, 0.6, -0.18, 0.5); s.bezierCurveTo(-0.3, 0.3, -0.22, 0.05, 0, 0)
  for (const [x, y] of [[0.1, 0.25], [-0.1, 0.25], [0.12, 0.38], [-0.12, 0.38]]) { const hole = new THREE.Path(); hole.absellipse(x, y, 0.025, 0.06, 0, Math.PI * 2, false, x > 0 ? -0.6 : 0.6); s.holes.push(hole) }
  return new THREE.ShapeGeometry(s, 10)
}
/** ใบกว้างทรงไวโอลิน (ไทรใบสัก) */
function fiddleLeafGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0); s.bezierCurveTo(0.12, 0.02, 0.1, 0.14, 0.13, 0.22); s.bezierCurveTo(0.17, 0.32, 0.08, 0.4, 0, 0.38); s.bezierCurveTo(-0.08, 0.4, -0.17, 0.32, -0.13, 0.22); s.bezierCurveTo(-0.1, 0.14, -0.12, 0.02, 0, 0)
  return new THREE.ShapeGeometry(s, 8)
}
/** ใบเรียว (ลีลาวดี) */
function lanceLeafGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0); s.quadraticCurveTo(0.06, 0.14, 0, 0.3); s.quadraticCurveTo(-0.06, 0.14, 0, 0)
  return new THREE.ShapeGeometry(s, 6)
}
const leafSide = (color: string) => mat(`leafside|${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide }))
function placeLeaf(g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, y: number, yaw: number, tilt: number, scale = 1, x = 0, z = 0) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = yaw; g.add(p)
  const m = new THREE.Mesh(geo, leafSide(color)); m.rotation.x = -Math.PI / 2 + tilt; m.scale.setScalar(scale); m.castShadow = true; p.add(m)
}

// ═════════ ต้นไม้ 9 พันธุ์ ═════════
const PLANTS: Record<string, () => THREE.Group> = {
  P: () => { // มอนสเตอร่า — ใบหัวใจมีช่อง บนก้านยาว
    const g = new THREE.Group(); pot(g, '#e7e5e4', 0.22, 0.34)
    const geo = monsteraLeafGeo()
    for (let i = 0; i < 9; i++) {
      const yaw = i * 0.7, h = 0.4 + (i % 4) * 0.13, reach = 0.12 + (i % 3) * 0.05
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, h, 6), M('#4d7c0f')); stem.position.set(Math.cos(yaw) * reach / 2, 0.34 + h / 2, Math.sin(yaw) * reach / 2); stem.rotation.set(Math.sin(yaw) * 0.4, 0, -Math.cos(yaw) * 0.4); g.add(stem)
      placeLeaf(g, geo, i % 2 ? '#166534' : '#1f7a3a', 0.34 + h, -yaw + Math.PI / 2, 0.5 + (i % 3) * 0.2, 0.9 + (i % 3) * 0.15, Math.cos(yaw) * reach, Math.sin(yaw) * reach)
    }
    return g
  },
  G: () => { // ปาล์ม — ลำต้นวงแหวนสูง + ทางใบโปร่งโค้งลง
    const g = new THREE.Group(), k = kit(g); pot(g, '#c2410c', 0.28, 0.4)
    for (let i = 0; i < 12; i++) k.cyl(0.075 - i * 0.002, 0.085 - i * 0.002, 0.18, bark('#a07850'), Math.sin(i * 0.35) * 0.05, 0.38 + i * 0.17, 0, 10)
    const fr = cutout(frondTex)
    for (let i = 0; i < 9; i++) {
      const p = new THREE.Group(); p.position.set(Math.sin(12 * 0.35) * 0.05, 2.4, 0); p.rotation.y = i * 0.7; g.add(p)
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.3, 1, 6), fr)
      const pos = plane.geometry.attributes.position as THREE.BufferAttribute
      for (let v = 0; v < pos.count; v++) { const yy = pos.getY(v) + 0.65; pos.setZ(v, -yy * yy * 0.45) }   // โค้งลง
      plane.geometry.computeVertexNormals()
      plane.rotation.x = -0.35 - (i % 3) * 0.15; plane.position.set(0, 0, 0.6); plane.castShadow = true
      const arm = new THREE.Group(); arm.rotation.x = -0.6; arm.add(plane); p.add(arm)
    }
    return g
  },
  Y: () => { // ไผ่ — สูง 2.3–3 ม. ลำเขียวมีข้อ + ช่อใบเรียว
    const g = new THREE.Group(), k = kit(g)
    k.box(0.62, 0.22, 0.62, M('#78716c', { r: 0.9 }), 0, 0, 0); k.box(0.58, 0.02, 0.58, '#3d2817', 0, 0.21, 0)
    const lm = cutout(bambooLeafTex)
    for (let s = 0; s < 7; s++) {
      const x = Math.cos(s * 1.1) * 0.17, z = Math.sin(s * 1.1) * 0.17, h = 2.3 + (s % 3) * 0.3
      k.cyl(0.03, 0.035, h, M(s % 2 ? '#7cb342' : '#689f38', { r: 0.35 }), x, 0.22, z, 10)
      for (let n = 1; n < 8; n++) k.cyl(0.038, 0.038, 0.025, M('#558b2f', { r: 0.4 }), x, 0.22 + n * h / 8, z, 10)
      for (let l = 0; l < 4; l++) {
        const y = 0.22 + h * (0.55 + l * 0.12)
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), lm); p.position.set(x + Math.cos(s + l) * 0.12, y, z + Math.sin(s + l) * 0.12); p.rotation.y = s + l * 1.4; p.castShadow = true; g.add(p)
      }
    }
    return g
  },
  L: () => { // ไทรใบสัก — ลำต้นเปลือกไม้ ใบไวโอลินใหญ่เรียงเกลียว
    const g = new THREE.Group(), k = kit(g); pot(g, '#f8fafc', 0.22, 0.36)
    k.cyl(0.035, 0.05, 1.25, bark('#9a7b5f'), 0, 0.34, 0, 10)
    const geo = fiddleLeafGeo()
    for (let i = 0; i < 22; i++) placeLeaf(g, geo, i % 3 ? '#2e6b2e' : '#3f7d3a', 0.75 + i * 0.04, i * 2.4, 0.3 + (i % 4) * 0.15, 0.95, Math.cos(i * 2.4) * 0.04, Math.sin(i * 2.4) * 0.04)
    return g
  },
  R: () => { // เฟื่องฟ้า — พุ่มใบหนาแน่น + ช่อดอกบานแซมทั่ว
    const g = new THREE.Group(), k = kit(g); pot(g, '#b45309', 0.24, 0.32)
    k.cyl(0.03, 0.04, 0.35, bark('#8b6a4a'), 0, 0.3, 0, 8)
    canopy(g, 0, 0.85, 0, 0.42, 16, ['#3f8f3a', '#4c9a3f', '#367f33'], 17)
    const R = rnd(29)
    for (let i = 0; i < 40; i++) { const a = R() * 6.28, rr = 0.25 + R() * 0.2, f = k.ball(0.045, M(['#db2777', '#ec4899', '#be185d'][i % 3], { r: 0.5 }), Math.cos(a) * rr, 0.7 + R() * 0.45, Math.sin(a) * rr, 6); f.scale.set(1.3, 0.6, 1.3) }
    return g
  },
  U: () => { // กระบองเพชรยักษ์ — มีสัน (ribs) + หนาม + ดอกเหลืองบนยอด
    const g = new THREE.Group(), k = kit(g); pot(g, '#d6b88a', 0.26, 0.28)
    const ribbed = (r: number, h: number) => {
      const geo = new THREE.CylinderGeometry(r, r * 1.05, h, 24, 6)
      const p = geo.attributes.position as THREE.BufferAttribute
      for (let v = 0; v < p.count; v++) { const a = Math.atan2(p.getZ(v), p.getX(v)); const f = 1 + Math.cos(a * 8) * 0.09; p.setX(v, p.getX(v) * f); p.setZ(v, p.getZ(v) * f) }
      geo.computeVertexNormals(); return geo
    }
    const green = M('#3f8f4a', { r: 0.55 })
    k.put(ribbed(0.12, 1.4), green, 0, 0.98, 0); k.ball(0.12, green, 0, 1.68, 0, 16)
    for (const [d, y, len] of [[-1, 0.75, 0.42], [1, 0.6, 0.35]] as const) {
      const elbow = k.cyl(0.075, 0.075, 0.22, green, d * 0.18, y, 0, 14); elbow.rotation.z = Math.PI / 2
      k.put(ribbed(0.075, len), green, d * 0.3, y + len / 2, 0); k.ball(0.075, green, d * 0.3, y + len, 0, 12)
    }
    const spine = M('#fef9c3')
    const R = rnd(41)
    for (let i = 0; i < 60; i++) { const a = R() * 6.28, y = 0.4 + R() * 1.25; k.box(0.004, 0.004, 0.035, spine, Math.cos(a) * 0.13, y, Math.sin(a) * 0.13).lookAt(Math.cos(a) * 2, y, Math.sin(a) * 2) }
    for (let i = 0; i < 4; i++) k.ball(0.035, M('#fde047', { r: 0.4 }), Math.cos(i * 1.6) * 0.05, 1.78, Math.sin(i * 1.6) * 0.05, 8)
    return g
  },
  Z: () => { // บอนไซ — ถาดเคลือบ มอสคลุมดิน ลำต้นบิดเปลือกไม้ ใบเป็นแพ
    const g = new THREE.Group(), k = kit(g)
    k.box(0.7, 0.14, 0.46, M('#1e3a5f', { r: 0.25 }), 0, 0.26, 0); k.box(0.76, 0.26, 0.52, M('#6b4a30', { r: 0.6 }), 0, 0, 0)
    k.box(0.64, 0.02, 0.4, foliage('#4d7c0f'), 0, 0.39, 0)
    const segs: [number, number, number, number][] = [[-0.04, 0.4, 0.06, 0.45], [0.06, 0.62, 0.045, -0.7], [-0.08, 0.78, 0.035, 0.8], [0.1, 0.9, 0.03, -0.5]]
    for (const [x, y, r, rz] of segs) k.cyl(r * 0.8, r, 0.26, bark('#7a5a40'), x, y, 0, 8).rotation.z = rz
    for (const [x, y, z, s] of [[-0.24, 0.9, 0, 0.22], [0.22, 1.02, 0.05, 0.19], [0.0, 1.16, -0.04, 0.17], [-0.12, 1.08, 0.08, 0.13]] as const) canopy(g, x, y, z, s, 6, ['#2f6b2f', '#3a7d35'], Math.round(x * 100 + 50), 0.45)
    return g
  },
  N: () => { // สน — สูง ~3 ม. 5 ชั้น ขอบหยัก ลำต้นเปลือกไม้
    const g = new THREE.Group(), k = kit(g); pot(g, '#7c2d12', 0.26, 0.32)
    k.cyl(0.06, 0.09, 1.1, bark('#8b5e3c'), 0, 0.3, 0, 10)
    const tiers = 5
    for (let i = 0; i < tiers; i++) {
      const r = 0.62 - i * 0.1, h = 0.75 - i * 0.05, y = 0.6 + i * 0.45
      const geo = new THREE.ConeGeometry(r, h, 14, 2, true)
      const p = geo.attributes.position as THREE.BufferAttribute
      for (let v = 0; v < p.count; v++) if (p.getY(v) < -h / 2 + 0.01) { const a = Math.atan2(p.getZ(v), p.getX(v)); const f = 1 + (Math.sin(a * 7) > 0 ? 0.08 : -0.06); p.setX(v, p.getX(v) * f); p.setZ(v, p.getZ(v) * f); p.setY(v, p.getY(v) - 0.05 * (1 + Math.sin(a * 5))) }
      geo.computeVertexNormals()
      const m = k.put(geo, foliage(i % 2 ? '#1f5130' : '#255f38'), 0, y + h / 2, 0); (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
    }
    k.cone(0.05, 0.12, M('#fde047', { e: '#a16207' }), 0, 0.6 + tiers * 0.45 + 0.1, 0, 5)
    return g
  },
  J: () => { // ลีลาวดี — ลำต้นเทาแตกกิ่ง ปลายกิ่งเป็นกุหลาบใบ + ช่อดอก 5 กลีบ
    const g = new THREE.Group(), k = kit(g); pot(g, '#a16207', 0.26, 0.32)
    k.cyl(0.05, 0.075, 0.6, bark('#b8a89a'), 0, 0.3, 0, 10)
    const leafG = lanceLeafGeo()
    const petal = new THREE.CircleGeometry(0.035, 8); petal.scale(1, 1.6, 1)
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.4, tx = Math.cos(a) * 0.3, tz = Math.sin(a) * 0.3, ty = 1.2 + (i % 2) * 0.12
      const br = k.cyl(0.03, 0.045, 0.55, bark('#b8a89a'), tx / 2, 0.8, tz / 2, 8); br.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6)
      for (let l = 0; l < 8; l++) placeLeaf(g, leafG, l % 2 ? '#2f6b2f' : '#3f7d3a', ty, l * 0.8, 0.4, 1, tx, tz)
      for (let f = 0; f < 5; f++) {
        const fl = new THREE.Group(); fl.position.set(tx + Math.cos(f * 1.25) * 0.07, ty + 0.06, tz + Math.sin(f * 1.25) * 0.07); g.add(fl)
        for (let p = 0; p < 5; p++) { const pm = new THREE.Mesh(petal, leafSide('#fffbeb')); pm.rotation.set(-Math.PI / 2 + 0.3, 0, p * 1.257); pm.position.y = 0.005; fl.add(pm) }
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), M('#facc15')); fl.add(c)
      }
    }
    return g
  },
}
export function buildPlantReal(ch: string): THREE.Group | null { return PLANTS[ch]?.() ?? null }

/** พุ่มไม้ตัดแต่ง — ใบหนาแน่นหลายเฉด ขอบไม่เรียบ บางพุ่มมีดอกเล็ก */
export function buildHedgeReal(seed: number): THREE.Group {
  const g = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), foliage('#2c6b34')); base.position.y = 0.25; base.castShadow = true; base.receiveShadow = true; g.add(base)
  canopy(g, 0, 0.55, 0, 0.55, 14, ['#2f7a3a', '#3c8f45', '#25652f', '#46994d'], seed * 13 + 1, 0.7)
  const R = rnd(seed * 7 + 3)
  if (R() < 0.4) for (let i = 0; i < 9; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), M(['#fafafa', '#fde68a', '#f9a8d4'][seed % 3])); f.position.set((R() - 0.5) * 0.8, 0.55 + R() * 0.3, (R() - 0.5) * 0.8); g.add(f) }
  return g
}

// ═════════ เก้าอี้ประชุม (หันเข้าโต๊ะ) ═════════
export function buildMeetingChair(): THREE.Group {
  const g = new THREE.Group(), k = kit(g)
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const leg = k.box(0.035, 0.03, 0.24, M('#1f2937', { m: 0.6, r: 0.3 }), Math.cos(a) * 0.11, 0.03, Math.sin(a) * 0.11); leg.rotation.y = -a + Math.PI / 2; k.ball(0.022, '#111827', Math.cos(a) * 0.22, 0.022, Math.sin(a) * 0.22, 8) }
  k.cyl(0.022, 0.022, 0.36, M('#cbd5e1', { m: 0.85, r: 0.2 }), 0, 0.05, 0)
  k.box(0.46, 0.09, 0.44, M('#1e293b', { r: 0.55 }), 0, 0.41, 0)
  k.box(0.42, 0.04, 0.4, M('#334155', { r: 0.7 }), 0, 0.5, 0)
  const back = k.box(0.44, 0.5, 0.06, M('#1e293b', { r: 0.55 }), 0, 0.55, 0.22); back.rotation.x = -0.12
  for (const x of [-0.24, 0.24]) { k.box(0.035, 0.18, 0.035, '#111827', x, 0.45, 0.02); k.box(0.05, 0.03, 0.28, '#111827', x, 0.63, 0.02) }
  return g
}

// ═════════ เครื่องชงกาแฟ (ช่อง K) ═════════
export function buildCoffeeStation(): { group: THREE.Group; tick: (t: number) => void } {
  const g = new THREE.Group(), k = kit(g)
  k.box(0.96, 0.82, 0.62, M('#e7dcc6', { r: 0.5 }), 0, 0, -0.1)
  k.box(1.0, 0.05, 0.66, M('#3f3f46', { r: 0.25 }), 0, 0.82, -0.1)
  k.box(0.46, 0.5, 0.38, M('#d4d4d8', { m: 0.8, r: 0.25 }), -0.12, 0.87, -0.2)
  k.box(0.42, 0.12, 0.02, M('#0f172a', { e: '#0f172a' }), -0.12, 1.2, -0.005)
  const led = M('#22d3ee', { e: '#06b6d4' }); for (let i = 0; i < 3; i++) k.ball(0.015, led, -0.25 + i * 0.07, 1.26, 0.008, 6)
  k.box(0.08, 0.06, 0.08, M('#1f2937', { m: 0.6 }), -0.12, 1.05, -0.04)
  k.cyl(0.045, 0.035, 0.08, '#f8fafc', -0.12, 0.88, -0.03)
  const steam = k.cyl(0.01, 0.02, 0.1, M('#ffffff', { op: 0.4 }), -0.12, 0.98, -0.03, 8)
  k.cyl(0.11, 0.11, 0.24, M('#475569', { op: 0.55, r: 0.1 }), 0.28, 0.87, -0.2)   // โถเมล็ด
  for (let i = 0; i < 3; i++) k.cyl(0.04, 0.032, 0.09, ['#f8fafc', '#fde68a', '#fecaca'][i], 0.22 + i * 0.08, 0.87, 0.08)
  return { group: g, tick: t => { steam.position.y = 1.0 + (t % 1.2) * 0.08; (steam.material as THREE.MeshStandardMaterial).opacity = 0.4 * (1 - (t % 1.2) / 1.2) } }
}

// ═════════ ตู้ขนม / ป้ายบริษัท / ชิงช้าตัว A ═════════
export function buildVendingReal(): THREE.Group {
  const g = new THREE.Group(), k = kit(g)
  k.box(0.88, 1.9, 0.72, M('#b91c1c', { r: 0.35, m: 0.2 }), 0.5, 0, 0.45)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.25), new THREE.MeshStandardMaterial({ map: vendingTex(), emissive: '#ffffff', emissiveMap: vendingTex(), emissiveIntensity: 0.35, roughness: 0.1 }))
  front.position.set(0.42, 1.12, 0.815); g.add(front)
  k.box(0.6, 1.25, 0.01, M('#bae6fd', { op: 0.18, r: 0.02 }), 0.42, 0.49, 0.83)
  k.box(0.16, 0.5, 0.03, M('#111827'), 0.82, 0.9, 0.82)
  k.box(0.1, 0.08, 0.01, M('#22c55e', { e: '#16a34a' }), 0.82, 1.25, 0.84)
  for (let i = 0; i < 3; i++) k.box(0.1, 0.02, 0.01, '#9ca3af', 0.82, 1.0 + i * 0.05, 0.84)
  k.box(0.6, 0.22, 0.03, M('#111827'), 0.42, 0.18, 0.82)
  k.box(0.88, 0.18, 0.74, M('#7f1d1d', { r: 0.4 }), 0.5, 1.9, 0.45)
  k.box(0.7, 0.12, 0.01, M('#fde047', { e: '#f59e0b' }), 0.5, 1.93, 0.825)
  return g
}
export function buildLogoReal(w: number, text = 'iT Services'): { group: THREE.Group; tick: (t: number) => void } {
  const g = new THREE.Group(), k = kit(g)
  k.box(w - 0.1, 0.18, 0.4, M('#334155', { r: 0.4 }), w / 2, 0, 0.5)
  for (const x of [0.4, w - 0.4]) k.box(0.08, 1.0, 0.08, M('#94a3b8', { m: 0.8, r: 0.25 }), x, 0.18, 0.5)
  k.box(w - 0.15, 0.85, 0.1, M('#0f172a', { r: 0.3 }), w / 2, 0.75, 0.5)
  const sign = new THREE.MeshStandardMaterial({ map: logoTex(text), emissive: '#ffffff', emissiveMap: logoTex(text), emissiveIntensity: 0.8, roughness: 0.3 })
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.35, 0.7), sign); face.position.set(w / 2, 1.18, 0.56); g.add(face)
  const spot = M('#e5e7eb', { m: 0.8 }); for (const x of [w * 0.3, w * 0.7]) { k.cyl(0.04, 0.06, 0.08, spot, x, 1.62, 0.62); }
  return { group: g, tick: t => { sign.emissiveIntensity = 0.75 + Math.sin(t * 1.5) * 0.12 } }
}
export function buildSwingA(w: number, h: number): { group: THREE.Group; tick: (t: number) => void } {
  const g = new THREE.Group(), k = kit(g)
  const wood = M('#8b5a2b', { r: 0.7 })
  const top = 1.9
  const spread = 0.62, legLen = Math.hypot(top, spread), ang = Math.atan2(spread, top)
  for (const x of [0.15, w - 0.15]) for (const dz of [-1, 1]) {   // ขาตัว A: ยอดชนกันที่คาน · ตีนกางออกที่พื้น
    const leg = k.box(0.09, legLen, 0.09, wood, x, 0, h / 2 + dz * spread / 2); leg.position.y = top / 2; leg.rotation.x = -dz * ang
  }
  for (const x of [0.15, w - 0.15]) k.box(0.07, 0.07, 2 * spread * (1 - 0.7 / top), wood, x, 0.7, h / 2)   // คานขวางกลางตัว A
  const beam = k.box(w + 0.1, 0.11, 0.11, wood, w / 2, top - 0.05, h / 2)
  void beam
  const seat = new THREE.Group(); seat.position.set(w / 2, top - 0.05, h / 2); g.add(seat)
  const ks = kit(seat)
  for (const x of [-0.32, 0.32]) ks.box(0.015, 1.35, 0.015, M('#d6c7a1'), x, -1.35, 0)
  ks.box(0.78, 0.05, 0.32, M('#b45309', { r: 0.6 }), 0, -1.4, 0)
  for (const x of [-0.32, 0.32]) ks.cyl(0.03, 0.03, 0.04, M('#6b7280', { m: 0.8 }), x, -0.02, 0, 8)
  return { group: g, tick: t => { seat.rotation.x = Math.sin(t * 1.4) * 0.35 } }
}

// ═════════ ของบนโต๊ะ (ทุกชนิด ละเอียดขึ้น) ═════════
type Built = { group: THREE.Group; tick?: (t: number) => void }
export const DESK_ITEMS: Record<string, () => Built> = {
  dualscreen: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.16, 0.015, 0.12, M('#1f2937', { m: 0.6 }), 0, 0, -0.12); k.cyl(0.015, 0.015, 0.22, M('#9ca3af', { m: 0.8 }), 0, 0.015, -0.12, 8)
    k.box(0.5, 0.02, 0.02, M('#9ca3af', { m: 0.8 }), 0, 0.22, -0.12)
    for (const [x, ry] of [[-0.21, 0.25], [0.21, -0.25]] as const) {
      const m = new THREE.Group(); m.position.set(x, 0.24, -0.1); m.rotation.y = ry; g.add(m)
      const km = kit(m); km.box(0.4, 0.25, 0.02, M('#111827', { r: 0.3 }), 0, 0, 0)
      km.box(0.38, 0.22, 0.004, new THREE.MeshStandardMaterial({ color: '#1e40af', emissive: '#2563eb', emissiveIntensity: 0.6, roughness: 0.15 }), 0, 0.015, 0.012)
      km.box(0.15, 0.05, 0.003, M('#f8fafc', { e: '#94a3b8' }), -0.08, 0.18, 0.015)
    }
    return { group: g }
  },
  photo: () => {
    const g = new THREE.Group(), k = kit(g)
    const f = new THREE.Group(); f.rotation.x = -0.18; g.add(f)
    const kf = kit(f); kf.box(0.15, 0.19, 0.018, M('#7c4a1e', { r: 0.4 }), 0, 0, 0)
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.15), new THREE.MeshStandardMaterial({ map: photoTex(), roughness: 0.3 })); pic.position.set(0, 0.095, 0.0095); f.add(pic)
    k.box(0.02, 0.1, 0.06, M('#7c4a1e'), 0, 0, -0.05).rotation.x = 0.4
    return { group: g }
  },
  books: () => {
    const g = new THREE.Group(), k = kit(g)
    ;['#b91c1c', '#1d4ed8', '#15803d', '#b45309'].forEach((c, i) => { const b = k.box(0.24 - i * 0.015, 0.035, 0.17, M(c, { r: 0.6 }), 0, i * 0.035, 0); b.rotation.y = (i % 2 ? 0.08 : -0.06); k.box(0.235 - i * 0.015, 0.03, 0.005, '#f8fafc', 0, i * 0.035 + 0.002, 0.086) })
    for (let i = 0; i < 4; i++) { const b = k.box(0.04, 0.2 + (i % 2) * 0.03, 0.15, M(['#7c3aed', '#0f766e', '#dc2626', '#334155'][i], { r: 0.6 }), 0.17 + i * 0.045, 0, -0.02); b.rotation.z = i === 3 ? -0.2 : 0 }
    return { group: g }
  },
  cactus: () => {
    const g = new THREE.Group(), k = kit(g)
    k.cyl(0.065, 0.05, 0.08, M('#c2410c', { r: 0.4 }), 0, 0, 0); k.cyl(0.06, 0.06, 0.01, '#3d2817', 0, 0.075, 0)
    const geo = new THREE.CylinderGeometry(0.04, 0.045, 0.16, 16, 3); const p = geo.attributes.position as THREE.BufferAttribute
    for (let v = 0; v < p.count; v++) { const a = Math.atan2(p.getZ(v), p.getX(v)); const f = 1 + Math.cos(a * 8) * 0.12; p.setX(v, p.getX(v) * f); p.setZ(v, p.getZ(v) * f) }
    geo.computeVertexNormals(); k.put(geo, M('#3f8f4a', { r: 0.5 }), 0, 0.16, 0); k.ball(0.04, M('#3f8f4a'), 0, 0.24, 0, 12)
    k.ball(0.02, M('#f472b6'), 0, 0.28, 0, 8)
    return { group: g }
  },
  headphones: () => {
    const g = new THREE.Group(), k = kit(g)
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 20, Math.PI), M('#111827', { r: 0.4 })); band.position.y = 0.06; band.rotation.set(Math.PI / 2 - 0.2, 0, Math.PI / 2); g.add(band)
    for (const z of [-0.1, 0.1]) { k.cyl(0.045, 0.045, 0.03, M('#1f2937'), 0, 0.02, z).rotation.x = Math.PI / 2; k.cyl(0.035, 0.035, 0.012, M('#ef4444', { r: 0.8 }), 0, 0.02, z * 0.82).rotation.x = Math.PI / 2 }
    return { group: g }
  },
  trophy: () => {
    const g = new THREE.Group(), k = kit(g)
    k.box(0.12, 0.04, 0.12, M('#3f2a1c', { r: 0.4 }), 0, 0, 0); k.box(0.07, 0.02, 0.005, M('#facc15', { m: 0.9, r: 0.2 }), 0, 0.012, 0.062)
    k.cyl(0.02, 0.03, 0.03, M('#facc15', { m: 0.9, r: 0.2 }), 0, 0.04, 0); k.cyl(0.008, 0.008, 0.06, M('#facc15', { m: 0.9, r: 0.2 }), 0, 0.07, 0, 8)
    const cup = new THREE.LatheGeometry([new THREE.Vector2(0.01, 0), new THREE.Vector2(0.04, 0.02), new THREE.Vector2(0.065, 0.08), new THREE.Vector2(0.07, 0.1)], 18)
    k.put(cup, M('#facc15', { m: 0.95, r: 0.15 }), 0, 0.13, 0)
    for (const x of [-0.07, 0.07]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12), M('#facc15', { m: 0.95, r: 0.15 })); h.position.set(x, 0.19, 0); h.rotation.y = Math.PI / 2; g.add(h) }
    return { group: g }
  },
  duck: () => {
    const g = new THREE.Group(), k = kit(g)
    const yel = M('#facc15', { r: 0.25 })
    const body = k.ball(0.07, yel, 0, 0.055, 0, 16); body.scale.set(1.35, 0.85, 1)
    k.ball(0.03, yel, -0.08, 0.08, 0, 10).scale.set(1, 0.6, 0.7)
    k.ball(0.047, yel, 0.055, 0.13, 0, 14)
    const beak = k.ball(0.022, M('#f97316', { r: 0.3 }), 0.1, 0.125, 0, 10); beak.scale.set(1.4, 0.5, 1)
    for (const z of [-0.025, 0.025]) k.ball(0.008, '#111827', 0.085, 0.145, z, 6)
    return { group: g }
  },
  sticky: () => {
    const g = new THREE.Group()
    ;['#fde047', '#f9a8d4', '#86efac', '#93c5fd'].forEach((c, i) => {
      const geo = new THREE.PlaneGeometry(0.075, 0.075, 1, 4); const p = geo.attributes.position as THREE.BufferAttribute
      for (let v = 0; v < p.count; v++) { const y = p.getY(v); if (y > 0.02) p.setZ(v, (y - 0.02) * 0.6) }   // มุมงอขึ้น
      geo.computeVertexNormals()
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.8 }))
      m.rotation.x = -Math.PI / 2; m.rotation.z = (i - 1.5) * 0.25; m.position.set(-0.1 + i * 0.07, 0.003 + i * 0.001, (i % 2) * 0.04); g.add(m)
    })
    return { group: g }
  },
  globe: () => {
    const g = new THREE.Group(), k = kit(g)
    k.cyl(0.06, 0.07, 0.025, M('#3f2a1c', { r: 0.4 }), 0, 0, 0); k.cyl(0.008, 0.01, 0.07, M('#b45309', { m: 0.7, r: 0.3 }), 0, 0.025, 0, 8)
    const tilt = new THREE.Group(); tilt.position.y = 0.17; tilt.rotation.z = 0.4; g.add(tilt)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.005, 6, 28, Math.PI * 1.4), M('#b45309', { m: 0.8, r: 0.25 })); ring.rotation.y = Math.PI / 2; tilt.add(ring)
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.08, 28, 20), new THREE.MeshStandardMaterial({ map: worldTex(), roughness: 0.4 })); sphere.castShadow = true; tilt.add(sphere)
    return { group: g, tick: t => { sphere.rotation.y = t * 0.5 } }
  },
}
