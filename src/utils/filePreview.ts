// ดูไฟล์แนบในหน้าเลย ไม่ต้องดาวน์โหลดก่อน
//
// ปัญหา: ไฟล์ที่ไม่ใช่รูปทั้งหมดเป็นลิงก์ดาวน์โหลด แม้แต่ PDF หน้าเดียวหรือไฟล์ log
// สั้น ๆ ก็ต้องโหลดลงเครื่อง เปิดโปรแกรมอื่น แล้วค่อยกลับมา — ซึ่งทำให้คนไม่เปิดดูเลย
//
// เชื่อ Content-Type จาก SharePoint ไม่ได้ (คืน application/octet-stream เกือบทุกไฟล์)
// และเชื่อชื่อไฟล์อย่างเดียวก็ไม่ได้ จึงดูไบต์แรกก่อน แล้วค่อยถอยมาใช้นามสกุล

export type PreviewKind = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'office' | 'none'

/** นามสกุล → MIME สำหรับชนิดที่เราเปิดดูในหน้าได้ */
const BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', aac: 'audio/aac',
  txt: 'text/plain', log: 'text/plain', md: 'text/markdown', csv: 'text/csv',
  json: 'application/json', xml: 'text/xml', yml: 'text/yaml', yaml: 'text/yaml',
  ini: 'text/plain', conf: 'text/plain', sql: 'text/plain', ps1: 'text/plain', sh: 'text/plain',
  ts: 'text/plain', tsx: 'text/plain', js: 'text/plain', css: 'text/plain', html: 'text/html',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function extOf(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : ''
}

/** เดา MIME จากนามสกุล — ใช้เมื่ออ่านไบต์แล้วยังไม่รู้ */
export const mimeFromName = (fileName: string): string => BY_EXT[extOf(fileName)] ?? ''

/**
 * ชนิดที่แน่จริง เรียงความน่าเชื่อ: ไบต์ที่อ่านได้ → นามสกุล → header จากเซิร์ฟเวอร์
 *
 * header มาท้ายสุดเพราะ SharePoint ตอบ application/octet-stream ให้เกือบทุกไฟล์
 * ซึ่งเป็นคำตอบที่ "ไม่ผิด" แต่ก็ไม่ได้บอกอะไร
 */
export function resolveMime(sniffed: string | null, fileName: string, headerType?: string): string {
  if (sniffed) return sniffed
  const byName = mimeFromName(fileName)
  if (byName) return byName
  const h = (headerType ?? '').trim()
  return h && h !== 'application/octet-stream' ? h : ''
}

export const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']

/** ไฟล์ข้อความที่เปิดอ่านในหน้าได้ — จำกัดขนาด ไม่งั้น log 50MB จะทำให้หน้าค้าง */
export const TEXT_PREVIEW_LIMIT = 512 * 1024

const TEXT_MIME = /^text\/|^application\/(json|xml|x-yaml|javascript)/

/**
 * เปิดดูในหน้าได้แบบไหน
 *
 * 'office' ไม่ใช่ "ดูได้" — เบราว์เซอร์เปิด docx/xlsx เองไม่ได้ แต่แยกออกมาเพราะ
 * ควรเสนอทางอื่นให้ (เปิดใน Office Online) แทนที่จะปนกับ zip ที่ไม่มีอะไรให้ดูจริง ๆ
 */
export function previewKind(mime: string, fileName = '', size = 0): PreviewKind {
  const m = (mime || mimeFromName(fileName)).toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m === 'application/pdf') return 'pdf'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (TEXT_MIME.test(m)) return size > TEXT_PREVIEW_LIMIT ? 'none' : 'text'
  if (OFFICE_EXT.includes(extOf(fileName))) return 'office'
  return 'none'
}

/**
 * เบราว์เซอร์เล่นชนิดนี้ไม่ได้ — รู้ล่วงหน้าดีกว่าปล่อยให้เครื่องเล่นขึ้นกากบาท
 * .mov บางตัวเป็น codec ที่ Chrome ไม่รองรับ แต่บางตัวเล่นได้ จึงไม่ตัดทิ้งล่วงหน้า
 */
export const CANNOT_PLAY = ['video/x-msvideo', 'video/x-ms-wmv', 'audio/x-ms-wma']

const KB = 1024
export function prettySize(n: number): string {
  if (!n) return ''
  if (n < KB) return `${n} B`
  if (n < KB * KB) return `${Math.round(n / KB)} KB`
  return `${(n / KB / KB).toFixed(1)} MB`
}

// ── รับไฟล์จากการวางและการลาก ───────────────────────────────────────────────

/** เพดานต่อไฟล์ — ใหญ่กว่านี้อัปโหลดผ่านเบราว์เซอร์แล้วมักค้างหรือ timeout */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

export interface PickedFiles {
  accepted: File[]
  /** ไฟล์ที่รับไม่ได้ พร้อมเหตุผลที่บอกคนได้ */
  rejected: Array<{ name: string; reason: string }>
}

interface FileLike { name: string; size: number }

/**
 * คัดไฟล์ที่วางหรือลากเข้ามา
 *
 * ไม่กรองตามนามสกุล — รับทุกชนิด ให้ SharePoint เป็นคนบอกเองถ้าปฏิเสธ
 * เดาแทนมันจะกลายเป็นบล็อกไฟล์ที่จริง ๆ แล้วอัปโหลดได้
 *
 * ไฟล์ 0 ไบต์ตัดทิ้ง เพราะการลากโฟลเดอร์เข้ามาจะได้แบบนี้ แล้วอัปโหลดจะพังทีหลัง
 */
export function pickFiles(files: FileLike[], maxBytes = MAX_UPLOAD_BYTES): PickedFiles {
  const accepted: File[] = []
  const rejected: PickedFiles['rejected'] = []
  for (const f of files) {
    if (!f.name) continue
    if (f.size === 0) {
      rejected.push({ name: f.name, reason: 'ไฟล์ว่าง หรือเป็นโฟลเดอร์ (ลากได้เฉพาะไฟล์)' })
    } else if (f.size > maxBytes) {
      rejected.push({ name: f.name, reason: `ใหญ่เกิน ${prettySize(maxBytes)}` })
    } else {
      accepted.push(f as File)
    }
  }
  return { accepted, rejected }
}

/**
 * ตั้งชื่อรูปที่วางมาจากคลิปบอร์ด
 *
 * ภาพที่ copy มามักไม่มีชื่อ หรือชื่อว่า "image.png" ทุกใบ ซึ่งพอวางหลายใบ
 * จะกลายเป็นไฟล์ชื่อซ้ำที่แยกไม่ออกว่าใบไหนคืออะไร — ใส่เวลาลงไปให้แยกได้
 */
export function pastedName(original: string, mime: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const generic = !original || original === 'image.png' || original.toLowerCase() === 'blob'
  if (!generic) return original
  const ext = mime.split('/')[1]?.split('+')[0] || 'png'
  return `pasted-${stamp}.${ext}`
}

/** ชื่อซ้ำในคิวเดียวกันต้องไม่ทับกัน — SharePoint เก็บชื่อซ้ำในไอเทมเดียวไม่ได้ */
export function dedupeName(name: string, taken: string[]): string {
  const lower = taken.map(t => t.toLowerCase())
  if (!lower.includes(name.toLowerCase())) return name
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}${ext}`
    if (!lower.includes(candidate.toLowerCase())) return candidate
  }
  return `${base}-${Date.now()}${ext}`
}
