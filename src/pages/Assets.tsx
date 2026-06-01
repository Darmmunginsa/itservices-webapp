import { useEffect, useState } from 'react'
import { Search, Plus, AlertTriangle, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Asset } from '../types/asset'
import { getStatusColor } from '../utils/colorUtils'
import { formatDate, isWarrantyExpiringSoon, daysUntil } from '../utils/dateUtils'

const CATEGORIES = ['Computer', 'Server', 'VM', 'Network', 'Certificate', 'Software', 'Other'] as const
const STATUSES   = ['Active', 'Inactive', 'Maintenance', 'Retired'] as const
const OWNER_TYPES = ['Company', 'Department', 'User']
const SOFTWARE_LIKE = new Set(['Certificate', 'Software'])

const EMPTY_FORM = {
  Title: '', AssetCode: '', Category: 'Computer', Status: 'Active',
  OS: '', IPAddress: '', Username: '', Password: '',
  SerialNumber: '', Spec: '', Vendor: '',
  OwnerType: 'Company', AssignedTo: '', AssignedEmail: '',
  PurchaseDate: '', Price: '', WarrantyDate: '',
  AppName: '', AccessMethod: '', ExpiryDate: '', LicenseType: '',
  Note: '',
}

type AssetForm = typeof EMPTY_FORM

function assetToForm(a: Asset): AssetForm {
  return {
    Title: a.Title || '',
    AssetCode: a.AssetCode || '',
    Category: a.Category || 'Computer',
    Status: a.Status || 'Active',
    OS: a.OS || '',
    IPAddress: a.IPAddress || '',
    Username: a.Username || '',
    Password: '',
    SerialNumber: a.SerialNumber || '',
    Spec: a.Spec || '',
    Vendor: a.Vendor || '',
    OwnerType: a.OwnerType || 'Company',
    AssignedTo: a.AssignedTo || '',
    AssignedEmail: a.AssignedEmail || '',
    PurchaseDate: a.PurchaseDate?.slice(0, 10) || '',
    Price: a.Price != null ? String(a.Price) : '',
    WarrantyDate: a.WarrantyDate?.slice(0, 10) || '',
    AppName: a.AppName || '',
    AccessMethod: a.AccessMethod || '',
    ExpiryDate: a.ExpiryDate?.slice(0, 10) || '',
    LicenseType: a.LicenseType || '',
    Note: a.Note || '',
  }
}

function formToPayload(form: AssetForm) {
  return {
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
  }
}

