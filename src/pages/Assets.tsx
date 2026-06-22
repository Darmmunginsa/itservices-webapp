import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Plus, AlertTriangle, Monitor, Edit2, Trash2, ShieldCheck, ShieldAlert, ShieldOff, RefreshCw, Archive, Paperclip } from 'lucide-react'
import { OptionSelect } from '../components/common/OptionSelect'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonRow } from '../components/common/Skeleton'
import { AssetPartsSection } from '../components/common/AssetPartsSection'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { spGet, spCreate, spUpdate, spDelete, spUploadAttachment, spGetFromSite } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Asset } from '../types/asset'
import { getStatusColor } from '../utils/colorUtils'
import { formatDate, isWarrantyExpiringSoon, daysUntil } from '../utils/dateUtils'
import { useT } from '../i18n/useT'

const SSL_WORKER_URL = import.meta.env.VITE_SSL_WORKER_URL ?? ''

// สถานะ monitor จาก Uptime Kuma (bridge ผ่าน SharePoint list HD_MonitorStatus)
interface MonitorStatusRow { id: number; MonitorId: number; Status: string; LastCheck?: string; Uptime24?: number }
// ดึง monitor id จาก MonitorUrl เช่น http://monitor.../dashboard/3 → 3
function monitorIdFromUrl(url?: string): number | null {
  if (!url) return null
  const m = url.match(/\/dashboard\/(\d+)/)
  return m ? Number(m[1]) : null
}

const CATEGORIES = ['Computer', 'Server', 'VM', 'Network', 'Certificate', 'Software', 'Other'] as const
const STATUSES   = ['Active', 'Inactive', 'Maintenance', 'Retired'] as const
const OWNER_TYPES = ['Company', 'Department', 'User']
const SOFTWARE_LIKE = new Set(['Certificate', 'Software'])

// ─── Styles (outside component to keep stable references) ─────────────────────
const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

interface SslResult { daysRemaining: number; validTo: string; valid: boolean }

