// วางเนื้อหาที่มีรูปแบบ (ตาราง ลิงก์ ตัวหนา รูป) ลงในคอมเมนต์แล้วเก็บรูปแบบไว้
//
// ปัญหา: คอมเมนต์เก็บเป็นข้อความล้วน ตารางที่ก็อปมาจากเมลหรือ Excel จึงแบนเป็น
// ตัวหนังสือติดกันจนอ่านไม่ได้ ทั้งที่รูปแบบนั้นคือสาระ (ใครทำอะไร ค่าเท่าไร)
//
// วิธีเก็บ: ต่อท้ายข้อความเดิมด้วยเครื่องหมายคั่น แล้วตามด้วย HTML ที่กรองแล้ว
//   <ข้อความที่คนพิมพ์เอง>
//   <!--hd-html-->
//   <table>...</table>
//
// ทำแบบนี้เพราะ:
// - คอมเมนต์เก่าทั้งหมดไม่มีเครื่องหมายนี้ จึงยังเป็นข้อความล้วนเหมือนเดิม ไม่ต้องแปลงข้อมูล
// - ไม่ต้องเพิ่มคอลัมน์ใน SharePoint
// - ของเดิมที่เกาะบนข้อความล้วน (@mention, จับวันที่, พับเนื้อเมลเก่า) ยังทำงานกับส่วน
//   ที่คนพิมพ์เองได้ครบ ไม่ต้องเขียนใหม่บน HTML

/** เครื่องหมายคั่นระหว่างข้อความที่คนพิมพ์ กับ HTML ที่วางมา */
export const RICH_MARK = '<!--hd-html-->'

export interface RichComment {
  /** ส่วนที่คนพิมพ์เอง — ยังเป็นข้อความล้วน */
  plain: string
  /** HTML ที่วางมา (กรองแล้ว) — ว่างถ้าไม่มี */
  html: string
}

/** แยกคอมเมนต์เป็นสองส่วน — ไม่มีเครื่องหมายคั่นก็คือคอมเมนต์ธรรมดาทั้งก้อน */
export function splitRich(text: string | undefined): RichComment {
  const raw = text ?? ''
  const at = raw.indexOf(RICH_MARK)
  if (at < 0) return { plain: raw, html: '' }
  return {
    plain: raw.slice(0, at).replace(/\s+$/, ''),
    html: raw.slice(at + RICH_MARK.length).trim(),
  }
}

/** ประกอบกลับเป็นค่าที่จะเก็บลง SharePoint */
export function joinRich(plain: string, html: string): string {
  const p = (plain ?? '').trim()
  const h = (html ?? '').trim()
  if (!h) return p
  return p ? `${p}\n${RICH_MARK}\n${h}` : `${RICH_MARK}\n${h}`
}

export const isRich = (text: string | undefined): boolean => (text ?? '').includes(RICH_MARK)

// ── นโยบายการกรอง HTML ────────────────────────────────────────────────────────
// HTML ที่วางมาจากเว็บหรือเมลพา <script>, onclick, javascript: มาได้
// ถ้าเก็บดิบแล้วเอามาแสดง คนอื่นที่เปิดคอมเมนต์นั้นจะโดนรันโค้ดของคนวาง
// จึงอนุญาตเป็นรายการขาว (whitelist) ไม่ใช่บล็อกเป็นรายการดำ —
// รายการดำต้องเดาให้ครบทุกอย่างที่อันตราย ซึ่งเดาไม่ครบแน่

/** แท็กที่เก็บไว้ — เท่าที่ตาราง/รายการ/ลิงก์/รูป ต้องใช้จริง */
export const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'mark', 'small',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
  'a', 'img',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'pre', 'code', 'blockquote', 'hr',
]

/** แท็กที่ต้องทิ้งทั้งก้อนรวมเนื้อใน — ไม่ใช่แค่ถอดแท็กออก */
export const DROP_WHOLE = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'svg', 'math']

/** attribute ที่เก็บไว้ต่อแท็ก — นอกจากนี้ตัดทิ้งทั้งหมด (รวม on* ทุกตัว) */
export const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'width', 'height'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan'],
  col: ['span'],
}

export const isAllowedTag = (tag: string): boolean => ALLOWED_TAGS.includes(tag.toLowerCase())
export const isDropWhole = (tag: string): boolean => DROP_WHOLE.includes(tag.toLowerCase())

export function isAllowedAttr(tag: string, attr: string): boolean {
  const a = attr.toLowerCase()
  // on* คือทางรันโค้ดที่ตรงที่สุด ตัดก่อนเสมอไม่ว่าจะอยู่แท็กไหน
  if (a.startsWith('on')) return false
  return (ALLOWED_ATTRS[tag.toLowerCase()] ?? []).includes(a)
}

const SAFE_SCHEME = /^(https?:|mailto:|tel:)/i

/**
 * ลิงก์ที่กดได้ — คืนสตริงว่างถ้าไม่ปลอดภัย (ผู้เรียกต้องตัด attribute นั้นทิ้ง)
 *
 * javascript: กับ data: บน href คือช่องรันโค้ด ส่วน vbscript: เก่าแต่ยังมีในเมลเก่า
 * ลิงก์ภายในหน้าเราเอง (#/...) ก็ยอมให้ เพราะเป็นลิงก์ที่เราสร้างเองตอนอ้างถึงงาน
 */