export default function Assets() {
  const { user, addToast } = useAppStore()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<AssetForm>({ ...EMPTY_FORM })
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  // Edit state
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [editForm, setEditForm] = useState<AssetForm>({ ...EMPTY_FORM })
  const [updating, setUpdating] = useState(false)

  function load() {
    setLoading(true)
    spGet<Asset>('IT_Assets', undefined, undefined, 'Title asc')
      .then(setAssets).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const set = (key: keyof AssetForm, val: string) => setForm(f => ({ ...f, [key]: val }))
  const setEdit = (key: keyof AssetForm, val: string) => setEditForm(f => ({ ...f, [key]: val }))

  async function createAsset(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      await spCreate('IT_Assets', formToPayload(form))
      addToast('success', 'เพิ่ม Asset เรียบร้อย')
      setShowCreate(false)
      setForm({ ...EMPTY_FORM })
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setCreating(false) }
  }

  function openEdit(asset: Asset) {
    setEditForm(assetToForm(asset))
    setEditingAsset(asset)
  }

  async function updateAsset(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAsset) return
    setUpdating(true)
    try {
      await spUpdate('IT_Assets', editingAsset.id, formToPayload(editForm))
      addToast('success', 'อัปเดต Asset เรียบร้อย')
      setEditingAsset(null)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setUpdating(false) }
  }

  async function deleteAsset(id: number, title: string) {
    if (!window.confirm(`ลบ Asset "${title}"?\nการลบไม่สามารถย้อนกลับได้`)) return
    try {
      await spDelete('IT_Assets', id)
      setAssets(prev => prev.filter(a => a.id !== id))
      addToast('success', 'ลบ Asset แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
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

  function AssetFormFields({ f, upd, isSoftware }: { f: AssetForm; upd: (k: keyof AssetForm, v: string) => void; isSoftware: boolean }) {
    return (
      <>
        <div className="col-span-2"><label className={labelClass}>ชื่อ Asset *</label>
          <input required value={f.Title} onChange={e => upd('Title', e.target.value)} className={inputClass} placeholder="เช่น LAPTOP-JOHN-01" /></div>
        <div><label className={labelClass}>รหัส Asset</label>
          <input value={f.AssetCode} onChange={e => upd('AssetCode', e.target.value)} className={inputClass} placeholder="เช่น IT-2024-001" /></div>
        <div><label className={labelClass}>หมวดหมู่</label>
          <select value={f.Category} onChange={e => upd('Category', e.target.value)} className={inputClass}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select></div>
        <div><label className={labelClass}>สถานะ</label>
          <select value={f.Status} onChange={e => upd('Status', e.target.value)} className={inputClass}>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select></div>
        <div><label className={labelClass}>ประเภทผู้ถือครอง</label>
          <select value={f.OwnerType} onChange={e => upd('OwnerType', e.target.value)} className={inputClass}>
            {OWNER_TYPES.map(o => <option key={o}>{o}</option>)}
          </select></div>

        {!isSoftware && (<>
          <div><label className={labelClass}>IP Address</label>
            <input value={f.IPAddress} onChange={e => upd('IPAddress', e.target.value)} className={inputClass} placeholder="192.168.1.x" /></div>
          <div><label className={labelClass}>OS</label>
            <input value={f.OS} onChange={e => upd('OS', e.target.value)} className={inputClass} placeholder="Windows 11..." /></div>
          <div><label className={labelClass}>Serial Number</label>
            <input value={f.SerialNumber} onChange={e => upd('SerialNumber', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Vendor / ยี่ห้อ</label>
            <input value={f.Vendor} onChange={e => upd('Vendor', e.target.value)} className={inputClass} placeholder="Dell, HP..." /></div>
          <div className="col-span-2"><label className={labelClass}>Spec</label>
            <input value={f.Spec} onChange={e => upd('Spec', e.target.value)} className={inputClass} placeholder="i7 16GB RAM 512GB SSD..." /></div>
          <div><label className={labelClass}>Username</label>
            <input value={f.Username} onChange={e => upd('Username', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Password</label>
            <input type="password" value={f.Password} onChange={e => upd('Password', e.target.value)} className={inputClass} /></div>
        </>)}

        {isSoftware && (<>
          <div><label className={labelClass}>App / ชื่อซอฟต์แวร์</label>
            <input value={f.AppName} onChange={e => upd('AppName', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>License Type</label>
            <input value={f.LicenseType} onChange={e => upd('LicenseType', e.target.value)} className={inputClass} placeholder="Annual, Perpetual..." /></div>
          <div><label className={labelClass}>วิธีเข้าถึง</label>
            <input value={f.AccessMethod} onChange={e => upd('AccessMethod', e.target.value)} className={inputClass} placeholder="URL, VPN, Key..." /></div>
          <div><label className={labelClass}>วันหมดอายุ</label>
            <input type="date" value={f.ExpiryDate} onChange={e => upd('ExpiryDate', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Vendor</label>
            <input value={f.Vendor} onChange={e => upd('Vendor', e.target.value)} className={inputClass} /></div>
        </>)}

        <div><label className={labelClass}>ผู้ใช้งาน</label>
          <input value={f.AssignedTo} onChange={e => upd('AssignedTo', e.target.value)} className={inputClass} placeholder="ชื่อพนักงาน" /></div>
        <div><label className={labelClass}>Email ผู้ใช้งาน</label>
          <input type="email" value={f.AssignedEmail} onChange={e => upd('AssignedEmail', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>วันที่ซื้อ</label>
          <input type="date" value={f.PurchaseDate} onChange={e => upd('PurchaseDate', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>ราคา (บาท)</label>
          <input type="number" min="0" value={f.Price} onChange={e => upd('Price', e.target.value)} className={inputClass} /></div>
        {!isSoftware && (
          <div><label className={labelClass}>วันหมดประกัน</label>
            <input type="date" value={f.WarrantyDate} onChange={e => upd('WarrantyDate', e.target.value)} className={inputClass} /></div>
        )}
        <div className="col-span-2"><label className={labelClass}>หมายเหตุ</label>
          <textarea value={f.Note} onChange={e => upd('Note', e.target.value)} rows={2} className={inputClass} /></div>
      </>
    )
  }

  return (
    <div>
      <Header title="IT Assets" />
      <div className="p-4 md:p-6 space-y-4">

        {assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate)).length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 text-sm text-orange-700 dark:text-orange-400 flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate)).length} รายการประกันจะหมดภายใน 60 วัน</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="ค้นหา Asset, IP, ผู้ใช้..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">หมวดหมู่ทั้งหมด</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">สถานะทั้งหมด</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {canAdmin && <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> เพิ่ม Asset</Button>}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center text-xs font-medium text-gray-500 gap-2">
            <span className="flex-1">ชื่อ / รหัส</span>
            <span className="hidden sm:block w-24">หมวดหมู่</span>
            <span className="w-20">สถานะ</span>
            <span className="hidden md:block w-28">ผู้ใช้งาน</span>
            <span className="hidden md:block w-28">ประกัน / หมดอายุ</span>
            <span className="w-4" />
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
                        className="flex items-center gap-2 p-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.Title}</p>
                          {a.AssetCode && <p className="text-xs text-gray-400 font-mono">{a.AssetCode}</p>}
                        </div>
                        <div className="hidden sm:block w-24 flex-shrink-0"><Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 truncate max-w-full">{a.Category}</Badge></div>
                        <div className="w-20 flex-shrink-0"><Badge className={getStatusColor(a.Status)}>{a.Status}</Badge></div>
                        <div className="hidden md:block w-28 flex-shrink-0 text-xs text-gray-500 truncate">{a.AssignedTo || '-'}</div>
                        <div className="hidden md:block w-28 flex-shrink-0">
                          {warrantyDate ? (
                            <div className={`flex items-center gap-1 text-xs ${expiring ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
                              {expiring && <AlertTriangle size={11} />}
                              {formatDate(warrantyDate)}
                              {days !== null && days >= 0 && <span>({days}d)</span>}
                              {days !== null && days < 0 && <span className="text-red-600">(หมดแล้ว)</span>}
                            </div>
                          ) : <span className="text-xs text-gray-400">-</span>}
                        </div>
                        <div className="w-4 flex-shrink-0 flex justify-end">
                          {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 pt-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                            {a.IPAddress && <div><p className="text-gray-400">IP Address</p><p className="font-mono">{a.IPAddress}</p></div>}
                            {a.SerialNumber && <div><p className="text-gray-400">Serial No.</p><p>{a.SerialNumber}</p></div>}
                            {a.OS && <div><p className="text-gray-400">OS</p><p>{a.OS}</p></div>}
                            {a.Vendor && <div><p className="text-gray-400">Vendor</p><p>{a.Vendor}</p></div>}
                            {a.PurchaseDate && <div><p className="text-gray-400">วันที่ซื้อ</p><p>{formatDate(a.PurchaseDate)}</p></div>}
                            {a.Price != null && <div><p className="text-gray-400">ราคา</p><p>{a.Price.toLocaleString()} บาท</p></div>}
                            {a.Spec && <div className="col-span-2"><p className="text-gray-400">Spec</p><p>{a.Spec}</p></div>}
                            {a.AppName && <div><p className="text-gray-400">App</p><p>{a.AppName}</p></div>}
                            {a.LicenseType && <div><p className="text-gray-400">License</p><p>{a.LicenseType}</p></div>}
                            {a.AccessMethod && <div><p className="text-gray-400">Access</p><p>{a.AccessMethod}</p></div>}
                            {a.AssignedEmail && <div><p className="text-gray-400">Email ผู้ใช้</p><p className="truncate">{a.AssignedEmail}</p></div>}
                            {a.Note && <div className="col-span-2 md:col-span-4"><p className="text-gray-400">หมายเหตุ</p><p className="whitespace-pre-wrap">{a.Note}</p></div>}
                            {a.Username && canAdmin && <div><p className="text-gray-400">Username</p><p className="font-mono">{a.Username}</p></div>}
                          </div>
                          {canAdmin && (
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); openEdit(a) }}>
                                <Edit2 size={12} /> แก้ไข
                              </Button>
                              <button onClick={e => { e.stopPropagation(); deleteAsset(a.id, a.Title) }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                                <Trash2 size={12} /> ลบ
                              </button>
                            </div>
                          )}
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
          <AssetFormFields f={form} upd={set} isSoftware={SOFTWARE_LIKE.has(form.Category as never)} />
          <div className="col-span-2">
            <Button type="submit" disabled={creating} className="w-full justify-center">{creating ? 'กำลังบันทึก...' : 'บันทึก Asset'}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingAsset} onClose={() => setEditingAsset(null)} title={`แก้ไข: ${editingAsset?.Title ?? ''}`} size="lg">
        <form onSubmit={updateAsset} className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
          <AssetFormFields f={editForm} upd={setEdit} isSoftware={SOFTWARE_LIKE.has(editForm.Category as never)} />
          <div className="col-span-2">
            <Button type="submit" disabled={updating} className="w-full justify-center">{updating ? 'กำลังอัปเดต...' : 'บันทึกการแก้ไข'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
