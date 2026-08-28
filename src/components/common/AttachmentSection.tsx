import { useEffect, useRef, useState } from 'react'
import { Paperclip, Upload, Trash2 } from 'lucide-react'
import { spGetAttachments, spUploadAttachment, spDeleteAttachment } from '../../services/sharepoint'
import { AttachmentThumb } from './AttachmentThumb'
import { useT } from '../../i18n/useT'

interface Props {
  listName: string
  itemId: number
  readOnly?: boolean
}

export function AttachmentSection({ listName, itemId, readOnly = false }: Props) {
  const tr = useT()
  const [files, setFiles] = useState<Array<{ FileName: string; ServerRelativeUrl: string }>>([])
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function load() {
    setLoadingFiles(true)
    spGetAttachments(listName, itemId)
      .then(data => { setFiles(data); setError('') })
      .catch(() => setError('โหลดไฟล์ไม่สำเร็จ'))
      .finally(() => setLoadingFiles(false))
  }

  useEffect(() => { load() }, [listName, itemId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await spUploadAttachment(listName, itemId, file)
      load()
    } catch {
      setError('อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(fileName: string) {
    if (!window.confirm(`${tr('assets.delete')} "${fileName}"?`)) return
    try {
      await spDeleteAttachment(listName, itemId, fileName)
      setFiles(prev => prev.filter(f => f.FileName !== fileName))
    } catch {
      setError(tr('attach.deleteErr'))
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Paperclip size={12} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-500">
          {tr('ticket.attachments')} {!loadingFiles && `(${files.length})`}
        </span>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="ml-auto flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50 transition-colors"
            >
              <Upload size={11} />
              {uploading ? tr('attach.uploading') : tr('attach.upload')}
            </button>
            <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {loadingFiles ? (
        <p className="text-xs text-gray-400 italic pl-4">{tr('comp.loading')}</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-gray-400 italic pl-4">{tr('attach.none')}</p>
      ) : (
        // รูปที่มากับเมลเคยขึ้นเป็นแค่ชื่อไฟล์ ต้องกดเปิดทีละอันถึงจะรู้ว่าเป็นรูปอะไร
        // ตอนนี้ให้ AttachmentThumb ตัดสินเอง (มันดู MIME จริง ไม่ใช่นามสกุล)
        // ไม่ใช่รูป → มันคืนลิงก์ดาวน์โหลดมาเหมือนเดิม
        <div className="flex flex-wrap items-start gap-2 pl-4">
          {files.map(f => (
            <div key={f.FileName} className="relative group">
              <AttachmentThumb listName={listName} itemId={itemId} fileName={f.FileName} />
              {!readOnly && (
                <button type="button" onClick={() => handleDelete(f.FileName)} title={tr('assets.delete')}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
