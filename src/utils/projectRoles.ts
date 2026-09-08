// บทบาทและความรับผิดชอบของคนในโครงการ
//
// ทีมที่ถูก invite เข้าโครงการเดิมรู้แค่ "อยู่ในทีม" ซึ่งบอกอะไรไม่ได้เลยว่าใครทำอะไร
// พอโครงการเยอะขึ้น คำถามที่ตอบไม่ได้คือ "คนนี้รับผิดชอบอะไรอยู่บ้าง" และ
// "โครงการนี้ใครเป็นคนตัดสินใจ" — ต้องไปถามกันเอง
//
// เก็บบทบาทไว้ที่แถวสมาชิกเดิม (PM_ProjectMembers) ไม่สร้างลิสต์ใหม่
// เพราะคนหนึ่งต่อหนึ่งโครงการมีบทบาทเดียว ถ้าแยกลิสต์จะมีสองที่ที่ต้องตรงกัน

/** บทบาทตั้งต้น — แก้เพิ่มได้ที่หน้า Admin (HD_Options หมวด ProjectRole) */
export const PROJECT_ROLES = [
  'Manager',
  'Assistant',
  'Support',
  'Publisher',
  'Reviewer',
  'Observer',
] as const

export const UNASSIGNED_ROLE = 'ยังไม่กำหนด'

/** ลำดับความรับผิดชอบ — เลขน้อยมาก่อน ที่ไม่รู้จักไปท้ายสุดแต่ยังอยู่ก่อน "ยังไม่กำหนด" */
const RANK: Record<string, number> = {
  Manager: 0, Assistant: 1, Support: 2, Publisher: 3, Reviewer: 4, Observer: 5,
}

export function roleRank(role?: string): number {
  const r = (role ?? '').trim()
  if (!r) return 99                       // ยังไม่กำหนด — ท้ายสุด เพราะเป็นสิ่งที่ต้องไปตามให้ครบ
  return RANK[r] ?? 50                    // บทบาทที่ตั้งเพิ่มเอง — กลาง ๆ เรียงตามตัวอักษรต่อ
}

export interface MemberLike {
  id: number
  Title?: string
  ProjectID?: number
  AgentEmail?: string
  Role?: string
  Responsibility?: string
}

export interface ProjectLike {
  id: number
  Title: string
  Company?: string
  Status?: string
}

/** บทบาทหนึ่งบรรทัด: คนนี้ทำอะไรในโครงการไหน */
export interface RoleAssignment {
  memberId: number
  projectId: number
  projectTitle: string
  projectStatus?: string
  role: string
  responsibility: string
}

/** ทุกอย่างของคนหนึ่งคน — ใช้ในมุมมองบทบาทที่หน้าผังองค์กร */
export interface PersonRoles {
  email: string
  name: string
  assignments: RoleAssignment[]
  /** บทบาทที่ "สูงสุด" ที่คนนี้ถืออยู่ — ใช้เรียงคนและติดป้ายสรุป */
  topRole: string
  activeCount: number
}

const norm = (e?: string): string => (e ?? '').trim().toLowerCase()
const DONE_PROJECT = ['Completed', 'Cancelled']

/** บทบาทของสมาชิกในโครงการหนึ่ง เรียงตามความรับผิดชอบแล้วตามชื่อ */
export function membersOf(members: MemberLike[], projectId: number): MemberLike[] {
  return members
    .filter(m => m.ProjectID === projectId && norm(m.AgentEmail))
    .sort((a, b) =>
      roleRank(a.Role) - roleRank(b.Role) ||
      (a.Role ?? '').localeCompare(b.Role ?? '', 'th') ||
      (a.Title ?? '').localeCompare(b.Title ?? '', 'th'))
}

/**
 * รวมเป็นรายคน — คนหนึ่งอยู่ได้หลายโครงการ และคนละบทบาทในแต่ละที่
 *
 * สมาชิกที่ชี้ไปโครงการที่ถูกลบแล้วจะถูกตัดออก ไม่แสดงเป็นบรรทัดที่กดไม่ได้
 */
