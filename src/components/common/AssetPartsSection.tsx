import { useEffect, useState } from 'react'
import { Plus, Trash2, Cpu } from 'lucide-react'
import { spGet, spCreate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { useT } from '../../i18n/useT'

export interface AssetPart {
  id: number
  Title: string          // ชื่อ Part เช่น "HDD Slot 1", "PSU 1"
  AssetID: number
  SerialNumber?: string
  Note?: string
}

export function AssetPartsSection({ assetId, canEdit }: { assetId: number; canEdit: boolean }) {
  const { addToast } = useAppStore()
  const tr = useT()
  const [parts, setParts] = useState<AssetPart[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [serial, setSerial] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    spGet<AssetPart>('IT_AssetParts', `AssetID eq ${assetId}`, 'Id,Title,AssetID,SerialNumber,Note', 'Title asc', 200)
      .then(setParts).catch(() => {}).finally(() => setLoading(false))
  }, [assetId])

  async function addPart(e: React.FormEvent) {
    e.preventDefault(); e.stopPropagation()
    if (!name.trim() && !serial.trim()) return
    setSaving(true)
    try {
      const res = await spCreate('IT_AssetParts', {
        Title: name.trim() || 'Part',
        AssetID: assetId,
        SerialNumber: serial.trim() || undefined,
        Note: note.trim() || undefined,
      })
      setParts(prev => [...prev, { id: res.id, Title: name.trim() || 'Part', AssetID: assetId, SerialNumber: serial.trim(), Note: note.trim() }])
      setName(''); setSerial(''); setNote('')
      addToast('success', 'เพิ่ม Part แล้ว')
    } catch { addToast('error', 'เพิ่มไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  async function removePart(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await spDelete('IT_AssetParts', id)
      setParts(prev => prev.filter(p => p.id !== id))
      addToast('success', 'ลบ Part แล้ว')
    } catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  const inp = 'px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500'

  return (
    <div className="col-span-2 md:col-span-4" onClick={e => e.stopPropagation()}>
      <p className="text-gray-400 mb-1 flex items-center gap-1"><Cpu size={12} /> Parts / Serial Numbers</p>

      {loading ? (
        <p className="text-xs text-gray-300">{tr('comp.loading')}</p>
      ) : parts.length === 0 ? (
        <p className="text-xs text-gray-300 mb-2">{tr('parts.none')}</p>
      ) : (
        <div className="space-y-1 mb-2">
          {parts.map(p => (
            <div key={p.id} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-800 rounded-md px-2 py-1.5">
              <span className="font-medium text-gray-700 dark:text-gray-200 min-w-[90px] truncate">{p.Title}</span>
              <span className="font-mono text-gray-600 dark:text-gray-300 flex-1 truncate">{p.SerialNumber || '-'}</span>
              {p.Note && <span className="text-gray-400 truncate max-w-[120px]">{p.Note}</span>}
              {canEdit && (
                <button onClick={e => removePart(p.id, e)} title={tr('assets.delete')}
                  className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 size={12} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form onSubmit={addPart} className="flex flex-wrap items-center gap-1.5">
          <input value={name} onChange={e => setName(e.target.value)} placeholder={tr('parts.namePlaceholder')} className={`${inp} w-32`} />
          <input value={serial} onChange={e => setSerial(e.target.value)} placeholder="Serial Number" className={`${inp} w-40 font-mono`} />
          <input value={note} onChange={e => setNote(e.target.value)} placeholder={tr('parts.notePlaceholder')} className={`${inp} w-32`} />
          <button type="submit" disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
            <Plus size={12} /> {tr('comp.add')}
          </button>
        </form>
      )}
    </div>
  )
}
