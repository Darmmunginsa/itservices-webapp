// ข้อมูลเสริมของข้อความแชท (ตอบกลับ + ไฟล์แนบ) — ฝังไว้หน้าข้อความ ไม่ต้องเพิ่มคอลัมน์ใน SharePoint
//
// รูปแบบ:  ⟦{"r":123,"rw":"ก้อง","rt":"ข้อความที่ตอบ…","f":["รูป_ab12c.png"]}⟧ข้อความจริง
// ข้อความเก่า (ไม่มี ⟦…⟧) อ่านได้เหมือนเดิม · ไฟล์จริงเก็บเป็นไฟล์แนบของแถวนั้นในลิสต์เดิม

export interface ChatReply { id: number; who: string; text: string }
export interface ChatMeta { reply?: ChatReply; files?: string[] }

const OPEN = '⟦', CLOSE = '⟧'
export const SNIPPET_MAX = 80

export const snippet = (s: string, n = SNIPPET_MAX): string => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

export function encodeMsg(text: string, meta: ChatMeta = {}): string {
  const j: Record<string, unknown> = {}
  if (meta.reply) { j.r = meta.reply.id; j.rw = meta.reply.who; j.rt = snippet(meta.reply.text) }
  if (meta.files?.length) j.f = meta.files
  return Object.keys(j).length ? `${OPEN}${JSON.stringify(j)}${CLOSE}${text}` : text
}

export function decodeMsg(raw: string | undefined | null): { text: string; meta: ChatMeta } {
  const s = raw ?? ''
  if (!s.startsWith(OPEN)) return { text: s, meta: {} }
  const end = s.indexOf(CLOSE)
  if (end < 0) return { text: s, meta: {} }
  try {
    const j = JSON.parse(s.slice(OPEN.length, end)) as { r?: unknown; rw?: unknown; rt?: unknown; f?: unknown }
    const meta: ChatMeta = {}
    if (typeof j.r === 'number') meta.reply = { id: j.r, who: typeof j.rw === 'string' ? j.rw : '', text: typeof j.rt === 'string' ? j.rt : '' }
    if (Array.isArray(j.f)) meta.files = j.f.filter((x): x is string => typeof x === 'string' && !!x).slice(0, 10)
    return { text: s.slice(end + CLOSE.length), meta }
  } catch { return { text: s, meta: {} } }
}

/** ข้อความสั้นสำหรับแจ้งเตือน/รายชื่อ — ไม่มีโค้ดเสริมโผล่ */
export function previewText(raw: string | undefined | null): string {
  const { text, meta } = decodeMsg(raw)
  if (text.trim()) return text
  return meta.files?.length ? `📎 ${meta.files.length} ไฟล์` : ''
}

export const isImageFile = (name: string) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)

/** แสดงชื่อไฟล์โดยตัดรหัสสุ่มกันซ้ำที่ SharePoint เติมไว้ (_ab12c) ออก */
export const displayFileName = (name: string) => name.replace(/_[a-z0-9]{5}(\.[^.]+)?$/i, '$1')

export const MAX_FILES = 5
export const MAX_FILE_MB = 15
