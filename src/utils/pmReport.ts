// เครื่องมือทำรายงาน PM ในแอป — แคปรูปวางลง template ที่ร่างไว้ แล้วสั่งพิมพ์เป็น PDF
//
// รับ template ได้ 2 แบบ:
//  1. ไฟล์ config ของเครื่องมือเดิม (PM Report/config/*.json) วางมาได้ตรง ๆ ไม่ต้องร่างใหม่
//  2. โครงที่แอปสร้างเอง (รูปแบบเดียวกัน)
//
// ทุกฟังก์ชันในไฟล์นี้เป็น pure — ตัวเลข Figure และการตรวจความครบ ต้องพิสูจน์ได้

export type TaskResult = 'Pass' | 'Fail' | 'N/A' | ''
export type InvStatus = 'Normal' | 'Attention' | 'Fault' | ''

export interface PmTask {
  no: string
  name: string
}
export interface PmDevice {
  key: string
  name: string
  tasks: PmTask[]
}
export interface PmInventoryRow {
  no: string
  serial: string
  role: string
}
export interface PmVersionRow {
  version: string
  date: string
  change: string
  author: string
}
export interface PmTemplate {
  title: string
  meta: { customer: string; site: string; pm_date: string; engineer: string; so_number: string }
  versionHistory: PmVersionRow[]
  inventory: PmInventoryRow[]
  devices: PmDevice[]
}

/** รูปที่แคปไว้ 1 ภาพ — ไฟล์จริงเป็น attachment ของงาน เก็บแค่ชื่อไฟล์ในนี้ */
export interface PmShot {
  file: string        // ชื่อไฟล์แนบ
  caption: string
}

/** สิ่งที่ผู้ใช้กรอก — เก็บเป็น JSON ก้อนเดียวในคอลัมน์ Data ของงาน */
export interface PmJobData {
  meta: PmTemplate['meta']
  versionHistory: PmVersionRow[]
  invStatus: Record<string, InvStatus>          // serial → สถานะ
  results: Record<string, TaskResult>           // "deviceKey/taskNo" → ผล
  shots: Record<string, PmShot[]>               // "deviceKey/taskNo" → รูป
  recommendations: Record<string, string>       // deviceKey → ข้อเสนอแนะ
}

export const slotKey = (deviceKey: string, taskNo: string): string => `${deviceKey}/${taskNo}`

const str = (v: unknown): string => (v == null ? '' : String(v)).trim()

/**
 * อ่าน JSON ที่ผู้ใช้วางมา → โครง template ที่แอปใช้
 * ทนกับของที่กรอกไม่ครบ: ไม่มี key ก็สร้างจากชื่อ, ไม่มี no ก็ไล่เลขให้
 * โยน Error พร้อมเหตุผลเป็นภาษาคน ถ้าใช้ไม่ได้จริง
 */
export function parseTemplate(raw: string): PmTemplate {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    throw new Error('ไม่ใช่ JSON ที่อ่านได้ — ตรวจว่าวางมาครบทั้งไฟล์')
  }
  if (!obj || typeof obj !== 'object') throw new Error('ไม่พบข้อมูลใน JSON')
  const o = obj as Record<string, unknown>

  const rawDevices = Array.isArray(o['devices']) ? (o['devices'] as Record<string, unknown>[]) : []
  if (rawDevices.length === 0) throw new Error('ไม่พบรายการอุปกรณ์ (devices) ใน template')

  const seen = new Set<string>()
  const devices: PmDevice[] = rawDevices.map((d, di) => {
    // key ต้องไม่ซ้ำ เพราะใช้เป็นที่อยู่ของรูปและผลตรวจ — ซ้ำแล้วข้อมูลจะทับกัน
    let key = str(d['key']) || str(d['name']) || `device-${di + 1}`
    while (seen.has(key)) key = `${key}-${di + 1}`
    seen.add(key)
    const rawTasks = Array.isArray(d['tasks']) ? (d['tasks'] as Record<string, unknown>[]) : []
    return {
      key,
      name: str(d['name']) || `อุปกรณ์ ${di + 1}`,
      tasks: rawTasks.map((t, ti) => ({
        no: str(t['no']) || String(ti + 1).padStart(2, '0'),
        name: str(t['name']) || str(t['label']) || `รายการ ${ti + 1}`,
      })),
    }
  })

  const m = (o['meta'] ?? {}) as Record<string, unknown>
  return {
    title: str(o['title']) || str(o['template']).replace(/\.docx$/i, '') || 'รายงาน PM',
    meta: {
      customer: str(m['customer']), site: str(m['site']), pm_date: str(m['pm_date']),
      engineer: str(m['engineer']), so_number: str(m['so_number']),
    },
    versionHistory: (Array.isArray(o['version_history']) ? o['version_history'] : [])
      .map((v) => {
        const r = (v ?? {}) as Record<string, unknown>
        return { version: str(r['version']), date: str(r['date']), change: str(r['change']), author: str(r['author']) }
      }),
    inventory: (Array.isArray(o['inventory']) ? o['inventory'] : [])
      .map((v, i) => {
        const r = (v ?? {}) as Record<string, unknown>
        return { no: str(r['no']) || String(i + 1).padStart(2, '0'), serial: str(r['serial']), role: str(r['role']) }
      }),
    devices,
  }
}

