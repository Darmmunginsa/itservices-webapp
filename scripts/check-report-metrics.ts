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
import { sniffImage, sniffFile, browserCanRender } from '../src/utils/fileSniff'
import { previewKind, resolveMime, mimeFromName, extOf, pickFiles, pastedName, dedupeName, prettySize, TEXT_PREVIEW_LIMIT, MAX_UPLOAD_BYTES } from '../src/utils/filePreview'
import { mergePeople, isRealPerson, personEmail } from '../src/utils/people'
import { buildGroups, customersOf, toggleGroup, groupFullySelected, customerOptions, availableContacts } from '../src/utils/customerGroups'
import { incidentRecipients, incidentVars, justResolved, justAssigned } from '../src/utils/incidentMail'
import { needsAck, buildAckInbox, ackVars } from '../src/utils/ackInbox'
import { assignFields, ackResetFields, ackOnCreate } from '../src/utils/ackInbox'
import { reporterFields, reporterLine, reporterWatchers, isBlankReporter } from '../src/utils/reporter'
import { parseKeys, sameKeys, dirtyEmails, groupPages } from '../src/utils/pagePerms'
import { findTemplate, isOn, templateProblem, renderTemplate, renderSubject, escapeHtml, textToHtml, html, isHtmlVar, placeholdersOf, appLink, mailFailText, EVENT_VARS, KNOWN_EVENTS } from '../src/utils/emailTemplate'
import { idleStatus, countdown, shouldBump, readLastActivity, IDLE_LIMIT_MS, WARN_BEFORE_MS } from '../src/utils/idleSession'
import { membersOf, buildRoleMatrix, roleTally, filterPeople, projectsWithoutManager, roleRank, UNASSIGNED_ROLE } from '../src/utils/projectRoles'
import { ownerMissingFromTeam, OWNER_DEFAULT_ROLE } from '../src/utils/projectRoles'
import { buildRoleGrid } from '../src/utils/projectRoles'
import { ticketRows, incidentRows, taskRows, workStats, filterWork, statusOptions, priorityOptions, workLink, isDone, submittedByMe, submittedSummary, progressLabel } from '../src/utils/dashboardWork'
import { splitRich, joinRich, isRich, RICH_MARK, isAllowedTag, isDropWhole, isAllowedAttr, safeHref, safeImgSrc, htmlToPlain, commentPlain, plainSnippet, hasBlockMarkup, MAX_INLINE_IMAGE } from '../src/utils/richComment'
import { latestActivity, hasUpdate, readSeen, markSeen, baselineUnseen, countUpdated, activityLabel } from '../src/utils/projectActivity'
import { buildOrgTree, subtreeSize, branchOptions, pathToRoot, visibleRoots, departmentOptions, departmentView, departmentTree } from '../src/utils/orgBranch'
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



// -- รวมรายชื่อทีมซัพพอร์ต + คนทั้งองค์กร (utils/people) --
const AGENTS = [
  { Title: 'สมชาย ใจดี', EmailText: 'somchai@itservices.co.th', SupportGroup: 'Network' },
  { Title: 'สุดา รักงาน', EmailText: 'suda@itservices.co.th' },
]
const DIR = [
  { displayName: 'สมชาย ใจดี', mail: 'Somchai@itservices.co.th', department: 'IT' },
  { displayName: 'อารีย์ บัญชี', mail: 'aree@itservices.co.th', department: 'บัญชี' },
  { displayName: 'ห้องประชุมใหญ่', mail: 'room-a@itservices.co.th', userType: 'Member' },
  { displayName: 'ลูกค้าภายนอก', mail: 'guest@acme.co.th', userType: 'Guest' },
  { displayName: 'No Reply', mail: 'noreply@itservices.co.th' },
  { displayName: 'ไม่มีเมล' },
]

const merged = mergePeople(AGENTS, DIR)
eq(merged.slice(0, 2).every(o => o.isAgent), true, 'support team comes first')
eq(merged[0].label, 'สมชาย ใจดี · Network', 'an agent keeps its support group in the label')
eq(merged.filter(o => o.value.toLowerCase() === 'somchai@itservices.co.th').length, 1,
  'the same person listed in both sources appears once')
eq(merged.some(o => o.value === 'aree@itservices.co.th'), true, 'someone outside the support team is included')
eq(merged.find(o => o.value === 'aree@itservices.co.th')?.label, 'อารีย์ บัญชี · บัญชี',
  'the department is shown so people with similar names can be told apart')

// ที่ต้องไม่โผล่
eq(merged.some(o => o.value === 'guest@acme.co.th'), false, 'a guest is not an internal attendee')
eq(merged.some(o => o.value === 'noreply@itservices.co.th'), false, 'a no-reply mailbox is not a person')
eq(merged.length, 4, 'accounts with no usable mail are dropped')

eq(isRealPerson({ mail: 'a@b.com' }), true, 'a plain mailbox is a person')
eq(isRealPerson({ userPrincipalName: 'a_acme.co.th#EXT#@its.onmicrosoft.com' }), false,
  'an external UPN is excluded even without userType')
eq(isRealPerson({ displayName: 'ไม่มีเมล' }), false, 'no address means it cannot be invited')
eq(personEmail({ userPrincipalName: 'x@y.com' }), 'x@y.com', 'the UPN is used when mail is empty')

// เรียงชื่อคนนอกทีมตามตัวอักษร เพื่อให้หาเจอ
const sorted = mergePeople([], [
  { displayName: 'ขวัญ', mail: 'k@x.com' },
  { displayName: 'กมล', mail: 'g@x.com' },
])
eq(sorted.map(o => o.label).join(','), 'กมล,ขวัญ', 'the rest are sorted by name')

eq(mergePeople([], []).length, 0, 'no sources means no options, not a crash')



// -- กลุ่มลูกค้าตามโครงการ (utils/customerGroups) --
const PROJ = [
  { id: 1, Title: '#VDI' },
  { id: 2, Title: '#Backup' },
  { id: 3, Title: '#ยังไม่มีใคร' },
]
const MEMBERS = [
  { id: 1, Title: 'สมชาย', CustomerEmail: 'somchai@acme.co.th', ProjectID: 1, Company: 'ACME' },
  { id: 2, Title: 'อารีย์', CustomerEmail: 'aree@acme.co.th', ProjectID: 1 },
  { id: 3, Title: 'สมชาย ซ้ำ', CustomerEmail: 'SOMCHAI@acme.co.th', ProjectID: 1 },
  { id: 4, Title: 'กมล', CustomerEmail: 'kamol@beta.co.th', ProjectID: 2 },
  { id: 5, Title: 'ไม่มีเมล', ProjectID: 1 },
]

const groups = buildGroups(PROJ, MEMBERS)
eq(groups.length, 2, 'a project with nobody in it is not offered as a group')
const vdi = groups.find(g => g.projectId === 1)!
eq(vdi.emails.length, 2, 'the same address twice counts once')
eq(vdi.label, '#VDI · 2 คน', 'the group says how many it will add')
eq(customersOf(MEMBERS, 1).some(m => !m.CustomerEmail), false, 'a contact with no address is not in the group')

// กดกลุ่ม
eq(toggleGroup(vdi, []).length, 2, 'picking a group adds everyone in it')
eq(groupFullySelected(vdi, ['somchai@acme.co.th', 'aree@acme.co.th']), true, 'a fully picked group knows it')
eq(groupFullySelected(vdi, ['somchai@acme.co.th']), false, 'a partly picked group is not full')
// เลือกไว้บางคนแล้วกดกลุ่ม ต้องเติมให้ครบ ไม่ใช่เพิ่มซ้ำ
eq(toggleGroup(vdi, ['somchai@acme.co.th']).length, 2, 'picking a partly selected group tops it up without duplicating')
// กดซ้ำตอนครบแล้ว = เอาออก แต่ต้องไม่แตะคนที่เลือกเองนอกกลุ่ม
const mixed = toggleGroup(vdi, ['somchai@acme.co.th', 'aree@acme.co.th', 'outsider@x.com'])
eq(mixed.join(','), 'outsider@x.com', 'removing a group leaves individually picked people alone')
// ตัวพิมพ์เล็กใหญ่ต้องไม่ทำให้เชิญซ้ำ
eq(toggleGroup(vdi, ['SOMCHAI@acme.co.th']).length, 2, 'case differences do not create a duplicate invite')

// รายชื่อรายคนต้องมีผู้ติดต่อในโครงการด้วย ไม่งั้นเลือกกลุ่มแล้วเห็นอีเมลลอย ๆ ไม่มีชื่อ
const CONTRACTS = [{ Title: 'บริษัท ก', Company: 'ACME', CustomerEmail: 'contract@acme.co.th' }]
const opts = customerOptions(CONTRACTS, MEMBERS)
eq(opts.some(o => o.value === 'somchai@acme.co.th'), true, 'a project contact appears in the individual list')
eq(opts.filter(o => o.value.toLowerCase() === 'somchai@acme.co.th').length, 1, 'the individual list has no duplicates')
eq(opts.find(o => o.value === 'somchai@acme.co.th')?.label, 'สมชาย (ACME)', 'the company is shown when known')
eq(opts.find(o => o.value === 'aree@acme.co.th')?.label, 'อารีย์', 'no company means just the name')
eq(opts[0].value, 'contract@acme.co.th', 'contract customers keep their place at the top')
eq(customerOptions([], []).length, 0, 'no data means no options, not a crash')



// -- เลือกลูกค้าจากทะเบียนเข้าโครงการ (availableContacts) --
const REG = [
  { id: 1, Title: 'สมชาย', CustomerEmail: 'somchai@acme.co.th', Company: 'ACME' },
  { id: 2, Title: 'กมล', CustomerEmail: 'kamol@beta.co.th', Company: 'BETA' },
  { id: 3, Title: 'ไม่มีเมล', CustomerEmail: '' },
]
const IN_PROJECT = [{ id: 9, Title: 'สมชาย', CustomerEmail: 'SOMCHAI@acme.co.th', ProjectID: 1 }]

eq(availableContacts(REG, IN_PROJECT).length, 1, 'someone already in the project is not offered again')
eq(availableContacts(REG, IN_PROJECT)[0].Title, 'กมล', 'the remaining contact is offered')
eq(availableContacts(REG, []).length, 2, 'a contact with no address is never offered')
eq(availableContacts(REG, [], 'beta').length, 1, 'search matches the company')
eq(availableContacts(REG, [], 'KAMOL').length, 1, 'search ignores letter case')
eq(availableContacts(REG, [], 'acme.co.th').length, 1, 'search matches the address')
eq(availableContacts(REG, [], 'ไม่มีอยู่จริง').length, 0, 'a search with no match returns nothing, not everything')



// -- เมลแจ้งเตือน Incident (utils/incidentMail) --
const INC = {
  title: 'VDI เข้าไม่ได้', severity: 'High', status: 'Open',
  assignedEmail: 'agent@its.co.th', assignedName: 'สมชาย',
  requesterEmail: 'user@acme.co.th',
  watchers: ['owner@its.co.th', undefined, ''],
  projectName: '#VDI', projectId: 7, slaHours: 4,
  baseUrl: 'https://itservices.co.th/helpdesk/',
}

