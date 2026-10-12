import * as THREE from 'three'

// ── บรรยากาศรอบตึก (มุมมอง 3D): แสงตามเวลาจริง · ท้องฟ้า/ดาว · เมฆลอย · ต้นไม้ล้อมตึก · หญ้าพลิ้วลม ──

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerpC = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t)

/** สภาพแสง ณ เวลาหนึ่ง — night: 0 = กลางวัน · 1 = กลางคืน · dusk = ช่วงเช้ามืด/เย็นแสงส้ม */
export function lightAt(d: Date) {
  // ทดสอบช่วงเวลาอื่นได้: localStorage 'hd-3d-hour' = ชั่วโมง (เช่น 10 / 18 / 22)
  let forced: number | null = null
  try { const v = localStorage.getItem('hd-3d-hour'); forced = v ? Number(v) : null } catch { /* */ }
  const h = forced != null && !Number.isNaN(forced) ? forced : d.getHours() + d.getMinutes() / 60
  // ขึ้น 6:00 · เที่ยงสูงสุด · ตก 18:30
  const day = clamp01(Math.sin(((h - 6) / 12.5) * Math.PI))
  const night = clamp01(h < 6 ? 1 - (h - 5) : h > 18.5 ? (h - 18.5) / 1.2 : 0)
  const dusk = clamp01(1 - Math.abs(h - 18.2) / 1.3) + clamp01(1 - Math.abs(h - 6.3) / 1.0)
  const ang = ((h - 6) / 12.5) * Math.PI          // มุมดวงอาทิตย์ตะวันออก → ตะวันตก
  return {
    night, dusk: clamp01(dusk), day,
    sunDir: new THREE.Vector3(-Math.cos(ang) * 22, Math.max(4, Math.sin(ang) * 26), 10),
    sunColor: lerpC('#fff4e0', '#ff9a4d', clamp01(dusk)).lerp(new THREE.Color('#9db4ff'), night),
    sunIntensity: 0.25 + day * 2.3 + dusk * 0.4,
    hemiSky: lerpC('#eaf4ff', '#2a3a66', night),
    hemiGround: lerpC('#b8a68a', '#1b1f2e', night),
    hemiIntensity: 0.9 - night * 0.45,
    exposure: 0.92 - night * 0.05,
  }
}

/** ท้องฟ้าไล่สีตามเวลา (มีดาวตอนกลางคืน) — วาดใหม่เฉพาะเมื่อเปลี่ยนช่วง */
const skyCache = new Map<string, THREE.Texture>()
export function skyAt(night: number, dusk: number): THREE.Texture {
  const key = `${Math.round(night * 10)}|${Math.round(dusk * 10)}`
  const hit = skyCache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas'); c.width = 16; c.height = 256
  const big = document.createElement('canvas'); big.width = 512; big.height = 256
  const x = big.getContext('2d')!
  const top = lerpC('#6fb0ec', '#0b1330', night), mid = lerpC('#cfe6fb', '#1d2a55', night).lerp(new THREE.Color('#ffb27a'), dusk * 0.6), bot = lerpC('#fbeee0', '#3a3456', night).lerp(new THREE.Color('#ff8f5a'), dusk * 0.7)
  const g = x.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, `#${top.getHexString()}`); g.addColorStop(0.55, `#${mid.getHexString()}`); g.addColorStop(1, `#${bot.getHexString()}`)
  x.fillStyle = g; x.fillRect(0, 0, 512, 256)
  if (night > 0.3) {
    let s = 97
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    x.fillStyle = '#ffffff'
    for (let i = 0; i < 160; i++) { x.globalAlpha = (0.3 + r() * 0.7) * night; x.fillRect(r() * 512, r() * 150, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1) }
    x.globalAlpha = 1
  }
  void c
  const t = new THREE.CanvasTexture(big); t.colorSpace = THREE.SRGBColorSpace
  skyCache.set(key, t)
  return t
}

/** เมฆก้อนฟู ๆ ลอยผ่านช้า ๆ */
export function buildClouds(cx: number, cz: number): { group: THREE.Group; tick: (t: number) => void } {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92 })
  const geo = new THREE.SphereGeometry(1, 12, 10)
  const clouds: THREE.Group[] = []
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group()
    for (let p = 0; p < 5; p++) { const m = new THREE.Mesh(geo, mat); m.position.set(p * 1.1 - 2.2, Math.sin(p * 1.7) * 0.4, Math.cos(p) * 0.6); m.scale.setScalar(0.9 + ((p * 37) % 5) * 0.15); c.add(m) }
    c.position.set(cx - 40 + i * 13, 14 + (i % 3) * 2.5, cz - 25 + (i % 4) * 9)
    c.scale.setScalar(1 + (i % 3) * 0.3)
    g.add(c); clouds.push(c)
  }
  return { group: g, tick: t => clouds.forEach((c, i) => { c.position.x = cx - 45 + ((i * 13 + t * (0.6 + (i % 3) * 0.2)) % 95) }) }
}

