import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildGrass, buildStepStones } from '../src/components/team/environment3d'
import { floorTexture } from '../src/components/team/textures3d'

// หญ้า + ทางเดินแผ่นหิน 8×6 ช่อง (คอลัมน์ 3–4 = ทางเดิน)
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(innerWidth, innerHeight); r.shadowMap.enabled = true; r.toneMapping = THREE.ACESFilmicToneMapping; document.body.appendChild(r.domElement)
const scene = new THREE.Scene(); scene.background = new THREE.Color('#cfe6fb')
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 100); cam.position.set(4, 4.5, 8.5)
const ctl = new OrbitControls(cam, r.domElement); ctl.target.set(4, 0, 3)
scene.add(new THREE.HemisphereLight('#eaf4ff', '#b8a68a', 0.9)); const sun = new THREE.DirectionalLight('#fff4e0', 2.3); sun.position.set(-6, 10, 8); sun.castShadow = true; sun.shadow.camera.left = -10; sun.shadow.camera.right = 10; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10; scene.add(sun)
const grassT: { x: number; y: number }[] = [], pathT: { x: number; y: number }[] = []
for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
  const p = x === 3 || x === 4
  ;(p ? pathT : grassT).push({ x, y })
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), new THREE.MeshStandardMaterial({ map: floorTexture(p ? 'p' : 'g')!, roughness: 0.95 })); m.position.set(x + 0.5, -0.05, y + 0.5); m.receiveShadow = true; scene.add(m)
}
const gr = buildGrass(grassT)!; scene.add(gr.mesh); scene.add(buildStepStones(pathT)!)
r.setAnimationLoop(t => { gr.tick(t / 1000); ctl.update(); r.render(scene, cam) })