const r1 = incidentRecipients(INC)
eq(r1.to.join(','), 'agent@its.co.th', 'the person who must act is the To')
eq(r1.cc.join(','), 'user@acme.co.th,owner@its.co.th', 'the reporter and watchers are CC')

// คนกดเองไม่ต้องได้เมลบอกสิ่งที่ตัวเองเพิ่งทำ
const r2 = incidentRecipients({ ...INC, actorEmail: 'AGENT@its.co.th' })
eq(r2.to.join(','), 'user@acme.co.th', 'assigning to yourself promotes the reporter to To')
eq(r2.cc.join(','), 'owner@its.co.th', 'the actor is dropped everywhere, not just from To')

// ยังไม่มีผู้รับผิดชอบ ต้องไม่กลายเป็นเมลที่ไม่มี To (ส่งไม่ออก)
const r3 = incidentRecipients({ ...INC, assignedEmail: '' })
eq(r3.to.length, 1, 'with nobody assigned the mail still has a To')
eq(r3.to[0], 'user@acme.co.th', 'the reporter is used as To instead')

eq(incidentRecipients({ title: 'x', severity: '', status: '' }).to.length, 0,
  'no addresses at all means no mail, not a crash')
eq(incidentRecipients({ ...INC, requesterEmail: 'AGENT@its.co.th' }).cc.join(','), 'owner@its.co.th',
  'the same person listed twice is mailed once')

const iv = incidentVars(INC)
eq(iv.incident_title, 'VDI เข้าไม่ได้', 'the title is available to the template')
eq(iv.sla_hours, '4 ชั่วโมง', 'SLA reads as hours')
eq(iv.incident_status, iv.status, 'the old template name for status still fills in — real templates were pasted with it')
eq(incidentVars({ ...INC, slaHours: 24 }).sla_hours, '1 วัน', 'a whole day reads as days')
eq(incidentVars({ ...INC, slaHours: null }).sla_hours, 'ไม่ได้กำหนด',
  'no SLA reads as words, so the template does not render a blank cell')
eq(iv.link, 'https://itservices.co.th/helpdesk/#/projects/7', 'the link opens the project')
eq(incidentVars({ title: 'x', severity: '', status: '' }).assigned_name, '-',
  'an unassigned incident does not print "undefined"')
eq(Object.values(incidentVars({ title: 'x', severity: '', status: '' })).every(x => typeof x === 'string' || isHtmlVar(x)),
  true, 'every variable is text or marked html so nothing renders as undefined')
// คำอธิบายเป็นข้อความที่คนพิมพ์ — ต้องหนีอักขระ และขึ้นบรรทัดใหม่ต้องอยู่รอดในเมล
const ivDesc = incidentVars({ ...INC, description: 'เซิร์ฟเวอร์ <VDI-01>\nล่มตอน 9 โมง' }).description
eq(isHtmlVar(ivDesc), true, 'the description is delivered as html so its line breaks survive')
eq(isHtmlVar(ivDesc) && ivDesc.__html, 'เซิร์ฟเวอร์ &lt;VDI-01&gt;<br>ล่มตอน 9 โมง',
  'angle brackets in a description are escaped, not injected into the mail')

// ส่งเมลเฉพาะตอนที่สถานะเปลี่ยนจริง
eq(justResolved('Resolved', 'Open'), true, 'closing a live incident sends the mail')
eq(justResolved('Resolved', 'Resolved'), false, 're-saving a closed incident does not send again')
eq(justResolved('Closed', 'Resolved'), false, 'moving between two closed states does not resend')
eq(justResolved('In Progress', 'Open'), false, 'an ordinary status change is not a close')
eq(justAssigned('a@b.com', ''), true, 'a first assignment sends the mail')
eq(justAssigned('a@b.com', 'A@B.com'), false, 'saving with the same person does not resend')
eq(justAssigned('', 'a@b.com'), false, 'clearing the assignee is not an assignment')



// -- กล่องรอรับงาน (utils/ackInbox) --
const ME = 'me@its.co.th'
const mk = (o: Record<string, unknown>) => ({ id: 1, Title: 'งาน', AssignedEmail: ME, ...o })

eq(needsAck(mk({}), 'Ticket', ME), true, 'work assigned to me and not yet accepted is waiting')
eq(needsAck(mk({ AssignedEmail: 'other@x.com' }), 'Ticket', ME), false, "someone else's work is not in my box")
eq(needsAck(mk({ IsAcknowledged: true }), 'Ticket', ME), false, 'once accepted it leaves the box')
eq(needsAck(mk({}), 'Ticket', undefined), false, 'no signed-in address means an empty box, not everything')

// งานที่ปิดแล้วไม่ต้องมารอรับ — ไม่มีอะไรให้ทำต่อ
eq(needsAck(mk({ Status: 'Closed' }), 'Ticket', ME), false, 'a closed ticket is not waiting to be accepted')
eq(needsAck(mk({ Status: 'Resolved' }), 'Incident', ME), false, 'a resolved incident is not waiting either')
eq(needsAck(mk({ IsCompleted: true }), 'Task', ME), false, 'a finished task is not waiting')
eq(needsAck(mk({ Status: 'In Progress' }), 'Ticket', ME), true, 'work in progress can still be unaccepted')

// งานที่เราสร้างเองแล้วมอบหมายให้ตัวเอง — เรารู้อยู่แล้ว ไม่ต้องกดรับ
eq(needsAck(mk({ Author: { Title: 'ฉัน', EMail: ME } }), 'Ticket', ME), false,
  'work I assigned to myself needs no acceptance')
eq(needsAck(mk({ CreatedByEmail: 'ME@its.co.th' }), 'Ticket', ME), false,
  'the self-assignment check ignores letter case')
eq(needsAck(mk({ Author: { Title: 'หัวหน้า', EMail: 'boss@its.co.th' } }), 'Ticket', ME), true,
  'work handed to me by someone else does need accepting')

// กล่องรวมทั้งสามชนิด เรียงงานที่รอนานที่สุดขึ้นก่อน
const inbox = buildAckInbox(
  [mk({ id: 5, Title: 'ตั๋วใหม่', Created: '2026-09-03T09:00:00Z', Priority: 'High' })],
  [mk({ id: 6, Title: 'งานย่อย', Created: '2026-09-01T09:00:00Z', ProjectID: 7 })],
  [mk({ id: 7, Title: 'เคสด่วน', Created: '2026-09-02T09:00:00Z', Severity: 'Critical' })],
  ME,
)
eq(inbox.length, 3, 'all three kinds share one box')
eq(inbox.map(r => r.kind).join(','), 'Task,Incident,Ticket', 'the longest wait is first')
eq(inbox.find(r => r.kind === 'Ticket')?.link, '/tickets/5', 'a ticket opens its own page')
eq(inbox.find(r => r.kind === 'Incident')?.link, '/incidents/7', 'an incident opens its own page')
eq(inbox.find(r => r.kind === 'Task')?.link, '/projects/7', 'a task opens its project, having no page of its own')
eq(inbox.find(r => r.kind === 'Ticket')?.listName, 'HD_Tickets', 'each row knows the list to write back to')
eq(buildAckInbox([], [], [], ME).length, 0, 'nothing assigned means an empty box, not a crash')

// เมลแจ้งคนมอบหมายว่ารับงานแล้ว
const row = buildAckInbox([mk({ id: 5, Title: 'ตั๋วใหม่', Priority: 'High',
  Author: { Title: 'หัวหน้า', EMail: 'boss@its.co.th' } })], [], [], ME)[0]
const av = ackVars(row, 'สมชาย', 'https://itservices.co.th/helpdesk/')
eq(av.work_title, 'ตั๋วใหม่', 'the template gets the title')
eq(av.agent_name, 'สมชาย', 'the template says who accepted it')
eq(av.from_name, 'หัวหน้า', 'the template addresses the person who assigned it')
eq(av.link, 'https://itservices.co.th/helpdesk/#/tickets/5', 'the link opens the work itself')
eq(av.due_date, 'ไม่ได้กำหนด', 'no due date reads as words, not a blank cell')
eq(Object.values(av).every(v => typeof v === 'string' && v.length > 0), true,
  'no variable renders empty in a mail going to a person')
eq(row.fromEmail, 'boss@its.co.th', 'the row carries the address to reply to')



// -- หมดเวลาใช้งานอัตโนมัติ (utils/idleSession) --
const T0 = 1_800_000_000_000
const MIN = 60_000

eq(idleStatus(T0, T0).state, 'active', 'just moved means active')
eq(idleStatus(T0, T0 + 30 * MIN).state, 'active', 'half an hour idle is still active')
eq(idleStatus(T0, T0 + 54 * MIN).state, 'active', 'one minute before the warning it is still active')
eq(idleStatus(T0, T0 + 55 * MIN).state, 'warning', 'the warning opens five minutes before the cut')
eq(idleStatus(T0, T0 + 59 * MIN).state, 'warning', 'still warning one minute before')
eq(idleStatus(T0, T0 + 60 * MIN).state, 'expired', 'the hour is up')
eq(idleStatus(T0, T0 + 200 * MIN).state, 'expired', 'long past the hour stays expired')

eq(idleStatus(T0, T0 + 55 * MIN).remainingMs, 5 * MIN, 'the warning knows how long is left')
eq(idleStatus(T0, T0 + 90 * MIN).remainingMs, 0, 'time left never goes negative')

// นาฬิกาเครื่องถูกปรับย้อนหลัง — ต้องไม่กลายเป็นหมดอายุทันที
eq(idleStatus(T0, T0 - 10 * MIN).state, 'active', 'a clock moved backwards does not log anyone out')
eq(idleStatus(T0, T0 - 10 * MIN).idleMs, 0, 'idle time is never negative')

// ตั้งเวลาสั้นลงได้ (เผื่ออยากปรับ)
eq(idleStatus(T0, T0 + 6 * MIN, 10 * MIN, 5 * MIN).state, 'warning', 'the limits are configurable')
eq(idleStatus(T0, T0 + 11 * MIN, 10 * MIN, 5 * MIN).state, 'expired', 'a shorter limit expires sooner')

eq(countdown(5 * MIN), '5:00', 'five minutes reads as 5:00')
eq(countdown(65_000), '1:05', 'sixty five seconds reads as 1:05')
eq(countdown(1_500), '0:02', 'a second and a half rounds up to 0:02')
eq(countdown(0), '0:00', 'zero reads as 0:00')
eq(countdown(-500), '0:00', 'negative time still reads as 0:00')

// ไม่เขียนเวลาขยับทุก event — ขยับเมาส์ทีเดียวยิงเป็นร้อยครั้ง
eq(shouldBump(T0, T0 + 1_000), false, 'a move one second later is not written again')
eq(shouldBump(T0, T0 + 31_000), true, 'after the throttle window it is written')
// แต่ช่วงเตือนต้องไวทันที ไม่งั้นขยับแล้วกล่องไม่ยอมหาย
eq(shouldBump(T0, T0 + 56 * MIN), true, 'inside the warning window every move counts')

