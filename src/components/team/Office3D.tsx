import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { floorTexture, groundTexture, skyTexture } from './textures3d'
import { buildPlant3D, buildFlowerBed3D, buildDesk3D, waterMaterial } from './detail3d'
import { createEffects, fpsWatch, type Effects, type Quality } from './effects3d'
import { buildPlantReal, buildHedgeReal, buildMeetingChair, buildCoffeeStation } from './realism3d'
import { lightAt, skyAt, buildClouds, buildTreeRing, buildGrass } from './environment3d'
import type { Avatar, Facing } from '../../utils/officeAvatar'
import { propDef, type Prop } from '../../utils/officeProps'
import type { Desk } from '../../utils/officeDecor'
import { buildProp3D } from './props3d'
import { buildDecor3D, buildRobot3D, buildBird3D, type RobotRig, type BirdRig } from './decor3d'
import { birdHomes, birdFeedSpot, type BirdHome } from '../../utils/gardenBirds'

// ── ออฟฟิศ 3D (เฟส 1): ห้อง ผนัง พื้น เฟอร์นิเจอร์ สวนแบบเรียบ + ตัวละครเดินได้ ──
// สไตล์การ์ตูน ทรงเรียบ สร้างจากรูปทรงพื้นฐานทั้งหมด (ไม่มีไฟล์โมเดล ไม่มีลิขสิทธิ์) · 1 ช่อง = 1 หน่วย · แกน x = คอลัมน์, z = แถว
// ประหยัดเครื่อง: ของที่ซ้ำกันวาดด้วย InstancedMesh · วาด 30 เฟรม/วิ · ไม่วาดตอนหน้าต่างถูกซ่อน · เงาแผนที่เดียว 1024px

export interface Person3D {
  email: string; x: number; y: number; name: string; avatar: Avatar; face: Facing
  moving: boolean; sitting: boolean; speaking: boolean; statusColor: string; me: boolean
}

export interface Item3D { kind: string; x: number; y: number; rot: number; flip: boolean; onDesk: boolean }
export interface Robot3D { x: number; y: number; left: boolean; holding: 'broom' | 'cup' | 'none'; label: string | null }

interface Props {
  rows: string[]
  props: Prop[]
  desks: { email: string; desk: Desk }[]
  /** ของแต่งโต๊ะของทุกคน */
  items: Item3D[]
  robot: Robot3D | null
  /** คนที่กำลังให้อาหารนก */
  feeders: { x: number; y: number }[]
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
interface AvatarRig { group: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D; body: THREE.Object3D; eyes: THREE.Object3D[]; ring: THREE.Mesh; label: CSS2DObject; key: string }

const lambert = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 })

function buildAvatar(a: Avatar): Omit<AvatarRig, 'ring' | 'label' | 'key'> {
  const eyes: THREE.Object3D[] = []
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
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 28, 22), skin); head.position.y = 1.07; head.castShadow = true; body.add(head)
  // ตา: ตาขาว + ตาดำ + ประกาย (กะพริบได้)
  const white = lambert('#ffffff'), pupil = lambert('#1f2937'), shine = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  for (const x of [-0.085, 0.085]) {
    const e = new THREE.Group(); e.position.set(x, 1.09, 0.225)
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), white); w.scale.set(1, 1.15, 0.5); e.add(w)
    const pp = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), pupil); pp.position.set(0, -0.005, 0.02); pp.scale.set(1, 1.15, 0.5); e.add(pp)
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), shine); hl.position.set(0.012, 0.014, 0.035); e.add(hl)
    body.add(e); eyes.push(e)
  }
  // คิ้ว + ปาก
  for (const x of [-0.085, 0.085]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.01), lambert(a.hairColor)); b.position.set(x, 1.165, 0.235); body.add(b) }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 6, 12, Math.PI), lambert('#9a3412')); mouth.position.set(0, 1.0, 0.245); mouth.rotation.z = Math.PI; body.add(mouth)
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
  return { group: g, legL, legR, armL, armR, body, eyes }
}

