import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { Avatar, Facing } from '../../utils/officeAvatar'
import { propDef, type Prop } from '../../utils/officeProps'
import { deskSurface, type Desk } from '../../utils/officeDecor'
import { buildProp3D } from './props3d'

// ── ออฟฟิศ 3D (เฟส 1): ห้อง ผนัง พื้น เฟอร์นิเจอร์ สวนแบบเรียบ + ตัวละครเดินได้ ──
// สไตล์การ์ตูน ทรงเรียบ สร้างจากรูปทรงพื้นฐานทั้งหมด (ไม่มีไฟล์โมเดล ไม่มีลิขสิทธิ์) · 1 ช่อง = 1 หน่วย · แกน x = คอลัมน์, z = แถว
// ประหยัดเครื่อง: ของที่ซ้ำกันวาดด้วย InstancedMesh · วาด 30 เฟรม/วิ · ไม่วาดตอนหน้าต่างถูกซ่อน · เงาแผนที่เดียว 1024px

export interface Person3D {
  email: string; x: number; y: number; name: string; avatar: Avatar; face: Facing
  moving: boolean; sitting: boolean; speaking: boolean; statusColor: string; me: boolean
}

interface Props {
  rows: string[]
  props: Prop[]
  desks: { email: string; desk: Desk }[]
  people: Person3D[]
  onTileClick: (x: number, y: number) => void
  onFocusChange: (focused: boolean) => void
}

// ── สีพื้น/ของตามตัวอักษรในผัง ──
const FLOOR: Record<string, string> = {
  '.': '#ead7b4', M: '#c9d6e6', F: '#f6d4dd', C: '#c4ecf1', S: '#ddd5f7', E: '#a8794e',
  g: '#7cc463', p: '#cfcac4', w: '#4fa8de', f: '#7a4a2a', h: '#7cc463', '#': '#64748b',
  T: '#c9d6e6', d: '#ead7b4', K: '#c4ecf1', W: '#c9d6e6',
}
const PLANT_COLORS: Record<string, string> = { P: '#3f9d4b', G: '#2f8a5b', Y: '#6fb04a', L: '#4f9e3d', R: '#d9467a', U: '#2e7d5b', Z: '#8bbf4a', N: '#3b8c6e', J: '#5aa65a' }
const isPlant = (ch: string) => ch in PLANT_COLORS


// ── ตัวละคร (ทรงการ์ตูนหัวโต) ──
interface AvatarRig { group: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D; body: THREE.Object3D; ring: THREE.Mesh; label: CSS2DObject; key: string }

const lambert = (color: string) => new THREE.MeshLambertMaterial({ color })