eq(readLastActivity(String(T0), T0 + MIN), T0, 'a stored timestamp is used as-is')
eq(readLastActivity(null, T0), T0, 'nothing stored counts as just moved, not as expired')
eq(readLastActivity('ไม่ใช่ตัวเลข', T0), T0, 'a corrupt value does not log anyone out')
eq(readLastActivity('0', T0), T0, 'a zero does not read as 1970 and expire instantly')
eq(readLastActivity(String(T0 + 999 * MIN), T0), T0, 'a wildly future value from another clock is ignored')

eq(IDLE_LIMIT_MS, 60 * MIN, 'the limit is one hour')
eq(WARN_BEFORE_MS, 5 * MIN, 'the warning comes five minutes ahead')



// -- บทบาทในโครงการ (utils/projectRoles) --
const RP = [
  { id: 1, Title: '#VDI', Status: 'Active' },
  { id: 2, Title: '#Backup', Status: 'Active' },
  { id: 3, Title: '#เก่า', Status: 'Completed' },
]
const RM = [
  { id: 10, Title: 'สมชาย', ProjectID: 1, AgentEmail: 'somchai@its.co.th', Role: 'Support', Responsibility: 'ดูแล VDA รายวัน' },
  { id: 11, Title: 'อารีย์', ProjectID: 1, AgentEmail: 'aree@its.co.th', Role: 'Manager' },
  { id: 12, Title: 'สมชาย', ProjectID: 2, AgentEmail: 'somchai@its.co.th', Role: 'Manager' },
  { id: 13, Title: 'กมล', ProjectID: 2, AgentEmail: 'kamol@its.co.th' },
  { id: 14, Title: 'สมชาย', ProjectID: 3, AgentEmail: 'somchai@its.co.th', Role: 'Publisher' },
  { id: 15, Title: 'ผี', ProjectID: 999, AgentEmail: 'ghost@its.co.th', Role: 'Manager' },
]

// เรียงตามความรับผิดชอบ ไม่ใช่ตามลำดับที่ถูกเชิญ
eq(membersOf(RM, 1).map(m => m.Role).join(','), 'Manager,Support', 'the manager is listed first')
eq(membersOf(RM, 2).map(m => m.Role ?? '-').join(','), 'Manager,-', 'someone with no role sorts last')
eq(membersOf(RM, 404).length, 0, 'a project with no team is empty, not a crash')

const people = buildRoleMatrix(RP, RM)
eq(people.some(x => x.email === 'ghost@its.co.th'), false,
  'a member pointing at a deleted project is dropped, not shown as a dead row')

const somchai = people.find(x => x.email === 'somchai@its.co.th')!
eq(somchai.assignments.length, 3, 'one person can hold roles on several projects')
eq(somchai.topRole, 'Manager', 'the most senior role is the summary badge')
eq(somchai.activeCount, 2, 'finished projects are not counted as work in hand')
eq(somchai.assignments.map(a => a.role).join(','), 'Manager,Support,Publisher',
  "a person's own projects sort by responsibility too")
eq(somchai.assignments[0].projectTitle, '#Backup', 'each row says which project it belongs to')
eq(somchai.assignments.find(a => a.projectId === 1)?.responsibility, 'ดูแล VDA รายวัน',
  'the free-text responsibility survives')

const kamol = people.find(x => x.email === 'kamol@its.co.th')!
eq(kamol.topRole, UNASSIGNED_ROLE, 'no role reads as words, not as blank')
eq(people[people.length - 1].email, 'kamol@its.co.th', 'people with nothing assigned sort last, to be chased')

// เรียงคน: ตำแหน่งสูงก่อน แล้วคนที่ถือหลายโครงการ
eq(people[0].email, 'somchai@its.co.th', 'a manager holding two live projects leads the list')

eq(roleRank('Manager') < roleRank('Support'), true, 'manager outranks support')
eq(roleRank('บทบาทที่ตั้งเอง') < roleRank(''), true, 'a custom role still sorts ahead of no role')
eq(roleRank(undefined), roleRank(''), 'missing and empty are the same thing')

const tally = roleTally(people)
eq(tally[0].role, 'Manager', 'the summary starts with the most senior role')
eq(tally.find(t => t.role === 'Manager')?.count, 2, 'two manager seats across the projects')
eq(tally.find(t => t.role === UNASSIGNED_ROLE)?.count, 1, 'unfilled seats are counted, not hidden')

// ค้นหาต้องหาเจอจากทุกมุม
eq(filterPeople(people, 'VDA').length, 1, 'search reaches into the responsibility text')
eq(filterPeople(people, '#backup').length, 2, 'search by project name finds everyone on it')
eq(filterPeople(people, 'manager').length, 2, 'search by role works')
eq(filterPeople(people, 'AREE').length, 1, 'search ignores letter case')
eq(filterPeople(people, '').length, people.length, 'an empty search hides nobody')
eq(filterPeople(people, 'ไม่มีอยู่จริง').length, 0, 'no match returns nothing, not everything')

// โครงการที่ยังไม่มีคนตัดสินใจ — ต้องรู้ ไม่ใช่ปล่อยเงียบ
const gaps = projectsWithoutManager(RP, RM.filter(m => m.id !== 11 && m.id !== 12))
eq(gaps.map(g => g.Title).join(','), '#VDI,#Backup', 'live projects with no manager are listed')
eq(projectsWithoutManager(RP, RM).length, 0, 'nothing is flagged when every live project has one')
eq(projectsWithoutManager(RP, []).some(p => p.Title === '#เก่า'), false,
  'a finished project without a manager is not a gap worth chasing')

eq(buildRoleMatrix([], []).length, 0, 'no data means an empty view, not a crash')

// -- มุมมองตาราง: โครงการเป็นแถว บทบาทเป็นคอลัมน์ --
const grid = buildRoleGrid(people)

// คอลัมน์เฉพาะบทบาทที่มีคนอยู่จริง เรียงตามความรับผิดชอบ ไม่ใช่ตามตัวอักษร
eq(grid.roles.join(','), `Manager,Support,Publisher,${UNASSIGNED_ROLE}`,
  'columns run by seniority and only include roles in use')
eq(grid.roles.includes('Reviewer'), false, 'a role nobody holds does not take up a column')

// แถวคือโครงการ — อ่านทีละแถวก็เห็นทั้งทีม
eq(grid.rows.length, 3, 'every project with a team gets a row')
eq(grid.rows.map(r => r.projectTitle).join(','), '#Backup,#VDI,#เก่า',
  'live projects come first, then finished ones, each alphabetical')

const vdiRow = grid.rows.find(r => r.projectTitle === '#VDI')!
eq(vdiRow.cells['Manager']?.map(x => x.name).join(','), 'อารีย์', 'the cell holds the person in that role')
eq(vdiRow.cells['Support']?.[0].responsibility, 'ดูแล VDA รายวัน', 'the responsibility text rides along')
eq(vdiRow.cells['Publisher'], undefined, 'a role nobody fills on this project leaves the cell empty')
eq(vdiRow.total, 2, 'the row counts its seats')

// ช่องเดียวมีได้หลายคน และเรียงตามชื่อ
const many = buildRoleGrid(buildRoleMatrix(
  [{ id: 1, Title: '#VDI', Status: 'Active' }],
  [
    { id: 1, Title: 'สมชาย', ProjectID: 1, AgentEmail: 'b@x.co', Role: 'Support' },
    { id: 2, Title: 'กมล', ProjectID: 1, AgentEmail: 'a@x.co', Role: 'Support' },
  ]))
eq(many.rows[0].cells['Support']?.map(x => x.name).join(','), 'กมล,สมชาย',
  'two people in one role are listed by name')

// ไม่มีบทบาท ต้องมีคอลัมน์ของตัวเอง ไม่ใช่หายไปเงียบ ๆ
const backup = grid.rows.find(r => r.projectTitle === '#Backup')!
eq(backup.cells[UNASSIGNED_ROLE]?.map(x => x.name).join(','), 'กมล',
  'someone with no role still appears, in their own column')

// ตารางต้องอ่านจากผลค้นหาชุดเดียวกับการ์ด ไม่งั้นสองมุมมองไม่ตรงกัน
eq(buildRoleGrid(filterPeople(people, 'อารีย์')).rows.map(r => r.projectTitle).join(','), '#VDI',
  'the table narrows with the same search box as the cards')
eq(buildRoleGrid([]).rows.length, 0, 'no people means no rows, not a crash')
eq(buildRoleGrid([]).roles.length, 0, 'no people means no columns either')




// -- เจ้าของโครงการต้องอยู่ในทีมด้วย --
eq(ownerMissingFromTeam(RM, 1, 'boss@its.co.th'), true,
  'a project owner who is not a team row is reported missing')
eq(ownerMissingFromTeam(RM, 1, 'aree@its.co.th'), false, 'an owner already on the team is fine')
eq(ownerMissingFromTeam(RM, 1, 'AREE@its.co.th'), false, 'the owner check ignores letter case')
eq(ownerMissingFromTeam(RM, 1, undefined), false,
  'an unknown owner is not reported as missing — there is nothing to add')
eq(ownerMissingFromTeam(RM, 1, '  '), false, 'a blank owner address is treated the same')
eq(ownerMissingFromTeam([], 5, 'boss@its.co.th'), true, 'an empty team means the owner is missing')
eq(ownerMissingFromTeam(RM, 2, 'somchai@its.co.th'), false,
  'membership is checked per project, not across all of them')
eq(OWNER_DEFAULT_ROLE, 'Manager', 'the creator starts as the one accountable')



// -- ป้าย "มีอัปเดต" บนโปรเจกต์ที่ร่วมทีม (utils/projectActivity) --
const AP = [
  { id: 1, Modified: '2026-09-01T08:00:00Z' },
  { id: 2, Modified: '2026-09-01T08:00:00Z' },
  { id: 3, Modified: '2026-09-05T08:00:00Z' },
]
const act = latestActivity(
  AP,
  [{ ProjectID: 1, Modified: '2026-09-07T10:00:00Z' }],
  [{ ProjectID: 2, Modified: '2026-09-06T10:00:00Z' }],
  [{ ProjectID: 1, Modified: '2026-09-08T09:00:00Z' }, { ProjectID: 2, Created: '2026-09-02T10:00:00Z' }],
)

// เวลาที่ขยับล่าสุดต้องมาจากลูกด้วย ไม่ใช่แค่แถวโปรเจกต์
eq(act.get(1)?.at, '2026-09-08T09:00:00Z', 'the newest child activity wins')
eq(act.get(1)?.kind, 'comment', 'the badge says which kind moved last')
eq(act.get(2)?.kind, 'incident', 'an incident beats an older comment')
eq(act.get(3)?.kind, 'project', 'a project with no children falls back to its own row')
eq(act.get(404), undefined, 'a project with no activity at all is simply absent')

// แถวที่ไม่มี ProjectID หรือไม่มีเวลา ต้องไม่ทำให้พัง
eq(latestActivity([], [{ Modified: '2026-09-09T00:00:00Z' }], [], []).size, 0,
  'a child with no project id is ignored')
eq(latestActivity([{ id: 9 }], [], [], []).size, 0, 'a project with no timestamp is not counted as activity')
eq(latestActivity([{ id: 9 }], [{ ProjectID: 9, Created: '2026-09-09T00:00:00Z' }], [], []).get(9)?.kind, 'task',
  'Created is used when Modified is absent')

