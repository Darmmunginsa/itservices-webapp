// เลือกดูเฉพาะบางสายบังคับบัญชาในผังองค์กร
//
// ปัญหา: พอคนเยอะ ผังทั้งใบกว้างจนต้องเลื่อนซ้ายขวาหาสายที่อยากดู
// การย่อกิ่งอื่นทีละกิ่งช่วยได้ แต่ต้องกดหลายครั้งและต้องจำว่าย่ออะไรไว้บ้าง
//
// วิธีนี้คือ "เลือกหัวสาย" แล้ววาดเฉพาะสายนั้นเป็นผังใบเล็ก ๆ ใบเดียว
// ตัวโครงสร้างไม่ถูกแก้ — แค่เปลี่ยนจุดเริ่มวาด กลับมาดูทั้งใบได้ทุกเมื่อ

export interface OrgPerson {
  EmailText?: string
  ApproverEmail?: string
  Title?: string
}

const norm = (e?: string) => (e ?? '').trim().toLowerCase()

export interface OrgTree<T> {
  /** อีเมลของคนที่อยู่บนสุด (รวมคนที่สายวนกลับมาหาตัวเอง ต่อท้าย) */
  roots: string[]
  childrenOf: Map<string, string[]>
  /** ผู้บังคับบัญชาของแต่ละคน — ใช้ไล่ขึ้นเพื่อทำ breadcrumb */
  parentOf: Map<string, string>
  byEmail: Map<string, T>
  /** คนที่สายบังคับบัญชาวนกลับมาที่ตัวเอง จึงถูกยกขึ้นเป็นระดับสูงสุด */
  orphans: Set<string>
}

/**
 * สร้างโครงต้นไม้จากช่อง "ผู้อนุมัติ"
 *
 * เป็นระดับสูงสุดเมื่อ: ไม่ได้กำหนดผู้อนุมัติ / อนุมัติเอง / ชี้กลับมาที่ตัวเอง
 * หรือผู้อนุมัติไม่มีอยู่ในรายชื่อ (ไม่งั้นคนนั้นจะหายไปจากผังทั้งใบ)
 */
export function buildOrgTree<T extends OrgPerson>(people: T[], selfApprove?: string): OrgTree<T> {
  const byEmail = new Map<string, T>()
  for (const p of people) if (norm(p.EmailText)) byEmail.set(norm(p.EmailText), p)

  const childrenOf = new Map<string, string[]>()
  const parentOf = new Map<string, string>()
  const roots: string[] = []

  for (const p of people) {
    const me = norm(p.EmailText)
    if (!me) continue
    const boss = norm(p.ApproverEmail)
    if (!boss || boss === norm(selfApprove) || boss === me || !byEmail.has(boss)) {
      roots.push(me)
    } else {
      const arr = childrenOf.get(boss) ?? []
      arr.push(me)
      childrenOf.set(boss, arr)
      parentOf.set(me, boss)
    }
  }

  // กันข้อมูลวน (A→B→A) ทำให้บางคนหลุดจากผัง — คนที่เดินจาก root ไม่ถึง ให้ยกขึ้นเป็น root
  const reachable = new Set<string>()
  const queue = [...roots]
  while (queue.length) {
    const cur = queue.shift()!
    if (reachable.has(cur)) continue
    reachable.add(cur)
    for (const k of childrenOf.get(cur) ?? []) queue.push(k)
  }
  const orphans = [...byEmail.keys()].filter(e => !reachable.has(e))

  const sortByName = (a: string, b: string) =>
    (byEmail.get(a)?.Title ?? '').localeCompare(byEmail.get(b)?.Title ?? '', 'th')
  roots.sort(sortByName)
  for (const [, arr] of childrenOf) arr.sort(sortByName)

  return { roots: [...roots, ...orphans], childrenOf, parentOf, byEmail, orphans: new Set(orphans) }
}

/** จำนวนคนใต้บังคับบัญชาทั้งสาย (ไม่นับตัวเอง) — visited กันข้อมูลวนทำให้นับไม่จบ */
export function subtreeSize(email: string, childrenOf: Map<string, string[]>): number {
  let n = 0
  const seen = new Set<string>([email])
  const queue = [...(childrenOf.get(email) ?? [])]
  while (queue.length) {
    const cur = queue.shift()!
    if (seen.has(cur)) continue
    seen.add(cur)
    n++
    for (const k of childrenOf.get(cur) ?? []) queue.push(k)
  }
  return n
}

export interface BranchOption {
  email: string
  name: string
  /** ลึกจากระดับสูงสุดกี่ชั้น — ใช้ย่อหน้าในรายการให้เห็นว่าใครอยู่ใต้ใคร */
  depth: number
  /** จำนวนลูกน้องทั้งสาย */
  size: number
}

/**
 * รายชื่อ "หัวสาย" ที่เลือกดูได้ — เฉพาะคนที่มีลูกน้อง
 * คนที่ไม่มีลูกน้องเลือกไปก็ได้ผังใบเดียว ซึ่งไม่ใช่การดูสาย
 * เรียงตามลำดับที่วาดในผัง เพื่อให้รายการอ่านคู่กับผังได้
 */
export function branchOptions<T extends OrgPerson>(tree: OrgTree<T>): BranchOption[] {
  const out: BranchOption[] = []
  const visit = (email: string, depth: number, visited: Set<string>) => {
    if (visited.has(email)) return
    const next = new Set(visited).add(email)
    const kids = tree.childrenOf.get(email) ?? []
    if (kids.length > 0) {
      out.push({
        email,
        name: tree.byEmail.get(email)?.Title || email,
        depth,
        size: subtreeSize(email, tree.childrenOf),
      })
    }
    for (const k of kids) visit(k, depth + 1, next)
  }
  for (const r of tree.roots) visit(r, 0, new Set())
  return out
}

/**
 * ทางเดินจากบนสุดลงมาถึงคนนี้ — ใช้ทำ breadcrumb ตอนดูเฉพาะสาย
 * เพื่อไม่ให้หลงว่าสายที่กำลังดูอยู่ตรงไหนขององค์กร
 */
export function pathToRoot(email: string, parentOf: Map<string, string>): string[] {
  const path = [email]
  const seen = new Set<string>([email])
  let cur = email
  for (;;) {
    const up = parentOf.get(cur)
    if (!up || seen.has(up)) break
    path.unshift(up)
    seen.add(up)
    cur = up
  }
  return path
}

/**
 * จุดเริ่มวาดผัง — เลือกสายไหนก็วาดจากคนนั้น ไม่ได้เลือกก็วาดทั้งใบ
 * คนที่เลือกไว้แล้วหายไปจากรายชื่อ (ลาออก/แก้ผู้อนุมัติ) ให้กลับไปทั้งใบ
 * ดีกว่าจอว่างเปล่าโดยไม่บอกอะไร
 */
export function visibleRoots<T extends OrgPerson>(tree: OrgTree<T>, branch: string): string[] {
  const key = norm(branch)
  if (!key || !tree.byEmail.has(key)) return tree.roots
  return [key]
}
