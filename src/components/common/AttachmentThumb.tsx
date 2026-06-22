import { useEffect, useState } from 'react'
import { spAttachmentBlobUrl } from '../../services/sharepoint'

interface Props {
  listName: string
  itemId: number
  fileName: string
}

const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i

/**
 * แสดงไฟล์แนบของ comment โดยดึงผ่าน /_api $value + bearer token → blob URL
 * (เลี่ยงรูปแตก/ต้อง login O365 ซ้ำ เพราะ <img src=SharePointURL> ใช้ cookie + โดน CORS)
 */
export function AttachmentThumb({ listName, itemId, fileName }: Props) {
  const isImg = IMG_RE.test(fileName)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState(false)

  useEffect(() => {
    let active = true
    let made = ''
    spAttachmentBlobUrl(listName, itemId, fileName)
      .then(u => { if (active) { made = u; setUrl(u) } else URL.revokeObjectURL(u) })
      .catch(() => { if (active) setErr(true) })
    return () => { active = false; if (made) URL.revokeObjectURL(made) }
  }, [listName, itemId, fileName])

  if (isImg) {
    if (err) return <div className="w-20 h-20 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-300 text-xs">✕</div>
    if (!url) return <div className="w-20 h-20 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse" />
    return (
      <a href={url} download={fileName} rel="noopener noreferrer" title={fileName}>
        <img src={url} alt={fileName} className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity cursor-pointer" />
      </a>
    )
  }
  // ไฟล์ที่ไม่ใช่รูป → ลิงก์ blob (เปิด/ดาวน์โหลดได้โดยไม่ต้อง login ซ้ำ)
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" download={fileName}
        className="flex items-center gap-1 text-xs text-primary-600 hover:underline px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">📎 {fileName}</a>
    : <span className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">📎 {fileName}</span>
}
