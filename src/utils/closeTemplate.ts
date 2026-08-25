// ข้อความตอบกลับตอนปิดงาน — ใช้ทั้ง Ticket และ Incident
// เก็บเป็น template ไว้ล่วงหน้า เติมค่าให้อัตโนมัติ และแนบลิงก์บทความความรู้ได้
//
// ทุกฟังก์ชันเป็น pure — ข้อความพวกนี้ถูกส่งถึงลูกค้าจริง จึงต้องพิสูจน์ได้ว่าเติมค่าถูก

export type CloseScope = 'Ticket' | 'Incident' | 'Both'

export interface CloseTemplate {
  id: number
  Title: string
  Body?: string
  AppliesTo?: string        // Ticket | Incident | Both (ว่าง = Both)
  Category?: string         // ใช้เสนอ template ที่ตรงกับประเภทงานขึ้นก่อน
  IsActive?: boolean
}

export const scopeOf = (t: CloseTemplate): CloseScope => {
  const v = (t.AppliesTo ?? '').trim()
  return v === 'Ticket' || v === 'Incident' ? v : 'Both'
}

/** template ที่ใช้ได้กับงานชนิดนี้ — 'Both' ใช้ได้ทั้งคู่ */
export function templatesFor(list: CloseTemplate[], kind: 'Ticket' | 'Incident', category?: string): CloseTemplate[] {
  const usable = list.filter(t => t.IsActive !== false && (scopeOf(t) === 'Both' || scopeOf(t) === kind))
  const cat = (category ?? '').trim().toLowerCase()
  if (!cat) return usable
  // ตรงประเภทงานขึ้นก่อน — ที่เหลือยังเลือกได้ ไม่ได้ตัดทิ้ง
  return [...usable].sort((a, b) => {
    const am = (a.Category ?? '').trim().toLowerCase() === cat ? 0 : 1
    const bm = (b.Category ?? '').trim().toLowerCase() === cat ? 0 : 1
    return am - bm
  })
}

export interface CloseVars {
  ticket_number?: string
  title?: string
  customer_name?: string
  agent_name?: string
  resolution?: string
  kb_links?: string
  [k: string]: string | undefined
}

/** ตัวแปรที่ใส่ใน template ได้ — โชว์เป็นคำใบ้ในหน้าแก้ไข */
export const CLOSE_VARS: { key: keyof CloseVars & string; desc: string }[] = [
  { key: 'ticket_number', desc: 'เลข Ticket' },
  { key: 'title',         desc: 'ชื่อเรื่อง' },
  { key: 'customer_name', desc: 'ชื่อผู้แจ้ง' },
  { key: 'agent_name',    desc: 'ชื่อผู้ปิดงาน' },
  { key: 'resolution',    desc: 'สรุปการแก้ไข' },
  { key: 'kb_links',      desc: 'ลิงก์บทความที่แนบ' },
]

/**
 * เติมค่าลง {{placeholder}}
 * ตัวแปรที่ไม่มีค่าจะถูกลบทิ้งพร้อมบรรทัดของมัน — ปล่อยไว้จะได้ข้อความแบบ
 * "อ่านเพิ่มเติมได้ที่:" แล้วไม่มีอะไรตามมา ซึ่งดูเหมือนระบบพัง
 */
export function renderClose(body: string | undefined, vars: CloseVars): string {
  const lines = (body ?? '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const used = [...line.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
    // บรรทัดที่มีแต่ตัวแปรว่าง → ตัดทั้งบรรทัด
    if (used.length && used.every(k => !(vars[k] ?? '').trim())) {
      const withoutVars = line.replace(/\{\{\w+\}\}/g, '').trim()
      if (!withoutVars || /^[-•:\s]*$/.test(withoutVars)) continue
    }
    out.push(line.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? ''))
  }
  // ยุบบรรทัดว่างที่เหลือจากการตัด ไม่ให้มีช่องโหว่กลางข้อความ
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ── ลิงก์บทความความรู้ ────────────────────────────────────────────────────

export interface KbLink {
  code: string       // รหัสบทความ เช่น ITS000123
  title: string
  id: number
}

/**
 * ลิงก์สาธารณะของบทความ — ต้องตรงกับชื่อไฟล์ที่หน้า "สร้างเว็บ" ปล่อยออกมา
 * (ยึดรหัสบทความ ตัวพิมพ์เล็ก .html)
 */
export function kbUrl(baseUrl: string, a: KbLink): string {
  const base = (baseUrl ?? '').trim().replace(/\/+$/, '')
  const slug = (a.code ?? '').trim().replace(/[^A-Za-z0-9_-]+/g, '').toLowerCase() || `article-${a.id}`
  return base ? `${base}/${slug}.html` : `${slug}.html`
}

/** ก้อนลิงก์ที่จะไปแทน {{kb_links}} — ว่างเมื่อไม่ได้เลือกบทความไว้ */
export function kbLinksBlock(articles: KbLink[], baseUrl: string): string {
  if (articles.length === 0) return ''
  return articles.map(a => `- ${a.title}\n  ${kbUrl(baseUrl, a)}`).join('\n')
}

/** ตั้งค่ายังไม่ครบไหม — เตือนก่อนส่งลิงก์ที่กดไม่ได้ให้ลูกค้า */
export const kbBaseMissing = (baseUrl: string): boolean => !(baseUrl ?? '').trim()

export const DEFAULT_TEMPLATES: { Title: string; AppliesTo: CloseScope; Body: string }[] = [
  {
    Title: 'ปิดงาน — แก้ไขเรียบร้อย',
    AppliesTo: 'Both',
    Body: [
      'เรียน คุณ{{customer_name}}',
      '',
      'ตาม {{ticket_number}} เรื่อง "{{title}}" ทางทีมได้ดำเนินการแก้ไขเรียบร้อยแล้ว',
      '',
      'สรุปการแก้ไข',
      '{{resolution}}',
      '',
      'อ่านรายละเอียดเพิ่มเติมได้ที่',
      '{{kb_links}}',
      '',
      'หากยังพบปัญหาเดิม รบกวนตอบกลับอีเมลฉบับนี้ได้เลยครับ',
      '',
      '{{agent_name}} · iT Services',
    ].join('\n'),
  },
  {
    Title: 'ปิดงาน — ให้ข้อมูล/แนะนำวิธีใช้',
    AppliesTo: 'Ticket',
    Body: [
      'เรียน คุณ{{customer_name}}',
      '',
      'ตาม {{ticket_number}} ทางทีมได้ตรวจสอบและขอสรุปข้อมูลดังนี้',
      '',
      '{{resolution}}',
      '',
      'ขั้นตอนโดยละเอียดดูได้ที่',
      '{{kb_links}}',
      '',
      '{{agent_name}} · iT Services',
    ].join('\n'),
  },
  {
    Title: 'ปิดเคส — Incident แก้ไขแล้ว',
    AppliesTo: 'Incident',
    Body: [
      'เรียน คุณ{{customer_name}}',
      '',
      'เคส "{{title}}" ได้รับการแก้ไขและระบบกลับมาใช้งานได้ตามปกติแล้ว',
      '',
      'สาเหตุและการแก้ไข',
      '{{resolution}}',
      '',
      'รายละเอียดเพิ่มเติม',
      '{{kb_links}}',
      '',
      '{{agent_name}} · iT Services',
    ].join('\n'),
  },
]
