export interface DateMatch {
  text: string    // matched text in original
  start: number
  end: number
  isoDate: string // YYYY-MM-DD  (first date if multi-day)
  time: string    // HH:MM (24hr)
  allDates?: string[]  // all ISO dates if multiple days detected
}

const EN_MONTHS: Record<string, number> = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
  jan:1, feb:2, mar:3, apr:4, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
}

const TH_MONTHS: Record<string, number> = {
  'มกราคม':1,'กุมภาพันธ์':2,'มีนาคม':3,'เมษายน':4,'พฤษภาคม':5,'มิถุนายน':6,
  'กรกฎาคม':7,'สิงหาคม':8,'กันยายน':9,'ตุลาคม':10,'พฤศจิกายน':11,'ธันวาคม':12,
  'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,
  'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12,
}

// Parse time — supports both "2:00" and "2.00" separators
function parseTime24(t: string): string {
  const m = t.match(/(\d{1,2})[.:](\d{2})\s*(am|pm)?/i)
  if (!m) return '09:00'
  let h = parseInt(m[1]); const min = m[2]; const ap = (m[3] ?? '').toLowerCase()
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${min}`
}

function toISO(y: number, mo: number, d: number): string {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function detectDates(text: string): DateMatch[] {
  const results: DateMatch[] = []
  const covered = new Set<number>()

  function addRaw(start: number, end: number, matchText: string, isoDate: string, time: string, allDates?: string[]) {
    for (let i = start; i < end; i++) {
      if (covered.has(i)) return
    }
    for (let i = start; i < end; i++) covered.add(i)
    results.push({ text: matchText, start, end, isoDate, time, allDates })
  }

  function addMatch(m: RegExpExecArray, isoDate: string, time: string, allDates?: string[]) {
    addRaw(m.index, m.index + m[0].length, m[0], isoDate, time, allDates)
  }

  // TIME pattern — supports colon or dot: "2:00 PM" or "2.00 PM" or "14:00"
  const TIME_PAT = `\\d{1,2}[.:]\\d{2}(?:\\s*(?:AM|PM))?`

  // MONTH pattern
  const thPat = Object.keys(TH_MONTHS).map(k => k.replace(/\./g, '\\.')).join('|')
  const EN_MON_PAT = '[A-Za-z]+'

  // Pattern 0: Multi-day — "D1, D2[, D3,] Month YYYY [Time/at] H:MM [AM/PM]"
  // e.g. "15,18, May 2026 Time 2.00 PM"  or  "15, 16, 17 June 2026 at 2:00 PM"
  const re0 = new RegExp(
    `((?:\\d{1,2}(?:st|nd|rd|th)?[,\\s]+){1,6})(${EN_MON_PAT}|${thPat})\\s+(\\d{4})(?:\\s+(?:Time|at|เวลา)\\s+(${TIME_PAT}))?`,
    'gi'
  )
  let m: RegExpExecArray | null
  while ((m = re0.exec(text)) !== null) {
    const monthName = m[2]
    const mon = EN_MONTHS[monthName.toLowerCase()] ?? TH_MONTHS[monthName]
    if (!mon) continue

    // Extract all day numbers from the comma/space list
    const dayList = m[1]
    const days = Array.from(dayList.matchAll(/\d{1,2}/g)).map(d => parseInt(d[0])).filter(d => d >= 1 && d <= 31)
    if (days.length < 2) continue  // single-day handled by other patterns

    let yr = parseInt(m[3]); if (yr > 2400) yr -= 543
    const time = m[4] ? parseTime24(m[4]) : '09:00'
    const allDates = days.map(d => toISO(yr, mon, d))
    addMatch(m, allDates[0], time, allDates)
  }

  // Pattern 1: [Day, ]Month D[st/nd/rd/th][,] YYYY [at/Time] H:MM [AM/PM]
  // e.g. "Thursday, June 4, 2026 at 2:00 PM" or "June 4, 2026 Time 2.00 PM"
  const re1 = new RegExp(
    `(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\w*,?\\s+)?(${EN_MON_PAT})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?:\\s+(?:at|Time|เวลา)\\s+(${TIME_PAT}))?`,
    'gi'
  )
  while ((m = re1.exec(text)) !== null) {
    const mon = EN_MONTHS[m[1].toLowerCase()]
    if (!mon) continue
    const iso = toISO(parseInt(m[3]), mon, parseInt(m[2]))
    const time = m[4] ? parseTime24(m[4]) : '09:00'
    addMatch(m, iso, time)
  }

  // Pattern 2: D Month YYYY [at/Time/เวลา] H:MM (English or Thai month)
  // e.g. "18th of May 2026 at 02:00 PM" or "4 มิถุนายน 2569 เวลา 14:00"
  const re2 = new RegExp(
    `(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${EN_MON_PAT}|${thPat})\\s+(\\d{4})(?:\\s+(?:at|Time|เวลา)\\s+(${TIME_PAT}))?`,
    'gi'
  )
  while ((m = re2.exec(text)) !== null) {
    const mon = EN_MONTHS[m[2].toLowerCase()] ?? TH_MONTHS[m[2]]
    if (!mon) continue
    let yr = parseInt(m[3]); if (yr > 2400) yr -= 543
    const time = m[4] ? parseTime24(m[4]) : '09:00'
    addMatch(m, toISO(yr, mon, parseInt(m[1])), time)
  }

  // Pattern 3: Thai month only (no time)
  const re3 = new RegExp(`(\\d{1,2})\\s+(${thPat})\\s+(\\d{4})`, 'g')
  while ((m = re3.exec(text)) !== null) {
    const mon = TH_MONTHS[m[2]]
    if (!mon) continue
    let yr = parseInt(m[3]); if (yr > 2400) yr -= 543
    addMatch(m, toISO(yr, mon, parseInt(m[1])), '09:00')
  }

  return results.sort((a, b) => a.start - b.start)
}
