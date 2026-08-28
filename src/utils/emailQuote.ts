// ตัดเนื้อเมลเก่าที่ติดมากับการตอบกลับ
//
// เวลาลูกค้าตอบเมลกลับมา โปรแกรมเมลจะแนบบทสนทนาเก่าทั้งเส้นมาด้วยเสมอ
// ถ้าเก็บทั้งก้อนเป็นคอมเมนต์ พอตอบกันไปมา 5 รอบ คอมเมนต์สุดท้ายจะยาวกว่า
// ทุกคอมเมนต์ก่อนหน้ารวมกัน ทั้งที่ข้อความใหม่จริง ๆ มีอยู่บรรทัดเดียว
//
// ที่นี่ "ตัด" หมายถึงแยกออกมาเพื่อพับเก็บ ไม่ใช่ลบทิ้ง — ของเดิมยังอยู่ใน
// SharePoint ครบ และกดดูได้ เพราะบางทีบริบทในเมลเก่าคือหลักฐานของงาน

export interface SplitQuote {
  /** ข้อความใหม่จริง ๆ ที่คนพิมพ์รอบนี้ */
  visible: string
  /** บทสนทนาเก่าที่ตามมาด้วย — ว่างถ้าไม่มี */
  quoted: string
}

const HEADER_FOLLOW = /^\s*(Sent|To|Date|Cc|Subject|ส่ง|ถึง|วันที่|สำเนา|เรื่อง)\s*:/i

/**
 * บรรทัดนี้เป็นจุดเริ่มของเมลเก่าหรือไม่
 * ต้องดูบรรทัดถัดไปประกอบ เพราะ "จาก: ชื่อ" เฉย ๆ คือหัวคอมเมนต์ที่ระบบเรา
 * เขียนเองตอนดึงเมลตอบกลับเข้ามา ไม่ใช่ header ของเมลที่ถูกอ้างถึง
 */
function isQuoteStart(lines: string[], i: number): boolean {
  const line = lines[i]
  if (/^\s*-{2,}\s*(Original Message|Forwarded message|ข้อความต้นฉบับ)\s*-{2,}/i.test(line)) return true
  if (/^\s*_{5,}\s*$/.test(line)) return true
  // "On Mon, 3 Mar 2026 at 10:00, สมชาย wrote:" — ประโยคเดียวจบด้วย wrote:
  if (/^\s*(On|เมื่อ)\b.{10,200}(wrote|เขียนว่า)\s*:\s*$/i.test(line)) return true
  if (/^\s*(From|จาก)\s*:\s*\S/i.test(line)) {
    // ต้องมี Sent/To/Subject ตามมาภายใน 3 บรรทัด จึงจะเป็น header ของเมลจริง
    for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
      if (HEADER_FOLLOW.test(lines[j])) return true
    }
    return false
  }
  return false
}

/** แยกข้อความใหม่ออกจากเมลเก่าที่ติดมาด้วย */
export function splitQuoted(raw: string | undefined): SplitQuote {
  const text = (raw ?? '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')

  let cut = -1
  for (let i = 0; i < lines.length; i++) {
    // บรรทัดแรกไม่นับ — ทั้งข้อความเป็นเมลเก่าล้วนก็ยังต้องมีอะไรให้อ่าน
    if (i > 0 && isQuoteStart(lines, i)) { cut = i; break }
    // บล็อก "> ..." ที่ยาวพอ ถือเป็นเมลเก่า (บรรทัดเดียวอาจเป็นแค่การยกคำพูด)
    if (i > 0 && /^\s*>/.test(lines[i]) && /^\s*>/.test(lines[i + 1] ?? '')) { cut = i; break }
  }

  if (cut < 0) return { visible: text.trim(), quoted: '' }

  const visible = lines.slice(0, cut).join('\n').trim()
  const quoted = lines.slice(cut).join('\n').trim()
  // ตัดแล้วไม่เหลืออะไรเลย แปลว่าอ่านผิด — คืนของเดิมดีกว่าโชว์ช่องว่าง
  if (!visible) return { visible: text.trim(), quoted: '' }
  return { visible, quoted }
}

/** เอาเฉพาะข้อความใหม่ */
export const stripQuoted = (raw: string | undefined): string => splitQuoted(raw).visible

/** มีเมลเก่าติดมาไหม — ใช้ตัดสินว่าจะแสดงปุ่ม "ดูข้อความก่อนหน้า" หรือไม่ */
export const hasQuoted = (raw: string | undefined): boolean => splitQuoted(raw).quoted.length > 0

/** จำนวนบรรทัดของส่วนที่พับไว้ — ใช้บอกผู้ใช้ว่ากดแล้วจะเจออะไร */
export const quotedLines = (raw: string | undefined): number => {
  const q = splitQuoted(raw).quoted
  return q ? q.split('\n').length : 0
}
