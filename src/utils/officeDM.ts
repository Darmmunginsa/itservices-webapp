// แชทส่วนตัว (DM) ในออฟฟิศ + ทักขอคุยด้วยเสียง
//
// 1 แถวใน HD_OfficeDM = 1 เหตุการณ์ระหว่างสองคน: ข้อความ หรือขั้นตอนของการขอคุยเสียง
//   text        ข้อความธรรมดา
//   voice-ask   "สะดวกคุยด้วยเสียงไหม?"
//   voice-yes   รับ → ทั้งสองฝั่งต่อสายส่วนตัว
//   voice-no    ไม่สะดวก (ข้อความแนบได้ เช่น "ติดประชุม ขอ 10 นาที")
//   voice-end   วางสายส่วนตัว
// สถานะของสายคำนวณจาก "แถว voice-* ล่าสุด" ของคู่นั้น — สองฝั่งเห็นแถวชุดเดียวกัน จึงตรงกันเองโดยไม่ต้องส่งอะไรเพิ่ม

export type DMKind = 'text' | 'voice-ask' | 'voice-yes' | 'voice-no' | 'voice-end'

export interface DMRow {
  id: number
  FromEmail: string
  ToEmail: string
  FromName?: string
  Kind?: string
  Message?: string
  Title?: string
  Created: string
}

/** ขอคุยเสียงค้างได้นานเท่านี้ — เกินแล้วถือว่าอีกฝั่งไม่เห็น ไม่ให้กดรับของเก่าแล้วต่อสายกลางอากาศ */
export const ASK_TTL_MS = 2 * 60_000
/** สายส่วนตัวที่ไม่มีใครวาง (ปิดแท็บหนี) — ถือว่าจบเองหลังจากนี้ */
export const CALL_TTL_MS = 2 * 3600_000

export const QUICK_DECLINE = ['ติดประชุมอยู่ ขอ 10 นาที', 'ขอพิมพ์คุยแทนนะ', 'อีกสักครู่โทรกลับ']

const low = (e?: string) => (e ?? '').trim().toLowerCase()

export const kindOf = (r: DMRow): DMKind => {
  const k = (r.Kind ?? '').trim()
  return (['voice-ask', 'voice-yes', 'voice-no', 'voice-end'] as const).includes(k as never) ? k as DMKind : 'text'
}

/** ข้อความจริงของแถว — Title ที่เป็นแค่ชื่อชนิด (บันทึกไว้เพราะ Title ห้ามว่าง) ไม่นับ */
export const textOf = (r: DMRow): string => r.Message || (r.Title && r.Title !== (r.Kind ?? '').trim() ? r.Title : '')

/** อีกฝั่งของแถวนี้ (มุมมองของฉัน) */
export const partnerOf = (r: DMRow, me: string): string => (low(r.FromEmail) === low(me) ? low(r.ToEmail) : low(r.FromEmail))

const between = (r: DMRow, a: string, b: string) => {
  const f = low(r.FromEmail), t = low(r.ToEmail)
  return (f === low(a) && t === low(b)) || (f === low(b) && t === low(a))
}

/** ข้อความของคู่นี้ เก่า → ใหม่ */
export function dmThread(rows: DMRow[], me: string, other: string): DMRow[] {
  return rows.filter(r => between(r, me, other)).sort((x, y) => x.id - y.id)
}

export type VoiceState =
  | { kind: 'none' }
  | { kind: 'asking-out'; askId: number }   // ฉันขอ รออีกฝั่งตอบ
  | { kind: 'asking-in'; askId: number }    // อีกฝั่งขอ รอฉันตอบ
  | { kind: 'active' }                       // กำลังคุยส่วนตัว
  | { kind: 'declined'; note: string; byMe: boolean }

