// ตะกร้าเก็บแบบ sub-tree — สร้างชั้นได้เองไม่จำกัด ใช้กับคลังแหล่งอ้างอิง
// เก็บใน SharePoint แบบแบน (Id + ParentID) แล้วประกอบเป็นต้นไม้ฝั่ง client
//
// ทุกฟังก์ชันเป็น pure และต้องทนกับข้อมูลพัง: parent ที่ถูกลบไปแล้ว, วงวน (a→b→a)
// ซึ่งเกิดได้จริงถ้าใครไปแก้ลิสต์ใน SharePoint ตรง ๆ

export interface FolderRow {
  id: number
  Title: string
  ParentID?: number      // 0 / undefined = อยู่ชั้นบนสุด
  SortOrder?: number
}

export interface FolderNode {
  id: number
  name: string
  parentId: number
  children: FolderNode[]
  depth: number
}

export const ROOT = 0

const nameOf = (r: FolderRow) => (r.Title ?? '').trim() || '(ไม่มีชื่อ)'
const parentOf = (r: FolderRow) => Number(r.ParentID ?? ROOT) || ROOT

/**
 * ประกอบต้นไม้จากแถวแบน
 * - โฟลเดอร์ที่ parent หายไป (ถูกลบ) จะถูกยกขึ้นชั้นบนสุด ไม่ใช่หายไปทั้งกิ่ง
 * - วงวนจะถูกตัดโดยยกตัวที่วนขึ้นชั้นบนสุด ไม่ให้ recursive จนกอง
 */
export function buildTree(rows: FolderRow[]): FolderNode[] {
  const byId = new Map<number, FolderRow>()
  for (const r of rows) byId.set(r.id, r)

  /** ไล่ขึ้นไปหารากจริง — เจอวงวนหรือ parent หาย ให้ถือว่าอยู่ราก */
  const effectiveParent = (r: FolderRow): number => {
    const p = parentOf(r)
    if (p === ROOT) return ROOT
    if (!byId.has(p)) return ROOT              // parent ถูกลบไปแล้ว
    const seen = new Set<number>([r.id])
    let cur = byId.get(p)
    while (cur) {
      if (seen.has(cur.id)) return ROOT        // วงวน
      seen.add(cur.id)
      const np = parentOf(cur)
      if (np === ROOT || !byId.has(np)) break
      cur = byId.get(np)
    }
    return p
  }

  const nodes = new Map<number, FolderNode>()
  for (const r of rows) {
    nodes.set(r.id, { id: r.id, name: nameOf(r), parentId: effectiveParent(r), children: [], depth: 0 })
  }

  const roots: FolderNode[] = []
  for (const n of nodes.values()) {
    if (n.parentId === ROOT) roots.push(n)
    else nodes.get(n.parentId)!.children.push(n)
  }

  const order = new Map(rows.map(r => [r.id, r.SortOrder ?? 0]))
  const sortRec = (list: FolderNode[], depth: number) => {
    list.sort((a, b) =>
      (order.get(a.id)! - order.get(b.id)!) || a.name.localeCompare(b.name, 'th'))
    for (const n of list) { n.depth = depth; sortRec(n.children, depth + 1) }
  }
  sortRec(roots, 0)
  return roots
}

/** แผ่ต้นไม้เป็นรายการเรียงตามที่เห็นบนจอ (ไว้ทำ dropdown / รายการที่กางอยู่) */
export function flatten(tree: FolderNode[], expanded?: Set<number>): FolderNode[] {
  const out: FolderNode[] = []
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      out.push(n)
      if (!expanded || expanded.has(n.id)) walk(n.children)
    }
  }
  walk(tree)
  return out
}

export const findNode = (tree: FolderNode[], id: number): FolderNode | null => {
  for (const n of flatten(tree)) if (n.id === id) return n
  return null
}

/** id ของตัวเองและลูกหลานทั้งหมด — ใช้ตอน "รวมโฟลเดอร์ย่อย" และตอนลบ */
export function subtreeIds(tree: FolderNode[], id: number): number[] {
  const start = findNode(tree, id)
  if (!start) return []
  const out: number[] = []
  const walk = (n: FolderNode) => { out.push(n.id); n.children.forEach(walk) }
  walk(start)
  return out
}

/** เส้นทางจากรากถึงโฟลเดอร์นี้ — ใช้ทำ breadcrumb */
export function pathOf(tree: FolderNode[], id: number): FolderNode[] {
  const path: FolderNode[] = []
  const walk = (list: FolderNode[], trail: FolderNode[]): boolean => {
    for (const n of list) {
      const next = [...trail, n]
      if (n.id === id) { path.push(...next); return true }
      if (walk(n.children, next)) return true
    }
    return false
  }
  walk(tree, [])
  return path
}

export const pathLabel = (tree: FolderNode[], id: number, sep = ' / '): string =>
  pathOf(tree, id).map(n => n.name).join(sep)

/**
 * ย้ายโฟลเดอร์ไปอยู่ใต้ parent ใหม่ได้ไหม
 * ห้ามย้ายเข้าไปในตัวเองหรือลูกหลานของตัวเอง — จะได้กิ่งที่ลอยหลุดจากต้นไม้
 * และหายไปจากหน้าจอทั้งกิ่งทันที
 */
export function canMove(tree: FolderNode[], id: number, newParent: number): boolean {
  if (id === newParent) return false
  if (newParent === ROOT) return true
  return !subtreeIds(tree, id).includes(newParent)
}

/** ตัวเลือก parent ที่ย้ายไปได้จริง (ตัดตัวเองและลูกหลานออกแล้ว) */
export const moveTargets = (tree: FolderNode[], id: number): FolderNode[] =>
  flatten(tree).filter(n => canMove(tree, id, n.id))

/**
 * นับจำนวนของในแต่ละโฟลเดอร์ แบบรวมลูกหลาน
 * โฟลเดอร์แม่ที่ไม่มีของโดยตรง แต่ลูกมีของ ต้องไม่แสดงเป็น 0 — ไม่งั้นดูเหมือนว่าง
 */
export function countsWithDescendants(tree: FolderNode[], direct: Map<number, number>): Map<number, number> {
  const total = new Map<number, number>()
  const walk = (n: FolderNode): number => {
    const sum = (direct.get(n.id) ?? 0) + n.children.reduce((acc, c) => acc + walk(c), 0)
    total.set(n.id, sum)
    return sum
  }
  tree.forEach(walk)
  return total
}