/** ต้นไม้ใหญ่ล้อมรอบตึก (InstancedMesh — ราว 70 ต้นแต่วาด 3 ครั้ง) */
export function buildTreeRing(w: number, h: number): THREE.Group {
  const g = new THREE.Group()
  const spots: { x: number; z: number; s: number; kind: number }[] = []
  let seed = 11
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let i = 0; i < 80; i++) {
    const side = i % 4, t = r()
    const off = 3 + r() * 9
    const x = side === 0 ? -off : side === 1 ? w + off : t * (w + 16) - 8
    const z = side === 2 ? -off : side === 3 ? h + off : t * (h + 16) - 8
    spots.push({ x, z, s: 0.8 + r() * 0.9, kind: r() < 0.4 ? 1 : 0 })
  }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 8), new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.9 }), spots.length)
  const round = spots.filter(s => s.kind === 0), pine = spots.filter(s => s.kind === 1)
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.2, 2), new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.85, flatShading: true }), round.length)
  const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.8, 9), new THREE.MeshStandardMaterial({ color: '#25643a', roughness: 0.85, flatShading: true }), pine.length)
  const d = new THREE.Object3D(), col = new THREE.Color()
  spots.forEach((s, i) => { d.position.set(s.x, 0.7 * s.s, s.z); d.scale.setScalar(s.s); d.rotation.set(0, 0, 0); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix) })
  round.forEach((s, i) => { d.position.set(s.x, 2.2 * s.s, s.z); d.scale.set(s.s * 1.1, s.s, s.s * 1.1); d.rotation.set(0, s.x, 0); d.updateMatrix(); crown.setMatrixAt(i, d.matrix); crown.setColorAt(i, col.set(['#3f8f3a', '#4c9a3f', '#367f33'][i % 3])) })
  pine.forEach((s, i) => { d.position.set(s.x, 2.6 * s.s, s.z); d.scale.setScalar(s.s); d.rotation.set(0, 0, 0); d.updateMatrix(); cone.setMatrixAt(i, d.matrix) })
  for (const m of [trunk, crown, cone]) { m.castShadow = true; m.receiveShadow = true; g.add(m) }
  return g
}

/** หญ้าพลิ้วลมบนช่องสวน — ใบแบนโค้งเรียวแหลม โคนเข้ม→ปลายอ่อน · ลมคำนวณใน shader (ไม่กิน CPU)
 *  + ดอกไม้ป่าเล็ก ๆ และใบโคลเวอร์แซมเป็นหย่อม */
export function buildGrass(tiles: { x: number; y: number }[]): { mesh: THREE.Group; tick: (t: number) => void } | null {
  if (!tiles.length) return null
  const g = new THREE.Group()
  const per = 30
  // ใบหญ้า: แผ่นเรียว 4 ท่อน งอโค้งไปข้างหน้า
  const geo = new THREE.PlaneGeometry(0.035, 0.26, 1, 4); geo.translate(0, 0.13, 0)
  { const p = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) { const h = p.getY(i) / 0.26; p.setX(i, p.getX(i) * (1 - h * 0.92)); p.setZ(i, h * h * 0.06) }
    geo.computeVertexNormals() }
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, side: THREE.DoubleSide })
  const uTime = { value: 0 }
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = uTime
    shader.vertexShader = 'uniform float uTime;\nvarying float vH;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vH = position.y / 0.26;
      vec4 wpos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float bend = vH * vH;
      float gust = sin(uTime * 0.6 + wpos.x * 0.15) * 0.5 + 0.5;
      transformed.x += (sin(uTime * 1.8 + wpos.x * 0.9 + wpos.z * 0.6) * 0.03 + gust * 0.025) * bend * 1.6;
      transformed.z += cos(uTime * 1.3 + wpos.x * 0.5) * 0.02 * bend;`)
    shader.fragmentShader = 'varying float vH;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(0.42, 1.18, vH);`)   // โคนในเงา ปลายรับแดด
  }
  const mesh = new THREE.InstancedMesh(geo, mat, tiles.length * per)
  const d = new THREE.Object3D(), col = new THREE.Color()
  let seed = 3, i = 0
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const tones = ['#5aa845', '#6fbf52', '#4b9a3c', '#82c95f', '#7bb84a', '#94c96a']
  for (const t of tiles) for (let k = 0; k < per; k++) {
    d.position.set(t.x + r(), 0, t.y + r()); d.rotation.set(0, r() * 6.3, (r() - 0.5) * 0.35); const s = 0.6 + r() * 0.9; d.scale.set(0.8 + r() * 0.6, s, 1); d.updateMatrix()
    mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, col.set(tones[Math.floor(r() * tones.length)]).offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.06)); i++
  }
  mesh.receiveShadow = true
  g.add(mesh)

  // ดอกไม้ป่า (ขาว/เหลือง/ม่วงอ่อน) + โคลเวอร์ — สุ่มบางช่อง
  const spots: { x: number; z: number; kind: number }[] = []
  for (const t of tiles) { const n = r() < 0.45 ? 1 + Math.floor(r() * 3) : 0; for (let k = 0; k < n; k++) spots.push({ x: t.x + 0.1 + r() * 0.8, z: t.y + 0.1 + r() * 0.8, kind: Math.floor(r() * 4) }) }
  const flowers = spots.filter(s => s.kind < 3), clover = spots.filter(s => s.kind === 3)
  if (flowers.length) {
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), flowers.length)
    const stem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.004, 0.005, 0.16, 4), new THREE.MeshStandardMaterial({ color: '#4d8a32' }), flowers.length)
    flowers.forEach((f, k) => {
      const h = 0.12 + r() * 0.08
      d.position.set(f.x, h / 2, f.z); d.rotation.set(0, 0, 0); d.scale.set(1, h / 0.16, 1); d.updateMatrix(); stem.setMatrixAt(k, d.matrix)
      d.position.set(f.x, h, f.z); d.scale.set(1, 0.55, 1); d.updateMatrix(); head.setMatrixAt(k, d.matrix)
      head.setColorAt(k, col.set(['#fffdf5', '#fde047', '#d8b4fe'][f.kind]))
    })
    g.add(stem, head)
  }
  if (clover.length) {
    const leaf = new THREE.InstancedMesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshStandardMaterial({ color: '#3f8f35', roughness: 0.6, side: THREE.DoubleSide }), clover.length * 3)
    clover.forEach((c, k) => { for (let j = 0; j < 3; j++) { const a = (j / 3) * Math.PI * 2; d.position.set(c.x + Math.cos(a) * 0.03, 0.02, c.z + Math.sin(a) * 0.03); d.rotation.set(-Math.PI / 2, 0, 0); d.scale.setScalar(1); d.updateMatrix(); leaf.setMatrixAt(k * 3 + j, d.matrix) } })
    leaf.receiveShadow = true; g.add(leaf)
  }
  return { mesh: g, tick: t => { uTime.value = t } }
}