function buildAvatar(a: Avatar): Omit<AvatarRig, 'ring' | 'label' | 'key'> {
  const g = new THREE.Group()
  const body = new THREE.Group(); g.add(body)
  const skin = lambert(a.skin), top = lambert(a.top === 'lab' ? '#f8fafc' : a.topColor)
  const legsColor = a.bottom === 'shorts' || a.bottom === 'skirt' || a.top === 'dress' ? a.skin : a.bottomColor
  const leg = (x: number) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.42, 0)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.38, 8), lambert(legsColor)); m.position.y = -0.19; m.castShadow = true
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.16), lambert(a.shoes)); shoe.position.set(0, -0.39, 0.02)
    pivot.add(m, shoe); body.add(pivot); return pivot
  }
  const legL = leg(-0.08), legR = leg(0.08)
  // ลำตัว (เดรส/เสื้อกาวน์ = ทรงกรวยบาน)
  const torso = a.top === 'dress' || a.top === 'lab'
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.23, 0.42, 12), top)
    : new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.36, 12), top)
  torso.position.y = a.top === 'dress' || a.top === 'lab' ? 0.6 : 0.62; torso.castShadow = true; body.add(torso)
  if (a.bottom === 'skirt' && a.top !== 'dress') { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.14, 12), lambert(a.bottomColor)); sk.position.y = 0.43; body.add(sk) }
  if (a.top === 'suit') { const tie = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.02), lambert('#dc2626')); tie.position.set(0, 0.64, 0.165); body.add(tie) }
  const arm = (x: number) => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.78, 0)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 8), top); m.position.y = -0.15
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin); hand.position.y = -0.32
    pivot.add(m, hand); body.add(pivot); return pivot
  }
  const armL = arm(-0.21), armR = arm(0.21)
  // หัวโต
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), skin); head.position.y = 1.07; head.castShadow = true; body.add(head)
  const eyeM = lambert('#1f2937')
  for (const x of [-0.08, 0.08]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), eyeM); e.position.set(x, 1.09, 0.235); body.add(e) }
  const blush = lambert('#fb7185')
  for (const x of [-0.14, 0.14]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), blush); b.scale.set(1, 0.5, 0.3); b.position.set(x, 1.02, 0.22); body.add(b) }
  // ผม
  const hair = lambert(a.hairColor)
  if (a.hair !== 'bald') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.275, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hair)
    cap.position.y = 1.08; cap.rotation.x = -0.25; body.add(cap)
  }
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, mat = hair) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); body.add(m); return m }
  if (a.hair === 'long') add(new THREE.BoxGeometry(0.5, 0.5, 0.1), 0, 0.92, -0.2)
  if (a.hair === 'bob') add(new THREE.BoxGeometry(0.54, 0.25, 0.4), 0, 1.0, -0.06)
  if (a.hair === 'pony') add(new THREE.SphereGeometry(0.1, 10, 8), 0, 1.02, -0.3).scale.set(1, 1.8, 1)
  if (a.hair === 'bun') add(new THREE.SphereGeometry(0.11, 10, 8), 0, 1.38, -0.04)
  if (a.hair === 'twin') { add(new THREE.SphereGeometry(0.1, 10, 8), -0.28, 1.0, -0.05); add(new THREE.SphereGeometry(0.1, 10, 8), 0.28, 1.0, -0.05) }
  if (a.hair === 'mohawk') add(new THREE.BoxGeometry(0.08, 0.16, 0.42), 0, 1.36, 0)
  if (a.hair === 'curly') for (let i = 0; i < 7; i++) add(new THREE.SphereGeometry(0.09, 8, 6), Math.cos(i) * 0.18, 1.3 + (i % 2) * 0.03, Math.sin(i) * 0.18 - 0.03)
  if (a.hair === 'spiky') for (let i = 0; i < 6; i++) { const c = add(new THREE.ConeGeometry(0.06, 0.16, 6), Math.cos(i * 1.05) * 0.13, 1.36, Math.sin(i * 1.05) * 0.13); c.rotation.z = Math.cos(i * 1.05) * -0.5; c.rotation.x = Math.sin(i * 1.05) * 0.5 }
  // ของประดับ (บางชิ้น)
  if (a.acc === 'crown') add(new THREE.CylinderGeometry(0.14, 0.12, 0.1, 8, 1, true), 0, 1.36, 0, lambert('#facc15'))
  if (a.acc === 'halo') { const t = add(new THREE.TorusGeometry(0.16, 0.02, 6, 20), 0, 1.5, 0, lambert('#fde047')); t.rotation.x = Math.PI / 2 }
  if (a.acc === 'cap' || a.acc === 'helmet' || a.acc === 'beanie') {
    const col = a.acc === 'cap' ? '#dc2626' : a.acc === 'helmet' ? '#facc15' : '#7c3aed'
    add(new THREE.SphereGeometry(0.285, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), 0, 1.1, 0, lambert(col))
    if (a.acc !== 'beanie') add(new THREE.BoxGeometry(0.3, 0.02, 0.18), 0, 1.2, 0.25, lambert(col))
  }
  if (a.acc === 'headphones') { const t = add(new THREE.TorusGeometry(0.27, 0.025, 6, 20, Math.PI), 0, 1.08, 0, lambert('#374151')); t.rotation.y = Math.PI / 2 }
  if (a.acc === 'catears') { add(new THREE.ConeGeometry(0.07, 0.14, 4), -0.15, 1.35, 0); add(new THREE.ConeGeometry(0.07, 0.14, 4), 0.15, 1.35, 0) }
  if (a.acc === 'glasses' || a.acc === 'sunglasses') {
    const m = lambert(a.acc === 'sunglasses' ? '#111827' : '#334155')
    for (const x of [-0.08, 0.08]) { const r = add(new THREE.TorusGeometry(0.045, 0.01, 6, 14), x, 1.09, 0.25, m); if (a.acc === 'sunglasses') r.scale.set(1, 1, 1) }
  }
  return { group: g, legL, legR, armL, armR, body }
}

const FACE_ROT: Record<Facing, number> = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }

