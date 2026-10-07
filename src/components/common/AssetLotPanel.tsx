import { useMemo, useState } from 'react'
import { Edit2, Trash2, Plus, X, ShoppingBasket, AlertTriangle, Layers } from 'lucide-react'
import { Button } from './Button'
import { Badge } from './Badge'
import { AttachmentSection } from './AttachmentSection'
import { spCreate, spUpdate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { formatDate } from '../../utils/dateUtils'
import { getStatusColor } from '../../utils/colorUtils'
import { assetsInLot, unlottedAssets, lotSummary, lotCostGap, bulkNames, lotToForm, lotPayload, LOT_LIST, type AssetLot, type LotForm } from '../../utils/assetLots'
import type { Asset } from '../../types/asset'

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

// ── ตะกร้า (Lot) ของ Asset — หน้าต่างรายละเอียดตะกร้าหนึ่งใบ ──
//
// ของในตะกร้า · ย้ายของเข้า/ออก · สร้างหลายชิ้นทีเดียว · ไฟล์แนบ (ใบรับสินค้า / ใบกำกับภาษี / PO)
// เอกสารแนบที่ตะกร้าแถวเดียว ไม่ต้องแนบซ้ำทุกเครื่อง

/** ช่องกรอกของตะกร้า — ใช้ทั้งตอนสร้างและแก้ (อยู่นอก component หลัก กันโฟกัสหลุด) */
export function AssetLotFields({ f, upd, vendors }: {
  f: LotForm
  upd: (k: keyof LotForm, v: string) => void
  vendors: { id: number; Title: string }[]
}) {
  return (
    <>
      <div className="col-span-2"><label className={labelClass}>ชื่อตะกร้า *</label>
        <input required value={f.Title} onChange={e => upd('Title', e.target.value)} className={inputClass} placeholder="เช่น โน้ตบุ๊กทีมขาย ก.ย. 69" /></div>
      <div><label className={labelClass}>เลขตะกร้า <span className="text-gray-400 font-normal">(Auto)</span></label>
        <input value={f.LotNo} onChange={e => upd('LotNo', e.target.value)} className={`${inputClass} font-mono`} placeholder="LOT-2026-001" /></div>
      <div><label className={labelClass}>วันที่ซื้อ / รับของ</label>
        <input type="date" value={f.PurchaseDate} onChange={e => upd('PurchaseDate', e.target.value)} className={inputClass} /></div>
      <div className="col-span-2"><label className={labelClass}>Vendor (สัญญา)</label>
        <select value={f.VendorID} onChange={e => upd('VendorID', e.target.value)} className={inputClass}>
          <option value="">— ไม่ระบุ —</option>
          {vendors.map(v => <option key={v.id} value={v.id}>{v.Title}</option>)}
        </select></div>
      <div><label className={labelClass}>ผู้ขาย / ยี่ห้อ</label>
        <input value={f.Vendor} onChange={e => upd('Vendor', e.target.value)} className={inputClass} placeholder="Dell, Lazada, ..." /></div>
      <div><label className={labelClass}>ยอดรวมตามใบส่งของ</label>
        <input type="number" min="0" value={f.TotalCost} onChange={e => upd('TotalCost', e.target.value)} className={inputClass} /></div>
      <div><label className={labelClass}>เลข PO</label>
        <input value={f.PONumber} onChange={e => upd('PONumber', e.target.value)} className={`${inputClass} font-mono`} /></div>
      <div><label className={labelClass}>เลขใบกำกับ / ใบส่งของ</label>
        <input value={f.InvoiceNo} onChange={e => upd('InvoiceNo', e.target.value)} className={`${inputClass} font-mono`} /></div>
      <div className="col-span-2"><label className={labelClass}>อ้างอิงใบเสนอราคา (SalePro)</label>
        <input value={f.QuotationRef} onChange={e => upd('QuotationRef', e.target.value)} className={`${inputClass} font-mono`} list="quote-ref-list" /></div>
      <div className="col-span-2"><label className={labelClass}>หมายเหตุ</label>
        <textarea value={f.Note} onChange={e => upd('Note', e.target.value)} rows={2} className={inputClass} /></div>
    </>
  )
}

interface Props {
  lot: AssetLot
  assets: Asset[]
  vendors: { id: number; Title: string }[]
  canEdit: boolean
  /** รหัส Asset อัตโนมัติสำหรับชิ้นที่ i (เริ่ม 0) ตอนสร้างหลายชิ้น */
  makeCode: (offset: number) => string
  onChanged: () => void
  onOpenAsset: (a: Asset) => void
  onDeleted: () => void
}

export function AssetLotPanel({ lot, assets, vendors, canEdit, makeCode, onChanged, onOpenAsset, onDeleted }: Props) {
  const { addToast } = useAppStore()
  const [mode, setMode] = useState<'view' | 'edit' | 'add' | 'bulk'>('view')
  const [form, setForm] = useState<LotForm>(lotToForm(lot))
  const [busy, setBusy] = useState(false)
  const [pickSearch, setPickSearch] = useState('')
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [bulk, setBulk] = useState({ prefix: '', count: '2', category: 'Computer', price: '', warranty: '' })

  const members = useMemo(() => assetsInLot(assets, lot.id), [assets, lot.id])
  const summary = useMemo(() => lotSummary(assets, lot.id), [assets, lot.id])
  const gap = lotCostGap(lot, summary)
  const candidates = useMemo(() => {
    const q = pickSearch.trim().toLowerCase()
    return unlottedAssets(assets).filter(a => !q || a.Title.toLowerCase().includes(q) || (a.AssetCode ?? '').toLowerCase().includes(q) || (a.SerialNumber ?? '').toLowerCase().includes(q))
  }, [assets, pickSearch])

  const upd = (k: keyof LotForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await spUpdate(LOT_LIST, lot.id, lotPayload(form))
      addToast('success', 'บันทึกตะกร้าแล้ว'); setMode('view'); onChanged()
    } catch (err) { addToast('error', `บันทึกไม่สำเร็จ: ${(err as Error).message}`) }
    finally { setBusy(false) }
  }

  // ย้ายออก = ล้าง LotID ที่ Asset — ตัว Asset ยังอยู่ (ตะกร้าไม่ได้เป็นเจ้าของ แค่จัดกลุ่ม)
  async function removeFrom(a: Asset) {
    try {
      await spUpdate('IT_Assets', a.id, { LotID: null })
      addToast('success', `เอา "${a.Title}" ออกจากตะกร้าแล้ว`); onChanged()
    } catch { addToast('error', 'ย้ายออกไม่สำเร็จ') }
  }

  async function addPicked() {
    if (!picked.size) return
    setBusy(true)
    let ok = 0
    for (const id of picked) {
      try { await spUpdate('IT_Assets', id, { LotID: lot.id }); ok++ } catch { /* นับที่ไม่สำเร็จจากผลรวม */ }
    }
    setBusy(false)
    addToast(ok === picked.size ? 'success' : 'error', `ย้ายเข้าตะกร้า ${ok}/${picked.size} รายการ`)
    setPicked(new Set()); setMode('view'); onChanged()
  }

  // สร้าง N ชิ้นชื่อเดียวกัน — ของใน lot เดียวกันมักเป็นรุ่นเดียวกัน ค่าที่ซ้ำ (วันซื้อ/ผู้ขาย/ราคา/ประกัน) ดึงจากตะกร้า
  async function createBulk(e: React.FormEvent) {
    e.preventDefault()
    const names = bulkNames(bulk.prefix, Number(bulk.count))
    if (!bulk.prefix.trim() || names.length === 0) { addToast('error', 'ใส่ชื่อรุ่นและจำนวนก่อน'); return }
    if (names.length > 100) { addToast('error', 'สร้างได้ครั้งละไม่เกิน 100 ชิ้น'); return }
    setBusy(true)
    let ok = 0
    for (let i = 0; i < names.length; i++) {
      try {
        await spCreate('IT_Assets', {
          Title: names[i], AssetCode: makeCode(i), Category: bulk.category, Status: 'Active', OwnerType: 'Company',
          LotID: lot.id,
          PurchaseDate: lot.PurchaseDate || undefined,
          Vendor: lot.Vendor || undefined, VendorID: lot.VendorID ?? undefined,
          QuotationRef: lot.QuotationRef || undefined,
          Price: bulk.price ? Number(bulk.price) : undefined,
          WarrantyDate: bulk.warranty || undefined,
        })
        ok++
      } catch { break }
    }
    setBusy(false)
    addToast(ok === names.length ? 'success' : 'error', `สร้าง Asset ${ok}/${names.length} ชิ้นในตะกร้า`)
    if (ok) { setBulk(b => ({ ...b, prefix: '' })); setMode('view'); onChanged() }
  }

  async function deleteLot() {
    const msg = members.length
      ? `ลบตะกร้า "${lot.Title}"?\nAsset ${members.length} ชิ้นในตะกร้าจะยังอยู่ แค่ไม่มีตะกร้า · ไฟล์แนบของตะกร้าจะหายไป`
      : `ลบตะกร้า "${lot.Title}"? ไฟล์แนบของตะกร้าจะหายไป`
    if (!window.confirm(msg)) return
    setBusy(true)
    try {
      for (const a of members) await spUpdate('IT_Assets', a.id, { LotID: null }).catch(() => {})
      await spDelete(LOT_LIST, lot.id)
      addToast('success', 'ลบตะกร้าแล้ว'); onDeleted()
    } catch (err) { addToast('error', `ลบไม่สำเร็จ: ${(err as Error).message}`) }
    finally { setBusy(false) }
  }

  const ven = lot.VendorID != null ? vendors.find(v => v.id === lot.VendorID) : undefined

  if (mode === 'edit') {
    return (
      <form onSubmit={save} className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
        <AssetLotFields f={form} upd={upd} vendors={vendors} />
        <div className="col-span-2 flex gap-2">
          <Button type="submit" disabled={busy} className="flex-1 justify-center">{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
          <Button type="button" variant="secondary" onClick={() => { setForm(lotToForm(lot)); setMode('view') }}>ยกเลิก</Button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-4">
      {/* หัวตะกร้า */}
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {lot.LotNo && <span className="text-xs font-mono text-gray-400">{lot.LotNo}</span>}
            {lot.PurchaseDate && <span className="text-xs text-gray-400">ซื้อ {formatDate(lot.PurchaseDate)}</span>}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs mt-2">
            {(ven || lot.Vendor) && <div><p className="text-gray-400">ผู้ขาย</p><p>{ven?.Title ?? lot.Vendor}{ven && lot.Vendor ? ` · ${lot.Vendor}` : ''}</p></div>}
            {lot.PONumber && <div><p className="text-gray-400">PO</p><p className="font-mono">{lot.PONumber}</p></div>}
            {lot.InvoiceNo && <div><p className="text-gray-400">ใบกำกับ / ใบส่งของ</p><p className="font-mono">{lot.InvoiceNo}</p></div>}
            {lot.QuotationRef && <div><p className="text-gray-400">ใบเสนอราคา</p><p className="font-mono">{lot.QuotationRef}</p></div>}
            {lot.TotalCost != null && <div><p className="text-gray-400">ยอดตามใบส่งของ</p><p>{lot.TotalCost.toLocaleString()}</p></div>}
            <div><p className="text-gray-400">ราคารวม Asset ในตะกร้า</p><p>{summary.assetTotal.toLocaleString()} <span className="text-gray-400">({summary.count} ชิ้น)</span></p></div>
          </div>
          {gap != null && Math.abs(gap) >= 1 && (
            <p className="mt-2 text-[11px] text-amber-600 inline-flex items-center gap-1">
              <AlertTriangle size={11} /> ยอดใบส่งของกับราคารวม Asset ต่างกัน {Math.abs(gap).toLocaleString()} — {gap > 0 ? 'มี Asset ที่ยังไม่ได้ใส่ราคา หรือยังไม่ได้สร้าง' : 'ราคา Asset รวมเกินยอดใบส่งของ'}
            </p>
          )}
          {lot.Note && <p className="text-xs whitespace-pre-wrap text-gray-600 dark:text-gray-300 mt-2">{lot.Note}</p>}
        </div>
        {canEdit && (
          <div className="flex gap-1.5 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={() => setMode('edit')}><Edit2 size={12} /> แก้ไข</Button>
            <button onClick={deleteLot} disabled={busy} title="ลบตะกร้า (Asset ยังอยู่)"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 disabled:opacity-50"><Trash2 size={12} /></button>
          </div>
        )}
      </div>

      {/* เอกสารของตะกร้า — ใบรับสินค้า / ใบกำกับ / PO */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
        <p className="text-xs text-gray-400 mb-1">📄 เอกสารของตะกร้า (ใบรับสินค้า · ใบกำกับภาษี · PO · ใบรับประกัน)</p>
        <AttachmentSection listName={LOT_LIST} itemId={lot.id} readOnly={!canEdit} />
      </div>

      {/* ของในตะกร้า */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className="text-xs text-gray-400 inline-flex items-center gap-1"><ShoppingBasket size={12} /> ของในตะกร้า {summary.count} ชิ้น
            {summary.retired > 0 && <span className="text-gray-300"> · ปลดระวาง {summary.retired}</span>}</p>
          {canEdit && (
            <div className="ml-auto flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setMode(mode === 'add' ? 'view' : 'add')}><Plus size={12} /> ย้ายของเข้า</Button>
              <Button size="sm" variant="secondary" onClick={() => setMode(mode === 'bulk' ? 'view' : 'bulk')}><Layers size={12} /> สร้างหลายชิ้น</Button>
            </div>
          )}
        </div>

        {mode === 'add' && (
          <div className="border border-primary-200 dark:border-primary-800 rounded-xl p-3 mb-3 space-y-2 bg-primary-50/40 dark:bg-primary-900/10">
            <input value={pickSearch} onChange={e => setPickSearch(e.target.value)} placeholder="ค้นหา Asset ที่ยังไม่อยู่ในตะกร้าไหน…" className={inputClass} />
            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {candidates.length === 0 && <p className="text-xs text-gray-400 py-3 text-center">ไม่มี Asset ว่างตะกร้าที่ตรงคำค้น</p>}
              {candidates.slice(0, 200).map(a => (
                <label key={a.id} className="flex items-center gap-2 py-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={picked.has(a.id)} onChange={e => setPicked(p => { const n = new Set(p); if (e.target.checked) n.add(a.id); else n.delete(a.id); return n })} className="accent-primary-600" />
                  <span className="font-mono text-gray-400 w-24 truncate">{a.AssetCode || '—'}</span>
                  <span className="flex-1 truncate">{a.Title}</span>
                  <span className="text-gray-400">{a.Category}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setMode('view'); setPicked(new Set()) }}>ยกเลิก</Button>
              <Button size="sm" disabled={busy || picked.size === 0} onClick={addPicked}>ย้ายเข้าตะกร้า ({picked.size})</Button>
            </div>
          </div>
        )}

        {mode === 'bulk' && (
          <form onSubmit={createBulk} className="border border-primary-200 dark:border-primary-800 rounded-xl p-3 mb-3 grid grid-cols-2 gap-3 bg-primary-50/40 dark:bg-primary-900/10">
            <p className="col-span-2 text-xs text-gray-500">สร้าง Asset หลายชิ้นรุ่นเดียวกันเข้าตะกร้านี้ทีเดียว — วันซื้อ / ผู้ขาย / ใบเสนอราคา ดึงจากตะกร้าให้ · รหัส Asset รันต่ออัตโนมัติ</p>
            <div className="col-span-2"><label className={labelClass}>ชื่อรุ่น *</label>
              <input value={bulk.prefix} onChange={e => setBulk(b => ({ ...b, prefix: e.target.value }))} className={inputClass} placeholder="Dell Latitude 5540" />
              {bulk.prefix.trim() && <p className="text-[11px] text-gray-400 mt-1">จะได้: {bulkNames(bulk.prefix, Number(bulk.count) || 0).slice(0, 3).join(', ')}{Number(bulk.count) > 3 ? ', …' : ''}</p>}</div>
            <div><label className={labelClass}>จำนวน *</label>
              <input type="number" min="1" max="100" value={bulk.count} onChange={e => setBulk(b => ({ ...b, count: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>หมวด</label>
              <select value={bulk.category} onChange={e => setBulk(b => ({ ...b, category: e.target.value }))} className={inputClass}>
                {['Computer', 'Server', 'VM', 'Network', 'Certificate', 'Software', 'Other'].map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div><label className={labelClass}>ราคาต่อชิ้น</label>
              <input type="number" min="0" value={bulk.price} onChange={e => setBulk(b => ({ ...b, price: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>หมดประกัน</label>
              <input type="date" value={bulk.warranty} onChange={e => setBulk(b => ({ ...b, warranty: e.target.value }))} className={inputClass} /></div>
            <div className="col-span-2 flex justify-end gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setMode('view')}>ยกเลิก</Button>
              <Button type="submit" size="sm" disabled={busy}>{busy ? 'กำลังสร้าง…' : `สร้าง ${Number(bulk.count) || 0} ชิ้น`}</Button>
            </div>
          </form>
        )}

        {members.length === 0 ? (
          <p className="text-xs text-gray-300 py-3 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">ยังไม่มีของในตะกร้า — ย้ายของเข้า หรือสร้างหลายชิ้น</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {members.map(a => (
              <div key={a.id} className="flex items-center gap-2 py-1.5 text-xs">
                <button onClick={() => onOpenAsset(a)} className="flex-1 min-w-0 flex items-center gap-2 text-left hover:text-primary-600">
                  <span className="font-mono text-gray-400 w-24 truncate flex-shrink-0">{a.AssetCode || '—'}</span>
                  <span className="truncate font-medium">{a.Title}</span>
                  {a.SerialNumber && <span className="font-mono text-gray-400 truncate hidden sm:inline">{a.SerialNumber}</span>}
                </button>
                <Badge className={getStatusColor(a.Status)}>{a.Status}</Badge>
                {a.Price != null && <span className="text-gray-500 w-20 text-right">{a.Price.toLocaleString()}</span>}
                {canEdit && (
                  <button onClick={() => removeFrom(a)} title="เอาออกจากตะกร้า (Asset ยังอยู่)" className="text-gray-300 hover:text-red-500"><X size={12} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
