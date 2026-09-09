import { useEffect, useState } from 'react'
import { spAttachmentBlob } from '../../services/sharepoint'
import { browserCanRender } from '../../utils/fileSniff'
import { previewKind, prettySize, extOf, type PreviewKind } from '../../utils/filePreview'
import { FileViewer } from './FileViewer'

interface Props {
  listName: string
  itemId: number
  fileName: string
}

// เดาจากชื่อไว้ก่อน เพื่อวางกรอบ placeholder ให้ถูกตั้งแต่ยังโหลดไม่เสร็จ
// แต่คำตอบสุดท้ายมาจากไบต์ของไฟล์จริง เพราะชื่อเชื่อไม่ได้
const IMG_RE = /\.(png|jpe?g|jfif|gif|webp|bmp|svg|avif|heic|heif|tiff?|ico)$/i

/** ไอคอนบนแผ่นไฟล์ — บอกชนิดได้ตั้งแต่ยังไม่คลิก */
const TILE: Record<PreviewKind, { icon: string; label: string }> = {
  image:  { icon: '🖼️', label: 'ดูรูป' },
  pdf:    { icon: '📕', label: 'ดู PDF' },
  video:  { icon: '▶️', label: 'เล่นวิดีโอ' },
  audio:  { icon: '🎵', label: 'เล่นเสียง' },
  text:   { icon: '📄', label: 'อ่านในหน้า' },
  office: { icon: '📘', label: 'ดาวน์โหลด' },
  none:   { icon: '📎', label: 'ดาวน์โหลด' },
}

/**
 * ไฟล์แนบของคอมเมนต์ — ดึงผ่าน /_api $value + bearer token → blob URL
 *
 * เปิดดูในหน้าได้: รูป, PDF, วิดีโอ, เสียง, ไฟล์ข้อความ
 * ที่เหลือเป็นลิงก์ดาวน์โหลด แต่บอกไปตรง ๆ ว่าทำไม ไม่ปล่อยให้กดแล้วงง
 *
 * ชนิดไฟล์ตัดสินจากไบต์จริง ไม่ใช่จากชื่อ — รูปที่มากับเมลมักชื่อแปลก
 * (image001.jfif, .heic จาก iPhone) หรือไม่มีนามสกุลเลย
 */
export function AttachmentThumb({ listName, itemId, fileName }: Props) {
  // ผูกทุกสถานะไว้กับ key ของไฟล์ แทนที่จะรีเซ็ตตอน props เปลี่ยน
  const key = `${listName}|${itemId}|${fileName}`
  const [loaded, setLoaded] = useState<{
    key: string; url: string; type: string; size: number; isImage: boolean; blob: Blob
  } | null>(null)
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
        setLoaded({ key: `${listName}|${itemId}|${fileName}`, ...b })
      })
      .catch(() => { if (active) setFailedKey(`${listName}|${itemId}|${fileName}`) })
    return () => { active = false; if (made) URL.revokeObjectURL(made) }
  }, [listName, itemId, fileName])

  const file = loaded?.key === key ? loaded : null
  const url = file?.url ?? ''
  const size = file?.size ?? 0
  const err = failedKey === key
  const cantRender = brokenKey === key

  // .heic รู้ตั้งแต่ต้นว่าเบราว์เซอร์วาดไม่ได้ — ไม่ต้องรอให้กรอบรูปพังก่อนแล้วค่อยถอย
  const unsupportedImage = !!file?.isImage && !browserCanRender(file.type)
  const kind: PreviewKind = !file
    ? (IMG_RE.test(fileName) ? 'image' : 'none')
    : cantRender || unsupportedImage
      ? 'none'
      : previewKind(file.type, fileName, file.size)

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

  // ── รูป: thumbnail จริง ──
  if (kind === 'image') {
    if (!url) return <div className="w-20 h-20 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse" />
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} title={label}>
          <img src={url} alt={fileName} onError={() => setBrokenKey(key)}
            className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity cursor-pointer" />
        </button>
        {open && file && (
          <FileViewer kind="image" url={url} blob={file.blob} fileName={fileName} size={size} onClose={() => setOpen(false)} />
        )}
      </>
    )
  }

  if (!url) {
    return <span className="flex items-center gap-1 text-xs text-gray-400 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">📎 {fileName}</span>
  }

  const tile = TILE[kind]

  // ── ชนิดที่ไม่มีอะไรให้ดูในหน้า: ลิงก์ดาวน์โหลด พร้อมเหตุผล ──
  if (kind === 'none' || kind === 'office') {
    const why = unsupportedImage || cantRender
      ? 'เบราว์เซอร์เปิดรูปชนิดนี้ไม่ได้ — ดาวน์โหลดไปเปิดในเครื่อง'
      : kind === 'office'
        ? `เบราว์เซอร์เปิด .${extOf(fileName)} ในหน้าไม่ได้ — ดาวน์โหลดไปเปิดใน Office`
        : label
    return (
      <a href={url} download={fileName} rel="noopener noreferrer" title={why}
        className="flex items-center gap-1 text-xs text-primary-600 hover:underline px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
        {unsupportedImage || cantRender ? '🖼️' : tile.icon} {label}
      </a>
    )
  }

  // ── PDF / วิดีโอ / เสียง / ข้อความ: แผ่นไฟล์ที่กดดูในหน้าได้ ──
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={`${label} — ${tile.label}`}
        className="w-20 h-20 flex flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors p-1">
        <span className="text-xl leading-none">{tile.icon}</span>
        <span className="text-[8px] text-gray-500 dark:text-gray-400 truncate w-full text-center px-0.5">{fileName}</span>
        <span className="text-[8px] text-primary-600 font-medium">{tile.label}</span>
      </button>
      {open && file && (
        <FileViewer kind={kind} url={url} blob={file.blob} fileName={fileName} size={size} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
