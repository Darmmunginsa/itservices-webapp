// ตรวจเลขของหน้ารายงาน — ตัวเลขพวกนี้เอาไปใช้ตัดสินใจเรื่องคน จึงต้องพิสูจน์ได้ว่าคิดถูก
// โปรเจกต์นี้ยังไม่มี test runner จึงรันด้วย esbuild ตรง ๆ:
//   npm run check:report
import { formatCitation, formatBibliography } from '../src/utils/citation'
import { youtubeId, parseMediaLinks } from '../src/utils/youtube'
import { parseSections, parseInline, countLinks, referencedFiles } from '../src/utils/richNote'
import { slaInfo, slaDue, computeSlaDue, slaFailed, slaJudged, slaCountdown } from '../src/utils/sla'
import { buildDueRows, isUndated, isOverdue } from '../src/utils/homeDue'
import { buildTree, flatten, subtreeIds, pathOf, pathLabel, canMove, moveTargets, countsWithDescendants, ROOT } from '../src/utils/folderTree'
import { esc, articleSlug, articleFile, assetPath, noteHtml, articleHtml, indexHtml, searchIndex, articleIssues, isPublished, tagList, type KbArticle, type SiteMeta } from '../src/utils/kb'
import { splitQuoted, stripQuoted, hasQuoted, quotedLines } from '../src/utils/emailQuote'
import { sniffImage, browserCanRender } from '../src/utils/fileSniff'
import { renderClose, kbUrl, kbLinksBlock, kbBaseMissing, templatesFor, scopeOf, DEFAULT_TEMPLATES, type CloseTemplate } from '../src/utils/closeTemplate'
import { parseTemplate, parseJobData, emptyJobData, numberFigures, figuresOf, progressOf, slotKey, shotFileName,
  serializeTemplate, emptyTemplate, newDeviceKey, renumberTasks, nextTaskNo, parseTaskLines, parseInventoryLines, moveItem } from '../src/utils/pmReport'
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

// -- กล่องงานค้างบนหน้าหลัก (utils/homeDue) --
const hNow = new Date(2026, 7, 9, 12, 0)
const hAt = (days: number) => new Date(hNow.getTime() + days * 86400000).toISOString()

const dueRows = buildDueRows(
  [
    { id: 1, Title: 'ตั๋วเลยกำหนด',  Status: 'Open', DueDate: hAt(-3), AssignedEmail: 'me@x.com' },
    { id: 2, Title: 'ตั๋วไม่มีกำหนด', Status: 'Open', AssignedEmail: 'me@x.com' },
    { id: 3, Title: 'ตั๋วปิดแล้ว',    Status: 'Closed', DueDate: hAt(-1), AssignedEmail: 'me@x.com' },
    { id: 4, Title: 'ตั๋วที่ถูกเชิญ',  Status: 'Open', AssignedEmail: 'other@x.com' },
    { id: 5, Title: 'ตั๋วอีกไกล',     Status: 'Open', DueDate: hAt(30), AssignedEmail: 'me@x.com' },
  ],
  [{ id: 9, Title: 'งานไม่มีกำหนด', ProjectID: 7 }],
  [
    { id: 20, Title: 'ปัญหามี SLA',    Status: 'Open', Created: hAt(-1), SLAHours: 4 },
    { id: 21, Title: 'ปัญหาไม่มี SLA', Status: 'Open', Created: hAt(-1) },
    { id: 22, Title: 'ปัญหาปิดแล้ว',   Status: 'Resolved', Created: hAt(-2), SLAHours: 4 },
  ],
  { myEmail: 'me@x.com', invitedTicketIds: new Set([4]), now: hNow },
)
const titles = dueRows.map(r => r.title)

eq(titles.includes('ตั๋วปิดแล้ว'), false, 'closed tickets are gone')
eq(titles.includes('ปัญหาปิดแล้ว'), false, 'resolved incidents are gone')
eq(titles.includes('ตั๋วอีกไกล'), false, 'a due date a month out is not urgent yet')

// หัวใจของรอบนี้: ของที่ไม่มีกำหนดต้องไม่หาย
eq(titles.includes('ตั๋วไม่มีกำหนด'), true, 'a ticket with no due date still shows')
eq(titles.includes('งานไม่มีกำหนด'), true, 'a task with no due date still shows')
eq(titles.includes('ปัญหาไม่มี SLA'), true, 'an incident with no SLA still shows')
eq(titles.includes('ตั๋วที่ถูกเชิญ'), true, 'a ticket I was invited to shows even though it is not assigned to me')
eq(dueRows.find(r => r.title === 'ตั๋วที่ถูกเชิญ')!.invited, true, 'and it is marked as invited')
eq(dueRows.find(r => r.title === 'ตั๋วไม่มีกำหนด')!.invited, false, 'my own ticket is not marked invited')

