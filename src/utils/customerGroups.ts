// กลุ่มลูกค้าตามโครงการ — เลือกทีเดียวได้ทั้งกลุ่ม
//
// เวลานัดประชุมเรื่องโครงการหนึ่ง คนฝั่งลูกค้าที่ต้องเชิญมักเป็นชุดเดิมทุกครั้ง
// การไล่ติ๊กทีละคนทุกรอบทำให้ตกหล่นได้ง่าย และคนที่ตกหล่นคือคนที่ไม่รู้เรื่อง

export interface ProjectCustomer {
  id: number
  Title?: string            // ชื่อผู้ติดต่อ
  CustomerEmail?: string
  ProjectID?: number
  Company?: string
}

export interface ProjectLike {
  id: number
  Title: string
  Company?: string
  Status?: string
}

export interface CustomerGroup {
  key: string               // 'proj-12'
  projectId: number
  label: string             // '#VDI · 5 คน'
  emails: string[]
}

export interface CustomerOption {
  value: string
  label: string
}

const clean = (e?: string): string => (e ?? '').trim()

/** ผู้ติดต่อของโครงการหนึ่ง เรียงตามชื่อ ไม่ซ้ำอีเมล */
export function customersOf(members: ProjectCustomer[], projectId: number): ProjectCustomer[] {
  const seen = new Set<string>()
  return members
    .filter(m => m.ProjectID === projectId && clean(m.CustomerEmail))
    .filter(m => {
      const k = clean(m.CustomerEmail).toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => (a.Title ?? '').localeCompare(b.Title ?? '', 'th'))
}

/**
 * กลุ่มที่เลือกได้ — เฉพาะโครงการที่มีผู้ติดต่ออยู่จริง
 * โครงการที่ยังไม่ได้ใส่ใครไว้ ไม่ต้องโผล่ให้กดแล้วไม่เกิดอะไร
 */
export function buildGroups(projects: ProjectLike[], members: ProjectCustomer[]): CustomerGroup[] {
  return projects
    .map(p => {
      const emails = customersOf(members, p.id).map(m => clean(m.CustomerEmail))
      return { key: `proj-${p.id}`, projectId: p.id, label: `${p.Title} · ${emails.length} คน`, emails }
    })
    .filter(g => g.emails.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label, 'th'))
}

/** กลุ่มนี้ถูกเลือกครบทุกคนแล้วหรือยัง — ใช้ตัดสินว่าการกดคือเพิ่มหรือเอาออก */
export const groupFullySelected = (group: CustomerGroup, selected: string[]): boolean => {
  const set = new Set(selected.map(e => e.toLowerCase()))
  return group.emails.length > 0 && group.emails.every(e => set.has(e.toLowerCase()))
}

/**
 * ผลลัพธ์หลังกดกลุ่ม — ครบอยู่แล้วคือเอาออก ไม่ครบคือเติมให้ครบ
 * เติมแบบไม่แตะคนที่เลือกไว้เองนอกกลุ่ม เพราะคนพวกนั้นตั้งใจเลือกมา
 */
export function toggleGroup(group: CustomerGroup, selected: string[]): string[] {
  const lower = new Set(group.emails.map(e => e.toLowerCase()))
  if (groupFullySelected(group, selected)) {
    return selected.filter(e => !lower.has(e.toLowerCase()))
  }
  const have = new Set(selected.map(e => e.toLowerCase()))
  return [...selected, ...group.emails.filter(e => !have.has(e.toLowerCase()))]
}

/**
 * รายชื่อลูกค้ารายคนสำหรับ dropdown — รวมจากสัญญาและจากผู้ติดต่อในโครงการ
 * ผู้ติดต่อในโครงการต้องอยู่ในลิสต์ด้วย ไม่งั้นเลือกกลุ่มมาแล้วจะเห็นอีเมลที่ไม่มีชื่อกำกับ
 */
export function customerOptions(
  contracts: Array<{ Title?: string; Company?: string; CustomerEmail?: string }>,
  members: ProjectCustomer[],
): CustomerOption[] {
  const out: CustomerOption[] = []
  const seen = new Set<string>()
  const add = (email: string, name: string, company?: string) => {
    const e = clean(email)
    if (!e || seen.has(e.toLowerCase())) return
    seen.add(e.toLowerCase())
    out.push({ value: e, label: company ? `${name} (${company})` : name })
  }
  for (const c of contracts) add(clean(c.CustomerEmail), c.Title || clean(c.CustomerEmail), c.Company)
  for (const m of members) add(clean(m.CustomerEmail), m.Title || clean(m.CustomerEmail), m.Company)
  return out
}

/**
 * ลูกค้าในทะเบียนที่ยังไม่ได้อยู่ในโครงการนี้ (กรองด้วยคำค้นได้)
 * ที่ต้องตัดคนที่เพิ่มไปแล้วออก เพราะโชว์ให้กดซ้ำก็ได้แค่รายการซ้ำในกลุ่ม
 */
export function availableContacts<T extends { Title?: string; Company?: string; CustomerEmail?: string }>(
  contacts: T[],
  already: ProjectCustomer[],
  query = '',
): T[] {
  const taken = new Set(already.map(m => clean(m.CustomerEmail).toLowerCase()))
  const q = query.trim().toLowerCase()
  return contacts.filter(c => {
    const email = clean(c.CustomerEmail)
    if (!email || taken.has(email.toLowerCase())) return false
    if (!q) return true
    return [c.Title, c.Company, email].some(v => (v ?? '').toLowerCase().includes(q))
  })
}