export function buildRoleMatrix(projects: ProjectLike[], members: MemberLike[]): PersonRoles[] {
  const byId = new Map(projects.map(p => [p.id, p]))
  const people = new Map<string, PersonRoles>()

  for (const m of members) {
    const email = norm(m.AgentEmail)
    const proj = m.ProjectID != null ? byId.get(m.ProjectID) : undefined
    if (!email || !proj) continue

    const entry = people.get(email) ?? {
      email: (m.AgentEmail ?? '').trim(),
      name: m.Title?.trim() || (m.AgentEmail ?? '').trim(),
      assignments: [],
      topRole: UNASSIGNED_ROLE,
      activeCount: 0,
    }
    // บางแถวไม่มีชื่อ เหลือแต่อีเมล — ถ้าแถวอื่นมีชื่อจริงให้ใช้ชื่อนั้น
    if (entry.name.includes('@') && m.Title?.trim()) entry.name = m.Title.trim()

    entry.assignments.push({
      memberId: m.id,
      projectId: proj.id,
      projectTitle: proj.Title,
      projectStatus: proj.Status,
      role: (m.Role ?? '').trim() || UNASSIGNED_ROLE,
      responsibility: (m.Responsibility ?? '').trim(),
    })
    people.set(email, entry)
  }

  for (const p of people.values()) {
    p.assignments.sort((a, b) =>
      roleRank(a.role === UNASSIGNED_ROLE ? '' : a.role) - roleRank(b.role === UNASSIGNED_ROLE ? '' : b.role) ||
      a.projectTitle.localeCompare(b.projectTitle, 'th'))
    p.topRole = p.assignments[0]?.role ?? UNASSIGNED_ROLE
    // นับเฉพาะโครงการที่ยังเดินอยู่ — "ถืออยู่ 5 โครงการ" ต้องไม่รวมของที่จบแล้ว
    p.activeCount = p.assignments.filter(a => !DONE_PROJECT.includes(a.projectStatus ?? '')).length
  }

  return [...people.values()].sort((a, b) =>
    roleRank(a.topRole === UNASSIGNED_ROLE ? '' : a.topRole) - roleRank(b.topRole === UNASSIGNED_ROLE ? '' : b.topRole) ||
    b.activeCount - a.activeCount ||
    a.name.localeCompare(b.name, 'th'))
}

/** จำนวนคนต่อบทบาท (นับซ้ำได้ถ้าคนเดียวถือหลายบทบาท) — ใช้เป็นแถบสรุปด้านบน */
export function roleTally(people: PersonRoles[]): Array<{ role: string; count: number }> {
  const tally = new Map<string, number>()
  for (const p of people) {
    for (const a of p.assignments) tally.set(a.role, (tally.get(a.role) ?? 0) + 1)
  }
  return [...tally.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) =>
      roleRank(a.role === UNASSIGNED_ROLE ? '' : a.role) - roleRank(b.role === UNASSIGNED_ROLE ? '' : b.role) ||
      a.role.localeCompare(b.role, 'th'))
}

/** ค้นหาในมุมมองบทบาท — ชื่อ อีเมล บทบาท ชื่อโครงการ หรือข้อความความรับผิดชอบ */
export function filterPeople(people: PersonRoles[], query: string): PersonRoles[] {
  const q = query.trim().toLowerCase()
  if (!q) return people
  return people.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.email.toLowerCase().includes(q) ||
    p.assignments.some(a =>
      a.role.toLowerCase().includes(q) ||
      a.projectTitle.toLowerCase().includes(q) ||
      a.responsibility.toLowerCase().includes(q)))
}

/** โครงการที่ยังไม่มีใครเป็น Manager — ช่องว่างที่ควรรู้ ไม่ใช่ปล่อยให้เงียบ */
export function projectsWithoutManager(projects: ProjectLike[], members: MemberLike[]): ProjectLike[] {
  return projects
    .filter(p => !DONE_PROJECT.includes(p.Status ?? ''))
    .filter(p => !members.some(m => m.ProjectID === p.id && (m.Role ?? '').trim() === 'Manager'))
}

/** บทบาทตั้งต้นของคนที่สร้างโครงการ — เป็นคนรับผิดชอบจนกว่าจะส่งต่อให้คนอื่น */
export const OWNER_DEFAULT_ROLE = 'Manager'

/**
 * เจ้าของโครงการยังไม่อยู่ในทีมหรือไม่
 *
 * คนสร้างโครงการเข้าดูได้อยู่แล้วเพราะเช็คจาก CreatedByEmail แต่ไม่ได้เป็นแถวใน
 * PM_ProjectMembers จึงหายไปจากรายชื่อทีม แท็บบทบาท และมุมมองบทบาท
 * ทั้งที่เป็นคนที่รับผิดชอบโครงการนั้นอยู่
 */
export function ownerMissingFromTeam(
  members: MemberLike[],
  projectId: number,
  ownerEmail?: string,
): boolean {
  const owner = norm(ownerEmail)
  if (!owner) return false          // ไม่รู้ว่าใครเป็นเจ้าของ ก็ไม่มีอะไรให้เติม
  return !members.some(m => m.ProjectID === projectId && norm(m.AgentEmail) === owner)
}
