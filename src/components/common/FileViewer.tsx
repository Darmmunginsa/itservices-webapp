import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { prettySize, type PreviewKind } from '../../utils/filePreview'

interface Props {
  kind: PreviewKind
  url: string
  blob: Blob | null
  fileName: string
  size: number
  onClose: () => void
}

/**
 * ดูไฟล์แนบเต็มจอโดยไม่ต้องดาวน์โหลด
 *
 * ทุกชนิดใช้กรอบเดียวกัน (พื้นดำ ปุ่มปิด ปุ่มดาวน์โหลด) ต่างกันแค่สิ่งที่อยู่ตรงกลาง
 * เพราะเป็นการกระทำเดียวกันในสายตาคนใช้ — "ขอดูไฟล์นี้หน่อย"
 *
 * ปุ่มดาวน์โหลดยังอยู่เสมอ การเปิดดูในหน้าไม่ได้แทนการเอาไฟล์ไปใช้ต่อ
 */
export function FileViewer({ kind, url, blob, fileName, size, onClose }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [textError, setTextError] = useState(false)

  // อ่านเนื้อไฟล์ข้อความตอนเปิดดูเท่านั้น ไม่ใช่ตอนโหลดรายการคอมเมนต์
  useEffect(() => {
    if (kind !== 'text' || !blob) return
    let active = true
    blob.text()
      .then(t => { if (active) setText(t) })
      .catch(() => { if (active) setTextError(true) })
    return () => { active = false }
  }, [kind, blob])

  // ปิดด้วย Esc — คนคาดหวังแบบนั้นกับอะไรที่เปิดเต็มจอ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-5xl w-full max-h-[82vh] flex items-center justify-center" onClick={stop}>
        {kind === 'image' && (
          <img src={url} alt={fileName} className="max-w-full max-h-[82vh] object-contain rounded-lg" />
        )}
        {kind === 'pdf' && (
          <iframe src={url} title={fileName} className="w-full h-[82vh] rounded-lg bg-white" />
        )}
        {kind === 'video' && (
          <video src={url} controls autoPlay className="max-w-full max-h-[82vh] rounded-lg bg-black" />
        )}
        {kind === 'audio' && (
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl p-6 text-center">
            <p className="text-4xl mb-3">🎵</p>
            <p className="text-sm text-gray-700 dark:text-gray-200 truncate mb-4">{fileName}</p>
            <audio src={url} controls autoPlay className="w-full" />
          </div>
        )}
        {kind === 'text' && (
          <div className="w-full h-[82vh] bg-white dark:bg-gray-900 rounded-lg overflow-auto">
            {textError
              ? <p className="p-6 text-sm text-gray-500">อ่านไฟล์นี้เป็นข้อความไม่ได้ — ดาวน์โหลดไปเปิดในเครื่องแทน</p>
              : text === null
                ? <p className="p-6 text-sm text-gray-400">กำลังอ่าน…</p>
                : <pre className="p-4 text-xs leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words font-mono">{text}</pre>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 flex-wrap justify-center" onClick={stop}>
        <span className="text-white/80 text-xs truncate max-w-[50vw]">
          {fileName}{size ? ` · ${prettySize(size)}` : ''}
        </span>
        <a href={url} download={fileName}
          className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors">
          <Download size={13} /> ดาวน์โหลด
        </a>
        <button type="button" onClick={onClose}
          className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors">
          <X size={13} /> ปิด
        </button>
      </div>
    </div>
  )
}
