// เครื่องมือในหน้า Admin — ให้สิทธิ์รายเครื่องมือ ไม่ใช่ได้หมดทั้งหน้า
//
// เข้าหน้า Admin ได้ ≠ ใช้ได้ทุกเครื่องมือ · role Admin ใช้ได้หมดเสมอ (กันล็อกตัวเอง)
// คนอื่นเห็นเฉพาะเครื่องมือที่ได้รับสิทธิ์:
//   • ผูกกับ ✏️ "แก้ไขได้" ของหน้าที่เกี่ยวข้อง (สถานะทีม / ผังออฟฟิศ ↔ ✏️ สถานะทีม)
//   • หรือสิทธิ์ของเครื่องมือนั้นเอง เก็บเป็น 'admin.<tool>:edit' ในคอลัมน์ AllowedPages เดิม (ไม่ต้องแก้ SharePoint)
//   • "สิทธิ์เข้าหน้า" = role Admin เท่านั้น — ใครแก้สิทธิ์ได้ ก็ให้สิทธิ์ตัวเองได้ทุกอย่าง

export type AdminTool = 'announcements' | 'holidays' | 'approvers' | 'team-status' | 'office-map' | 'quotas' | 'templates' | 'video' | 'permissions'

export interface AdminToolDef {
  key: AdminTool
  label: string
  icon: string
  /** สิทธิ์ที่ต้องมี (key ใน editPages) · null = role Admin เท่านั้น */
  grant: string | null
  /** ผูกกับสิทธิ์ของหน้าอื่น — บอกในหน้าจัดการสิทธิ์ว่าติ๊กที่ไหน */
  linkedPage?: string
}

export const ADMIN_TOOLS: AdminToolDef[] = [
  { key: 'announcements', label: 'ข้อความวิ่ง',     icon: '📢', grant: 'admin.announcements' },
  { key: 'holidays',      label: 'วันหยุด',         icon: '📅', grant: 'admin.holidays' },
  { key: 'approvers',     label: 'ผู้อนุมัติการลา',  icon: '✅', grant: 'admin.approvers' },
  { key: 'team-status',   label: 'สถานะทีม',        icon: '👥', grant: 'team-status', linkedPage: 'สถานะทีม' },
  { key: 'office-map',    label: 'ผังออฟฟิศ',       icon: '🗺️', grant: 'team-status', linkedPage: 'สถานะทีม' },
  { key: 'quotas',        label: 'โควต้าวันลา',      icon: '🧮', grant: 'admin.quotas' },
  { key: 'templates',     label: 'Template อีเมล',  icon: '✉️', grant: 'admin.templates' },
  { key: 'video',         label: 'วิดีโอหน้าหลัก',   icon: '▶️', grant: 'admin.video' },
  { key: 'permissions',   label: 'สิทธิ์เข้าหน้า',   icon: '🔐', grant: null },
]

/** สิทธิ์รายเครื่องมือที่ติ๊กได้ในหน้าจัดการสิทธิ์ (ไม่รวมตัวที่ผูกกับหน้าอื่น และตัวที่ Admin เท่านั้น) */
export const OWN_TOOL_GRANTS = ADMIN_TOOLS.filter(t => t.grant && !t.linkedPage)

/** เครื่องมือที่คนนี้เห็นในหน้า Admin */
export function visibleAdminTools(isAdminRole: boolean, editPages: Set<string> | null | undefined): AdminToolDef[] {
  if (isAdminRole) return ADMIN_TOOLS
  return ADMIN_TOOLS.filter(t => t.grant !== null && (editPages?.has(t.grant) ?? false))
}