// เรียง: มีกำหนดก่อน (ด่วนสุดบนสุด) แล้วค่อยของที่ไม่มีกำหนด
eq(titles[0], 'ตั๋วเลยกำหนด', 'the most overdue comes first')
eq(titles[1], 'ปัญหามี SLA', 'then the incident whose clock is running')
eq(dueRows.filter(isUndated).length, 4, 'four undated items land at the end')
eq(dueRows.slice(-4).every(isUndated), true, 'and they really are last')
eq(dueRows.filter(isUndated)[0].type, 'Incident', 'among undated, incidents come first')
eq(dueRows.filter(isOverdue).length, 2, 'the late ticket and the incident whose 4h SLA expired 20h ago are both overdue')

// เจ้าของงาน + ถูกเชิญ = งานเดียวกัน ต้องไม่ซ้ำ
const dup = buildDueRows(
  [{ id: 1, Title: 'ตั๋วเดียว', Status: 'Open', AssignedEmail: 'me@x.com' }], [], [],
  { myEmail: 'me@x.com', invitedTicketIds: new Set([1]), now: hNow })
eq(dup.length, 1, 'assigned and invited to the same ticket yields one row')
eq(dup[0].invited, false, 'and it reads as mine, not as an invite')

eq(buildDueRows([], [], [], { now: hNow }).length, 0, 'nothing to show when there is nothing open')

// -- ไฟล์แนบกลางเนื้อหา [[ชื่อไฟล์]] --
eq(parseInline('ดูรูป [[diagram.png]] ประกอบ')[1], { type: 'file', name: 'diagram.png' }, 'file token becomes a file segment')
eq(parseInline('[[ a.png ]]')[0], { type: 'file', name: 'a.png' }, 'spaces around the name are trimmed')
eq(parseInline('[[]]').length, 1, 'an empty token stays plain text, not a broken file')
eq(parseInline('ก่อน [[a.png]] กลาง [[b.pdf]] หลัง').filter(x => x.type === 'file').length, 2, 'several files in one line')
eq(parseInline('[[a.png]]')[0].type, 'file', 'a filename with a dot is not mistaken for a url')
eq(parseInline('[ชื่อ](https://a.dev) และ [[a.png]]').map(x => x.type), ['link', 'text', 'file'],
  'named links and file tokens coexist in order')
eq(countLinks('[[a.png]] https://a.dev'), 1, 'a file token is not counted as a link')

eq(referencedFiles('[[a.png]] x [[b.pdf]] y [[a.png]]'), ['a.png', 'b.pdf'], 'referenced files are listed once each')
eq(referencedFiles('ไม่มีไฟล์'), [], 'no tokens, no files')
eq(referencedFiles(undefined), [], 'no content, no files')

// -- เครื่องมือทำรายงาน PM (utils/pmReport) --
// วางไฟล์ config ของเครื่องมือเดิมมาได้ตรง ๆ
const CFG = JSON.stringify({
  template: 'Preventive Maintenance.docx',
  meta: { customer: '', site: '', pm_date: '', engineer: '', so_number: '' },
  version_history: [{ version: '1.0', date: '30-September-2025', change: 'Initial Document', author: 'Darm' }],
  inventory: [{ no: '01', serial: 'SGH123W04V', role: 'HPE DL380' }, { no: '02', serial: 'SGH123W04Z', role: 'HPE DL380' }],
  devices: [
    { key: 'srv1', name: 'HPE DL380 (SGH123W04V)', tasks: [{ no: '01', label: 'Event logs' }, { no: '02', name: 'LED check' }] },
    { key: 'sw1',  name: 'SAN Switch', tasks: [{ no: '01', name: 'Port status' }] },
  ],
})
const TPL = parseTemplate(CFG)
eq(TPL.title, 'Preventive Maintenance', 'title falls back to the template filename without .docx')
eq(TPL.devices.length, 2, 'devices parsed')
eq(TPL.devices[0].tasks[0].name, 'Event logs', 'a task using "label" instead of "name" still reads')
eq(TPL.inventory.length, 2, 'inventory parsed')
eq(TPL.versionHistory[0].author, 'Darm', 'version history parsed')

// ทนของที่กรอกไม่ครบ
const loose = parseTemplate(JSON.stringify({ devices: [{ name: 'A', tasks: [{ name: 'x' }, { name: 'y' }] }] }))
eq(loose.devices[0].key, 'A', 'a device with no key uses its name')
eq(loose.devices[0].tasks.map(t => t.no), ['01', '02'], 'tasks with no number get numbered in order')

// key ซ้ำต้องถูกแยก ไม่งั้นรูปของสองอุปกรณ์จะทับกัน
const dupKeys = parseTemplate(JSON.stringify({ devices: [{ key: 'k', name: 'A', tasks: [] }, { key: 'k', name: 'B', tasks: [] }] }))
eq(dupKeys.devices[0].key === dupKeys.devices[1].key, false, 'duplicate device keys are made unique')

