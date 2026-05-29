import { useEffect, useRef, useState } from 'react'
import { Download, Paperclip, Upload } from 'lucide-react'
import { spGetAttachments, spUploadAttachment, spAttachmentUrl } from '../../services/sharepoint'

interface Props {
  listName: string
  itemId: number
  readOnly?: boolean
}

export function AttachmentSection({ listName, itemId, readOnly = false }: Props) {
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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Paperclip size={12} className="text-gray-400" />
        <span className="text-xs font-medium text-gray-500">
          ไฟล์แนบ {!loadingFiles && `(${files.length})`}
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
              {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
            </button>
            <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {loadingFiles ? (
        <p className="text-xs text-gray-400 italic pl-4">กำลังโหลด...</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-gray-400 italic pl-4">ไม่มีไฟล์แนบ</p>
      ) : (
        <div className="space-y-1 pl-4">
          {files.map(f => (
            <a
              key={f.FileName}
              href={spAttachmentUrl(f.ServerRelativeUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline"
            >
              <Download size={11} className="flex-shrink-0" />
              <span className="truncate">{f.FileName}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
