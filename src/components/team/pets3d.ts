import * as THREE from 'three'
import type { PetKind } from '../../utils/officeDecor'
import type { PetMode } from '../../utils/officePets'

// ── สัตว์เลี้ยง 3D (สมจริงขึ้น): หัน +x = หน้า ──
//  • ลำตัวดัดทรง (อกใหญ่ เอวคอด สะโพกมน) + ลายขนวาดเอง (ขนสั้นเป็นเส้น ไล่สี ท้องอ่อน)
//  • ขาสองท่อน (ต้นขา/หน้าแข้ง) + อุ้งเท้า · ขาหลังมีสะโพก (กระต่าย/แมวชัด)
//  • หัว: ปาก จมูก ตามีประกาย หนวด (แมว/กระต่าย) · หู: หมาหูตก แมวหูตั้งในชมพู กระต่ายหูยาว
//  • หางหลายข้อ โค้งพลิ้วเป็นคลื่น · กะพริบตา หูกระดิก หายใจ

export interface PetRig {
  group: THREE.Group; body: THREE.Group; head: THREE.Group; tail: THREE.Group; tailSegs: THREE.Group[]
  legs: { hip: THREE.Group; knee: THREE.Group; hock?: THREE.Group; front: boolean }[]; ears: THREE.Object3D[]; lids: THREE.Mesh[]; kind: PetKind
  /** ความสูงช่วงขา — นอนแล้วตัวลดลงเท่านี้ (ท้องแนบพื้น) */
  legLen: number
}

const texCache = new Map<string, THREE.Texture>()
/**
 * ลายขนตามสายพันธุ์ (อ้างอิงลูกบีเกิล / ลูกแมวส้มท้องขาว)
 * พิกัดบนลำตัว (ทรงกลมหมุนแกนยาวไป +x): แกนนอน canvas = รอบตัว (ขอบซ้าย/ขวา = สันหลัง · กลาง = ท้อง) · แกนตั้ง = หัว(บน) → หาง(ล่าง)
 * พิกัดบนหัว: แกนนอน = รอบหัว (กลาง = หน้า · ขอบ = ท้ายทอย) · แกนตั้ง = กระหม่อม(บน) → คาง(ล่าง)
 */
type Part = 'body' | 'limb' | 'head'
function furTex(kind: PetKind, part: Part = 'body'): THREE.Texture {
  const key = `${kind}:${part}`
  const hit = texCache.get(key); if (hit) return hit
  const c = document.createElement('canvas'); c.width = 256; c.height = 128
  const x = c.getContext('2d')!
  let s = kind.length * 97 + part.length; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const WHITE = '#f7f4ef', TAN = '#b8732f', BLACK = '#2a2421', ORANGE = '#ec9a45'
  const blob = (col: string, cx: number, cy: number, rx: number, ry: number, blur = 6) => { x.save(); x.filter = `blur(${blur}px)`; x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); x.restore() }
  let strokes: [string, string] = ['rgba(0,0,0,.08)', 'rgba(255,255,255,.12)']
  if (kind === 'dog') {
    if (part === 'body') {
      x.fillStyle = WHITE; x.fillRect(0, 0, 256, 128)
      // อานดำกลางหลัง ขอบน้ำตาลแดง · ไหล่/สะโพกน้ำตาล
      for (const cx of [0, 256]) { blob(TAN, cx, 64, 92, 56, 8); blob(BLACK, cx, 66, 74, 44, 7) }
      for (const cx of [0, 256]) { blob(TAN, cx, 8, 70, 18, 7) }
      strokes = ['rgba(0,0,0,.12)', 'rgba(255,255,255,.15)']
    } else if (part === 'head') {
      x.fillStyle = TAN; x.fillRect(0, 0, 256, 128)
      blob('#8f5320', 0, 30, 60, 40, 10); blob('#8f5320', 256, 30, 60, 40, 10)    // ท้ายทอยเข้ม
      // แถบขาวกลางหน้า กว้างขึ้นตอนลงไปถึงปาก
      x.save(); x.filter = 'blur(3px)'; x.fillStyle = WHITE; x.beginPath(); x.moveTo(122, 4); x.lineTo(134, 4); x.lineTo(150, 128); x.lineTo(106, 128); x.closePath(); x.fill(); x.restore()
      blob(WHITE, 128, 120, 46, 20, 5)
    } else { x.fillStyle = WHITE; x.fillRect(0, 0, 256, 128) }
  } else if (kind === 'cat') {
    if (part === 'body') {
      x.fillStyle = ORANGE; x.fillRect(0, 0, 256, 128)
      blob(WHITE, 128, 60, 54, 80, 10)                 // ท้อง+อกขาว
      x.fillStyle = 'rgba(176,90,25,.6)'
      for (let i = 0; i < 7; i++) { const y = 18 + i * 15; for (const [x0, x1] of [[0, 74], [182, 256]]) { x.beginPath(); x.ellipse((x0 + x1) / 2, y, (x1 - x0) / 2, 3.2, 0, 0, Math.PI * 2); x.fill() } }
    } else if (part === 'head') {
      x.fillStyle = ORANGE; x.fillRect(0, 0, 256, 128)
      blob(WHITE, 128, 104, 52, 34, 7)                 // แก้ม ปาก คางขาว
      x.fillStyle = 'rgba(176,90,25,.65)'                // ลาย "M" หน้าผาก
      for (const dx of [-12, 0, 12]) { x.beginPath(); x.ellipse(128 + dx, 22, 2.6, 13, 0, 0, Math.PI * 2); x.fill() }
    } else {
      x.fillStyle = ORANGE; x.fillRect(0, 0, 256, 128)
      x.fillStyle = 'rgba(176,90,25,.5)'; for (let i = 0; i < 8; i++) x.fillRect(0, 8 + i * 15, 256, 4)
    }
    strokes = ['rgba(150,70,20,.18)', 'rgba(255,240,220,.25)']
  } else {
    x.fillStyle = '#f2efea'; x.fillRect(0, 0, 256, 128)
    strokes = ['rgba(170,160,150,.2)', 'rgba(255,255,255,.4)']
  }
  // เส้นขนสั้น ๆ ทั่วทั้งผืน
  for (let i = 0; i < 2600; i++) {
    const px = R() * 256, py = R() * 128, l = 2 + R() * 4
    x.strokeStyle = R() < 0.5 ? strokes[0] : strokes[1]
    x.lineWidth = 0.7; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l * 0.3, py + l); x.stroke()
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  texCache.set(key, t); return t
}

