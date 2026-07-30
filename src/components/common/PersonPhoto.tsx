import { useEffect, useState } from 'react'
import { spAttachmentBlobUrl } from '../../services/sharepoint'

// รูปพนักงาน — เก็บเป็น attachment ของ item ใน HD_AgentProfiles (ชื่อไฟล์ขึ้นต้น 'photo-')
// ไม่ต้องมีคอลัมน์เก็บชื่อไฟล์: ดึงชื่อมาพร้อมรายชื่อด้วย $expand=AttachmentFiles ในคำขอเดียว
export const PHOTO_PREFIX = 'photo-'
export const isPhotoFile = (name: string) => /^_*photo[-_]/i.test(name)

// cache blob ทั้งแอป — ผังองค์กรมีหลายสิบคน และกลับมาหน้าเดิมบ่อย จะไม่โหลดรูปซ้ำ
const cache = new Map<string, string>()
const failed = new Set<string>()

export function clearPhotoCache(itemId?: number): void {
  if (itemId == null) { cache.clear(); failed.clear(); return }
  for (const k of [...cache.keys()]) if (k.startsWith(`${itemId}:`)) cache.delete(k)
  for (const k of [...failed]) if (k.startsWith(`${itemId}:`)) failed.delete(k)
}

interface Props {
  /** id ของ item ใน HD_AgentProfiles */
  itemId: number
  /** ชื่อไฟล์รูป (จาก AttachmentFiles) — ไม่มี = ใช้อวตาร์ตัวอักษร */
  fileName?: string
  name: string
  size?: number
  className?: string
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#4f46e5']
function avatarColor(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function PersonPhoto({ itemId, fileName, name, size = 36, className = '' }: Props) {
  const key = `${itemId}:${fileName ?? ''}`
  const [url, setUrl] = useState(() => (fileName ? cache.get(key) ?? '' : ''))

  useEffect(() => {
    if (!fileName) { setUrl(''); return }
    const cached = cache.get(key)
    if (cached) { setUrl(cached); return }
    if (failed.has(key)) return   // เคยพลาดแล้ว ไม่ยิงซ้ำทุก render
    let alive = true
    spAttachmentBlobUrl('HD_AgentProfiles', itemId, fileName)
      .then(u => { cache.set(key, u); if (alive) setUrl(u) })
      .catch(() => { failed.add(key) })   // ไฟล์หาย/ไม่มีสิทธิ์ → ใช้อวตาร์ตัวอักษรแทน
    return () => { alive = false }
  }, [key, fileName, itemId])

  // ต้องมี inline-flex: <span> เป็น display:inline โดยปริยาย ซึ่ง "ไม่รับ" width/height
  // ถ้าไม่ใส่ รูปจะแสดงที่ขนาดจริง (128px) ทะลุกรอบและดัน layout ของการ์ดพัง
  const style = { width: size, height: size }
  if (url) {
    return (
      <span className={`inline-flex rounded-full overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800 ${className}`} style={style}>
        <img src={url} alt={name} className="w-full h-full object-cover" />
      </span>
    )
  }
  return (
    <span className={`inline-flex rounded-full items-center justify-center text-white font-bold flex-shrink-0 select-none ${className}`}
      style={{ ...style, backgroundColor: avatarColor(name || String(itemId)), fontSize: Math.round(size * 0.42) }}>
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  )
}