let threw = ''
try { parseTemplate('{oops') } catch (e) { threw = (e as Error).message }
eq(threw.length > 0, true, 'unreadable JSON reports a reason instead of crashing silently')
try { parseTemplate('{}') } catch (e) { threw = (e as Error).message }
eq(threw.includes('อุปกรณ์'), true, 'a template with no devices says so')

// ── ตัวเลข Figure ──
const data = emptyJobData(TPL)
data.shots[slotKey('srv1', '01')] = [{ file: 'a.png', caption: 'A' }, { file: 'b.png', caption: 'B' }]
data.shots[slotKey('srv1', '02')] = [{ file: 'c.png', caption: 'C' }]
data.shots[slotKey('sw1', '01')] = [{ file: 'd.png', caption: 'D' }]
const figs = numberFigures(TPL, data)
eq(figs.map(f => f.figure), [1, 2, 3, 4], 'figures are numbered 1..N across the whole document')
eq(figs.map(f => f.caption), ['A', 'B', 'C', 'D'], 'in device order, then task order, then paste order')
eq(figuresOf(figs, 'sw1').map(f => f.figure), [4], 'the second device continues the numbering, it does not restart')
eq(numberFigures(TPL, emptyJobData(TPL)).length, 0, 'no shots, no figures')

// ── ความครบก่อนพิมพ์ ──
const prog = progressOf(TPL, data)
eq(prog.tasks, 3, 'three tasks in total')
eq(prog.answered, 0, 'nothing ticked yet')
eq(prog.shots, 4, 'four screenshots')
eq(prog.devicesNoShot, [], 'both devices have at least one shot')
eq(prog.devicesNoRec.length, 2, 'neither device has recommendations yet')
eq(prog.invBlank, 2, 'no inventory status chosen yet')
eq(prog.metaMissing.length, 5, 'every header field is still blank')

data.results[slotKey('srv1', '01')] = 'Pass'
data.recommendations['srv1'] = 'ปกติ'
data.invStatus['SGH123W04V'] = 'Normal'
data.meta.customer = 'ACME'
const prog2 = progressOf(TPL, data)
eq([prog2.answered, prog2.invBlank, prog2.devicesNoRec.length], [1, 1, 1], 'progress reflects what was filled in')
eq(prog2.metaMissing.includes('ลูกค้า'), false, 'a filled header field drops off the missing list')

const noShot = progressOf(TPL, emptyJobData(TPL))
eq(noShot.devicesNoShot.length, 2, 'devices with no screenshot are named so they cannot be forgotten')

// ── เก็บ/อ่านงานกลับ ──
eq(parseJobData(JSON.stringify(data), TPL).results, data.results, 'saved work reads back identically')
eq(parseJobData(undefined, TPL).shots, {}, 'a job never saved starts empty')
eq(parseJobData('{broken', TPL).shots, {}, 'corrupt saved data falls back to empty instead of breaking the page')

eq(shotFileName('srv 1', '01', 2) === shotFileName('srv 1', '01', 2), false, 'file names are unique per upload')
eq(/^shot_srv_1_01_2_/.test(shotFileName('srv 1', '01', 2)), true, 'and still say where they belong')

// -- ตัวสร้าง template แบบกรอกฟอร์ม --
// เก็บเป็น JSON รูปแบบเดิม → เขียนออกแล้วอ่านกลับต้องได้ของเดิม
const round = parseTemplate(serializeTemplate(TPL))
eq(round.title, TPL.title, 'round trip keeps the title')
eq(round.devices.map(d => d.key), TPL.devices.map(d => d.key), 'round trip keeps device keys')
eq(round.devices[0].tasks, TPL.devices[0].tasks, 'round trip keeps tasks')
eq(round.inventory, TPL.inventory, 'round trip keeps inventory')
eq(round.versionHistory, TPL.versionHistory, 'round trip keeps version history')

eq(emptyTemplate().devices.length, 0, 'a new template starts with no devices')

// key ต้องเป็น dev-N ไม่ผูกกับชื่อ — เปลี่ยนชื่ออุปกรณ์แล้วงานเก่าต้องยังหารูปเจอ
eq(newDeviceKey([]), 'dev-1', 'first device key')
eq(newDeviceKey([{ key: 'dev-1', name: 'a', tasks: [] }]), 'dev-2', 'next key skips the used one')
eq(newDeviceKey([{ key: 'dev-2', name: 'a', tasks: [] }]), 'dev-1', 'gaps are reused')

// เปลี่ยนชื่ออุปกรณ์ไม่กระทบที่อยู่ของรูป
const renamed = structuredClone(TPL)
renamed.devices[0].name = 'ชื่อใหม่'
eq(slotKey(renamed.devices[0].key, '01'), slotKey(TPL.devices[0].key, '01'),
  'renaming a device does not move where its screenshots live')

