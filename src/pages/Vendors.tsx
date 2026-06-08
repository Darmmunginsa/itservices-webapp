import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Briefcase, Phone, Mail, ExternalLink, AlertTriangle } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonCard } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { formatDate, isWarrantyExpiringSoon, daysUntil } from '../utils/dateUtils'
import type { Vendor } from '../types/vendor'

const EMPTY = {
  Title: '', ContactName: '', Phone: '', Email: '',
  ContractNo: '', ContractStart: '', ContractEnd: '',
  SupportScope: '', Note: '', PortalURL: '',
}
type Form = typeof EMPTY

function toForm(v: Vendor): Form {
  return {
    Title: v.Title || '', ContactName: v.ContactName || '', Phone: v.Phone || '', Email: v.Email || '',
    ContractNo: v.ContractNo || '',
    ContractStart: v.ContractStart?.slice(0, 10) || '', ContractEnd: v.ContractEnd?.slice(0, 10) || '',
    SupportScope: v.SupportScope || '', Note: v.Note || '', PortalURL: v.PortalURL || '',
  }
}

export default function Vendors() {
  const { user, addToast } = useAppStore()
  const isAdmin = ['Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)
  const [form, setForm] = useState<Form>({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    spGet<Vendor>('IT_Vendors', undefined, undefined, 'Title asc', 500)
      .then(setVendors).catch(() => addToast('error', 'โหลด Vendor ไม่ได้')).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const set = (k: keyof Form, val: string) => setForm(f => ({ ...f, [k]: val }))

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setShowModal(true) }
  function openEdit(v: Vendor) { setEditing(v); setForm(toForm(v)); setShowModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.Title.trim()) return
    setSaving(true)
    const payload = {
      Title: form.Title, ContactName: form.ContactName || undefined, Phone: form.Phone || undefined,
      Email: form.Email || undefined, ContractNo: form.ContractNo || undefined,
      ContractStart: form.ContractStart || undefined, ContractEnd: form.ContractEnd || undefined,
      SupportScope: form.SupportScope || undefined, Note: form.Note || undefined, PortalURL: form.PortalURL || undefined,
    }
    try {
      if (editing) { await spUpdate('IT_Vendors', editing.id, payload); addToast('success', 'อัปเดต Vendor แล้ว') }
      else { await spCreate('IT_Vendors', payload); addToast('success', 'เพิ่ม Vendor แล้ว') }
      setShowModal(false); load()
    } catch { addToast('error', 'บันทึกไม่สำเร็จ') } finally { setSaving(false) }
  }

  async function remove(v: Vendor) {
    if (!window.confirm(`ลบ Vendor "${v.Title}"?`)) return
    try { await spDelete('IT_Vendors', v.id); setVendors(prev => prev.filter(x => x.id !== v.id)); addToast('success', 'ลบแล้ว') }
    catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  const filtered = vendors.filter(v =>
    [v.Title, v.ContactName, v.Phone, v.Email, v.ContractNo].some(s => (s || '').toLowerCase().includes(search.toLowerCase())))
  const expiringCount = vendors.filter(v => isWarrantyExpiringSoon(v.ContractEnd)).length

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div>
      <Header title="Vendor Contracts" />
      <div className="p-4 md:p-6 space-y-4">
        {expiringCount > 0 && (
          <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
            <AlertTriangle size={16} /> <span>{expiringCount} สัญญาจะหมดอายุภายใน 60 วัน</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา Vendor / ผู้ติดต่อ / เลขสัญญา..."
              className="flex-1 bg-transparent text-sm focus:outline-none" />
          </div>
          {isAdmin && <Button onClick={openCreate}><Plus size={15} /> เพิ่ม Vendor</Button>}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{vendors.length === 0 ? 'ยังไม่มี Vendor — กด "เพิ่ม Vendor"' : 'ไม่พบ Vendor ที่ค้นหา'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(v => {
              const days = v.ContractEnd ? daysUntil(v.ContractEnd) : null
              const expiring = isWarrantyExpiringSoon(v.ContractEnd)
              return (
                <div key={v.id} className={`subpanel bg-white dark:bg-gray-900 border rounded-xl p-4 ${expiring ? 'border-orange-300 dark:border-orange-800' : 'border-gray-200 dark:border-gray-800'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{v.Title}</h3>
                      {v.ContractNo && <p className="text-xs text-gray-400 font-mono">{v.ContractNo}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(v)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600"><Pencil size={13} /></button>
                        <button onClick={() => remove(v)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    {v.ContactName && <p className="font-medium text-gray-800 dark:text-gray-200">{v.ContactName}</p>}
                    {v.Phone && <p className="flex items-center gap-1.5"><Phone size={12} className="text-gray-400" /> <a href={`tel:${v.Phone}`} className="hover:underline">{v.Phone}</a></p>}
                    {v.Email && <p className="flex items-center gap-1.5"><Mail size={12} className="text-gray-400" /> <a href={`mailto:${v.Email}`} className="hover:underline truncate">{v.Email}</a></p>}
                    {v.PortalURL && <p className="flex items-center gap-1.5"><ExternalLink size={12} className="text-gray-400" /> <a href={v.PortalURL} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate">Portal แจ้งงาน</a></p>}
                    {v.SupportScope && <p className="text-gray-500 line-clamp-2 pt-1">{v.SupportScope}</p>}
                    {v.ContractEnd && (
                      <p className={`pt-1 ${expiring ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                        สัญญาถึง {formatDate(v.ContractEnd)}
                        {days !== null && (days < 0 ? ' (หมดแล้ว)' : ` (เหลือ ${days} วัน)`)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'แก้ไข Vendor' : 'เพิ่ม Vendor'} size="lg">
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelClass}>ชื่อ Vendor / บริษัท *</label>
            <input required value={form.Title} onChange={e => set('Title', e.target.value)} className={inputClass} placeholder="เช่น Inet, Dell ProSupport..." /></div>
          <div><label className={labelClass}>ผู้ติดต่อ</label>
            <input value={form.ContactName} onChange={e => set('ContactName', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>เลขสัญญา</label>
            <input value={form.ContractNo} onChange={e => set('ContractNo', e.target.value)} className={`${inputClass} font-mono`} /></div>
          <div><label className={labelClass}>โทรศัพท์</label>
            <input value={form.Phone} onChange={e => set('Phone', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>อีเมล</label>
            <input type="email" value={form.Email} onChange={e => set('Email', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>วันเริ่มสัญญา</label>
            <input type="date" value={form.ContractStart} onChange={e => set('ContractStart', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>วันหมดสัญญา</label>
            <input type="date" value={form.ContractEnd} onChange={e => set('ContractEnd', e.target.value)} className={inputClass} /></div>
          <div className="col-span-2"><label className={labelClass}>เว็บ / Portal แจ้งงาน</label>
            <input value={form.PortalURL} onChange={e => set('PortalURL', e.target.value)} className={inputClass} placeholder="https://support.vendor.com" /></div>
          <div className="col-span-2"><label className={labelClass}>ขอบเขตบริการ / SLA</label>
            <textarea value={form.SupportScope} onChange={e => set('SupportScope', e.target.value)} rows={2} className={inputClass} placeholder="เช่น 8x5 NBD, ครอบคลุม Hardware..." /></div>
          <div className="col-span-2"><label className={labelClass}>หมายเหตุ</label>
            <textarea value={form.Note} onChange={e => set('Note', e.target.value)} rows={2} className={inputClass} /></div>
          <div className="col-span-2">
            <Button type="submit" disabled={saving} className="w-full justify-center">{saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่ม Vendor'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
