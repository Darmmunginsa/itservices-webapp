import * as THREE from 'three'
import { floorTexture } from './textures3d'
import { mergeVertices as mergeVerts } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ── น้ำตก + บ่อปลาคาร์ฟ (มุมมอง 3D · เต็มฝีมือ) — ชิ้น 8×4 ช่อง ──
// แถว 0–1 = หน้าผาหินสองชั้น มีลำธารบนยอด · แถว 2–3 = บ่อลึกมองทะลุผิวน้ำ
// ทุกอย่างวาดด้วยโค้ด: ลายหิน ลายน้ำไหล ลายพื้นบ่อ+แสงระยิบใต้น้ำ ลายปลาคาร์ฟต่อตัว · ไม่มีไฟล์ภาพ

const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const canvasTex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, repeat = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// ── ลาย ──
const rockTex = () => canvasTex(256, 256, x => {
  x.fillStyle = '#7a756e'; x.fillRect(0, 0, 256, 256)
  const R = rnd(11)
  for (let i = 0; i < 2600; i++) { const v = 90 + R() * 80; x.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.25 + R() * 0.4})`; x.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1 + R() * 3) }
  x.strokeStyle = 'rgba(40,36,32,.5)'
  for (let i = 0; i < 22; i++) { x.lineWidth = 0.6 + R() * 1.4; x.beginPath(); let px = R() * 256, py = R() * 256; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 40; py += (R() - 0.5) * 40; x.lineTo(px, py) } x.stroke() }
})
const mossTex = () => canvasTex(128, 128, x => {
  x.fillStyle = '#3f6f2a'; x.fillRect(0, 0, 128, 128)
  const R = rnd(23)
  for (let i = 0; i < 1500; i++) { x.fillStyle = ['#5a8f36', '#2f5a20', '#6fa544', '#4a7d2e'][i % 4]; x.globalAlpha = 0.5 + R() * 0.5; x.beginPath(); x.arc(R() * 128, R() * 128, 0.6 + R() * 1.6, 0, Math.PI * 2); x.fill() }
  x.globalAlpha = 1
})
/** สายน้ำ: เส้นขาวยาวบนพื้นฟ้าใส มีความโปร่งต่างกัน (alpha) */
const fallsTex = () => canvasTex(128, 256, x => {
  x.clearRect(0, 0, 128, 256)
  const R = rnd(37)
  for (let i = 0; i < 140; i++) {
    const px = R() * 128, len = 20 + R() * 70, py = R() * 256, w = 0.8 + R() * 3
    const g = x.createLinearGradient(0, py, 0, py + len)
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(${220 + R() * 35},${240 + R() * 15},255,${0.45 + R() * 0.5})`); g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g; x.fillRect(px, py, w, len)
    if (py + len > 256) x.fillRect(px, py - 256, w, len)
  }
  x.globalCompositeOperation = 'destination-over'; x.fillStyle = 'rgba(170,220,245,.6)'; x.fillRect(0, 0, 128, 256)
})
const surfaceTex = () => canvasTex(256, 256, x => {
  x.fillStyle = '#3b8fb8'; x.fillRect(0, 0, 256, 256)
  const R = rnd(53)
  for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(255,255,255,${0.12 + R() * 0.25})`; x.lineWidth = 1 + R() * 1.5; const px = R() * 256, py = R() * 256, l = 12 + R() * 30; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 4, px + l, py); x.stroke() }
})
const bedTex = () => canvasTex(256, 256, x => {
  x.fillStyle = '#6b6352'; x.fillRect(0, 0, 256, 256)
  const R = rnd(67)
  for (let i = 0; i < 700; i++) { const v = 90 + R() * 90; x.fillStyle = `rgb(${v},${v - 8},${v - 25})`; x.beginPath(); x.ellipse(R() * 256, R() * 256, 2 + R() * 5, 1.5 + R() * 4, R() * 3, 0, Math.PI * 2); x.fill() }
})
/** แสงระยิบใต้น้ำ (caustics) — เส้นสว่างโค้งเป็นตาข่าย */
const causticTex = () => canvasTex(256, 256, x => {
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256)
  const R = rnd(79)
  x.strokeStyle = 'rgba(200,240,255,.55)'
  for (let i = 0; i < 70; i++) { x.lineWidth = 1 + R() * 2.5; const px = R() * 256, py = R() * 256, r = 10 + R() * 26; x.beginPath(); x.arc(px, py, r, R() * 6, R() * 6 + 1.5 + R() * 2); x.stroke() }
})
const softDot = () => canvasTex(64, 64, x => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 64, 64)
}, false)
type KoiScheme = 'kohaku' | 'sanke' | 'ogon' | 'showa' | 'chagoi'
/** ลายปลาคาร์ฟมองจากด้านบน: u = หัว→หาง (ซ้าย=หาง ขวา=หัว) · v = ข้างซ้าย→ข้างขวา · ลายแดง/ดำเกาะกลางหลัง ท้องขาว */
function koiTex(seed: number, scheme: KoiScheme) {
  return canvasTex(256, 128, x => {
    const base = { kohaku: '#fbfaf5', sanke: '#fbfaf5', ogon: '#fbfaf5', showa: '#202020', chagoi: '#d8361a' }[scheme]
    x.fillStyle = base; x.fillRect(0, 0, 256, 128)
    const R = rnd(seed)
    // ลายเป็นปื้นใหญ่ตามแนวหลัง (ไม่ลามถึงท้อง)
    const patch = (color: string, n: number, size: number, from = 40, to = 230) => {
      x.fillStyle = color
      for (let i = 0; i < n; i++) {
        const cx = from + R() * (to - from), cy = 64 + (R() - 0.5) * 40
        x.beginPath(); x.ellipse(cx, cy, size * (0.8 + R() * 0.7), size * (0.55 + R() * 0.35), (R() - 0.5) * 0.8, 0, Math.PI * 2); x.fill()
      }
    }
    if (scheme === 'kohaku') { patch('#d8361a', 3, 30, 60, 220); x.fillStyle = '#d8361a'; x.beginPath(); x.ellipse(232, 64, 16, 20, 0, 0, Math.PI * 2); x.fill() }
    if (scheme === 'sanke') { patch('#d8361a', 3, 26, 60, 230); patch('#151515', 5, 9, 50, 200) }
    if (scheme === 'showa') { patch('#d8361a', 3, 26, 70, 235); patch('#fbfaf5', 3, 18, 60, 200) }
    if (scheme === 'ogon') { patch('#d8361a', 3, 24, 60, 230); patch('#f5c518', 3, 18, 50, 220) }   // ขาว แดง เหลือง
    if (scheme === 'chagoi') { patch('#fbfaf5', 3, 22, 50, 220); patch('#151515', 5, 10, 50, 210) }   // แดง ขาว ดำ
    // เกล็ดตาข่าย (เห็นชัดบนหลัง)
    x.strokeStyle = scheme === 'showa' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.16)'; x.lineWidth = 0.8
    for (let yy = 6; yy < 122; yy += 7) for (let xx = (yy % 14 ? 0 : 4); xx < 225; xx += 8) { x.beginPath(); x.arc(xx, yy, 4.2, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2, true); x.stroke() }
    // หัวไม่มีเกล็ด · ขอบตัวเข้มเล็กน้อย (มีมิติ)
    const sh = x.createLinearGradient(0, 0, 0, 128); sh.addColorStop(0, 'rgba(0,0,0,.18)'); sh.addColorStop(0.25, 'rgba(0,0,0,0)'); sh.addColorStop(0.75, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.18)')
    x.fillStyle = sh; x.fillRect(0, 0, 256, 128)
  }, false)
}

/** ครีบโปร่งแสงมีก้านครีบ */
const finTex = (tint: string) => canvasTex(128, 128, x => {
  x.clearRect(0, 0, 128, 128)
  const g = x.createRadialGradient(0, 64, 0, 0, 64, 128); g.addColorStop(0, tint); g.addColorStop(1, 'rgba(255,255,255,.35)')
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.2
  for (let a = -1.4; a <= 1.4; a += 0.14) { x.beginPath(); x.moveTo(0, 64); x.lineTo(Math.cos(a) * 140, 64 + Math.sin(a) * 140); x.stroke() }
}, false)

/** ปลาคาร์ฟ: ลำตัวป้อมเรียวสู่โคนหาง (มองจากบนเห็นทรงปลาชัด) · หางแฉกบาน · ครีบอกกาง · ครีบหลัง · หนวด
 *  ว่ายแบบปลาจริง: ลำตัวบิดเป็นคลื่นตัว S (คำนวณจุดยอดทุกเฟรม) · หาง/ครีบสะบัดตาม */
export function buildKoi(seed: number, scheme: KoiScheme, size: number) {
  const g = new THREE.Group()
  const L = 0.34 * size                    // ความยาวลำตัว (ไม่รวมหาง)
  // ทรงลำตัว: ทรงกลมแล้วดัดตามแนว x (−1 = โคนหาง · +1 = จมูก)
  const geo = new THREE.SphereGeometry(1, 40, 20); geo.rotateZ(-Math.PI / 2)   // แกนยาวตาม x
  const pos = geo.attributes.position as THREE.BufferAttribute, uv = geo.attributes.uv as THREE.BufferAttribute
  const prof = (s: number) => {            // s ∈ [−1,1] → รัศมี (หัวมน กว้างสุดช่วงไหล่ เรียวสู่โคนหาง)
    if (s > 0.3) return Math.pow(Math.max(0, 1 - ((s - 0.3) / 0.7) ** 2), 0.32)   // หัวมนรี
    return 0.13 + 0.87 * Math.pow((s + 1) / 1.3, 1.4)                                   // เรียวสู่โคนหาง
  }
  for (let i = 0; i < pos.count; i++) {
    const sx = pos.getX(i), sy = pos.getY(i), sz = pos.getZ(i)
    const r = Math.hypot(sy, sz) || 1e-6, k = prof(sx) / Math.max(r, 1e-6) * Math.min(1, r / 1)
    const ny = sy * k, nz = sz * k
    pos.setXYZ(i, sx * L / 2, (ny * 0.38 + (ny < 0 ? ny * -0.08 : 0)) * L / 2, nz * 0.28 * L / 2)   // แบนข้างเล็กน้อย ท้องแบน
    uv.setXY(i, (sx + 1) / 2, 0.5 + nz * 0.5 * (ny >= 0 ? 1 : 1.25))   // แปะลายจากด้านบน
  }
  geo.computeVertexNormals()
  const base = Float32Array.from(pos.array as Float32Array)
  const body = new THREE.Mesh(geo, std({ map: koiTex(seed, scheme), roughness: 0.42, metalness: 0.04 }))
  body.castShadow = true; g.add(body)

  const tint = { kohaku: 'rgba(255,235,225,.75)', sanke: 'rgba(255,235,225,.75)', ogon: 'rgba(255,235,200,.75)', showa: 'rgba(60,60,60,.75)', chagoi: 'rgba(255,220,210,.75)' }[scheme]
  const fin = new THREE.MeshStandardMaterial({ map: finTex(tint), transparent: true, side: THREE.DoubleSide, roughness: 0.4, depthWrite: false })

  // หางแฉกบาน (แนวตั้งเอียงนิด ให้มองจากบนเห็นเป็นพัด)
  const tailShape = new THREE.Shape()
  tailShape.moveTo(0, 0)
  tailShape.bezierCurveTo(0.25, 0.18, 0.55, 0.42, 0.62, 0.5)
  tailShape.quadraticCurveTo(0.42, 0.12, 0.46, 0)
  tailShape.quadraticCurveTo(0.42, -0.12, 0.62, -0.5)
  tailShape.bezierCurveTo(0.55, -0.42, 0.25, -0.18, 0, 0)
  const tailGeo = new THREE.ShapeGeometry(tailShape, 16)
  { const u = tailGeo.attributes.uv as THREE.BufferAttribute, p = tailGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < u.count; i++) u.setXY(i, p.getX(i) / 0.62, 0.5 + p.getY(i)) }
  const tailPivot = new THREE.Group(); tailPivot.position.x = -L / 2; g.add(tailPivot)
  const tail = new THREE.Mesh(tailGeo, fin); tail.scale.setScalar(L * 0.75); tail.rotation.set(Math.PI / 2 - 0.25, Math.PI, 0); tailPivot.add(tail)
  // ครีบอก (กางสองข้าง แบนราบ) · ครีบท้องเล็ก
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.quadraticCurveTo(0.35, 0.05, 0.5, 0.32); finShape.quadraticCurveTo(0.2, 0.36, 0, 0.08); finShape.lineTo(0, 0)
  const finGeo = new THREE.ShapeGeometry(finShape, 10)
  { const u = finGeo.attributes.uv as THREE.BufferAttribute, p = finGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < u.count; i++) u.setXY(i, Math.hypot(p.getX(i), p.getY(i)) * 1.8, 0.5 + p.getY(i)) }
  const pecs: THREE.Mesh[] = []
  for (const [d, xx, sc] of [[1, 0.22, 0.5], [-1, 0.22, 0.5], [1, -0.18, 0.3], [-1, -0.18, 0.3]] as const) {
    // วางราบ ชี้ไปด้านหลัง-ออกข้าง (กลับด้านด้วย scale แทนการหมุนหลายแกน)
    const m = new THREE.Mesh(finGeo, fin); m.scale.set(-L * sc, d > 0 ? -L * sc : L * sc, L * sc)
    m.position.set(xx * L, -0.04 * L, d * 0.07 * L); m.rotation.x = -Math.PI / 2
    m.userData.d = d; g.add(m); pecs.push(m)
  }
  // ครีบหลัง (ยาวตามแนวสันหลัง)
  const dShape = new THREE.Shape(); dShape.moveTo(0, 0); dShape.lineTo(0.7, 0); dShape.quadraticCurveTo(0.62, 0.22, 0.48, 0.24); dShape.quadraticCurveTo(0.2, 0.12, 0, 0)
  const dorsal = new THREE.Mesh(new THREE.ShapeGeometry(dShape, 8), fin); dorsal.scale.setScalar(L * 0.55); dorsal.position.set(-0.3 * L, 0.17 * L, 0); g.add(dorsal)
  // ตา + หนวดสองคู่
  for (const d of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.024 * L, 10, 8), std({ color: '#0b0b0b', roughness: 0.1 })); e.position.set(0.37 * L, 0.05 * L, d * 0.085 * L); g.add(e)
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006 * L, 0.003 * L, 0.12 * L, 4), std({ color: '#d9c9a8' })); bar.rotation.set(d * 0.9, 0, -1.2); bar.position.set(0.5 * L, -0.03 * L, d * 0.06 * L); g.add(bar)
  }

  /** ว่าย: คลื่นตัว S วิ่งจากหัวไปหาง — ยิ่งใกล้หางยิ่งแกว่งมาก · turn = เลี้ยว (โค้งทั้งตัว) */
  const swim = (t: number, speed: number, turn: number) => {
    const freq = 5 + speed * 40
    const arr = pos.array as Float32Array
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], s = 0.5 - x / L        // 0 = จมูก … 1 = โคนหาง
      const amp = 0.09 * L * s * s
      arr[i * 3 + 2] = base[i * 3 + 2] + Math.sin(t * freq - s * 4.2) * amp + turn * s * s * 0.25 * L
    }
    pos.needsUpdate = true; geo.computeVertexNormals()
    const tailDz = Math.sin(t * freq - 4.2) * 0.09 * L + turn * 0.25 * L
    const tailSlope = Math.cos(t * freq - 4.2) * 0.09 * 4.2 + turn * 0.5
    tailPivot.position.z = tailDz
    tailPivot.rotation.y = -tailSlope * 0.9
    dorsal.position.z = Math.sin(t * freq - 2.6) * 0.03 * L
    pecs.forEach((p, k) => { p.rotation.x = -Math.PI / 2 + Math.sin(t * 2.2 + k) * 0.3 * (p.userData.d as number) })
  }
  return { group: g, swim }
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o)

/** หินก้อน (ทรงหลายเหลี่ยมบิดผิว) */
function boulder(r: number, seed: number, mat: THREE.Material) {
  const geo = new THREE.IcosahedronGeometry(r, 2)
  const p = geo.attributes.position as THREE.BufferAttribute
  const n = new THREE.Vector3()
  // บิดผิวตามตำแหน่ง (จุดเดียวกันได้ค่าเดียวกัน → ผิวไม่ฉีกเป็นเกล็ด)
  const bump = (x: number, y: number, z: number) => Math.sin(x * 5.1 + seed) * Math.sin(y * 4.3 + seed * 0.7) * Math.sin(z * 4.7 + seed * 1.3) + Math.sin(x * 11 + y * 9 + seed) * 0.35
  for (let i = 0; i < p.count; i++) { n.fromBufferAttribute(p, i); const u = n.clone().normalize(); const k = 1 + bump(u.x, u.y, u.z) * 0.16; p.setXYZ(i, n.x * k, n.y * k * 0.8, n.z * k) }
  geo.deleteAttribute('normal'); const merged = mergeVerts(geo)
  merged.computeVertexNormals()
  const m = new THREE.Mesh(merged, mat); m.castShadow = true; m.receiveShadow = true
  return m
}

/** แผ่นม่านน้ำโค้ง: จากขอบผา (y0,z0) ตกลงถึงผิวน้ำ (y1,z1) แบบพาราโบลา */
function fallsSheet(width: number, y0: number, z0: number, y1: number, z1: number, mat: THREE.Material) {
  const geo = new THREE.PlaneGeometry(width, 1, 8, 20)
  const p = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const t = 0.5 - p.getY(i)   // 0 = บน · 1 = ล่าง
    const y = y0 + (y1 - y0) * t
    const z = z0 + (z1 - z0) * Math.pow(t, 0.55)   // พุ่งออกจากผาแล้วตกตรง
    const spread = 1 + t * 0.18
    p.setXYZ(i, p.getX(i) * spread, y, z)
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, mat)
  return m
}

/** ขนเป็ด: ตัวผู้ = เทาลายละเอียด · ตัวเมีย = น้ำตาลลายเกล็ดขน */
const featherTex = (drake: boolean) => canvasTex(128, 128, x => {
  x.fillStyle = drake ? '#a8a9a4' : '#8a6a46'; x.fillRect(0, 0, 128, 128)
  const R = rnd(drake ? 901 : 907)
  if (drake) { x.strokeStyle = 'rgba(60,60,60,.35)'; x.lineWidth = 0.6; for (let y = 0; y < 128; y += 2.2) { x.beginPath(); x.moveTo(0, y); for (let xx = 0; xx <= 128; xx += 8) x.lineTo(xx, y + Math.sin(xx * 0.4 + y) * 0.8); x.stroke() } }
  else for (let i = 0; i < 260; i++) { const px = R() * 128, py = R() * 128; x.fillStyle = `rgba(${50 + R() * 30},${32 + R() * 20},${18},.75)`; x.beginPath(); x.ellipse(px, py, 4 + R() * 3, 2.2 + R() * 1.5, 0.2, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(225,195,150,.6)'; x.beginPath(); x.ellipse(px + 1, py + 2.5, 4, 1, 0.2, 0, Math.PI); x.fill() }
})

export interface DuckRig { group: THREE.Group; body: THREE.Group; head: THREE.Group; feet: THREE.Group[] }
/** เป็ดมัลลาร์ด — body = ส่วนที่เอียง (มุดหัว/ดำน้ำ) · หมุนรอบกลางตัวบนผิวน้ำ */
export function buildDuck(seed: number): DuckRig {
  const drake = seed % 2 === 1
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body)
  const plum = std({ map: featherTex(drake), roughness: 0.75 })
  // ลำตัวทรงเรือ: อกกลมหน้า ท้ายเรียวงอนขึ้น
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.15, 28, 20), plum)
  { const p = torso.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), back = Math.max(0, -x / 0.15)
      p.setXYZ(i, x * 1.55, y * 0.78 + back * back * 0.07 + (y < 0 ? y * 0.15 : 0), z * (0.92 - back * 0.25)) }
    torso.geometry.computeVertexNormals() }
  torso.position.y = 0.07; body.add(torso)
  if (drake) { const breast = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14), std({ color: '#6b3a26', roughness: 0.6 })); breast.scale.set(0.9, 1, 1.15); breast.position.set(0.13, 0.08, 0); body.add(breast) }
  // ปีกพับข้างตัว + แถบน้ำเงินเหลือบ (speculum)
  for (const d of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 12), drake ? std({ color: '#8f8a80', roughness: 0.7 }) : plum)
    wing.scale.set(1.55, 0.42, 0.42); wing.position.set(-0.04, 0.12, d * 0.095); wing.rotation.z = 0.12; body.add(wing)
    const spec = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.005), std({ color: '#2b3fbf', roughness: 0.2, metalness: 0.5, emissive: '#1d2a8a', emissiveIntensity: 0.2 }))
    spec.position.set(-0.1, 0.125, d * 0.142); spec.rotation.y = d * 0.12; body.add(spec)
  }
  // หาง: ขนดำงอนขึ้น (ตัวผู้มีขนม้วน)
  const tailM = std({ color: drake ? '#1d1d1d' : '#6d5134', roughness: 0.6 })
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 10), tailM); tail.rotation.z = Math.PI / 2 + 0.75; tail.position.set(-0.23, 0.14, 0); tail.scale.z = 0.55; body.add(tail)
  if (drake) { const curl = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12, Math.PI * 1.4), tailM); curl.position.set(-0.24, 0.19, 0); body.add(curl) }
  // คอ + หัว (ตัวผู้: เขียวเหลือบ + วงคอขาว)
  const head = new THREE.Group(); head.position.set(0.17, 0.15, 0); body.add(head)
  const headM = drake ? std({ color: '#0f5a2c', roughness: 0.25, metalness: 0.35, emissive: '#06301a', emissiveIntensity: 0.3 }) : plum
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.06, 0.12, 14), headM); neck.position.set(0.0, 0.05, 0); neck.rotation.z = -0.25; head.add(neck)
  if (drake) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 20), std({ color: '#f5f5f0' })); ring.rotation.set(Math.PI / 2, 0.25, 0); ring.position.set(0.0, 0.015, 0); head.add(ring) }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.062, 20, 14), headM); skull.scale.set(1.25, 0.95, 0.88); skull.position.set(0.035, 0.13, 0); head.add(skull)
  // จะงอยปากแบน
  const bill = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 8), std({ color: drake ? '#e7c22e' : '#c76b1c', roughness: 0.45 }))
  bill.scale.set(1.55, 0.32, 0.72); bill.position.set(0.112, 0.112, 0); bill.rotation.z = -0.18; head.add(bill)
  const nail = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), std({ color: '#222' })); nail.position.set(0.172, 0.103, 0); head.add(nail)
  if (!drake) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.11), std({ color: '#3b2a1a' })); stripe.position.set(0.05, 0.135, 0); head.add(stripe) }
  for (const d of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), std({ color: '#0b0b0b', roughness: 0.1 })); e.position.set(0.07, 0.145, d * 0.05); head.add(e) }
  // ตีนพังผืดสีส้ม (เห็นตอนกระดกก้น)
  const footM = std({ color: '#f08a24', roughness: 0.5, side: THREE.DoubleSide })
  const feet: THREE.Group[] = []
  for (const d of [-1, 1]) {
    const f = new THREE.Group(); f.position.set(-0.04, 0.0, d * 0.05); body.add(f)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6), footM); leg.position.y = -0.035; f.add(leg)
    const web = new THREE.Mesh(new THREE.CircleGeometry(0.04, 3, -0.9, 1.8), footM); web.rotation.x = -Math.PI / 2; web.position.set(0.0, -0.07, 0); f.add(web)
    feet.push(f)
  }
  g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true })
  return { group: g, body, head, feet }
}

export function buildWaterfallReal(w: number): { group: THREE.Group; tick: (t: number) => void } {
  const g = new THREE.Group()
  const ticks: ((t: number, dt: number) => void)[] = []

  // ── วัสดุ ──
  const rTex = rockTex()
  const rock = std({ map: rTex, roughness: 0.92 })
  const rockDark = std({ map: rTex, color: '#8a8580', roughness: 0.92 })
  const wetRock = std({ map: rTex, color: '#6f6a64', roughness: 0.35, metalness: 0.05 })
  const moss = std({ map: mossTex(), roughness: 0.95 })

  // ── หน้าผาสองชั้น (แถว 0–1) ──
  const R = rnd(5)
  for (let i = 0; i < 26; i++) {
    const x = 0.2 + R() * (w - 0.4), back = R() < 0.6
    const r = back ? 0.45 + R() * 0.35 : 0.3 + R() * 0.25
    const nearFalls = Math.abs(x - w / 2) < 1.0
    if (nearFalls) continue                     // เว้นช่องให้น้ำตกตกลงมา
    const b = boulder(r, i * 13 + 7, nearFalls ? wetRock : (i % 3 ? rock : rockDark))
    b.position.set(x, back ? 0.9 + R() * 0.9 : 0.25 + R() * 0.45, back ? 0.35 + R() * 0.5 : 1.15 + R() * 0.45)
    b.rotation.set(R() * 3, R() * 3, R() * 3)
    g.add(b)
    if (!nearFalls && R() < 0.7) { const m = boulder(r * 0.55, i * 17 + 3, moss); m.position.copy(b.position).add(new THREE.Vector3(0, r * 0.62, 0)); m.scale.y = 0.35; g.add(m) }
  }
  for (const d of [-1, 1]) for (let k = 0; k < 3; k++) {
    const b = boulder(0.32 - k * 0.04, 700 + k * 9 + (d + 1) * 40, wetRock)
    b.position.set(w / 2 + d * (0.82 + k * 0.08), 0.35 + k * 0.6, 0.85 + (2 - k) * 0.25); g.add(b)
  }
  // ผนังหลังทึบ (กันมองทะลุ) + ไม้เลื้อยห้อย
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.1, 0.5), rockDark); wall.position.set(w / 2, 1.05, 0.25); wall.castShadow = true; wall.receiveShadow = true; g.add(wall)
  const vine = std({ color: '#3f7d2e', roughness: 0.8, side: THREE.DoubleSide })
  for (let i = 0; i < 14; i++) { const v = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.5 + R() * 0.6), vine); const x = R() * w; if (Math.abs(x - w / 2) < 0.9) continue; v.position.set(x, 1.6 - R() * 0.3, 0.52 + R() * 0.2); g.add(v) }

  // ── ลำธารบนยอดผา → ขอบผา ──
  const fTex = fallsTex()
  const streamMat = std({ map: surfaceTex(), color: '#cfe9f5', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.88 })
  const stream = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), streamMat); stream.rotation.x = -Math.PI / 2; stream.position.set(w / 2, 2.12, 0.6); g.add(stream)
  const sTex = streamMat.map!; sTex.repeat.set(1, 1)
  ticks.push(t => { sTex.offset.set(0, -t * 0.35) })
  const lip = boulder(0.18, 99, wetRock); lip.scale.set(4.5, 0.6, 1); lip.position.set(w / 2, 2.05, 1.0); g.add(lip)

  // ── น้ำตกหลัก (โค้งพุ่งแล้วตก) 2 ชั้นซ้อน ความเร็วต่างกัน ──
  const mkFalls = (speed: number, opacity: number, width: number, z0: number, z1: number) => {
    const t = fTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.3, 1)
    const m = std({ map: t, color: '#ffffff', transparent: true, opacity, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false, emissive: '#1b4a66', emissiveIntensity: 0.15 })
    const sheet = fallsSheet(width, 2.05, z0, 0.02, z1, m); sheet.position.x = w / 2; g.add(sheet)
    ticks.push(tt => { t.offset.y = (tt * speed) % 1 })
  }
  mkFalls(1.15, 0.95, 1.25, 1.05, 2.15)
  mkFalls(1.7, 0.6, 1.05, 1.1, 2.1)
  // น้ำตกขั้นบันไดเล็กด้านซ้าย
  {
    const t = fTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping
    const m = std({ map: t, transparent: true, opacity: 0.85, roughness: 0.15, side: THREE.DoubleSide, depthWrite: false })
    const a = fallsSheet(0.35, 1.25, 1.0, 0.62, 1.3, m), b = fallsSheet(0.4, 0.62, 1.32, 0.02, 1.95, m)
    a.position.x = b.position.x = 1.3; g.add(a, b)
    const step = boulder(0.22, 211, wetRock); step.scale.set(1.6, 0.5, 1.1); step.position.set(1.3, 0.55, 1.35); g.add(step)
    ticks.push(tt => { t.offset.y = (tt * 1.3) % 1 })
  }

  // ── บ่อลึก (แถว 2–3) มองทะลุผิวน้ำ ──
  const cx = w / 2, cz = 2.95, rx = w / 2 - 0.25, rz = 0.92
  const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 48), std({ map: bedTex(), roughness: 0.95 }))
  bed.rotation.x = -Math.PI / 2; bed.scale.set(rx, rz, 1); bed.position.set(cx, -0.32, cz); bed.receiveShadow = true; g.add(bed)
  // ขอบหญ้ารอบบ่อ (สี่เหลี่ยมเจาะรูวงรี) — แทนพื้นที่เว้นไว้
  {
    const sh = new THREE.Shape(); sh.moveTo(0, 2); sh.lineTo(w, 2); sh.lineTo(w, 4); sh.lineTo(0, 4); sh.lineTo(0, 2)
    const hole = new THREE.Path(); hole.absellipse(cx, cz, rx, rz, 0, Math.PI * 2, true); sh.holes.push(hole)
    const geo = new THREE.ShapeGeometry(sh, 48); geo.rotateX(Math.PI / 2)   // (x, y) → (x, 0, y)
    const gt = floorTexture('g')
    const rim = new THREE.Mesh(geo, std({ map: gt ?? undefined, color: gt ? '#ffffff' : '#5aa845', roughness: 0.95, side: THREE.DoubleSide }))
    if (gt) { const u = geo.attributes.uv as THREE.BufferAttribute; const p = geo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < u.count; i++) u.setXY(i, p.getX(i), p.getZ(i)) }
    rim.receiveShadow = true; g.add(rim)
  }
  // ผนังบ่อ (ทรงกรวยเตี้ย) สีเข้ม
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.92, 0.34, 48, 1, true), std({ color: '#3d4a3f', roughness: 0.9, side: THREE.BackSide }))
  bowl.scale.set(rx, 1, rz); bowl.position.set(cx, -0.15, cz); g.add(bowl)
  // แสงระยิบใต้น้ำ (บวกแสง ซ้อนสองชั้นเลื่อนสวนกัน)
  const cTex1 = causticTex(), cTex2 = causticTex(); cTex1.repeat.set(3, 1.2); cTex2.repeat.set(2.4, 1)
  for (const [tx, sp, y] of [[cTex1, 0.05, -0.31], [cTex2, -0.035, -0.305]] as const) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }))
    c.rotation.x = -Math.PI / 2; c.scale.set(rx, rz, 1); c.position.set(cx, y, cz); g.add(c)
    ticks.push(t => { tx.offset.set(t * sp, Math.sin(t * 0.3) * 0.05) })
  }
  // ผิวน้ำ: ใส เห็นปลา สะท้อนแสง ระลอกเคลื่อน
  const surfMap = surfaceTex(); surfMap.repeat.set(3, 1.1)
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1, 48), std({ map: surfMap, color: '#9fd3ea', roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1 }))
  surface.rotation.x = -Math.PI / 2; surface.scale.set(rx, rz, 1); surface.position.set(cx, 0.02, cz); surface.renderOrder = 2; g.add(surface)
  ticks.push(t => { surfMap.offset.set(Math.sin(t * 0.12) * 0.1, t * 0.03) })
  // ขอบบ่อหินก้อนกลม
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2
    const b = boulder(0.12 + ((i * 7) % 5) * 0.025, 300 + i, i % 4 ? rock : moss)
    b.position.set(cx + Math.cos(a) * (rx + 0.08), 0.03, cz + Math.sin(a) * (rz + 0.08)); b.scale.y = 0.7; g.add(b)
  }

  // ── ฟองขาว + ละอองกระเซ็น + ไอหมอก + วงคลื่น ที่ตีนน้ำตก ──
  const foamMat = std({ color: '#ffffff', roughness: 0.6, transparent: true, opacity: 0.9 })
  const foams: THREE.Mesh[] = []
  for (let i = 0; i < 12; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1 + (i % 3) * 0.04, 10, 8), foamMat); f.position.set(cx - 0.7 + i * 0.13, 0.03, 2.15 + ((i * 3) % 4) * 0.05); f.scale.y = 0.45; g.add(f); foams.push(f) }
  ticks.push(t => foams.forEach((f, i) => { const s = 0.75 + Math.abs(Math.sin(t * 4 + i * 1.3)) * 0.5; f.scale.set(s, 0.45 * s, s) }))
  // ละออง (Points)
  const N = 260, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N)
  const spawn = (i: number) => {
    pos[i * 3] = cx + (Math.random() - 0.5) * 1.2; pos[i * 3 + 1] = 0.05; pos[i * 3 + 2] = 2.15 + (Math.random() - 0.5) * 0.15
    vel[i * 3] = (Math.random() - 0.5) * 0.9; vel[i * 3 + 1] = 0.6 + Math.random() * 1.1; vel[i * 3 + 2] = 0.2 + Math.random() * 0.7
    life[i] = Math.random()
  }
  for (let i = 0; i < N; i++) spawn(i)
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const spray = new THREE.Points(pgeo, new THREE.PointsMaterial({ size: 0.05, map: softDot(), transparent: true, opacity: 0.85, depthWrite: false, color: '#ffffff' }))
  g.add(spray)
  ticks.push((_t, dt) => {
    for (let i = 0; i < N; i++) {
      life[i] += dt * 0.9
      vel[i * 3 + 1] -= 3.2 * dt
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      if (pos[i * 3 + 1] < 0 || life[i] > 1.2) spawn(i)
    }
    pgeo.attributes.position.needsUpdate = true
  })
  // ไอหมอก (sprite นุ่ม ๆ ลอยพลิ้ว)
  const mistMat = new THREE.SpriteMaterial({ map: softDot(), color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false })
  const mists: THREE.Sprite[] = []
  for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(mistMat); s.position.set(cx - 0.9 + i * 0.3, 0.35 + (i % 3) * 0.15, 2.25); s.scale.setScalar(0.9 + (i % 3) * 0.3); g.add(s); mists.push(s) }
  ticks.push(t => mists.forEach((s, i) => { s.position.y = 0.3 + ((t * 0.18 + i * 0.13) % 0.6); s.material.opacity = 0.25 * (1 - ((t * 0.18 + i * 0.13) % 0.6) / 0.6) + 0.05 }))
  // วงคลื่นแผ่ออก
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })
  const rings: THREE.Mesh[] = []
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 48), ringMat.clone()); r.rotation.x = -Math.PI / 2; r.position.set(cx, 0.035, 2.35); g.add(r); rings.push(r) }
  ticks.push(t => rings.forEach((r, i) => { const p = ((t * 0.35 + i * 0.25) % 1); r.scale.set(0.3 + p * 2.6, 0.2 + p * 1.0, 1); (r.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - p) }))

  // ── ปลาคาร์ฟ 7 ตัว ว่ายตามเส้นทางของตัวเอง ใต้ผิวน้ำ ──
  const schemes = ['kohaku', 'sanke', 'ogon', 'showa', 'kohaku', 'chagoi', 'sanke'] as const
  schemes.forEach((sc, i) => {
    const f = buildKoi(1000 + i * 77, sc, 1.5 + (i % 3) * 0.25)
    g.add(f.group)
    const pts: THREE.Vector3[] = []
    const Rk = rnd(500 + i * 31)
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Rk() * 0.6; pts.push(new THREE.Vector3(cx + Math.cos(a) * rx * (0.35 + Rk() * 0.5), -0.035 - Rk() * 0.03, cz + Math.sin(a) * rz * (0.3 + Rk() * 0.5))) }
    const path = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5)
    const speed = 0.018 + (i % 4) * 0.006, off = i * 0.13
    const look = new THREE.Vector3(), ahead = new THREE.Vector3()
    ticks.push(t => {
      const u = (t * speed + off) % 1
      path.getPointAt(u, f.group.position)
      path.getPointAt((u + 0.01) % 1, look)
      // หันหัวตามทิศว่าย (พิกัดในชิ้น — lookAt ใช้พิกัดโลก จึงคำนวณมุมเอง)
      f.group.rotation.set(0, Math.atan2(-(look.z - f.group.position.z), look.x - f.group.position.x), Math.sin(t * 2 + i) * 0.05)
      // เลี้ยว = มุมเปลี่ยนระหว่างช่วงหน้า → ลำตัวโค้งเข้าโค้ง
      path.getPointAt((u + 0.02) % 1, ahead)
      const h1 = Math.atan2(look.z - f.group.position.z, look.x - f.group.position.x), h2 = Math.atan2(ahead.z - look.z, ahead.x - look.x)
      let turn = h2 - h1; if (turn > Math.PI) turn -= Math.PI * 2; if (turn < -Math.PI) turn += Math.PI * 2
      f.swim(t + i, speed, Math.max(-0.6, Math.min(0.6, -turn * 3)))
    })
  })

  // ── ใบบัว + ดอกบัว · กกริมบ่อ ──
  const pad = std({ color: '#2f7d32', roughness: 0.5, side: THREE.DoubleSide })
  const pads: THREE.Mesh[] = []
  for (const [x, z, r] of [[cx - 2.6, 2.6, 0.22], [cx + 2.4, 3.3, 0.25], [cx - 1.2, 3.55, 0.18], [cx + 1.5, 2.55, 0.17], [cx + 0.4, 3.6, 0.2]] as const) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 20, 0.3, Math.PI * 2 - 0.6), pad); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.035, z); g.add(p); pads.push(p)
  }
  ticks.push(t => pads.forEach((p, i) => { p.position.y = 0.035 + Math.sin(t * 0.8 + i) * 0.006; p.rotation.z = Math.sin(t * 0.2 + i) * 0.1 }))
  const petal = std({ color: '#f9a8d4', roughness: 0.5, side: THREE.DoubleSide })
  for (const [x, z] of [[cx + 2.4, 3.3], [cx - 1.2, 3.55]] as const) {
    const fl = new THREE.Group(); fl.position.set(x, 0.05, z); g.add(fl)
    for (let ring = 0; ring < 2; ring++) for (let k = 0; k < 7; k++) { const pm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI), petal); pm.scale.set(0.5, 1.2, 0.35); pm.rotation.set(-0.6 - ring * 0.5, (k / 7) * Math.PI * 2 + ring * 0.4, 0); pm.position.y = 0.03; fl.add(pm) }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.025, 10), std({ color: '#facc15' })); core.position.y = 0.06; fl.add(core)
  }
  const reed = std({ color: '#6b8e23', roughness: 0.8 }), cat = std({ color: '#5b3a22', roughness: 0.9 })
  for (const [x, z] of [[0.35, 2.3], [0.5, 3.75], [w - 0.4, 2.4], [w - 0.5, 3.7]] as const) {
    for (let k = 0; k < 7; k++) {
      const h = 0.6 + (k % 3) * 0.2
      const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 5), reed); r1.position.set(x + (k % 3 - 1) * 0.06, h / 2, z + (k % 2 - 0.5) * 0.08); r1.rotation.z = (k % 3 - 1) * 0.12; g.add(r1)
      if (k % 2 === 0) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8), cat); c.position.set(r1.position.x, h - 0.05, r1.position.z); c.rotation.z = r1.rotation.z; g.add(c) }
    }
  }

  // ── เป็ดมัลลาร์ดคู่: ว่ายเล่น · มุดหัวหากิน (ก้นกระดก ตีนพาย) · ดำผุดดำโผล่ ──
  const inPond = (x: number, z: number) => ((x - cx) / (rx * 0.78)) ** 2 + ((z - cz) / (rz * 0.72)) ** 2 < 1 && z > 2.45
  const splashMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
  const ducks = [buildDuck(1), buildDuck(2)].map((rig, i) => {
    g.add(rig.group)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), splashMat.clone()); ring.rotation.x = -Math.PI / 2; g.add(ring)
    const drops: THREE.Mesh[] = []
    for (let k = 0; k < 8; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), splashMat.clone()); g.add(d); drops.push(d) }
    const R = rnd(77 + i * 13)
    return {
      rig, ring, drops, R,
      x: cx + (i ? 1.6 : -1.6), z: 3.1, heading: i ? Math.PI : 0, tx: cx, tz: 3.1,
      mode: 'swim' as 'swim' | 'dabble' | 'dive', since: 0, next: 6 + i * 5, splashAt: -9, sx: 0, sz: 0,
    }
  })
  const newTarget = (d: (typeof ducks)[number]) => { for (let k = 0; k < 20; k++) { const x = cx + (d.R() - 0.5) * rx * 1.6, z = cz + (d.R() - 0.5) * rz * 1.5; if (inPond(x, z)) { d.tx = x; d.tz = z; return } } }
  const splash = (d: (typeof ducks)[number], t: number) => { d.splashAt = t; d.sx = d.x; d.sz = d.z }
  ducks.forEach(newTarget)
  ticks.push((t, dt) => ducks.forEach((d, i) => {
    const { rig } = d, el = t - d.since
    // วงน้ำ + หยดน้ำกระเซ็น
    const sp = t - d.splashAt
    ;(d.ring.material as THREE.MeshBasicMaterial).opacity = sp < 1.2 ? 0.55 * (1 - sp / 1.2) : 0
    d.ring.position.set(d.sx, 0.04, d.sz); d.ring.scale.setScalar(0.06 + sp * 0.35)
    d.drops.forEach((p, k) => { const a = (k / 8) * Math.PI * 2, r = sp * 0.35, h = sp * 1.1 - sp * sp * 2.6; (p.material as THREE.MeshBasicMaterial).opacity = sp < 0.45 && h > 0 ? 0.9 : 0; p.position.set(d.sx + Math.cos(a) * r, 0.03 + Math.max(0, h), d.sz + Math.sin(a) * r) })

    if (d.mode === 'swim') {
      const dx = d.tx - d.x, dz = d.tz - d.z, dist = Math.hypot(dx, dz)
      if (dist < 0.15) newTarget(d)
      const want = Math.atan2(-dz, dx); let turn = want - d.heading; while (turn > Math.PI) turn -= Math.PI * 2; while (turn < -Math.PI) turn += Math.PI * 2
      d.heading += turn * Math.min(1, dt * 1.5)
      const v = 0.12 * (1 - Math.min(0.8, Math.abs(turn)))
      d.x += Math.cos(d.heading) * v * dt; d.z -= Math.sin(d.heading) * v * dt
      rig.body.rotation.z += (Math.sin(t * 2 + i) * 0.03 - rig.body.rotation.z) * Math.min(1, dt * 4)
      rig.group.position.y = 0.02 + Math.sin(t * 2.2 + i) * 0.008
      rig.head.rotation.z = Math.sin(t * 0.7 + i * 2) * 0.12                          // พยักหน้า/มองรอบ
      rig.head.rotation.y = Math.sin(t * 0.45 + i) * 0.35
      rig.feet.forEach((f, k) => { f.rotation.z = Math.sin(t * 6 + k * Math.PI) * 0.6 })
      if (t > d.next) { d.mode = d.R() < 0.5 ? 'dive' : 'dabble'; d.since = t; if (d.mode === 'dabble') splash(d, t) }
    } else if (d.mode === 'dabble') {
      // มุดหัวหากิน ~3 วิ: ก้นกระดกชี้ฟ้า ตีนตีน้ำ
      const k = el < 0.4 ? el / 0.4 : el > 2.8 ? Math.max(0, 1 - (el - 2.8) / 0.4) : 1
      rig.body.rotation.z = -1.75 * k + Math.sin(t * 9) * 0.05 * k
      rig.group.position.y = 0.02 - 0.06 * k
      rig.feet.forEach((f, j) => { f.rotation.z = Math.sin(t * 14 + j * Math.PI) * 0.9 })
      if (el > 3.2) { d.mode = 'swim'; d.next = t + 7 + d.R() * 8; splash(d, t) }
    } else {
      // ดำน้ำ: พุ่งหัวลง → หายใต้น้ำ (ว่ายไปอีกจุด) → โผล่พรวดขึ้นมา
      if (el < 0.45) {
        const k = el / 0.45
        rig.body.rotation.z = -1.4 * k; rig.group.position.y = 0.02 - k * 0.32; rig.group.visible = true
        if (el < dt * 1.5) splash(d, t)
      } else if (el < 2.6) {
        rig.group.visible = false
        if (el - dt < 0.45) newTarget(d)
        const dx = d.tx - d.x, dz = d.tz - d.z, dist = Math.hypot(dx, dz)
        if (dist > 0.02) { d.x += (dx / dist) * Math.min(dist, 0.5 * dt); d.z += (dz / dist) * Math.min(dist, 0.5 * dt); d.heading = Math.atan2(-dz, dx) }
      } else if (el < 3.4) {
        if (!rig.group.visible) { rig.group.visible = true; splash(d, t) }
        const k = (el - 2.6) / 0.8
        rig.body.rotation.z = 0.5 * (1 - k)                                            // โผล่หัวขึ้นก่อน
        rig.group.position.y = -0.2 + Math.min(1, k * 1.6) * 0.25 - Math.max(0, k * 1.6 - 1) * 0.05
        rig.head.rotation.y = Math.sin(t * 12) * 0.25 * (1 - k)                       // สะบัดน้ำ
      } else { d.mode = 'swim'; d.next = t + 8 + d.R() * 9; rig.group.position.y = 0.02 }
    }
    rig.group.position.x = d.x; rig.group.position.z = d.z; rig.group.rotation.y = d.heading
  }))

  let last = 0
  return { group: g, tick: t => { const dt = Math.min(0.1, Math.max(0, t - last)); last = t; ticks.forEach(f => f(t, dt)) } }
}
