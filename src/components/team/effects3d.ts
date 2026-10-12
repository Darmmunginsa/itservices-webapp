import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

// ── เอฟเฟกต์ภาพหลังเรนเดอร์ (มุมมอง 3D แบบเต็มความสามารถ) ──
//   • GTAO  = เงาตามซอก/มุม/ใต้โต๊ะ (ทำให้ของ "วาง" อยู่บนพื้นจริง ไม่ลอย)
//   • Bloom = แสงเรืองจากจอ โคมไฟ ป้ายไฟ ไฟ RGB
//   • SMAA  = ขอบเนียนไม่เป็นฟันเลื่อย
// คุณภาพ 2 ระดับ: 'ultra' (ทุกอย่าง) · 'balanced' (ปิด AO ลดความละเอียด) — เครื่องกระตุกจะถูกลดเป็น balanced เอง

export type Quality = 'ultra' | 'balanced'

export interface Effects {
  composer: EffectComposer
  setQuality: (q: Quality) => void
  setSize: (w: number, h: number) => void
  /** กลางคืนแสงเรืองชัดขึ้น */
  setNight: (night: number) => void
  render: () => void
  dispose: () => void
}

export function createEffects(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, quality: Quality): Effects {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const gtao = new GTAOPass(scene, camera, 1, 1)
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 })
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 })
  gtao.blendIntensity = 0.85
  composer.addPass(gtao)
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.4, 0.92)
  composer.addPass(bloom)
  const smaa = new SMAAPass()
  composer.addPass(smaa)
  composer.addPass(new OutputPass())

  let q = quality
  let size = { w: 1, h: 1 }
  const apply = () => {
    const ultra = q === 'ultra'
    gtao.enabled = ultra
    smaa.enabled = true
    renderer.setPixelRatio(ultra ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1))
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(size.w, size.h)
  }
  apply()
  return {
    composer,
    setQuality: (nq) => { q = nq; apply() },
    setSize: (w, h) => { size = { w, h }; composer.setSize(w, h); gtao.setSize(w, h); bloom.setSize(w, h) },
    // เรืองเฉพาะของที่สว่างจริง (จอ โคมไฟ ป้ายไฟ) — ไม่ให้ผนังขาว/พื้นเรืองตาม
    setNight: (n) => { bloom.strength = 0.22 + n * 0.25; bloom.threshold = 0.92 - n * 0.1 },
    render: () => composer.render(),
    dispose: () => { composer.passes.forEach(p => (p as { dispose?: () => void }).dispose?.()); composer.dispose() },
  }
}

/** ตัววัดความลื่น — เฉลี่ย FPS ช่วง 6 วิ · ต่ำกว่าเกณฑ์ = เครื่องไม่ไหว */
export function fpsWatch(onSlow: () => void, min = 22) {
  let frames = 0, since = performance.now(), slowStreak = 0
  return () => {
    frames++
    const now = performance.now()
    if (now - since < 6000) return
    const fps = (frames * 1000) / (now - since)
    frames = 0; since = now
    slowStreak = fps < min ? slowStreak + 1 : 0
    if (slowStreak >= 2) { slowStreak = 0; onSlow() }
  }
}
