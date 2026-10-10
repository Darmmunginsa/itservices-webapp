// เพลงผ่อนคลายในห้องโฟกัส — ตั้งค่า + ตรรกะที่ทดสอบได้ (ตัวสร้างเสียงอยู่ที่ services/ambientAudio.ts)
//
// ไม่ใช้ไฟล์เพลง: สร้างเสียงสดด้วย WebAudio — ไม่มีลิขสิทธิ์ ไม่เพิ่มขนาดเว็บ ไม่ต้องโหลดอะไร

export type MusicPreset = 'ambient' | 'rain' | 'forest' | 'garden'

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

// ── เสียงธรรมชาติในสวน (โซน garden) — ตั้งค่าแยกจากห้องโฟกัส ──
export type GardenLayer = 'falls' | 'stream' | 'wind' | 'birds' | 'ducks'
export type GardenMix = Record<GardenLayer, number>
export const GARDEN_LAYERS: { key: GardenLayer; label: string; icon: string }[] = [
  { key: 'falls',  label: 'น้ำตก',   icon: '💧' },
  { key: 'stream', label: 'น้ำไหล',  icon: '🌊' },
  { key: 'wind',   label: 'ลม',     icon: '🍃' },
  { key: 'birds',  label: 'นก',     icon: '🐦' },
  { key: 'ducks',  label: 'เป็ด',    icon: '🦆' },
]
export const DEFAULT_MIX: GardenMix = { falls: 1, stream: 0.7, wind: 1, birds: 1, ducks: 1 }
export interface GardenSoundSettings { enabled: boolean; volume: number; mix: GardenMix }
export const DEFAULT_GARDEN: GardenSoundSettings = { enabled: true, volume: 0.4, mix: { ...DEFAULT_MIX } }
const okVol = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1
/** อ่านค่าผสมเสียงแต่ละตัว — ค่าที่หาย/ผิดใช้ค่าเริ่มต้นเฉพาะตัวนั้น */
export function parseMix(raw: unknown): GardenMix {
  const j = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<GardenLayer, unknown>>
  const out = { ...DEFAULT_MIX }
  for (const { key } of GARDEN_LAYERS) { const v = j[key]; if (okVol(v)) out[key] = v }
  return out
}
const GKEY = 'hd-garden-sound'

export function parseGardenSettings(raw: string | null): GardenSoundSettings {
  try {
    const j = JSON.parse(raw || '{}') as Partial<GardenSoundSettings>
    return {
      enabled: typeof j.enabled === 'boolean' ? j.enabled : DEFAULT_GARDEN.enabled,
      volume: okVol(j.volume) ? j.volume : DEFAULT_GARDEN.volume,
      mix: parseMix(j.mix),
    }
  } catch { return { ...DEFAULT_GARDEN, mix: { ...DEFAULT_MIX } } }
}
export function loadGardenSettings(): GardenSoundSettings {
  try { return parseGardenSettings(localStorage.getItem(GKEY)) } catch { return parseGardenSettings(null) }
}
export function saveGardenSettings(s: GardenSoundSettings): void {
  try { localStorage.setItem(GKEY, JSON.stringify(s)) } catch { /* แค่ไม่จำ */ }
}

/** เล่นอะไรตามโซนที่ยืนอยู่ — ห้องโฟกัส = เพลงที่เลือก · สวน = เสียงธรรมชาติ · ที่อื่น = เงียบ */
export function soundFor(zone: string, focus: MusicSettings, garden: GardenSoundSettings): { preset: MusicPreset; volume: number } | null {
  if (zone === 'focus' && focus.enabled && focus.volume > 0) return { preset: focus.preset, volume: focus.volume }
  if (zone === 'garden' && garden.enabled && garden.volume > 0) return { preset: 'garden', volume: garden.volume }
  return null
}

/**
 * ความดังของเสียงน้ำ 0.2–1 ตามระยะถึงแหล่งน้ำที่ใกล้ที่สุด (น้ำตก/น้ำพุ — วัดจากขอบชิ้นที่ใกล้ที่สุด)
 * ยืนติดน้ำตก = ดังเต็ม · ห่าง 12 ช่องขึ้นไป = เหลือเสียงน้ำแผ่ว ๆ เป็นพื้นหลัง
 */
export function waterLevel(me: { x: number; y: number }, sources: { x: number; y: number; w: number; h: number }[]): number {
  if (!sources.length) return 0.2
  const d = Math.min(...sources.map(s => {
    const dx = Math.max(s.x - me.x, 0, me.x - (s.x + s.w - 1))
    const dy = Math.max(s.y - me.y, 0, me.y - (s.y + s.h - 1))
    return Math.hypot(dx, dy)
  }))
  return Math.max(0.2, Math.min(1, 1 - (d - 1) / 11))
}

// ── ผูกค่าเสียงกับบัญชี (เก็บบน SharePoint) ──
export interface SoundProfile { focus: MusicSettings; garden: GardenSoundSettings }
export const serializeSound = (p: SoundProfile): string => JSON.stringify({ v: 1, focus: p.focus, garden: p.garden })
/** อ่านค่าจากบัญชี — ข้อมูลเสีย = null (ใช้ค่าในเครื่องต่อ) · ฟิลด์ที่ผิดใช้ค่าเริ่มต้นเฉพาะตัวนั้น */
export function parseSound(raw: string | null | undefined): SoundProfile | null {
  try {
    const j = JSON.parse(raw || '') as { focus?: unknown; garden?: unknown }
    if (!j || typeof j !== 'object' || (!j.focus && !j.garden)) return null
    return { focus: parseMusicSettings(JSON.stringify(j.focus ?? {})), garden: parseGardenSettings(JSON.stringify(j.garden ?? {})) }
  } catch { return null }
}
