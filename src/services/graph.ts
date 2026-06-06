import { graphConfig } from '../config/msal'

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

export async function sendMail(
  to: string | string[],
  subject: string,
  body: string,
  opts?: { from?: string; cc?: string[] },
): Promise<void> {
  const headers = await graphHeaders()
  const toArr = (Array.isArray(to) ? to : [to]).filter(Boolean)
  const message: Record<string, unknown> = {
    subject,
    body: { contentType: 'HTML', content: body },
    toRecipients: toArr.map(a => ({ emailAddress: { address: a } })),
  }
  // CC — ใส่ผู้ที่ต้องการให้อยู่ใน loop เดียวกัน (reply ได้ทั้ง thread)
  const cc = (opts?.cc ?? []).filter(Boolean)
  if (cc.length) message.ccRecipients = cc.map(a => ({ emailAddress: { address: a } }))
  // ส่งในนามบัญชีกลาง (ต้องมีสิทธิ์ Send As บน mailbox นั้นใน M365)
  if (opts?.from) message.from = { emailAddress: { address: opts.from } }
  await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, saveToSentItems: true }),
  })
}

export async function createCalendarEvent(event: {
  subject: string
  start: string
  end: string
  location?: string
  attendees?: string[]
  body?: string
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
    body: event.body ? { contentType: 'HTML', content: event.body.replace(/\n/g, '<br>') } : undefined,
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
