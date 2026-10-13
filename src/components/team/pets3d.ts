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
  legs: { hip: THREE.Group; knee: THREE.Group; front: boolean }[]; ears: THREE.Object3D[]; lids: THREE.Mesh[]; kind: PetKind
  /** ความสูงช่วงขา — นอนแล้วตัวลดลงเท่านี้ (ท้องแนบพื้น) */
  legLen: number
}

const texCache = new Map<string, THREE.Texture>()
/** ลายขน: เส้นขนสั้นเอียงตามแนวลำตัว · ท้อง (ขอบล่างของ uv) สีอ่อน · ลายเสือสำหรับแมว */
function furTex(kind: PetKind, limb = false): THREE.Texture {
  const key = `${kind}${limb ? ':limb' : ''}`
  const hit = texCache.get(key); if (hit) return hit
  const c = document.createElement('canvas'); c.width = 256; c.height = 128
  const x = c.getContext('2d')!
  const base = kind === 'dog' ? ['#c98a4b', '#a86a33', '#e0a868'] : kind === 'cat' ? ['#e9963f', '#c56f22', '#f6b866'] : ['#f2efea', '#d9d3ca', '#ffffff']
  const belly = kind === 'dog' ? '#f6e3c8' : kind === 'cat' ? '#fbe6c9' : '#ffffff'
  const g = x.createLinearGradient(0, 0, 0, 128)
  // ขา/หาง/คอ = สีเดียวทั้งท่อน (ไม่มีแถบท้อง) · ลำตัว = หลังเข้ม → ท้องอ่อน
  if (limb) { g.addColorStop(0, base[0]); g.addColorStop(1, base[0]) }
  else { g.addColorStop(0, base[0]); g.addColorStop(0.62, base[0]); g.addColorStop(0.82, belly); g.addColorStop(1, belly) }
  x.fillStyle = g; x.fillRect(0, 0, 256, 128)
  let s = kind.length * 97; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  if (kind === 'cat' && !limb) { x.fillStyle = 'rgba(150,72,20,.55)'; for (let i = 0; i < 9; i++) { const px = 14 + i * 27 + R() * 6; x.beginPath(); x.moveTo(px, 0); x.quadraticCurveTo(px + 8, 40, px - 2, 78); x.lineTo(px + 6, 78); x.quadraticCurveTo(px + 15, 40, px + 9, 0); x.fill() } }
  if (kind === 'dog' && !limb) { x.fillStyle = 'rgba(110,64,26,.35)'; x.beginPath(); x.ellipse(140, 18, 70, 22, 0, 0, Math.PI * 2); x.fill() }   // อานหลังเข้ม
  for (let i = 0; i < 2600; i++) {
    const px = R() * 256, py = R() * 128, l = 2 + R() * 4
    x.strokeStyle = py > 95 && !limb ? 'rgba(255,255,255,.25)' : R() < 0.5 ? `${base[1]}66` : `${base[2]}77`
    x.lineWidth = 0.7; x.beginPath(); x.moveTo(px, py); x.lineTo(px - l, py + l * 0.35); x.stroke()
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  texCache.set(key, t); return t
}

/** ท่อนแคปซูล (ปลายมน) ยาว len จากจุดหมุนลงไปทาง -y — ต่อกันแล้วไม่เห็นรอยตัด */
const limb = (r: number, len: number, m: THREE.Material) => { const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 12), m); c.position.y = -len / 2; return c }
/**
 * ขนนุ่มแบบ shell: ซ้อนผิวโปร่งหลายชั้นดันออกตามแนว normal · แต่ละชั้นเหลือเฉพาะ "เส้นขน" (สุ่มต่อจุด)
 * ชั้นยิ่งนอกยิ่งเหลือน้อย → ปลายขนเรียว · โคนขนมืดกว่า (เงาในขน) · ปลายตกลงนิด ๆ ตามแรงโน้มถ่วง
 */
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
  const furLimb = mat({ map: furTex(kind, true) })
  const tone = kind === 'dog' ? '#c98a4b' : kind === 'cat' ? '#e9963f' : '#f2efea'
  const furPlain = mat({ color: tone })
  const pale = mat({ color: kind === 'dog' ? '#f6e3c8' : kind === 'cat' ? '#fbe6c9' : '#ffffff' })
  const pink = mat({ color: '#f4a3b8', roughness: 0.6 })
  const dark = mat({ color: kind === 'dog' ? '#7a4a22' : kind === 'cat' ? '#b9631d' : '#d8d1c6' })

  // สัดส่วน (หน่วยของฉาก · 1 ช่อง = 1)
  const P = kind === 'dog'
    ? { len: 0.5, h: 0.2, w: 0.2, leg: 0.2, headR: 0.085, neck: [0.2, 0.3] }
    : kind === 'cat'
      ? { len: 0.42, h: 0.16, w: 0.15, leg: 0.12, headR: 0.072, neck: [0.18, 0.22] }
      : { len: 0.3, h: 0.2, w: 0.19, leg: 0.06, headR: 0.07, neck: [0.12, 0.2] }
  const hip = P.leg

  // ── ลำตัว ──
  const prof = kind === 'rabbit'
    ? (s: number) => Math.pow(Math.max(0, 1 - s * s), 0.5) * (1 + (s < 0 ? -s * 0.15 : -s * 0.12))
    : kind === 'cat'
      ? (s: number) => Math.pow(Math.max(0, 1 - s * s), s > 0 ? 0.3 : 0.55) * (0.92 + 0.08 * Math.cos(s * 3))   // หน้าอกมนทู่ ไม่แหลม
      : (s: number) => Math.pow(Math.max(0, 1 - s * s), 0.5) * (s > 0 ? 1.05 : 0.9 + 0.1 * (1 + s))
  const torso = shapedBody(P.len, P.h, P.w, prof, fur); torso.userData.fur = 1
  torso.position.y = hip + P.h * 0.45
  if (kind === 'rabbit') torso.rotation.z = 0.25        // กระต่ายหลังโค้ง ก้นต่ำ
  body.add(torso)
  if (kind === 'cat') { const chest = new THREE.Mesh(new THREE.SphereGeometry(P.h * 0.5, 18, 14), fur); chest.userData.fur = 1.2; chest.scale.set(0.9, 1, 1.05); chest.position.set(P.len * 0.3, hip + P.h * 0.42, 0); body.add(chest) }
  if (kind === 'dog') { const chest = new THREE.Mesh(new THREE.SphereGeometry(P.h * 0.48, 16, 12), pale); chest.userData.fur = 1.3; chest.scale.set(0.8, 1, 0.9); chest.position.set(P.len * 0.33, hip + P.h * 0.35, 0); body.add(chest) }

  // ── ขา: สะโพก(หมุน) → ต้นขา → เข่า(หมุน) → หน้าแข้ง → อุ้งเท้า ──
  const legs: PetRig['legs'] = []
  const legR = kind === 'dog' ? 0.028 : kind === 'cat' ? 0.023 : 0.026
  for (const front of [true, false]) for (const side of [-1, 1]) {
    const hx = (front ? 1 : -1) * P.len * (kind === 'rabbit' ? 0.28 : 0.34)
    const hipG = new THREE.Group(); hipG.position.set(hx, hip + 0.02, side * P.w * 0.32); body.add(hipG)
    if (!front && kind !== 'dog') { const haunch = new THREE.Mesh(new THREE.SphereGeometry(P.h * (kind === 'rabbit' ? 0.4 : 0.32), 14, 10), fur); haunch.scale.set(1.2, 1, 0.6); haunch.userData.fur = 1; haunch.position.set(0, 0.03, side * 0.012); hipG.add(haunch) }
    const up = hip * (kind === 'rabbit' ? 0.7 : 0.52)
    // ต้นขาเริ่มในลำตัว (ปลายมนจมในตัว) → ไม่เห็นรอยต่อกับลำตัว
    { const th = limb(legR * 1.35, up, furLimb); th.userData.fur = 0.7; hipG.add(th) }
    const knee = new THREE.Group(); knee.position.y = -up; hipG.add(knee)
    const lo = hip * 0.5 + 0.02
    { const sn = limb(legR * 1.05, lo, furLimb); sn.userData.fur = 0.45; knee.add(sn) }
    const paw = new THREE.Mesh(new THREE.SphereGeometry(legR * 1.35, 10, 8), kind === 'dog' && front ? pale : furPlain)
    paw.scale.set(kind === 'rabbit' && !front ? 2.6 : 1.5, 0.6, 1.1); paw.position.set(legR * (kind === 'rabbit' && !front ? 1.6 : 0.6), -lo + 0.006, 0); knee.add(paw)
    if (kind === 'rabbit' && !front) knee.rotation.z = -0.9
    legs.push({ hip: hipG, knee, front })
  }

  // ── หัว ──
  const head = new THREE.Group(); head.position.set(P.neck[0] * (kind === 'rabbit' ? 0.8 : 1), hip + P.neck[1] - (kind === 'rabbit' ? 0.02 : 0), 0); body.add(head)
  // คอ: แคปซูลอวบจากอกขึ้นไปฝังในหัว — ไม่มีขอบตัด
  if (kind !== 'rabbit') { const neck = new THREE.Mesh(new THREE.CapsuleGeometry(P.headR * 0.78, kind === 'cat' ? 0.06 : 0.1, 6, 14), furLimb); neck.userData.fur = 1.1; neck.position.set(-P.headR * 0.75, -P.headR * 0.95, 0); neck.rotation.z = -0.75; head.add(neck) }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(P.headR, 20, 16), fur)
  skull.userData.fur = 0.6; skull.scale.set(kind === 'cat' ? 1 : 1.05, kind === 'cat' ? 0.92 : 0.95, kind === 'cat' ? 1.1 : 0.95); head.add(skull)
  const ears: THREE.Object3D[] = []
  const lids: THREE.Mesh[] = []
  // ตา: ลูกตา + ประกาย + เปลือกตา (กะพริบ)
  const eyeM = mat({ color: kind === 'cat' ? '#3f8f2e' : '#1a120b', roughness: 0.08, metalness: 0.1 })
  for (const z of [-1, 1]) {
    const ex = P.headR * (kind === 'rabbit' ? 0.55 : 0.75), ey = P.headR * 0.2, ez = z * P.headR * (kind === 'rabbit' ? 0.7 : 0.5)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.2, 12, 10), eyeM); eye.position.set(ex, ey, ez); head.add(eye)
    if (kind === 'cat') { const pupil = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.08, 8, 6), mat({ color: '#050505' })); pupil.scale.set(0.5, 1.6, 0.5); pupil.position.set(ex + P.headR * 0.14, ey, ez * 1.05); head.add(pupil) }
    const glint = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.055, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' })); glint.position.set(ex + P.headR * 0.16, ey + P.headR * 0.08, ez * 1.02); head.add(glint)
    const lid = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), fur); lid.position.copy(eye.position); lid.scale.y = 0.05; head.add(lid); lids.push(lid)
  }
  if (kind === 'dog') {
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.62, 14, 10), pale); muzzle.scale.set(1.5, 0.85, 1); muzzle.position.set(P.headR * 0.95, -P.headR * 0.32, 0); head.add(muzzle)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.22, 10, 8), mat({ color: '#111', roughness: 0.25 })); nose.scale.set(0.9, 0.75, 1.2); nose.position.set(P.headR * 1.75, -P.headR * 0.18, 0); head.add(nose)
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.18, 8, 6), pink); tongue.scale.set(1, 0.4, 0.8); tongue.position.set(P.headR * 1.35, -P.headR * 0.68, 0); head.add(tongue)
    for (const z of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(-P.headR * 0.1, P.headR * 0.55, z * P.headR * 0.78); head.add(ear)
      const flap = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.5, 12, 10), dark); flap.scale.set(0.75, 1.5, 0.28); flap.position.y = -P.headR * 0.55; flap.rotation.x = z * 0.15; ear.add(flap)
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
        const outer = new THREE.Mesh(new THREE.ConeGeometry(P.headR * 0.42, P.headR * 0.85, 4), fur); outer.position.y = P.headR * 0.32; outer.rotation.y = Math.PI / 4; outer.scale.z = 0.45; ear.add(outer)
        const inner = new THREE.Mesh(new THREE.ConeGeometry(P.headR * 0.27, P.headR * 0.6, 4), pink); inner.position.set(P.headR * 0.07, P.headR * 0.28, 0); inner.rotation.y = Math.PI / 4; inner.scale.z = 0.3; ear.add(inner)
        ears.push(ear)
      }
    } else {
      for (const z of [-1, 1]) {
        const ear = new THREE.Group(); ear.position.set(-P.headR * 0.2, P.headR * 0.75, z * P.headR * 0.38); ear.rotation.set(z * 0.22, 0, -0.25); head.add(ear)
        const outer = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.32, 12, 10), fur); outer.scale.set(0.75, 3.3, 0.38); outer.position.y = P.headR * 1.0; ear.add(outer)
        const inner = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.22, 10, 8), pink); inner.scale.set(0.6, 3.0, 0.2); inner.position.set(P.headR * 0.07, P.headR * 1.0, 0); ear.add(inner)
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
    l.hip.visible = !sleep                                   // นอนขด = ขาซุกใต้ตัว
    if (sit) {
      // นั่ง: ตัวเชิดขึ้น 0.5 rad → ขาหน้าตั้งตรงกับพื้น · ขาหลังพับราบไปข้างหน้า
      if (l.front) { l.hip.rotation.z = -0.5; l.knee.rotation.z = 0 }
      else { l.hip.rotation.z = rabbit ? -0.5 : 0.9; l.knee.rotation.z = rabbit ? -0.9 : -1.9 }
    } else {
      l.hip.rotation.z = sw * (rabbit ? 0.7 : 0.55)
      l.knee.rotation.z = (rabbit && !l.front ? -0.9 : 0) + (walk ? Math.max(0, -Math.sin(t * f + ph)) * (l.front ? -0.5 : 0.6) : 0)
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