/** ทางเดินแผ่นหินธรรมชาติ — แผ่นหินขอบไม่เรียบนูนจากพื้นกรวด มอสแทรกร่อง (InstancedMesh เดียว) */
export function buildStepStones(tiles: { x: number; y: number }[]): THREE.Object3D | null {
  if (!tiles.length) return null
  // แผ่นหิน: ทรงกระบอกเตี้ย 11 เหลี่ยม บิดขอบให้ไม่กลม ขอบบนลบมุม
  const geo = new THREE.CylinderGeometry(1, 1.04, 1, 11, 1);
  { const p = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * 3) * 0.08 + Math.sin(a * 5 + 1) * 0.05; p.setX(i, x * k); p.setZ(i, z * k) }
    geo.computeVertexNormals() }
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!
    x.fillStyle = '#b9b4ab'; x.fillRect(0, 0, 256, 256)
    let s = 41; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    for (let i = 0; i < 3000; i++) { const v = 150 + R() * 70; x.fillStyle = `rgba(${v},${v - 4},${v - 12},${0.3 + R() * 0.4})`; x.fillRect(R() * 256, R() * 256, 1 + R() * 2.5, 1 + R() * 2.5) }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(90,85,78,${0.2 + R() * 0.2})`; x.beginPath(); x.arc(R() * 256, R() * 256, 1 + R() * 3, 0, 7); x.fill() }
    x.strokeStyle = 'rgba(80,74,66,.35)'; x.lineWidth = 0.8
    for (let i = 0; i < 6; i++) { x.beginPath(); let px = R() * 256, py = R() * 256; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (R() - 0.5) * 50; py += (R() - 0.5) * 50; x.lineTo(px, py) } x.stroke() }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
  })()
  const stones: { x: number; z: number; rx: number; rz: number; rot: number; h: number }[] = []
  let seed = 17
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (const t of tiles) {
    // 1 แผ่นใหญ่ + 1–2 แผ่นเล็กเติมมุม
    stones.push({ x: t.x + 0.5 + (r() - 0.5) * 0.08, z: t.y + 0.5 + (r() - 0.5) * 0.08, rx: 0.36 + r() * 0.05, rz: 0.32 + r() * 0.05, rot: r() * 6.3, h: 0.035 + r() * 0.015 })
    const n = 1 + Math.floor(r() * 2)
    for (let k = 0; k < n; k++) { const c = Math.floor(r() * 4), sx = c % 2 ? 1 : -1, sz = c < 2 ? 1 : -1; stones.push({ x: t.x + 0.5 + sx * 0.43, z: t.y + 0.5 + sz * 0.43, rx: 0.06 + r() * 0.03, rz: 0.05 + r() * 0.03, rot: r() * 6.3, h: 0.025 }) }
  }
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88 }), stones.length)
  const d = new THREE.Object3D(), col = new THREE.Color()
  stones.forEach((s, i) => {
    d.position.set(s.x, s.h / 2 - 0.005, s.z); d.rotation.set((r() - 0.5) * 0.04, s.rot, (r() - 0.5) * 0.04); d.scale.set(s.rx, s.h, s.rz); d.updateMatrix()
    mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, col.setHSL(0.08 + r() * 0.05, 0.05 + r() * 0.07, 0.48 + r() * 0.14))
  })
  mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}
