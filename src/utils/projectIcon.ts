import type { Project } from '../types/project'
import { makeSquareImageFile } from './imageFile'

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

// ค่าในคอลัมน์ Icon รองรับ 3 แบบ:
//   ''                 → อัตโนมัติตามกลุ่มโครงการ
//   '🚀'               → อีโมจิ
//   'img:__icon_x.png' → รูปที่อัปโหลดไว้ (เก็บเป็น attachment ของ item โครงการนั้น)
export const IMG_PREFIX = 'img:'
// ห้ามขึ้นต้นด้วย '_' — SharePoint ปฏิเสธ (ArgumentOutOfRangeException: fileName)
// และ safeAttachmentName() ก็ตัด '_' นำหน้าทิ้งอยู่แล้ว ทำให้ชื่อไม่ตรงกัน
export const ICON_FILE_PREFIX = 'icon-'

export function isImageIcon(icon?: string): boolean {
  return !!icon?.trim().startsWith(IMG_PREFIX)
}
export function iconFileName(icon?: string): string {
  return isImageIcon(icon) ? icon!.trim().slice(IMG_PREFIX.length) : ''
}

/** อีโมจิที่จะใช้แสดง (กรณีไม่ใช่รูปอัปโหลด) */
export function projectIcon(p: Pick<Project, 'ProjectGroup'> & { Icon?: string }): string {
  const custom = (p as { Icon?: string }).Icon?.trim()
  if (custom && !isImageIcon(custom)) return custom
  return GROUP_ICON[p.ProjectGroup ?? ''] ?? DEFAULT_PROJECT_ICON
}

/** ย่อรูปเป็นไอคอนโครงการ (จัตุรัส 64px) — ใช้ตัวช่วยกลางใน utils/imageFile */
export async function makeIconFile(src: File, size = 64): Promise<File> {
  return makeSquareImageFile(src, size, ICON_FILE_PREFIX)
}

// ชุดไอคอนให้เลือกในฟอร์มแก้ไขโครงการ
export const ICON_CHOICES = [
  '📁', '🏢', '🤝', '🔬', '🔧', '🚀', '💡', '🖥', '🌐', '🔐', '📊', '📡',
  '☁️', '🗄', '🛠', '📱', '🧪', '🎯', '⚙️', '🔔', '📦', '🏗', '🧩', '⭐',
]
