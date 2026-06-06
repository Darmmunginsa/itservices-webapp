import { useEffect, useState } from 'react'
import { BarChart3, Ticket as TicketIcon, Clock, Users, TrendingUp, Award, Building2, CalendarDays } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Skeleton } from '../components/common/Skeleton'
import { Donut, BarChart, Columns } from '../components/common/Charts'
import { spGet } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { LeaveRequest } from '../types/common'

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

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

export default function Reports() {
  const { user } = useAppStore()
  const isBoss = ['Boss', 'Admin'].includes(user?.role ?? '')
  const [tickets, setTickets]   = useState<Ticket[]>([])
  const [leaves, setLeaves]     = useState<LeaveRequest[]>([])
  const [loading, setLoading]   = useState(true)
  const [scopeAll, setScopeAll] = useState(false)
  const [leaveYear, setLeaveYear] = useState(new Date().getFullYear())

  const mine = !isBoss || !scopeAll

  useEffect(() => {
    setLoading(true)
    const filter = mine ? `AssignedEmail eq '${user?.email}'` : undefined
    Promise.all([
      spGet<Ticket>('HD_Tickets', filter,
        'Id,Title,Status,Priority,Category,DueDate,ResolvedDate,Created,AssignedEmail,CustomerEmail,CustomerName,AssignedTo/Title',
        'Created desc', 2000, 'AssignedTo'),
      spGet<LeaveRequest>('HD_LeaveRequests',
        `LeaveDate ge '${leaveYear}-01-01' and LeaveDate le '${leaveYear}-12-31'`,
        'Id,Title,LeaveDate,LeaveType,RequestedBy,RequestedEmail,Status,Created',
        'LeaveDate desc', 2000),
    ]).then(([t, l]) => { setTickets(t); setLeaves(l) })
      .catch(() => {}).finally(() => setLoading(false))
  }, [mine, user?.email, leaveYear])

  const now = new Date()

  // ── Aggregates ──────────────────────────────────────────────────────────────
  const byStatus   = TICKET_STATUSES.map(s => ({ label: s.key, value: tickets.filter(t => t.Status === s.key).length, color: s.color }))
  const byPriority = PRIORITIES.map(p => ({ label: p.key, value: tickets.filter(t => t.Priority === p.key).length, color: p.color }))

  const withDue = tickets.filter(t => t.DueDate)
  const onTime  = withDue.filter(t => t.ResolvedDate && new Date(t.ResolvedDate) <= new Date(t.DueDate!)).length
  const overdue = withDue.filter(t => !t.ResolvedDate && new Date(t.DueDate!) < now).length
  const breached = withDue.filter(t => t.ResolvedDate && new Date(t.ResolvedDate) > new Date(t.DueDate!)).length
  const slaTotal = onTime + overdue + breached
  const slaPct   = slaTotal ? Math.round((onTime / slaTotal) * 100) : 100

  const resolved = tickets.filter(t => t.Status === 'Resolved' || t.Status === 'Closed').length

  // Ticket trend last 6 months
  const trend = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      label: MONTHS_TH[d.getMonth()],
      value: tickets.filter(t => {
        if (!t.Created) return false
        const c = new Date(t.Created)
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
      }).length,
    }
  })

  // ── Per-agent breakdown ──────────────────────────────────────────────────────
  const agentMap = new Map<string, { name: string; tickets: Ticket[] }>()
  for (const t of tickets) {
    const email = t.AssignedEmail || '(ไม่ได้กำหนด)'
    const raw = (t as Ticket & { AssignedTo?: { Title?: string } | string }).AssignedTo
    const name = (typeof raw === 'object' ? raw?.Title : raw) || email
    if (!agentMap.has(email)) agentMap.set(email, { name, tickets: [] })
    agentMap.get(email)!.tickets.push(t)
  }
  const agentRows = Array.from(agentMap.entries())
    .map(([email, { name, tickets: ts }]) => {
      const agentWithDue = ts.filter(t => t.DueDate)
      const aOnTime  = agentWithDue.filter(t => t.ResolvedDate && new Date(t.ResolvedDate) <= new Date(t.DueDate!)).length
      const aBreached = agentWithDue.filter(t => t.ResolvedDate && new Date(t.ResolvedDate) > new Date(t.DueDate!)).length
      const aOverdue = agentWithDue.filter(t => !t.ResolvedDate && new Date(t.DueDate!) < now).length
      const aSlaTotal = aOnTime + aBreached + aOverdue
      const aSla = aSlaTotal ? Math.round((aOnTime / aSlaTotal) * 100) : null

      // Avg resolution time (hours)
      const resolvedTs = ts.filter(t => t.ResolvedDate && t.Created)
      const avgHours = resolvedTs.length
        ? Math.round(resolvedTs.reduce((sum, t) => {
            const diff = new Date(t.ResolvedDate!).getTime() - new Date(t.Created).getTime()
            return sum + diff / 3600000
          }, 0) / resolvedTs.length)
        : null

      return {
        email, name,
        total: ts.length,
        open:  ts.filter(t => t.Status === 'Open').length,
        inProgress: ts.filter(t => t.Status === 'In Progress').length,
        pending: ts.filter(t => t.Status === 'Pending').length,
        closed: ts.filter(t => t.Status === 'Resolved' || t.Status === 'Closed').length,
        overdue: aOverdue,
        sla: aSla,
        avgHours,
      }
    })
    .sort((a, b) => b.total - a.total)

  // ── Category breakdown ──────────────────────────────────────────────────────
  const catMap = new Map<string, number>()
  for (const t of tickets) {
    const c = t.Category || 'ไม่ระบุ'
    catMap.set(c, (catMap.get(c) || 0) + 1)
  }
  const byCategory = Array.from(catMap.entries())
    .map(([label, value]) => ({ label, value, color: '#6366f1' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  // ── Customer breakdown ──────────────────────────────────────────────────────
  const custMap = new Map<string, { name: string; email: string; tickets: Ticket[] }>()
  for (const t of tickets) {
    const email = t.CustomerEmail || '(ไม่ระบุ)'
    const name  = t.CustomerName  || email
    if (!custMap.has(email)) custMap.set(email, { name, email, tickets: [] })
    custMap.get(email)!.tickets.push(t)
  }
  const custRows = Array.from(custMap.values())
    .map(c => ({
      ...c,
      total:      c.tickets.length,
      open:       c.tickets.filter(t => t.Status === 'Open').length,
      inProgress: c.tickets.filter(t => t.Status === 'In Progress').length,
      closed:     c.tickets.filter(t => t.Status === 'Resolved' || t.Status === 'Closed').length,
      critical:   c.tickets.filter(t => t.Priority === 'Critical' || t.Priority === 'High').length,
    }))
    .sort((a, b) => b.total - a.total)

  // ── Leave breakdown ──────────────────────────────────────────────────────────
  const leavePersonMap = new Map<string, { name: string; leaves: LeaveRequest[] }>()
  for (const l of leaves) {
    const email = l.RequestedEmail || l.RequestedBy || '?'
    if (!leavePersonMap.has(email)) leavePersonMap.set(email, { name: l.RequestedBy || email, leaves: [] })
    leavePersonMap.get(email)!.leaves.push(l)
  }
  const leaveRows = Array.from(leavePersonMap.values())
    .map(p => {
      const approved = p.leaves.filter(l => l.Status === 'Approved')
      const typeMap = new Map<string, number>()
      for (const l of approved) typeMap.set(l.LeaveType, (typeMap.get(l.LeaveType) || 0) + 1)
      return {
        name:     p.name,
        total:    p.leaves.length,
        approved: approved.length,
        pending:  p.leaves.filter(l => l.Status === 'Pending').length,
        rejected: p.leaves.filter(l => l.Status === 'Rejected').length,
        byType:   Array.from(typeMap.entries()).map(([t, n]) => `${t} ${n}วัน`).join(', '),
      }
    })
    .sort((a, b) => b.approved - a.approved)

  const leaveTypeTotal = new Map<string, number>()
  for (const l of leaves.filter(x => x.Status === 'Approved')) {
    leaveTypeTotal.set(l.LeaveType, (leaveTypeTotal.get(l.LeaveType) || 0) + 1)
  }
  const leaveTypeData = Array.from(leaveTypeTotal.entries())
    .map(([label, value]) => ({ label, value, color: '#6366f1' }))
    .sort((a, b) => b.value - a.value)

  if (loading) return <div className="p-6"><Skeleton className="h-96" /></div>

  return (
    <div>
      <Header title="รายงาน / Reports" />
      <div className="p-4 md:p-6 space-y-6">

        {/* Scope toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">ขอบเขตข้อมูล:</span>
          {isBoss ? (
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
              <button onClick={() => setScopeAll(false)}
                className={`px-3 py-1.5 font-medium transition-colors ${!scopeAll ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>ของฉัน</button>
              <button onClick={() => setScopeAll(true)}
                className={`px-3 py-1.5 font-medium transition-colors ${scopeAll ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>ทั้งองค์กร</button>
            </div>
          ) : (
            <span className="text-xs font-medium text-primary-600">เฉพาะของฉัน</span>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI icon={<TicketIcon size={18} className="text-blue-600" />}   label="Ticket ทั้งหมด"    value={tickets.length}  bg="bg-blue-50 dark:bg-blue-900/10" />
          <KPI icon={<Clock size={18} className="text-green-600" />}       label="SLA ตรงเวลา"       value={`${slaPct}%`}    bg="bg-green-50 dark:bg-green-900/10"  sub={`${overdue} เกินกำหนด`} />
          <KPI icon={<BarChart3 size={18} className="text-violet-600" />}  label="ปิดงานแล้ว"        value={resolved}        bg="bg-violet-50 dark:bg-violet-900/10" />
          <KPI icon={<Clock size={18} className="text-red-600" />}         label="ค้างเกินกำหนด"     value={overdue}         bg="bg-red-50 dark:bg-red-900/10" />
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm font-semibold mb-4">Ticket ตามสถานะ</h3>
            <Donut data={byStatus.filter(d => d.value > 0)} />
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-4">Ticket ตามความสำคัญ</h3>
            <BarChart data={byPriority} />
          </Card>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm font-semibold mb-4">แนวโน้ม Ticket (6 เดือน)</h3>
            <Columns data={trend} />
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-4">SLA Compliance</h3>
            <Donut data={[
              { label: 'ตรงเวลา',           value: onTime,   color: '#22c55e' },
              { label: 'เกินกำหนด (ค้าง)',  value: overdue,  color: '#ef4444' },
              { label: 'ปิดช้ากว่ากำหนด',   value: breached, color: '#f59e0b' },
            ].filter(d => d.value > 0)} />
            {slaTotal === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี Ticket ที่กำหนด Due Date</p>}
          </Card>
        </div>

        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp size={15} className="text-primary-600" /> Ticket ตามหมวดหมู่</h3>
            <div className="space-y-2">
              {byCategory.map(c => (
                <div key={c.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-36 truncate flex-shrink-0">{c.label}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.round((c.value / tickets.length) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{c.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Per-agent breakdown — show when org scope or own data only 1 agent */}
        <Card>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Users size={15} className="text-primary-600" />
            {scopeAll ? 'ผลงานรายสมาชิก' : 'สรุปผลงานของฉัน'}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 min-w-[140px]">สมาชิก</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">ทั้งหมด</th>
                  <th className="text-center py-2 px-2 font-medium text-blue-500">Open</th>
                  <th className="text-center py-2 px-2 font-medium text-amber-500">กำลังทำ</th>
                  <th className="text-center py-2 px-2 font-medium text-purple-500">Pending</th>
                  <th className="text-center py-2 px-2 font-medium text-green-600">ปิดแล้ว</th>
                  <th className="text-center py-2 px-2 font-medium text-red-500">ค้าง</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">SLA%</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">เฉลี่ย (ชม.)</th>
                </tr>
              </thead>
              <tbody>
                {agentRows.map((a, i) => (
                  <tr key={a.email} className={`border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${i === 0 && scopeAll ? 'bg-amber-50/40 dark:bg-amber-900/5' : ''}`}>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        {i === 0 && scopeAll && <Award size={12} className="text-amber-500 flex-shrink-0" />}
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[130px]">{a.name}</p>
                          <p className="text-gray-400 truncate max-w-[130px]">{a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-2.5 px-2 font-semibold text-gray-800 dark:text-gray-200">{a.total}</td>
                    <td className="text-center py-2.5 px-2 text-blue-600">{a.open || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-amber-600">{a.inProgress || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-purple-600">{a.pending || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-green-600 font-medium">{a.closed || '-'}</td>
                    <td className="text-center py-2.5 px-2">
                      {a.overdue > 0
                        ? <span className="inline-block bg-red-100 dark:bg-red-900/30 text-red-600 rounded px-1.5 font-medium">{a.overdue}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-center py-2.5 px-2">
                      {a.sla !== null
                        ? <span className={`font-medium ${a.sla >= 80 ? 'text-green-600' : a.sla >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{a.sla}%</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-center py-2.5 px-2 text-gray-500">
                      {a.avgHours !== null ? `${a.avgHours}h` : <span className="text-gray-300">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {agentRows.length === 0 && <p className="text-center text-sm text-gray-400 py-8">ไม่มีข้อมูล</p>}
          </div>
        </Card>

        {/* Customer breakdown */}
        <Card>
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Building2 size={15} className="text-primary-600" /> Ticket รายลูกค้า
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 min-w-[160px]">ลูกค้า</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">ทั้งหมด</th>
                  <th className="text-center py-2 px-2 font-medium text-blue-500">Open</th>
                  <th className="text-center py-2 px-2 font-medium text-amber-500">กำลังทำ</th>
                  <th className="text-center py-2 px-2 font-medium text-green-600">ปิดแล้ว</th>
                  <th className="text-center py-2 px-2 font-medium text-red-500">Critical/High</th>
                  <th className="text-left py-2 pl-3 font-medium text-gray-500">สัดส่วน</th>
                </tr>
              </thead>
              <tbody>
                {custRows.map(c => (
                  <tr key={c.email} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[150px]">{c.name}</p>
                      <p className="text-gray-400 truncate max-w-[150px]">{c.email}</p>
                    </td>
                    <td className="text-center py-2.5 px-2 font-semibold text-gray-800 dark:text-gray-200">{c.total}</td>
                    <td className="text-center py-2.5 px-2 text-blue-600">{c.open || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-amber-600">{c.inProgress || '-'}</td>
                    <td className="text-center py-2.5 px-2 text-green-600 font-medium">{c.closed || '-'}</td>
                    <td className="text-center py-2.5 px-2">
                      {c.critical > 0
                        ? <span className="inline-block bg-red-100 dark:bg-red-900/30 text-red-600 rounded px-1.5 font-medium">{c.critical}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="py-2.5 pl-3 w-32">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.round((c.total / tickets.length) * 100)}%` }} />
                        </div>
                        <span className="text-gray-400 text-[10px] w-6 text-right">{Math.round((c.total / tickets.length) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {custRows.length === 0 && <p className="text-center text-sm text-gray-400 py-8">ไม่มีข้อมูล</p>}
          </div>
        </Card>

        {/* Leave breakdown */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays size={15} className="text-primary-600" /> การลางานพนักงาน
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">ปี:</span>
              <select value={leaveYear} onChange={e => setLeaveYear(Number(e.target.value))}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-900">
                {[leaveYear - 1, leaveYear, leaveYear + 1].map(y => <option key={y} value={y}>{y + 543}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{leaves.filter(l => l.Status === 'Approved').length}</p>
              <p className="text-xs text-gray-500 mt-0.5">อนุมัติแล้ว (วัน)</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{leaves.filter(l => l.Status === 'Pending').length}</p>
              <p className="text-xs text-gray-500 mt-0.5">รอพิจารณา</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-500">{leaves.filter(l => l.Status === 'Rejected').length}</p>
              <p className="text-xs text-gray-500 mt-0.5">ไม่อนุมัติ</p>
            </div>
          </div>

          {leaveTypeData.length > 0 && (
            <div className="mb-4 space-y-1.5">
              <p className="text-xs font-medium text-gray-500 mb-2">แยกตามประเภทลา (Approved)</p>
              {leaveTypeData.map(lt => (
                <div key={lt.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 truncate flex-shrink-0">{lt.label}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-500"
                      style={{ width: `${Math.round((lt.value / leaves.filter(l => l.Status === 'Approved').length) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{lt.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 min-w-[140px]">พนักงาน</th>
                  <th className="text-center py-2 px-2 font-medium text-gray-500">คำขอทั้งหมด</th>
                  <th className="text-center py-2 px-2 font-medium text-green-600">อนุมัติ</th>
                  <th className="text-center py-2 px-2 font-medium text-amber-500">รอ</th>
                  <th className="text-center py-2 px-2 font-medium text-red-500">ไม่อนุมัติ</th>
                  <th className="text-left py-2 pl-3 font-medium text-gray-500">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {leaveRows.map(r => (
                  <tr key={r.name} className="border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[130px]">{r.name}</p>
                    </td>
                    <td className="text-center py-2.5 px-2 font-semibold text-gray-800 dark:text-gray-200">{r.total}</td>
                    <td className="text-center py-2.5 px-2 text-green-600 font-medium">{r.approved || '-'}</td>
                    <td className="text-center py-2.5 px-2">
                      {r.pending > 0
                        ? <span className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded px-1.5 font-medium">{r.pending}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="text-center py-2.5 px-2">
                      {r.rejected > 0
                        ? <span className="inline-block bg-red-100 dark:bg-red-900/30 text-red-500 rounded px-1.5">{r.rejected}</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="py-2.5 pl-3 text-gray-400 truncate max-w-[200px]">{r.byType || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leaveRows.length === 0 && <p className="text-center text-sm text-gray-400 py-8">ไม่มีข้อมูลการลาในปีนี้</p>}
          </div>
        </Card>

      </div>
    </div>
  )
}

function KPI({ icon, label, value, bg, sub }: { icon: React.ReactNode; label: string; value: string | number; bg: string; sub?: string }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}
