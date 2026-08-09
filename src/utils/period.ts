// ช่วงเวลาสำหรับรายงาน — preset + ช่วงก่อนหน้า (ไว้เทียบว่าดีขึ้นหรือแย่ลง) + การแบ่งแท่งกราฟ
// ทุกฟังก์ชันในไฟล์นี้เป็น pure ทั้งหมด รับ "วันนี้" เข้ามาได้ เพื่อให้ตรวจสอบผลลัพธ์ได้แน่นอน

export type PresetKey = 'this-month' | 'last-month' | 'this-quarter' | 'ytd' | 'last-12m' | 'custom'

export interface Range {
  start: Date   // 00:00:00 ของวันเริ่ม
  end: Date     // 23:59:59.999 ของวันสุดท้าย
}

export const PRESETS: { key: PresetKey; labelTh: string; labelEn: string }[] = [
  { key: 'this-month',   labelTh: 'เดือนนี้',        labelEn: 'This month' },
  { key: 'last-month',   labelTh: 'เดือนที่แล้ว',    labelEn: 'Last month' },
  { key: 'this-quarter', labelTh: 'ไตรมาสนี้',       labelEn: 'This quarter' },
  { key: 'ytd',          labelTh: 'ตั้งแต่ต้นปี',    labelEn: 'Year to date' },
  { key: 'last-12m',     labelTh: '12 เดือนล่าสุด',  labelEn: 'Last 12 months' },
  { key: 'custom',       labelTh: 'กำหนดเอง',        labelEn: 'Custom' },
]

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
export const endOfDay   = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

export function presetRange(key: PresetKey, today = new Date()): Range {
  const y = today.getFullYear(), m = today.getMonth()
  switch (key) {
    case 'this-month':
      return { start: new Date(y, m, 1), end: endOfDay(today) }
    case 'last-month':
      return { start: new Date(y, m - 1, 1), end: endOfDay(new Date(y, m, 0)) }
    case 'this-quarter': {
      const qm = Math.floor(m / 3) * 3
      return { start: new Date(y, qm, 1), end: endOfDay(today) }
    }
    case 'ytd':
      return { start: new Date(y, 0, 1), end: endOfDay(today) }
    case 'last-12m':
      return { start: new Date(y, m - 11, 1), end: endOfDay(today) }
    default:
      return { start: new Date(y, m, 1), end: endOfDay(today) }
  }
}

const isMonthAligned = (r: Range): boolean =>
  r.start.getDate() === 1 && r.end.getDate() === new Date(r.end.getFullYear(), r.end.getMonth() + 1, 0).getDate()

/**
 * ช่วงก่อนหน้าที่ยาวเท่ากันและต่อกันพอดี — ใช้เทียบว่าดีขึ้น/แย่ลงกี่ %
 * ช่วงที่เป็นเดือนเต็มต้องถอยเป็น "เดือน" ไม่ใช่ลบจำนวนวัน ไม่งั้นก่อนหน้าเดือน ก.ค. (31 วัน)
 * จะกลายเป็น 31 พ.ค. – 30 มิ.ย. เพราะ มิ.ย. มี 30 วัน
 */
export function previousRange(r: Range): Range {
  const end = new Date(r.start.getTime() - 1)
  if (isMonthAligned(r)) {
    const months = (r.end.getFullYear() - r.start.getFullYear()) * 12 + (r.end.getMonth() - r.start.getMonth()) + 1
    return { start: new Date(r.start.getFullYear(), r.start.getMonth() - months, 1), end }
  }
  const span = r.end.getTime() - r.start.getTime()
  return { start: new Date(r.start.getTime() - span - 1), end }
}

export const inRange = (iso: string | undefined, r: Range): boolean => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !isNaN(t) && t >= r.start.getTime() && t <= r.end.getTime()
}

/** ISO ที่ตัดเวลาออก (yyyy-mm-dd) สำหรับ <input type="date"> — ไม่ใช้ toISOString เพราะจะเพี้ยนตาม timezone */
export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function fromDateInput(s: string, end = false): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (isNaN(d.getTime())) return null
  return end ? endOfDay(d) : startOfDay(d)
}

/** OData datetime literal — SharePoint ต้องการรูปแบบ UTC ตรงนี้ */
export const odata = (d: Date): string => `datetime'${d.toISOString()}'`

export type Bucket = 'day' | 'week' | 'month'

/** ช่วงยาวแค่ไหนควรแบ่งแท่งกราฟเป็นอะไร — ไม่ให้ได้กราฟ 365 แท่งหรือแท่งเดียว */
export function pickBucket(r: Range): Bucket {
  const days = Math.round((r.end.getTime() - r.start.getTime()) / 86400000)
  if (days <= 31) return 'day'
  if (days <= 120) return 'week'
  return 'month'
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

export interface BucketDef { key: string; label: string; start: Date; end: Date }

/** ไล่ช่วงย่อยตั้งแต่ต้นจนจบ — ช่องที่ไม่มีข้อมูลก็ยังอยู่ (กราฟจะได้ไม่ข้ามวัน) */
export function buildBuckets(r: Range, bucket: Bucket): BucketDef[] {
  const out: BucketDef[] = []
  if (bucket === 'month') {
    const cur = new Date(r.start.getFullYear(), r.start.getMonth(), 1)
    while (cur <= r.end) {
      const s = new Date(cur.getFullYear(), cur.getMonth(), 1)
      const e = endOfDay(new Date(cur.getFullYear(), cur.getMonth() + 1, 0))
      out.push({ key: `${s.getFullYear()}-${s.getMonth()}`, label: MONTHS_TH[s.getMonth()], start: s, end: e })
      cur.setMonth(cur.getMonth() + 1)
    }
    return out
  }
  const step = bucket === 'day' ? 1 : 7
  const cur = startOfDay(r.start)
  while (cur <= r.end) {
    const s = new Date(cur)
    const e = endOfDay(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + step - 1))
    out.push({
      key: toDateInput(s),
      label: bucket === 'day' ? `${s.getDate()}` : `${s.getDate()}/${s.getMonth() + 1}`,
      start: s,
      end: e > r.end ? r.end : e,
    })
    cur.setDate(cur.getDate() + step)
  }
  return out
}

export function rangeLabel(r: Range): string {
  const f = (d: Date) => `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`
  return `${f(r.start)} – ${f(r.end)}`
}
