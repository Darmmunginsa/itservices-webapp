// แจ้งเตือนข้อความใหม่ในออฟฟิศ — ป้ายเด้งบนเดสก์ท็อป (Notification) + เสียงเตือน
//
// เดิมมีแค่ Notification และปุ่มกระดิ่งกดได้เฉพาะตอนยังไม่เคยตอบเบราว์เซอร์
// อนุญาตแล้ว = ปุ่มเขียวกดไม่ได้ (ปิดไม่ได้) · ถูกบล็อก = ปุ่มเทากดไม่ได้ (ไม่มีทางรู้วิธีแก้)
// ตอนนี้: ตั้งค่าเปิด/ปิดได้เองทั้งสองอย่าง จำไว้ในเครื่อง · เสียงเตือนใช้ได้แม้เบราว์เซอร์บล็อก Notification

export interface AlertSettings { desktop: boolean; sound: boolean }

const KEY = 'hd-office-alerts'
export const DEFAULT_ALERTS: AlertSettings = { desktop: true, sound: true }

/** อ่านค่าที่เก็บไว้แบบไม่เชื่อ — ค่าเสีย/ไม่มี = ค่าเริ่มต้น (เปิดทั้งคู่) */
export function parseAlertSettings(raw: string | null): AlertSettings {
  try {
    const j = JSON.parse(raw || '{}') as Partial<AlertSettings>
    return {
      desktop: typeof j.desktop === 'boolean' ? j.desktop : DEFAULT_ALERTS.desktop,
      sound: typeof j.sound === 'boolean' ? j.sound : DEFAULT_ALERTS.sound,
    }
  } catch { return { ...DEFAULT_ALERTS } }
}

export function loadAlertSettings(): AlertSettings {
  try { return parseAlertSettings(localStorage.getItem(KEY)) } catch { return { ...DEFAULT_ALERTS } }
}

export function saveAlertSettings(s: AlertSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* โหมดส่วนตัว — แค่ไม่จำ */ }
}

export type DesktopPerm = NotificationPermission | 'unsupported'
export const desktopPerm = (): DesktopPerm => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/** ป้ายสถานะของกระดิ่ง — ใช้กำหนดสีและคำอธิบาย */
export function bellState(s: AlertSettings, perm: DesktopPerm): 'on' | 'sound-only' | 'off' {
  const desktopWorks = s.desktop && perm === 'granted'
  if (desktopWorks) return 'on'
  if (s.sound) return 'sound-only'
  return 'off'
}

let ctx: AudioContext | null = null
/** เสียง "ติ๊ง-ต่อง" สั้น ๆ — สร้างเองด้วย WebAudio ไม่ต้องมีไฟล์เสียง */
export function chime(): void {
  try {
    ctx = ctx ?? new AudioContext()
    const t = ctx.currentTime
    for (const [freq, at] of [[880, 0], [1320, 0.12]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.setValueAtTime(0.0001, t + at)
      g.gain.exponentialRampToValueAtTime(0.18, t + at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.35)
      o.connect(g).connect(ctx.destination)
      o.start(t + at); o.stop(t + at + 0.4)
    }
  } catch { /* ไม่มีเสียงก็ไม่เป็นไร */ }
}

/** มีของใหม่ — เตือนตามที่ตั้งไว้ */
export function notifyNew(title: string, body: string, tag: string): void {
  const s = loadAlertSettings()
  if (s.sound) chime()
  if (s.desktop && desktopPerm() === 'granted') {
    try { new Notification(title, { body: body.slice(0, 120), tag }).onclick = () => window.focus() } catch { /* บางเบราว์เซอร์ไม่ให้สร้างจาก tab */ }
  }
}
