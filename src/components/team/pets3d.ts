import * as THREE from 'three'
import type { PetKind } from '../../utils/officeDecor'
import type { PetMode } from '../../utils/officePets'

// ── สัตว์เลี้ยง 3D: หมา แมว กระต่าย — หัน +x = หน้า · ท่าทางคุมด้วย animatePet ทุกเฟรม ──

export interface PetRig { group: THREE.Group; body: THREE.Group; head: THREE.Group; tail: THREE.Group; legs: THREE.Object3D[]; kind: PetKind }

const M = (color: string, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough })

export function buildPet3D(kind: PetKind): PetRig {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body)
  const col = kind === 'dog' ? { a: '#c98a4b', b: '#8a5a2b', c: '#f3dcc0' } : kind === 'cat' ? { a: '#f0a24a', b: '#b8661e', c: '#fde7c8' } : { a: '#f4f1ec', b: '#d6cfc4', c: '#ffc9d6' }
  const fur = M(col.a), dark = M(col.b), light = M(col.c)
  const s = kind === 'dog' ? 1 : kind === 'cat' ? 0.82 : 0.72
  const legH = kind === 'rabbit' ? 0.06 : kind === 'cat' ? 0.12 : 0.14
  // ลำตัว
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), fur)
  torso.scale.set(kind === 'rabbit' ? 1.15 : 1.6, kind === 'rabbit' ? 1.05 : 0.85, 0.85); torso.position.y = legH + 0.09; body.add(torso)
  if (kind !== 'rabbit') { const belly = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), light); belly.scale.set(1.5, 0.6, 0.8); belly.position.set(0, legH + 0.05, 0); body.add(belly) }
  // ขา
  const legs: THREE.Object3D[] = []
  const lx = kind === 'rabbit' ? [0.07, -0.07] : [0.11, -0.11]
  for (const x of lx) for (const z of [-0.055, 0.055]) {
    const pivot = new THREE.Group(); pivot.position.set(x, legH, z); body.add(pivot)
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, legH + 0.03, 8), x > 0 ? fur : dark); leg.position.y = -(legH + 0.03) / 2 + 0.02; pivot.add(leg)
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), light); paw.scale.set(1.3, 0.6, 1); paw.position.set(0.01, -legH + 0.01, 0); pivot.add(paw)
    legs.push(pivot)
  }
  // หัว
  const head = new THREE.Group(); head.position.set(kind === 'rabbit' ? 0.13 : 0.2, legH + 0.17, 0); body.add(head)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(kind === 'rabbit' ? 0.075 : 0.085, 16, 12), fur); head.add(skull)
  const eyeM = new THREE.MeshStandardMaterial({ color: kind === 'cat' ? '#15803d' : '#111827', roughness: 0.15 })
  for (const z of [-0.035, 0.035]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), eyeM); e.position.set(0.07, 0.02, z); head.add(e) }
  if (kind === 'dog') {
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), light); snout.scale.set(1.3, 0.8, 0.9); snout.position.set(0.08, -0.02, 0); head.add(snout)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M('#111827', 0.3)); nose.position.set(0.14, -0.005, 0); head.add(nose)
    for (const z of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), dark); ear.scale.set(0.6, 1.4, 0.4); ear.position.set(-0.02, -0.01, z * 0.08); ear.rotation.x = z * 0.3; head.add(ear) }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), M('#dc2626', 0.4)); collar.position.set(-0.05, -0.06, 0); collar.rotation.y = Math.PI / 2; collar.rotation.x = 0.4; head.add(collar)
  } else if (kind === 'cat') {
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), light); muzzle.scale.set(0.9, 0.7, 1.2); muzzle.position.set(0.065, -0.025, 0); head.add(muzzle)
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), M('#f472b6', 0.4)); nose.position.set(0.095, -0.01, 0); head.add(nose)
    for (const z of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), fur); ear.position.set(0, 0.08, z * 0.045); ear.rotation.x = z * 0.25; head.add(ear) }
    // ลายเสือส้ม
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.01, 4, 16, Math.PI), dark); st.position.set(-0.08 + i * 0.07, legH + 0.09, 0); st.rotation.y = Math.PI / 2; body.add(st) }
  } else {
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), M('#f472b6', 0.4)); nose.position.set(0.075, -0.01, 0); head.add(nose)
    for (const z of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(-0.01, 0.06, z * 0.03); ear.rotation.x = z * 0.18; head.add(ear)
      const outer = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), fur); outer.scale.set(0.7, 2.6, 0.45); outer.position.y = 0.07; ear.add(outer)
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), light); inner.scale.set(0.5, 2.6, 0.3); inner.position.set(0.012, 0.07, 0); ear.add(inner)
    }
  }
  // หาง
  const tail = new THREE.Group(); tail.position.set(kind === 'rabbit' ? -0.13 : -0.18, legH + 0.13, 0); body.add(tail)
  if (kind === 'rabbit') { const puff = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M('#ffffff', 1)); tail.add(puff) }
  else {
    const len = kind === 'cat' ? 0.22 : 0.14
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, len, 8), fur); t.position.y = len / 2; tail.add(t)
    tail.rotation.z = kind === 'cat' ? 0.5 : -0.6
  }
  g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true })
  g.scale.setScalar(s * 2)
  return { group: g, body, head, tail, legs, kind }
}

/** ท่าทางทุกเฟรม: เดิน = ขาสลับ ตัวเด้ง · นั่ง · นอนขด (ตัวต่ำ ขาซ่อน หายใจ) · หางกระดิก */
export function animatePet(r: PetRig, mode: PetMode, t: number, seed: number) {
  const walk = mode === 'walk', sleep = mode === 'sleep', sit = mode === 'sit'
  const hop = r.kind === 'rabbit'
  r.legs.forEach((l, i) => {
    l.visible = !sleep
    l.rotation.z = walk ? Math.sin(t * (hop ? 9 : 14) + (hop ? (i < 2 ? 0 : Math.PI) : i * Math.PI / 2 + (i % 2) * Math.PI)) * 0.6 : 0
  })
  r.body.position.y = sleep ? -0.1 : walk ? Math.abs(Math.sin(t * (hop ? 9 : 14))) * (hop ? 0.05 : 0.012) : 0
  r.body.rotation.z = sit ? 0.55 : 0
  r.body.scale.set(sleep ? 0.95 : 1, sleep ? 0.7 + Math.sin(t * 2.4 + seed) * 0.03 : 1, sleep ? 1.15 : 1)
  r.head.rotation.z = sleep ? -0.5 : sit ? -0.45 : Math.sin(t * 0.8 + seed) * 0.08
  r.head.rotation.y = sleep ? 0.9 : Math.sin(t * 0.5 + seed) * 0.25
  const wagSpeed = r.kind === 'dog' ? 16 : r.kind === 'cat' ? 3 : 0
  r.tail.rotation.x = sleep ? 0 : Math.sin(t * wagSpeed + seed) * (r.kind === 'dog' ? 0.6 : 0.3)
}
