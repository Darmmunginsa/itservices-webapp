// ตรวจเลขของหน้ารายงาน — ตัวเลขพวกนี้เอาไปใช้ตัดสินใจเรื่องคน จึงต้องพิสูจน์ได้ว่าคิดถูก
// โปรเจกต์นี้ยังไม่มี test runner จึงรันด้วย esbuild ตรง ๆ:
//   npm run check:report
import { formatCitation, formatBibliography } from '../src/utils/citation'
import { youtubeId, parseMediaLinks } from '../src/utils/youtube'
import { parseSections, parseInline, countLinks } from '../src/utils/richNote'
import { slaInfo, slaDue, computeSlaDue, slaFailed, slaJudged, slaCountdown } from '../src/utils/sla'
import { presetRange, previousRange, buildBuckets, pickBucket, inRange, fromDateInput } from '../src/utils/period'
import { periodStats, buildPersonRows, delta, median, closedOnTime, resolutionHours, scoreRows, incidentSla } from '../src/utils/reportMetrics'
import type { TicketLike, PersonRow } from '../src/utils/reportMetrics'

const NL = String.fromCharCode(10)   // เลี่ยงลำดับ escape ในไฟล์ตรวจ
let pass = 0, fail = 0
function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) { pass++ } else { fail++; console.log(`FAIL ${msg}\n  got ${a}\n  want ${e}`) }
}

const TODAY = new Date(2026, 7, 9)   // 9 ส.ค. 2026

// ── period ──
const m = presetRange('this-month', TODAY)
eq([m.start.getMonth(), m.start.getDate()], [7, 1], 'this-month starts on the 1st')
const lm = presetRange('last-month', TODAY)
eq([lm.start.getMonth(), lm.end.getMonth(), lm.end.getDate()], [6, 6, 31], 'last-month = full July')
const q = presetRange('this-quarter', TODAY)
eq(q.start.getMonth(), 6, 'Q3 starts in July')
const y12 = presetRange('last-12m', TODAY)
eq([y12.start.getFullYear(), y12.start.getMonth()], [2025, 8], 'last-12m starts Sep 2025')

const prev = previousRange(lm)
eq([prev.start.getMonth(), prev.end.getMonth(), prev.end.getDate()], [5, 5, 30], 'previous of July = June')
eq(prev.end.getTime() < lm.start.getTime(), true, 'previous period ends before current starts')

eq(pickBucket(presetRange('this-month', TODAY)), 'day', 'a month buckets by day')
eq(pickBucket(presetRange('last-12m', TODAY)), 'month', 'a year buckets by month')
eq(buildBuckets(lm, 'day').length, 31, 'July has 31 day-buckets')
eq(buildBuckets(presetRange('last-12m', TODAY), 'month').length, 12, '12-month range has 12 buckets')

eq(inRange(new Date(2026, 6, 15).toISOString(), lm), true, 'mid-July is inside July')
eq(inRange(new Date(2026, 7, 1).toISOString(), lm), false, '1 Aug is outside July')
eq(inRange(undefined, lm), false, 'missing date is never in range')
eq(fromDateInput('not-a-date'), null, 'bad date input rejected')

// ── ticket helpers ──
eq(closedOnTime({ id: 1, DueDate: '2026-07-10T00:00:00Z', ResolvedDate: '2026-07-09T00:00:00Z' }), true, 'closed before due = on time')
eq(closedOnTime({ id: 2, DueDate: '2026-07-10T00:00:00Z', ResolvedDate: '2026-07-11T00:00:00Z' }), false, 'closed after due = late')
eq(closedOnTime({ id: 3, ResolvedDate: '2026-07-11T00:00:00Z' }), null, 'no due date = cannot judge, not late')
eq(resolutionHours({ id: 4, Created: '2026-07-01T00:00:00Z', ResolvedDate: '2026-07-01T06:00:00Z' }), 6, 'six hours to resolve')
eq(resolutionHours({ id: 5, Created: '2026-07-02T00:00:00Z', ResolvedDate: '2026-07-01T00:00:00Z' }), null, 'resolved before created is rejected')
eq(median([1, 2, 3]), 2, 'median of odd count')
eq(median([1, 2, 3, 4]), 2.5, 'median of even count')
eq(median([]), null, 'median of nothing')

