// ตะกร้า (Lot) ของ IT Asset — ของที่ซื้อมาด้วยกันใน lot เดียว
//
// ทำไมต้องมี: ซื้อโน้ตบุ๊ก 10 เครื่องใบส่งของใบเดียว แต่ Asset เป็น 10 แถว
// ใบรับสินค้า/ใบกำกับภาษีจะไปแนบไว้ที่เครื่องไหน? แนบทั้ง 10 ก็ซ้ำ แนบเครื่องเดียวก็หาไม่เจอ
// → เอกสารอยู่ที่ "ตะกร้า" แถวเดียว แล้ว Asset ชี้กลับมาด้วย LotID
//
// SharePoint: ลิสต์ IT_AssetLots (เปิด Attachments) + คอลัมน์ LotID (Number) ใน IT_Assets
// ไม่มีลิสต์ = หน้า Assets ซ่อนส่วนตะกร้าไป ไม่พัง

export interface AssetLot {
  id: number
  Title: string          // ชื่อตะกร้า เช่น "โน้ตบุ๊กทีมขาย ก.ย. 69"
  LotNo?: string         // LOT-2026-001
  PurchaseDate?: string
  Vendor?: string
  VendorID?: number
  PONumber?: string
  InvoiceNo?: string
  TotalCost?: number
  QuotationRef?: string
  Note?: string
  AttachmentFiles?: { FileName: string; ServerRelativeUrl: string }[]
}

export interface LotAssetLike {
  id: number
  LotID?: number | null
  Price?: number
  Category?: string
  Status?: string
}

/** Asset ที่อยู่ในตะกร้านี้ */
export function assetsInLot<T extends LotAssetLike>(assets: T[], lotId: number): T[] {
  return assets.filter(a => a.LotID === lotId)
}

/** Asset ที่ยังไม่อยู่ในตะกร้าไหน — ตัวเลือกสำหรับ "ย้ายเข้าตะกร้า" */
export function unlottedAssets<T extends LotAssetLike>(assets: T[]): T[] {
  return assets.filter(a => a.LotID == null)
}

export interface LotSummary {
  count: number
  /** ผลรวมราคาของ Asset ในตะกร้า (ไม่ใช่ TotalCost ที่กรอกเอง) */
  assetTotal: number
  categories: string[]
  retired: number
}

export function lotSummary(assets: LotAssetLike[], lotId: number): LotSummary {
  const members = assetsInLot(assets, lotId)
  const cats = new Map<string, number>()
  for (const a of members) cats.set(a.Category || 'Other', (cats.get(a.Category || 'Other') ?? 0) + 1)
  return {
    count: members.length,
    assetTotal: members.reduce((s, a) => s + (a.Price ?? 0), 0),
    categories: [...cats.entries()].sort((x, y) => y[1] - x[1]).map(([c]) => c),
    retired: members.filter(a => a.Status === 'Retired').length,
  }
}

/**
 * เลขตะกร้าถัดไป LOT-<ปี>-<ลำดับ 3 หลัก> — ปีจากวันที่ซื้อ (ไม่ใช่วันนี้) จะได้เรียงตามปีงบ
 * ลำดับนับต่อจากเลขสูงสุดของปีนั้นที่มีอยู่ ไม่ใช่นับจำนวน (ลบไปแล้วไม่ซ้ำเลขเก่า)
 */
export function nextLotNo(lots: Pick<AssetLot, 'LotNo'>[], purchaseDate?: string): string {
  const year = (purchaseDate && /^\d{4}/.test(purchaseDate)) ? purchaseDate.slice(0, 4) : String(new Date().getFullYear())
  const prefix = `LOT-${year}-`
  let max = 0
  for (const l of lots) {
    const no = (l.LotNo ?? '').trim()
    if (!no.startsWith(prefix)) continue
    const n = parseInt(no.slice(prefix.length), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

/** ป้ายสั้น ๆ ของตะกร้าสำหรับ dropdown / แถบ */
export function lotLabel(l: Pick<AssetLot, 'Title' | 'LotNo'>): string {
  return l.LotNo ? `${l.LotNo} · ${l.Title}` : l.Title
}

/**
 * ชื่อ Asset ตอนสร้างหลายชิ้นจากตะกร้า — "Dell Latitude 5540 #01" … "#10"
 * เลขเติมศูนย์ตามจำนวนหลักของ N เพื่อให้เรียงชื่อแล้วถูกลำดับ (#2 ไม่ไปอยู่หลัง #10)
 */
export function bulkNames(prefix: string, count: number): string[] {
  const n = Math.max(0, Math.floor(count))
  const width = String(n).length
  const base = prefix.trim()
  return Array.from({ length: n }, (_, i) => `${base} #${String(i + 1).padStart(width, '0')}`)
}

/** ส่วนต่างระหว่างยอดที่กรอกบนตะกร้า กับผลรวมราคา Asset — เตือนเมื่อไม่ตรง (กรอกตก / ลืมใส่ราคา) */
export function lotCostGap(lot: Pick<AssetLot, 'TotalCost'>, summary: LotSummary): number | null {
  if (lot.TotalCost == null || summary.count === 0) return null
  return lot.TotalCost - summary.assetTotal
}

// ── ฟอร์มของตะกร้า (แยกจาก component เพื่อ fast refresh และทดสอบได้) ──
export const LOT_LIST = 'IT_AssetLots'


export const EMPTY_LOT = {
  Title: '', LotNo: '', PurchaseDate: '', Vendor: '', VendorID: '',
  PONumber: '', InvoiceNo: '', TotalCost: '', QuotationRef: '', Note: '',
}
export type LotForm = typeof EMPTY_LOT

export function lotToForm(l: AssetLot): LotForm {
  return {
    Title: l.Title || '', LotNo: l.LotNo || '',
    PurchaseDate: l.PurchaseDate?.slice(0, 10) || '',
    Vendor: l.Vendor || '', VendorID: l.VendorID != null ? String(l.VendorID) : '',
    PONumber: l.PONumber || '', InvoiceNo: l.InvoiceNo || '',
    TotalCost: l.TotalCost != null ? String(l.TotalCost) : '',
    QuotationRef: l.QuotationRef || '', Note: l.Note || '',
  }
}

export function lotPayload(f: LotForm) {
  return {
    Title: f.Title.trim(), LotNo: f.LotNo.trim() || undefined,
    PurchaseDate: f.PurchaseDate || undefined,
    Vendor: f.Vendor || undefined, VendorID: f.VendorID ? Number(f.VendorID) : undefined,
    PONumber: f.PONumber || undefined, InvoiceNo: f.InvoiceNo || undefined,
    TotalCost: f.TotalCost ? Number(f.TotalCost) : undefined,
    QuotationRef: f.QuotationRef || undefined, Note: f.Note || undefined,
  }
}

