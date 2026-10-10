// เพลงผ่อนคลายในห้องโฟกัส — ตั้งค่า + ตรรกะที่ทดสอบได้ (ตัวสร้างเสียงอยู่ที่ services/ambientAudio.ts)
//
// ไม่ใช้ไฟล์เพลง: สร้างเสียงสดด้วย WebAudio — ไม่มีลิขสิทธิ์ ไม่เพิ่มขนาดเว็บ ไม่ต้องโหลดอะไร

export type MusicPreset = 'ambient' | 'rain' | 'forest'

export const PRESETS: { key: MusicPreset; label: string; icon: string; hint: string }[] = [
  { key: 'ambient', label: 'Ambient',     icon: '🎹', hint: 'คอร์ดนุ่ม ๆ ค่อย ๆ เปลี่ยน กับกระดิ่งเบา ๆ' },
  { key: 'rain',    label: 'ฝนตก',        icon: '🌧️', hint: 'ฝนพรำ หยดน้ำกระทบ' },
  { key: 'forest',  label: 'ป่าและลำธาร', icon: '🌿', hint: 'น้ำไหล นกร้องเป็นช่วง ๆ' },
]

export interface MusicSettings { enabled: boolean; preset: MusicPreset; volume: number }
export const DEFAULT_MUSIC: MusicSettings = { enabled: true, preset: 'forest', volume: 0.35 }

const KEY = 'hd-focus-music'
const PRESET_KEYS = new Set(PRESETS.map(p => p.key))

export function parseMusicSettings(raw: string | null): MusicSettings {
  try {
    const j = JSON.parse(raw || '{}') as Partial<MusicSettings>
    return {
      enabled: typeof j.enabled === 'boolean' ? j.enabled : DEFAULT_MUSIC.enabled,
      preset: j.preset && PRESET_KEYS.has(j.preset) ? j.preset : DEFAULT_MUSIC.preset,
      volume: typeof j.volume === 'number' && j.volume >= 0 && j.volume <= 1 ? j.volume : DEFAULT_MUSIC.volume,
    }
  } catch { return { ...DEFAULT_MUSIC } }
}
export function loadMusicSettings(): MusicSettings {
  try { return parseMusicSettings(localStorage.getItem(KEY)) } catch { return { ...DEFAULT_MUSIC } }
}
export function saveMusicSettings(s: MusicSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* แค่ไม่จำ */ }
}

/** เล่นไหม: อยู่ห้องโฟกัส + เปิดไว้ */
export const shouldPlay = (zone: string, s: MusicSettings): boolean => zone === 'focus' && s.enabled && s.volume > 0

/**
 * ความดังจริง — กำลังคุยเสียงกับใครอยู่ = ลดเหลือ 35% (ให้ได้ยินกันชัด ไม่ต้องตะโกนแข่งเพลง)
 * เพลงเล่นในเครื่องเราเท่านั้น ไม่ได้ส่งผ่านไมค์ (ตัดเสียงก้องของเบราว์เซอร์ช่วยอีกชั้น)
 */
export const effectiveVolume = (s: MusicSettings, inCall: boolean): number => (inCall ? s.volume * 0.35 : s.volume)

// ── ดนตรีของ Ambient: คอร์ด Cmaj9 → Am9 → Fmaj9 → G6/9 วนไป (โทนอบอุ่น ไม่มีจุดตึงเครียด) ──
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12)   // MIDI → Hz
export const CHORDS: number[][] = [
  [48, 55, 64, 71, 74],   // C  G  E  B  D
  [45, 52, 60, 67, 71],   // A  E  C  G  B
  [41, 48, 57, 64, 67],   // F  C  A  E  G
  [43, 50, 59, 64, 69],   // G  D  B  E  A
]
export const chordHz = (i: number): number[] => CHORDS[((i % CHORDS.length) + CHORDS.length) % CHORDS.length].map(NOTE)
/** โน้ตกระดิ่ง — เพนทาโทนิก C (เข้ากับทุกคอร์ดในชุด ไม่มีโน้ตเพี้ยน) */
export const CHIME_HZ = [72, 74, 76, 79, 81, 84, 86, 88].map(NOTE)
