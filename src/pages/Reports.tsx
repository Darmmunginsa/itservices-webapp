import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Ticket as TicketIcon, Clock, Users, TrendingUp, TrendingDown, Award, Building2, CalendarDays, FileDown, FileSpreadsheet, Info, Minus } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useT } from '../i18n/useT'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { Skeleton } from '../components/common/Skeleton'
import { Donut, BarChart, ColumnsPair } from '../components/common/Charts'
import { spGet } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { LeaveRequest } from '../types/common'
import {
  PRESETS, presetRange, previousRange, buildBuckets, pickBucket, rangeLabel,
  toDateInput, fromDateInput, odata, inRange, type PresetKey, type Range,
} from '../utils/period'
import {
  periodStats, buildPersonRows, delta, countBy, isClosed, SCORE_WEIGHTS,
  type TicketLike, type IncidentLike, type TaskLike,
} from '../utils/reportMetrics'

const TICKET_STATUSES = [
  { key: 'Open',        color: '#3b82f6' },
  { key: 'In Progress', color: '#f59e0b' },
  { key: 'Pending',     color: '#a855f7' },
  { key: 'Resolved',    color: '#22c55e' },
  { key: 'Closed',      color: '#94a3b8' },
]
const PRIORITIES = [
  { key: 'Critical', color: '#ef4444' },
  { key: 'High',     color: '#f97316' },
  { key: 'Medium',   color: '#eab308' },
  { key: 'Low',      color: '#22c55e' },
]

const TICKET_COLS = 'Id,Title,Status,Priority,Category,DueDate,ResolvedDate,Created,AssignedEmail,CustomerEmail,CustomerName,AssignedTo/Title'

const fmtHours = (h: number | null): string => {
  if (h === null) return '-'
  if (h < 24) return `${Math.round(h)} ชม.`
  return `${(h / 24).toFixed(1)} วัน`
}
const pct = (v: number | null, digits = 0): string => v === null ? '-' : `${v.toFixed(digits)}%`

