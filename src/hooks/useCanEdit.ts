import { useAppStore } from '../store/useAppStore'
import type { Role } from '../types/common'
import { canEditPage } from '../utils/pagePerms'

/**
 * แก้ไขในหน้านี้ได้ไหม
 *
 * เดิมแต่ละหน้าเขียนเอง `['Supervisor','Boss','Admin'].includes(user.role)` — คนนอก role นั้น
 * ไม่มีทางได้สิทธิ์ ต้องเปลี่ยน role ทั้งคน ซึ่งปลดล็อกหน้าอื่นตามไปด้วย
 * ตอนนี้ Admin ติ๊ก "แก้ไข" ให้รายคน-รายหน้าได้ที่หน้าสิทธิ์การเข้าถึง
 *
 * @param pageKey  key จาก config/pages.ts
 * @param roles    role ที่ทำได้อยู่แล้ว (เหมือนเดิม ไม่มีใครเสียสิทธิ์)
 */
export function useCanEdit(pageKey: string, roles: Role[]): boolean {
  const { user, editPages } = useAppStore()
  return canEditPage(roles.includes(user?.role as Role), editPages, pageKey)
}