eq(activityLabel('comment'), 'คอมเมนต์ใหม่', 'each kind reads as words on the badge')
eq(activityLabel('task'), 'งานใหม่', 'a task reads as new work')

// เทียบกับเวลาที่เราเปิดล่าสุด
eq(hasUpdate('2026-09-08T09:00:00Z', '2026-09-07T00:00:00Z'), true, 'activity after my last visit is an update')
eq(hasUpdate('2026-09-06T09:00:00Z', '2026-09-07T00:00:00Z'), false, 'activity before my last visit is not')
eq(hasUpdate('2026-09-07T00:00:00Z', '2026-09-07T00:00:00Z'), false, 'the same instant is not an update')
// ไม่เคยเปิด = ไม่ติดป้าย ถ้าติดทั้งกระดานคนจะเลิกมองป้ายนี้
eq(hasUpdate('2026-09-08T09:00:00Z', undefined), false, 'never having opened it does not light up the badge')
eq(hasUpdate(undefined, '2026-09-07T00:00:00Z'), false, 'no activity means no badge')

// เก็บเวลาที่เปิด
eq(Object.keys(readSeen(null)).length, 0, 'nothing stored reads as nothing seen')
eq(Object.keys(readSeen('ไม่ใช่ json')).length, 0, 'a corrupt value does not break the page')
eq(Object.keys(readSeen('[1,2,3]')).length, 0, 'an array where an object was expected is rejected')
eq(readSeen('{"1":"2026-09-07T00:00:00Z","2":5}')['1'], '2026-09-07T00:00:00Z',
  'valid entries survive alongside invalid ones')
eq(readSeen('{"2":5}')['2'], undefined, 'a non-string timestamp is dropped')

eq(markSeen({}, 7, '2026-09-08T00:00:00Z')['7'], '2026-09-08T00:00:00Z', 'opening a project records the time')
eq(markSeen({ '7': '2026-09-09T00:00:00Z' }, 7, '2026-09-08T00:00:00Z')['7'], '2026-09-09T00:00:00Z',
  'the seen time never moves backwards')

// เส้นฐานตอนโหลดครั้งแรก — กันป้ายขึ้นพร้อมกันทั้งกระดาน
const based = baselineUnseen({ '1': '2026-09-01T00:00:00Z' }, [1, 2, 3], '2026-09-08T00:00:00Z')
eq(based['1'], '2026-09-01T00:00:00Z', 'a project already seen keeps its own time')
eq(based['2'], '2026-09-08T00:00:00Z', 'a project never seen gets the baseline instead of a badge')
eq(countUpdated([1, 2, 3], act, based), 1, 'only genuinely newer activity is counted')
eq(countUpdated([1, 2, 3], act, { '1': '2026-08-01T00:00:00Z', '2': '2026-08-01T00:00:00Z', '3': '2026-08-01T00:00:00Z' }), 3,
  'an old visit to everything counts them all')
eq(countUpdated([], act, based), 0, 'no projects means no count, not a crash')



// -- เลือกดูเฉพาะสายบังคับบัญชา (utils/orgBranch) --
const STAFF = [
  { Title: 'บอส', EmailText: 'boss@x.co', ApproverEmail: '' },
  { Title: 'หัวหน้า A', EmailText: 'a@x.co', ApproverEmail: 'boss@x.co' },
  { Title: 'หัวหน้า B', EmailText: 'b@x.co', ApproverEmail: 'BOSS@X.CO' },
  { Title: 'ลูกน้อง A1', EmailText: 'a1@x.co', ApproverEmail: 'a@x.co' },
  { Title: 'ลูกน้อง A2', EmailText: 'a2@x.co', ApproverEmail: 'a@x.co' },
  { Title: 'ลูกน้อง A1a', EmailText: 'a1a@x.co', ApproverEmail: 'a1@x.co' },
  { Title: 'คนนอก', EmailText: 'out@x.co', ApproverEmail: 'ไม่มีคนนี้@x.co' },
]
const tree = buildOrgTree(STAFF)

eq(tree.roots.includes('boss@x.co'), true, 'someone with no approver sits at the top')
eq(tree.roots.includes('out@x.co'), true, 'an approver who is not on the list does not hide the person')
eq(tree.childrenOf.get('boss@x.co')?.length, 2, 'a mixed-case approver email still links up')
eq(tree.parentOf.get('a1a@x.co'), 'a1@x.co', 'each person remembers who they report to')

// นับทั้งสาย ไม่ใช่แค่ชั้นถัดไป — ตัวเลขนี้บอกว่าเลือกแล้วจะเห็นกี่คน
eq(subtreeSize('a@x.co', tree.childrenOf), 3, 'the count covers the whole branch, not just direct reports')
eq(subtreeSize('a1a@x.co', tree.childrenOf), 0, 'someone with no reports counts zero')

// รายการหัวสาย — เฉพาะคนที่มีลูกน้อง
const branches = branchOptions(tree)
eq(branches.some(o => o.email === 'a2@x.co'), false, 'a person with no reports is not offered as a branch')
eq(branches.find(o => o.email === 'a@x.co')?.depth, 1, 'the list shows how deep each branch sits')
eq(branches.find(o => o.email === 'boss@x.co')?.size, 5, 'the top branch counts everyone below it')

// breadcrumb — ไม่ให้หลงว่าสายที่ดูอยู่ตรงไหนขององค์กร
eq(pathToRoot('a1a@x.co', tree.parentOf).join('>'), 'boss@x.co>a@x.co>a1@x.co>a1a@x.co',
  'the trail runs from the top down to the person')
eq(pathToRoot('boss@x.co', tree.parentOf).length, 1, 'the top of the chart is its own trail')

// จุดเริ่มวาด
eq(visibleRoots(tree, 'a@x.co').join(''), 'a@x.co', 'picking a branch draws from that person')
eq(visibleRoots(tree, 'A@X.CO').join(''), 'a@x.co', 'the pick is not case sensitive')
eq(visibleRoots(tree, '').length, tree.roots.length, 'picking nothing draws the whole chart')
eq(visibleRoots(tree, 'ไม่มีคนนี้@x.co').length, tree.roots.length,
  'a branch head who has left falls back to the whole chart instead of a blank screen')

// ข้อมูลวน A→B→A ต้องไม่ทำให้ค้าง และต้องไม่มีใครหาย
const LOOP = [
  { Title: 'วน A', EmailText: 'la@x.co', ApproverEmail: 'lb@x.co' },
  { Title: 'วน B', EmailText: 'lb@x.co', ApproverEmail: 'la@x.co' },
]
const loop = buildOrgTree(LOOP)
eq(loop.roots.length, 2, 'a reporting loop still shows both people')
eq(loop.orphans.has('la@x.co'), true, 'a looped chain is flagged rather than dropped')
eq(subtreeSize('la@x.co', loop.childrenOf), 1, 'counting a loop terminates')
eq(pathToRoot('la@x.co', loop.parentOf).length, 2, 'walking up a loop terminates')
eq(branchOptions(loop).length >= 1, true, 'a looped chain still yields a usable branch list')

// อนุมัติเอง = ระดับสูงสุด
const selfTree = buildOrgTree(
  [{ Title: 'ตัวเอง', EmailText: 'me@x.co', ApproverEmail: 'self' }], 'SELF')
eq(selfTree.roots.join(''), 'me@x.co', 'approving your own leave puts you at the top')

eq(buildOrgTree([{ Title: 'ไม่มีเมล', EmailText: '' }]).roots.length, 0,
  'a row with no email is skipped instead of creating a blank node')



// -- ดูเฉพาะแผนกเดียว (SupportGroup) --
// แผนกไม่เท่ากับสายบังคับบัญชา: หัวหน้าคนเดียวคุมได้หลายแผนก
const DEPT = [
  { Title: 'บอส', EmailText: 'boss@x.co', ApproverEmail: '' },
  { Title: 'หัวหน้า A', EmailText: 'a@x.co', ApproverEmail: 'boss@x.co', SupportGroup: 'Network' },
  { Title: 'หัวหน้า B', EmailText: 'b@x.co', ApproverEmail: 'boss@x.co', SupportGroup: 'Helpdesk' },
  { Title: 'ช่าง A1', EmailText: 'a1@x.co', ApproverEmail: 'a@x.co', SupportGroup: 'Network' },
  // คนแผนก Network แต่ไปอยู่ใต้หัวหน้าฝั่ง Helpdesk — เคสที่การกรองด้วยสายทำไม่ได้
  { Title: 'ช่าง B1', EmailText: 'b1@x.co', ApproverEmail: 'b@x.co', SupportGroup: 'Network' },
  { Title: 'ไม่ระบุแผนก', EmailText: 'n@x.co', ApproverEmail: 'boss@x.co', SupportGroup: '  ' },
]
const dtree = buildOrgTree(DEPT)

const depts = departmentOptions(DEPT)
eq(depts.map(d => d.group).join(','), 'Helpdesk,Network', 'departments are listed alphabetically')
eq(depts.find(d => d.group === 'Network')?.count, 3, 'each department shows how many people it holds')
eq(depts.some(d => d.group.trim() === ''), false, 'a blank department is not offered as a choice')
eq(departmentOptions([{ EmailText: '', SupportGroup: 'Network' }]).length, 0,
  'a row with no email does not invent a department')

const view = departmentView(dtree, 'Network')
eq([...view.members].sort().join(','), 'a1@x.co,a@x.co,b1@x.co', 'everyone in the department is kept')
// หัวหน้าเหนือขึ้นไปต้องถูกวาดด้วย ไม่งั้นแผนกจะลอยเป็นหลายก้อนแยกกัน
eq(view.context.has('boss@x.co'), true, 'managers above are drawn so the department is not left floating')
eq(view.context.has('b@x.co'), true, 'a manager from another department is kept as context')
eq(view.members.has('b@x.co'), false, 'that manager is not counted as a member of this department')
eq(view.context.has('n@x.co'), false, 'unrelated people are left out')
eq(departmentView(dtree, '').members.size, 0, 'picking no department keeps nobody')

const dt = departmentTree(dtree, 'Network')
eq(dt.roots.join(','), 'boss@x.co', 'the trimmed chart starts from the one manager above')
eq(dt.childrenOf.get('boss@x.co')?.sort().join(','), 'a@x.co,b@x.co',
  'only branches leading into the department survive')
eq(dt.childrenOf.get('boss@x.co')?.includes('n@x.co'), false, 'a branch with nobody in the department is cut')
eq(dt.childrenOf.get('b@x.co')?.join(','), 'b1@x.co', 'a context manager keeps only the reports that matter')
eq(dt.childrenOf.has('a1@x.co'), false, 'someone with no reports left is not given an empty entry')

// แผนกที่ไม่มีคน / ไม่ได้เลือก ต้องกลับไปทั้งใบ ไม่ใช่จอว่าง
eq(departmentTree(dtree, 'ไม่มีแผนกนี้').roots.length, dtree.roots.length,
  'a department that matches nobody falls back to the whole chart')