export function safeHref(url: string | null | undefined): string {
  const u = (url ?? '').trim()
  if (!u) return ''
  // ช่องว่างและอักขระควบคุมแทรกกลาง scheme เป็นวิธีเลี่ยงตัวกรองแบบคลาสสิก
  // ("java<tab>script:") — เอาออกก่อนตรวจ ไม่ใช่ตรวจสตริงดิบ
  const clean = [...u].filter(c => c.charCodeAt(0) > 32).join('')
  if (clean.startsWith('#')) return u
  if (/^\/[^/]/.test(clean)) return u
  return SAFE_SCHEME.test(clean) ? u : ''
}

/** เพดานของรูปแบบฝังในเนื้อหา (data:) — ใหญ่กว่านี้เก็บลงคอลัมน์ข้อความไม่คุ้ม */
export const MAX_INLINE_IMAGE = 400 * 1024

/**
 * ที่มาของรูปที่ยอมให้แสดง
 *
 * `data:image/...` เก็บได้ เพราะอยู่ในตัวเนื้อหาเอง ไม่ต้องพึ่งใคร แต่จำกัดขนาด
 * `https:` เก็บได้ แต่จะแสดงแบบไม่ส่ง referrer
 * `file:` / `cid:` / `blob:` แสดงไม่ได้เลย — ชี้ไปเครื่องคนวางหรือกล่องเมลของเขา
 * ต้องบอกว่ารูปหายไป ไม่ใช่ปล่อยกรอบรูปแตกให้คนเดาเอง
 */
export function safeImgSrc(url: string | null | undefined, maxInline = MAX_INLINE_IMAGE): string {
  const u = (url ?? '').trim()
  if (!u) return ''
  if (/^data:image\/(png|jpe?g|gif|webp|bmp|avif);base64,/i.test(u)) {
    return u.length <= maxInline ? u : ''
  }
  if (/^https:\/\//i.test(u)) return u
  return ''
}

// ── HTML → ข้อความล้วน ───────────────────────────────────────────────────────

const ENTITY: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#160': ' ',
}

const decode = (s: string): string =>
  s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    const key = code.toLowerCase()
    if (ENTITY[key] != null) return ENTITY[key]
    if (key.startsWith('#x')) {
      const n = parseInt(key.slice(2), 16)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    if (key.startsWith('#')) {
      const n = parseInt(key.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return m
  })

/**
 * ข้อความล้วนของ HTML — ใช้ตอนส่งอีเมลแจ้งเตือนและตอนกด "ล้างรูปแบบ"
 *
 * ช่องในตารางคั่นด้วย tab ไม่ใช่ติดกัน ไม่งั้นเลข 2 คอลัมน์จะกลายเป็นเลขเดียว
 * ที่อ่านผิดได้ ซึ่งแย่กว่าอ่านไม่ออก
 */
export function htmlToPlain(html: string | undefined): string {
  let s = html ?? ''
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '')
  s = s.replace(/<\/(td|th)\s*>\s*(?=<(td|th)\b)/gi, '\t')
  s = s.replace(/<\/(tr|p|div|li|h[1-6]|table|blockquote|pre)\s*>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<li\b[^>]*>/gi, '- ')
  s = s.replace(/<[^>]*>/g, '')
  s = decode(s)
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '')
}

/** ข้อความล้วนของคอมเมนต์ทั้งก้อน (ทั้งส่วนพิมพ์เองและส่วนที่วางมา) */
export function commentPlain(text: string | undefined): string {
  const { plain, html } = splitRich(text)
  const rich = htmlToPlain(html)
  return [plain, rich].filter(Boolean).join('\n')
}

/** ตัดให้สั้นสำหรับหัวข้อ/แจ้งเตือน — ต้องไม่มีแท็กหลุดไปโผล่ในอีเมล */
export function plainSnippet(text: string | undefined, max = 200): string {
  const s = commentPlain(text).replace(/\s+/g, ' ').trim()
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

/**
 * HTML ที่วางมามีรูปแบบระดับ "บล็อก" ที่ข้อความล้วนแทนไม่ได้ไหม
 *
 * เกณฑ์คือ ตาราง/รายการ/หัวข้อ/โค้ด/รูป — ของที่พอแบนเป็นข้อความแล้วเสียความหมาย
 *
 * ตัวหนา ตัวเอน และ "ลิงก์เดี่ยว" ไม่นับ เพราะการก็อป URL จากเบราว์เซอร์ก็ได้ <a>
 * ติดมาทุกครั้ง ถ้านับด้วย การวาง URL ธรรมดาจะกลายเป็นบล็อกที่แก้คำไม่ได้
 * แล้วหลุดจากทาง @mention / จับวันที่ ทั้งที่ไม่มีเหตุ — และ URL ในข้อความล้วน
 * ก็กดได้อยู่แล้ว
 */
export function hasBlockMarkup(html: string | undefined): boolean {
  const s = (html ?? '').toLowerCase()
  if (!s) return false
  return /<(table|tr|td|th|ul|ol|li|h[1-6]|pre|blockquote|img)[\s>/]/.test(s)
}
