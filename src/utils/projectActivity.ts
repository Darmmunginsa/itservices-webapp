// ป้าย "มีอัปเดต" บนโปรเจกต์ที่ร่วมทีม
//
// ปัญหา: รายการโปรเจกต์ที่ร่วมทีมเป็นชิปเรียบ ๆ ไม่มีอะไรบอกว่าอันไหนขยับ
// ต้องเข้าไปดูทีละอันจึงจะรู้ ซึ่งไม่มีใครทำ แล้วก็เลยไม่รู้ว่าเกิดอะไรขึ้นในโครงการ
//
// SharePoint ไม่ขยับ Modified ของแถวโปรเจกต์เมื่อมีคนเพิ่ม task/คอมเมนต์
// ดังนั้นดูแค่ Modified ของโปรเจกต์จะเงียบเสมอ — ต้องดูของลูกด้วย
// และต้องบอกได้ว่า "อะไร" อัปเดต ไม่ใช่แค่ว่ามีอะไรอัปเดต ไม่งั้นก็ยังต้องเข้าไปหาเอง

/** ที่เก็บเวลาที่เปิดแต่ละโปรเจกต์ล่าสุด — ประกาศที่เดียว ให้หน้าที่อ่านและหน้าที่เขียนตรงกัน */
export const SEEN_KEY = 'hdProjectSeen'

export type ActivityKind = 'task' | 'incident' | 'comment' | 'project'

export interface ActivityRow {
  ProjectID?: number
  Modified?: string
  Created?: string
}

export interface ProjectActivity {
  /** เวลาที่ขยับล่าสุด (ISO) — ว่างถ้าไม่รู้ */
  at: string
  kind: ActivityKind
}

const LABEL: Record<ActivityKind, string> = {
  task: 'งานใหม่',
  incident: 'เคสใหม่',
  comment: 'คอมเมนต์ใหม่',
  project: 'แก้ข้อมูล',
}

export const activityLabel = (kind: ActivityKind): string => LABEL[kind]

const stamp = (r: ActivityRow): string => r.Modified || r.Created || ''

/** เวลาที่ขยับล่าสุดของแต่ละโปรเจกต์ พร้อมบอกว่าอะไรขยับ */
export function latestActivity(
  projects: Array<{ id: number; Modified?: string; Created?: string }>,
  tasks: ActivityRow[],
  incidents: ActivityRow[],
  comments: ActivityRow[],
): Map<number, ProjectActivity> {
  const out = new Map<number, ProjectActivity>()

  const consider = (projectId: number | undefined, at: string, kind: ActivityKind) => {
    if (projectId == null || !at) return
    const cur = out.get(projectId)
    // เท่ากันให้ของเดิมชนะ — ลูกถูกพิจารณาหลังตัวโปรเจกต์ จึงได้ป้ายที่เจาะจงกว่า
    if (!cur || at > cur.at) out.set(projectId, { at, kind })
  }

  for (const p of projects) consider(p.id, stamp(p), 'project')
  for (const t of tasks) consider(t.ProjectID, stamp(t), 'task')
  for (const i of incidents) consider(i.ProjectID, stamp(i), 'incident')
  for (const c of comments) consider(c.ProjectID, stamp(c), 'comment')

  return out
}

/**
 * มีอัปเดตที่เรายังไม่เห็นไหม
 *
 * ไม่เคยเปิดเลย = ไม่ติดป้าย ไม่ใช่ติดทุกอัน — ถ้าติดทั้งกระดานตั้งแต่วันแรก
 * คนจะเลิกมองป้ายนี้ทันที ซึ่งแย่กว่าไม่มีป้าย
 */
export function hasUpdate(activityAt?: string, lastSeenAt?: string): boolean {
  if (!activityAt || !lastSeenAt) return false
  return activityAt > lastSeenAt
}

export type SeenMap = Record<string, string>

/** อ่านเวลาที่เคยเปิดแต่ละโปรเจกต์ — ค่าเสียหายให้ถือว่าไม่เคยเปิด ไม่ใช่พังทั้งหน้า */
export function readSeen(raw: string | null): SeenMap {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: SeenMap = {}
    for (const [k, at] of Object.entries(v as Record<string, unknown>)) {
      if (typeof at === 'string' && at) out[k] = at
    }
    return out
  } catch { return {} }
}

/** บันทึกว่าเปิดโปรเจกต์นี้แล้ว — เวลาเดินหน้าเท่านั้น */
export function markSeen(seen: SeenMap, projectId: number, at: string): SeenMap {
  const key = String(projectId)
  if (seen[key] && seen[key] >= at) return seen
  return { ...seen, [key]: at }
}

/**
 * ตั้งเส้นฐานให้โปรเจกต์ที่ยังไม่มีบันทึกว่าเคยเปิด
 * ใช้ตอนโหลดครั้งแรก เพื่อไม่ให้ป้ายขึ้นพร้อมกันทั้งกระดาน
 */
export function baselineUnseen(seen: SeenMap, projectIds: number[], at: string): SeenMap {
  let next = seen
  for (const id of projectIds) {
    const key = String(id)
    if (!next[key]) next = { ...next, [key]: at }
  }
  return next
}

/** จำนวนโปรเจกต์ที่มีอัปเดต — ใช้ขึ้นตัวเลขบนหัวข้อ */
export function countUpdated(
  projectIds: number[],
  activity: Map<number, ProjectActivity>,
  seen: SeenMap,
): number {
  return projectIds.filter(id => hasUpdate(activity.get(id)?.at, seen[String(id)])).length
}
