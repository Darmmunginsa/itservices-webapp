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

// ค่าในคอลัมน์ Icon รองรับ 3 แบบ:
//   ''                 → อัตโนมัติตามกลุ่มโครงการ
//   '🚀'               → อีโมจิ
//   'img:__icon_x.png' → รูปที่อัปโหลดไว้ (เก็บเป็น attachment ของ item โครงการนั้น)
export const IMG_PREFIX = 'img:'
export const ICON_FILE_PREFIX = '__icon_'

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

/**
 * ย่อรูปเป็นสี่เหลี่ยมจัตุรัสขนาด size px แล้วคืนเป็น PNG File
 * (ผู้ใช้มักตัดรูปจาก screenshot ขนาดใหญ่ — ย่อก่อนอัปโหลดให้โหลดไว ไม่กิน SharePoint)
 */
export async function makeIconFile(src: File, size = 64): Promise<File> {
  const bitmap = await createImageBitmap(src)
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  // crop กลางภาพให้เป็นจัตุรัส แล้วค่อยย่อ (ไม่ให้รูปยืด)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  bitmap.close?.()
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'))
  return new File([blob], `${ICON_FILE_PREFIX}${Date.now()}.png`, { type: 'image/png' })
}

// ชุดไอคอนให้เลือกในฟอร์มแก้ไขโครงการ
export const ICON_CHOICES = [
  '📁', '🏢', '🤝', '🔬', '🔧', '🚀', '💡', '🖥', '🌐', '🔐', '📊', '📡',
  '☁️', '🗄', '🛠', '📱', '🧪', '🎯', '⚙️', '🔔', '📦', '🏗', '🧩', '⭐',
]
