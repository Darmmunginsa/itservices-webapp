import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { buildPet3D, animatePet } from '../src/components/team/pets3d'
import type { PetMode } from '../src/utils/officePets'

// หมา แมว กระต่าย × ท่า เดิน / ยืน / นั่ง / นอน
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(innerWidth, innerHeight); r.toneMapping = THREE.ACESFilmicToneMapping; document.body.appendChild(r.domElement)
const scene = new THREE.Scene(); scene.background = new THREE.Color('#e9dcc6')
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 50); cam.position.set(1.5, new URLSearchParams(location.search).has("side") ? 0.9 : 2.6, new URLSearchParams(location.search).has("side") ? 4 : 3.6)
const ctl = new OrbitControls(cam, r.domElement); ctl.target.set(1.5, 0.2, 1)
scene.add(new THREE.HemisphereLight('#fff', '#a98', 1)); const sun = new THREE.DirectionalLight('#fff', 2); sun.position.set(2, 5, 3); scene.add(sun)
const modes: PetMode[] = ['walk', 'idle', 'sit', 'sleep']
const only = new URLSearchParams(location.search).get('kind'); const rigs = (['dog', 'cat', 'rabbit'] as const).filter(k => !only || k === only).flatMap((k, i) => modes.map((m, j) => { const p = buildPet3D(k); p.group.position.set(j * 1, 0, i * 0.8); p.group.rotation.y = new URLSearchParams(location.search).has("side") ? 0 : -0.6; scene.add(p.group); return { p, m } }))
r.setAnimationLoop(t => { rigs.forEach(({ p, m }, i) => animatePet(p, m, t / 1000, i)); ctl.update(); r.render(scene, cam) })
