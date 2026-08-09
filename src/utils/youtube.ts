// แกะ URL ยูทูบเป็น id เพื่อฝังเล่นในหน้าเว็บ
// รองรับทุกรูปแบบที่คนก็อปมาจริง: youtu.be, watch?v=, /embed/, /shorts/, /live/ และ id เปล่า ๆ

const ID = '[A-Za-z0-9_-]{11}'

export function youtubeId(raw: string): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const m = s.match(new RegExp(`(?:youtu\\.be/|v=|/embed/|/shorts/|/live/)(${ID})`))
  if (m) return m[1]
  return new RegExp(`^${ID}$`).test(s) ? s : null
}

export const youtubeEmbed = (raw: string): string => {
  const id = youtubeId(raw)
  return id ? `https://www.youtube.com/embed/${id}` : ''
}

/** รูปปกของคลิป — โหลดเบากว่าฝัง iframe ไว้ทุกอัน */
export const youtubeThumb = (id: string): string => `https://img.youtube.com/vi/${id}/mqdefault.jpg`

export interface MediaLink {
  url: string
  label: string          // ชื่อที่ตั้งเอง ถ้าไม่ตั้งจะใช้ URL
  youtubeId: string | null   // ไม่ใช่ยูทูบ = null → แสดงเป็นลิงก์ธรรมดา
}

/**
 * แปลงข้อความหลายบรรทัดเป็นรายการคลิป/ลิงก์ — ใส่ได้ไม่จำกัด
 * บรรทัดละ 1 รายการ ตั้งชื่อได้ด้วย "ชื่อ | url"
 * บรรทัดว่างและรายการซ้ำถูกตัดทิ้ง
 */
export function parseMediaLinks(raw: string | undefined): MediaLink[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: MediaLink[] = []
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    // "ชื่อ | url" — แยกที่ | ตัวสุดท้าย เผื่อชื่อมี | อยู่ข้างใน
    const cut = text.lastIndexOf('|')
    let label = '', url = text
    if (cut > -1) {
      label = text.slice(0, cut).trim()
      url = text.slice(cut + 1).trim()
    }
    if (!url) continue
    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ url, label: label || url, youtubeId: youtubeId(url) })
  }
  return out
}
