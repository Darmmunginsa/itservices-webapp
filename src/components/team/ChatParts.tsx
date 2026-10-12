import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send, X, CornerUpLeft, FileText, Download } from 'lucide-react'
import { spAttachmentBlobUrl } from '../../services/sharepoint'
import { displayFileName, isImageFile, MAX_FILES, MAX_FILE_MB, snippet, type ChatReply } from '../../utils/chatMeta'

// ── ชิ้นส่วนแชทที่ใช้ร่วมกัน (แชทออฟฟิศ + แชทส่วนตัว): ไฟล์แนบ · ข้อความที่ตอบ · ช่องพิมพ์ ──

/** ไฟล์แนบหนึ่งไฟล์ — รูปโชว์ภาพย่อ · ไฟล์อื่นเป็นป้ายกดดาวน์โหลด */
export function ChatAttachment({ list, itemId, name, mine }: { list: string; itemId: number; name: string; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const img = isImageFile(name)
  useEffect(() => {
    if (!img) return
    let alive = true
    let made: string | null = null
    // แถวที่เพิ่งส่ง ไฟล์อาจยังอัปโหลดไม่เสร็จ — ลองซ้ำสองสามครั้ง
    const tryLoad = (n: number) => {
      spAttachmentBlobUrl(list, itemId, name)
        .then(u => { made = u; if (alive) setUrl(u); else URL.revokeObjectURL(u) })
        .catch(() => {
          if (alive && n < 4) window.setTimeout(() => tryLoad(n + 1), 1500 * (n + 1))
          else if (alive) setErr(true)
        })
    }
    tryLoad(0)
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [img, list, itemId, name])

  async function download() {
    try {
      const u = url ?? await spAttachmentBlobUrl(list, itemId, name)
      const a = document.createElement('a')
      a.href = u; a.download = displayFileName(name); a.click()
      if (!url) window.setTimeout(() => URL.revokeObjectURL(u), 4000)
    } catch { setErr(true) }
  }

  if (img && url) {
    return (
      <button type="button" onClick={() => window.open(url, '_blank')} title={`${displayFileName(name)} — คลิกเพื่อดูภาพเต็ม`} className="block mt-1">
        <img src={url} alt={displayFileName(name)} className="max-w-[180px] max-h-[140px] rounded-lg object-cover border border-black/10" />
      </button>
    )
  }
  return (
    <button type="button" onClick={download} title="ดาวน์โหลด"
      className={`mt-1 flex items-center gap-1.5 max-w-[200px] px-2 py-1 rounded-lg text-[11px] ${mine ? 'bg-white/15 hover:bg-white/25' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
      <FileText size={12} className="shrink-0" />
      <span className="truncate">{displayFileName(name)}</span>
      {err ? <span className="shrink-0 opacity-70">⚠️</span> : <Download size={11} className="shrink-0 opacity-70" />}
    </button>
  )
}

/** กล่องข้อความที่ถูกตอบ (เหนือข้อความ) — คลิกเพื่อเลื่อนไปที่ข้อความต้นฉบับ */
export function ReplyQuote({ reply, mine, onJump }: { reply: ChatReply; mine: boolean; onJump?: (id: number) => void }) {
  return (
    <button type="button" onClick={() => onJump?.(reply.id)} title="ไปที่ข้อความที่ตอบ"
      className={`block w-full text-left mb-1 pl-2 border-l-2 text-[10.5px] leading-snug rounded-sm ${mine ? 'border-white/70 text-white/85' : 'border-primary-400 text-gray-500 dark:text-gray-400'}`}>
      <span className="font-semibold">{reply.who}</span>
      <span className="block truncate">{reply.text || '📎 ไฟล์แนบ'}</span>
    </button>
  )
}

/** ช่องพิมพ์ + แนบไฟล์ (ปุ่ม / ลากมาวาง / Ctrl+V รูป) + แถบ "กำลังตอบ…" */
export function ChatComposer({ placeholder, busy, reply, onCancelReply, onSend, onError }: {
  placeholder: string; busy: boolean; reply: ChatReply | null; onCancelReply: () => void
  onSend: (text: string, files: File[]) => Promise<boolean>; onError: (msg: string) => void
}) {
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (reply) inputRef.current?.focus() }, [reply])

  const add = (list: FileList | File[]) => {
    const next = [...files]
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) { onError(`ไฟล์ ${f.name} ใหญ่เกิน ${MAX_FILE_MB} MB`); continue }
      if (next.length >= MAX_FILES) { onError(`แนบได้ครั้งละไม่เกิน ${MAX_FILES} ไฟล์`); break }
      next.push(f)
    }
    setFiles(next)
  }
  async function submit() {
    if (busy || (!text.trim() && !files.length)) return
    if (await onSend(text, files)) { setText(''); setFiles([]) }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-800"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
      onDrop={e => { if (e.dataTransfer.files.length) { e.preventDefault(); add(e.dataTransfer.files) } }}>
      {reply && (
        <div className="flex items-center gap-2 px-2 pt-1.5 text-[11px] text-gray-500">
          <CornerUpLeft size={12} className="text-primary-500 shrink-0" />
          <span className="min-w-0 flex-1 truncate">ตอบ <b>{reply.who}</b>: {snippet(reply.text, 50) || '📎 ไฟล์แนบ'}</span>
          <button onClick={onCancelReply} className="p-0.5 hover:text-red-600" aria-label="ยกเลิกการตอบ"><X size={12} /></button>
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pt-1.5">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 max-w-[150px] px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-[10.5px]">
              <Paperclip size={10} className="shrink-0" /><span className="truncate">{f.name}</span>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="hover:text-red-600" aria-label="เอาไฟล์ออก"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 p-2">
        <input ref={fileRef} type="file" multiple hidden onChange={e => { if (e.target.files) add(e.target.files); e.target.value = '' }} />
        <button onClick={() => fileRef.current?.click()} title={`แนบไฟล์ (ไม่เกิน ${MAX_FILES} ไฟล์ · ไฟล์ละ ${MAX_FILE_MB} MB) — หรือลากไฟล์มาวาง / วางรูปด้วย Ctrl+V`}
          className="px-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-600 hover:border-primary-400" aria-label="แนบไฟล์"><Paperclip size={13} /></button>
        <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
          onPaste={e => { const fs = Array.from(e.clipboardData.files); if (fs.length) { e.preventDefault(); add(fs) } }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } if (e.key === 'Escape' && reply) onCancelReply() }}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <button onClick={submit} disabled={busy || (!text.trim() && !files.length)} className="px-2.5 rounded-lg bg-primary-600 text-white disabled:opacity-50" aria-label="ส่ง"><Send size={13} /></button>
      </div>
    </div>
  )
}
