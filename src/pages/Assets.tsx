import { useEffect, useState } from 'react'
import { Search, Plus, AlertTriangle } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spCreate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Asset } from '../types/asset'
import { getStatusColor } from '../utils/colorUtils'
import { formatDate, isWarrantyExpiringSoon, daysUntil } from '../utils/dateUtils'

export default function Assets() {
  const { user, addToast } = useAppStore()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'Computer', status: 'Active', os: '', ipAddress: '', username: '', password: '', serialNumber: '', model: '', warrantyDate: '', owner: '', location: '' })
  const [creating, setCreating] = useState(false)

  function load() {
    setLoading(true)
    spGet<Asset>('IT_Assets', undefined, undefined, 'Title asc').then(setAssets).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function createAsset(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await spCreate('IT_Assets', form)
      addToast('success', 'เพิ่ม Asset เรียบร้อย')
      setShowCreate(false)
      setForm({ title: '', category: 'Computer', status: 'Active', os: '', ipAddress: '', username: '', password: '', serialNumber: '', model: '', warrantyDate: '', owner: '', location: '' })
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setCreating(false) }
  }

  const filtered = assets.filter(a =>
    (!search || a.Title.toLowerCase().includes(search.toLowerCase()) || a.IPAddress?.includes(search)) &&
    (!categoryFilter || a.Category === categoryFilter) &&
    (!statusFilter || a.Status === statusFilter)
  )

  const canAdmin = ['Admin', 'Boss'].includes(user?.role ?? '')
  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div>
      <Header title="IT Assets" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Warranty alerts */}
        {assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate)).length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 text-sm text-orange-700 dark:text-orange-400 flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate)).length} รายการประกันจะหมดภายใน 60 วัน</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="ค้นหา Asset..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-48" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">หมวดหมู่ทั้งหมด</option>
            {['Computer', 'Server', 'VM', 'Network', 'Certificate', 'Other'].map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">สถานะทั้งหมด</option>
            {['Active', 'Inactive', 'Maintenance', 'Retired'].map(s => <option key={s}>{s}</option>)}
          </select>
          {canAdmin && <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> เพิ่ม Asset</Button>}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 grid grid-cols-12 text-xs font-medium text-gray-500 gap-3">
            <span className="col-span-3">ชื่อ / รุ่น</span>
            <span className="col-span-2">หมวดหมู่</span>
            <span className="col-span-2">สถานะ</span>
            <span className="col-span-2 hidden md:block">IP Address</span>
            <span className="col-span-3 hidden md:block">ประกันหมด</span>
          </div>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Asset</p>
              : filtered.map(a => {
                  const expiring = isWarrantyExpiringSoon(a.WarrantyDate)
                  const days = a.WarrantyDate ? daysUntil(a.WarrantyDate) : null
                  return (
                    <div key={a.id} className={`grid grid-cols-12 gap-3 items-center p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 text-sm ${expiring ? 'bg-orange-50/50 dark:bg-orange-900/5' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                      <div className="col-span-3">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.Title}</p>
                        <p className="text-xs text-gray-400 truncate">{a.Model}</p>
                      </div>
                      <div className="col-span-2"><Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{a.Category}</Badge></div>
                      <div className="col-span-2"><Badge className={getStatusColor(a.Status)}>{a.Status}</Badge></div>
                      <div className="col-span-2 hidden md:block text-xs text-gray-500 font-mono">{a.IPAddress || '-'}</div>
                      <div className="col-span-3 hidden md:block">
                        {a.WarrantyDate ? (
                          <div className={`flex items-center gap-1 text-xs ${expiring ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                            {expiring && <AlertTriangle size={12} />}
                            {formatDate(a.WarrantyDate)}
                            {days !== null && days >= 0 && <span>({days} วัน)</span>}
                            {days !== null && days < 0 && <span className="text-red-600">(หมดแล้ว)</span>}
                          </div>
                        ) : <span className="text-xs text-gray-400">-</span>}
                      </div>
                    </div>
                  )
                })
          }
        </div>
        <p className="text-xs text-gray-400">{filtered.length} รายการ</p>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="เพิ่ม IT Asset" size="lg">
        <form onSubmit={createAsset} className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className={labelClass}>ชื่อ Asset *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>หมวดหมู่</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputClass}>
              {['Computer', 'Server', 'VM', 'Network', 'Certificate', 'Other'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>สถานะ</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
              {['Active', 'Inactive', 'Maintenance', 'Retired'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>OS</label><input value={form.os} onChange={e => setForm(f => ({ ...f, os: e.target.value }))} className={inputClass} placeholder="Windows 11, Ubuntu..." /></div>
          <div><label className={labelClass}>IP Address</label><input value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>Username</label><input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>Password</label><input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>Serial Number</label><input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>Model</label><input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>วันหมดประกัน</label><input type="date" value={form.warrantyDate} onChange={e => setForm(f => ({ ...f, warrantyDate: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>ผู้ดูแล</label><input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} className={inputClass} /></div>
          <div className="col-span-2"><label className={labelClass}>สถานที่</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className={inputClass} /></div>
          <div className="col-span-2"><Button type="submit" disabled={creating} className="w-full justify-center">{creating ? 'กำลังบันทึก...' : 'บันทึก'}</Button></div>
        </form>
      </Modal>
    </div>
  )
}