// ── periodStats ──
const iso = (mo: number, d: number, h = 0) => new Date(2026, mo, d, h).toISOString()
const tickets: TicketLike[] = [
  // เปิด+ปิดในเดือนก.ค. ทันกำหนด
  { id: 1, Status: 'Closed', Created: iso(6, 1), ResolvedDate: iso(6, 2), DueDate: iso(6, 5), AssignedEmail: 'a@x.com', AssignedTo: { Title: 'Ann' } },
  // เปิดในก.ค. ปิดช้ากว่ากำหนด
  { id: 2, Status: 'Resolved', Created: iso(6, 3), ResolvedDate: iso(6, 20), DueDate: iso(6, 10), AssignedEmail: 'a@x.com', AssignedTo: { Title: 'Ann' } },
  // เปิดมิ.ย. ปิดก.ค. → นับ "ปิด" ในก.ค. แต่ไม่นับ "รับเข้า"
  { id: 3, Status: 'Closed', Created: iso(5, 20), ResolvedDate: iso(6, 4), DueDate: iso(6, 30), AssignedEmail: 'b@x.com', AssignedTo: { Title: 'Bob' } },
  // เปิดก.ค. ยังไม่ปิด เลยกำหนดแล้ว → ค้าง + overdue
  { id: 4, Status: 'Open', Created: iso(6, 25), DueDate: iso(6, 28), AssignedEmail: 'b@x.com', AssignedTo: { Title: 'Bob' } },
  // เปิดส.ค. → อยู่นอกช่วงก.ค.ทั้งหมด
  { id: 5, Status: 'Open', Created: iso(7, 2), AssignedEmail: 'a@x.com', AssignedTo: { Title: 'Ann' } },
]

const st = periodStats(tickets, lm, TODAY)
eq(st.created, 3, 'created in July = 3 (ids 1,2,4)')
eq(st.closed, 3, 'closed in July = 3 (ids 1,2,3)')
eq(st.slaSample, 3, 'all three closed had due dates')
eq(Math.round(st.slaPct!), 67, 'two of three on time')
eq(st.backlogEnd, 1, 'only id 4 was still open at end of July')
eq(st.overdueNow, 1, 'id 4 is overdue now; id 5 has no due date')
eq(Math.round(st.closeRate! * 100), 100, 'closed 3 of 3 created')

eq(st.dueSetPct, 100, 'every closed ticket in July had a due date')

// ความน่าเชื่อถือของ SLA — ปิด 2 ใบ ตั้ง due date ใบเดียว
const halfSet: TicketLike[] = [
  { id: 10, Status: 'Closed', Created: iso(6, 1), ResolvedDate: iso(6, 2), DueDate: iso(6, 5), AssignedEmail: 'c@x.com' },
  { id: 11, Status: 'Closed', Created: iso(6, 1), ResolvedDate: iso(6, 2), AssignedEmail: 'c@x.com' },
]
const half = periodStats(halfSet, lm, TODAY)
eq(half.dueSetPct, 50, 'half the closed tickets had a due date')
eq(half.slaPct, 100, 'SLA still reads 100% — computed only over the half that was measurable')
eq(half.slaSample, 1, 'and it rests on a single ticket')

const noneSet = periodStats([{ id: 12, Status: 'Closed', Created: iso(6, 1), ResolvedDate: iso(6, 2) }], lm, TODAY)
eq([noneSet.dueSetPct, noneSet.slaPct], [0, null], 'no due dates at all: 0% coverage and no SLA to report')

const empty = periodStats([], lm, TODAY)
eq([empty.closeRate, empty.slaPct, empty.avgHours, empty.dueSetPct], [null, null, null, null], 'no data yields nulls, not zeros or NaN')

eq(delta(10, 5), 100, 'doubling is +100%')
eq(delta(5, 10), -50, 'halving is -50%')
eq(delta(5, 0), null, 'cannot compare against zero')
eq(delta(null, 5), null, 'cannot compare a missing value')

// ── per-person ──
const rows = buildPersonRows(tickets, [], [], [], lm, TODAY)
const byEmail = Object.fromEntries(rows.map(r => [r.email, r]))
eq(rows.length, 2, 'two people appear')
eq(byEmail['a@x.com'].closed, 2, 'Ann closed two')
eq(byEmail['a@x.com'].onTime, 1, 'one of Ann\'s was on time')
eq(byEmail['a@x.com'].late, 1, 'the other was late')
eq(byEmail['b@x.com'].closed, 1, 'Bob closed one')
eq(byEmail['b@x.com'].overdueNow, 1, 'Bob has one overdue open ticket')
eq(byEmail['a@x.com'].assigned, 2, 'Ann was assigned 2 in July — id 5 is August, outside the range')
eq(Math.round(byEmail['a@x.com'].sharePct), 67, 'Ann closed 2 of the 3 team closures')