eq(departmentTree(dtree, '').roots.length, dtree.roots.length, 'no department picked draws the whole chart')

// สายวนต้องไม่ทำให้การกรองแผนกค้าง
const dloop = buildOrgTree([
  { Title: 'วน A', EmailText: 'la@x.co', ApproverEmail: 'lb@x.co', SupportGroup: 'Ops' },
  { Title: 'วน B', EmailText: 'lb@x.co', ApproverEmail: 'la@x.co', SupportGroup: 'Ops' },
])
eq(departmentView(dloop, 'Ops').members.size, 2, 'a reporting loop does not hang the department filter')



// -- เปิดดูไฟล์แนบในหน้า ไม่ต้องดาวน์โหลด (utils/filePreview + sniffFile) --
const B = (s: string) => {
  const a = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i)
  return a
}

// ไบต์จริงต้องบอกชนิดได้ ไม่ต้องพึ่งนามสกุล
eq(sniffFile(B('%PDF-1.7')), 'application/pdf', 'a PDF is recognised by its first bytes')
eq(sniffFile(B('....ftypisom....')), 'video/mp4', 'an mp4 container is recognised')
eq(sniffFile(B('....ftypM4A ....')), 'audio/mp4', 'an m4a is audio, not video, despite the same container')
eq(sniffFile(B('....ftypqt  ....')), 'video/quicktime', 'a .mov keeps its own type')
eq(sniffFile(B('RIFF____WAVEfmt ')), 'audio/wav', 'a WAV is told apart from other RIFF files')
eq(sniffFile(B('RIFF____AVI LIST')), 'video/x-msvideo', 'an AVI is told apart from a WAV')
eq(sniffFile(B('ID3\x03....')), 'audio/mpeg', 'an mp3 with an ID3 tag is recognised')
eq(sniffFile(B('OggS....')), 'audio/ogg', 'an Ogg stream is recognised')
eq(sniffFile(B('%PDF')) === sniffImage(B('%PDF')), false, 'the wider sniffer sees more than the image one')
eq(sniffFile(B('\x89PNG\r\n\x1a\n')), 'image/png', 'images still work through the wider sniffer')
eq(sniffFile(B('PK\x03\x04')), null, 'a zip is left unknown rather than guessed at')
eq(sniffFile(B('ab')), null, 'too few bytes is not a crash')

// ลำดับความน่าเชื่อ: ไบต์ → นามสกุล → header
eq(resolveMime('application/pdf', 'report.docx', 'text/plain'), 'application/pdf',
  'the bytes win over both the name and the server header')
eq(resolveMime(null, 'notes.txt', 'application/octet-stream'), 'text/plain',
  'the name is used when the bytes say nothing')
eq(resolveMime(null, 'thing.unknown', 'application/octet-stream'), '',
  "SharePoint's octet-stream is treated as no answer, not as an answer")
eq(resolveMime(null, 'thing.unknown', 'text/csv'), 'text/csv', 'a real server header is used as a last resort')

eq(extOf('a.b.TXT'), 'txt', 'the extension is the last one, lower-cased')
eq(extOf('Makefile'), '', 'a file with no extension has none')
eq(extOf('.gitignore'), '', 'a dotfile is a name, not an extension')
eq(mimeFromName('CAPS.PDF'), 'application/pdf', 'extension matching ignores case')

// เปิดดูได้แบบไหน
eq(previewKind('application/pdf', 'a.pdf'), 'pdf', 'a PDF opens in the page')
eq(previewKind('video/mp4', 'a.mp4'), 'video', 'a video plays in the page')
eq(previewKind('audio/mpeg', 'a.mp3'), 'audio', 'audio plays in the page')
eq(previewKind('text/csv', 'a.csv'), 'text', 'a CSV is read as text')
eq(previewKind('', 'a.log'), 'text', 'the name alone is enough when the type is unknown')
eq(previewKind('image/png', 'a.png'), 'image', 'images keep their own path')
eq(previewKind('', 'report.docx'), 'office', 'Office files are called out, not lumped in with the rest')
eq(previewKind('application/zip', 'a.zip'), 'none', 'a zip has nothing to show')
eq(previewKind('', 'setup.exe'), 'none', 'an unknown binary has nothing to show')
// log 50MB ต้องไม่ทำให้หน้าค้าง
eq(previewKind('text/plain', 'huge.log', TEXT_PREVIEW_LIMIT + 1), 'none',
  'a text file too big to read is not offered as a preview')
eq(previewKind('text/plain', 'small.log', TEXT_PREVIEW_LIMIT), 'text', 'a file right at the limit still opens')

// คัดไฟล์ที่วาง/ลากเข้ามา
const picked = pickFiles([
  { name: 'ok.pdf', size: 1000 },
  { name: 'โฟลเดอร์', size: 0 },
  { name: 'huge.iso', size: MAX_UPLOAD_BYTES + 1 },
  { name: '', size: 50 },
  { name: 'weird.aspx', size: 20 },
])
// ไม่กรองตามนามสกุล — เดาแทน SharePoint จะกลายเป็นบล็อกไฟล์ที่จริงๆ อัปโหลดได้
eq(picked.accepted.map(f => f.name).join(','), 'ok.pdf,weird.aspx',
  'every extension is accepted; the server gets to decide')
eq(picked.rejected.length, 2, 'only empty and oversized files are turned away')
eq(picked.rejected[0].reason.includes('โฟลเดอร์'), true, 'dragging a folder says so instead of failing later')
eq(picked.rejected[1].reason.includes('ใหญ่เกิน'), true, 'an oversized file says why')
eq(pickFiles([]).accepted.length, 0, 'nothing dropped is not a crash')

// รูปที่วางจากคลิปบอร์ดมักชื่อซ้ำกันทุกใบ
const when = new Date('2026-09-09T04:05:06Z')
eq(pastedName('image.png', 'image/png', when), 'pasted-2026-09-09-04-05-06.png',
  'a pasted screenshot gets a name that tells it apart')
eq(pastedName('', 'image/jpeg', when).endsWith('.jpeg'), true, 'a nameless paste still gets the right extension')
eq(pastedName('รายงานประชุม.png', 'image/png', when), 'รายงานประชุม.png', 'a real filename is left alone')

eq(dedupeName('a.png', []), 'a.png', 'a free name is used as is')
eq(dedupeName('a.png', ['a.png']), 'a-2.png', 'a clash gets a number before the extension')
eq(dedupeName('a.png', ['a.png', 'a-2.png']), 'a-3.png', 'numbering keeps going')
eq(dedupeName('A.PNG', ['a.png']), 'A-2.PNG', 'the clash check ignores case, like SharePoint does')
eq(dedupeName('Makefile', ['Makefile']), 'Makefile-2', 'a file with no extension still dedupes')

eq(prettySize(0), '', 'no size shows nothing rather than "0 B"')
eq(prettySize(900), '900 B', 'small files read in bytes')
eq(prettySize(2048), '2 KB', 'kilobytes are rounded')
eq(prettySize(5 * 1024 * 1024), '5.0 MB', 'megabytes keep one decimal')



// -- Agent Dashboard: รวม Ticket / Incident / Task (utils/dashboardWork) --
const DPROJ = [{ id: 1, Title: '#VDI' }, { id: 2, Title: '#Backup' }]

const dTickets = ticketRows([
  { id: 1, Title: 'จอดับ', TicketNumber: 'TK-001', Status: 'Open', Priority: 'High',
    AssignedToName: 'สมชาย', AssignedEmail: 'somchai@its.co.th', CustomerName: 'ลูกค้า ก',
    DueDate: '2026-09-20', Modified: '2026-09-08T00:00:00Z', ProjectID: 1 },
  { id: 2, Title: 'ปริ้นไม่ออก', Status: 'Closed' },
], DPROJ)

eq(dTickets[0].ref, 'TK-001', 'a ticket is known by its number')
eq(dTickets[1].ref, '#2', 'a ticket with no number falls back to its id, not to blank')
eq(dTickets[0].projectName, '#VDI', 'the project name is resolved for the table')
eq(dTickets[1].projectName, '', 'no project is blank, not "undefined"')
eq(dTickets[1].status, 'Closed', 'the status is carried across')

const dInc = incidentRows([
  { id: 5, Title: 'ระบบล่ม', Status: 'Open', Severity: 'Critical',
    AssignedTo: 'อารีย์', AssignedEmail: 'aree@its.co.th', IncidentDate: '2026-09-01',
    SLADue: '2026-09-02T10:00:00Z', ProjectID: 2, Author: { Title: 'กมล' }, IsAcknowledged: false },
], DPROJ)

// Severity คือความเร่งด่วนของ Incident — ต้องลงคอลัมน์เดียวกับ Priority
eq(dInc[0].priority, 'Critical', 'severity fills the same column as ticket priority')
// เส้นตายของ Incident คือ SLA ไม่ใช่วันที่เกิดเหตุ
eq(dInc[0].due, '2026-09-02T10:00:00Z', 'an incident is due at its SLA, not on the day it happened')
eq(dInc[0].requester, 'กมล', 'the person who raised it is shown')
eq(dInc[0].waitingAck, true, 'work assigned but not yet accepted is flagged')

const dTasks = taskRows([
  { id: 9, Title: 'ติดตั้ง agent', IsCompleted: false, AssignedTo: 'สมชาย', AssignedEmail: 'somchai@its.co.th', ProjectID: 1 },
  { id: 10, Title: 'เก็บ log', IsCompleted: true, ProjectID: 1 },
], DPROJ)

// Task เก็บสถานะเป็น yes/no — ต้องแปลงเป็นคำ ไม่งั้นตัวกรองเดียวใช้กับสามชนิดไม่ได้
eq(dTasks[0].status, 'In Progress', 'an open task reads as a status word')
eq(dTasks[1].status, 'Completed', 'a finished task reads as Completed')
eq(dTasks[0].priority, '', 'a task has no priority field, and does not invent one')
eq(dTasks[1].waitingAck, false, 'a task nobody is assigned is not waiting to be accepted')

eq(isDone('Closed') && isDone('Completed') && isDone('Resolved'), true,
  'each kind has its own word for finished, and all of them count')
eq(isDone('In Progress'), false, 'work still moving is not finished')

// ตัวเลขสรุปต้องนับข้ามชนิดได้
const all = [...dTickets, ...dInc, ...dTasks]
const wst = workStats(all)
eq(wst.total, 5, 'the count covers all three kinds')
eq(wst.open, 2, 'open items across kinds are counted together')
eq(wst.done, 2, 'a closed ticket and a completed task both count as done')
// "ยังไม่มีคนรับผิดชอบ" นับได้ทั้งสามชนิด ต่างจาก Pending ที่มีแต่ Ticket
eq(wst.unassigned, 0, 'work already finished is not chased for having no owner')
eq(workStats([...all, { ...dTasks[1], id: 11, status: 'In Progress', assignedEmail: '' }]).unassigned, 1,
  'unfinished work with nobody on it is the number worth chasing')