const furShellMats = new Map<string, THREE.MeshStandardMaterial>()
function shellMat(base: THREE.MeshStandardMaterial, layer: number, len: number, density: number): THREE.MeshStandardMaterial {
  const key = `${base.uuid}|${layer}|${len}|${density}`
  const hit = furShellMats.get(key); if (hit) return hit
  const m = base.clone()
  m.onBeforeCompile = sh => {
    sh.uniforms.uL = { value: layer }; sh.uniforms.uLen = { value: len }; sh.uniforms.uDen = { value: density }
    sh.vertexShader = 'uniform float uL; uniform float uLen;\nvarying vec2 vFurUv;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFurUv = uv;
        transformed += normal * uL * uLen;
        transformed.y -= uL * uL * uLen * 0.35;`)
    sh.fragmentShader = 'uniform float uL; uniform float uDen;\nvarying vec2 vFurUv;\n' + sh.fragmentShader
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        vec2 cell = floor(vFurUv * vec2(uDen * 2.0, uDen));
        float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        vec2 f = fract(vFurUv * vec2(uDen * 2.0, uDen)) - 0.5;
        if (h < uL * 0.95 + 0.05 || length(f) > 0.5 - uL * 0.35) discard;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(0.72, 1.06, uL);`)
  }
  m.customProgramCacheKey = () => key
  furShellMats.set(key, m)
  return m
}
/** ใส่ขนให้ mesh ที่ติดป้าย userData.fur (ความยาวขนเป็นสัดส่วน) */
function growFur(root: THREE.Object3D, layers: number, len: number, density: number) {
  const targets: THREE.Mesh[] = []
  root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.fur) targets.push(m) })
  for (const m of targets) {
    const base = m.material as THREE.MeshStandardMaterial
    const k = (m.userData.fur as number) || 1
    for (let i = 1; i <= layers; i++) {
      const sh = new THREE.Mesh(m.geometry, shellMat(base, i / layers, len * k, density))
      sh.castShadow = false; sh.receiveShadow = false
      m.add(sh)
    }
  }
}
/** ท่อนแคปซูล (ปลายมน) ยาว len จากจุดหมุนลงไปทาง -y — ต่อกันแล้วไม่เห็นรอยตัด */
const limb = (r: number, len: number, m: THREE.Material) => { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 12), m); c.position.y = -len / 2; return c }
const mat = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o })