eq(byEmail['a@x.com'].dueSetPct, 100, 'Ann set a due date on everything she closed')

// คนที่ไม่ตั้ง due date เลย: SLA ว่าง และ coverage 0 — เห็นได้ว่าทำไม SLA ถึงว่าง
const noDue = buildPersonRows(
  [{ id: 20, Status: 'Closed', Created: iso(6, 1), ResolvedDate: iso(6, 3), AssignedEmail: 'c@x.com', AssignedTo: { Title: 'Cat' } }],
  [], [], [], lm, TODAY)
eq([noDue[0].slaPct, noDue[0].dueSetPct], [null, 0], 'no due dates: SLA unknown, coverage 0%')

const unassigned = buildPersonRows([{ id: 9, Status: 'Open', Created: iso(6, 1) }], [], [], [], lm, TODAY)
eq(unassigned.length, 0, 'unassigned tickets belong to nobody')

// ── scoring ──
const base = (over: Partial<PersonRow>): PersonRow => ({
  email: 'e', name: 'n', assigned: 0, closed: 0, onTime: 0, late: 0, slaPct: null, dueSetPct: null,
  avgHours: null, medianHours: null, openNow: 0, overdueNow: 0, incidents: 0,
  tasksDue: 0, tasksDone: 0, leaveDays: 0, sharePct: 0, score: null, ...over,
})
const scored = scoreRows([
  base({ email: 'top', closed: 10, slaPct: 100, medianHours: 2 }),
  base({ email: 'mid', closed: 5,  slaPct: 50,  medianHours: 4 }),
  base({ email: 'none' }),
])
const s = Object.fromEntries(scored.map(r => [r.email, r.score]))
eq(s['top'], 100, 'best on every axis scores 100')
eq(s['none'], null, 'no data means no score, not zero')
eq(scored[0].email, 'top', 'sorted best first')
eq(s['mid']! < s['top']!, true, 'weaker performance scores lower')

// คนที่ปิดน้อยแต่ตรงเวลา 100% ต้องไม่ถูกคะแนนปริมาณกลบจนเหลือศูนย์
const fair = scoreRows([
  base({ email: 'many', closed: 20, slaPct: 40, medianHours: 10 }),
  base({ email: 'few',  closed: 4,  slaPct: 100, medianHours: 10 }),
])
const f = Object.fromEntries(fair.map(r => [r.email, r.score!]))
eq(f['few'] > 0, true, 'low volume still scores above zero when quality is perfect')

// -- citation lines (utils/citation) --
eq(formatCitation({ Authors: 'Beyer, B.', Year: '2016', Title: 'Site Reliability Engineering', Publisher: "O'Reilly", Locator: 'chapter 4' }),
  "Beyer, B. (2016). Site Reliability Engineering. O'Reilly. chapter 4.", 'full citation')
eq(formatCitation({ Title: 'RFC 5322', Identifier: 'RFC 5322' }), 'RFC 5322. RFC 5322.', 'sparse entry still reads sensibly')
eq(formatCitation({ Title: 'Book', Edition: '2nd ed.' }), 'Book (2nd ed.).', 'edition sits in brackets after the title')
eq(formatCitation({}), '', 'nothing in, nothing out - no stray dots or brackets')
eq(formatCitation({ Authors: 'Kim, G.' }), 'Kim, G.', 'an author that already ends in a dot does not get a second one')
eq(formatCitation({ Title: ' Padded  ' }), 'Padded.', 'whitespace trimmed')
eq(formatCitation({ Title: 'T', URL: 'https://x.dev' }), 'T. https://x.dev', 'url comes last and keeps no trailing dot')
eq(formatBibliography([{ Title: 'Zebra' }, { Title: 'Alpha' }, {}]),
  ['1. Alpha.', '2. Zebra.'].join('\n'), 'bibliography sorts, numbers, and drops empties')