const FACE_ROT: Record<Facing, number> = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }

export default function Office3D({ rows, props, desks, items, robot, feeders, people, onTileClick, onFocusChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls
    world: THREE.Group; avatars: Map<string, AvatarRig>; floors: { mesh: THREE.InstancedMesh; tiles: { x: number; y: number }[] }[]
    /** สิ่งของที่ขยับได้ (น้ำตก ชิงช้า ...) */
    ticks: ((t: number) => void)[]
    robot: RobotRig & { label: CSS2DObject }
    fx: Effects; sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; nightFill: THREE.AmbientLight
    nightLights: THREE.PointLight[]; lightKey: string
    birds: { rig: BirdRig; home: BirdHome; i: number; away: number }[]
  } | null>(null)
  // คุณภาพภาพ: สูงสุด (AO + ความละเอียดเต็ม) / สมดุล — จำไว้ในเครื่อง · เครื่องกระตุกลดให้เอง
  const [quality, setQuality] = useState<Quality>(() => { try { return localStorage.getItem('hd-office-3d-q') === 'balanced' ? 'balanced' : 'ultra' } catch { return 'ultra' } })
  const [notice, setNotice] = useState('')
  const pickQuality = (q: Quality) => { setQuality(q); try { localStorage.setItem('hd-office-3d-q', q) } catch { /* แค่ไม่จำ */ } }
  const qualityRef = useRef(quality)
  useEffect(() => { qualityRef.current = quality; sceneRef.current?.fx.setQuality(quality) }, [quality])
  const peopleRef = useRef(people)
  useEffect(() => { peopleRef.current = people }, [people])
  const robotRef = useRef(robot)
  useEffect(() => { robotRef.current = robot }, [robot])
  const feedRef = useRef(feeders)
  useEffect(() => { feedRef.current = feeders }, [feeders])
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
    // สีแบบภาพยนตร์ + แสงสะท้อนจากห้องจำลอง → วัสดุดูมีมิติ นุ่มตา
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.92
    host.appendChild(renderer.domElement)
    const labels = new CSS2DRenderer()
    labels.domElement.style.position = 'absolute'; labels.domElement.style.inset = '0'; labels.domElement.style.pointerEvents = 'none'
    host.appendChild(labels.domElement)

    const scene = new THREE.Scene()
    scene.background = skyTexture()
    scene.fog = new THREE.Fog('#e6eef7', 45, 110)
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.3
    // พื้นดินรอบตึก
    const gtex = groundTexture(); gtex.repeat.set(70, 70)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: gtex, roughness: 1 }))
    ground.rotation.x = -Math.PI / 2; ground.position.set(20, -0.12, 10); ground.receiveShadow = true
    scene.add(ground)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
    camera.position.set(0, 14, 16)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 4; controls.maxDistance = 40
    controls.maxPolarAngle = 1.25
    controls.screenSpacePanning = false

    const hemi = new THREE.HemisphereLight('#eaf4ff', '#b8a68a', 0.9); scene.add(hemi)
    const nightFill = new THREE.AmbientLight('#ffd9a8', 0); scene.add(nightFill)
    const sun = new THREE.DirectionalLight('#fff1dc', 2.4)
    sun.position.set(-12, 22, 10); sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.radius = 4
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30
    sun.shadow.bias = -0.0005
    scene.add(sun, sun.target)
    const world = new THREE.Group(); scene.add(world)
    // หุ่นยนต์ (สร้างครั้งเดียว ขยับตามตำแหน่งที่ส่งมา)
    const rr = buildRobot3D()
    const rel = document.createElement('div')
    rel.style.cssText = 'font: 600 9px system-ui, sans-serif; padding: 1px 6px; border-radius: 999px; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; white-space: nowrap'
    const rlabel = new CSS2DObject(rel); rlabel.position.set(0, 1.3, 0); rr.group.add(rlabel)
    rr.group.visible = false; scene.add(rr.group)
    const fx = createEffects(renderer, scene, camera, qualityRef.current)
    sceneRef.current = { scene, camera, controls, world, avatars: new Map(), floors: [], ticks: [], robot: { ...rr, label: rlabel }, birds: [], fx, sun, hemi, nightFill, nightLights: [], lightKey: '' }

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      renderer.setSize(w, h); labels.setSize(w, h); sceneRef.current?.fx.setSize(w, h)
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
      if (!st?.floors.length) return
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hit = ray.intersectObjects(st.floors.map(f => f.mesh))[0]
      const fl = hit && st.floors.find(f => f.mesh === hit.object)
      if (fl && hit.instanceId != null) { const t = fl.tiles[hit.instanceId]; if (t) clickRef.current(t.x, t.y) }
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    // ลูปวาด 30 เฟรม/วิ · หยุดเมื่อหน้าต่างถูกซ่อน
    const clock = new THREE.Clock()
    let acc = 0, firstFocus = true
    const watch = fpsWatch(() => {
      if (qualityRef.current !== 'ultra') return
      qualityRef.current = 'balanced'; setQuality('balanced')
      setNotice('เครื่องนี้เริ่มกระตุก — ลดเป็นคุณภาพ "สมดุล" ให้แล้ว (กดสลับกลับได้)')
    })
    /** แสงตามเวลาจริง (อัปเดตทีละนาที) */
    const applyLight = (st: NonNullable<typeof sceneRef.current>) => {
      const now = new Date()
      const key = `${now.getHours()}:${now.getMinutes()}`
      if (st.lightKey === key) return
      st.lightKey = key
      const L = lightAt(now)
      const c = st.controls.target
      st.sun.position.set(c.x + L.sunDir.x, L.sunDir.y, c.z + L.sunDir.z); st.sun.target.position.copy(c)
      st.sun.color.copy(L.sunColor); st.sun.intensity = L.sunIntensity
      st.hemi.color.copy(L.hemiSky); st.hemi.groundColor.copy(L.hemiGround); st.hemi.intensity = L.hemiIntensity
      st.nightFill.intensity = L.night * 0.35
      st.nightLights.forEach(l => { l.intensity = L.night * 3.2 + L.dusk * 0.8 })
      renderer.toneMappingExposure = L.exposure
      st.scene.background = skyAt(L.night, L.dusk)
      st.scene.fog = new THREE.Fog(L.night > 0.5 ? '#1d2440' : '#e6eef7', 45, 110)
      st.fx.setNight(L.night)
    }
    const tmp = new THREE.Vector3()
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta()
      if (document.hidden) return
      acc += dt
      if (acc < 1 / 30) return
      const step = acc; acc = 0
      const t = clock.elapsedTime
      const st = sceneRef.current!
      watch()
      applyLight(st)
      for (const tk of st.ticks) tk(t)
      // หุ่นยนต์: เลื่อนไปช่องถัดไปแบบนุ่ม · เดินแกว่งขา · ไม้กวาดปัด / ถือแก้ว
      const rb = robotRef.current, R = st.robot
      R.group.visible = !!rb
      if (rb) {
        tmp.set(rb.x + 0.5, 0, rb.y + 0.5)
        if (R.group.position.lengthSq() === 0) R.group.position.copy(tmp)
        const dist = R.group.position.distanceTo(tmp)
        R.group.position.lerp(tmp, Math.min(1, step * 1.6))
        const tr = rb.left ? -Math.PI / 2 : Math.PI / 2
        R.group.rotation.y += (tr - R.group.rotation.y) * Math.min(1, step * 6)
        const sw = dist > 0.05 ? Math.sin(t * 9) * 0.5 : 0
        R.legL.rotation.x = sw; R.legR.rotation.x = -sw
        R.broom.visible = rb.holding === 'broom'; R.cup.visible = rb.holding === 'cup'
        R.arm.rotation.x = rb.holding === 'broom' ? Math.sin(t * 6) * 0.35 : rb.holding === 'cup' ? -0.9 : 0
        R.label.visible = !!rb.label
        if (rb.label && R.label.element.textContent !== rb.label) R.label.element.textContent = rb.label
      }
      // นก: ให้อาหาร = บินมารุมรอบคนให้ · คนเข้าใกล้ = บินหนี · ปกติ = จิกพื้นที่บ้าน
      for (const b of st.birds) {
        const spot = birdFeedSpot(b.home, b.i, feedRef.current)
        const near = !spot && peopleRef.current.some(p => Math.abs(p.x - b.home.x) <= 1 && Math.abs(p.y - b.home.y) <= 1)
        b.away = Math.max(0, Math.min(1, b.away + (near ? step * 2 : -step * 0.8)))
        const gx = spot ? spot.fx : b.home.fx, gz = spot ? spot.fz : b.home.fz
        const bg = b.rig.group
        bg.position.x += (gx - bg.position.x) * Math.min(1, step * 1.5)
        bg.position.z += (gz - bg.position.z) * Math.min(1, step * 1.5)
        bg.position.y = b.away * 3
        bg.visible = b.away < 0.95
        bg.rotation.y = spot ? (bg.position.x > spot.cx ? Math.PI : 0) : (b.home.flip ? Math.PI : 0)
        b.rig.head.rotation.z = b.away > 0 ? 0 : -Math.max(0, Math.sin(t * 7 + b.i * 1.7)) * 0.9
      }
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
        // กะพริบตา (ทุก ~4 วิ ไม่พร้อมกัน) · ยืนนิ่ง = หายใจเบา ๆ
        const blink = ((t + p.email.length * 0.37) % 4) < 0.12
        rig.eyes.forEach(e => { e.scale.y = blink ? 0.12 : 1 })
        if (!p.moving && !p.sitting) rig.body.scale.y = 1 + Math.sin(t * 2.2 + p.email.length) * 0.012
        if (p.speaking) rig.ring.scale.setScalar(1 + Math.sin(t * 8) * 0.12)
        // กล้องตามตัวเรา (เป้าหมุนรอบตัวเรา)
        if (p.me) {
          const target = rig.group.position
          if (firstFocus) { controls.target.copy(target); camera.position.set(target.x, 9, target.z + 9); firstFocus = false }
          else controls.target.lerp(target, Math.min(1, step * 4))
        }
      }
      controls.update()
      st.fx.render()
      labels.render(scene, camera)
    })

    return () => {
      renderer.setAnimationLoop(null)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controls.dispose()
      sceneRef.current?.fx.dispose()
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
  const sceneKey = JSON.stringify([rows, props, desks.map(d => [d.desk.x, d.desk.y, d.desk.rot, d.desk.style]), items])
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
    const boxes = (items: { x: number; z: number; w: number; d: number; h: number; y?: number; color: string }[], cast = true, rounded = false, roughness = 0.75) => {
      if (!items.length) return null
      const geo = rounded ? new RoundedBoxGeometry(1, 1, 1, 2, 0.12) : new THREE.BoxGeometry(1, 1, 1)
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness, metalness: 0 }), items.length)
      items.forEach((it, i) => {
        dummy.position.set(it.x, (it.y ?? 0) + it.h / 2, it.z); dummy.scale.set(it.w, it.h, it.d); dummy.rotation.set(0, 0, 0); dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(it.color))
      })
      mesh.castShadow = cast; mesh.receiveShadow = true
      world.add(mesh); return mesh
    }

    st.ticks = []
    // พื้น (คลิกเดินได้) — แยกตามวัสดุ: ไม้ปาร์เก้ พรม กระเบื้อง หญ้า ทางหิน น้ำ ...
    const groupsByTex = new Map<string, { x: number; y: number; ch: string }[]>()
    // บ่อน้ำตกลึกลงใต้พื้น — เว้นพื้นตรงแถวบ่อ (ชิ้นน้ำตกวาดขอบหญ้าเจาะรูเอง)
    const pondHole = new Set<string>()
    for (const p of props) if (p.kind === 'waterfall') { const d = propDef(p.kind); if (d) for (let yy = 2; yy < d.h; yy++) for (let xx = 0; xx < d.w; xx++) pondHole.add(`${p.x + xx},${p.y + yy}`) }
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (pondHole.has(`${x},${y}`)) return
      // ช่องต้นไม้/ของ ใช้พื้นของช่องข้าง ๆ (สวน = หญ้า · ในอาคาร = ไม้)
      const base = isPlant(ch) ? (rows[y + 1]?.[x] === 'g' || rows[y]?.[x - 1] === 'g' || rows[y]?.[x + 1] === 'g' ? 'g' : '.') : ch === 'T' || ch === 'W' ? 'M' : ch
      const key = floorTexture(base) ? base : '#'
      if (!groupsByTex.has(key)) groupsByTex.set(key, [])
      groupsByTex.get(key)!.push({ x, y, ch: base })
    }))
    st.floors = []
    for (const [key, list] of groupsByTex) {
      const tex = floorTexture(key)
      const water = key === 'w'
      let mat: THREE.MeshStandardMaterial
      if (water && tex) { const wm = waterMaterial(tex); mat = wm.material; st.ticks.push(wm.tick) }
      else mat = new THREE.MeshStandardMaterial({ map: tex ?? undefined, color: tex ? '#ffffff' : (FLOOR[key] ?? FLOOR['.']), roughness: key === 'C' ? 0.35 : key === '.' ? 0.55 : 0.95, metalness: 0 })
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length)
      list.forEach((t, i) => {
        const h = water ? 0.04 : 0.1, y0 = water ? -0.06 : -0.1
        dummy.position.set(t.x + 0.5, y0 + h / 2, t.y + 0.5); dummy.scale.set(1, h, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.receiveShadow = true
      world.add(mesh)
      st.floors.push({ mesh, tiles: list.map(t => ({ x: t.x, y: t.y })) })
    }

    const walls: Parameters<typeof boxes>[0] = [], caps: Parameters<typeof boxes>[0] = [], tables: Parameters<typeof boxes>[0] = [], dark: Parameters<typeof boxes>[0] = []
    const pots: Parameters<typeof boxes>[0] = [], hedges: Parameters<typeof boxes>[0] = [], white: Parameters<typeof boxes>[0] = []
    const foliage: { x: number; z: number; color: string; r: number }[] = []
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      const cx = x + 0.5, cz = y + 0.5
      if (ch === '#') {
        walls.push({ x: cx, z: cz, w: 1, d: 1, h: 1.3, color: '#e3e7ed' })
        caps.push({ x: cx, z: cz, w: 1.04, d: 1.04, h: 0.07, y: 1.3, color: '#64748b' })
        caps.push({ x: cx, z: cz, w: 1.02, d: 1.02, h: 0.1, color: '#9aa4b2' })
      }
      else if (ch === 'T') {
        // เก้าอี้ประชุมด้านบน/ล่างของโต๊ะ (ช่องพื้นที่ไม่ใช่โต๊ะ) — หันเข้าหาโต๊ะ
        const floorAt = (yy: number) => { const c2 = rows[yy]?.[x]; return !!c2 && c2 !== 'T' && c2 !== '#' && FLOOR[c2] !== undefined && c2 !== 'w' }
        if (floorAt(y - 1)) { const c1 = buildMeetingChair(); c1.position.set(cx, 0, cz - 0.95); c1.rotation.y = Math.PI; world.add(c1) }
        if (floorAt(y + 1)) { const c1 = buildMeetingChair(); c1.position.set(cx, 0, cz + 0.95); world.add(c1) }
      }
      if (ch === 'T') tables.push({ x: cx, z: cz, w: 1, d: 1, h: 0.08, y: 0.68, color: '#a16207' }, { x: cx, z: cz, w: 0.12, d: 0.12, h: 0.68, color: '#713f12' })
      else if (ch === 'd') {
        tables.push({ x: cx, z: cz - 0.1, w: 0.95, d: 0.6, h: 0.06, y: 0.7, color: '#c79a63' })
        dark.push({ x: cx, z: cz - 0.3, w: 0.5, d: 0.04, h: 0.32, y: 0.8, color: '#1e293b' })
        dark.push({ x: cx, z: cz + 0.35, w: 0.4, d: 0.4, h: 0.45, color: '#334155' })   // เก้าอี้
      }
      else if (ch === 'K') { const cs = buildCoffeeStation(); cs.group.position.set(cx, 0, cz); world.add(cs.group); st.ticks.push(cs.tick) }
      else if (ch === 'W') white.push({ x: cx, z: cz, w: 0.9, d: 0.06, h: 0.7, y: 0.6, color: '#f8fafc' })
      else if (ch === 'h') { const hg = buildHedgeReal(x * 31 + y); hg.position.set(cx, 0, cz); hg.rotation.y = ((x + y) % 4) * Math.PI / 2; world.add(hg) }
      else if (ch === 'f') { const fb = buildFlowerBed3D(x * 13 + y); fb.position.set(cx, 0, cz); world.add(fb) }
      else if (isPlant(ch)) {
        const pl = buildPlantReal(ch) ?? buildPlant3D(ch)
        if (pl) { pl.position.set(cx, 0, cz); pl.rotation.y = (x * 7 + y * 3) % 6; world.add(pl) }
        else { pots.push({ x: cx, z: cz, w: 0.36, d: 0.36, h: 0.32, color: '#b45309' }); foliage.push({ x: cx, z: cz, color: PLANT_COLORS[ch], r: 0.42 }) }
      }
    }))
    boxes(walls, true, false, 0.9); boxes(caps, true, false, 0.6); boxes(tables, true, true, 0.45); boxes(dark, true, true, 0.5); boxes(pots, true, true, 0.8); boxes(hedges, true, true, 0.95); boxes(white, true, false, 0.3)
    // พุ่มไม้/ดอกไม้ = ทรงกลม
    if (foliage.length) {
      const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.7 }), foliage.length)
      foliage.forEach((f, i) => {
        const big = f.r > 0.3
        dummy.position.set(f.x, big ? 0.32 + f.r : 0.12, f.z); dummy.scale.setScalar(f.r); dummy.rotation.set(0, (f.x * 7 + f.z) % 3, 0); dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(f.color))
      })
      mesh.castShadow = true; world.add(mesh)
    }

    // สิ่งของชิ้นใหญ่ (เฟส 2) — โมเดลการ์ตูนต่อชนิด · ชิ้นที่ขยับได้ลงทะเบียน tick
    for (const p of props) {
      const def = propDef(p.kind)
      if (!def) continue
      const b = buildProp3D(p.kind, def.w, def.h)
      b.group.position.set(p.x, 0, p.y)
      world.add(b.group)
      if (b.tick) st.ticks.push(b.tick)
    }

    // ของแต่งโต๊ะ (บนโต๊ะ = ยกขึ้นไปบนหน้าโต๊ะ) — ขยับได้บางชิ้น (ลูกโลกหมุน ปลาว่าย แมวหายใจ)
    for (const it of items) {
      const b = buildDecor3D(it.kind)
      b.group.position.set(it.x + 0.5, it.onDesk ? 0.77 : 0, it.y + 0.5)
      b.group.rotation.y = -(it.rot * Math.PI) / 180
      if (it.flip) b.group.scale.x = -1
      world.add(b.group)
      if (b.tick) st.ticks.push(b.tick)
    }
    // นก 5 ตัวบนหญ้า (ตำแหน่งตรงกับมุมมอง 2D)
    for (const b of st.birds) st.scene.remove(b.rig.group)
    const blocked = new Set<string>()
    for (const p of props) {
      const d = propDef(p.kind)
      if (d) for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) if ((d.mask?.[dy]?.[dx] ?? 'X') === 'X') blocked.add(`${p.x + dx},${p.y + dy}`)
    }
    st.birds = birdHomes(rows, blocked).map((home, i) => {
      const rig = buildBird3D(); rig.group.position.set(home.fx, 0, home.fz); st.scene.add(rig.group)
      return { rig, home, i, away: 0 }
    })
    // ไฟกลางคืน: โคมไฟสวน + โคมไฟตั้งพื้น/ตั้งโต๊ะ (ไม่เกิน 8 ดวง)
    st.nightLights = []
    st.lightKey = ''
    const lampSpots: { x: number; y: number; z: number; color: string }[] = []
    for (const p of props) if (p.kind === 'gardenlamp') lampSpots.push({ x: p.x + 0.5, y: 1.6, z: p.y + 0.5, color: '#ffd38a' })
    for (const it of items) if (it.kind === 'floorlamp' || it.kind === 'lamp') lampSpots.push({ x: it.x + 0.5, y: it.kind === 'lamp' ? 1.1 : 1.45, z: it.y + 0.5, color: '#ffe0a8' })
    for (const sp of lampSpots.slice(0, 8)) {
      const l = new THREE.PointLight(sp.color, 0, 5.5, 1.6); l.position.set(sp.x, sp.y, sp.z); world.add(l); st.nightLights.push(l)
    }
    // หญ้าพลิ้วลม (ช่องหญ้าที่ไม่มีของวางทับ)
    const grassTiles: { x: number; y: number }[] = []
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'g' && !blocked.has(`${x},${y}`)) grassTiles.push({ x, y }) }))
    const grass = buildGrass(grassTiles)
    if (grass) { world.add(grass.mesh); st.ticks.push(grass.tick) }
    // ต้นไม้ล้อมตึก + เมฆลอย
    world.add(buildTreeRing(W, H))
    const clouds = buildClouds(W / 2, H / 2)
    world.add(clouds.group); st.ticks.push(clouds.tick)
    // โต๊ะส่วนตัว 9 แบบ (ตามที่แต่ละคนเลือก) — หมุนตามทิศโต๊ะ
    for (const { desk } of desks) {
      const d3 = buildDesk3D(desk.style)
      d3.group.position.set(desk.x + 0.5, 0, desk.y + 0.5)
      d3.group.rotation.y = -(desk.rot * Math.PI) / 180
      world.add(d3.group)
      if (d3.tick) st.ticks.push(d3.tick)
    }

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
    <div className="relative w-full h-full">
      <div ref={hostRef} tabIndex={0} onFocus={() => onFocusChange(true)} onBlur={() => onFocusChange(false)}
        className="relative w-full h-full outline-none rounded-2xl overflow-hidden" />
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 text-[11px]">
        <button onClick={() => pickQuality(quality === 'ultra' ? 'balanced' : 'ultra')}
          title="คุณภาพภาพ — สูงสุด: เงาตามซอกมุม ความละเอียดเต็ม · สมดุล: เบากว่า สำหรับเครื่องทั่วไป"
          className="px-2 py-1 rounded-lg bg-white/90 dark:bg-gray-900/90 shadow border border-gray-200 dark:border-gray-700">
          {quality === 'ultra' ? '✨ คุณภาพสูงสุด' : '⚖️ สมดุล'}
        </button>
        {notice && <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 shadow">{notice}</span>}
      </div>
    </div>
  )
}
