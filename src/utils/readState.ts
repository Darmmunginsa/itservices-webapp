// สถานะ "อ่านแล้ว" ของแชทในออฟฟิศ — เก็บบน SharePoint (คอลัมน์ ReadState ของ HD_OfficeDecor · 1 แถว/คน)
// จึงตามไปทุกเครื่อง (เปิดเครื่องใหม่ไม่ขึ้นว่ายังไม่อ่าน) และคนส่งเห็นว่าใครอ่านแล้ว
//   c: ห้องแชท ('' = ทั้งออฟฟิศ, ชื่อโซน = เฉพาะห้อง) → id ข้อความล่าสุดที่อ่าน
//   d: แชทส่วนตัว (อีเมลอีกฝั่ง) → id ข้อความล่าสุดที่อ่าน

export interface ReadState { c: Record<string, number>; d: Record<string, number> }
export const emptyRead = (): ReadState => ({ c: {}, d: {} })

const clean = (o: unknown): Record<string, number> => {
  const out: Record<string, number> = {}
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (typeof v === 'number' && v > 0) out[k.toLowerCase()] = v
  return out
}

export function parseRead(raw: string | null | undefined): ReadState {
  try { const j = JSON.parse(raw || '{}') as { c?: unknown; d?: unknown }; return { c: clean(j.c), d: clean(j.d) } } catch { return emptyRead() }
}
export const serializeRead = (r: ReadState): string => JSON.stringify(r)

/** รวมสองชุด เอาค่าที่อ่านไปไกลกว่า (ไม่มีวันถอยกลับเป็น "ยังไม่อ่าน") */
export function mergeRead(a: ReadState, b: ReadState): ReadState {
  const m = (x: Record<string, number>, y: Record<string, number>) => {
    const o = { ...x }
    for (const [k, v] of Object.entries(y)) if (v > (o[k] ?? 0)) o[k] = v
    return o
  }
  return { c: m(a.c, b.c), d: m(a.d, b.d) }
}

export const sameRead = (a: ReadState, b: ReadState): boolean => serializeRead(mergeRead(a, b)) === serializeRead(a) && serializeRead(mergeRead(a, b)) === serializeRead(b)

/** ใครอ่านข้อความนี้ในห้องแชทแล้วบ้าง (ไม่นับคนส่ง) */
export function readersOf(all: Map<string, ReadState>, room: string, id: number, sender: string): string[] {
  const r = room.toLowerCase(), s = sender.toLowerCase()
  return [...all.entries()].filter(([e, st]) => e !== s && (st.c[r] ?? 0) >= id).map(([e]) => e)
}

/** อีกฝั่งอ่านข้อความส่วนตัวนี้แล้วหรือยัง */
export const dmSeen = (partnerState: ReadState | undefined, me: string, id: number): boolean => (partnerState?.d[me.toLowerCase()] ?? 0) >= id
