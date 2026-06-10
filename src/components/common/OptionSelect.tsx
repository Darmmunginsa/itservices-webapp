import { useEffect, useState } from 'react'
import { Settings2, Plus, X } from 'lucide-react'
import { spGet, spCreate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { useT } from '../../i18n/useT'

interface HDOption { id: number; Title: string; Category: string; SortOrder?: number }

// Module-level cache so we don't refetch per dropdown
let _cache: HDOption[] | null = null
let _inflight: Promise<HDOption[]> | null = null

async function fetchOptions(): Promise<HDOption[]> {
  if (_cache) return _cache
  if (_inflight) return _inflight
  _inflight = spGet<HDOption>('HD_Options', undefined, undefined, 'SortOrder asc')
    .then(rows => { _cache = rows; return rows })
    .catch(() => { _cache = []; return [] })
    .finally(() => { _inflight = null })
  return _inflight
}

interface Props {
  category: string          // e.g. 'AssetCategory'
  defaults: string[]        // built-in fallback options
  value: string
  onChange: (v: string) => void
  className?: string
  id?: string
}

/**
 * Dropdown whose options = defaults ∪ custom options from HD_Options (by category).
 * Admins/Boss see a ⚙ button to add/remove custom options inline.
 */
export function OptionSelect({ category, defaults, value, onChange, className, id }: Props) {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const isAdmin = ['Admin', 'Boss'].includes(user?.role ?? '')
  const [custom, setCustom] = useState<HDOption[]>([])
  const [managing, setManaging] = useState(false)
  const [newOpt, setNewOpt] = useState('')
  const [busy, setBusy] = useState(false)

  function refresh() {
    fetchOptions().then(all => setCustom(all.filter(o => o.Category === category)))
  }
  useEffect(() => { refresh() }, [category])

  // merged unique options (defaults first, then custom not already in defaults)
  const merged = [...defaults, ...custom.map(c => c.Title).filter(t => !defaults.includes(t))]

  async function addOption() {
    const v = newOpt.trim()
    if (!v) return
    if (merged.includes(v)) { addToast('info', 'มีตัวเลือกนี้แล้ว'); return }
    setBusy(true)
    try {
      const res = await spCreate('HD_Options', { Title: v, Category: category, SortOrder: 100 + custom.length })
      const row = { id: res.id, Title: v, Category: category, SortOrder: 100 + custom.length }
      if (_cache) _cache.push(row)
      setCustom(prev => [...prev, row])
      setNewOpt('')
      addToast('success', `เพิ่มตัวเลือก "${v}" แล้ว`)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setBusy(false) }
  }

  async function removeOption(o: HDOption) {
    setBusy(true)
    try {
      await spDelete('HD_Options', o.id)
      if (_cache) _cache = _cache.filter(c => c.id !== o.id)
      setCustom(prev => prev.filter(c => c.id !== o.id))
      addToast('success', 'ลบตัวเลือกแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select id={id} value={value} onChange={e => onChange(e.target.value)} className={className}>
        {merged.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {isAdmin && (
        <button type="button" onClick={() => setManaging(true)} title={tr('opt.manage')}
          className="flex-shrink-0 p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-primary-600 hover:border-primary-400 transition-colors">
          <Settings2 size={15} />
        </button>
      )}

      {managing && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40" onClick={e => { if (e.target === e.currentTarget) setManaging(false) }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{tr('opt.manageTitle')}: {category}</h3>
              <button onClick={() => setManaging(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {defaults.map(d => (
                <div key={d} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <span>{d}</span>
                  <span className="text-xs text-gray-400">{tr('opt.default')}</span>
                </div>
              ))}
              {custom.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span>{c.Title}</span>
                  <button onClick={() => removeOption(c)} disabled={busy} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input value={newOpt} onChange={e => setNewOpt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addOption() }}
                placeholder={tr('opt.addNew')} autoFocus
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <button onClick={addOption} disabled={busy || !newOpt.trim()}
                className="px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1">
                <Plus size={14} /> {tr('comp.add')}
              </button>
            </div>
            <p className="text-xs text-gray-400">{tr('opt.hint')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
