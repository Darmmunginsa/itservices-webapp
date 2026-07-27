import { useEffect, useState } from 'react'
import { spAttachmentBlobUrl } from '../../services/sharepoint'
import { projectIcon, isImageIcon, iconFileName } from '../../utils/projectIcon'

// cache blob URL ไว้ทั้งแอป — การ์ดหลายใบ/กลับมาหน้าเดิม จะไม่ยิงโหลดรูปซ้ำ
// (ไฟล์ไอคอนถูกย่อเหลือ 64px แล้ว จึงกินหน่วยความจำน้อยมาก)
const blobCache = new Map<string, string>()
const failed = new Set<string>()

interface Props {
  project: { id: number; ProjectGroup?: string; Icon?: string }
  /** ขนาดกล่อง (px) */
  size?: number
  className?: string
}

export function ProjectIcon({ project, size = 32, className = '' }: Props) {
  const useImage = isImageIcon(project.Icon)
  const fileName = iconFileName(project.Icon)
  const cacheKey = `${project.id}:${fileName}`
  const [url, setUrl] = useState<string>(() => blobCache.get(cacheKey) ?? '')

  useEffect(() => {
    if (!useImage || !fileName) return
    const cached = blobCache.get(cacheKey)
    if (cached) { setUrl(cached); return }
    if (failed.has(cacheKey)) return   // เคยโหลดพลาดแล้ว ไม่ต้องยิงซ้ำทุกครั้งที่ render
    let alive = true
    spAttachmentBlobUrl('PM_Projects', project.id, fileName)
      .then(u => { blobCache.set(cacheKey, u); if (alive) setUrl(u) })
      .catch(() => { failed.add(cacheKey) })   // ไฟล์ถูกลบ/ไม่มีสิทธิ์ → fallback เป็นอีโมจิ
    return () => { alive = false }
  }, [useImage, fileName, cacheKey, project.id])

  const box = `rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden select-none ${className}`
  const style = { width: size, height: size }

  if (useImage && url) {
    return (
      <span className={box} style={style} title={project.ProjectGroup || ''}>
        <img src={url} alt="" className="w-full h-full object-cover" />
      </span>
    )
  }
  // ยังโหลดไม่เสร็จ / ไม่ใช่รูป / โหลดพลาด → อีโมจิ (อัตโนมัติตามกลุ่มถ้าไม่ได้ตั้ง)
  return (
    <span className={box} style={{ ...style, fontSize: Math.round(size * 0.55), lineHeight: 1 }} title={project.ProjectGroup || ''}>
      {projectIcon(project)}
    </span>
  )
}

/** ล้าง cache ของโครงการหนึ่ง — เรียกหลังอัปโหลดไอคอนใหม่ ให้เห็นผลทันที */
export function clearProjectIconCache(projectId: number): void {
  for (const k of [...blobCache.keys()]) if (k.startsWith(`${projectId}:`)) blobCache.delete(k)
  for (const k of [...failed]) if (k.startsWith(`${projectId}:`)) failed.delete(k)
}