// วางรายการหลายบรรทัด
eq(parseTaskLines('a' + NL + 'b' + NL + 'c').map(t => t.no), ['01', '02', '03'], 'pasted lines get numbered')
eq(parseTaskLines('1. ตรวจ log' + NL + '02) ตรวจ LED' + NL + '- ตรวจพัดลม').map(t => t.name),
  ['ตรวจ log', 'ตรวจ LED', 'ตรวจพัดลม'], 'numbering and bullets copied from Word are stripped')
eq(parseTaskLines('a' + NL + NL + '  ' + NL + 'b').length, 2, 'blank lines dropped')
eq(parseTaskLines('').length, 0, 'nothing pasted, nothing added')

eq(nextTaskNo([]), '01', 'first task number')
eq(nextTaskNo([{ no: '01', name: 'x' }]), '02', 'next task number')
eq(renumberTasks([{ no: '07', name: 'a' }, { no: '03', name: 'b' }]).map(t => t.no), ['01', '02'],
  'renumbering fixes gaps after delete or reorder')

// วาง inventory หลายแถว
const inv = parseInventoryLines('SGH1, HPE DL380' + NL + 'EZL2 | SN3600B')
eq(inv.map(r => [r.no, r.serial, r.role]), [['01', 'SGH1', 'HPE DL380'], ['02', 'EZL2', 'SN3600B']],
  'comma and pipe both separate serial from role')
eq(parseInventoryLines('S1, a, b')[0].role, 'a, b', 'extra commas stay part of the role')
eq(parseInventoryLines('x', 5)[0].no, '05', 'numbering continues from the existing rows')