/** ทรงรีที่ดัดตามแกน x: prof(s) = รัศมีที่ตำแหน่ง s ∈ [-1,1] */
function shapedBody(len: number, h: number, w: number, prof: (s: number) => number, m: THREE.Material) {
  const geo = new THREE.SphereGeometry(1, 40, 28); geo.rotateZ(-Math.PI / 2)
  const p = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const sx = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(y, z) || 1e-6, k = prof(sx) / Math.max(r, 1e-6) * Math.min(1, r)
    p.setXYZ(i, sx * len / 2, y * k * h / 2, z * k * w / 2)
  }
  geo.computeVertexNormals()
  const m2 = new THREE.Mesh(geo, m); m2.castShadow = true
  return m2
}

export function buildPet3D(kind: PetKind): PetRig {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body)
  const fur = mat({ map: furTex(kind) })
  const furLimb = mat({ map: furTex(kind, 'limb') })
  const furHead = mat({ map: furTex(kind, 'head') })
  const tone = kind === 'dog' ? '#c98a4b' : kind === 'cat' ? '#e9963f' : '#f2efea'
  const furPlain = mat({ color: tone })
  const pale = mat({ color: kind === 'rabbit' ? '#ffffff' : '#f7f4ef' })
  const pink = mat({ color: '#f4a3b8', roughness: 0.6 })
  const dark = mat({ color: kind === 'dog' ? '#a0612b' : kind === 'cat' ? '#c9712a' : '#d8d1c6' })

  // สัดส่วน (หน่วยของฉาก · 1 ช่อง = 1)
  const P = kind === 'dog'
    ? { len: 0.44, h: 0.21, w: 0.2, leg: 0.15, headR: 0.108, neck: [0.2, 0.28] }   // ลูกบีเกิล: หัวโต ขาสั้น
    : kind === 'cat'
      ? { len: 0.36, h: 0.17, w: 0.16, leg: 0.1, headR: 0.1, neck: [0.17, 0.23] }    // ลูกแมว: หัวกลมโต ตัวป้อม
      : { len: 0.32, h: 0.22, w: 0.22, leg: 0.06, headR: 0.088, neck: [0.12, 0.19] }   // กระต่ายแคระ: ตัวกลมแบบไข่ หัวโตชิดตัว
  const hip = P.leg

  // ── ลำตัว ──
  const prof = kind === 'rabbit'
    ? (s: number) => Math.pow(Math.max(0, 1 - s * s), s < 0 ? 0.33 : 0.45) * (1 + (s < 0 ? -s * 0.12 : -s * 0.1))   // ก้นกลมใหญ่
    : kind === 'cat'
      ? (s: number) => Math.pow(Math.max(0, 1 - s * s), s > 0 ? 0.3 : 0.36) * (0.92 + 0.08 * Math.cos(s * 3))   // หน้าอกมนทู่ ไม่แหลม
      : (s: number) => Math.pow(Math.max(0, 1 - s * s), s > 0 ? 0.42 : 0.36) * (s > 0 ? 1.05 : 0.97)   // ก้นกลมเต็ม ไม่เรียวแหลม
  const torso = shapedBody(P.len, P.h, P.w, prof, fur); torso.userData.fur = 1
  torso.position.y = hip + P.h * 0.45
  if (kind === 'rabbit') torso.rotation.z = 0.15        // หลังโค้งนิด ก้นต่ำ
  body.add(torso)
  if (kind === 'cat') { const chest = new THREE.Mesh(new THREE.SphereGeometry(P.h * 0.5, 18, 14), fur); chest.userData.fur = 1.2; chest.scale.set(0.9, 1, 1.05); chest.position.set(P.len * 0.3, hip + P.h * 0.42, 0); body.add(chest) }
  if (kind === 'dog') { const chest = new THREE.Mesh(new THREE.SphereGeometry(P.h * 0.48, 16, 12), pale); chest.userData.fur = 1.3; chest.scale.set(0.8, 1, 0.9); chest.position.set(P.len * 0.33, hip + P.h * 0.35, 0); body.add(chest) }

  // ── ขา: สะโพก(หมุน) → ต้นขา → เข่า(หมุน) → หน้าแข้ง → อุ้งเท้า ──
  const legs: PetRig['legs'] = []
  const legR = kind === 'dog' ? 0.028 : kind === 'cat' ? 0.023 : 0.026
  for (const front of [true, false]) for (const side of [-1, 1]) {
    const hx = (front ? 1 : -1) * P.len * (kind === 'rabbit' ? 0.28 : 0.3)
    const hipG = new THREE.Group(); hipG.position.set(hx, hip + 0.02, side * P.w * 0.32); body.add(hipG)
    const pawM = kind === 'cat' || kind === 'dog' ? pale : furPlain
    if (front && kind === 'rabbit') {
      // ขาหน้ากระต่าย: เรียวเล็ก ลงตรงใต้อก ชิดกัน · ปลายแขนเฉียงไปหน้านิด · อุ้งเท้ากลมเล็ก
      hipG.position.set(P.len * 0.3, hip + 0.06, side * P.w * 0.2)
      const up = 0.055, lo = 0.06
      { const a = limb(0.019, up, fur); a.userData.fur = 0.9; hipG.add(a) }   // ต้นแขนฝังในอก (ขนฟูกลืนกับตัว)
      const knee = new THREE.Group(); knee.position.y = -up; hipG.add(knee)
      { const f2 = limb(0.014, lo, furLimb); f2.userData.fur = 0.5; knee.add(f2) }
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 8), pawM); paw.scale.set(1.45, 0.6, 1); paw.position.set(0.01, -lo + 0.002, 0); knee.add(paw)
      hipG.rotation.z = -0.12; knee.rotation.z = 0.2
      legs.push({ hip: hipG, knee, front })
    } else if (front || kind === 'rabbit') {
      // ขาหน้า (และขาหลังกระต่าย): ต้นแขน → ข้อศอก → แขนล่าง → อุ้งเท้า
      if (!front) { const haunch = new THREE.Mesh(new THREE.SphereGeometry(P.h * 0.4, 16, 12), fur); haunch.scale.set(1.2, 1, 0.6); haunch.userData.fur = 1; haunch.position.set(0, 0.03, side * 0.012); hipG.add(haunch) }
      const up = hip * (kind === 'rabbit' ? 0.7 : 0.52)
      { const th = limb(legR * 1.35, up, furLimb); th.userData.fur = 0.7; hipG.add(th) }
      const knee = new THREE.Group(); knee.position.y = -up; hipG.add(knee)
      const lo = hip * 0.5 + 0.02
      { const sn = limb(legR * 1.05, lo, furLimb); sn.userData.fur = 0.45; knee.add(sn) }
      const paw = new THREE.Mesh(new THREE.SphereGeometry(legR * 1.35, 12, 8), pawM)
      paw.scale.set(kind === 'rabbit' && !front ? 2.6 : 1.5, 0.6, 1.1); paw.position.set(legR * (kind === 'rabbit' && !front ? 1.6 : 0.6), -lo + 0.006, 0); knee.add(paw)
      if (kind === 'rabbit' && !front) knee.rotation.z = -0.9
      legs.push({ hip: hipG, knee, front })
    } else {
      // ขาหลังหมา/แมว (ทรงซิกแซกแบบจริง): สะโพก/ต้นขาหนาเฉียงไปหน้า → เข่าหักไปหลัง → ข้อเท้า (hock) → ฝ่าเท้าตั้งตรง → อุ้งเท้า
      const thighL = hip * 0.46, shankL = hip * 0.44, metaL = hip * 0.34
      const haunch = new THREE.Mesh(new THREE.SphereGeometry(P.h * 0.33, 18, 14), fur)
      haunch.scale.set(0.72, 1.25, 0.55); haunch.position.set(0.004, -thighL * 0.32, side * 0.006); haunch.userData.fur = 1; hipG.add(haunch)   // กล้ามต้นขา กลืนกับก้น
      { const th = limb(legR * 1.9, thighL, furLimb); th.userData.fur = 0.8; hipG.add(th) }
      const knee = new THREE.Group(); knee.position.y = -thighL; hipG.add(knee)
      { const sk = limb(legR * 1.2, shankL, furLimb); sk.userData.fur = 0.55; knee.add(sk) }
      const hock = new THREE.Group(); hock.position.y = -shankL; knee.add(hock)
      { const mt = limb(legR * 0.95, metaL, furLimb); mt.userData.fur = 0.4; hock.add(mt) }
      const paw = new THREE.Mesh(new THREE.SphereGeometry(legR * 1.4, 12, 8), pawM)
      paw.scale.set(1.6, 0.6, 1.1); paw.position.set(legR * 0.7, -metaL + 0.004, 0); hock.add(paw)
      legs.push({ hip: hipG, knee, hock, front })
    }
  }

  // ── หัว ──
  const head = new THREE.Group(); head.position.set(P.neck[0] * (kind === 'rabbit' ? 0.8 : 1), hip + P.neck[1] - (kind === 'rabbit' ? 0.02 : 0), 0); body.add(head)
  // คอ: แคปซูลอวบจากอกขึ้นไปฝังในหัว — ไม่มีขอบตัด
  if (kind !== 'rabbit') { const neck = new THREE.Mesh(new THREE.CapsuleGeometry(P.headR * 0.78, kind === 'cat' ? 0.06 : 0.1, 6, 14), furLimb); neck.userData.fur = 1.1; neck.position.set(-P.headR * 0.75, -P.headR * 0.95, 0); neck.rotation.z = -0.75; head.add(neck) }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(P.headR, 24, 18), furHead)
  skull.userData.fur = 0.6; skull.scale.set(kind === 'cat' ? 1 : 1.05, kind === 'cat' ? 0.92 : 0.95, kind === 'cat' ? 1.1 : 0.95); head.add(skull)
  const ears: THREE.Object3D[] = []
  const lids: THREE.Mesh[] = []
  // ตา: ลูกตา + ประกาย + เปลือกตา (กะพริบ)
  const eyeM = mat({ color: kind === 'cat' ? '#5fae3a' : kind === 'dog' ? '#2a1608' : '#1a120b', roughness: 0.05, metalness: 0.1 })
  const eyeR = kind === 'cat' ? 0.3 : kind === 'dog' ? 0.25 : 0.22   // ตาโตแบบลูกสัตว์
  for (const z of [-1, 1]) {
    const ex = P.headR * (kind === 'rabbit' ? 0.55 : 0.75), ey = P.headR * 0.2, ez = z * P.headR * (kind === 'rabbit' ? 0.7 : 0.5)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(P.headR * eyeR, 16, 12), eyeM); eye.position.set(ex, ey, ez); head.add(eye)
    if (kind === 'cat') { const pupil = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.17, 10, 8), mat({ color: '#050505', roughness: 0.05 })); pupil.scale.set(0.3, 1.15, 0.85); pupil.position.set(ex + P.headR * eyeR * 0.93, ey, ez); head.add(pupil) }
    const glint = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.055, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); glint.position.set(ex + P.headR * eyeR * 0.85, ey + P.headR * eyeR * 0.4, ez * 1.02 - Math.sign(ez) * P.headR * 0.04); head.add(glint)
    const lid = new THREE.Mesh(new THREE.SphereGeometry(P.headR * (eyeR + 0.015), 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), furHead); lid.position.copy(eye.position); lid.scale.y = 0.05; head.add(lid); lids.push(lid)
  }
  if (kind === 'dog') {
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.62, 14, 10), pale); muzzle.scale.set(1.5, 0.85, 1); muzzle.position.set(P.headR * 0.95, -P.headR * 0.32, 0); head.add(muzzle)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.22, 10, 8), mat({ color: '#111', roughness: 0.25 })); nose.scale.set(0.9, 0.75, 1.2); nose.position.set(P.headR * 1.75, -P.headR * 0.18, 0); head.add(nose)
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.18, 8, 6), pink); tongue.scale.set(1, 0.4, 0.8); tongue.position.set(P.headR * 1.35, -P.headR * 0.68, 0); head.add(tongue)
    for (const z of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(-P.headR * 0.1, P.headR * 0.55, z * P.headR * 0.78); head.add(ear)
      const flap = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.5, 12, 10), dark); flap.scale.set(0.85, 2.2, 0.26); flap.position.y = -P.headR * 0.85; flap.userData.fur = 0.8; flap.rotation.x = z * 0.15; ear.add(flap)
      ears.push(ear)
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(P.headR * 0.85, 0.012, 8, 20), mat({ color: '#c81e1e', roughness: 0.45 })); collar.position.set(-P.headR * 0.55, -P.headR * 0.85, 0); collar.rotation.set(0, Math.PI / 2, 0.75); head.add(collar)
    const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 12), mat({ color: '#facc15', metalness: 0.8, roughness: 0.3 })); tag.rotation.z = Math.PI / 2; tag.position.set(-P.headR * 0.05, -P.headR * 1.35, 0); head.add(tag)
  } else {
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.42, 12, 10), pale); muzzle.scale.set(0.9, 0.7, 1.35); muzzle.position.set(P.headR * 0.78, -P.headR * 0.3, 0); head.add(muzzle)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.11, 8, 6), pink); nose.scale.set(0.8, 0.7, 1.2); nose.position.set(P.headR * 1.12, -P.headR * 0.12, 0); head.add(nose)
    // หนวด
    const wM = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 })
    for (const z of [-1, 1]) for (let k = 0; k < 3; k++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(P.headR * 1.0, -P.headR * 0.3, z * P.headR * 0.3), new THREE.Vector3(P.headR * 1.25, -P.headR * (0.15 + k * 0.17), z * P.headR * 1.55)])
      head.add(new THREE.Line(geo, wM))
    }
    if (kind === 'cat') {
      for (const z of [-1, 1]) {
        const ear = new THREE.Group(); ear.position.set(-P.headR * 0.05, P.headR * 0.72, z * P.headR * 0.55); ear.rotation.x = z * 0.28; head.add(ear)
        const outer = new THREE.Mesh(new THREE.ConeGeometry(P.headR * 0.42, P.headR * 0.8, 4), furHead); outer.position.y = P.headR * 0.32; outer.rotation.y = Math.PI / 4; outer.scale.z = 0.45; ear.add(outer)
        const inner = new THREE.Mesh(new THREE.ConeGeometry(P.headR * 0.27, P.headR * 0.6, 4), pink); inner.position.set(P.headR * 0.07, P.headR * 0.28, 0); inner.rotation.y = Math.PI / 4; inner.scale.z = 0.3; ear.add(inner)
        ears.push(ear)
      }
    } else {
      for (const z of [-1, 1]) {
        const ear = new THREE.Group(); ear.position.set(-P.headR * 0.15, P.headR * 0.78, z * P.headR * 0.32); ear.rotation.set(z * 0.3, 0, -0.12); head.add(ear)
        const outer = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.32, 12, 10), fur); outer.scale.set(0.42, 2.3, 0.95); outer.position.y = P.headR * 0.68;   // แผ่นหูหันหน้าไปข้างหน้า ear.add(outer)
        const inner = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.22, 10, 8), pink); inner.scale.set(0.2, 2.1, 0.8); inner.position.set(P.headR * 0.075, P.headR * 0.7, 0); ear.add(inner)
        ears.push(ear)
      }
    }
  }

  // ── หาง (หลายข้อ) ──
  const tail = new THREE.Group(); tail.position.set(-P.len * 0.47, hip + P.h * (kind === 'rabbit' ? 0.35 : 0.6), 0); body.add(tail)
  const tailSegs: THREE.Group[] = []
  if (kind === 'rabbit') {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 3), mat({ color: '#ffffff', roughness: 1 })); puff.userData.fur = 2; tail.add(puff)
  } else {
    const n = kind === 'cat' ? 6 : 4, segL = kind === 'cat' ? 0.05 : 0.045
    let parent: THREE.Object3D = tail
    for (let i = 0; i < n; i++) {
      const sg = new THREE.Group(); if (i) sg.position.y = segL; parent.add(sg)
      const r0 = (kind === 'cat' ? 0.019 : 0.022) * (1 - i / (n + 1)), r1 = (kind === 'cat' ? 0.019 : 0.022) * (1 - (i + 1) / (n + 1))
      const m = new THREE.Mesh(new THREE.CapsuleGeometry((r0 + r1) / 2, segL, 4, 10), i === n - 1 && kind === 'dog' ? pale : furLimb); m.position.y = segL / 2; m.userData.fur = kind === 'dog' ? 1.6 : 1.1; sg.add(m)
      tailSegs.push(sg); parent = sg
    }
    tail.rotation.z = kind === 'cat' ? 0.35 : -0.35
  }

  g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true })
  // ขน: หมาขนยาวปานกลาง · แมวขนสั้นแน่น · กระต่ายขนฟูยาว
  if (kind === 'dog') growFur(g, 10, 0.011, 90)
  else if (kind === 'cat') growFur(g, 9, 0.008, 120)
  else growFur(g, 11, 0.014, 100)
  g.scale.setScalar(1.55)
  return { group: g, body, head, tail, tailSegs, legs, ears, lids, kind, legLen: hip * 0.92 }
}

