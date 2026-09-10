// หา template อีเมลจากรายการที่โหลดมา — แยกจาก emailService เพราะเป็นตรรกะล้วน
//
// อยู่ในไฟล์ของตัวเองเพื่อให้ทดสอบใน node ได้ (emailService ลาก MSAL config มาด้วย)
// และเพราะกฎ "อันไหนนับว่าเปิด" เป็นเรื่องของข้อมูลที่คนกรอก ไม่ใช่เรื่องการส่งเมล

export interface TemplateRow {
  EventKey: string
  Subject?: string
  Body?: string
  IsEnabled?: unknown
}

const keyOf = (v: unknown): string => (typeof v === 'string' ? v : '').trim().toLowerCase()

/**
 * หา template ที่เปิดใช้อยู่ — เทียบแบบตัดช่องว่างและไม่สนตัวพิมพ์
 *
 * EventKey เป็นข้อความที่คนพิมพ์เองใน SharePoint ช่องว่างท้ายบรรทัดหรือ
 * ตัวพิมพ์ใหญ่หนึ่งตัวก็ทำให้หาไม่เจอ แล้วระบบจะบอกว่า "ยังไม่ได้เปิด template"
 * ทั้งที่แถวนั้นเปิดอยู่ตรงหน้า — คนจะไปนั่งกดเปิดซ้ำแล้วก็ยังไม่ได้ผล
 */
export function findTemplate<T extends TemplateRow>(templates: T[], eventKey: string): T | undefined {
  const want = keyOf(eventKey)
  return templates.find(t => keyOf(t.EventKey) === want && isOn(t.IsEnabled))
}

/**
 * IsEnabled เปิดอยู่ไหม
 *
 * คอลัมน์อาจถูกสร้างเป็น Yes/No (boolean) หรือ Choice/Text ("Yes"/"ใช่") แล้วแต่คนสร้าง
 * ถ้าไม่มีคอลัมน์นี้เลย ค่าจะเป็น undefined — ถือว่า "เปิด" เพราะการมีแถวอยู่
 * ก็คือความตั้งใจจะใช้แล้ว ดีกว่าเงียบเพราะคอลัมน์ที่ไม่มีอยู่จริง
 */
export function isOn(v: unknown): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toLowerCase()
  return !['false', 'no', '0', 'ไม่', 'ปิด', ''].includes(s)
}

/** อธิบายว่าทำไมหา template ไม่เจอ — ต้องชี้ไปที่สิ่งที่ต้องไปแก้จริง */
export function templateProblem(templates: TemplateRow[], eventKey: string): string {
  const want = keyOf(eventKey)
  const row = templates.find(t => keyOf(t.EventKey) === want)
  if (row) return `template "${eventKey}" มีอยู่ แต่ช่อง IsEnabled ถูกปิดไว้`
  // ชื่อใกล้เคียง = พิมพ์ผิด/ขีดหาย ซึ่งพบบ่อยกว่าลืมสร้างแถว
  const near = templates
    .map(t => (typeof t.EventKey === 'string' ? t.EventKey : ''))
    .filter(k => k && (keyOf(k).includes(want.slice(0, 6)) || want.includes(keyOf(k).slice(0, 6))))
  if (near.length) return `ไม่พบ EventKey "${eventKey}" — ที่ใกล้เคียงในลิสต์: ${near.join(', ')}`
  return `ไม่พบแถว EventKey "${eventKey}" ใน HD_EmailTemplates (มีทั้งหมด ${templates.length} แถว)`
}
