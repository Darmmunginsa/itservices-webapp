import { useEffect, useState } from 'react'
import { BarChart3, Ticket as TicketIcon, Clock } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Skeleton } from '../components/common/Skeleton'
import { Donut, BarChart, Columns } from '../components/common/Charts'
import { spGet } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

export default function Reports() {
  const { user } = useAppStore()
  const isBoss = ['Boss', 'Admin'].includes(user?.role ?? '')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [scopeAll, setScopeAll] = useState(false)   // Boss/Admin can toggle to all

  const mine = !isBoss || !scopeAll          // non-boss always sees own

  useEffect(() => {
    setLoading(true)
    const ticketFilter = mine ? `AssignedEmail eq '${user?.email}'` : undefined
    spGet<Ticket>('HD_Tickets', ticketFilter, 'Id,Title,Status,Priority,DueDate,ResolvedDate,Created,AssignedEmail', 'Created desc', 1000)
      .then(setTickets).catch(() => {}).finally(() => setLoading(false))
  }, [mine, user?.email])

  // ── Ticket analytics ──
  const TICKET_STATUSES = [
    { key: 'Open', color: '#3b82f6' }, { key: 'In Progress', color: '#f59e0b' },
    { key: 'Pending', color: '#a855f7' }, { key: 'Resolved', color: '#22c55e' }, { key: 'Closed', color: '#94a3b8' },
  ]
  const byStatus = TICKET_STATUSES.map(s => ({ label: s.key, value: tickets.filter(t => t.Status === s.key).length, color: s.color }))
  const PRIORITIES = [
    { key: 'Critical', color: '#ef4444' }, { key: 'High', color: '#f97316' },
    { key: 'Medium', color: '#eab308' }, { key: 'Low', color: '#22c55e' },
  ]
  const byPriority = PRIORITIES.map(p => ({ label: p.key, value: tickets.filter(t => t.Priority === p.key).length, color: p.color }))

  // SLA: on-time = resolved before DueDate; overdue = open & past DueDate
  const now = new Date()
  const withDue = tickets.filter(t => t.DueDate)
  const onTime = withDue.filter(t => t.ResolvedDate && new Date(t.ResolvedDate) <= new Date(t.DueDate!)).length
  const overdue = withDue.filter(t => !t.ResolvedDate && new Date(t.DueDate!) < now).length
  const breached = withDue.filter(t => t.ResolvedDate && new Date(t.ResolvedDate) > new Date(t.DueDate!)).length
  const slaTotal = onTime + overdue + breached
  const slaPct = slaTotal ? Math.round((onTime / slaTotal) * 100) : 100

  // Ticket trend last 6 months
  const trend = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const count = tickets.filter(t => {
      if (!t.Created) return false
      const c = new Date(t.Created)
      return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
    }).length
    return { label: MONTHS_TH[d.getMonth()], value: count }
  })

  const resolved = tickets.filter(t => t.Status === 'Resolved' || t.Status === 'Closed').length

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
                className={`px-3 py-1.5 font-medium transition-colors ${!scopeAll ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>ของฉัน</button>
              <button onClick={() => setScopeAll(true)}
                className={`px-3 py-1.5 font-medium transition-colors ${scopeAll ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>ทั้งองค์กร</button>
            </div>
          ) : (
            <span className="text-xs font-medium text-primary-600">เฉพาะของฉัน</span>
          )}
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI icon={<TicketIcon size={18} className="text-blue-600" />} label="Ticket ทั้งหมด" value={tickets.length} bg="bg-blue-50 dark:bg-blue-900/10" />
          <KPI icon={<Clock size={18} className="text-green-600" />} label="SLA ตรงเวลา" value={`${slaPct}%`} bg="bg-green-50 dark:bg-green-900/10" sub={`${overdue} เกินกำหนด`} />
          <KPI icon={<BarChart3 size={18} className="text-violet-600" />} label="ปิดงานแล้ว" value={resolved} bg="bg-violet-50 dark:bg-violet-900/10" />
          <KPI icon={<Clock size={18} className="text-red-600" />} label="ค้างเกินกำหนด" value={overdue} bg="bg-red-50 dark:bg-red-900/10" />
        </div>

        {/* Ticket charts */}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-sm font-semibold mb-4">แนวโน้ม Ticket (6 เดือน)</h3>
            <Columns data={trend} />
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-4">SLA Compliance</h3>
            <Donut data={[
              { label: 'ตรงเวลา', value: onTime, color: '#22c55e' },
              { label: 'เกินกำหนด (ค้าง)', value: overdue, color: '#ef4444' },
              { label: 'ปิดช้ากว่ากำหนด', value: breached, color: '#f59e0b' },
            ].filter(d => d.value > 0)} />
            {slaTotal === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี Ticket ที่กำหนด Due Date</p>}
          </Card>
        </div>
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
