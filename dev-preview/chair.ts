import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildDecor3D } from '../src/components/team/decor3d'

// ปลาคาร์ฟ 5 สายพันธุ์ ระยะใกล้ (ดูจากมุมสูงเหมือนกล้องออฟฟิศ)
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(innerWidth, innerHeight); r.toneMapping = THREE.ACESFilmicToneMapping; document.body.appendChild(r.domElement)
const scene = new THREE.Scene(); scene.background = new THREE.Color('#3f7f99')
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.01, 50); cam.position.set(0, 2.2, 1.6)
const ctl = new OrbitControls(cam, r.domElement); ctl.target.set(0, 0, 0)
scene.add(new THREE.HemisphereLight('#eaf4ff', '#557', 1)); const sun = new THREE.DirectionalLight('#fff', 2); sun.position.set(2, 5, 3); scene.add(sun)
const ch = buildDecor3D('guestchair'); ch.group.scale.setScalar(2); scene.add(ch.group); const ducks: never[] = []; void ducks; cam.position.set(1.6, 1.8, 2.2); ctl.target.set(0, 0.6, 0)
r.setAnimationLoop(() => { ctl.update(); r.render(scene, cam) })
