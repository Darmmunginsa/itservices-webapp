// ตัวสร้างเสียงผ่อนคลาย (WebAudio) — Ambient / ฝน / ป่าและลำธาร
// ทุกอย่างสร้างสด: oscillator + noise + filter + reverb ที่สังเคราะห์เอง ไม่มีไฟล์เสียง

import { chordHz, CHIME_HZ, DEFAULT_MIX, type GardenLayer, type GardenMix, type MusicPreset } from '../utils/focusMusic'

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]

class AmbientPlayer {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bus: GainNode | null = null          // ก่อนเข้า reverb/master
  /** ความดังของเสียงน้ำในสวน — ปรับตามระยะถึงน้ำตก/น้ำพุ */
  private water: GainNode | null = null
  /** ตัวคุมความดังแต่ละเสียงในสวน (ผู้ใช้ปรับเอง) */
  private layers: Partial<Record<GardenLayer, GainNode>> = {}
  private mix: GardenMix = { ...DEFAULT_MIX }
  private stopFns: (() => void)[] = []
  private timers: number[] = []
  private preset: MusicPreset | null = null
  /** รอบการเล่น — เดินออกแล้วกลับเข้าห้องภายใน 2 วิ ต้องยกเลิกคำสั่งหยุดที่ค้างอยู่ ไม่ให้ตัดเพลงที่เพิ่งเริ่มใหม่ */
  private gen = 0

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    const master = ctx.createGain(); master.gain.value = 0
    // reverb สังเคราะห์: noise ที่ค่อย ๆ จางใน 3 วิ — ให้เสียงฟุ้ง มีพื้นที่
    const len = ctx.sampleRate * 3
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
    }
    const verb = ctx.createConvolver(); verb.buffer = ir
    const wet = ctx.createGain(); wet.gain.value = 0.45
    const dry = ctx.createGain(); dry.gain.value = 0.7
    const bus = ctx.createGain()
    bus.connect(dry).connect(master)
    bus.connect(verb).connect(wet).connect(master)
    master.connect(ctx.destination)
    this.ctx = ctx; this.master = master; this.bus = bus
    // เบราว์เซอร์ไม่ให้เล่นเสียงก่อนผู้ใช้แตะหน้า — ปลุกเมื่อมีการแตะ/กดครั้งแรก
    const wake = () => { ctx.resume().catch(() => {}); window.removeEventListener('pointerdown', wake); window.removeEventListener('keydown', wake) }
    window.addEventListener('pointerdown', wake); window.addEventListener('keydown', wake)
    return ctx
  }

  private noise(kind: 'white' | 'brown'): AudioBufferSourceNode {
    const ctx = this.ctx!
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'white') d[i] = w
      else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5 }
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    return src
  }

  private every(minMs: number, maxMs: number, fn: () => void) {
    const tick = () => { fn(); this.timers.push(window.setTimeout(tick, rand(minMs, maxMs))) }
    this.timers.push(window.setTimeout(tick, rand(minMs, maxMs)))
  }

  /** โน้ตนุ่ม ๆ: เข้าช้า ออกช้า ผ่าน lowpass */
  private pad(freq: number, at: number, dur: number, gain: number) {
    const ctx = this.ctx!
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(gain, at + 2.2)
    g.gain.setValueAtTime(gain, at + dur - 3)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    for (const [type, det] of [['sine', 0], ['triangle', 6]] as const) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det
      o.connect(lp); o.start(at); o.stop(at + dur + 0.1)
    }
    lp.connect(g).connect(this.bus!)
  }

  private bell(freq: number, gain = 0.05) {
    const ctx = this.ctx!, t = ctx.currentTime
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5)
    o.connect(g).connect(this.bus!); o.start(t); o.stop(t + 3.6)
  }

  private buildAmbient() {
    const ctx = this.ctx!
    let i = 0
    const chord = () => {
      const at = ctx.currentTime + 0.05
      chordHz(i++).forEach((f, n) => this.pad(f, at + n * 0.15, 10, n === 0 ? 0.05 : 0.032))
    }
    chord()
    this.timers.push(window.setInterval(chord, 8000))
    this.every(2200, 5200, () => this.bell(pick(CHIME_HZ), rand(0.025, 0.05)))
  }

  private buildRain() {
    const ctx = this.ctx!
    const src = this.noise('white')
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5500
    const g = ctx.createGain(); g.gain.value = 0.22
    src.connect(hp).connect(lp).connect(g).connect(this.bus!); src.start()
    this.stopFns.push(() => src.stop())
    // ฝนหนักเบาเป็นระลอก
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.06
    lfo.connect(lfoG).connect(g.gain); lfo.start()
    this.stopFns.push(() => lfo.stop())
    // หยดน้ำ
    this.every(60, 260, () => {
      const t = ctx.currentTime
      const d = this.noise('white')
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(1800, 5000); bp.Q.value = 8
      const dg = ctx.createGain(); dg.gain.setValueAtTime(rand(0.04, 0.12), t); dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
      d.connect(bp).connect(dg).connect(this.bus!); d.start(t); d.stop(t + 0.08)
    })
  }

  private buildForest() {
    const ctx = this.ctx!
    // ลำธาร: brown noise + bandpass ที่ส่ายไปมา = น้ำไหลกระทบหิน
    const src = this.noise('brown')
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7
    // brown noise ผ่าน bandpass เหลือพลังงานน้อย — ต้องขยายมากกว่าฝน ไม่งั้นเบากว่าแบบอื่น 3–4 เท่า (วัดจริงแล้ว)
    const g = ctx.createGain(); g.gain.value = 1.15
    src.connect(bp).connect(g).connect(this.bus!); src.start()
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15
    const lfoG = ctx.createGain(); lfoG.gain.value = 260
    lfo.connect(lfoG).connect(bp.frequency); lfo.start()
    this.stopFns.push(() => src.stop(), () => lfo.stop())
    // นก: ร้องเป็นชุด 2–5 ครั้ง เสียงกวาดขึ้น-ลง แต่ละชุดคนละตัว (คนละระดับเสียง)
    this.every(2800, 7500, () => {
      const base = rand(2200, 3800), n = Math.floor(rand(2, 6)), up = Math.random() < 0.5
      for (let k = 0; k < n; k++) {
        const t = ctx.currentTime + k * rand(0.13, 0.22)
        const o = ctx.createOscillator(); o.type = 'sine'
        o.frequency.setValueAtTime(base * (up ? 0.85 : 1.2), t)
        o.frequency.exponentialRampToValueAtTime(base * (up ? 1.25 : 0.8), t + 0.09)
        const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t)
        og.gain.exponentialRampToValueAtTime(0.07, t + 0.015); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
        const pan = ctx.createStereoPanner(); pan.pan.value = rand(-0.8, 0.8)
        o.connect(og).connect(pan).connect(this.bus!); o.start(t); o.stop(t + 0.13)
      }
    })
    // ใบไม้ไหวเบา ๆ เป็นพื้นหลัง
    const leaves = this.noise('white')
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000
    const lg = ctx.createGain(); lg.gain.value = 0.025
    leaves.connect(hp).connect(lg).connect(this.bus!); leaves.start()
    this.stopFns.push(() => leaves.stop())
  }

  /** เป็ด "แก๊บ แก๊บ" — sawtooth ผ่าน bandpass สองตัวเลียนเสียงจมูก */
  private quack() {
    const ctx = this.ctx!
    const n = Math.floor(rand(2, 4))
    for (let k = 0; k < n; k++) {
      const t = ctx.currentTime + k * rand(0.18, 0.26)
      const o = ctx.createOscillator(); o.type = 'sawtooth'
      o.frequency.setValueAtTime(rand(520, 600), t); o.frequency.exponentialRampToValueAtTime(rand(330, 380), t + 0.12)
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1100; f1.Q.value = 4
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2600; f2.Q.value = 6
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
      const pan = ctx.createStereoPanner(); pan.pan.value = rand(-0.5, 0.5)
      o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(pan).connect(this.layers.ducks ?? this.bus!)
      o.start(t); o.stop(t + 0.17)
    }
  }

  private layer(k: GardenLayer): GainNode {
    const g = this.ctx!.createGain(); g.gain.value = this.mix[k]
    g.connect(this.bus!); this.layers[k] = g
    return g
  }

  private buildGarden() {
    const ctx = this.ctx!
    const L = { falls: this.layer('falls'), stream: this.layer('stream'), wind: this.layer('wind'), birds: this.layer('birds') }
    this.layer('ducks')
    // น้ำตก: white noise ช่วงกลาง-สูง (น้ำกระแทก) + brown noise ต่ำ (มวลน้ำ) ผ่านตัวคุมระดับตามระยะ
    const water = ctx.createGain(); water.gain.value = 0.6
    const splash = this.noise('white')
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.5
    // ปรับจากการวัดจริง: ข้างน้ำตก (ระดับน้ำเต็ม) ค่ายอด ~0.1 เท่ากับเพลงห้องโฟกัส
    const sg = ctx.createGain(); sg.gain.value = 0.3
    splash.connect(bp).connect(sg).connect(water)
    const mass = this.noise('brown')
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
    const mg = ctx.createGain(); mg.gain.value = 1.4
    mass.connect(lp).connect(mg).connect(water)
    water.connect(L.falls)
    splash.start(); mass.start()
    this.water = water
    // ลมพัดใบไม้เป็นระลอก
    const wind = this.noise('white')
    const whp = ctx.createBiquadFilter(); whp.type = 'bandpass'; whp.frequency.value = 2500; whp.Q.value = 0.4
    const wg = ctx.createGain(); wg.gain.value = 0.02
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.018
    lfo.connect(lfoG).connect(wg.gain)
    wind.connect(whp).connect(wg).connect(L.wind); wind.start(); lfo.start()
    // ลำธารน้ำไหล: เสียงซ่าต่ำ-กลางที่ความถี่ส่ายช้า ๆ + ฟองน้ำ "จุ๋ม" สั้น ๆ ถี่ ๆ (ไม่ขึ้นกับระยะ)
    const brook = this.noise('brown')
    const bbp = ctx.createBiquadFilter(); bbp.type = 'bandpass'; bbp.frequency.value = 800; bbp.Q.value = 0.8
    const blfo = ctx.createOscillator(); blfo.frequency.value = 0.23
    const blfoG = ctx.createGain(); blfoG.gain.value = 250
    blfo.connect(blfoG).connect(bbp.frequency)
    const bg = ctx.createGain(); bg.gain.value = 0.5
    brook.connect(bbp).connect(bg).connect(L.stream); brook.start(); blfo.start()
    this.every(70, 260, () => {
      const t = ctx.currentTime, f = rand(350, 1100), len = rand(0.03, 0.08)
      const o = ctx.createOscillator(); o.type = 'sine'
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * rand(1.4, 2.2), t + len)
      const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t)
      og.gain.exponentialRampToValueAtTime(rand(0.006, 0.018), t + 0.008); og.gain.exponentialRampToValueAtTime(0.0001, t + len)
      const p = ctx.createStereoPanner(); p.pan.value = rand(-0.6, 0.6)
      o.connect(og).connect(p).connect(L.stream); o.start(t); o.stop(t + len + 0.01)
    })
    this.stopFns.push(() => splash.stop(), () => mass.stop(), () => wind.stop(), () => lfo.stop(), () => brook.stop(), () => blfo.stop(),
      () => { this.water = null; this.layers = {} })
    // นกหลายชนิด: ร้องรัว (สูง) · ร้องหวานยาว (กลาง) — ถี่กว่าป่า
    this.every(1600, 4800, () => {
      const kind = Math.random()
      const base = kind < 0.5 ? rand(3000, 4200) : rand(1800, 2600)
      const n = kind < 0.5 ? Math.floor(rand(4, 8)) : Math.floor(rand(2, 4))
      const pan = rand(-0.9, 0.9)
      for (let k = 0; k < n; k++) {
        const t = ctx.currentTime + k * (kind < 0.5 ? rand(0.07, 0.11) : rand(0.22, 0.32))
        const len = kind < 0.5 ? 0.06 : 0.2
        const o = ctx.createOscillator(); o.type = 'sine'
        o.frequency.setValueAtTime(base, t)
        o.frequency.exponentialRampToValueAtTime(base * (k % 2 ? 1.3 : 0.85), t + len)
        const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t)
        og.gain.exponentialRampToValueAtTime(0.06, t + 0.012); og.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.02)
        const p = ctx.createStereoPanner(); p.pan.value = pan
        o.connect(og).connect(p).connect(L.birds); o.start(t); o.stop(t + len + 0.03)
      }
    })
    // เป็ดร้องนาน ๆ ครั้ง
    this.every(9000, 22000, () => this.quack())
  }

  /** เสียงน้ำในสวน 0–1 (เดินเข้าใกล้น้ำตก = ดังขึ้น) */
  setWater(level: number) {
    if (!this.ctx || !this.water) return
    const t = this.ctx.currentTime, g = this.water.gain
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(Math.max(0, Math.min(1, level)), t + 0.8)
  }

  /** ความดังแต่ละเสียงในสวน 0–1 */
  setMix(mix: GardenMix) {
    this.mix = { ...mix }
    if (!this.ctx) return
    const t = this.ctx.currentTime
    for (const [k, g] of Object.entries(this.layers) as [GardenLayer, GainNode][]) {
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(this.mix[k], t + 0.3)
    }
  }

  private teardown() {
    this.timers.forEach(t => { clearTimeout(t); clearInterval(t) })
    this.timers = []
    this.stopFns.forEach(f => { try { f() } catch { /* หยุดไปแล้ว */ } })
    this.stopFns = []
  }

  /** เริ่ม/เปลี่ยนบรรยากาศ — ค่อย ๆ ดังขึ้น 2.5 วิ */
  play(preset: MusicPreset, volume: number) {
    const ctx = this.ensure()
    ctx.resume().catch(() => {})
    this.gen++
    if (this.preset !== preset) {
      this.teardown()
      this.preset = preset
      if (preset === 'garden') this.buildGarden()
      else if (preset === 'ambient') this.buildAmbient()
      else if (preset === 'rain') this.buildRain()
      else this.buildForest()
    }
    const t = ctx.currentTime, g = this.master!.gain
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(volume, t + 2.5)
  }

  setVolume(volume: number) {
    if (!this.ctx || !this.master || !this.preset) return
    const t = this.ctx.currentTime, g = this.master.gain
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(volume, t + 0.6)
  }

  /** ค่อย ๆ เบาลงจนเงียบ 2 วิ แล้วหยุดทุกอย่าง (ไม่กิน CPU ตอนไม่ได้อยู่ห้องโฟกัส) */
  stop() {
    if (!this.ctx || !this.master || !this.preset) return
    const t = this.ctx.currentTime, g = this.master.gain
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 2)
    const g0 = ++this.gen
    this.timers.push(window.setTimeout(() => { if (this.gen === g0) { this.teardown(); this.preset = null } }, 2100))
  }

  get playing(): boolean { return this.preset !== null }
}

/** ตัวเดียวทั้งแอป — ย้ายหน้า/เปิดหน้าต่างใหม่ในแท็บเดียวกันไม่ซ้อนเสียง */
export const ambient = new AmbientPlayer()