/** ท่าทางทุกเฟรม */
export function animatePet(r: PetRig, mode: PetMode, t: number, seed: number) {
  const walk = mode === 'walk', sleep = mode === 'sleep', sit = mode === 'sit'
  const rabbit = r.kind === 'rabbit'
  const f = rabbit ? 8 : r.kind === 'dog' ? 13 : 11
  // ขา: เดินสลับทแยง (หมา/แมว) · กระต่ายกระโดดสองขาพร้อมกัน
  r.legs.forEach((l, i) => {
    const ph = rabbit ? (l.front ? 0 : Math.PI) : (i === 0 || i === 3 ? 0 : Math.PI)
    const sw = walk ? Math.sin(t * f + ph) : 0
    const lift = walk ? Math.max(0, -Math.sin(t * f + ph)) : 0      // ช่วงยกเท้า
    l.hip.visible = !sleep                                           // นอนขด = ขาซุกใต้ตัว
    if (l.hock) {
      // ขาหลังซิกแซก: ท่ายืน = ต้นขาเฉียงหน้า 0.5 · เข่าพับหลัง -1.05 · ข้อเท้าคืนตั้งตรง +0.55
      if (sit) { l.hip.rotation.z = 1.45; l.knee.rotation.z = -2.5; l.hock.rotation.z = 1.05 }   // นั่ง: พับขาหลังราบกับพื้น
      else { l.hip.rotation.z = 0.5 + sw * 0.45; l.knee.rotation.z = -1.05 - lift * 0.5; l.hock.rotation.z = 0.55 + lift * 0.45 }
      return
    }
    if (sit) {
      if (l.front) { l.hip.rotation.z = -0.5; l.knee.rotation.z = 0 }
      else { l.hip.rotation.z = -0.5; l.knee.rotation.z = -0.9 }
    } else {
      l.hip.rotation.z = (rabbit && l.front ? -0.12 : 0) + sw * (rabbit ? 0.7 : 0.55)
      l.knee.rotation.z = (rabbit ? (l.front ? 0.2 : -0.9) : 0) + lift * (l.front ? -0.5 : 0.6)
    }
  })


  const breath = Math.sin(t * (sleep ? 2.2 : 3.2) + seed) * 0.02
  r.body.position.y = sleep ? -r.legLen : sit ? -0.03 : walk ? Math.abs(Math.sin(t * f)) * (rabbit ? 0.06 : 0.015) : 0
  r.body.rotation.z = sit ? 0.5 : walk && rabbit ? Math.sin(t * f) * 0.15 : 0
  r.body.scale.set(1, 1 + breath, 1 + breath * 0.6)
  // หัว: มองรอบ ๆ · นอนเอาหัวพักลง
  r.head.rotation.z = sleep ? -0.55 : sit ? -0.5 : Math.sin(t * 0.7 + seed) * 0.1
  r.head.rotation.y = sleep ? 0.6 : Math.sin(t * 0.45 + seed) * 0.35
  // หู: กระดิกเป็นพัก ๆ
  const twitch = ((t + seed) % 5) < 0.25 ? Math.sin(t * 40) * 0.25 : 0
  r.ears.forEach((e, i) => { e.rotation.y = (i ? 1 : -1) * twitch + (sleep && rabbit ? (i ? -0.6 : 0.6) : 0) })
  // ตา: กะพริบ ~4 วิครั้ง · หลับ = ปิด
  const blink = sleep || ((t + seed * 0.37) % 4) < 0.12
  r.lids.forEach(l => { l.scale.y = blink ? 1 : 0.05 })
  // หาง: คลื่นไล่ตามข้อ (หมากระดิกเร็ว · แมวสะบัดช้าเป็นเส้นโค้ง)
  const wag = r.kind === 'dog' ? (sleep ? 0.6 : walk || sit ? 14 : 10) : 2.2
  const amp = r.kind === 'dog' ? (sleep ? 0.05 : 0.35) : sleep ? 0.05 : 0.22
  r.tailSegs.forEach((s, i) => { s.rotation.x = Math.sin(t * wag - i * 0.7 + seed) * amp; s.rotation.z = r.kind === 'cat' ? (sleep ? 0.45 : 0.18) : 0.08 })
  if (r.kind === 'cat') r.tail.rotation.z = sleep ? 1.6 : sit ? 1.3 : 0.35
}
