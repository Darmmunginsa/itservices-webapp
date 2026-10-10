// ตัวละครของแต่ละคนในออฟฟิศ 2D (แบบ Gather) — แต่งเองได้: ผิว ทรงผม สีผม หน้า เสื้อ กางเกง รองเท้า ของประดับ
// เก็บในคอลัมน์ Avatar ของ HD_OfficeDecor (1 แถว/คน) · ยังไม่แต่ง = ได้ตัวละครสุ่มจากอีเมล (ทุกคนไม่ซ้ำกัน และเห็นตรงกันทุกเครื่อง)

export const SKINS = ['#fde7d6', '#f8d5b8', '#eebf94', '#d79f6e', '#b07a4f', '#7c4f31']
export const HAIR_COLORS = ['#1f1b1a', '#3b2a20', '#6b4423', '#a0652f', '#d6a35a', '#f2d48c', '#c0392b', '#e68aa8', '#6c5ce7', '#3d8bfd', '#9ca3af', '#f5f5f4']
export const CLOTH_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#f8fafc', '#94a3b8', '#334155', '#111827', '#7c2d12', '#065f46']

export const HAIRS = [
  { key: 'short', label: 'สั้นเรียบ' }, { key: 'spiky', label: 'ตั้งชี้' }, { key: 'side', label: 'แสกข้าง' },
  { key: 'bob', label: 'บ๊อบ' }, { key: 'long', label: 'ยาวตรง' }, { key: 'pony', label: 'หางม้า' },
  { key: 'bun', label: 'มวยจุก' }, { key: 'curly', label: 'หยิกฟู' }, { key: 'twin', label: 'แกละสองข้าง' },
  { key: 'mohawk', label: 'โมฮอว์ก' }, { key: 'bald', label: 'โล้น' },
] as const
export const FACES = [
  { key: 'smile', label: 'ยิ้ม' }, { key: 'grin', label: 'ยิ้มกว้าง' }, { key: 'calm', label: 'นิ่ง ๆ' },
  { key: 'wink', label: 'ขยิบตา' }, { key: 'cat', label: 'ปากแมว' }, { key: 'cool', label: 'มั่นใจ' },
] as const
export const TOPS = [
  { key: 'tee', label: 'เสื้อยืด' }, { key: 'hoodie', label: 'ฮู้ด' }, { key: 'shirt', label: 'เชิ้ต' },
  { key: 'suit', label: 'สูท + เนคไท' }, { key: 'polo', label: 'โปโลบริษัท' }, { key: 'stripe', label: 'ลายขวาง' },
  { key: 'dress', label: 'เดรส' }, { key: 'lab', label: 'เสื้อกาวน์' },
] as const
export const BOTTOMS = [
  { key: 'pants', label: 'กางเกงขายาว' }, { key: 'jeans', label: 'ยีนส์' }, { key: 'shorts', label: 'ขาสั้น' }, { key: 'skirt', label: 'กระโปรง' },
] as const
export const ACCS = [
  { key: 'none', label: 'ไม่มี' }, { key: 'glasses', label: 'แว่นตา' }, { key: 'sunglasses', label: 'แว่นกันแดด' },
  { key: 'headphones', label: 'หูฟัง' }, { key: 'cap', label: 'หมวกแก๊ป' }, { key: 'beanie', label: 'หมวกไหมพรม' },
  { key: 'flower', label: 'ดอกไม้ทัดหู' }, { key: 'bow', label: 'โบว์' }, { key: 'crown', label: 'มงกุฎ' },
  { key: 'halo', label: 'วงแหวนนางฟ้า' }, { key: 'helmet', label: 'หมวกช่าง' }, { key: 'catears', label: 'หูแมว' },
] as const

export type HairKey = typeof HAIRS[number]['key']
export type FaceKey = typeof FACES[number]['key']
export type TopKey = typeof TOPS[number]['key']
export type BottomKey = typeof BOTTOMS[number]['key']
export type AccKey = typeof ACCS[number]['key']

export interface Avatar {
  skin: string; hair: HairKey; hairColor: string; face: FaceKey
  top: TopKey; topColor: string; bottom: BottomKey; bottomColor: string; shoes: string; acc: AccKey
  /** ชื่อเล่นที่โชว์บนแผนที่และป้ายของหุ่นยนต์ ('' = ใช้ชื่อแรกของชื่อจริง) */
  nick: string
}

