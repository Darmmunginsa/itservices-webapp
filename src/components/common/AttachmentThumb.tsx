import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { spAttachmentBlob } from '../../services/sharepoint'

interface Props {
  listName: string
  itemId: number
  fileName: string
}

// เดาจากชื่อไว้ก่อน เพื่อวางกรอบ placeholder ให้ถูกตั้งแต่ยังโหลดไม่เสร็จ
// แต่คำตอบสุดท้ายมาจาก MIME type ของไฟล์จริง เพราะชื่อเชื่อไม่ได้
const IMG_RE = /\.(png|jpe?g|jfif|gif|webp|bmp|svg|avif|heic|heif|tiff?|ico)$/i

const KB = 1024
function prettySize(n: number): string {
  if (!n) return ''
  if (n < KB) return `${n} B`
  if (n < KB * KB) return `${Math.round(n / KB)} KB`
  return `${(n / KB / KB).toFixed(1)} MB`
}

/**
 * แสดงไฟล์แนบของ comment โดยดึงผ่าน /_api $value + bearer token → blob URL
 * - รูป: คลิก thumbnail → เปิด lightbox ดูในแอป (ไม่ดาวน์โหลด) + ปุ่มดาวน์โหลดได้ชื่อจริง
 * - ไฟล์อื่น: ลิงก์ดาวน์โหลด (ชื่อจริง+นามสกุล)
 *
 * รูปที่มากับเมลมักชื่อแปลก — image001.jfif, รูปจาก iPhone เป็น .heic หรือบางที
 * ไม่มีนามสกุลเลย จึงตัดสินจาก MIME ของไฟล์จริง ไม่ใช่จากชื่อ
 */
export function AttachmentThumb({ listName, itemId, fileName }: Props) {
  // ผูกทุกสถานะไว้กับ key ของไฟล์ แทนที่จะรีเซ็ตตอน props เปลี่ยน
  // เพราะการ setState ตรง ๆ ใน effect ทำให้ render ซ้อนกันโดยไม่จำเป็น
  const key = `${listName}|${itemId}|${fileName}`
  const [blob, setBlob] = useState<{ key: string; url: string; type: string; size: number } | null>(null)
  const [failedKey, setFailedKey] = useState('')
  // เบราว์เซอร์วาดรูปไม่ออก (เช่น .heic บน Chrome) — ตกลงมาเป็นลิงก์ดาวน์โหลดแทน
  const [brokenKey, setBrokenKey] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    let made = ''
    spAttachmentBlob(listName, itemId, fileName)
      .then(b => {
        if (!active) { URL.revokeObjectURL(b.url); return }
        made = b.url
        setBlob({ key: `${listName}|${itemId}|${fileName}`, url: b.url, type: b.type, size: b.size })
      })
      .catch(() => { if (active) setFailedKey(`${listName}|${itemId}|${fileName}`) })
    return () => { active = false; if (made) URL.revokeObjectURL(made) }
  }, [listName, itemId, fileName])

  const loaded = blob?.key === key ? blob : null
  const url = loaded?.url ?? ''
  const type = loaded?.type ?? ''
  const size = loaded?.size ?? 0
  const err = failedKey === key
  const cantRender = brokenKey === key

  const looksImage = IMG_RE.test(fileName)
  // MIME ชนะชื่อไฟล์เสมอเมื่อโหลดเสร็จแล้ว
  const isImg = (type ? type.startsWith('image/') : looksImage) && !cantRender

  if (isImg && !err) {
    if (!url) return <div className="w-20 h-20 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse" />
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} title={`${fileName}${size ? ` · ${prettySize(size)}` : ''}`}>
          <img src={url} alt={fileName} onError={() => setBrokenKey(key)}
            className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity cursor-pointer" />
        </button>
        {open && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center p-4" onClick={() => setOpen(false)}>
            <img src={url} alt={fileName} className="max-w-full max-h-[80vh] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
            <div className="flex items-center gap-3 mt-3" onClick={e => e.stopPropagation()}>
              <span className="text-white/80 text-xs truncate max-w-[60vw]">{fileName}{size ? ` · ${prettySize(size)}` : ''}</span>
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

  const label = `${fileName}${size ? ` · ${prettySize(size)}` : ''}`
  // โหลดไม่ได้ — บอกไปตรง ๆ ดีกว่าโชว์กรอบว่างที่ทำอะไรไม่ได้
  if (err) {
    return (
      <span title="ดึงไฟล์แนบไม่สำเร็จ — ลองรีเฟรชหน้า หรืออาจไม่มีสิทธิ์เข้าถึง"
        className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
        ⚠ {fileName}
      </span>
    )
  }
  return url
    ? <a href={url} download={fileName} rel="noopener noreferrer"
        title={cantRender ? 'เบราว์เซอร์เปิดรูปชนิดนี้ไม่ได้ — ดาวน์โหลดไปเปิดในเครื่อง' : label}
        className="flex items-center gap-1 text-xs text-primary-600 hover:underline px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
        {cantRender ? '🖼️' : '📎'} {label}
      </a>
    : <span className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">📎 {fileName}</span>
}
