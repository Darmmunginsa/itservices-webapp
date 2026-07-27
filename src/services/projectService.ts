import { spGet, spDelete } from './sharepoint'

// ── ลบโครงการพร้อมข้อมูลลูกทั้งหมด (cascade) ──
// SharePoint ไม่มี FK cascade → ต้องไล่ลบเอง ไม่งั้นเหลือข้อมูลกำพร้าค้างในลิสต์
// ลิสต์ลูกทั้งหมดผูกด้วยคอลัมน์ ProjectID (Number)
const CHILD_LISTS = [
  'PM_Tasks',
  'PM_Notes',
  'PM_Incidents',
  'PM_Links',
  'PM_ProjectAssets',
  'PM_ProjectMembers',
  'PM_Comments',
] as const

export interface ProjectChildCounts { list: string; count: number }

/** นับข้อมูลลูกของโครงการ — ใช้แสดงในกล่องยืนยันก่อนลบ */
export async function countProjectChildren(projectId: number): Promise<ProjectChildCounts[]> {
  const results = await Promise.all(CHILD_LISTS.map(async list => {
    try {
      const rows = await spGet<{ id: number }>(list, `ProjectID eq ${projectId}`, 'Id', undefined, 2000)
      return { list, count: rows.length }
    } catch { return { list, count: 0 } }   // ลิสต์ยังไม่มี → ข้าม
  }))
  return results.filter(r => r.count > 0)
}

/** ลบโครงการ + ข้อมูลลูกทั้งหมด ; คืนจำนวนรายการลูกที่ลบไป */
export async function deleteProjectCascade(projectId: number): Promise<number> {
  let deleted = 0
  for (const list of CHILD_LISTS) {
    let rows: { id: number }[] = []
    try { rows = await spGet<{ id: number }>(list, `ProjectID eq ${projectId}`, 'Id', undefined, 2000) }
    catch { continue }   // ลิสต์ยังไม่ถูกสร้าง → ข้าม
    for (const r of rows) {
      try { await spDelete(list, r.id); deleted++ } catch { /* ลบไม่ได้ทีละรายการ — ข้ามไป ไม่ให้ค้างทั้งชุด */ }
    }
  }
  // ลบตัวโครงการเป็นลำดับสุดท้าย (ถ้าพลาดตรงนี้จะ throw ให้ UI แจ้ง)
  await spDelete('PM_Projects', projectId)
  return deleted
}