/** สถานะการคุยเสียงของคู่นี้ ณ ตอนนี้ — จากแถว voice-* ล่าสุด */
export function voiceState(rows: DMRow[], me: string, other: string, now: number): VoiceState {
  const last = [...dmThread(rows, me, other)].reverse().find(r => kindOf(r) !== 'text')
  if (!last) return { kind: 'none' }
  const age = now - new Date(last.Created).getTime()
  const fromMe = low(last.FromEmail) === low(me)
  switch (kindOf(last)) {
    case 'voice-ask':
      if (age > ASK_TTL_MS) return { kind: 'none' }
      return fromMe ? { kind: 'asking-out', askId: last.id } : { kind: 'asking-in', askId: last.id }
    case 'voice-yes':
      return age > CALL_TTL_MS ? { kind: 'none' } : { kind: 'active' }
    case 'voice-no':
      // บอกว่าไม่สะดวกแค่ช่วงสั้น ๆ แล้วกลับเป็นปกติ ให้ขอใหม่ได้
      return age > ASK_TTL_MS ? { kind: 'none' } : { kind: 'declined', note: textOf(last), byMe: fromMe }
    default:
      return { kind: 'none' }
  }
}

/** คนที่ฉันกำลังคุยส่วนตัวด้วย (ปกติมีคนเดียว — รับสายใหม่ = วางสายเก่า) */
export function activeCallPartner(rows: DMRow[], me: string, now: number): string | null {
  for (const p of conversations(rows, me).map(c => c.partner)) {
    if (voiceState(rows, me, p, now).kind === 'active') return p
  }
  return null
}

/** คำขอคุยเสียงที่ค้างถึงฉัน — ใหม่สุดก่อน */
export function incomingAsks(rows: DMRow[], me: string, now: number): { partner: string; askId: number; name: string }[] {
  return conversations(rows, me)
    .map(c => ({ c, st: voiceState(rows, me, c.partner, now) }))
    .filter(x => x.st.kind === 'asking-in')
    .map(x => ({ partner: x.c.partner, askId: (x.st as { askId: number }).askId, name: x.c.name }))
}

export interface Conversation { partner: string; name: string; lastId: number; lastText: string; lastAt: string; unread: number }

/**
 * รายการคนที่เคยคุยด้วย — ใหม่สุดก่อน
 * readUpTo = id สูงสุดที่อ่านแล้วต่อคู่ (เก็บในเครื่อง) · unread นับเฉพาะของที่อีกฝั่งส่งมา
 */
export function conversations(rows: DMRow[], me: string, readUpTo: Record<string, number> = {}): Conversation[] {
  const by = new Map<string, Conversation>()
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    // แถวที่ฉันไม่ได้อยู่ในคู่ — ไม่ใช่บทสนทนาของฉัน (server กรองให้แล้ว แต่ไม่พึ่ง)
    if (low(r.FromEmail) !== low(me) && low(r.ToEmail) !== low(me)) continue
    const partner = partnerOf(r, me)
    if (!partner || partner === low(me)) continue
    const c = by.get(partner) ?? { partner, name: partner.split('@')[0], lastId: 0, lastText: '', lastAt: r.Created, unread: 0 }
    if (low(r.FromEmail) !== low(me) && r.FromName) c.name = r.FromName
    c.lastId = r.id; c.lastAt = r.Created
    const k = kindOf(r)
    c.lastText = k === 'text' ? textOf(r) : k === 'voice-ask' ? '📞 ขอคุยด้วยเสียง' : k === 'voice-yes' ? '🎧 คุยเสียงกัน' : k === 'voice-no' ? `🙏 ไม่สะดวก${textOf(r) ? ` — ${textOf(r)}` : ''}` : '📴 วางสาย'
    if (low(r.FromEmail) !== low(me) && r.id > (readUpTo[partner] ?? 0)) c.unread++
    by.set(partner, c)
  }
  return [...by.values()].sort((a, b) => b.lastId - a.lastId)
}

export const totalUnread = (cs: Conversation[]): number => cs.reduce((s, c) => s + c.unread, 0)
