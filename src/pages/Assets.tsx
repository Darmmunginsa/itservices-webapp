import { useEffect, useState } from 'react'
import { Search, Plus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
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

const CATEGORIES = ['Computer', 'Server', 'VM', 'Network', 'Certificate', 'Software', 'Other'] as const
const STATUSES   = ['Active', 'Inactive', 'Maintenance', 'Retired'] as const
const OWNER_TYPES = ['Company', 'Department', 'User']

const EMPTY_FORM = {
  Title: '', AssetCode: '', Category: 'Computer', Status: 'Active',
  OS: '', IPAddress: '', Username: '', Password: '',
  SerialNumber: '', Spec: '', Vendor: '',
  OwnerType: 'Company', AssignedTo: '', AssignedEmail: '',
  PurchaseDate: '', Price: '', WarrantyDate: '',
  AppName: '', AccessMethod: '', ExpiryDate: '', LicenseType: '',
  Note: '',
}

// Software & Certificate categories that need the extra fields
const SOFTWARE_LIKE = new Set(['Certificate', 'Software'])

export default function Assets() {
  const { user, addToast } = useAppStore()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM })
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  function load() {
    setLoading(true)
    spGet<Asset>('IT_Assets', undefined, undefined, 'Title asc')
      .then(setAssets).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const set = (key: keyof typeof EMPTY_FORM, val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  async function createAsset(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      // Send fields with exact SP column names
      await spCreate('IT_Assets', {
        Title: form.Title,
        AssetCode: form.AssetCode || undefined,
        Category: form.Category,
        Status: form.Status,
        OS: form.OS || undefined,
        IPAddress: form.IPAddress || undefined,
        Username: form.Username || undefined,
        Password: form.Password || undefined,
        SerialNumber: form.SerialNumber || undefined,
        Spec: form.Spec || undefined,
        Vendor: form.Vendor || undefined,
        OwnerType: form.OwnerType || undefined,
        AssignedTo: form.AssignedTo || undefined,
        AssignedEmail: form.AssignedEmail || undefined,
        PurchaseDate: form.PurchaseDate || undefined,
        Price: form.Price ? Number(form.Price) : undefined,
        WarrantyDate: form.WarrantyDate || undefined,
        AppName: form.AppName || undefined,
        AccessMethod: form.AccessMethod || undefined,
        ExpiryDate: form.ExpiryDate || undefined,
        LicenseType: form.LicenseType || undefined,
        Note: form.Note || undefined,
      })
      addToast('success', 'เพิ่ม Asset เรียบร้อย')
      setShowCreate(false)
      setForm({ ...EMPTY_FORM })
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setCreating(false) }
  }

  const filtered = assets.filter(a =>
    (!search ||
      a.Title.toLowerCase().includes(search.toLowerCase()) ||
      a.AssetCode?.toLowerCase().includes(search.toLowerCase()) ||
      a.IPAddress?.includes(search) ||
      a.AssignedTo?.toLowerCase().includes(search.toLowerCase())) &&
    (!categoryFilter || a.Category === categoryFilter) &&
    (!statusFilter || a.Status === statusFilter)
  )

  const canAdmin = ['Admin', 'Boss'].includes(user?.role ?? '')
  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const isSoftwareLike = SOFTWARE_LIKE.has(form.Category as never)

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
            <input placeholder="ค้นหา Asset, IP, ผู้ใช้..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-56" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">หมวดหมู่ทั้งหมด</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">สถานะทั้งหมด</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {canAdmin && <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> เพิ่ม Asset</Button>}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 grid grid-cols-12 text-xs font-medium text-gray-500 gap-2">
            <span className="col-span-3">ชื่อ / รหัส</span>
            <span className="col-span-2">หมวดหมู่</span>
            <span className="col-span-2">สถานะ</span>
            <span className="col-span-2 hidden md:block">ผู้ใช้งาน</span>
            <span className="col-span-3 hidden md:block">ประกัน / หมดอายุ</span>
          </div>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Asset</p>
              : filtered.map(a => {
                  const warrantyDate = a.WarrantyDate || a.ExpiryDate
                  const expiring = isWarrantyExpiringSoon(warrantyDate)
                  const days = warrantyDate ? daysUntil(warrantyDate) : null
                  const isExpanded = expandedId === a.id
                  return (
                    <div key={a.id} className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${expiring ? 'bg-orange-50/50 dark:bg-orange-900/5' : ''}`}>
                      <div
                        className="grid grid-cols-12 gap-2 items-center p-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        <div className="col-span-3">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.Title}</p>
                          {a.AssetCode && <p className="text-xs text-gray-400 font-mono">{a.AssetCode}</p>}
                        </div>
                        <div className="col-span-2"><Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{a.Category}</Badge></div>
                        <div className="col-span-2"><Badge className={getStatusColor(a.Status)}>{a.Status}</Badge></div>
                        <div className="col-span-2 hidden md:block text-xs text-gray-500 truncate">{a.AssignedTo || '-'}</div>
                        <div className="col-span-2 hidden md:block">
                          {warrantyDate ? (
                            <div className={`flex items-center gap-1 text-xs ${expiring ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                              {expiring && <AlertTriangle size={11} />}
                              {formatDate(warrantyDate)}
                              {days !== null && days >= 0 && <span>({days}d)</span>}
                              {days !== null && days < 0 && <span className="text-red-600">(หมดแล้ว)</span>}
                            </div>
                          ) : <span className="text-xs text-gray-400">-</span>}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 pt-3">
                          {a.IPAddress && <div><p className="text-gray-400">IP Address</p><p className="font-mono">{a.IPAddress}</p></div>}
                          {a.SerialNumber && <div><p className="text-gray-400">Serial No.</p><p>{a.SerialNumber}</p></div>}
                          {a.OS && <div><p className="text-gray-400">OS</p><p>{a.OS}</p></div>}
                          {a.Vendor && <div><p className="text-gray-400">Vendor</p><p>{a.Vendor}</p></div>}
                          {a.PurchaseDate && <div><p className="text-gray-400">วันที่ซื้อ</p><p>{formatDate(a.PurchaseDate)}</p></div>}
                          {a.Price && <div><p className="text-gray-400">ราคา</p><p>{a.Price.toLocaleString()} บาท</p></div>}
                          {a.Spec && <div className="col-span-2"><p className="text-gray-400">Spec</p><p>{a.Spec}</p></div>}
                          {a.AppName && <div><p className="text-gray-400">App</p><p>{a.AppName}</p></div>}
                          {a.LicenseType && <div><p className="text-gray-400">License</p><p>{a.LicenseType}</p></div>}
                          {a.AccessMethod && <div><p className="text-gray-400">Access</p><p>{a.AccessMethod}</p></div>}
                          {a.AssignedEmail && <div><p className="text-gray-400">Email ผู้ใช้</p><p className="truncate">{a.AssignedEmail}</p></div>}
                          {a.Note && <div className="col-span-2 md:col-span-4"><p className="text-gray-400">หมายเหตุ</p><p className="whitespace-pre-wrap">{a.Note}</p></div>}
                          {a.Username && canAdmin && <div><p className="text-gray-400">Username</p><p className="font-mono">{a.Username}</p></div>}
                        </div>
                      )}
                    </div>
                  )
                })
          }
        </div>
        <p className="text-xs text-gray-400">{filtered.length} รายการ</p>
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="เพิ่ม IT Asset" size="lg">
        <form onSubmit={createAsset} className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">

          {/* Basic */}
          <div className="col-span-2"><label className={labelClass}>ชื่อ Asset *</label>
            <input required value={form.Title} onChange={e => set('Title', e.target.value)} className={inputClass} placeholder="เช่น LAPTOP-JOHN-01" /></div>
          <div><label className={labelClass}>รหัส Asset</label>
            <input value={form.AssetCode} onChange={e => set('AssetCode', e.target.value)} className={inputClass} placeholder="เช่น IT-2024-001" /></div>
          <div><label className={labelClass}>หมวดหมู่</label>
            <select value={form.Category} onChange={e => set('Category', e.target.value)} className={inputClass}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>สถานะ</label>
            <select value={form.Status} onChange={e => set('Status', e.target.value)} className={inputClass}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>ประเภทผู้ถือครอง</label>
            <select value={form.OwnerType} onChange={e => set('OwnerType', e.target.value)} className={inputClass}>
              {OWNER_TYPES.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Network */}
          {!isSoftwareLike && (
            <>
              <div><label className={labelClass}>IP Address</label>
                <input value={form.IPAddress} onChange={e => set('IPAddress', e.target.value)} className={inputClass} placeholder="192.168.1.x" /></div>
              <div><label className={labelClass}>OS</label>
                <input value={form.OS} onChange={e => set('OS', e.target.value)} className={inputClass} placeholder="Windows 11, Ubuntu 22..." /></div>
              <div><label className={labelClass}>Serial Number</label>
                <input value={form.SerialNumber} onChange={e => set('SerialNumber', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Vendor / ยี่ห้อ</label>
                <input value={form.Vendor} onChange={e => set('Vendor', e.target.value)} className={inputClass} placeholder="Dell, HP, Cisco..." /></div>
              <div className="col-span-2"><label className={labelClass}>Spec</label>
                <input value={form.Spec} onChange={e => set('Spec', e.target.value)} className={inputClass} placeholder="i7 16GB RAM 512GB SSD..." /></div>
              <div><label className={labelClass}>Username</label>
                <input value={form.Username} onChange={e => set('Username', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Password</label>
                <input type="password" value={form.Password} onChange={e => set('Password', e.target.value)} className={inputClass} /></div>
            </>
          )}

          {/* Software / Certificate */}
          {isSoftwareLike && (
            <>
              <div><label className={labelClass}>App / ชื่อซอฟต์แวร์</label>
                <input value={form.AppName} onChange={e => set('AppName', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>License Type</label>
                <input value={form.LicenseType} onChange={e => set('LicenseType', e.target.value)} className={inputClass} placeholder="Annual, Perpetual, Per-user..." /></div>
              <div><label className={labelClass}>วิธีเข้าถึง</label>
                <input value={form.AccessMethod} onChange={e => set('AccessMethod', e.target.value)} className={inputClass} placeholder="URL, VPN, Key..." /></div>
              <div><label className={labelClass}>วันหมดอายุ</label>
                <input type="date" value={form.ExpiryDate} onChange={e => set('ExpiryDate', e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Vendor</label>
                <input value={form.Vendor} onChange={e => set('Vendor', e.target.value)} className={inputClass} /></div>
            </>
          )}

          {/* Ownership */}
          <div><label className={labelClass}>ผู้ใช้งาน</label>
            <input value={form.AssignedTo} onChange={e => set('AssignedTo', e.target.value)} className={inputClass} placeholder="ชื่อพนักงาน" /></div>
          <div><label className={labelClass}>Email ผู้ใช้งาน</label>
            <input type="email" value={form.AssignedEmail} onChange={e => set('AssignedEmail', e.target.value)} className={inputClass} /></div>

          {/* Financials */}
          <div><label className={labelClass}>วันที่ซื้อ</label>
            <input type="date" value={form.PurchaseDate} onChange={e => set('PurchaseDate', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>ราคา (บาท)</label>
            <input type="number" min="0" value={form.Price} onChange={e => set('Price', e.target.value)} className={inputClass} /></div>
          {!isSoftwareLike && (
            <div><label className={labelClass}>วันหมดประกัน</label>
              <input type="date" value={form.WarrantyDate} onChange={e => set('WarrantyDate', e.target.value)} className={inputClass} /></div>
          )}

          {/* Notes */}
          <div className="col-span-2"><label className={labelClass}>หมายเหตุ</label>
            <textarea value={form.Note} onChange={e => set('Note', e.target.value)} rows={2} className={inputClass} /></div>

          <div className="col-span-2">
            <Button type="submit" disabled={creating} className="w-full justify-center">{creating ? 'กำลังบันทึก...' : 'บันทึก Asset'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
