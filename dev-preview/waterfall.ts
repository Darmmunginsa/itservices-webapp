import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildWaterfallReal } from '../src/components/team/waterfall3d'

// ดูน้ำตก+บ่อปลาเดี่ยว ๆ ใกล้ ๆ
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(innerWidth, innerHeight); r.shadowMap.enabled = true
r.toneMapping = THREE.ACESFilmicToneMapping; document.body.appendChild(r.domElement)
const scene = new THREE.Scene(); scene.background = new THREE.Color('#cfe6fb')
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture
const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 100); cam.position.set(4, 3.2, 7.5)
const ctl = new OrbitControls(cam, r.domElement); ctl.target.set(4, 0.6, 2.4)
scene.add(new THREE.HemisphereLight('#eaf4ff', '#b8a68a', 0.9))
const sun = new THREE.DirectionalLight('#fff4e0', 2.3); sun.position.set(-6, 10, 8); sun.castShadow = true; scene.add(sun)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: '#6aa84f' })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.4; ground.receiveShadow = true; scene.add(ground)
const wf = buildWaterfallReal(8); scene.add(wf.group)
r.setAnimationLoop(t => { wf.tick(t / 1000); ctl.update(); r.render(scene, cam) })