// กรองชุดเดียว ใช้ได้ทั้งสามชนิด
eq(filterWork(all, { search: 'vdi' }).length, 3, 'searching by project name reaches every kind')
eq(filterWork(all, { search: 'TK-001' }).length, 1, 'searching by reference finds the one item')
eq(filterWork(all, { search: 'somchai@its' }).length, 2, 'searching by assignee email works')
eq(filterWork(all, { search: 'กมล' }).length, 1, 'searching by the person who raised it works')
eq(filterWork(all, { status: 'Open' }).length, 2, 'filtering by status crosses kinds')
eq(filterWork(all, { priority: 'Critical' }).length, 1, 'filtering by priority reaches severity too')
eq(filterWork(all, { assignee: 'AREE@ITS.CO.TH' }).length, 1, 'the assignee filter ignores case')
eq(filterWork(all, { hideDone: true }).length, 3, 'finished work can be hidden')
eq(filterWork(all, {}).length, all.length, 'no filter hides nothing')
eq(filterWork(all, { search: 'ไม่มีอยู่จริง' }).length, 0, 'no match returns nothing, not everything')

// ตัวเลือกในกล่องกรองต้องมีเฉพาะที่มีจริง เรียงตามลำดับจริง ไม่ใช่ตัวอักษร
eq(statusOptions(all).join(','), 'Open,In Progress,Closed,Completed', 'status choices follow the real order')
eq(statusOptions(all).includes('Pending'), false, 'a status nothing has is not offered')
eq(priorityOptions(all).join(','), 'Critical,High', 'priority choices run from most urgent')

eq(workLink(dTickets[0]), '/tickets/1', 'a ticket opens its own page')
eq(workLink(dInc[0]), '/incidents/5', 'an incident opens its own page')
// Task ยังไม่มีหน้าของตัวเอง — พาไปโครงการ ดีกว่าลิงก์ที่กดแล้วไม่มีอะไร
eq(workLink(dTasks[0]), '/projects/1', 'a task opens the project it belongs to')
eq(workLink({ ...dTasks[0], projectId: undefined }), '/projects',
  'a task with no project still leads somewhere real')

eq(workStats([]).total, 0, 'an empty dashboard is zeros, not a crash')
eq(statusOptions([]).length, 0, 'no rows means no filter choices')



// -- วางเนื้อหาที่มีรูปแบบลงในคอมเมนต์ (utils/richComment) --

// เก็บสองส่วนไว้ในค่าเดียว คอมเมนต์เก่าจึงไม่ต้องแปลงข้อมูล
eq(splitRich('แค่ข้อความ').html, '', 'an old plain comment stays entirely plain')
eq(splitRich('แค่ข้อความ').plain, 'แค่ข้อความ', 'and its text is untouched')
eq(splitRich(undefined).plain, '', 'a missing comment is empty, not a crash')
const rc = splitRich(`ดูตารางนี้\n${RICH_MARK}\n<table><tr><td>a</td></tr></table>`)
eq(rc.plain, 'ดูตารางนี้', 'the typed words are kept separate from the pasted markup')
eq(rc.html, '<table><tr><td>a</td></tr></table>', 'the pasted markup is recovered whole')
eq(joinRich('ดูนี่', '<b>x</b>'), `ดูนี่\n${RICH_MARK}\n<b>x</b>`, 'the two parts round-trip')
eq(joinRich('ดูนี่', ''), 'ดูนี่', 'nothing pasted means nothing extra is stored')
eq(joinRich('', '<b>x</b>').startsWith(RICH_MARK), true, 'pasting without typing still works')
eq(splitRich(joinRich('a', '<b>x</b>')).plain, 'a', 'round-trip keeps the text')
eq(isRich('plain'), false, 'a plain comment is not treated as rich')
eq(isRich(joinRich('a', '<i>x</i>')), true, 'a rich comment is recognised')

// รายการขาว — บล็อกเป็นรายการดำต้องเดาให้ครบ ซึ่งเดาไม่ครบแน่
eq(isAllowedTag('TABLE') && isAllowedTag('td') && isAllowedTag('a') && isAllowedTag('img'), true,
  'tables, links and images survive because they are the point')
eq(isAllowedTag('script'), false, 'a script tag is never allowed')
eq(isDropWhole('script') && isDropWhole('iframe') && isDropWhole('style'), true,
  'dangerous tags are dropped with their contents, not just unwrapped')
eq(isDropWhole('span'), false, 'ordinary tags keep their contents')

// on* คือทางรันโค้ดที่ตรงที่สุด
eq(isAllowedAttr('a', 'onclick'), false, 'an event handler is never kept')
eq(isAllowedAttr('img', 'ONERROR'), false, 'event handlers are stripped whatever their case')
eq(isAllowedAttr('div', 'onmouseover'), false, 'not on any tag either')
eq(isAllowedAttr('a', 'href') && isAllowedAttr('img', 'src') && isAllowedAttr('td', 'colspan'), true,
  'the attributes the content needs are kept')
eq(isAllowedAttr('a', 'target'), false, 'anything not needed is dropped rather than passed through')
eq(isAllowedAttr('div', 'style'), false, 'inline style is not carried over')

// ลิงก์
eq(safeHref('https://itservices.co.th'), 'https://itservices.co.th', 'an https link is kept')
eq(!!safeHref('mailto:a@b.co') && !!safeHref('tel:0812345678'), true, 'mail and phone links are kept')
eq(safeHref('javascript:alert(1)'), '', 'a javascript link is refused')
eq(safeHref('JaVaScRiPt:alert(1)'), '', 'case does not get it past')
// ช่องว่าง/อักขระควบคุมกลาง scheme เป็นวิธีเลี่ยงตัวกรองแบบคลาสสิก
eq(safeHref('java\tscript:alert(1)'), '', 'a tab inside the scheme does not get it past')
eq(safeHref(' java script:alert(1)'), '', 'spaces inside the scheme do not either')
eq(safeHref('data:text/html,<script>'), '', 'a data link is refused')
eq(safeHref('vbscript:msgbox'), '', 'old vbscript links are refused too')
eq(safeHref('#/projects/3'), '#/projects/3', 'a link inside our own app is kept')
eq(safeHref(''), '', 'an empty href is nothing')
eq(safeHref(undefined), '', 'a missing href is nothing')

