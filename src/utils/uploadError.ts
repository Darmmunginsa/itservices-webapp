// อธิบายว่าทำไมแนบไฟล์ไม่ผ่าน — ให้คนรู้ว่าต้องไปแก้ที่ไหน
//
// เดิมทุกกรณีขึ้นว่า "อัปโหลดไม่สำเร็จ" คนที่ไม่มีสิทธิ์กับคนที่เจอลิสต์ปิดแนบไฟล์
// เห็นข้อความเดียวกัน แล้วก็มาถามว่า "ระบบพัง" ทั้งที่จริงคือสิทธิ์ใน SharePoint

export function uploadErrorText(status: number, body: string, listName: string): string {
  const b = (body ?? '').toLowerCase()
  if (status === 403 || status === 401) {
    return `ไม่มีสิทธิ์แนบไฟล์ในลิสต์ ${listName} — ต้องได้สิทธิ์ Contribute (แก้ไข) บนลิสต์นี้ ให้ Admin เพิ่มใน SharePoint`
  }
  if (status === 413 || b.includes('request entity too large') || b.includes('maximum')) {
    return 'ไฟล์ใหญ่เกินที่ SharePoint รับ — ลดขนาดหรือแบ่งไฟล์'
  }
  if (status === 400 && (b.includes('attachment') || b.includes('แนบ'))) {
    return `ลิสต์ ${listName} ปิดการแนบไฟล์อยู่ — ให้ Admin เปิดที่ List Settings → Advanced settings → Attachments`
  }
  if (status === 404) return `ไม่พบรายการหรือลิสต์ ${listName} — อาจถูกลบ หรือยังสร้างไม่เสร็จ ลองรีเฟรช`
  if (status === -1) return 'เครือข่ายขัดข้อง หรือ session หมดอายุ — รีเฟรชหน้าแล้วลองใหม่'
  if (status === 429 || status >= 500) return 'SharePoint ไม่ว่างชั่วคราว — รอสักครู่แล้วลองใหม่'
  return `อัปโหลดไม่สำเร็จ (HTTP ${status})`
}

// ── สิทธิ์บนลิสต์ (EffectiveBasePermissions) ─────────────────────────────────
// SharePoint คืน bitmask 64 บิตแยกเป็น High/Low — สิทธิ์เขียนอยู่ใน Low
// AddListItems = บิตที่ 1 (0x2) · EditListItems = บิตที่ 2 (0x4)
// แนบไฟล์ต้องมี EditListItems (แนบ = แก้ไขรายการ) ไม่ใช่แค่ AddListItems

export interface BasePerms { High: string | number; Low: string | number }

const low = (p?: BasePerms | null): number => Number(p?.Low ?? 0) >>> 0

export const canAddItems  = (p?: BasePerms | null): boolean => (low(p) & 0x2) !== 0
export const canEditItems = (p?: BasePerms | null): boolean => (low(p) & 0x4) !== 0
export const canViewItems = (p?: BasePerms | null): boolean => (low(p) & 0x1) !== 0

export interface ListHealth {
  attachmentsEnabled: boolean
  canWrite: boolean
  canAttach: boolean
}

/** สรุปว่าลิสต์นี้ให้คนที่ล็อกอินอยู่ "แนบไฟล์" ได้ไหม และถ้าไม่ได้เพราะอะไร */
export function listHealth(info: { EnableAttachments?: boolean; EffectiveBasePermissions?: BasePerms | null }): ListHealth {
  const canWrite = canEditItems(info.EffectiveBasePermissions)
  const attachmentsEnabled = info.EnableAttachments !== false
  return { attachmentsEnabled, canWrite, canAttach: attachmentsEnabled && canWrite }
}

export function listHealthText(h: ListHealth): string {
  if (h.canAttach) return 'แนบไฟล์ได้'
  if (!h.attachmentsEnabled && !h.canWrite) return 'ปิดแนบไฟล์ และคุณไม่มีสิทธิ์แก้ไข'
  if (!h.attachmentsEnabled) return 'ลิสต์ปิดการแนบไฟล์ (List Settings → Advanced → Attachments)'
  return 'คุณไม่มีสิทธิ์แก้ไขลิสต์นี้ — แนบไฟล์ไม่ได้ (ต้อง Contribute)'
}
