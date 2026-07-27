import { spGet, spCreate, spUpdate, spDelete } from './sharepoint'
import { PAGES, ALWAYS_KEYS } from '../config/pages'
import type { Role } from '../types/common'

// ── สิทธิ์การเข้าถึงหน้า กำหนดรายคน (SharePoint list 'HD_PagePermissions') ──
// 1 แถว = 1 ผู้ใช้ ; AllowedPages = รหัสหน้าคั่นด้วย comma เช่น "assets,contracts,projects"
//
// ลำดับการตัดสิน (resolvePages):
//   1. role = Admin            → เข้าได้ทุกหน้าเสมอ (escape hatch — กัน Admin ล็อกตัวเองออกจากระบบ)
//   2. โหลดลิสต์ไม่ได้/ยังไม่มี → fallback ใช้ defaultRoles ตาม role เดิม (กันทั้งองค์กรล็อกเพราะระบบล่ม)
//   3. มีแถวของผู้ใช้           → ใช้ AllowedPages ของแถวนั้น
//   4. ไม่มีแถว                → เข้าได้เฉพาะหน้า always (หน้าหลัก) จนกว่า Admin จะกำหนดให้
export const PERM_LIST = 'HD_PagePermissions'

export interface PagePermRow {
  id: number
  Title?: string
  UserEmail: string
  AllowedPages?: string
  Note?: string
}

export interface ResolvedPerms {
  pages: Set<string>
  /** 'admin' = Admin เข้าทุกหน้า, 'user' = ตามที่ Admin กำหนดรายคน,
   *  'none' = ยังไม่ถูกกำหนดสิทธิ์, 'fallback' = ลิสต์ใช้ไม่ได้ จึงถอยไปใช้ role เดิม */
  source: 'admin' | 'user' | 'none' | 'fallback'
}

const parsePages = (raw?: string): string[] =>
  (raw ?? '').split(',').map(s => s.trim()).filter(Boolean)

export const serializePages = (keys: string[]): string =>
  [...new Set(keys)].filter(k => k).join(',')

/** สิทธิ์ตาม role เดิม — ใช้เฉพาะตอน fallback */
function rolePages(role: Role): string[] {
  return PAGES.filter(p => p.always || p.defaultRoles?.includes(role)).map(p => p.key)
}

/** โหลดสิทธิ์ของผู้ใช้ปัจจุบัน */
export async function resolvePages(email: string, role: Role): Promise<ResolvedPerms> {
  const everything = new Set(PAGES.map(p => p.key))
  if (role === 'Admin') return { pages: everything, source: 'admin' }

  let rows: PagePermRow[]
  try {
    rows = await spGet<PagePermRow>(PERM_LIST, `UserEmail eq '${email}'`, 'Id,UserEmail,AllowedPages', undefined, 5)
  } catch {
    // ลิสต์ยังไม่ถูกสร้าง หรือโหลดพลาด → ถอยไปใช้ role เดิม ไม่ล็อกใครออกจากระบบ
    return { pages: new Set(rolePages(role)), source: 'fallback' }
  }

  const row = rows[0]
  if (!row) return { pages: new Set(ALWAYS_KEYS), source: 'none' }
  return { pages: new Set([...ALWAYS_KEYS, ...parsePages(row.AllowedPages)]), source: 'user' }
}

/** ── ใช้ในหน้า Admin ── */
export async function getAllPagePerms(): Promise<PagePermRow[]> {
  return spGet<PagePermRow>(PERM_LIST, undefined, 'Id,Title,UserEmail,AllowedPages,Note', 'UserEmail asc', 2000)
}

export async function savePagePerms(email: string, keys: string[], existingId?: number, note?: string): Promise<void> {
  const payload = {
    Title: email,
    UserEmail: email,
    AllowedPages: serializePages(keys),
    ...(note !== undefined ? { Note: note } : {}),
  }
  if (existingId) await spUpdate(PERM_LIST, existingId, payload)
  else await spCreate(PERM_LIST, payload)
}

/** ลบแถว = คืนผู้ใช้กลับไปสถานะ "ยังไม่ถูกกำหนดสิทธิ์" */
export async function clearPagePerms(id: number): Promise<void> {
  await spDelete(PERM_LIST, id)
}
