// ตรรกะของหน้าจัดการสิทธิ์เข้าถึงหน้า (รายคน) — แยกไว้ให้ทดสอบได้
//
// ปัญหาที่หน้านี้แก้: เดิมเป็นตารางคน × หน้า 21 คอลัมน์ ต้องเลื่อนแนวนอนจนสุด
// และบันทึกได้ทีละคน — ตัว "แก้แล้วยังไม่บันทึก" คือหัวใจของการบันทึกทีเดียวหลายคน
// ถ้าเทียบผิด จะบันทึกคนที่ไม่ได้แก้ (เสียเวลา) หรือข้ามคนที่แก้ (หายเงียบ)

/** "projects, dashboard ,, tools" → ['projects','dashboard','tools'] */
export const parseKeys = (raw?: string): string[] =>
  (raw ?? '').split(',').map(s => s.trim()).filter(Boolean)

export const sameKeys = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every(k => b.has(k))

/**
 * อีเมลของคนที่ร่างต่างจากที่บันทึกไว้
 * คนที่ยังไม่มีแถวสิทธิ์และร่างยังว่าง = ไม่ต่าง (ไม่มีอะไรให้บันทึก)
 */
export function dirtyEmails(draft: Map<string, Set<string>>, saved: Map<string, Set<string>>): string[] {
  const out: string[] = []
  for (const [em, keys] of draft) {
    const was = saved.get(em) ?? new Set<string>()
    if (!sameKeys(keys, was)) out.push(em)
  }
  return out
}

export type PageGroup = 'main' | 'work' | 'resources' | 'system'

export const GROUP_LABEL: Record<PageGroup, string> = {
  main: 'หน้าหลัก',
  work: 'งาน',
  resources: 'ข้อมูล / ทะเบียน',
  system: 'ระบบ',
}

const GROUP_ORDER: PageGroup[] = ['main', 'work', 'resources', 'system']

/** จัดหน้าตามกลุ่ม เรียงลำดับตายตัว — กลุ่มที่ไม่มีหน้าจะไม่โผล่ */
export function groupPages<T extends { group: PageGroup }>(pages: T[]): Array<{ group: PageGroup; pages: T[] }> {
  return GROUP_ORDER
    .map(group => ({ group, pages: pages.filter(p => p.group === group) }))
    .filter(g => g.pages.length > 0)
}