// รูป
eq(safeImgSrc('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA', 'an embedded image is kept')
eq(safeImgSrc('https://x.co/a.png'), 'https://x.co/a.png', 'an https image is kept')
// ชี้ไปเครื่องคนวางหรือกล่องเมลของเขา — แสดงไม่ได้เลย
eq(safeImgSrc('file:///C:/Users/a/img.png'), '', 'an image on the pasting person machine cannot be shown')
eq(safeImgSrc('cid:image001.png@01D2'), '', 'an Outlook inline reference cannot be shown')
eq(safeImgSrc('blob:http://x/123'), '', 'a blob url from another page cannot be shown')
eq(safeImgSrc('data:text/html;base64,AAA'), '', 'a data url that is not an image is refused')
eq(safeImgSrc('http://x.co/a.png'), '', 'plain http is refused so the page stays secure')
eq(safeImgSrc('data:image/png;base64,' + 'A'.repeat(MAX_INLINE_IMAGE)), '',
  'an embedded image too big for a text column is dropped')

// HTML -> ข้อความล้วน (ใช้ตอนส่งเมลและตอนกดล้างรูปแบบ)
eq(htmlToPlain('<p>สวัสดี</p><p>ครับ</p>'), 'สวัสดี\nครับ', 'paragraphs become line breaks')
// ช่องตารางต้องคั่น ไม่งั้นเลขสองคอลัมน์จะกลายเป็นเลขเดียวที่อ่านผิดได้
eq(htmlToPlain('<table><tr><td>100</td><td>200</td></tr></table>'), '100\t200',
  'table cells stay separated instead of merging into one number')
eq(htmlToPlain('<ul><li>a</li><li>b</li></ul>'), '- a\n- b', 'list items keep their bullets')
eq(htmlToPlain('a<br>b'), 'a\nb', 'a line break is a line break')
eq(htmlToPlain('<b>ตัวหนา</b>'), 'ตัวหนา', 'formatting tags leave their text behind')
eq(htmlToPlain('<script>alert(1)</script>hi'), 'hi', 'script contents never reach the plain text')
eq(htmlToPlain('&amp;&lt;&gt;&nbsp;&#39;'), `&<> '`, 'entities are decoded, not left as codes')
eq(htmlToPlain(''), '', 'empty html is empty text')
eq(htmlToPlain(undefined), '', 'missing html is empty text')

eq(commentPlain(joinRich('ดูตาราง', '<table><tr><td>x</td></tr></table>')), 'ดูตาราง\nx',
  'the readable version covers both halves')
eq(commentPlain('ธรรมดา'), 'ธรรมดา', 'a plain comment reads as itself')
// แท็กหลุดไปโผล่ในอีเมลแจ้งเตือนไม่ได้
eq(plainSnippet(joinRich('ดู', '<b>ตาราง</b>')).includes('<'), false,
  'no markup leaks into a notification')
eq(plainSnippet(joinRich('', '<p>' + 'ก'.repeat(300) + '</p>'), 50).length, 50,
  'a long comment is cut to the asked length')
eq(plainSnippet('สั้น', 50), 'สั้น', 'a short comment is not padded or cut')

// คลิปบอร์ดใส่ text/html มาแทบทุกครั้ง — เอาเฉพาะรูปแบบระดับบล็อกที่ข้อความล้วนแทนไม่ได้
eq(hasBlockMarkup('<table><tr><td>x</td></tr></table>'), true, 'a table cannot survive as plain text')
eq(hasBlockMarkup('<ul><li>x</li></ul>'), true, 'a list cannot either')
eq(hasBlockMarkup('<h2>หัวข้อ</h2>'), true, 'a heading counts')
eq(hasBlockMarkup('<img src="x">'), true, 'an image counts')
eq(hasBlockMarkup('<pre>code</pre>'), true, 'preformatted text counts')
// ก็อป URL จากเบราว์เซอร์ได้ <a> ติดมาทุกครั้ง — ถ้านับด้วย การวาง URL ธรรมดา
// จะกลายเป็นบล็อกที่แก้คำไม่ได้ และหลุดจากทาง @mention/จับวันที่
eq(hasBlockMarkup('<a href="https://x.co">x</a>'), false, 'a pasted link stays ordinary text')
eq(hasBlockMarkup('<b>ตัวหนา</b>'), false, 'bold alone is not worth taking over the paste')
eq(hasBlockMarkup('<span style="color:red">แค่ข้อความ</span>'), false, 'a bare span is not formatting')
eq(hasBlockMarkup('<p>ย่อหน้าเปล่า</p>'), false, 'a plain paragraph stays on the plain-text path')
// ชื่อแท็กต้องจบจริง ไม่ใช่แค่ขึ้นต้นตรงกัน
eq(hasBlockMarkup('<liquid>x</liquid>'), false, 'a tag that merely starts like li does not count')
eq(hasBlockMarkup('<table-of-contents>'), false, 'nor one that starts like table')
eq(hasBlockMarkup(''), false, 'nothing pasted is not rich')



// -- มอบหมายงานต้องล้างสถานะ "รับงานแล้ว" (utils/ackInbox: assignFields) --
// บั๊กจริงที่เจอ: หัวหน้ากดรับ ticket ไว้เอง แล้ว reassign ต่อ — ค่า IsAcknowledged
// ยังเป็น true ติดไปกับงาน ทำให้งานวิ่งเข้ารายการของคนใหม่ทันทีโดยไม่ผ่านกล่องรอรับงาน
const handOff = assignFields('somchai@its.co.th', 'สมชาย', 'boss@its.co.th', 'AssignedToName')
eq(handOff.base.AssignedEmail, 'somchai@its.co.th', 'the new owner is written')
eq(handOff.base.AssignedToName, 'สมชาย', 'the name goes in the field that list uses')
eq(handOff.ack.IsAcknowledged, false, 'handing work over resets the accepted flag')
eq(handOff.ack.AcknowledgedBy, null, 'the previous accepter name is cleared, not left behind')
eq(handOff.ack.AcknowledgedDate, null, 'and so is their timestamp')

// มอบหมายให้ตัวเอง = รู้อยู่แล้ว ไม่ต้องเด้งเข้ากล่องรอรับงานของตัวเอง
const toSelf = assignFields('boss@its.co.th', 'หัวหน้า', 'BOSS@its.co.th', 'AssignedTo')
eq(toSelf.ack.IsAcknowledged, true, 'assigning to yourself counts as already accepted')
eq(toSelf.ack.AcknowledgedBy, 'หัวหน้า', 'and records who that was')
eq(typeof toSelf.ack.AcknowledgedDate, 'string', 'with a real timestamp')
eq(toSelf.base.AssignedTo, 'หัวหน้า', 'the incident/task name field is used when asked for')

// ถอนผู้รับผิดชอบ
const unassign = assignFields('', '', 'boss@its.co.th', 'AssignedToName')
eq(unassign.base.AssignedEmail, null, 'clearing the assignee writes null, not an empty string')
eq(unassign.ack.IsAcknowledged, false, 'work with nobody on it is not accepted by anyone')

eq(assignFields('  a@b.co  ', 'A', 'x@y.co', 'AssignedTo').base.AssignedEmail, 'a@b.co',
  'a pasted email with spaces is trimmed before being stored')
eq(assignFields('a@b.co', 'A', undefined, 'AssignedTo').ack.IsAcknowledged, false,
  'not knowing who is acting still resets rather than assuming self-assignment')

eq(ackResetFields().IsAcknowledged, false, 'the reset shape is shared, not retyped per page')

// needsAck ต้องจับงานที่ถูกโยนต่อได้ หลังจากล้างค่าแล้ว
const handed = { id: 1, Title: 'จอดับ', AssignedEmail: 'somchai@its.co.th',
  Author: { Title: 'หัวหน้า', EMail: 'boss@its.co.th' }, Status: 'In Progress',
  ...assignFields('somchai@its.co.th', 'สมชาย', 'boss@its.co.th', 'AssignedToName').ack }
eq(needsAck(handed, 'Ticket', 'somchai@its.co.th'), true,
  'after the reset, handed-over work waits to be accepted')
// ก่อนแก้: ค่าเดิมติดมา แล้วงานหลุดกล่องรอรับงานไปเลย
eq(needsAck({ ...handed, IsAcknowledged: true }, 'Ticket', 'somchai@its.co.th'), false,
  'a stale accepted flag is exactly what let work skip the inbox')



// -- สร้างงานใหม่ก็ต้องผ่านกล่องรอรับงาน (ackOnCreate) --
// Ticket/Task ทำอยู่แล้ว แต่ Incident ตกไปทั้งใน Submit และใน Add-in
eq(ackOnCreate('somchai@its.co.th', 'boss@its.co.th').IsAcknowledged, false,
  'work created for someone else waits to be accepted')
eq(ackOnCreate('boss@its.co.th', 'BOSS@its.co.th').IsAcknowledged, true,
  'work you create for yourself is already accepted')
eq(ackOnCreate('  boss@its.co.th ', 'boss@its.co.th').IsAcknowledged, true,
  'stray spaces do not turn self-assignment into a queued item')
eq(ackOnCreate('', 'boss@its.co.th').IsAcknowledged, false,
  'work with nobody on it is not accepted by anyone')
eq(ackOnCreate(undefined, undefined).IsAcknowledged, false,
  'missing values do not crash and do not assume accepted')
eq(ackOnCreate('a@b.co', undefined).IsAcknowledged, false,
  'not knowing who created it errs toward requiring acceptance')
// ไม่ต้องมีชื่อ/วันที่ตอนสร้าง — ยังไม่มีใครรับ จะเขียนชื่อคนรับไปทำไม
eq(Object.keys(ackOnCreate('a@b.co', 'b@c.co')).join(','), 'IsAcknowledged',
  'creating work writes only the flag, not an accepter who does not exist yet')



// -- หา template อีเมล (services/emailService) --
// บั๊กจริง: ผู้ใช้เปิด template ไว้แล้ว แต่ระบบบอกว่า "ยังไม่ได้เปิด template"
// EventKey เป็นข้อความที่คนพิมพ์เองใน SharePoint ช่องว่างท้ายบรรทัดก็ทำให้หาไม่เจอ
const MAILTPL = [
  { id: 1, Title: 'รับงาน', EventKey: ' work_acknowledged ', Subject: 'ส', Body: 'บ', IsEnabled: true, Recipients: '' },
  { id: 2, Title: 'ปิดเคส', EventKey: 'Incident_Resolved', Subject: 'ส', Body: 'บ', IsEnabled: true, Recipients: '' },
  { id: 3, Title: 'ปิดไว้', EventKey: 'ticket_created', Subject: 'ส', Body: 'บ', IsEnabled: false, Recipients: '' },
]

eq(findTemplate(MAILTPL, 'work_acknowledged')?.id, 1, 'a stray space around the key does not hide the template')
eq(findTemplate(MAILTPL, 'incident_resolved')?.id, 2, 'the key match ignores letter case')
eq(findTemplate(MAILTPL, ' WORK_ACKNOWLEDGED ')?.id, 1, 'spaces and case together still match')
eq(findTemplate(MAILTPL, 'ticket_created'), undefined, 'a row switched off is not used')
eq(findTemplate(MAILTPL, 'ไม่มีอันนี้'), undefined, 'a key nobody added finds nothing')
eq(findTemplate([], 'work_acknowledged'), undefined, 'an empty list is not a crash')

// IsEnabled ถูกสร้างเป็น Yes/No, Choice หรือ Text ก็ได้ แล้วแต่คนสร้างลิสต์
eq(isOn(true), true, 'a real boolean works')
eq(isOn(false), false, 'and so does false')
eq(isOn('Yes'), true, 'a text column reading Yes counts as on')
eq(isOn('ใช่'), true, 'and so does the Thai word')
eq(isOn('No'), false, 'No is off')
eq(isOn('ปิด'), false, 'and so is the Thai word for closed')
eq(isOn(''), false, 'a blank value is off')
// ไม่มีคอลัมน์เลย = การมีแถวอยู่ก็คือความตั้งใจจะใช้แล้ว ดีกว่าเงียบเพราะคอลัมน์ที่ไม่มี
eq(isOn(undefined), true, 'a list with no IsEnabled column still sends')
eq(isOn(null), true, 'and so does a row that never set it')

// ข้อความต้องชี้ไปที่สิ่งที่ต้องไปแก้จริง ไม่ใช่บอกว่า "ยังไม่ได้เปิด" ทุกกรณี
eq(templateProblem(MAILTPL, 'ticket_created').includes('IsEnabled'), true,
  'a row that exists but is switched off says so')
eq(templateProblem(MAILTPL, 'work_assigned').includes('work_acknowledged'), true,
  'a near-miss key suggests what is actually in the list')
eq(templateProblem([], 'work_assigned').includes('0 แถว'), true,
  'an empty list says the list is empty rather than blaming a switch')
eq(templateProblem(MAILTPL, 'zzzzzz').includes('ไม่พบแถว'), true,
  'a key with nothing like it says the row is missing')



// -- แทนค่าลง template อีเมล: หนีอักขระเป็นค่าเริ่มต้น (utils/emailTemplate) --
// บั๊กจริง: ชื่อลูกค้า/คำอธิบาย/ข้อความปิดงาน ถูกยัดเข้าเมลดิบ ๆ พิมพ์ "<3" เมลก็เพี้ยน
eq(escapeHtml('a<b>&"\''), 'a&lt;b&gt;&amp;&quot;&#39;', 'every character that means something to HTML is escaped')
eq(renderTemplate('สวัสดี {{name}}', { name: '<script>x</script>' }).text, 'สวัสดี &lt;script&gt;x&lt;/script&gt;',
  'a plain variable cannot inject markup into the mail')
eq(renderTemplate('{{body}}', { body: html('<b>ok</b>') }).text, '<b>ok</b>',
  'a variable wrapped in html() is trusted as already-safe markup')
eq(renderTemplate('{{a}}-{{a}}', { a: 'x' }).text, 'x-x', 'the same variable can appear more than once')
// ตัวแปรที่โค้ดไม่ได้ส่ง: เดิมปล่อย {{sla_hours}} เป็นตัวหนังสือถึงลูกค้า
const missingR = renderTemplate('SLA {{sla_hours}} / {{nope}}', {})
eq(missingR.text, 'SLA  / ', 'an unknown variable is removed rather than shown as {{x}} to the customer')
eq(missingR.missing.join(','), 'sla_hours,nope', 'and every unknown variable is reported so Diagnostic can show it')
eq(renderTemplate('{{x}}{{x}}', {}).missing.length, 1, 'a repeated unknown variable is reported once')
eq(renderTemplate('', { a: 'x' }).text, '', 'an empty template is empty output')

eq(textToHtml('บรรทัด 1\nบรรทัด <2>').__html, 'บรรทัด 1<br>บรรทัด &lt;2&gt;',
  'multi-line text is escaped first and then given line breaks')
eq(textToHtml('a\r\nb').__html, 'a<br>b', 'Windows line endings do not leave a stray carriage return')
eq(textToHtml(undefined).__html, '', 'missing text is empty html, not "undefined"')
eq(isHtmlVar(html('x')), true, 'html() output is recognised')
eq(isHtmlVar('x'), false, 'a bare string is not')
eq(isHtmlVar({ __html: 1 }), false, 'a look-alike with the wrong type is not trusted')

// Subject เป็นข้อความล้วน — ไม่หนี แต่ก็ไม่ให้แท็กจากตัวแปร html หลุดเข้า
eq(renderSubject('[{{no}}] {{t}}', { no: 'TK-1', t: 'จอ <ดับ>' }), '[TK-1] จอ <ดับ>',
  'a subject keeps the characters as typed because it is not HTML')
eq(renderSubject('{{t}}', { t: html('<b>x</b>  y') }), 'x y', 'markup in an html var is stripped from a subject')
eq(renderSubject('{{t}}', {}), '', 'an unknown variable in a subject is blank')

eq(placeholdersOf('{{a}} {{b}} {{a}}').join(','), 'a,b', 'placeholders are listed once each')
eq(placeholdersOf(undefined).length, 0, 'no template means no placeholders')

// ลิงก์เข้าแอป — เดิม 6 จุดใช้ origin เปล่า ๆ พาไปหน้ารากที่ไม่มีแอป
const LOC = { origin: 'https://itservices.co.th', pathname: '/helpdesk/' }
eq(appLink('', LOC), 'https://itservices.co.th/helpdesk', 'the bare app link includes the folder the app lives in')
eq(appLink('/tickets/12', LOC), 'https://itservices.co.th/helpdesk/#/tickets/12', 'a route becomes a hash link into the app')
eq(appLink('tickets/12', LOC), 'https://itservices.co.th/helpdesk/#/tickets/12', 'a route without a leading slash still works')
eq(appLink('/x', { origin: 'https://itservices.co.th', pathname: '/helpdesk/index.html' }),
  'https://itservices.co.th/helpdesk/#/x', 'index.html in the path is not treated as a folder')
eq(appLink('/x', { origin: 'http://localhost:5173', pathname: '/' }), 'http://localhost:5173/#/x',
  'an app served from the root still gets a usable link')

// ข้อความบอกผู้ใช้ — ต้องบอกเหตุจริง และเงียบเมื่อไม่มีใครต้องรับ
eq(mailFailText('บันทึกแล้ว', { ok: true }, 'x', 'y'), null, 'success has nothing to warn about')
eq(mailFailText('บันทึกแล้ว', { ok: false, reason: 'no-recipient' }, 'x', 'y'), null,
  'nobody to send to is not an error worth a red toast')
eq(mailFailText('บันทึกแล้ว', { ok: false, reason: 'no-template', detail: 'ไม่พบแถว' }, 'x', 'y'),
  'บันทึกแล้ว แต่ไม่ได้ส่งเมล — ไม่พบแถว', 'a template problem shows the real cause from the lookup')
eq(mailFailText('บันทึกแล้ว', { ok: false, reason: 'no-template' }, 'work_assigned', 'y')!.includes('work_assigned'),
  true, 'with no detail it at least names the event key')
eq(mailFailText('ปิดงานแล้ว', { ok: false, reason: 'failed', detail: '403' }, 'x', 'ลูกค้ายังไม่เห็น'),
  'ปิดงานแล้ว แต่ส่งเมลไม่สำเร็จ — ลูกค้ายังไม่เห็น (403)', 'a send failure says who missed out and why')

// รายการตัวแปรต่อ event คือความจริงจากโค้ด — ทุก event ต้องมี link
eq(KNOWN_EVENTS.length, 13, 'thirteen events are actually sent by the code')
eq(KNOWN_EVENTS.every(k => EVENT_VARS[k].includes('link')), true, 'every mail can link back into the app')
eq(['ticket_status_changed','task_assigned','comment_mention','incident_status_changed'].every(k => KNOWN_EVENTS.includes(k)), true,
  'the four templates that used to have no sender are wired up now')


// -- งานที่ฉันแจ้ง/มอบหมายไป (dashboardWork: submittedByMe) --
// ปัญหา: ไม่กด Track ก็ไม่เห็นความคืบหน้าของงานที่สั่งทีมไป ต้องไปเปิดทีละใบ
const BOSS = 'boss@its.co.th'
const SUB = [
  ...ticketRows([
    { id: 1, Title: 'สั่งให้สมชาย', Status: 'Open', AssignedEmail: 'somchai@its.co.th', IsAcknowledged: false,
      Author: { Title: 'บอส', EMail: BOSS }, Modified: '2026-09-08T00:00:00Z' },
    { id: 2, Title: 'ทำเอง', Status: 'Open', AssignedEmail: BOSS, Author: { EMail: BOSS } },
    { id: 3, Title: 'คนอื่นสั่ง', Status: 'Open', AssignedEmail: 'somchai@its.co.th', Author: { EMail: 'x@its.co.th' } },
    { id: 4, Title: 'ยังไม่มีคนรับ', Status: 'Open', Author: { EMail: 'BOSS@its.co.th' }, Modified: '2026-09-01T00:00:00Z' },
    { id: 5, Title: 'จบแล้ว', Status: 'Closed', AssignedEmail: 'somchai@its.co.th', Author: { EMail: BOSS }, Modified: '2026-09-09T00:00:00Z' },
    { id: 6, Title: 'รับแล้วกำลังทำ', Status: 'In Progress', AssignedEmail: 'aree@its.co.th', IsAcknowledged: true, Author: { EMail: BOSS }, Modified: '2026-09-10T00:00:00Z' },
  ]),
  ...taskRows([
    { id: 9, Title: 'งานที่สั่ง', IsCompleted: false, AssignedEmail: 'aree@its.co.th', IsAcknowledged: false, CreatedByEmail: BOSS },
  ]),
]

const mineAll = submittedByMe(SUB, BOSS)
eq(mineAll.map(r => r.id).join(','), '1,4,9,6,5',
  'stuck work (not accepted / nobody on it) comes first, newest movement first within each group, done last')
eq(mineAll.some(r => r.id === 2), false, 'work I gave myself is not listed — it is already in My Work')
eq(mineAll.some(r => r.id === 3), false, 'work someone else raised is not mine to chase')
eq(submittedByMe(SUB, BOSS, { hideDone: true }).some(r => r.id === 5), false, 'finished work can be hidden')
eq(submittedByMe(SUB, BOSS, { kind: 'task' }).map(r => r.id).join(','), '9', 'the kind filter works across the mix')
eq(submittedByMe(SUB, '').length, 0, 'not knowing who I am lists nothing rather than everything')
eq(submittedByMe(SUB, 'nobody@its.co.th').length, 0, 'someone who raised nothing sees nothing')

const sm = submittedSummary(mineAll)
eq(sm.total, 5, 'the summary counts everything I raised for others')
eq(sm.unassigned, 1, 'work with nobody on it is the first number to chase')
eq(sm.waitingAck, 2, 'work handed over but not yet accepted is the second')
eq(sm.inProgress, 1, 'accepted and moving')
eq(sm.done, 1, 'finished')

eq(progressLabel(mineAll.find(r => r.id === 4)!).text, 'ยังไม่มีผู้รับผิดชอบ', 'no assignee reads as such')
eq(progressLabel(mineAll.find(r => r.id === 1)!).text, 'รอรับงาน', 'assigned but not accepted reads as waiting')
eq(progressLabel(mineAll.find(r => r.id === 6)!).text, 'กำลังทำ', 'accepted work reads as in progress')
eq(progressLabel(mineAll.find(r => r.id === 5)!).tone, 'green', 'finished work is green')
// requesterEmail มาจากคนสร้างแถว ไม่ใช่ลูกค้า — หัวหน้าแจ้งแทนลูกค้าก็ยังเป็นงานที่หัวหน้าแจ้ง
eq(ticketRows([{ id: 7, Title: 'x', CustomerEmail: 'cust@acme.co', Author: { EMail: BOSS } }])[0].requesterEmail, BOSS,
  'the person who raised the row is the requester, even when a customer is named')
eq(ticketRows([{ id: 8, Title: 'x', CustomerEmail: 'cust@acme.co' }])[0].requesterEmail, 'cust@acme.co',
  'with no author on the row the customer is the best guess')



// -- คนแจ้งสำรอง (utils/reporter) --
// ทีมรับเรื่องจากคนนอกแล้วมาเปิดเคสเอง ระบบเห็นแต่คนกดสร้าง — ต้องมีที่เก็บเจ้าของปัญหาจริง
eq(JSON.stringify(reporterFields('Ticket', { name: 'สมชาย', email: 'somchai@acme.co' })),
  '{"CustomerName":"สมชาย","CustomerEmail":"somchai@acme.co"}', 'a ticket keeps using its existing customer columns')
eq(JSON.stringify(reporterFields('Incident', { name: 'สมชาย', email: 'somchai@acme.co' })),
  '{"ReporterName":"สมชาย","ReporterEmail":"somchai@acme.co"}', 'an incident gets the new reporter columns')
eq(JSON.stringify(reporterFields('Task', { name: '  อารีย์ ', email: '' })), '{"ReporterName":"อารีย์"}',
  'a name alone is fine, and stray spaces are trimmed')
eq(JSON.stringify(reporterFields('Task', { name: '', email: 'a@b.co' })), '{"ReporterEmail":"a@b.co"}',
  'an email alone is fine too')
eq(JSON.stringify(reporterFields('Incident', { name: '', email: '  ' })), '{}',
  'nothing entered writes nothing — the creator is the reporter')
eq(isBlankReporter({ name: ' ', email: '' }), true, 'blank means self-reported')
eq(isBlankReporter({ name: '', email: 'x@y.co' }), false, 'any value means someone else reported it')

eq(reporterLine('สมชาย', 'somchai@acme.co'), 'สมชาย (somchai@acme.co)', 'the display line shows both')
eq(reporterLine('สมชาย', ''), 'สมชาย', 'name only shows the name')
eq(reporterLine('', 'somchai@acme.co'), 'somchai@acme.co', 'email only shows the email')
eq(reporterLine(undefined, undefined), '', 'nothing recorded shows nothing, so the row can be hidden')

// เจ้าของปัญหาจริงต้องได้เมลด้วย
eq(reporterWatchers('somchai@acme.co').join(','), 'somchai@acme.co', 'a reporter email joins the mail watchers')
eq(reporterWatchers('  ').length, 0, 'a blank reporter adds nobody')
eq(reporterWatchers(undefined).length, 0, 'a missing reporter adds nobody')



// -- สิทธิ์เข้าถึงหน้า: บันทึกทีเดียวหลายคน (utils/pagePerms) --
eq(parseKeys('projects, dashboard ,, tools').join('|'), 'projects|dashboard|tools', 'stored keys are split and cleaned')
eq(parseKeys(undefined).length, 0, 'no row means no pages')
eq(sameKeys(new Set(['a','b']), new Set(['b','a'])), true, 'order does not matter')
eq(sameKeys(new Set(['a']), new Set(['a','b'])), false, 'a missing key is a difference')

// ตัว "แก้แล้วยังไม่บันทึก" — บันทึกคนที่ไม่ได้แก้ = เสียเวลา, ข้ามคนที่แก้ = หายเงียบ
const savedP = new Map([['a@x.co', new Set(['projects'])], ['b@x.co', new Set(['tools'])]])
const draftP = new Map([
  ['a@x.co', new Set(['projects'])],            // เท่าเดิม
  ['b@x.co', new Set(['tools', 'dashboard'])],  // แก้
  ['c@x.co', new Set<string>()],                // คนใหม่ ยังไม่ติ๊ก
  ['d@x.co', new Set(['tools'])],               // คนใหม่ ติ๊กแล้ว
])
eq(dirtyEmails(draftP, savedP).join(','), 'b@x.co,d@x.co', 'only people whose draft differs from what is saved')
eq(dirtyEmails(new Map(), savedP).length, 0, 'nothing drafted means nothing to save')

const gp = groupPages([
  { key: 'x', group: 'system' as const }, { key: 'y', group: 'main' as const }, { key: 'z', group: 'main' as const },
])
eq(gp.map(g => g.group).join(','), 'main,system', 'groups come in a fixed order and empty groups are dropped')
eq(gp[0].pages.length, 2, 'pages land in their group')


console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