export type Facing = 'down' | 'up' | 'left' | 'right'

const keys = <T extends { key: string }>(xs: readonly T[]) => new Set(xs.map(x => x.key))
const HAIR_SET = keys(HAIRS), FACE_SET = keys(FACES), TOP_SET = keys(TOPS), BOTTOM_SET = keys(BOTTOMS), ACC_SET = keys(ACCS)
const HEX = /^#[0-9a-f]{6}$/i

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** ตัวละครสุ่มจาก seed — ใช้เป็นค่าเริ่มต้นของแต่ละคน (อีเมลเดียวกัน = ได้ตัวเดิมเสมอ) */
export function avatarFromSeed(seed: string): Avatar {
  let h = hash(seed.toLowerCase())
  const pick = <T,>(xs: readonly T[]): T => { const v = xs[h % xs.length]; h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; return v }
  const hair = pick(HAIRS.filter(x => x.key !== 'bald')).key
  const top = pick(TOPS.filter(x => x.key !== 'lab')).key
  return {
    skin: pick(SKINS), hair, hairColor: pick(HAIR_COLORS.slice(0, 7)), face: pick(FACES).key,
    top, topColor: pick(CLOTH_COLORS), bottom: top === 'dress' ? 'skirt' : pick(BOTTOMS).key,
    bottomColor: pick(['#334155', '#1e3a8a', '#111827', '#78716c', '#7c2d12', '#f8fafc']), shoes: pick(['#111827', '#7c2d12', '#f8fafc', '#ef4444']),
    acc: h % 3 === 0 ? pick(ACCS.filter(x => x.key !== 'none' && x.key !== 'crown' && x.key !== 'halo')).key : 'none',
    nick: '',
  }
}

/** อ่านค่าที่บันทึกไว้ — ชิ้นที่หาย/ผิด ใช้ของตัวละครเริ่มต้นของคนนั้น */
export function parseAvatar(raw: string | null | undefined, seed: string): Avatar {
  const base = avatarFromSeed(seed)
  try {
    const j = JSON.parse(raw || '') as Partial<Record<keyof Avatar, unknown>>
    if (!j || typeof j !== 'object') return base
    const col = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v : d)
    const oneOf = <K extends string>(v: unknown, set: Set<string>, d: K): K => (typeof v === 'string' && set.has(v) ? v as K : d)
    return {
      skin: col(j.skin, base.skin), hair: oneOf(j.hair, HAIR_SET, base.hair), hairColor: col(j.hairColor, base.hairColor),
      face: oneOf(j.face, FACE_SET, base.face), top: oneOf(j.top, TOP_SET, base.top), topColor: col(j.topColor, base.topColor),
      bottom: oneOf(j.bottom, BOTTOM_SET, base.bottom), bottomColor: col(j.bottomColor, base.bottomColor),
      shoes: col(j.shoes, base.shoes), acc: oneOf(j.acc, ACC_SET, base.acc), nick: cleanNick(j.nick),
    }
  } catch { return base }
}

export const serializeAvatar = (a: Avatar): string => JSON.stringify({ ...a, nick: cleanNick(a.nick) })

export const NICK_MAX = 20
/** ชื่อเล่น: ตัดช่องว่างหัวท้าย ตัดอักขระควบคุม ยาวไม่เกิน 20 ตัว */
export function cleanNick(v: unknown): string {
  if (typeof v !== 'string') return ''
  // eslint-disable-next-line no-control-regex
  return [...v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()].slice(0, NICK_MAX).join('')
}

/** ชื่อที่โชว์: ชื่อเล่น หรือชื่อแรกของชื่อจริง */
export const displayName = (a: Avatar | null | undefined, realName: string): string => a?.nick || realName.split(/\s+/)[0] || realName

/** ทิศที่หันจากการขยับ a → b (ไม่ขยับ = คงทิศเดิม) */
export function facingFrom(a: { x: number; y: number }, b: { x: number; y: number }, prev: Facing = 'down'): Facing {
  const dx = b.x - a.x, dy = b.y - a.y
  if (!dx && !dy) return prev
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
}

/** ปรับสีให้เข้ม/อ่อนลง (เงาและไฮไลต์ของเสื้อผ้า) */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))))
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
