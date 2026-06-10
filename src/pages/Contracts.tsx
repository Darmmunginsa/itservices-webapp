import { useEffect, useState } from 'react'
import { Search, Plus, Trash2, Pencil } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Contract } from '../types/ticket'
import { getStatusColor } from '../utils/colorUtils'
import { useT } from '../i18n/useT'

export default function Contracts() {
  const { addToast } = useAppStore()
  const tr = useT()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [form, setForm] = useState({ title: '', customerEmail: '', phone: '', company: '', status: 'Active' })
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    spGet<Contract>('HD_Contracts', undefined, undefined, 'Title asc').then(setContracts).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing(null)
    setForm({ title: '', customerEmail: '', phone: '', company: '', status: 'Active' })
    setShowModal(true)
  }

  function openEdit(c: Contract) {
    setEditing(c)
    setForm({ title: c.Title, customerEmail: c.CustomerEmail, phone: c.Phone, company: c.Company, status: c.Status })
    setShowModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { Title: form.title, CustomerEmail: form.customerEmail, Phone: form.phone, Company: form.company, Status: form.status }
      if (editing) {
        await spUpdate('HD_Contracts', editing.id, payload)
        addToast('success', 'อัปเดตข้อมูลลูกค้าแล้ว')
      } else {
        await spCreate('HD_Contracts', payload)
        addToast('success', 'เพิ่มลูกค้าแล้ว')
      }
      setShowModal(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!window.confirm('ลบลูกค้านี้?')) return
    try {
      await spDelete('HD_Contracts', id)
      setContracts(prev => prev.filter(c => c.id !== id))
      addToast('success', 'ลบแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  const filtered = contracts.filter(c =>
    (!search || c.Title.toLowerCase().includes(search.toLowerCase()) || c.Company?.toLowerCase().includes(search.toLowerCase()) || c.CustomerEmail?.includes(search)) &&
    (!statusFilter || c.Status === statusFilter)
  )

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div>
      <Header title={tr('contacts.title')} />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative w-full sm:w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder={tr('contacts.search')} value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">{tr('common.allStatus')}</option>
            {['Active', 'Inactive', 'Expired'].map(s => <option key={s}>{s}</option>)}
          </select>
          <Button size="sm" onClick={openCreate}><Plus size={14} /> {tr('contacts.addCustomer')}</Button>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">{tr('contacts.noData')}</p>
              : filtered.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{c.Title}</p>
                      <div className="mt-0.5 text-xs text-gray-400 space-y-0.5">
                        <p className="truncate">{c.Company}</p>
                        <p className="truncate">{c.CustomerEmail}{c.Phone ? ` · ${c.Phone}` : ''}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(c.Status)}>{c.Status}</Badge>
                    <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><Pencil size={14} /></button>
                    <button onClick={() => del(c.id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400"><Trash2 size={14} /></button>
                  </div>
                ))
          }
        </div>
        <p className="text-xs text-gray-400">{filtered.length} {tr('assets.items')}</p>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? tr('contacts.editCustomer') : tr('contacts.addCustomer')}>
        <form onSubmit={save} className="space-y-4">
          <div><label className={labelClass}>{tr('contacts.contactName')} *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{tr('contacts.company')}</label><input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>Email *</label><input required type="email" value={form.customerEmail} onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{tr('contacts.phone')}</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>{tr('assets.statusLabel')}</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
              {['Active', 'Inactive', 'Expired'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={saving} className="w-full justify-center">{saving ? tr('common.saving') : tr('common.save')}</Button>
        </form>
      </Modal>
    </div>
  )
}