// สลับลำดับ
eq(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c'], 'move down')
eq(moveItem(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b'], 'move up')
eq(moveItem(['a', 'b'], 0, -1), ['a', 'b'], 'moving the first item up changes nothing')
eq(moveItem(['a', 'b'], 1, 1), ['a', 'b'], 'moving the last item down changes nothing')

// -- ตะกร้าเก็บแบบ sub-tree (utils/folderTree) --
//   Network            (1)
//     Firewall         (2)
//       Fortigate      (3)
//     Switch           (4)
//   Server             (5)
const FOLDERS = [
  { id: 1, Title: 'Network', ParentID: 0 },
  { id: 2, Title: 'Firewall', ParentID: 1 },
  { id: 3, Title: 'Fortigate', ParentID: 2 },
  { id: 4, Title: 'Switch', ParentID: 1 },
  { id: 5, Title: 'Server', ParentID: 0 },
]
const TREE = buildTree(FOLDERS)
eq(TREE.map(n => n.name), ['Network', 'Server'], 'two folders at the top')
eq(TREE[0].children.map(n => n.name), ['Firewall', 'Switch'], 'children sorted by name')
eq(TREE[0].children[0].children[0].name, 'Fortigate', 'nesting goes as deep as it is given')
eq([TREE[0].depth, TREE[0].children[0].depth, TREE[0].children[0].children[0].depth], [0, 1, 2], 'depth counts from the root')
eq(flatten(TREE).map(n => n.id), [1, 2, 3, 4, 5], 'flatten follows what is on screen, parent before children')

// กางเฉพาะบางอัน
eq(flatten(TREE, new Set([1])).map(n => n.id), [1, 2, 4, 5], 'a collapsed folder hides its children')
eq(flatten(TREE, new Set<number>()).map(n => n.id), [1, 5], 'everything collapsed shows only the roots')

eq(subtreeIds(TREE, 1), [1, 2, 3, 4], 'a subtree includes itself and every descendant')
eq(subtreeIds(TREE, 3), [3], 'a leaf is its own subtree')
eq(subtreeIds(TREE, 999), [], 'a folder that does not exist has no subtree')

eq(pathOf(TREE, 3).map(n => n.name), ['Network', 'Firewall', 'Fortigate'], 'path from the root down')
eq(pathLabel(TREE, 3), 'Network / Firewall / Fortigate', 'breadcrumb label')
eq(pathLabel(TREE, 5), 'Server', 'a top-level folder is its own path')

// ย้ายโฟลเดอร์ — ห้ามย้ายเข้าไปในตัวเองหรือลูกหลาน ไม่งั้นกิ่งจะหลุดหายทั้งกิ่ง
eq(canMove(TREE, 1, 5), true, 'moving a folder under a sibling is fine')
eq(canMove(TREE, 1, ROOT), true, 'moving to the top level is always allowed')
eq(canMove(TREE, 1, 1), false, 'a folder cannot be its own parent')
eq(canMove(TREE, 1, 2), false, 'a folder cannot move inside its own child')
eq(canMove(TREE, 1, 3), false, 'nor inside a deeper descendant')
eq(moveTargets(TREE, 1).map(n => n.id), [5], 'only folders outside its own subtree are offered')

// ข้อมูลพัง — ต้องยังใช้งานได้ ไม่ใช่จอขาว
const orphan = buildTree([{ id: 7, Title: 'Orphan', ParentID: 99 }])
eq(orphan.map(n => n.name), ['Orphan'], 'a folder whose parent was deleted floats up instead of vanishing')

const cycle = buildTree([
  { id: 1, Title: 'A', ParentID: 2 },
  { id: 2, Title: 'B', ParentID: 1 },
])
eq(cycle.length, 2, 'a cycle is broken by lifting both to the top rather than hanging')

eq(buildTree([]).length, 0, 'no folders, no tree')
eq(buildTree([{ id: 1, Title: '   ', ParentID: 0 }])[0].name, '(ไม่มีชื่อ)', 'a blank name still shows something clickable')

// นับของรวมลูกหลาน — โฟลเดอร์แม่ที่ลูกมีของ ต้องไม่ขึ้น 0
const direct = new Map([[2, 1], [3, 4], [5, 2]])
const totals = countsWithDescendants(TREE, direct)
eq(totals.get(3), 4, 'a leaf counts its own items')
eq(totals.get(2), 5, 'a parent adds its children')
eq(totals.get(1), 5, 'and the count carries all the way up')
eq(totals.get(4), 0, 'an empty folder really is zero')
eq(totals.get(5), 2, 'siblings are counted separately')

// -- คลังความรู้สาธารณะ (utils/kb) --
const SITE: SiteMeta = { siteTitle: 'iT Services Knowledge', org: 'iT Services', contact: 'support@itservices.co.th', homeUrl: 'https://itservices.co.th' }
const ART: KbArticle = {
  id: 7,
  ArticleCode: 'ITS000123',
  Title: 'พิมพ์ในช่องค้นหาไม่ได้เมื่อเผยแพร่ Explorer เป็น App',
  Product: 'Citrix VDA',
  Tags: 'Citrix, Explorer, Search',
  ArticleStatus: 'Published',
  Summary: 'พิมพ์ในช่องค้นหาไม่ได้',
  Resolution: ['## ตรวจ Windows patch', '- ยืนยันว่า KB5014021 ติดตั้งแล้ว', 'ดูรายละเอียดที่ https://example.com/kb', '[[reg.png]]'].join(NL),
  Cause: 'บั๊กของ MS',
  Modified: '2026-08-17T10:00:00Z',
  Created: '2026-03-31T04:05:00Z',
  AttachmentFiles: [{ FileName: 'reg.png' }],
}

// ลิงก์ต้องยึดรหัสบทความ ไม่ใช่ชื่อเรื่อง — ลิงก์ที่ส่งลูกค้าไปแล้วต้องใช้ได้ตลอด
eq(articleSlug(ART), 'its000123', 'slug comes from the article code')
eq(articleFile(ART), 'its000123.html', 'file name follows the slug')
eq(articleSlug({ ...ART, Title: 'เปลี่ยนชื่อเรื่องใหม่หมด' }), 'its000123', 'renaming the title does not change the link')
eq(articleSlug({ id: 9, Title: 'x' }), 'article-9', 'no code falls back to the id, still stable')
eq(articleSlug({ id: 9, Title: 'x', ArticleCode: 'ITS/123 456' }), 'its123456', 'unsafe characters are stripped from the file name')

eq(assetPath(ART, 'reg.png'), 'assets/its000123/reg.png', 'images live under their own article folder')
eq(assetPath(ART, 'a b?.png'), 'assets/its000123/a_b_.png', 'unsafe image names are made safe')

// เนื้อหาผู้ใช้ถูกเผยแพร่สาธารณะ — ต้องหนี HTML ทุกจุด
eq(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;', 'tags are escaped')
eq(esc('a & b "c" \'d\''), 'a &amp; b &quot;c&quot; &#39;d&#39;', 'ampersand and quotes are escaped')
const evil = articleHtml({ ...ART, Title: '<img src=x onerror=alert(1)>' }, SITE)
eq(evil.indexOf('<img src=x onerror') === -1, true, 'a script-ish title cannot break out into real markup')
eq(evil.indexOf('&lt;img src=x onerror') > -1, true, 'it appears as text instead')

// เนื้อหา → HTML
const files = new Set(['reg.png'])
const h = noteHtml(ART.Resolution, ART, files)
eq(h.indexOf('<h3>ตรวจ Windows patch</h3>') > -1, true, 'headings become h3')
eq(h.indexOf('<ul><li>') > -1, true, 'dashes become a list')
eq(h.indexOf('href="https://example.com/kb"') > -1, true, 'urls become links')
eq(h.indexOf('src="assets/its000123/reg.png"') > -1, true, 'attached images point at the exported file')
eq(noteHtml('[[missing.png]]', ART, files), '', 'a reference to an unattached file is dropped, not shown as a warning to the public')
eq(noteHtml('', ART, files), '', 'empty content produces nothing')
eq(noteHtml(undefined, ART, files), '', 'missing content produces nothing')

// หน้าบทความ
const page = articleHtml(ART, SITE)
eq(page.startsWith('<!doctype html>'), true, 'a complete standalone page')
eq(page.indexOf('ITS000123') > -1, true, 'the code is shown to the reader')
eq(page.indexOf('อาการ / รายละเอียด') > -1, true, 'details section')
eq(page.indexOf('วิธีแก้ไข') > -1, true, 'resolution section')
eq(page.indexOf('สาเหตุ') > -1, true, 'cause section')
eq(page.indexOf('style.css') > -1, true, 'links the shared stylesheet')
eq(articleHtml({ id: 1, Title: 'ว่าง' }, SITE).indexOf('วิธีแก้ไข'), -1, 'a section with no content is left out entirely')

// หน้ารวม + ค้นหา
const idx = indexHtml([ART], SITE)
eq(idx.indexOf('its000123.html') > -1, true, 'the index links to the article')
eq(idx.indexOf('search.json') > -1, true, 'the reader-side search loads its data file')
const si = searchIndex([ART])
eq(si[0].f, 'its000123.html', 'search entries point at the file')
eq(si[0].t, si[0].t.toLowerCase(), 'search text is lowercased once at build time')
eq(si[0].t.indexOf('citrix') > -1, true, 'tags are searchable')
eq(si[0].t.indexOf('kb5014021') > -1, true, 'the resolution body is searchable')

// ตรวจก่อนเผยแพร่
eq(articleIssues(ART), [], 'a complete article has nothing outstanding')
eq(articleIssues({ id: 1, Title: '' }).length, 4, 'an empty article lists everything missing')
eq(articleIssues({ id: 1, Title: 'a', ArticleCode: 'X', Summary: 's', Resolution: 'r' }), [], 'cause is optional')

eq(isPublished(ART), true, 'published')
eq(isPublished({ ...ART, ArticleStatus: 'Draft' }), false, 'drafts are not published')
eq(isPublished({ id: 1, Title: 'x' }), false, 'no status means not published')
eq(tagList(ART), ['Citrix', 'Explorer', 'Search'], 'tags split on commas')

// -- ข้อความตอบกลับตอนปิดงาน (utils/closeTemplate) --
const BODY = ['เรียน คุณ{{customer_name}}', '', '{{ticket_number}} แก้ไขแล้ว', '{{resolution}}', '', 'อ่านเพิ่มเติม', '{{kb_links}}', '', '{{agent_name}}'].join(NL)

const full = renderClose(BODY, {
  customer_name: 'สมชาย', ticket_number: 'HD-001', resolution: 'รีสตาร์ต service',
  kb_links: '- วิธีแก้' + NL + '  https://x.dev/its1.html', agent_name: 'ดาร์ม',
})
eq(full.indexOf('เรียน คุณสมชาย') > -1, true, 'placeholders are filled')
eq(full.indexOf('{{') === -1, true, 'no placeholder is left behind')
eq(full.indexOf('อ่านเพิ่มเติม') > -1, true, 'the lead-in stays when links exist')

// ไม่ได้แนบบทความ — บรรทัดลิงก์และหัวข้อนำต้องหายไปด้วย ไม่ใช่ค้างเป็น "อ่านเพิ่มเติม:" ลอย ๆ
const noKb = renderClose(BODY, { customer_name: 'สมชาย', ticket_number: 'HD-001', resolution: 'รีสตาร์ต', agent_name: 'ดาร์ม' })
eq(noKb.indexOf('{{kb_links}}') === -1, true, 'the empty link placeholder is removed')
eq(noKb.indexOf('อ่านเพิ่มเติม') > -1, true, 'a plain lead-in line is left for the writer to see')
eq(/\n\n\n/.test(noKb), false, 'no triple blank line is left where the block was cut')
eq(noKb.startsWith('เรียน'), true, 'no leading blank lines')
eq(noKb.endsWith('ดาร์ม'), true, 'no trailing blank lines')

eq(renderClose('- {{kb_links}}', {}), '', 'a bullet whose only content is an empty variable disappears entirely')
eq(renderClose('{{a}}: {{b}}', {}), '', 'a line of only empty variables and punctuation disappears')
eq(renderClose('คงที่ {{missing}}', {}), 'คงที่', 'text next to an empty variable is kept')
eq(renderClose(undefined, {}), '', 'no template, no output')
eq(renderClose('ไม่มีตัวแปร', {}), 'ไม่มีตัวแปร', 'a template without variables passes through')

// ลิงก์บทความ — ต้องตรงกับชื่อไฟล์ที่หน้า "สร้างเว็บ" ปล่อยออกมา
const A = { id: 5, code: 'ITS000123', title: 'พิมพ์ค้นหาไม่ได้' }
eq(kbUrl('https://itservices.co.th/kb', A), 'https://itservices.co.th/kb/its000123.html', 'public link matches the exported file name')
eq(kbUrl('https://itservices.co.th/kb/', A), 'https://itservices.co.th/kb/its000123.html', 'a trailing slash does not double up')
eq(kbUrl('https://x.dev', { id: 9, code: '', title: 't' }), 'https://x.dev/article-9.html', 'no code falls back to the id, same as the exporter')
eq(kbUrl('', A), 'its000123.html', 'no base url still yields the file name')

eq(kbLinksBlock([], 'https://x.dev'), '', 'nothing selected, nothing rendered')
eq(kbLinksBlock([A], 'https://x.dev'), '- พิมพ์ค้นหาไม่ได้' + NL + '  https://x.dev/its000123.html', 'one link with its title above it')
eq(kbLinksBlock([A, { id: 6, code: 'ITS000124', title: 'อีกเรื่อง' }], 'https://x.dev').split(NL).length, 4, 'two links use two lines each')

eq(kbBaseMissing(''), true, 'an unset base url is flagged before links go out')
eq(kbBaseMissing('  '), true, 'whitespace counts as unset')
eq(kbBaseMissing('https://x.dev'), false, 'a set base url is fine')

// เลือก template ตามชนิดงาน
const TPLS: CloseTemplate[] = [
  { id: 1, Title: 'ทั้งคู่', AppliesTo: 'Both' },
  { id: 2, Title: 'เฉพาะ Ticket', AppliesTo: 'Ticket' },
  { id: 3, Title: 'เฉพาะ Incident', AppliesTo: 'Incident' },
  { id: 4, Title: 'ปิดใช้งาน', AppliesTo: 'Both', IsActive: false },
  { id: 5, Title: 'ไม่ระบุ' },
]
eq(templatesFor(TPLS, 'Ticket').map(t => t.id), [1, 2, 5], 'ticket sees Both, Ticket and unspecified')
eq(templatesFor(TPLS, 'Incident').map(t => t.id), [1, 3, 5], 'incident sees Both, Incident and unspecified')
eq(templatesFor(TPLS, 'Ticket').some(t => t.id === 4), false, 'a disabled template is never offered')
eq(scopeOf({ id: 1, Title: 'x' }), 'Both', 'no scope means both')
eq(scopeOf({ id: 1, Title: 'x', AppliesTo: 'อะไรก็ไม่รู้' }), 'Both', 'an unrecognised scope falls back to both')

// ประเภทที่ตรงกันขึ้นก่อน แต่ตัวอื่นยังเลือกได้
const CATS: CloseTemplate[] = [
  { id: 1, Title: 'ทั่วไป', AppliesTo: 'Both' },
  { id: 2, Title: 'เครือข่าย', AppliesTo: 'Both', Category: 'Network' },
]
eq(templatesFor(CATS, 'Ticket', 'Network').map(t => t.id), [2, 1], 'a matching category is offered first')
eq(templatesFor(CATS, 'Ticket', 'Network').length, 2, 'and the rest are still available')

// template สำเร็จรูปต้องใช้ได้จริง
eq(DEFAULT_TEMPLATES.length > 0, true, 'ships with starter templates')
eq(DEFAULT_TEMPLATES.every(t => t.Body.indexOf('{{resolution}}') > -1), true, 'each starter includes the resolution')
eq(renderClose(DEFAULT_TEMPLATES[0].Body, { customer_name: 'ก', ticket_number: 'HD-1', title: 'x', resolution: 'y', agent_name: 'z' }).indexOf('{{') === -1,
  true, 'a starter template with no KB links still renders clean')


// -- ตัดเนื้อเมลเก่าที่ติดมากับการตอบกลับ (utils/emailQuote) --
const OUTLOOK = [
  'ได้เลยครับ ผมลองแล้วใช้ได้',
  '',
  'From: support@itservices.co.th',
  'Sent: Monday, March 3, 2026 10:00 AM',
  'To: somchai@acme.co.th',
  'Subject: RE: [HD-00123] เข้า VPN ไม่ได้',
  '',
  'เรียนคุณสมชาย ทางทีมได้แก้ไขแล้ว',
].join(NL)
eq(stripQuoted(OUTLOOK), 'ได้เลยครับ ผมลองแล้วใช้ได้', 'Outlook reply keeps only the new text')
eq(quotedLines(OUTLOOK) > 3, true, 'the old mail is kept aside, not thrown away')
eq(splitQuoted(OUTLOOK).quoted.indexOf('เรียนคุณสมชาย') > -1, true, 'the quoted part still holds the old body in full')

const GMAIL = ['ขอบคุณครับ', '', 'On Mon, 3 Mar 2026 at 10:00, IT Services <support@itservices.co.th> wrote:',
  '> เรียนคุณสมชาย', '> ทางทีมได้แก้ไขแล้ว'].join(NL)
eq(stripQuoted(GMAIL), 'ขอบคุณครับ', 'Gmail-style "On ... wrote:" is cut')

const ORIG = ['ยังไม่ได้ครับ', '', '-----Original Message-----', 'From: x', 'Sent: y'].join(NL)
eq(stripQuoted(ORIG), 'ยังไม่ได้ครับ', 'the Original Message separator is cut')

const THAI = ['รับทราบครับ', '', 'จาก: support@itservices.co.th', 'ส่ง: 3 มีนาคม 2569',
  'ถึง: somchai@acme.co.th', 'เรื่อง: RE: HD-00123', '', 'เนื้อความเก่า'].join(NL)
eq(stripQuoted(THAI), 'รับทราบครับ', 'Thai Outlook headers are cut too')

// คอมเมนต์ที่ระบบเราเขียนเอง ขึ้นต้น "จาก: ชื่อ (เวลา)" — ห้ามโดนตัด
const RELAY = ['จาก: สมชาย ใจดี (3 มี.ค. 2569 10:00)', '', 'ยังเข้าไม่ได้เลยครับ'].join(NL)
eq(hasQuoted(RELAY), false, 'our own relay header is not mistaken for a quoted mail')
eq(stripQuoted(RELAY), RELAY, 'a relayed comment survives whole')

// "From:" ลอย ๆ ที่ไม่มี header อื่นตาม ไม่ใช่เมลเก่า
eq(hasQuoted(['ลองดูแล้ว', 'From: the docs it says X'].join(NL)), false,
  'a bare From: line without mail headers is left alone')

// ข้อความธรรมดาไม่ควรถูกแตะ
eq(hasQuoted('แก้เรียบร้อยแล้วครับ'), false, 'a plain comment has nothing to fold')
eq(stripQuoted(''), '', 'empty text is safe')
eq(stripQuoted(undefined), '', 'undefined is safe')

// ยกคำพูดบรรทัดเดียวไม่ใช่เมลเก่า — แต่หลายบรรทัดติดกันใช่
eq(hasQuoted(['ตามที่คุณบอกว่า', '> ปิดเครื่องแล้วเปิดใหม่', 'ผมทำแล้วครับ'].join(NL)), false,
  'a single quoted line is a quotation, not a mail thread')
eq(hasQuoted(['ตามนี้ครับ', '> บรรทัดหนึ่ง', '> บรรทัดสอง'].join(NL)), true,
  'a run of quoted lines is a mail thread')

// ถ้าตัดแล้วไม่เหลืออะไร แปลว่าอ่านผิด — ต้องคืนของเดิม ไม่ใช่คืนค่าว่าง
const ALLQUOTE = ['', 'From: x', 'Sent: y', 'เนื้อความ'].join(NL)
eq(stripQuoted(ALLQUOTE).length > 0, true, 'a message that is nothing but quotes still shows something')



// -- ดูว่าไฟล์แนบเป็นรูปหรือไม่ จากไบต์จริง (utils/fileSniff) --
// ชื่อไฟล์เชื่อไม่ได้ และ SharePoint คืน Content-Type เป็น octet-stream เกือบทุกไฟล์
const bytes = (...n: number[]) => new Uint8Array(n)
const strBytes = (s: string) => new Uint8Array([...s].map(c => c.charCodeAt(0)))

eq(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10)), 'image/png', 'PNG is detected')
eq(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg', 'JPEG is detected')
// Outlook ตั้งชื่อรูปที่ paste มาเป็น .jfif — เนื้อในเป็น JPEG ธรรมดา
eq(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe1)), 'image/jpeg', 'a .jfif from Outlook is just JPEG inside')
eq(sniffImage(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), 'image/gif', 'GIF is detected')
eq(sniffImage(bytes(0x42, 0x4d, 0, 0)), 'image/bmp', 'BMP is detected')
eq(sniffImage(strBytes('RIFF____WEBPVP8 ')), 'image/webp', 'WEBP is detected')
eq(sniffImage(strBytes('....ftypheic....')), 'image/heic', 'an iPhone .heic is detected')
eq(sniffImage(strBytes('....ftypavif....')), 'image/avif', 'AVIF is detected')
eq(sniffImage(strBytes('<svg xmlns="http://')), 'image/svg+xml', 'SVG is detected')

// ที่ต้องไม่ใช่รูป
eq(sniffImage(strBytes('%PDF-1.7')), null, 'a PDF is not an image')
eq(sniffImage(bytes(0x50, 0x4b, 3, 4)), null, 'a zip/docx is not an image')
eq(sniffImage(strBytes('เรียนคุณสมชาย')), null, 'plain text is not an image')
eq(sniffImage(bytes(1, 2)), null, 'a file too short to judge is not an image')
eq(sniffImage(bytes()), null, 'an empty file is safe')

// เบราว์เซอร์วาดไม่ได้ ต้องรู้ล่วงหน้า ไม่ใช่ปล่อยให้กรอบรูปพัง
eq(browserCanRender('image/heic'), false, 'HEIC cannot be drawn by the browser')
eq(browserCanRender('image/png'), true, 'PNG can be drawn')
eq(browserCanRender('image/webp'), true, 'WEBP can be drawn')


console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
