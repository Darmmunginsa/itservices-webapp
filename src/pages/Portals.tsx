import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Globe, ExternalLink, User } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { OptionSelect } from '../components/common/OptionSelect'
import { SkeletonCard } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Portal } from '../types/portal'
import { useT } from '../i18n/useT'

const EMPTY = { Title: '', URL: '', Category: '', Username: '', Note: '' }
type Form = typeof EMPTY

function toForm(p: Portal): Form {
  return {
    Title: p.Title || '', URL: p.URL || '', Category: p.Category || '',
    Username: p.Username || '', Note: p.Note || '',
  }
}

export default function Portals() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const isAdmin = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const [portals, setPortals] = useState<Portal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Portal | null>(null)
  const [form, setForm] = useState<Form>({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    spGet<Portal>('IT_Portals', undefined, undefined, 'Title asc', 500)
      .then(setPortals).catch(() => addToast('error', tr('portals.loadErr'))).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const set = (k: keyof Form, val: string) => setForm(f => ({ ...f, [k]: val }))

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setShowModal(true) }
  function openEdit(p: Portal) { setEditing(p); setForm(toForm(p)); setShowModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.Title.trim()) return
    setSaving(true)
    const payload = {
      Title: form.Title, URL: form.URL || undefined, Category: form.Category || undefined,
      Username: form.Username || undefined, Note: form.Note || undefined,
    }
    try {
      if (editing) { await spUpdate('IT_Portals', editing.id, payload); addToast('success', tr('common.saveEdit')) }
      else { await spCreate('IT_Portals', payload); addToast('success', tr('portals.add')) }
      setShowModal(false); load()
    } catch { addToast('error', tr('common.error')) } finally { setSaving(false) }
  }

  async function remove(p: Portal) {
    if (!window.confirm(`${tr('assets.delete')} "${p.Title}"?`)) return
    try { await spDelete('IT_Portals', p.id); setPortals(prev => prev.filter(x => x.id !== p.id)); addToast('success', tr('common.deleted')) }
    catch { addToast('error', tr('common.error')) }
  }

  const filtered = portals.filter(p =>
    [p.Title, p.Category, p.URL, p.Username].some(s => (s || '').toLowerCase().includes(search.toLowerCase())))

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div>
      <Header title={tr('portals.title')} />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('portals.search')}
              className="flex-1 bg-transparent text-sm focus:outline-none" />
          </div>
          {isAdmin && <Button onClick={openCreate}><Plus size={15} /> {tr('portals.add')}</Button>}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Globe size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{tr('portals.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="subpanel bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{p.Title}</h3>
                    {p.Category && <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{p.Category}</span>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600"><Pencil size={13} /></button>
                      <button onClick={() => remove(p)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                  {p.URL && <p className="flex items-center gap-1.5"><ExternalLink size={12} className="text-gray-400" /> <a href={p.URL} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">{p.URL}</a></p>}
                  {p.Username && <p className="flex items-center gap-1.5"><User size={12} className="text-gray-400" /> <span className="truncate">{p.Username}</span></p>}
                  {p.Note && <p className="text-gray-500 line-clamp-2 pt-1">{p.Note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? tr('portals.edit') : tr('portals.add')} size="md">
        <form onSubmit={save} className="space-y-4">
          <div><label className={labelClass}>{tr('portals.name')} *</label>
            <input required value={form.Title} onChange={e => set('Title', e.target.value)} className={inputClass} placeholder={tr('portals.namePlaceholder')} /></div>
          <div><label className={labelClass}>URL</label>
            <input value={form.URL} onChange={e => set('URL', e.target.value)} className={inputClass} placeholder="https://portal.example.com" /></div>
          <div><label className={labelClass}>{tr('common.category')}</label>
            <OptionSelect category="PortalCategory" defaults={['Vendor', 'Cloud', 'Internal', 'อื่นๆ']} value={form.Category} onChange={v => set('Category', v)} className={inputClass} /></div>
          <div><label className={labelClass}>{tr('portals.username')}</label>
            <input value={form.Username} onChange={e => set('Username', e.target.value)} className={inputClass} placeholder={tr('portals.usernamePlaceholder')} /></div>
          <div><label className={labelClass}>{tr('common.note')}</label>
            <textarea value={form.Note} onChange={e => set('Note', e.target.value)} rows={2} className={inputClass} /></div>
          <Button type="submit" disabled={saving} className="w-full justify-center">{saving ? tr('common.saving') : editing ? tr('common.saveEdit') : tr('portals.add')}</Button>
        </form>
      </Modal>
    </div>
  )
}