export default function Office3D({ rows, props, desks, people, onTileClick, onFocusChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls
    world: THREE.Group; avatars: Map<string, AvatarRig>; floor: THREE.InstancedMesh | null; tiles: { x: number; y: number }[]
    /** สิ่งของที่ขยับได้ (น้ำตก ชิงช้า ...) */
    ticks: ((t: number) => void)[]
  } | null>(null)
  const peopleRef = useRef(people)
  useEffect(() => { peopleRef.current = people }, [people])
  const clickRef = useRef(onTileClick)
  useEffect(() => { clickRef.current = onTileClick }, [onTileClick])

  // ── ตั้งเวที: renderer · กล้อง · แสง · ลูปวาด ──
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)
    const labels = new CSS2DRenderer()
    labels.domElement.style.position = 'absolute'; labels.domElement.style.inset = '0'; labels.domElement.style.pointerEvents = 'none'
    host.appendChild(labels.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dbeafe')
    scene.fog = new THREE.Fog('#dbeafe', 40, 90)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
    camera.position.set(0, 14, 16)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 4; controls.maxDistance = 40
    controls.maxPolarAngle = 1.25
    controls.screenSpacePanning = false

    scene.add(new THREE.HemisphereLight('#ffffff', '#b8a68a', 1.6))
    const sun = new THREE.DirectionalLight('#fff4e0', 1.6)
    sun.position.set(-12, 22, 10); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30
    sun.shadow.bias = -0.0005
    scene.add(sun, sun.target)
    const world = new THREE.Group(); scene.add(world)
    sceneRef.current = { scene, camera, controls, world, avatars: new Map(), floor: null, tiles: [], ticks: [] }

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      renderer.setSize(w, h); labels.setSize(w, h)
      camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(host)

    // คลิกพื้น = เดินไป (ลากหมุนกล้องไม่นับเป็นคลิก)
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
    let downAt: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY } }
    const onUp = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) { downAt = null; return }
      downAt = null
      const st = sceneRef.current
      if (!st?.floor) return
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hit = ray.intersectObject(st.floor)[0]
      if (hit?.instanceId != null) { const t = st.tiles[hit.instanceId]; if (t) clickRef.current(t.x, t.y) }
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    // ลูปวาด 30 เฟรม/วิ · หยุดเมื่อหน้าต่างถูกซ่อน
    const clock = new THREE.Clock()
    let acc = 0, firstFocus = true
    const tmp = new THREE.Vector3()
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta()
      if (document.hidden) return
      acc += dt
      if (acc < 1 / 30) return
      const step = acc; acc = 0
      const t = clock.elapsedTime
      const st = sceneRef.current!
      for (const tk of st.ticks) tk(t)
      for (const p of peopleRef.current) {
        const rig = st.avatars.get(p.email)
        if (!rig) continue
        tmp.set(p.x + 0.5, 0, p.y + 0.5)
        rig.group.position.lerp(tmp, Math.min(1, step * (p.me ? 12 : 3)))
        const want = FACE_ROT[p.face]
        let d = want - rig.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d))
        rig.group.rotation.y += d * Math.min(1, step * 10)
        const walk = p.moving && !p.sitting ? Math.sin(t * 12) * 0.6 : 0
        rig.legL.rotation.x = p.sitting ? -1.4 + Math.sin(t * 3) * 0.2 : walk
        rig.legR.rotation.x = p.sitting ? -1.4 - Math.sin(t * 3) * 0.2 : -walk
        rig.armL.rotation.x = -walk * 0.8; rig.armR.rotation.x = walk * 0.8
        rig.body.position.y = p.sitting ? 0.0 : (p.moving ? Math.abs(Math.sin(t * 12)) * 0.04 : 0)
        rig.ring.visible = p.speaking
        if (p.speaking) rig.ring.scale.setScalar(1 + Math.sin(t * 8) * 0.12)
        // กล้องตามตัวเรา (เป้าหมุนรอบตัวเรา)
        if (p.me) {
          const target = rig.group.position
          if (firstFocus) { controls.target.copy(target); camera.position.set(target.x, 9, target.z + 9); firstFocus = false }
          else controls.target.lerp(target, Math.min(1, step * 4))
        }
      }
      controls.update()
      renderer.render(scene, camera)
      labels.render(scene, camera)
    })

    return () => {
      renderer.setAnimationLoop(null)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      scene.traverse(o => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose()
      })
      renderer.dispose()
      host.removeChild(renderer.domElement)
      host.removeChild(labels.domElement)
      sceneRef.current = null
    }
  }, [])

  // ── สร้างฉาก (พื้น ผนัง ของ) ใหม่เมื่อผัง/ของ/โต๊ะเปลี่ยน ──
  const sceneKey = JSON.stringify([rows, props, desks.map(d => [d.desk.x, d.desk.y, d.desk.rot, d.desk.style])])
  useEffect(() => {
    const st = sceneRef.current
    if (!st) return
    const world = st.world
    world.traverse(o => { const m = o as THREE.Mesh; if (m !== (world as unknown as THREE.Mesh) && m.geometry) { m.geometry.dispose(); (m.material as THREE.Material).dispose?.() } })
    world.clear()
    const H = rows.length, W = rows[0]?.length ?? 0
    const color = new THREE.Color()
    const dummy = new THREE.Object3D()

    /** วางกล่องหลายชิ้นในครั้งเดียว (InstancedMesh) */
    const boxes = (items: { x: number; z: number; w: number; d: number; h: number; y?: number; color: string }[], cast = true) => {
      if (!items.length) return null
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), items.length)
      items.forEach((it, i) => {
        dummy.position.set(it.x, (it.y ?? 0) + it.h / 2, it.z); dummy.scale.set(it.w, it.h, it.d); dummy.rotation.set(0, 0, 0); dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(it.color))
      })
      mesh.castShadow = cast; mesh.receiveShadow = true
      world.add(mesh); return mesh
    }

    // พื้น (คลิกเดินได้) — ทุกช่องเป็นพื้นบาง ๆ สีตามโซน
    const tiles: { x: number; y: number }[] = []
    const floorItems: Parameters<typeof boxes>[0] = []
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      tiles.push({ x, y })
      const base = FLOOR[ch] ?? (isPlant(ch) ? (rows[y + 1]?.[x] === 'g' || rows[y]?.[x - 1] === 'g' ? FLOOR.g : FLOOR['.']) : FLOOR['.'])
      const shade = (x + y) % 2 ? 0.96 : 1   // ลายตารางจาง ๆ ให้รู้ระยะ
      color.set(base).multiplyScalar(shade)
      floorItems.push({ x: x + 0.5, z: y + 0.5, w: 1, d: 1, h: ch === 'w' ? 0.04 : 0.1, y: ch === 'w' ? -0.06 : -0.1, color: `#${color.getHexString()}` })
    }))
    st.floor = boxes(floorItems, false)
    st.tiles = tiles

    const walls: Parameters<typeof boxes>[0] = [], tables: Parameters<typeof boxes>[0] = [], dark: Parameters<typeof boxes>[0] = []
    const pots: Parameters<typeof boxes>[0] = [], hedges: Parameters<typeof boxes>[0] = [], white: Parameters<typeof boxes>[0] = []
    const foliage: { x: number; z: number; color: string; r: number }[] = []
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const cx = x + 0.5, cz = y + 0.5
      if (ch === '#') walls.push({ x: cx, z: cz, w: 1, d: 1, h: 1.5, color: '#94a3b8' })
      else if (ch === 'T') tables.push({ x: cx, z: cz, w: 1, d: 1, h: 0.08, y: 0.68, color: '#a16207' }, { x: cx, z: cz, w: 0.12, d: 0.12, h: 0.68, color: '#713f12' })
      else if (ch === 'd') {
        tables.push({ x: cx, z: cz - 0.1, w: 0.95, d: 0.6, h: 0.06, y: 0.7, color: '#c79a63' })
        dark.push({ x: cx, z: cz - 0.3, w: 0.5, d: 0.04, h: 0.32, y: 0.8, color: '#1e293b' })
        dark.push({ x: cx, z: cz + 0.35, w: 0.4, d: 0.4, h: 0.45, color: '#334155' })   // เก้าอี้
      }
      else if (ch === 'K') dark.push({ x: cx, z: cz, w: 0.55, d: 0.5, h: 1.0, color: '#475569' })
      else if (ch === 'W') white.push({ x: cx, z: cz, w: 0.9, d: 0.06, h: 0.7, y: 0.6, color: '#f8fafc' })
      else if (ch === 'h') hedges.push({ x: cx, z: cz, w: 1, d: 1, h: 0.7, color: '#2f7a3a' })
      else if (ch === 'f') foliage.push({ x: cx, z: cz, color: ['#f472b6', '#facc15', '#a78bfa'][(x + y) % 3], r: 0.18 })
      else if (isPlant(ch)) {
        pots.push({ x: cx, z: cz, w: 0.36, d: 0.36, h: 0.32, color: '#b45309' })
        foliage.push({ x: cx, z: cz, color: PLANT_COLORS[ch], r: ch === 'G' || ch === 'U' ? 0.55 : 0.42 })
      }
    }))
    boxes(walls); boxes(tables); boxes(dark); boxes(pots); boxes(hedges); boxes(white)
    // พุ่มไม้/ดอกไม้ = ทรงกลม
    if (foliage.length) {
      const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), foliage.length)
      foliage.forEach((f, i) => {
        const big = f.r > 0.3
        dummy.position.set(f.x, big ? 0.32 + f.r : 0.12, f.z); dummy.scale.setScalar(f.r); dummy.rotation.set(0, (f.x * 7 + f.z) % 3, 0); dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(f.color))
      })
      mesh.castShadow = true; world.add(mesh)
    }

    // สิ่งของชิ้นใหญ่ (เฟส 2) — โมเดลการ์ตูนต่อชนิด · ชิ้นที่ขยับได้ลงทะเบียน tick
    st.ticks = []
    for (const p of props) {
      const def = propDef(p.kind)
      if (!def) continue
      const b = buildProp3D(p.kind, def.w, def.h)
      b.group.position.set(p.x, 0, p.y)
      world.add(b.group)
      if (b.tick) st.ticks.push(b.tick)
    }

    // โต๊ะส่วนตัว (3×3 · ตัวโต๊ะ 6 ช่อง + เก้าอี้)
    const deskItems: Parameters<typeof boxes>[0] = []
    for (const { desk } of desks) {
      for (const t of deskSurface(desk)) deskItems.push({ x: t.x + 0.5, z: t.y + 0.5, w: 1, d: 1, h: 0.07, y: 0.7, color: '#c79a63' })
      deskItems.push({ x: desk.x + 0.5, z: desk.y + 0.5, w: 0.15, d: 0.15, h: 0.7, color: '#8b6a43' })
    }
    boxes(deskItems)

    // ตั้งกล้องให้เห็นทั้งออฟฟิศครั้งแรก (ถ้ายังไม่มีตัวเรา)
    if (!st.controls.target.lengthSq()) { st.controls.target.set(W / 2, 0, H / 2); st.camera.position.set(W / 2, Math.max(W, H) * 0.7, H + 8) }
  }, [sceneKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── ตัวละคร: สร้าง/เปลี่ยนชุด/ลบ ตามคนที่อยู่ ──
  const peopleKey = people.map(p => `${p.email}|${JSON.stringify(p.avatar)}|${p.name}|${p.statusColor}|${p.me}`).join(';')
  useEffect(() => {
    const st = sceneRef.current
    if (!st) return
    const seen = new Set<string>()
    for (const p of peopleRef.current) {
      seen.add(p.email)
      const key = `${JSON.stringify(p.avatar)}|${p.name}|${p.statusColor}|${p.me}`
      const old = st.avatars.get(p.email)
      if (old && old.key === key) continue
      const pos = old?.group.position.clone() ?? new THREE.Vector3(p.x + 0.5, 0, p.y + 0.5)
      if (old) { old.label.element.remove(); st.scene.remove(old.group) }
      const rig = buildAvatar(p.avatar)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 24), new THREE.MeshBasicMaterial({ color: '#22c55e' }))
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.03; ring.visible = false; rig.group.add(ring)
      const el = document.createElement('div')
      el.textContent = p.name
      el.style.cssText = `font: 600 10px system-ui, sans-serif; padding: 1px 6px; border-radius: 6px; white-space: nowrap; ${p.me ? 'background:#2563eb;color:#fff' : 'background:rgba(255,255,255,.92);color:#334155'}; box-shadow: 0 1px 2px rgba(0,0,0,.2); border-left: 4px solid ${p.statusColor}`
      const label = new CSS2DObject(el); label.position.set(0, 1.62, 0); rig.group.add(label)
      rig.group.position.copy(pos)
      st.scene.add(rig.group)
      st.avatars.set(p.email, { ...rig, ring, label, key })
    }
    for (const [email, rig] of st.avatars) if (!seen.has(email)) { rig.label.element.remove(); st.scene.remove(rig.group); st.avatars.delete(email) }
  }, [peopleKey])

  return (
    <div ref={hostRef} tabIndex={0} onFocus={() => onFocusChange(true)} onBlur={() => onFocusChange(false)}
      className="relative w-full h-full outline-none rounded-2xl overflow-hidden" />
  )
}
