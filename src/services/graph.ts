import { graphConfig } from '../config/msal'
import { buildGraphMessage, isSendAsDenied, type SendAs } from '../utils/mailSender'

let _getToken: (() => Promise<string>) | null = null

export function setGraphTokenGetter(fn: () => Promise<string>) {
  _getToken = fn
}

async function graphHeaders(): Promise<HeadersInit> {
  if (!_getToken) throw new Error('Token getter not initialized')
  const token = await _getToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export interface OutlookEvent {
  id: string
  subject: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  location?: { displayName: string }
  attendees?: Array<{ emailAddress: { address: string; name: string } }>
  isAllDay: boolean
  bodyPreview?: string
  onlineMeeting?: { joinUrl: string }
  onlineMeetingUrl?: string
}

const CALENDAR_SELECT = [
  'id', 'subject', 'start', 'end', 'location', 'isAllDay',
  'bodyPreview', 'onlineMeeting', 'onlineMeetingUrl',
].join(',')

export async function getCalendarRange(startDate: Date, endDate: Date): Promise<OutlookEvent[]> {
  const headers = await graphHeaders()
  const url = `${graphConfig.graphCalendarEndpoint}` +
    `?startDateTime=${startDate.toISOString()}` +
    `&endDateTime=${endDate.toISOString()}` +
    `&$orderby=start/dateTime` +
    `&$top=100` +
    `&$select=${CALENDAR_SELECT}`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`Graph calendar failed: ${res.status}`)
  const data = await res.json()
  return data.value as OutlookEvent[]
}

export async function getWeeklyCalendar(): Promise<OutlookEvent[]> {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay() + 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return getCalendarRange(start, end)
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const headers = await graphHeaders()
  await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: 'DELETE',
    headers,
  })
}

export interface SentInfo { sentAs: SendAs; from?: string }

/**
 * ส่งเมลผ่าน Graph — ในนามบัญชีกลาง (opts.from) ถ้ามีสิทธิ์ Send As
 * ไม่มีสิทธิ์ → ส่งจากตัวเองพร้อม reply-to กลับบัญชีกลาง ดีกว่าลูกค้าไม่ได้เมลเลย (ดู utils/mailSender.ts)
 */
export async function sendMail(
  to: string | string[],
  subject: string,
  body: string,
  opts?: { from?: string; cc?: string[] },
): Promise<SentInfo> {
  const headers = await graphHeaders()
  const toArr = (Array.isArray(to) ? to : [to]).filter(Boolean)
  const post = (sendAs: SendAs) => fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: buildGraphMessage({ to: toArr, cc: opts?.cc, subject, html: body, from: opts?.from, sendAs }),
      saveToSentItems: true,
    }),
  })
  const first: SendAs = opts?.from ? 'shared' : 'self'
  let res = await post(first)
  let sentAs = first
  if (!res.ok && first === 'shared') {
    const text = await res.text().catch(() => '')
    if (!isSendAsDenied(res.status, text)) throw new Error(`sendMail ${res.status}: ${text.slice(0, 200)}`)
    res = await post('self')
    sentAs = 'self'
  }
  // เดิมไม่เช็คผล → ส่งไม่ออกก็เงียบ ตอบลูกค้าแล้วคิดว่าถึงแล้ว
  if (!res.ok) throw new Error(`sendMail ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return { sentAs, from: opts?.from }
}

export async function createCalendarEvent(event: {
  subject: string
  start: string
  end: string
  location?: string
  attendees?: string[]
  body?: string
  /** HTML สำเร็จรูป (เช่นจาก meetingBody) — ใช้ตามนั้น ไม่แปลงบรรทัด */
  bodyHtml?: string
  isOnlineMeeting?: boolean
  isAllDay?: boolean
}): Promise<OutlookEvent> {
  const headers = await graphHeaders()
  const payload = {
    subject: event.subject,
    isAllDay: event.isAllDay ?? false,
    start: { dateTime: event.start, timeZone: 'Asia/Bangkok' },
    end: { dateTime: event.end, timeZone: 'Asia/Bangkok' },
    showAs: event.isAllDay ? 'free' : undefined,
    location: event.location ? { displayName: event.location } : undefined,
    attendees: event.attendees?.filter(Boolean).map(email => ({
      emailAddress: { address: email },
      type: 'required',
    })),
    body: event.bodyHtml
      ? { contentType: 'HTML', content: event.bodyHtml }
      : event.body ? { contentType: 'HTML', content: event.body.replace(/\n/g, '<br>') } : undefined,
    isOnlineMeeting: event.isOnlineMeeting ?? false,
    onlineMeetingProvider: event.isOnlineMeeting ? 'teamsForBusiness' : undefined,
  }
  const res = await fetch(graphConfig.graphEventsEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Graph create event failed: ${res.status}`)
  return res.json()
}

// ── รายชื่อคนทั้ง domain ────────────────────────────────────────────────────
// ใช้ token คนละใบกับ calendar/mail โดยตั้งใจ: สิทธิ์ User.ReadBasic.All อาจยัง
// ไม่ได้ consent ในบาง tenant ถ้าเอาไปรวมกับ scope เดิม การขอ token จะพังทั้งชุด
// แล้วปฏิทินกับเมลจะใช้ไม่ได้ไปด้วย ทั้งที่ไม่เกี่ยวกัน

export const DIRECTORY_SCOPES = ['User.ReadBasic.All']

let _getDirToken: ((interactive: boolean) => Promise<string>) | null = null
export function setDirectoryTokenGetter(fn: (interactive: boolean) => Promise<string>) {
  _getDirToken = fn
}

/** ยังขอสิทธิ์อ่านรายชื่อไม่ได้ = ต้องให้ผู้ใช้กดยินยอมก่อน ไม่ใช่ความผิดพลาด */
export class DirectoryConsentError extends Error {}

const DIR_SELECT = 'displayName,mail,userPrincipalName,jobTitle,department,userType'
const DIR_PAGE_CAP = 10   // 10 × 999 ≈ 10,000 คน — กันวนไม่รู้จบใน tenant ใหญ่

/**
 * ดึงรายชื่อคนในองค์กรจาก Microsoft 365
 * interactive = true จะเด้งหน้าต่างขอความยินยอมถ้ายังไม่เคยให้
 */
export async function getDirectoryPeople(interactive = false): Promise<Record<string, string>[]> {
  if (!_getDirToken) throw new DirectoryConsentError('Directory token getter not initialized')
  let token: string
  try {
    token = await _getDirToken(interactive)
  } catch {
    throw new DirectoryConsentError('ยังไม่ได้รับสิทธิ์อ่านรายชื่อในองค์กร')
  }

  const people: Record<string, string>[] = []
  let url = `https://graph.microsoft.com/v1.0/users?$select=${DIR_SELECT}&$top=999`
  for (let page = 0; page < DIR_PAGE_CAP && url; page++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401 || res.status === 403) throw new DirectoryConsentError('ไม่มีสิทธิ์อ่านรายชื่อในองค์กร')
    if (!res.ok) throw new Error(`Graph users failed: ${res.status}`)
    const json = await res.json()
    people.push(...(json.value ?? []))
    url = json['@odata.nextLink'] ?? ''
  }
  return people
}