export default function Reports() {
  const { user } = useAppStore()
  const tr = useT()
  const isBoss = ['Boss', 'Admin'].includes(user?.role ?? '')

  const [preset, setPreset] = useState<PresetKey>('this-month')
  const [customFrom, setCustomFrom] = useState(toDateInput(presetRange('this-month').start))
  const [customTo, setCustomTo]     = useState(toDateInput(new Date()))
  const [scopeAll, setScopeAll]     = useState(false)
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState('')

  const [tickets, setTickets]     = useState<TicketLike[]>([])
  const [incidents, setIncidents] = useState<IncidentLike[]>([])
  const [tasks, setTasks]         = useState<TaskLike[]>([])
  const [leaves, setLeaves]       = useState<LeaveRequest[]>([])

  const mine = !isBoss || !scopeAll

  const range: Range = useMemo(() => {
    if (preset !== 'custom') return presetRange(preset)
    const s = fromDateInput(customFrom)
    const e = fromDateInput(customTo, true)
    if (!s || !e || s > e) return presetRange('this-month')
    return { start: s, end: e }
  }, [preset, customFrom, customTo])

  const prev = useMemo(() => previousRange(range), [range])

  useEffect(() => {
    setLoading(true)
    setLoadError('')
    const emailFilter = mine ? `AssignedEmail eq '${user?.email}'` : ''
    const and = (a: string, b: string) => a && b ? `${a} and ${b}` : a || b

    // ตั๋วที่ต้องใช้ = เปิดในช่วงนี้/ช่วงก่อน + ปิดในช่วงนี้/ช่วงก่อน (แม้เปิดมานาน) + ที่ยังค้างอยู่
    // ดึงแยกกันแล้วรวมด้วย id เพราะ OData ซ้อน or/and ยาว ๆ กับลิสต์ใหญ่มักพัง
    const openStatuses = "Status ne 'Closed' and Status ne 'Resolved'"
    const queries = [
      spGet<Ticket>('HD_Tickets', and(emailFilter, `Created ge ${odata(prev.start)}`), TICKET_COLS, 'Created desc', 3000, 'AssignedTo'),
      spGet<Ticket>('HD_Tickets', and(emailFilter, `ResolvedDate ge ${odata(prev.start)}`), TICKET_COLS, 'Created desc', 3000, 'AssignedTo').catch(() => [] as Ticket[]),
      spGet<Ticket>('HD_Tickets', and(emailFilter, openStatuses), TICKET_COLS, 'Created desc', 3000, 'AssignedTo').catch(() => [] as Ticket[]),
    ]

    Promise.all([
      Promise.all(queries),
      spGet<IncidentLike>('PM_Incidents', mine ? `AssignedEmail eq '${user?.email}'` : undefined,
        'Id,Severity,Status,AssignedEmail,ResolvedDate,Created', 'Created desc', 2000).catch(() => [] as IncidentLike[]),
      spGet<TaskLike>('PM_Tasks', undefined, 'Id,IsCompleted,AssignedEmail,DueDate', 'DueDate desc', 3000)
        .catch(() => [] as TaskLike[]),
      spGet<LeaveRequest>('HD_LeaveRequests',
        `LeaveDate ge '${toDateInput(range.start)}' and LeaveDate le '${toDateInput(range.end)}'`,
        'Id,Title,LeaveDate,LeaveType,RequestedBy,RequestedEmail,Status,Created', 'LeaveDate desc', 2000)
        .catch(() => [] as LeaveRequest[]),
    ]).then(([ticketSets, inc, tk, lv]) => {
      const byId = new Map<number, TicketLike>()
      for (const set of ticketSets) for (const t of set) byId.set(t.id, t as TicketLike)
      setTickets([...byId.values()])
      setIncidents(inc)
      setTasks(tk)
      setLeaves(lv)
    }).catch(() => setLoadError('โหลดข้อมูลรายงานไม่สำเร็จ — ลองแคบช่วงเวลาลง'))
      .finally(() => setLoading(false))
  }, [mine, user?.email, range, prev.start])

  /** Export PDF ผ่าน print dialog — ถอดธีมมืดชั่วคราว ไม่งั้นพิมพ์ออกมาพื้นดำ */
  function exportPdf() {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    if (wasDark) root.classList.remove('dark')
    const restore = () => {
      if (wasDark) root.classList.add('dark')
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    setTimeout(restore, 60_000)
    window.print()
  }

  const now = new Date()

  // ── ตัวเลขหลัก + เทียบช่วงก่อนหน้า ──
  const cur  = useMemo(() => periodStats(tickets, range, now), [tickets, range])   // eslint-disable-line react-hooks/exhaustive-deps
  const past = useMemo(() => periodStats(tickets, prev, now),  [tickets, prev])    // eslint-disable-line react-hooks/exhaustive-deps

  const inPeriod = useMemo(
    () => tickets.filter(t => inRange(t.Created, range) || inRange(t.ResolvedDate, range)),
    [tickets, range])

  const byStatus   = TICKET_STATUSES.map(s => ({ label: s.key, value: inPeriod.filter(t => t.Status === s.key).length, color: s.color }))
  const byPriority = PRIORITIES.map(p => ({ label: p.key, value: inPeriod.filter(t => t.Priority === p.key).length, color: p.color }))
  const byCategory = countBy(inPeriod, t => t.Category || '').slice(0, 10)

  // งานเข้า vs งานปิด ต่อช่วงย่อย — บอกทิศทางว่าตามงานทันไหม
  const flow = useMemo(() => {
    const buckets = buildBuckets(range, pickBucket(range))
    return buckets.map(b => ({
      label: b.label,
      a: tickets.filter(t => inRange(t.Created, b)).length,
      b: tickets.filter(t => inRange(t.ResolvedDate, b)).length,
    }))
  }, [tickets, range])

  const personRows = useMemo(
    () => buildPersonRows(tickets, incidents, tasks, leaves, range, now),
    [tickets, incidents, tasks, leaves, range])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── ลูกค้า ──
  const INTERNAL_DOMAIN = '@itservices.co.th'
  const custRows = useMemo(() => {
    const m = new Map<string, { name: string; email: string; ts: TicketLike[] }>()
    for (const t of inPeriod) {
      const raw = t.CustomerEmail || '(ไม่ระบุ)'
      const internal = raw.toLowerCase().includes(INTERNAL_DOMAIN)
      const key = internal ? '__internal__' : raw
      const name = internal ? 'ภายใน (Internal)' : (t.CustomerName || raw)
      if (!m.has(key)) m.set(key, { name, email: key, ts: [] })
      m.get(key)!.ts.push(t)
    }
    return [...m.values()].map(c => ({
      ...c,
      total: c.ts.length,
      open: c.ts.filter(t => !isClosed(t)).length,
      closed: c.ts.filter(t => isClosed(t)).length,
      critical: c.ts.filter(t => t.Priority === 'Critical' || t.Priority === 'High').length,
    })).sort((a, b) => b.total - a.total)
  }, [inPeriod])

  const leaveApproved = leaves.filter(l => l.Status === 'Approved')

  async function exportExcel() {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      const summary = [
        ['รายงานผลงาน Helpdesk'],
        [`ช่วงเวลา: ${rangeLabel(range)}`],
        [`เทียบกับ: ${rangeLabel(prev)}`],
        [`ขอบเขต: ${scopeAll ? 'ทั้งองค์กร' : 'เฉพาะของฉัน'} · ออกโดย ${user?.displayName ?? '-'} · ${new Date().toLocaleString('th-TH')}`],
        [],
        ['ตัวชี้วัด', 'ช่วงนี้', 'ช่วงก่อน', 'เปลี่ยนแปลง %'],
        ['งานรับเข้า', cur.created, past.created, delta(cur.created, past.created)?.toFixed(1) ?? '-'],
        ['ปิดได้', cur.closed, past.closed, delta(cur.closed, past.closed)?.toFixed(1) ?? '-'],
        ['อัตราปิดงาน %', cur.closeRate === null ? '-' : (cur.closeRate * 100).toFixed(0), past.closeRate === null ? '-' : (past.closeRate * 100).toFixed(0), ''],
        ['ปิดทันกำหนด (SLA) %', cur.slaPct?.toFixed(0) ?? '-', past.slaPct?.toFixed(0) ?? '-', ''],
        [`  ฐานที่ใช้คิด SLA (ใบ)`, cur.slaSample, past.slaSample, ''],
        ['  ตั้ง due date (% ของงานที่ปิด)', cur.dueSetPct?.toFixed(0) ?? '-', past.dueSetPct?.toFixed(0) ?? '-', ''],
        ['เวลาปิดกลาง (ชม.)', cur.medianHours?.toFixed(1) ?? '-', past.medianHours?.toFixed(1) ?? '-', ''],
        ['เวลาปิดเฉลี่ย (ชม.)', cur.avgHours?.toFixed(1) ?? '-', past.avgHours?.toFixed(1) ?? '-', ''],
        ['ค้าง ณ สิ้นช่วง', cur.backlogEnd, past.backlogEnd, ''],
        ['ค้างเกินกำหนด (ตอนนี้)', cur.overdueNow, '', ''],
      ]

      const people = [
        ['ผลงานรายคน — ' + rangeLabel(range)],
        [`คะแนนรวมถ่วงน้ำหนัก: ปริมาณ ${SCORE_WEIGHTS.volume}% · ตรงเวลา ${SCORE_WEIGHTS.quality}% · ความเร็ว ${SCORE_WEIGHTS.speed}%`],
        ['คะแนนเทียบกันเองภายในทีมในช่วงนี้ ไม่ใช่มาตรฐานกลาง และไม่ได้วัดความยากของงาน'],
        [],
        ['ชื่อ', 'อีเมล', 'คะแนน', 'รับมอบหมาย', 'ปิดได้', 'สัดส่วนงานที่ปิด %', 'ตรงเวลา', 'สาย', 'SLA %', 'ตั้ง due date %',
          'เวลาปิดกลาง (ชม.)', 'เวลาปิดเฉลี่ย (ชม.)', 'ค้างอยู่', 'เลยกำหนด', 'Incident ที่ปิด',
          'งานโครงการครบกำหนด', 'งานโครงการเสร็จ', 'วันลาที่อนุมัติ'],
        ...personRows.map(r => [
          r.name, r.email, r.score ?? '-', r.assigned, r.closed, r.sharePct.toFixed(1),
          r.onTime, r.late, r.slaPct?.toFixed(0) ?? '-', r.dueSetPct?.toFixed(0) ?? '-',
          r.medianHours?.toFixed(1) ?? '-', r.avgHours?.toFixed(1) ?? '-',
          r.openNow, r.overdueNow, r.incidents, r.tasksDue, r.tasksDone, r.leaveDays,
        ]),
      ]

      const customers = [
        ['Ticket รายลูกค้า — ' + rangeLabel(range)],
        [],
        ['ลูกค้า', 'อีเมล', 'ทั้งหมด', 'ค้างอยู่', 'ปิดแล้ว', 'Critical/High', 'สัดส่วน %'],
        ...custRows.map(c => [c.name, c.email === '__internal__' ? '' : c.email, c.total, c.open, c.closed, c.critical,
          inPeriod.length ? ((c.total / inPeriod.length) * 100).toFixed(1) : '0']),
      ]

      const mk = (rows: unknown[][], widths: number[]) => {
        const ws = XLSX.utils.aoa_to_sheet(rows as never)
        ws['!cols'] = widths.map(w => ({ wch: w }))
        return ws
      }
      XLSX.utils.book_append_sheet(wb, mk(summary, [26, 12, 12, 14]), 'สรุปภาพรวม')
      XLSX.utils.book_append_sheet(wb, mk(people, [22, 28, 8, 12, 9, 16, 9, 7, 8, 16, 17, 18, 9, 10, 13, 20, 17, 15]), 'ผลงานรายคน')
      XLSX.utils.book_append_sheet(wb, mk(customers, [26, 28, 10, 10, 10, 14, 10]), 'รายลูกค้า')
      XLSX.writeFile(wb, `report-${toDateInput(range.start)}_${toDateInput(range.end)}.xlsx`)
    } catch {
      setLoadError('สร้างไฟล์ Excel ไม่สำเร็จ')
    }
  }

  const inputCx = 'text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900'

  return (
    <div>
      <Header title={tr('reports.header')} />
      <div className="p-4 md:p-6 space-y-6">

        {/* หัวรายงาน — เห็นเฉพาะตอนพิมพ์ PDF */}
        <div className="print-only mb-4 pb-3" style={{ borderBottom: '2px solid #111' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            รายงานผลงาน Helpdesk — {scopeAll ? 'ทั้งองค์กร' : 'เฉพาะของฉัน'}
          </h1>
          <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            ช่วง {rangeLabel(range)} · เทียบกับ {rangeLabel(prev)}<br />
            iT Services · ออกรายงานโดย {user?.displayName ?? '-'} · {new Date().toLocaleString('th-TH')}
          </p>
        </div>

        {/* แถบควบคุม — ช่วงเวลา + ขอบเขต + ส่งออก */}
        <Card className="no-print">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">ช่วงเวลา</span>
            <div className="flex flex-wrap rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
              {PRESETS.map(p => (
                <button key={p.key} onClick={() => setPreset(p.key)}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${preset === p.key ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  {p.labelTh}
                </button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)} className={inputCx} />
                <span className="text-xs text-gray-400">ถึง</span>
                <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)} className={inputCx} />
              </div>
            )}

            <span className="text-xs text-gray-500 ml-2">{tr('reports.scope')}</span>
            {isBoss ? (
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
                <button onClick={() => setScopeAll(false)}
                  className={`px-3 py-1.5 font-medium transition-colors ${!scopeAll ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{tr('reports.mine')}</button>
                <button onClick={() => setScopeAll(true)}
                  className={`px-3 py-1.5 font-medium transition-colors ${scopeAll ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>{tr('reports.org')}</button>
              </div>
            ) : (
              <span className="text-xs font-medium text-primary-600">{tr('reports.onlyMine')}</span>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={exportExcel} disabled={loading}>
                <FileSpreadsheet size={14} /> Excel
              </Button>
              <Button size="sm" variant="secondary" onClick={exportPdf} disabled={loading}>
                <FileDown size={14} /> PDF
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            {rangeLabel(range)} · เทียบกับช่วงก่อนหน้า {rangeLabel(prev)}
          </p>
          {loadError && <p className="text-xs text-red-500 mt-1">{loadError}</p>}
        </Card>

        {loading ? <Skeleton className="h-96" /> : (
        <>
        {/* KPI + การเปลี่ยนแปลงเทียบช่วงก่อน */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPI icon={<TicketIcon size={16} className="text-blue-600" />} bg="bg-blue-50 dark:bg-blue-900/10"
            label="งานรับเข้า" value={cur.created} change={delta(cur.created, past.created)} higherIsBetter={null} />
          <KPI icon={<BarChart3 size={16} className="text-green-600" />} bg="bg-green-50 dark:bg-green-900/10"
            label="ปิดได้" value={cur.closed} change={delta(cur.closed, past.closed)} higherIsBetter />
          <KPI icon={<TrendingUp size={16} className="text-violet-600" />} bg="bg-violet-50 dark:bg-violet-900/10"
            label="อัตราปิดงาน" value={pct(cur.closeRate === null ? null : cur.closeRate * 100)}
            change={delta(cur.closeRate, past.closeRate)} higherIsBetter sub="ปิดได้ ÷ รับเข้า" />
          <KPI icon={<Clock size={16} className="text-emerald-600" />} bg="bg-emerald-50 dark:bg-emerald-900/10"
            label="ปิดทันกำหนด" value={pct(cur.slaPct)} change={delta(cur.slaPct, past.slaPct)} higherIsBetter
            sub={cur.slaSample ? `จาก ${cur.slaSample} ใบ (ตั้ง due date ${pct(cur.dueSetPct)} ของงานที่ปิด)` : 'ยังไม่มีใบที่ตั้ง due date'} />
          <KPI icon={<Clock size={16} className="text-amber-600" />} bg="bg-amber-50 dark:bg-amber-900/10"
            label="เวลาปิดกลาง" value={fmtHours(cur.medianHours)}
            change={delta(cur.medianHours, past.medianHours)} higherIsBetter={false} sub="ค่ากลาง — ไม่ถูกงานเดียวลากเพี้ยน" />
          <KPI icon={<Clock size={16} className="text-red-600" />} bg="bg-red-50 dark:bg-red-900/10"
            label="ค้างสะสม" value={cur.backlogEnd} change={delta(cur.backlogEnd, past.backlogEnd)} higherIsBetter={false}
            sub={`เลยกำหนดแล้ว ${cur.overdueNow}`} />
        </div>

        {/* ทิศทาง: งานเข้า vs งานปิด */}
        <Card>
          <h3 className="text-sm font-semibold mb-1">งานเข้า vs งานปิด</h3>
          <p className="text-[11px] text-gray-400 mb-3">แท่งน้ำเงินสูงกว่าเขียวติดกันหลายช่วง = งานค้างกำลังสะสม ต้องเพิ่มคนหรือลดงานรับเข้า</p>
          <ColumnsPair data={flow} labels={['รับเข้า', 'ปิดได้']} />
        </Card>

        {/* สัดส่วนงาน */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm font-semibold mb-4">{tr('reports.byStatus')}</h3>
            <Donut data={byStatus.filter(d => d.value > 0)} />
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-4">{tr('reports.byPriority')}</h3>
            <BarChart data={byPriority} />
          </Card>
        </div>

        {byCategory.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2"><TrendingUp size={15} className="text-primary-600" /> {tr('reports.byCategory')}</h3>
            <p className="text-[11px] text-gray-400 mb-3">หมวดที่โตขึ้นเรื่อย ๆ คือจุดที่ควรลงทุนแก้ที่ต้นเหตุ แทนการรับแจ้งซ้ำ</p>
            <div className="space-y-2">
              {byCategory.map(c => (
                <div key={c.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-40 truncate flex-shrink-0">{c.label}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${inPeriod.length ? Math.round((c.value / inPeriod.length) * 100) : 0}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{c.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ผลงานรายคน */}
        <Card>
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Users size={15} className="text-primary-600" />
            {scopeAll ? 'ผลงานรายคน' : 'สรุปผลงานของฉัน'}
          </h3>
          <p className="text-[11px] text-gray-400 mb-3">
            คะแนนรวม = ปริมาณ {SCORE_WEIGHTS.volume}% · ตรงเวลา {SCORE_WEIGHTS.quality}% · ความเร็ว {SCORE_WEIGHTS.speed}%
            — เทียบกันเองภายในทีมในช่วงนี้
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 pr-3 font-medium text-gray-500 min-w-[150px]">{tr('reports.member')}</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">คะแนน</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">รับ</th>
                  <th className="text-center py-2 px-2 font-medium text-green-600">ปิดได้</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">สัดส่วน</th>
                  <th className="text-center py-2 px-2 font-medium text-emerald-600">ตรงเวลา</th>
                  <th className="text-center py-2 px-2 font-medium text-amber-600">สาย</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">SLA</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500" title="สัดส่วนงานที่ปิดซึ่งมีการตั้ง due date — ต่ำ = SLA ข้างซ้ายวัดจากงานส่วนน้อย เทียบกับคนอื่นไม่ได้เต็มปาก">
                    ตั้ง due date
                  </th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">เวลาปิดกลาง</th>
                  <th className="text-center py-2 px-2 font-medium text-blue-500">ค้าง</th>
                  <th className="text-center py-2 px-2 font-medium text-red-500">เลยกำหนด</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">Incident</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">งานโครงการ</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">วันลา</th>
                </tr>
              </thead>
              <tbody>
                {personRows.map((r, i) => (
                  <tr key={r.email} className={`border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${i === 0 && scopeAll && r.score !== null ? 'bg-amber-50/40 dark:bg-amber-900/5' : ''}`}>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        {i === 0 && scopeAll && r.score !== null && <Award size={12} className="text-amber-500 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[140px]">{r.name}</p>
                          <p className="text-gray-400 truncate max-w-[140px]">{r.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-2">
                      {r.score === null ? <span className="text-gray-300" title="ไม่มีงานในช่วงนี้">-</span> : (
                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${
                          r.score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : r.score >= 55 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>{r.score}</span>
                      )}
                    </td>
                    <td className="text-center py-2.5 px-2 text-gray-600 dark:text-gray-300">{r.assigned || '-'}</td>
                    <td className="text-center py-2.5 px-2 font-semibold text-green-600">{r.closed || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-gray-500">{r.sharePct ? `${r.sharePct.toFixed(0)}%` : '-'}</td>
                    <td className="text-center py-2.5 px-2 text-emerald-600">{r.onTime || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-amber-600">{r.late || '-'}</td>
                    <td className="text-center py-2.5 px-2">
                      {r.slaPct === null ? <span className="text-gray-300" title="ไม่มีงานที่ตั้ง due date จึงวัดไม่ได้">-</span> : (
                        <span className={`font-medium ${r.slaPct >= 80 ? 'text-green-600' : r.slaPct >= 60 ? 'text-amber-500' : 'text-red-500'} ${r.dueSetPct !== null && r.dueSetPct < 50 ? 'opacity-50 line-through decoration-1' : ''}`}
                          title={r.dueSetPct !== null && r.dueSetPct < 50 ? 'วัดจากงานไม่ถึงครึ่ง — ยังเทียบกับคนอื่นไม่ได้' : undefined}>
                          {r.slaPct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    {/* ความครอบคลุมของข้อมูล — ต่ำแปลว่า SLA ช่องซ้ายวัดจากงานส่วนน้อย */}
                    <td className="text-center py-2.5 px-2">
                      {r.dueSetPct === null ? <span className="text-gray-300">-</span> : (
                        <span className={r.dueSetPct >= 80 ? 'text-gray-500' : r.dueSetPct >= 50 ? 'text-amber-600 font-medium' : 'text-red-500 font-semibold'}>
                          {r.dueSetPct.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="text-center py-2.5 px-2 text-gray-500">{fmtHours(r.medianHours)}</td>
                    <td className="text-center py-2.5 px-2 text-blue-600">{r.openNow || '-'}</td>
                    <td className="text-center py-2.5 px-2">
                      {r.overdueNow > 0
                        ? <span className="inline-block bg-red-100 dark:bg-red-900/30 text-red-600 rounded px-1.5 font-medium">{r.overdueNow}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-center py-2.5 px-2 text-gray-500">{r.incidents || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-gray-500">{r.tasksDue ? `${r.tasksDone}/${r.tasksDue}` : '-'}</td>
                    <td className="text-center py-2.5 px-2 text-gray-500">{r.leaveDays || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {personRows.length === 0 && <p className="text-center text-sm text-gray-400 py-8">{tr('reports.noData')}</p>}
          </div>

          {/* ข้อจำกัดของตัวเลข — ต้องอ่านก่อนเอาไปตัดสินคน */}
          <div className="mt-4 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3">
            <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-900 dark:text-blue-300 space-y-0.5">
              <p className="font-semibold">อ่านก่อนใช้ตัดสินใจเรื่องค่าตอบแทน</p>
              <p>• ตัวเลขนับ "จำนวนงาน" ไม่ได้วัด "ความยากของงาน" — ปิดงานเล็ก 20 ใบ กับแก้ปัญหาใหญ่ 3 ใบ ขึ้นหน้าจอไม่เท่ากัน</p>
              <p>• SLA คิดเฉพาะใบที่ตั้ง due date ดูคอลัมน์ <b>"ตั้ง due date"</b> คู่กันเสมอ — ถ้าต่ำกว่า 50% ตัวเลข SLA จะถูกขีดฆ่าไว้ เพราะวัดจากงานไม่ถึงครึ่ง</p>
              <p>• คนที่ไม่ตั้ง due date เลยจะไม่มี SLA และ<b>ไม่ถูกคิดคะแนนด้านตรงเวลา</b> — คะแนนรวมจะมาจากปริมาณกับความเร็วเท่านั้น ต้องดูคอลัมน์นี้ก่อนเทียบคะแนนกัน</p>
              <p>• งานที่ไม่ได้มอบหมายให้ใคร จะไม่ถูกนับให้ใครเลย</p>
              <p>• คนที่ลาส่วนใหญ่ของช่วงจะมีปริมาณงานต่ำโดยธรรมชาติ — ดูคอลัมน์วันลาประกอบ</p>
            </div>
          </div>
        </Card>

        {/* ลูกค้า */}
        <Card>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 size={15} className="text-primary-600" /> Ticket รายลูกค้า
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 min-w-[160px]">{tr('reports.customer')}</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">{tr('reports.total')}</th>
                  <th className="text-center py-2 px-2 font-medium text-blue-500">ค้างอยู่</th>
                  <th className="text-center py-2 px-2 font-medium text-green-600">{tr('reports.closed')}</th>
                  <th className="text-center py-2 px-2 font-medium text-red-500">Critical/High</th>
                  <th className="text-left py-2 pl-3 font-medium text-gray-500">{tr('reports.share')}</th>
                </tr>
              </thead>
              <tbody>
                {custRows.map(c => (
                  <tr key={c.email} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[150px]">{c.name}</p>
                      {c.email !== '__internal__' && <p className="text-gray-400 truncate max-w-[150px]">{c.email}</p>}
                    </td>
                    <td className="text-center py-2.5 px-2 font-semibold text-gray-800 dark:text-gray-200">{c.total}</td>
                    <td className="text-center py-2.5 px-2 text-blue-600">{c.open || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-green-600 font-medium">{c.closed || '-'}</td>
                    <td className="text-center py-2.5 px-2">
                      {c.critical > 0
                        ? <span className="inline-block bg-red-100 dark:bg-red-900/30 text-red-600 rounded px-1.5 font-medium">{c.critical}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="py-2.5 pl-3 w-32">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${inPeriod.length ? Math.round((c.total / inPeriod.length) * 100) : 0}%` }} />
                        </div>
                        <span className="text-gray-400 text-[10px] w-6 text-right">{inPeriod.length ? Math.round((c.total / inPeriod.length) * 100) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {custRows.length === 0 && <p className="text-center text-sm text-gray-400 py-8">{tr('reports.noData')}</p>}
          </div>
        </Card>

        {/* การลา — อิงช่วงเวลาเดียวกับรายงาน */}
        <Card>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CalendarDays size={15} className="text-primary-600" /> การลางานในช่วงนี้
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{leaveApproved.length}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{tr('reports.approvedDays')}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{leaves.filter(l => l.Status === 'Pending').length}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{tr('reports.waiting')}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-red-500">{leaves.filter(l => l.Status === 'Rejected').length}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{tr('reports.rejected')}</p>
            </div>
          </div>
          {countBy(leaveApproved, l => l.LeaveType || '').length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 mb-2">แยกตามประเภทลา (อนุมัติแล้ว)</p>
              {countBy(leaveApproved, l => l.LeaveType || '').map(lt => (
                <div key={lt.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-28 truncate flex-shrink-0">{lt.label}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.round((lt.value / leaveApproved.length) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{lt.value}</span>
                </div>
              ))}
            </div>
          )}
          {leaves.length === 0 && <p className="text-center text-sm text-gray-400 py-6">{tr('reports.noLeaveYear')}</p>}
        </Card>
        </>
        )}
      </div>
    </div>
  )
}

/**
 * การ์ดตัวชี้วัด + ลูกศรเทียบช่วงก่อนหน้า
 * higherIsBetter: true = มากขึ้นดี, false = น้อยลงดี, null = ไม่ตัดสิน (เช่นงานรับเข้า — เยอะไม่ได้แปลว่าดีหรือแย่)
 */
function KPI({ icon, label, value, bg, sub, change, higherIsBetter }: {
  icon: React.ReactNode
  label: string
  value: string | number
  bg: string
  sub?: string
  change?: number | null
  higherIsBetter?: boolean | null
}) {
  const good = change === null || change === undefined || higherIsBetter === null || higherIsBetter === undefined
    ? null
    : (change >= 0) === higherIsBetter
  const Arrow = change === null || change === undefined ? Minus : change >= 0 ? TrendingUp : TrendingDown
  const tone = good === null ? 'text-gray-400' : good ? 'text-green-600' : 'text-red-500'
  return (
    <Card className="!p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`p-1.5 rounded-lg ${bg}`}>{icon}</div>
        <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">{value}</p>
        {change !== null && change !== undefined && (
          <span className={`flex items-center gap-0.5 text-[11px] font-medium ${tone}`} title="เทียบกับช่วงก่อนหน้า">
            <Arrow size={11} />{Math.abs(change).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <p className="text-[10px] text-gray-400 mt-1 leading-tight">{sub}</p>}
    </Card>
  )
}
