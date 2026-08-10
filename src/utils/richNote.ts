// โน้ตความรู้ที่โตขึ้นเรื่อย ๆ — แบ่งหัวข้อได้ และอ้าง URL แทรกกลางเนื้อหาได้
// ใช้เครื่องหมายเท่าที่จำเป็นจริง ๆ ไม่ใช่ markdown เต็ม เพราะคนกรอกคือทีม IT ไม่ใช่นักเขียน
//   ## หัวข้อ            → หัวข้อใหม่
//   - รายการ             → bullet
//   [ชื่อ](url) หรือ url  → ลิงก์ (กดได้)

export interface NoteSection {
  heading: string        // '' = ย่อหน้านำก่อนหัวข้อแรก
  body: string
}

/** แบ่งเนื้อหาเป็นหัวข้อตามบรรทัดที่ขึ้นต้นด้วย # หรือ ## */
export function parseSections(raw: string | undefined): NoteSection[] {
  const text = (raw ?? '').replace(/\r\n/g, '\n')
  if (!text.trim()) return []
  const out: NoteSection[] = []
  let heading = ''
  let buf: string[] = []
  const flush = () => {
    const body = buf.join('\n').trim()
    // หัวข้อที่ยังไม่มีเนื้อหาก็ยังต้องแสดง — ไม่งั้นพิมพ์หัวข้อไว้ก่อนแล้วมันหายไป
    if (heading || body) out.push({ heading, body })
    buf = []
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s{0,3}#{1,2}\s+(.*)$/)
    if (m) { flush(); heading = m[1].trim() } else { buf.push(line) }
  }
  flush()
  return out
}

export type InlineSeg =
  | { type: 'text'; text: string }
  | { type: 'link'; text: string; href: string }

// URL ที่ก็อปมาแล้วมีวงเล็บ/จุด/จุลภาคติดท้าย เป็นเรื่องปกติ ต้องตัดออกจาก href
const TRAILING = /[.,;:!?)\]}"'»]+$/
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/g

const href = (u: string): string => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

/** แยกข้อความเป็นช่วง ๆ เพื่อทำให้ URL กดได้ รองรับทั้ง [ชื่อ](url) และ URL เปล่า */
export function parseInline(raw: string): InlineSeg[] {
  const text = raw ?? ''
  if (!text) return []
  const segs: InlineSeg[] = []

  // รอบแรก: [ชื่อ](url) — ทำก่อนเพื่อไม่ให้ url ข้างในถูกจับซ้ำ
  let last = 0
  const pending: { start: number; end: number; seg: InlineSeg }[] = []
  MD_LINK_RE.lastIndex = 0
  for (let m = MD_LINK_RE.exec(text); m; m = MD_LINK_RE.exec(text)) {
    pending.push({ start: m.index, end: m.index + m[0].length, seg: { type: 'link', text: m[1], href: href(m[2]) } })
  }

  const pushPlain = (chunk: string) => {
    if (!chunk) return
    let cursor = 0
    URL_RE.lastIndex = 0
    for (let m = URL_RE.exec(chunk); m; m = URL_RE.exec(chunk)) {
      const bare = m[0].replace(TRAILING, '')
      if (!bare) continue
      if (m.index > cursor) segs.push({ type: 'text', text: chunk.slice(cursor, m.index) })
      segs.push({ type: 'link', text: bare, href: href(bare) })
      cursor = m.index + bare.length
      URL_RE.lastIndex = cursor
    }
    if (cursor < chunk.length) segs.push({ type: 'text', text: chunk.slice(cursor) })
  }

  for (const p of pending) {
    pushPlain(text.slice(last, p.start))
    segs.push(p.seg)
    last = p.end
  }
  pushPlain(text.slice(last))
  return segs
}

/** จำนวนลิงก์ทั้งหมดในเนื้อหา — ใช้โชว์บนการ์ดว่ามีแหล่งอ้างอิงแทรกอยู่กี่จุด */
export function countLinks(raw: string | undefined): number {
  return parseInline(raw ?? '').filter(s => s.type === 'link').length
}