export function emptyJobData(t: PmTemplate): PmJobData {
  return {
    meta: { ...t.meta },
    versionHistory: t.versionHistory.map(v => ({ ...v })),
    invStatus: {}, results: {}, shots: {}, recommendations: {},
  }
}

/** อ่าน Data ที่เก็บไว้ — ของที่ยังไม่มีให้เป็นค่าว่าง ไม่ใช่ระเบิด */
export function parseJobData(raw: string | undefined, t: PmTemplate): PmJobData {
  const base = emptyJobData(t)
  if (!raw) return base
  try {
    const o = JSON.parse(raw) as Partial<PmJobData>
    return {
      meta: { ...base.meta, ...(o.meta ?? {}) },
      versionHistory: Array.isArray(o.versionHistory) && o.versionHistory.length ? o.versionHistory : base.versionHistory,
      invStatus: o.invStatus ?? {},
      results: o.results ?? {},
      shots: o.shots ?? {},
      recommendations: o.recommendations ?? {},
    }
  } catch {
    return base
  }
}

/** ไล่เลข Figure ตามลำดับที่ปรากฏในเอกสาร — อุปกรณ์เรียงตาม template, รูปเรียงตามที่วาง */
export interface FiguredShot extends PmShot {
  figure: number
  deviceKey: string
  taskNo: string
}
export function numberFigures(t: PmTemplate, data: PmJobData): FiguredShot[] {
  const out: FiguredShot[] = []
  let n = 0
  for (const d of t.devices) {
    for (const task of d.tasks) {
      for (const s of data.shots[slotKey(d.key, task.no)] ?? []) {
        n += 1
        out.push({ ...s, figure: n, deviceKey: d.key, taskNo: task.no })
      }
    }
  }
  return out
}

export const figuresOf = (all: FiguredShot[], deviceKey: string): FiguredShot[] =>
  all.filter(f => f.deviceKey === deviceKey)

export interface PmProgress {
  tasks: number
  answered: number         // ติ๊กผลแล้วกี่รายการ
  shots: number
  devicesNoShot: string[]  // อุปกรณ์ที่ยังไม่มีรูปเลย
  devicesNoRec: string[]   // อุปกรณ์ที่ยังไม่เขียนข้อเสนอแนะ
  invBlank: number         // inventory ที่ยังไม่เลือกสถานะ
  metaMissing: string[]    // ช่องหัวรายงานที่ยังว่าง
}

const META_LABEL: Record<string, string> = {
  customer: 'ลูกค้า', site: 'สถานที่', pm_date: 'วันที่ PM', engineer: 'วิศวกร', so_number: 'เลข SO',
}

/**
 * ตรวจความครบก่อนพิมพ์ — ของที่ลืมง่ายที่สุดคือ "ติ๊กผลแล้วแต่ลืมแคปรูป"
 * ตั้งใจให้ไม่บล็อกการพิมพ์ แค่บอกว่าอะไรขาด (บางรายงานไม่ต้องมีรูปทุกอุปกรณ์จริง ๆ)
 */
export function progressOf(t: PmTemplate, data: PmJobData): PmProgress {
  let tasks = 0, answered = 0, shots = 0
  const devicesNoShot: string[] = []
  const devicesNoRec: string[] = []
  for (const d of t.devices) {
    let devShots = 0
    for (const task of d.tasks) {
      tasks += 1
      const k = slotKey(d.key, task.no)
      if (data.results[k]) answered += 1
      const n = (data.shots[k] ?? []).length
      devShots += n
      shots += n
    }
    if (devShots === 0) devicesNoShot.push(d.name)
    if (!(data.recommendations[d.key] ?? '').trim()) devicesNoRec.push(d.name)
  }
  return {
    tasks, answered, shots, devicesNoShot, devicesNoRec,
    invBlank: t.inventory.filter(r => !data.invStatus[r.serial]).length,
    metaMissing: (Object.keys(META_LABEL) as (keyof PmTemplate['meta'])[])
      .filter(k => !(data.meta[k] ?? '').trim())
      .map(k => META_LABEL[k]),
  }
}

/** ชื่อไฟล์แนบของรูป — ต้องไม่ซ้ำกันในงานเดียว และเดาที่อยู่ได้จากชื่อ */
export function shotFileName(deviceKey: string, taskNo: string, seq: number): string {
  const safe = deviceKey.replace(/[^A-Za-z0-9ก-๙_-]+/g, '_').slice(0, 40)
  return `shot_${safe}_${taskNo}_${seq}_${Math.random().toString(36).slice(2, 7)}.png`
}
