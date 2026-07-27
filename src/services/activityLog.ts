// ── Activity Log ──
// ดักที่ service layer (spCreate/spUpdate/spDelete/แนบไฟล์) → บันทึกทุกการเปลี่ยนแปลงอัตโนมัติ
// เก็บใน SharePoint list 'HD_ActivityLog' — ถ้ายังไม่สร้างลิสต์ ระบบทำงานปกติ (log เงียบๆ ไม่ error)

export const ACTIVITY_LIST = 'HD_ActivityLog'

export type ActivityAction = 'create' | 'update' | 'delete' | 'attach' | 'detach' | 'login'

export interface ActivityRow {
  id: number
  Title: string
  UserEmail?: string
  UserName?: string
  Action?: string
  ListName?: string
  ItemID?: number
  ItemTitle?: string
  Details?: string
  PagePath?: string
  Created?: string
}

// ลิสต์ที่ไม่ต้อง log — กัน loop และกัน noise ท่วมจนหาของจริงไม่เจอ
const SKIP_LISTS = new Set<string>([
  ACTIVITY_LIST,        // สำคัญ: กัน infinite loop
  'HD_Notifications',   // สร้างทุกครั้งที่มีคอมเมนต์/มอบหมาย — ซ้ำกับ log ต้นทางอยู่แล้ว
  'HD_Focus',           // ปักหมุด/เรียงลำดับ เกิดถี่มาก
  'HD_MonitorStatus',   // poller เขียนอัตโนมัติทุกนาที
])

// ฟิลด์ที่ห้ามบันทึกค่าเด็ดขาด (บันทึกแค่ว่า "ถูกแก้") — กันความลับรั่วลง log
const SECRET_FIELDS = new Set<string>([
  'Password', 'SecureNote', 'Secret', 'Token', 'ApiKey', 'AccessKey',
])

// ฟิลด์ที่ใช้เดาชื่อรายการ เพื่อให้ log อ่านรู้เรื่อง (ไม่ใช่แค่เลข ID)
const TITLE_FIELDS = ['Title', 'TicketNumber', 'AssetCode', 'Name', 'CommentText']

let _user: { email: string; name: string } | null = null
/** ตั้งผู้ใช้ปัจจุบัน — เรียกตอน login (App.tsx) */
export function setActivityUser(u: { email: string; name: string } | null) { _user = u }

let _enabled = true
/** ปิด log ชั่วคราว (เช่นตอน cascade delete จะได้ไม่ยิงเป็นร้อยแถว) */
export function setActivityEnabled(on: boolean) { _enabled = on }

/** ย่อค่าที่ยาวเกินไป + ปิดบังความลับ */
function summarize(data: Record<string, unknown>): string {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (SECRET_FIELDS.has(k)) { out[k] = '***(ซ่อน)***'; continue }
    if (v == null) { out[k] = null; continue }
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    out[k] = s.length > 200 ? s.slice(0, 200) + '…' : s
  }
  const json = JSON.stringify(out, null, 1)
  return json.length > 3000 ? json.slice(0, 3000) + '\n…(ตัดทอน)' : json
}

function guessTitle(data?: Record<string, unknown>): string {
  if (!data) return ''
  for (const f of TITLE_FIELDS) {
    const v = data[f]
    if (typeof v === 'string' && v.trim()) return v.slice(0, 100)
  }
  return ''
}

/**
 * บันทึก activity — fire-and-forget โดยเจตนา:
 * ห้ามให้การ log ล้มเหลว/ช้า ไปกระทบงานหลักของผู้ใช้
 */
export function logActivity(params: {
  action: ActivityAction
  listName: string
  itemId?: number
  itemTitle?: string
  data?: Record<string, unknown>
  note?: string
}): void {
  if (!_enabled) return
  if (SKIP_LISTS.has(params.listName)) return

  const { action, listName, itemId, data, note } = params
  const itemTitle = params.itemTitle || guessTitle(data)
  const who = _user?.name || _user?.email || 'unknown'
  const summary = `${who} · ${action} · ${listName}${itemId ? `(${itemId})` : ''}${itemTitle ? ` · ${itemTitle}` : ''}`

  const payload = {
    Title: summary.slice(0, 255),
    UserEmail: _user?.email ?? '',
    UserName: _user?.name ?? '',
    Action: action,
    ListName: listName,
    ...(itemId ? { ItemID: itemId } : {}),
    ItemTitle: itemTitle.slice(0, 255),
    Details: note ? `${note}\n${data ? summarize(data) : ''}` : (data ? summarize(data) : ''),
    PagePath: (typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '').slice(0, 255),
  }

  // import แบบ dynamic กัน circular import (sharepoint.ts เรียกไฟล์นี้)
  import('./sharepoint')
    .then(sp => sp.spCreate(ACTIVITY_LIST, payload))
    .catch(() => { /* ลิสต์ยังไม่ถูกสร้าง หรือเขียนไม่ได้ — เงียบไว้ ไม่รบกวนผู้ใช้ */ })
}
