import type { Project } from '../types/project'

// ── ไอคอนโครงการ ──
// 1) ถ้าตั้งไอคอนเองไว้ (คอลัมน์ Icon ใน PM_Projects) → ใช้อันนั้น
// 2) ถ้าไม่ได้ตั้ง → เดาจาก ProjectGroup อัตโนมัติ (ใช้ได้ทันทีกับโครงการเดิมทุกอัน)
const GROUP_ICON: Record<string, string> = {
  Internal: '🏢',
  External: '🤝',
  'R&D': '🔬',
  Maintenance: '🔧',
  'อื่นๆ': '📁',
}

export const DEFAULT_PROJECT_ICON = '📁'

export function projectIcon(p: Pick<Project, 'ProjectGroup'> & { Icon?: string }): string {
  const custom = (p as { Icon?: string }).Icon?.trim()
  if (custom) return custom
  return GROUP_ICON[p.ProjectGroup ?? ''] ?? DEFAULT_PROJECT_ICON
}

// ชุดไอคอนให้เลือกในฟอร์มแก้ไขโครงการ
export const ICON_CHOICES = [
  '📁', '🏢', '🤝', '🔬', '🔧', '🚀', '💡', '🖥', '🌐', '🔐', '📊', '📡',
  '☁️', '🗄', '🛠', '📱', '🧪', '🎯', '⚙️', '🔔', '📦', '🏗', '🧩', '⭐',
]