function sslBadge(days: number | null) {
  if (days === null) return null
  if (days < 0)   return { label: 'หมดอายุ',           icon: ShieldOff,   cls: 'text-red-600 bg-red-50 dark:bg-red-900/20' }
  if (days <= 7)  return { label: `${days}d ด่วน!`,    icon: ShieldAlert, cls: 'text-red-600 bg-red-50 dark:bg-red-900/20' }
  if (days <= 30) return { label: `${days}d เหลือน้อย`, icon: ShieldAlert, cls: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20' }
  return           { label: `${days}d`,                 icon: ShieldCheck, cls: 'text-green-600 bg-green-50 dark:bg-green-900/20' }
}

const EMPTY_FORM = {
  Title: '', AssetCode: '', Category: 'Computer', Status: 'Active',
  OS: '', IPAddress: '', Username: '', Password: '',
  SerialNumber: '', Spec: '', Vendor: '',
  OwnerType: 'Company', AssignedTo: '', AssignedEmail: '',
  PurchaseDate: '', Price: '', WarrantyDate: '',
  AppName: '', AccessMethod: '', ExpiryDate: '', LicenseType: '',
  PortalURL: '', MonitorUrl: '', VendorID: '', PortalID: '',
  AlertEnabled: '', AlertDays: '60', AlertEmail: '',
  Note: '', QuotationRef: '',
}


type AssetForm = typeof EMPTY_FORM

function assetToForm(a: Asset): AssetForm {
  return {
    Title: a.Title || '', AssetCode: a.AssetCode || '',
    Category: a.Category || 'Computer', Status: a.Status || 'Active',
    OS: a.OS || '', IPAddress: a.IPAddress || '',
    Username: a.Username || '', Password: '',
    SerialNumber: a.SerialNumber || '', Spec: a.Spec || '', Vendor: a.Vendor || '',
    OwnerType: a.OwnerType || 'Company', AssignedTo: a.AssignedTo || '', AssignedEmail: a.AssignedEmail || '',
    PurchaseDate: a.PurchaseDate?.slice(0, 10) || '',
    Price: a.Price != null ? String(a.Price) : '',
    WarrantyDate: a.WarrantyDate?.slice(0, 10) || '',
    AppName: a.AppName || '', AccessMethod: a.AccessMethod || '',
    ExpiryDate: a.ExpiryDate?.slice(0, 10) || '',
    LicenseType: a.LicenseType || '', PortalURL: a.PortalURL || '',
    MonitorUrl: a.MonitorUrl || '',
    VendorID: a.VendorID != null ? String(a.VendorID) : '',
    PortalID: a.PortalID != null ? String(a.PortalID) : '',
    AlertEnabled: a.AlertEnabled ? '1' : '',
    AlertDays: a.AlertDays != null ? String(a.AlertDays) : '60',
    AlertEmail: a.AlertEmail || '',
    Note: a.Note || '',
    QuotationRef: a.QuotationRef || '',
  }
}

function formToPayload(form: AssetForm) {
  return {
    Title: form.Title, AssetCode: form.AssetCode || undefined,
    Category: form.Category, Status: form.Status,
    OS: form.OS || undefined, IPAddress: form.IPAddress || undefined,
    Username: form.Username || undefined, Password: form.Password || undefined,
    SerialNumber: form.SerialNumber || undefined, Spec: form.Spec || undefined, Vendor: form.Vendor || undefined,
    OwnerType: form.OwnerType || undefined, AssignedTo: form.AssignedTo || undefined, AssignedEmail: form.AssignedEmail || undefined,
    PurchaseDate: form.PurchaseDate || undefined,
    Price: form.Price ? Number(form.Price) : undefined,
    WarrantyDate: form.WarrantyDate || undefined,
    AppName: form.AppName || undefined, AccessMethod: form.AccessMethod || undefined,
    ExpiryDate: form.ExpiryDate || undefined, LicenseType: form.LicenseType || undefined,
    PortalURL: form.PortalURL || undefined,
    MonitorUrl: form.MonitorUrl || undefined,
    VendorID: form.VendorID ? Number(form.VendorID) : undefined,
    PortalID: form.PortalID ? Number(form.PortalID) : undefined,
    // ส่ง alert fields เฉพาะตอนเปิดใช้ — ถ้ายังไม่ได้สร้าง column ใน SharePoint asset อื่นยัง save ได้
    ...(form.AlertEnabled === '1' ? {
      AlertEnabled: true,
      AlertDays: form.AlertDays ? Number(form.AlertDays) : undefined,
      AlertEmail: form.AlertEmail || undefined,
    } : {}),
    Note: form.Note || undefined,
    QuotationRef: form.QuotationRef || undefined,
  }
}

// ─── AssetFormFields — OUTSIDE Assets component to prevent focus-loss bug ─────
function AssetFormFields({ f, upd, isSoftware, onCheckSSL, sslChecking, vendors, portals }: {
  f: AssetForm
  upd: (k: keyof AssetForm, v: string) => void
  isSoftware: boolean
  onCheckSSL?: (url: string) => void
  sslChecking: number | 'new' | null
  vendors: { id: number; Title: string }[]
  portals: { id: number; Title: string }[]
}) {
  const tr = useT()
  const isCert = f.Category === 'Certificate'
  return (
    <>
      <div className="col-span-2"><label className={labelClass}>{tr('assets.name')} *</label>
        <input required value={f.Title} onChange={e => upd('Title', e.target.value)} className={inputClass} placeholder={tr('assets.namePlaceholder')} /></div>
      <div><label className={labelClass}>{tr('assets.assetCode')} <span className="text-gray-400 font-normal">(Auto)</span></label>
        <input value={f.AssetCode} onChange={e => upd('AssetCode', e.target.value)} className={`${inputClass} font-mono`} placeholder="IT-2026-001" /></div>
      <div><label className={labelClass}>{tr('common.category')}</label>
        <OptionSelect category="AssetCategory" defaults={[...CATEGORIES]} value={f.Category} onChange={v => upd('Category', v)} className={inputClass} /></div>
      <div><label className={labelClass}>{tr('assets.statusLabel')}</label>
        <OptionSelect category="AssetStatus" defaults={[...STATUSES]} value={f.Status} onChange={v => upd('Status', v)} className={inputClass} /></div>
      <div><label className={labelClass}>{tr('assets.ownerType')}</label>
        <OptionSelect category="AssetOwnerType" defaults={[...OWNER_TYPES]} value={f.OwnerType} onChange={v => upd('OwnerType', v)} className={inputClass} /></div>
      <div className="col-span-2"><label className={labelClass}>{tr('assets.vendorContract')}</label>
        <select value={f.VendorID} onChange={e => upd('VendorID', e.target.value)} className={inputClass}>
          <option value="">{tr('assets.noVendor')}</option>
          {vendors.map(v => <option key={v.id} value={v.id}>{v.Title}</option>)}
        </select></div>
      <div className="col-span-2"><label className={labelClass}>{tr('portals.linkLabel')}</label>
        <select value={f.PortalID} onChange={e => upd('PortalID', e.target.value)} className={inputClass}>
          <option value="">{tr('portals.none')}</option>
          {portals.map(p => <option key={p.id} value={p.id}>{p.Title}</option>)}
        </select></div>

      {!isSoftware && (<>
        <div><label className={labelClass}>IP Address</label>
          <textarea value={f.IPAddress} onChange={e => upd('IPAddress', e.target.value)} onKeyDown={e => e.key === 'Enter' && e.stopPropagation()} rows={2} className={`${inputClass} resize-none`} placeholder={"IP Private: 192.168.x.x\nIP Public: 203.x.x.x"} /></div>
        <div><label className={labelClass}>📊 Monitor URL <span className="text-gray-400 font-normal">(Uptime Kuma)</span></label>
          <input value={f.MonitorUrl} onChange={e => upd('MonitorUrl', e.target.value)} className={inputClass} placeholder="http://monitor.itservices.co.th/dashboard/3" /></div>
        <div><label className={labelClass}>OS</label>
          <OptionSelect category="AssetOS" defaults={['Windows 11', 'Windows 10', 'Windows Server 2022', 'Windows Server 2019', 'Ubuntu', 'macOS', 'อื่นๆ']} value={f.OS} onChange={v => upd('OS', v)} className={inputClass} /></div>
        <div><label className={labelClass}>Serial Number</label>
          <input value={f.SerialNumber} onChange={e => upd('SerialNumber', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>{tr('assets.vendorBrand')}</label>
          <OptionSelect category="AssetVendor" defaults={['Dell', 'HP', 'HPE', 'Lenovo', 'Cisco', 'Microsoft', 'อื่นๆ']} value={f.Vendor} onChange={v => upd('Vendor', v)} className={inputClass} /></div>
        <div className="col-span-2"><label className={labelClass}>Spec</label>
          <input value={f.Spec} onChange={e => upd('Spec', e.target.value)} className={inputClass} placeholder="i7 16GB RAM 512GB SSD..." /></div>
        <div><label className={labelClass}>Username</label>
          <input value={f.Username} onChange={e => upd('Username', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Password</label>
          <input type="password" value={f.Password} onChange={e => upd('Password', e.target.value)} className={inputClass} /></div>
      </>)}

      {isSoftware && (<>
        <div><label className={labelClass}>{tr('assets.appName')}</label>
          <input value={f.AppName} onChange={e => upd('AppName', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>License Type</label>
          <input value={f.LicenseType} onChange={e => upd('LicenseType', e.target.value)} className={inputClass} placeholder="Annual, Perpetual..." /></div>

        <div className={isCert ? 'col-span-2' : ''}>
          <label className={labelClass}>{isCert ? '🌐 URL / Domain' : tr('assets.accessMethod')}</label>
          <div className="flex gap-2">
            <input value={f.AccessMethod} onChange={e => upd('AccessMethod', e.target.value)}
              className={inputClass} placeholder={isCert ? 'https://itservices.co.th' : 'URL, VPN, Key...'} />
            {isCert && onCheckSSL && (
              <button type="button" onClick={() => onCheckSSL(f.AccessMethod)}
                disabled={sslChecking === 'new'}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors whitespace-nowrap">
                <RefreshCw size={12} className={sslChecking === 'new' ? 'animate-spin' : ''} />
                {tr('assets.checkSsl')}
              </button>
            )}
          </div>
        </div>

        <div><label className={labelClass}>{tr('assets.expiryDate')} {isCert && <span className="text-gray-400">{tr('assets.sslAutofill')}</span>}</label>
          <input type="date" value={f.ExpiryDate} onChange={e => upd('ExpiryDate', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Vendor</label>
          <OptionSelect category="AssetVendor" defaults={['Dell', 'HP', 'HPE', 'Lenovo', 'Cisco', 'Microsoft', 'อื่นๆ']} value={f.Vendor} onChange={v => upd('Vendor', v)} className={inputClass} /></div>
      </>)}

      <div><label className={labelClass}>{tr('assets.user')}</label>
        <OptionSelect category="AssetAssignedTo" defaults={['Company', 'IT Department']} value={f.AssignedTo} onChange={v => upd('AssignedTo', v)} className={inputClass} /></div>
      <div><label className={labelClass}>{tr('assets.userEmail')}</label>
        <input type="email" value={f.AssignedEmail} onChange={e => upd('AssignedEmail', e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>{tr('assets.purchaseDate')}</label>
        <input type="date" value={f.PurchaseDate} onChange={e => upd('PurchaseDate', e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>{tr('assets.price')}</label>
        <input type="number" min="0" value={f.Price} onChange={e => upd('Price', e.target.value)} className={inputClass} /></div>
      {!isSoftware && (
        <div><label className={labelClass}>{tr('assets.warrantyDate')}</label>
          <input type="date" value={f.WarrantyDate} onChange={e => upd('WarrantyDate', e.target.value)} className={inputClass} /></div>
      )}
      <div className="col-span-2 border-t border-gray-100 dark:border-gray-800 pt-3 mt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
          <input type="checkbox" checked={f.AlertEnabled === '1'} onChange={e => upd('AlertEnabled', e.target.checked ? '1' : '')} className="rounded accent-primary-600" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">🔔 {tr('assets.alertEnable')}</span>
        </label>
        {f.AlertEnabled === '1' && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div><label className={labelClass}>{tr('assets.alertDays')}</label>
              <input type="number" min="1" value={f.AlertDays} onChange={e => upd('AlertDays', e.target.value)} className={inputClass} placeholder="60" /></div>
            <div><label className={labelClass}>{tr('assets.alertEmail')}</label>
              <input value={f.AlertEmail} onChange={e => upd('AlertEmail', e.target.value)} className={inputClass} placeholder="a@x.com, b@x.com" /></div>
          </div>
        )}
      </div>
      <div className="col-span-2"><label className={labelClass}>อ้างอิงใบเสนอราคา (SalePro) <span className="text-gray-400 font-normal">เลขที่ QT</span></label>
        <input value={f.QuotationRef} onChange={e => upd('QuotationRef', e.target.value)} className={`${inputClass} font-mono`} placeholder="QT-2026-06-001" list="quote-ref-list" /></div>
      <div className="col-span-2"><label className={labelClass}>{tr('common.note')}</label>
        <textarea value={f.Note} onChange={e => upd('Note', e.target.value)} rows={2} className={inputClass} /></div>
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Assets() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<AssetForm>({ ...EMPTY_FORM })
  const [creating, setCreating] = useState(false)
  const [createFiles, setCreateFiles] = useState<File[]>([])
  const [viewAsset, setViewAsset] = useState<Asset | null>(null)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [editForm, setEditForm] = useState<AssetForm>({ ...EMPTY_FORM })
  const [updating, setUpdating] = useState(false)
  const [sslChecking, setSslChecking] = useState<number | 'new' | null>(null)
  const [sslResults, setSslResults] = useState<Record<number, SslResult>>({})
  const [showRetired, setShowRetired] = useState(false)
  const [writingOff, setWritingOff] = useState<number | null>(null)
  const [assetProjects, setAssetProjects] = useState<Record<number, { id: number; title: string }[]>>({})
  const [monitorStatus, setMonitorStatus] = useState<Record<number, MonitorStatusRow>>({})
  const [vendors, setVendors] = useState<{ id: number; Title: string; Phone?: string; Email?: string; PortalURL?: string; ContactName?: string }[]>([])
  const [portals, setPortals] = useState<{ id: number; Title: string; URL?: string; Category?: string; Username?: string }[]>([])
  const [quoteList, setQuoteList] = useState<{ Title: string; ClientName?: string }[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<{ key: string; name: string; cost: number; vendor: string; category: string; quote: string; purchaseDate: string; sel: boolean }[]>([])
  const [importing, setImporting] = useState(false)
  const SALEPRO_SITE = '/sites/SalesQuotation'

  // โหลดรายการใบเสนอราคา (ข้ามไซต์) ไว้ช่วยกรอกอ้างอิง
  useEffect(() => {
    spGetFromSite<{ Title: string; ClientName?: string }>(SALEPRO_SITE, 'Quotations', 'Title,ClientName')
      .then(rows => setQuoteList(rows.filter(r => r.Title))).catch(() => {})
  }, [])

  // ข้อ 3: ดึงงานจัดซื้อที่เป็น "ทรัพย์สินบริษัท" จาก SalePro (Settings list) มาเตรียมสร้าง Asset
  async function openImportFromPurchase() {
    setShowImport(true); setImportRows([]); setImporting(true)
    try {
      const rows = await spGetFromSite<{ Title: string; Value: string }>(SALEPRO_SITE, 'Settings', 'Title,Value')
      const get = (t: string) => rows.find(r => r.Title === t)?.Value
      let procs: Array<{ id: number | string; quoteTitle?: string; client?: string; vendorName?: string; items?: Array<{ name: string; cost?: number }> }> = []
      try { procs = JSON.parse(get('Procurements') || '[]') || [] } catch { procs = [] }
      const out: typeof importRows = []
      for (const p of procs) {
        let ext: { assetType?: string; assetCategory?: string; closed?: boolean } = {}
        try { ext = JSON.parse(get('Purchase_' + p.id) || '{}') || {} } catch { /* ignore */ }
        if (ext.assetType !== 'asset') continue   // เฉพาะที่ระบุเป็นทรัพย์สินบริษัท
        ;(p.items || []).forEach((it, i) => {
          out.push({ key: p.id + '_' + i, name: it.name || '', cost: +(it.cost || 0), vendor: p.vendorName || '', category: ext.assetCategory || 'Other', quote: p.quoteTitle || '', purchaseDate: '', sel: true })
        })
      }
      setImportRows(out)
    } catch (e) { addToast('error', 'ดึงงานจัดซื้อไม่สำเร็จ: ' + (e as Error).message) }
    finally { setImporting(false) }
  }
  async function doImportAssets() {
    const picks = importRows.filter(r => r.sel && r.name)
    if (!picks.length) { addToast('error', 'ยังไม่ได้เลือกรายการ'); return }
    setImporting(true)
    try {
      for (const r of picks) {
        await spCreate('IT_Assets', { Title: r.name, Category: r.category || 'Other', Status: 'Active', Vendor: r.vendor || undefined, Price: r.cost || undefined, OwnerType: 'Company', QuotationRef: r.quote || undefined, PurchaseDate: r.purchaseDate || undefined })
      }
      addToast('success', 'นำเข้า ' + picks.length + ' รายการเป็น Asset แล้ว')
      setShowImport(false); load()
    } catch (e) { addToast('error', 'นำเข้าไม่สำเร็จ: ' + (e as Error).message) }
    finally { setImporting(false) }
  }

  async function checkSSL(url: string, assetId: number | 'new', onDone?: (iso: string) => void, onNote?: (note: string) => void) {
    if (!SSL_WORKER_URL) { addToast('error', 'ยังไม่ได้ตั้งค่า VITE_SSL_WORKER_URL'); return }
    if (!url) { addToast('error', 'กรุณาใส่ URL ก่อน'); return }
    setSslChecking(assetId)
    try {
      const res = await fetch(`${SSL_WORKER_URL}?domain=${encodeURIComponent(url)}`)
      const data = await res.json() as SslResult & { error?: string; host?: string; issuer?: string }
      if (data.error) throw new Error(data.error)
      if (assetId !== 'new') setSslResults(prev => ({ ...prev, [assetId]: data }))
      if (data.validTo) {
        const isoDate = data.validTo.slice(0, 10)
        onDone?.(isoDate)
        onNote?.([
          `🔒 SSL Certificate`,
          `Domain: ${data.host ?? url}`,
          `Issuer: ${data.issuer ?? '-'}`,
          `หมดอายุ: ${isoDate}`,
          `สถานะ: ${data.valid ? '✅ Valid' : '❌ Expired'}`,
        ].join('\n'))
        addToast('success', `SSL หมดอายุ: ${isoDate} (เหลือ ${data.daysRemaining} วัน)`)
      }
    } catch (e) {
      addToast('error', `ตรวจสอบ SSL ไม่ได้: ${e instanceof Error ? e.message : String(e)}`)
    } finally { setSslChecking(null) }
  }

  function load() {
    setLoading(true)
    // Default: ดึงเฉพาะที่ยังไม่ปลดระวาง (index Status ช่วยไม่ให้ชน 5000)
    const filter = showRetired ? undefined : "Status ne 'Retired'"
    spGet<Asset>('IT_Assets', filter, undefined, 'Title asc')
      .then(setAssets).catch(() => {}).finally(() => setLoading(false))
  }

  // Build map: AssetID → [project names] (for "ใช้ในโครงการ")
  useEffect(() => {
    Promise.all([
      spGet<{ id: number; ProjectID: number; AssetID: number }>('PM_ProjectAssets').catch(() => []),
      spGet<{ id: number; Title: string }>('PM_Projects', undefined, 'Id,Title').catch(() => []),
    ]).then(([links, projs]) => {
      const projMap = new Map(projs.map(p => [p.id, p.Title]))
      const m: Record<number, { id: number; title: string }[]> = {}
      for (const l of links) {
        if (!m[l.AssetID]) m[l.AssetID] = []
        m[l.AssetID].push({ id: l.ProjectID, title: projMap.get(l.ProjectID) || `Project #${l.ProjectID}` })
      }
      setAssetProjects(m)
    }).catch(() => {})
  }, [])

  useEffect(() => { load() }, [showRetired])

  // เปิด/ขยาย asset อัตโนมัติเมื่อมาจาก Global Search (/assets?id=<id>)
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const idParam = searchParams.get('id')
    if (!idParam || assets.length === 0) return
    const target = Number(idParam)
    const found = assets.find(a => a.id === target)
    if (found) setViewAsset(found)
  }, [assets, searchParams])

  // โหลดสถานะ monitor (HD_MonitorStatus) — อัปเดตจาก poller ฝั่งเครื่อง monitor
  useEffect(() => {
    spGet<MonitorStatusRow>('HD_MonitorStatus', undefined, 'Id,MonitorId,Status,LastCheck,Uptime24', undefined, 500)
      .then(rows => {
        const m: Record<number, MonitorStatusRow> = {}
        for (const r of rows) if (r.MonitorId != null) m[r.MonitorId] = r
        setMonitorStatus(m)
      }).catch(() => {})
    spGet<{ id: number; Title: string; Phone?: string; Email?: string; PortalURL?: string; ContactName?: string }>(
      'IT_Vendors', undefined, 'Id,Title,Phone,Email,PortalURL,ContactName', 'Title asc', 500)
      .then(setVendors).catch(() => {})
    spGet<{ id: number; Title: string; URL?: string; Category?: string; Username?: string }>(
      'IT_Portals', undefined, 'Id,Title,URL,Category,Username', 'Title asc', 500)
      .then(setPortals).catch(() => {})
  }, [])

  const set = (key: keyof AssetForm, val: string) => setForm(f => ({ ...f, [key]: val }))
  const setEdit = (key: keyof AssetForm, val: string) => setEditForm(f => ({ ...f, [key]: val }))

  function generateAssetCode(): string {
    const year = new Date().getFullYear()
    const prefix = `IT-${year}-`
    let maxNum = 0
    for (const a of assets) {
      if (a.AssetCode?.startsWith(prefix)) {
        const n = parseInt(a.AssetCode.slice(prefix.length), 10)
        if (!isNaN(n) && n > maxNum) maxNum = n
      }
    }
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`
  }

  async function createAsset(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const created = await spCreate('IT_Assets', formToPayload(form))
      // อัปโหลดไฟล์แนบที่เลือกไว้ตอนสร้าง (หลังได้ item id)
      if (createFiles.length && created?.id) {
        for (const f of createFiles) {
          try { await spUploadAttachment('IT_Assets', created.id, f) } catch { /* ignore */ }
        }
      }
      addToast('success', 'เพิ่ม Asset เรียบร้อย')
      setShowCreate(false); setForm({ ...EMPTY_FORM }); setCreateFiles([]); load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setCreating(false) }
  }

  function openEdit(asset: Asset) { setEditForm(assetToForm(asset)); setEditingAsset(asset) }

  async function updateAsset(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAsset) return
    setUpdating(true)
    try {
      await spUpdate('IT_Assets', editingAsset.id, formToPayload(editForm))
      addToast('success', 'อัปเดต Asset เรียบร้อย'); setEditingAsset(null); load()
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

  async function writeOffAsset(id: number, title: string) {
    if (!window.confirm(`ปลดระวาง (Write Off) Asset "${title}"?\nจะเปลี่ยนสถานะเป็น Retired และซ่อนจากรายการหลัก`)) return
    setWritingOff(id)
    try {
      await spUpdate('IT_Assets', id, { Status: 'Retired' })
      if (!showRetired) setAssets(prev => prev.filter(a => a.id !== id))
      else setAssets(prev => prev.map(a => a.id === id ? { ...a, Status: 'Retired' } : a))
      addToast('success', 'ปลดระวาง Asset แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setWritingOff(null) }
  }

  const filtered = assets.filter(a =>
    (!search ||
      a.Title.toLowerCase().includes(search.toLowerCase()) ||
      a.AssetCode?.toLowerCase().includes(search.toLowerCase()) ||
      a.IPAddress?.includes(search) ||
      a.SerialNumber?.toLowerCase().includes(search.toLowerCase()) ||
      a.AssignedTo?.toLowerCase().includes(search.toLowerCase())) &&
    (!categoryFilter || a.Category === categoryFilter) &&
    (!statusFilter || a.Status === statusFilter)
  )

  const canAdmin = ['Admin', 'Boss'].includes(user?.role ?? '')

  // จัดกลุ่มเป็นคอลัมน์ Kanban ตาม Category (เรียงตาม CATEGORIES ก่อน แล้วต่อด้วยหมวดอื่นที่พบ)
  const assetColumns = (() => {
    const map = new Map<string, Asset[]>()
    for (const a of filtered) {
      const c = a.Category || 'Other'
      if (!map.has(c)) map.set(c, [])
      map.get(c)!.push(a)
    }
    const ordered = [...CATEGORIES.filter(c => map.has(c)), ...[...map.keys()].filter(c => !CATEGORIES.includes(c as never))]
    return ordered.map(category => ({ category, items: map.get(category) ?? [] }))
  })()

  return (
    <div>
      <Header title="IT Assets" />
      <div className="p-4 md:p-6 space-y-4">

        {assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate || a.ExpiryDate)).length > 0 && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 text-sm text-orange-700 dark:text-orange-400 flex items-center gap-2">
            <AlertTriangle size={15} />
            <span>{assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate || a.ExpiryDate)).length} {tr('assets.warrantyAlert')}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder={tr('assets.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">{tr('assets.allCategories')}</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">{tr('common.allStatus')}</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {canAdmin && <Button size="sm" onClick={() => { setForm({ ...EMPTY_FORM, AssetCode: generateAssetCode() }); setShowCreate(true) }}><Plus size={14} /> {tr('assets.addAsset')}</Button>}
          {canAdmin && <Button size="sm" variant="secondary" onClick={openImportFromPurchase}>📥 นำเข้าจากงานจัดซื้อ</Button>}
          <datalist id="quote-ref-list">{quoteList.map(q => <option key={q.Title} value={q.Title}>{q.ClientName || ''}</option>)}</datalist>
          <button onClick={() => setShowRetired(s => !s)}
            className={`text-xs underline ml-1 ${showRetired ? 'text-primary-600' : 'text-gray-400'}`}>
            {showRetired ? tr('assets.hideRetired') : tr('assets.showRetired')}
          </button>
        </div>

        {loading ? (
          <div className="flex gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="w-72 flex-shrink-0 space-y-3"><SkeletonRow /><SkeletonRow /></div>)}</div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">{tr('assets.noAsset')}</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
            {assetColumns.map(col => (
              <div key={col.category} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Monitor size={14} className="text-primary-600 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{col.category}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{col.items.length}</span>
                </div>
                <div className="space-y-3 min-h-[100px]">
                  {col.items.length === 0
                    ? <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center text-xs text-gray-400">{tr('assets.noDevice')}</div>
                    : col.items.map(a => {
                        const warrantyDate = a.WarrantyDate || a.ExpiryDate
                        const expiring = isWarrantyExpiringSoon(warrantyDate)
                        const days = warrantyDate ? daysUntil(warrantyDate) : null
                        const mid = monitorIdFromUrl(a.MonitorUrl)
                        const st = mid != null ? monitorStatus[mid] : undefined
                        const up = st?.Status === 'up' || st?.Status === '1'
                        return (
                          <button key={a.id} onClick={() => setViewAsset(a)}
                            className={`w-full text-left block bg-white dark:bg-gray-900 border rounded-xl p-3.5 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-md group ${expiring ? 'border-orange-300 dark:border-orange-800' : 'border-gray-200 dark:border-gray-800'}`}>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 flex-1 group-hover:text-primary-600 transition-colors">{a.Title}</h3>
                              {st && <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${up ? 'bg-green-500' : st.Status === 'pending' ? 'bg-amber-400' : 'bg-red-500'}`} title={up ? tr('assets.up') : st.Status === 'pending' ? tr('assets.waitingData') : tr('assets.down')} />}
                            </div>
                            {a.AssetCode && <p className="text-xs text-gray-400 font-mono mb-2">{a.AssetCode}</p>}
                            <div className="flex items-center justify-between gap-2">
                              <Badge className={getStatusColor(a.Status)}>{a.Status}</Badge>
                              {a.AssignedTo && <span className="text-xs text-gray-400 truncate">{a.AssignedTo}</span>}
                            </div>
                            {warrantyDate && (
                              <div className={`flex items-center gap-1 text-xs mt-2 ${expiring ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                                {expiring && <AlertTriangle size={11} className="flex-shrink-0" />}
                                <span>{tr('assets.warranty')} {formatDate(warrantyDate)}</span>
                                {days !== null && days < 0 && <span className="text-red-600">{tr('assets.expired')}</span>}
                              </div>
                            )}
                          </button>
                        )
                      })
                  }
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">{filtered.length} {tr('assets.items')}</p>
      </div>

      {/* Asset Detail Modal */}
      <Modal open={!!viewAsset} onClose={() => setViewAsset(null)} title={viewAsset?.Title ?? ''} size="lg">
        {viewAsset && (() => {
          const a = viewAsset
          return (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{a.Category}</Badge>
                <Badge className={getStatusColor(a.Status)}>{a.Status}</Badge>
                {a.AssetCode && <span className="text-xs text-gray-400 font-mono">{a.AssetCode}</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-4">
                {a.IPAddress && <div><p className="text-gray-400">IP Address</p><p className="font-mono whitespace-pre-line">{a.IPAddress}</p></div>}
                {a.SerialNumber && <div><p className="text-gray-400">Serial No.</p><p>{a.SerialNumber}</p></div>}
                {a.OS && <div><p className="text-gray-400">OS</p><p>{a.OS}</p></div>}
                {a.Vendor && <div><p className="text-gray-400">{tr('assets.vendorBrandCol')}</p><p>{a.Vendor}</p></div>}
                {a.AssignedTo && <div><p className="text-gray-400">{tr('assets.user')}</p><p>{a.AssignedTo}</p></div>}
                {a.AssignedEmail && <div><p className="text-gray-400">{tr('assets.userEmailShort')}</p><p className="truncate">{a.AssignedEmail}</p></div>}
                {a.PurchaseDate && <div><p className="text-gray-400">{tr('assets.purchaseDate')}</p><p>{formatDate(a.PurchaseDate)}</p></div>}
                {a.Price != null && <div><p className="text-gray-400">{tr('assets.priceShort')}</p><p>{a.Price.toLocaleString()}</p></div>}
                {(a.WarrantyDate || a.ExpiryDate) && (() => {
                  const wd = a.WarrantyDate || a.ExpiryDate!
                  const d = daysUntil(wd)
                  const exp = isWarrantyExpiringSoon(wd)
                  return <div><p className="text-gray-400">{a.Category === 'Certificate' ? tr('assets.sslExpiry') : tr('assets.warrantyDate')}</p>
                    <p className={exp ? 'text-orange-600 font-medium' : ''}>{formatDate(wd)}{d !== null && (d < 0 ? ` ${tr('assets.expired')}` : ` (${d})`)}</p></div>
                })()}
                {a.AppName && <div><p className="text-gray-400">App</p><p>{a.AppName}</p></div>}
                {a.LicenseType && <div><p className="text-gray-400">License</p><p>{a.LicenseType}</p></div>}
                {a.Username && canAdmin && <div><p className="text-gray-400">Username</p><p className="font-mono">{a.Username}</p></div>}
                {a.Spec && <div className="col-span-2 md:col-span-3"><p className="text-gray-400">Spec</p><p>{a.Spec}</p></div>}
                {a.PortalID != null && (() => {
                  const por = portals.find(p => p.id === a.PortalID)
                  if (!por) return null
                  return <div><p className="text-gray-400">🌐 Portal</p>
                    {por.URL
                      ? <a href={por.URL} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">{por.Title}</a>
                      : <p className="truncate">{por.Title}</p>}
                    {por.Username && <p className="text-gray-400 text-[11px] truncate">{por.Username}</p>}
                  </div>
                })()}
                {a.PortalURL && <div><p className="text-gray-400">🌐 Portal URL</p><a href={a.PortalURL} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">{a.PortalURL}</a></div>}
                {a.MonitorUrl && <div><p className="text-gray-400">📊 Monitor</p><a href={a.MonitorUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline truncate block">{tr('assets.viewStatus')}</a></div>}
                {a.AccessMethod && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-gray-400">{a.Category === 'Certificate' ? 'URL' : 'Access'}</p>
                    <p className="break-all">{a.AccessMethod}</p>
                    {a.Category === 'Certificate' && (() => {
                      const ssl = sslResults[a.id]
                      const badge = sslBadge(ssl?.daysRemaining ?? null)
                      return ssl ? (badge && (
                        <span className={`inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                          <badge.icon size={11} /> {badge.label}
                        </span>
                      )) : (
                        <button type="button" onClick={() => checkSSL(a.AccessMethod!, a.id)} disabled={sslChecking === a.id}
                          className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <RefreshCw size={10} className={sslChecking === a.id ? 'animate-spin' : ''} />
                          {sslChecking === a.id ? tr('assets.checkingSsl') : tr('assets.checkSslLink')}
                        </button>
                      )
                    })()}
                  </div>
                )}
              </div>

              {a.VendorID != null && (() => {
                const ven = vendors.find(v => v.id === a.VendorID)
                if (!ven) return null
                return (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4 text-xs">
                    <p className="text-gray-400 mb-1">{tr('assets.vendorMgr')}</p>
                    <p className="font-medium text-gray-700 dark:text-gray-200">{ven.Title}{ven.ContactName ? ` · ${ven.ContactName}` : ''}</p>
                    <p className="flex flex-wrap gap-x-3 mt-1">
                      {ven.Phone && <a href={`tel:${ven.Phone}`} className="text-primary-600 hover:underline">📞 {ven.Phone}</a>}
                      {ven.Email && <a href={`mailto:${ven.Email}`} className="text-primary-600 hover:underline truncate">✉️ {ven.Email}</a>}
                      {ven.PortalURL && <a href={ven.PortalURL} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">🌐 Portal</a>}
                      <Link to="/vendors" className="text-gray-400 hover:underline">{tr('assets.viewContract')}</Link>
                    </p>
                  </div>
                )
              })()}

              {a.Note && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-1">{tr('common.note')}</p>
                  <p className="text-xs whitespace-pre-wrap">{a.Note}</p>
                </div>
              )}

              {assetProjects[a.id]?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1">{tr('assets.usedInProjects')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {assetProjects[a.id].map(p => (
                      <Link key={p.id} to={`/projects/${p.id}`} onClick={() => setViewAsset(null)}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 hover:underline">
                        {p.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mb-4">
                <AssetPartsSection assetId={a.id} canEdit={canAdmin} />
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mb-4">
                <AttachmentSection listName="IT_Assets" itemId={a.id} readOnly={!canAdmin} />
              </div>

              {canAdmin && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { openEdit(a); setViewAsset(null) }}><Edit2 size={12} /> {tr('common.edit')}</Button>
                  {a.Status !== 'Retired' && (
                    <button onClick={() => { writeOffAsset(a.id, a.Title); setViewAsset(null) }} disabled={writingOff === a.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/10 disabled:opacity-50 transition-colors">
                      <Archive size={12} /> Write Off
                    </button>
                  )}
                  <button onClick={() => { deleteAsset(a.id, a.Title); setViewAsset(null) }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                    <Trash2 size={12} /> {tr('assets.delete')}
                  </button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* Create Modal */}
      {/* ข้อ 3: นำเข้า Asset จากงานจัดซื้อ (PurchasePro) */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="นำเข้า Asset จากงานจัดซื้อ" size="lg">
        {importing && !importRows.length ? <div className="py-8 text-center text-sm text-gray-400">กำลังดึงข้อมูล...</div> : (
          importRows.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">ไม่พบงานจัดซื้อที่ระบุเป็น "ทรัพย์สินบริษัท"<br/><span className="text-xs">(ตั้งประเภทการซื้อใน PurchasePro ขั้นที่ 1)</span></div> : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="p-2"><input type="checkbox" checked={importRows.every(r => r.sel)} onChange={e => setImportRows(rs => rs.map(r => ({ ...r, sel: e.target.checked })))} /></th>
                <th className="p-2 text-left">รายการ</th><th className="p-2 text-left">หมวด</th><th className="p-2 text-right">ราคาทุน</th><th className="p-2 text-left">Vendor</th><th className="p-2 text-left">ใบเสนอราคา</th></tr></thead>
              <tbody>{importRows.map((r, i) => (
                <tr key={r.key} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="p-2 text-center"><input type="checkbox" checked={r.sel} onChange={e => setImportRows(rs => rs.map((x, j) => j === i ? { ...x, sel: e.target.checked } : x))} /></td>
                  <td className="p-2"><input value={r.name} onChange={e => setImportRows(rs => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={inputClass} /></td>
                  <td className="p-2"><select value={r.category} onChange={e => setImportRows(rs => rs.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} className={inputClass}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></td>
                  <td className="p-2 text-right font-mono">{r.cost.toLocaleString()}</td>
                  <td className="p-2">{r.vendor}</td><td className="p-2 font-mono text-xs">{r.quote}</td>
                </tr>))}</tbody>
            </table>
          </div>)
        )}
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(false)}>ยกเลิก</Button>
          <Button size="sm" disabled={importing || !importRows.some(r => r.sel)} onClick={doImportAssets}>สร้าง Asset ที่เลือก</Button>
        </div>
      </Modal>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateFiles([]) }} title={tr('assets.addItAsset')} size="lg">
        <form onSubmit={createAsset} className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
          <AssetFormFields f={form} upd={set} isSoftware={SOFTWARE_LIKE.has(form.Category as never)}
            sslChecking={sslChecking} vendors={vendors} portals={portals}
            onCheckSSL={url => checkSSL(url, 'new', iso => set('ExpiryDate', iso), note => set('Note', note))} />
          <div className="col-span-2 border-t border-gray-100 dark:border-gray-800 pt-3">
            <label className={labelClass}>{tr('ticket.attachments')}</label>
            <label className="flex items-center gap-1.5 text-xs text-primary-600 hover:underline cursor-pointer w-fit">
              <Paperclip size={13} /> {tr('attach.upload')}
              <input type="file" multiple className="hidden"
                onChange={e => { if (e.target.files) setCreateFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = '' }} />
            </label>
            {createFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {createFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                    <span className="flex-1 truncate">{f.name}</span>
                    <button type="button" onClick={() => setCreateFiles(prev => prev.filter((_, x) => x !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-2">
            <Button type="submit" disabled={creating} className="w-full justify-center">{creating ? tr('common.saving') : tr('assets.saveAsset')}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editingAsset} onClose={() => setEditingAsset(null)} title={`${tr('common.edit')}: ${editingAsset?.Title ?? ''}`} size="lg">
        <form onSubmit={updateAsset} className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
          <AssetFormFields f={editForm} upd={setEdit} isSoftware={SOFTWARE_LIKE.has(editForm.Category as never)}
            sslChecking={sslChecking} vendors={vendors} portals={portals}
            onCheckSSL={url => checkSSL(url, editingAsset?.id ?? 'new', iso => setEdit('ExpiryDate', iso), note => setEdit('Note', note))} />
          {editingAsset && (
            <div className="col-span-2 border-t border-gray-100 dark:border-gray-800 pt-3">
              <AttachmentSection listName="IT_Assets" itemId={editingAsset.id} />
            </div>
          )}
          <div className="col-span-2">
            <Button type="submit" disabled={updating} className="w-full justify-center">{updating ? tr('assets.updating') : tr('common.saveEdit')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
