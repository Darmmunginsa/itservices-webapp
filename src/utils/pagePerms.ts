// ตรรกะของหน้าจัดการสิทธิ์เข้าถึงหน้า (รายคน) — แยกไว้ให้ทดสอบได้
//
// ปัญหาที่หน้านี้แก้: เดิมเป็นตารางคน × หน้า 21 คอลัมน์ ต้องเลื่อนแนวนอนจนสุด
// และบันทึกได้ทีละคน — ตัว "แก้แล้วยังไม่บันทึก" คือหัวใจของการบันทึกทีเดียวหลายคน
// ถ้าเทียบผิด จะบันทึกคนที่ไม่ได้แก้ (เสียเวลา) หรือข้ามคนที่แก้ (หายเงียบ)

// ── สิทธิ์ "แก้ไข" ต่อหน้า ──
// เก็บในคอลัมน์เดิม AllowedPages:  'assets' = เข้าดูได้ · 'assets:edit' = ดูได้ + แก้ไขได้
// ไม่ต้องเพิ่มคอลัมน์ใน SharePoint และแถวเก่า (ไม่มี :edit) ยังอ่านได้เหมือนเดิม = ดูอย่างเดียว
// "แก้ไขได้" = ทำได้เท่าที่ role ระดับ agent/supervisor ทำได้ในหน้านั้น (เพิ่ม/แก้/จัดการ)
// เป็นการ "เพิ่มให้" อย่างเดียว — คนที่ role ทำได้อยู่แล้ว ไม่มีทางเสียสิทธิ์จากช่องนี้
export const EDIT_SUFFIX = ':edit'

export interface Grants {
  view: Set<string>
  edit: Set<string>
}

export const emptyGrants = (): Grants => ({ view: new Set(), edit: new Set() })

/** "projects, assets:edit ,, tools" → view {projects,assets,tools} · edit {assets} */
export function parseGrants(raw?: string): Grants {
  const g = emptyGrants()
  for (const tok of (raw ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
    if (tok.endsWith(EDIT_SUFFIX)) {
      const k = tok.slice(0, -EDIT_SUFFIX.length)
      if (k) { g.view.add(k); g.edit.add(k) }
    } else {
      g.view.add(tok)
    }
  }
  return g
}

/** "projects, dashboard ,, tools" → ['projects','dashboard','tools'] (เฉพาะหน้าที่เข้าดูได้) */
export const parseKeys = (raw?: string): string[] => [...parseGrants(raw).view]

/** แก้ไขได้ = เข้าดูได้เสมอ — ถ้าติ๊กแก้แต่ไม่ติ๊กดู ก็บันทึกเป็นดู+แก้ */
export function serializeGrants(g: Grants): string {
  const keys = new Set([...g.view, ...g.edit])
  return [...keys].filter(Boolean).map(k => (g.edit.has(k) ? k + EDIT_SUFFIX : k)).join(',')
}

export const sameKeys = (a: Set<string>, b: Set<string>): boolean =>
  a.size === b.size && [...a].every(k => b.has(k))

export const sameGrants = (a: Grants, b: Grants): boolean =>
  sameKeys(a.view, b.view) && sameKeys(a.edit, b.edit)

/**
 * อีเมลของคนที่ร่างต่างจากที่บันทึกไว้
 * คนที่ยังไม่มีแถวสิทธิ์และร่างยังว่าง = ไม่ต่าง (ไม่มีอะไรให้บันทึก)
 */
export function dirtyEmails(draft: Map<string, Grants>, saved: Map<string, Grants>): string[] {
  const out: string[] = []
  for (const [em, g] of draft) {
    const was = saved.get(em) ?? emptyGrants()
    if (!sameGrants(g, was)) out.push(em)
  }
  return out
}

/**
 * แก้ไขในหน้านี้ได้ไหม — role เดิมทำได้ หรือ Admin ติ๊ก "แก้ไข" ให้รายคน
 * ตอนโหลดสิทธิ์ไม่เสร็จ (null) ถือว่ายังไม่ได้ — ไม่โชว์ปุ่มแล้วดึงกลับ
 */
export function canEditPage(roleAllowed: boolean, editPages: Set<string> | null | undefined, key: string): boolean {
  return roleAllowed || (editPages?.has(key) ?? false)
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