// -- youtube links (utils/youtube) --
eq(youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ', 'short link')
eq(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42'), 'dQw4w9WgXcQ', 'watch link with extra params')
eq(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ', 'shorts')
eq(youtubeId('https://www.youtube.com/live/dQw4w9WgXcQ'), 'dQw4w9WgXcQ', 'live')
eq(youtubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ', 'bare id')
eq(youtubeId('https://vimeo.com/12345'), null, 'not youtube')
eq(youtubeId(''), null, 'empty')

eq(parseMediaLinks(undefined).length, 0, 'no media field')
eq(parseMediaLinks(['https://youtu.be/dQw4w9WgXcQ', '', '  ', 'https://vimeo.com/1'].join(NL)).length, 2,
  'blank lines dropped, non-youtube kept as a plain link')
eq(parseMediaLinks(['a | https://youtu.be/dQw4w9WgXcQ'].join(NL))[0].label, 'a', 'label before the pipe')
eq(parseMediaLinks('ตอน 1 | ตอน 2 | https://youtu.be/dQw4w9WgXcQ')[0].label, 'ตอน 1 | ตอน 2',
  'splits on the last pipe so labels may contain one')
eq(parseMediaLinks(['https://youtu.be/aaaaaaaaaaa', 'https://youtu.be/aaaaaaaaaaa'].join(NL)).length, 1,
  'duplicate links collapse')
eq(parseMediaLinks(['https://youtu.be/dQw4w9WgXcQ'].join(NL))[0].label, 'https://youtu.be/dQw4w9WgXcQ',
  'unlabelled link falls back to the url')
eq(parseMediaLinks(Array.from({ length: 40 }, (_, i) => `https://youtu.be/${String(i).padStart(11, 'x')}`).join(NL)).length,
  40, 'no cap on how many links can be added')

// -- knowledge notes (utils/richNote) --
const note = ['นำ', '## หัวข้อ ก', '- ข้อหนึ่ง', '', '## หัวข้อ ข', 'เนื้อหา'].join(NL)
eq(parseSections(note).length, 3, 'lead paragraph plus two headed sections')
eq(parseSections(note)[0].heading, '', 'text before the first heading keeps no heading')
eq(parseSections(note)[1].heading, 'หัวข้อ ก', 'heading text without the hashes')
eq(parseSections(note)[2].body, 'เนื้อหา', 'body follows its heading')
eq(parseSections('# เดี่ยว')[0].heading, 'เดี่ยว', 'a single hash counts as a heading too')
eq(parseSections('## ยังไม่เขียน').length, 1, 'an empty heading is kept, not dropped while still being typed')
eq(parseSections('').length, 0, 'nothing in, nothing out')
eq(parseSections('C:\path#notaheading').length, 1, 'a hash mid-line is not a heading')

eq(parseInline('ดูที่ https://a.dev/x ต่อ').filter(x => x.type === 'link').length, 1, 'bare url becomes a link')
eq(parseInline('(ดู https://a.dev/x)')[1], { type: 'link', text: 'https://a.dev/x', href: 'https://a.dev/x' },
  'a closing bracket is not swallowed into the url')
eq(parseInline('จบที่ https://a.dev/x.')[1].text, 'https://a.dev/x', 'a trailing full stop stays out of the link')
eq(parseInline('[ชื่อ](https://a.dev)')[0], { type: 'link', text: 'ชื่อ', href: 'https://a.dev' }, 'named link')
eq(parseInline('www.a.dev')[0].href, 'https://www.a.dev', 'www gets a scheme so the href works')
eq(parseInline('ไม่มีลิงก์').length, 1, 'plain text stays one segment')
eq(countLinks('a https://x.dev b [c](https://y.dev)'), 2, 'counts both link forms')
eq(countLinks(undefined), 0, 'no content, no links')

// -- incident SLA (utils/sla) --
const NOW = new Date(2026, 7, 9, 12, 0)          // 9 ส.ค. 2026 12:00
const at = (h: number) => new Date(NOW.getTime() + h * 3600000).toISOString()

eq(slaInfo({}, NOW).state, 'none', 'no SLA set cannot be judged')
eq(slaInfo({ SLAHours: 4, Created: at(-1) }, NOW).state, 'running', 'open and inside the window')
eq(Math.round(slaInfo({ SLAHours: 4, Created: at(-1) }, NOW).hoursLeft!), 3, 'three hours left of four')
eq(slaInfo({ SLAHours: 4, Created: at(-9) }, NOW).state, 'overdue', 'open past the deadline')
eq(Math.round(slaInfo({ SLAHours: 4, Created: at(-9) }, NOW).hoursLeft!), -5, 'five hours over')

eq(slaInfo({ SLAHours: 4, Created: at(-6), ResolvedDate: at(-3), Status: 'Resolved' }, NOW).state, 'met',
  'resolved three hours after opening, inside a four-hour SLA')
eq(slaInfo({ SLAHours: 4, Created: at(-10), ResolvedDate: at(-1), Status: 'Resolved' }, NOW).state, 'breached',
  'resolved nine hours after opening, outside a four-hour SLA')
eq(slaInfo({ SLAHours: 1, Created: at(-10), Status: 'Resolved' }, NOW).state, 'none',
  'resolved with no timestamp cannot be judged either way — no guessing in either direction')

// SLADue ที่บันทึกไว้ต้องชนะการคำนวณสด — SLAHours อาจถูกแก้ทีหลัง
eq(slaDue({ SLAHours: 1, Created: at(-10), SLADue: at(2) })!.getTime(), new Date(at(2)).getTime(),
  'a stored deadline wins over recomputing from hours')
eq(slaDue({ SLAHours: 0, Created: at(-1) }), null, 'zero hours is not an SLA')
eq(slaDue({ SLAHours: '4', Created: at(-1) }) !== null, true, 'hours arriving as text from SharePoint still work')
eq(slaDue({ SLAHours: 4 }), null, 'no start time, no deadline')

eq(computeSlaDue(2, at(0), NOW), at(2), 'deadline counts from when the case opened')
eq(computeSlaDue(null, at(0), NOW), null, 'no hours, no deadline')
eq(computeSlaDue(2, undefined, NOW), at(2), 'a new case counts from now')
eq(computeSlaDue(2, 'not-a-date', NOW), at(2), 'an unreadable start falls back to now instead of NaN')

eq([slaFailed('breached'), slaFailed('overdue'), slaFailed('met'), slaFailed('running')], [true, true, false, false],
  'both breached and still-overdue count as failing')
eq([slaJudged('running'), slaJudged('none'), slaJudged('met')], [false, false, true],
  'a running clock is not yet a verdict and must stay out of the percentage')

eq(slaCountdown(0.25), 'เหลือ 15 นาที', 'under an hour reads in minutes')
eq(slaCountdown(-5), 'เลยมา 5 ชม.', 'past due reads as elapsed')
eq(slaCountdown(72), 'เหลือ 3 วัน', 'long windows read in days')
eq(slaCountdown(null), '', 'nothing to count down')

// -- SLA ขององค์กรวัดที่ Incident --
const incs = [
  { id: 1, Created: iso(6, 1, 8), ResolvedDate: iso(6, 1, 10), Status: 'Resolved', SLAHours: 4, AssignedEmail: 'a@x.com' },   // ทัน
  { id: 2, Created: iso(6, 2, 8), ResolvedDate: iso(6, 3, 8),  Status: 'Resolved', SLAHours: 4, AssignedEmail: 'a@x.com' },   // เกิน
  { id: 3, Created: iso(6, 3, 8), Status: 'Open', SLAHours: 4, AssignedEmail: 'b@x.com' },                                    // ค้างจนเลยกำหนด
  { id: 4, Created: iso(6, 4, 8), ResolvedDate: iso(6, 4, 9), Status: 'Resolved', AssignedEmail: 'b@x.com' },                 // ไม่ได้กำหนด SLA
]
const sla = incidentSla(incs, lm, TODAY)
eq([sla.judged, sla.met, sla.failed], [3, 1, 2], 'one met, one breached, one still open past due')
eq(Math.round(sla.pct!), 33, 'only one of three judged incidents met its SLA')
eq(sla.setPct, 75, 'three of four incidents had an SLA set')
eq(incidentSla([], lm, TODAY).pct, null, 'no incidents means no percentage, not 100%')

// เคสที่ยังไม่ปิดและยังไม่เลยกำหนด ต้องไม่ถูกนับว่าผ่านหรือไม่ผ่าน
// ต้องใช้ช่วงที่ครอบวันนี้ — เคสในเดือนที่ผ่านไปแล้วยังไงก็เลยกำหนด ไม่มีทางเป็น running
const running = incidentSla(
  [{ id: 5, Created: new Date(TODAY.getTime() - 3600000).toISOString(), Status: 'Open', SLAHours: 8 }],
  presetRange('this-month', TODAY), TODAY)
eq([running.judged, running.running, running.pct], [0, 1, null],
  'a clock still ticking is not a verdict and stays out of the denominator')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
