// ── เสียงเตือนนุ่ม ๆ (มีคนขอคุยด้วยเสียง) — กระดิ่งใสสองโน้ต เบา ไม่แหลม ไม่ยาว ──
// สังเคราะห์ด้วย WebAudio (ไม่มีไฟล์เสียง) · ใช้ AudioContext ตัวเดียวทั้งหน้า

let ctx: AudioContext | null = null

export function playSoftChime(volume = 0.09) {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime + 0.02
    const out = ctx.createGain(); out.gain.value = volume; out.connect(ctx.destination)
    // E5 → A5 · แต่ละโน้ต = เสียงหลัก + ฮาร์มอนิกบาง ๆ ให้เหมือนกระดิ่งแก้ว · ค่อย ๆ จางใน ~1.2 วิ
    for (const [freq, at] of [[659.25, 0], [880, 0.18]] as const) {
      for (const [mul, amp] of [[1, 1], [2.76, 0.18], [5.4, 0.06]] as const) {
        const o = ctx.createOscillator(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = freq * mul
        g.gain.setValueAtTime(0, t0 + at)
        g.gain.linearRampToValueAtTime(amp, t0 + at + 0.012)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 1.2)
        o.connect(g).connect(out); o.start(t0 + at); o.stop(t0 + at + 1.25)
      }
    }
  } catch { /* เบราว์เซอร์ไม่ให้เล่นเสียง (ยังไม่เคยคลิกหน้า) — ข้าม */ }
}
