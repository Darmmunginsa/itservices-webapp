import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { spAttachmentBlobUrl } from '../../services/sharepoint'

interface Props {
  listName: string
  itemId: number
  fileName: string
}

const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i

/**
 * แสดงไฟล์แนบของ comment โดยดึงผ่าน /_api $value + bearer token → blob URL
 * - รูป: คลิก thumbnail → เปิด lightbox ดูในแอป (ไม่ดาวน์โหลด) + ปุ่มดาวน์โหลดได้ชื่อจริง
 * - ไฟล์อื่น: ลิงก์ดาวน์โหลด (ชื่อจริง+นามสกุล)
 */
export function AttachmentThumb({ listName, itemId, fileName }: Props) {
  const isImg = IMG_RE.test(fileName)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState(false)

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
      <>
        <button type="button" onClick={() => setOpen(true)} title={fileName}>
          <img src={url} alt={fileName} className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity cursor-pointer" />
        </button>
        {open && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center p-4" onClick={() => setOpen(false)}>
            <img src={url} alt={fileName} className="max-w-full max-h-[80vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
            <div className="flex items-center gap-3 mt-3" onClick={e => e.stopPropagation()}>
              <span className="text-white/80 text-xs truncate max-w-[60vw]">{fileName}</span>
              <a href={url} download={fileName} className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors">
                <Download size={13} /> ดาวน์โหลด
              </a>
              <button type="button" onClick={() => setOpen(false)} className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors">
                <X size={13} /> ปิด
              </button>
            </div>
          </div>
        )}
      </>
    )
  }
  // ไฟล์ที่ไม่ใช่รูป → ลิงก์ดาวน์โหลด (ชื่อจริง+นามสกุล)
  return url
    ? <a href={url} download={fileName} rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-primary-600 hover:underline px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">📎 {fileName}</a>
    : <span className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">📎 {fileName}</span>
}
