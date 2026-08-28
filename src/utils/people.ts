// รวมรายชื่อ "คนในองค์กร" จากสองที่ให้เป็นชุดเดียว
//
// HD_AgentProfiles = คนที่ตั้งใจใส่เข้ามาเป็นทีมซัพพอร์ต — มีกลุ่มงาน มีบทบาท
// Microsoft 365 directory = ทุกคนใน domain — ครบ แต่ไม่รู้ว่าใครทำอะไร
//
// ที่ต้องรวม เพราะเวลาเชิญคนเข้าประชุม/งาน คนที่ต้องเชิญมักไม่ใช่ทีมซัพพอร์ต
// (ฝ่ายขาย ฝ่ายบัญชี หัวหน้า) แต่ทีมซัพพอร์ตต้องอยู่บนสุดเพราะเลือกบ่อยที่สุด

export interface DirectoryPerson {
  displayName?: string
  mail?: string
  userPrincipalName?: string
  jobTitle?: string
  department?: string
  userType?: string
}

export interface AgentLike {
  Title?: string
  EmailText?: string
  SupportGroup?: string
}

export interface PersonOption {
  value: string        // อีเมล (ตัวพิมพ์ตามต้นทาง)
  label: string
  isAgent: boolean
}

/** อีเมลที่ใช้ได้จริงของคนใน directory — บางบัญชีมีแต่ UPN */
export const personEmail = (p: DirectoryPerson): string =>
  (p.mail ?? p.userPrincipalName ?? '').trim()

/**
 * บัญชีที่ไม่ควรโผล่ในรายชื่อคน
 * guest คือคนนอกองค์กร ซึ่งช่องนี้ชื่อ "ผู้เข้าร่วม Internal" — คนนอกมีช่องของตัวเองอยู่แล้ว
 * ส่วนบัญชีระบบอย่าง noreply ไม่มีใครอ่าน
 *
 * ไม่ได้กรองห้องประชุม/อุปกรณ์ เพราะปกติไม่อยู่ใน /users อยู่แล้ว
 * ถ้า tenant ไหน sync เข้ามาด้วยจะเห็นปนอยู่ — บอกได้ จะกรองเพิ่ม
 */
export function isRealPerson(p: DirectoryPerson): boolean {
  const email = personEmail(p).toLowerCase()
  if (!email || !email.includes('@')) return false
  if ((p.userType ?? '').toLowerCase() === 'guest') return false
  if (email.includes('#ext#')) return false
  const local = email.split('@')[0]
  if (/^(noreply|no-reply|donotreply|postmaster|mailer-daemon)$/.test(local)) return false
  return true
}

const labelOf = (name: string, hint?: string): string =>
  hint ? `${name} · ${hint}` : name

/**
 * รวมสองรายชื่อ — ทีมซัพพอร์ตขึ้นก่อน แล้วตามด้วยคนอื่นในองค์กร
 * ซ้ำกันให้ยึดฝั่ง agent เพราะมีข้อมูลกลุ่มงานที่คนเลือกใช้แยกคนชื่อซ้ำ
 */
export function mergePeople(agents: AgentLike[], directory: DirectoryPerson[]): PersonOption[] {
  const out: PersonOption[] = []
  const seen = new Set<string>()

  for (const a of agents) {
    const email = (a.EmailText ?? '').trim()
    if (!email || seen.has(email.toLowerCase())) continue
    seen.add(email.toLowerCase())
    out.push({ value: email, label: labelOf(a.Title || email, a.SupportGroup), isAgent: true })
  }

  const others: PersonOption[] = []
  for (const p of directory) {
    if (!isRealPerson(p)) continue
    const email = personEmail(p)
    if (seen.has(email.toLowerCase())) continue
    seen.add(email.toLowerCase())
    others.push({
      value: email,
      label: labelOf(p.displayName || email, p.department || p.jobTitle),
      isAgent: false,
    })
  }
  others.sort((x, y) => x.label.localeCompare(y.label, 'th'))
  return [...out, ...others]
}
