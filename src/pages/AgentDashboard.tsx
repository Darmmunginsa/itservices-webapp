import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserCheck } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonCard, SkeletonRow } from '../components/common/Skeleton'
import { DataTable, type Column } from '../components/common/DataTable'
import { spGet, spUpdate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { AgentProfile } from '../types/common'
import { getStatusColor, getPriorityColor } from '../utils/colorUtils'
import { formatDate, getDueDateColor, getDueDateRowClass, getDueDateEmoji } from '../utils/dateUtils'

export default function AgentDashboard() {
  const { user, addToast } = useAppStore()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')

  // Quick-assign modal
  const [assignTarget, setAssignTarget] = useState<Ticket | null>(null)
  const [selectedAgentEmail, setSelectedAgentEmail] = useState('')
  const [assigning, setAssigning] = useState(false)

  function loadTickets() {
    if (!user) return
    const isSupervisor = ['Supervisor', 'Boss', 'Admin'].includes(user.role)
    const filter = isSupervisor ? undefined : `AssignedEmail eq '${user.email}'`
    spGet<Ticket>('HD_Tickets', filter, undefined, 'Modified desc', 200)
      .then(setTickets).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user) return
    loadTickets()
    spGet<AgentProfile>('HD_AgentProfiles', 'IsAvailable eq true', undefined, 'Title asc')
      .then(setAgents).catch(() => {})
  }, [user])

  async function doAssign() {
    if (!assignTarget || !selectedAgentEmail) return
    const agent = agents.find(a => a.EmailText === selectedAgentEmail)
    setAssigning(true)
    try {
      await spUpdate('HD_Tickets', assignTarget.id, {
        AssignedEmail: selectedAgentEmail,
        AssignedToName: agent?.Title ?? '',
        Status: assignTarget.Status === 'Open' ? 'In Progress' : assignTarget.Status,
      })
      addToast('success', `Assign ให้ ${agent?.Title} แล้ว`)
      setAssignTarget(null)
      setSelectedAgentEmail('')
      loadTickets()
    } catch {
      addToast('error', 'Assign ไม่สำเร็จ')
    } finally {
      setAssigning(false)
    }
  }

  const filtered = tickets.filter(t =>
    (!search || t.Title.toLowerCase().includes(search.toLowerCase()) || t.TicketNumber?.includes(search)) &&
    (!statusFilter || t.Status === statusFilter) &&
    (!priorityFilter || t.Priority === priorityFilter) &&
    (!assignedFilter || t.AssignedEmail?.includes(assignedFilter))
  )

  const stats = {
    open: tickets.filter(t => t.Status === 'Open').length,
    inProgress: tickets.filter(t => t.Status === 'In Progress').length,
    pending: tickets.filter(t => t.Status === 'Pending').length,
    resolved: tickets.filter(t => ['Resolved', 'Closed'].includes(t.Status)).length,
  }

  const statCards = [
    { label: 'Open',        value: stats.open,       color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/10' },
    { label: 'In Progress', value: stats.inProgress,  color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10' },
    { label: 'Pending',     value: stats.pending,     color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/10' },
    { label: 'Resolved',    value: stats.resolved,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/10' },
  ]

  const canAssign = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  // เรียงตามลำดับความเร่งด่วน/ขั้นตอนจริง ไม่ใช่ตามตัวอักษร (กด asc = ด่วนสุด/ค้างสุดขึ้นก่อน)
  const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
  const STATUS_ORDER: Record<string, number> = { Open: 0, 'In Progress': 1, Pending: 2, Resolved: 3, Closed: 4 }

  const ticketColumns: Column<Ticket>[] = [
    { key: 'due_icon', label: '', align: 'center',
      render: t => <span>{getDueDateEmoji(getDueDateColor(t.DueDate, t.Status === 'Closed'))}</span> },
    { key: 'number', label: 'Ticket No.', sortValue: t => t.TicketNumber ?? '',
      render: t => <span className="text-xs font-mono text-gray-500">{t.TicketNumber || '—'}</span> },
    { key: 'title', label: 'หัวข้อ', sortValue: t => t.Title,
      render: t => <span className="font-medium text-gray-900 dark:text-gray-100">{t.Title}</span> },
    { key: 'priority', label: 'Priority', sortValue: t => PRIORITY_ORDER[t.Priority ?? ''] ?? 9,
      render: t => <Badge className={getPriorityColor(t.Priority)}>{t.Priority}</Badge> },
    { key: 'status', label: 'สถานะ', sortValue: t => STATUS_ORDER[t.Status ?? ''] ?? 9,
      render: t => <Badge className={getStatusColor(t.Status)}>{t.Status}</Badge> },
    { key: 'assigned', label: 'ผู้รับผิดชอบ', sortValue: t => t.AssignedToName || t.AssignedEmail || 'zzz',
      render: t => t.AssignedToName || t.AssignedEmail
        ? <span className="text-xs text-gray-600 dark:text-gray-300">{t.AssignedToName || t.AssignedEmail}</span>
        : <span className="text-xs text-orange-500 italic">ยังไม่ assign</span> },
    { key: 'customer', label: 'ผู้แจ้ง', sortValue: t => t.CustomerName || t.CustomerEmail || '',
      render: t => <span className="text-xs text-gray-500">{t.CustomerName || t.CustomerEmail || '—'}</span> },
    { key: 'due', label: 'กำหนดส่ง', sortValue: t => t.DueDate ?? '',
      render: t => <span className="text-xs text-gray-500">{t.DueDate ? formatDate(t.DueDate) : '—'}</span> },
    { key: 'modified', label: 'อัปเดตล่าสุด', sortValue: t => t.Modified ?? '',
      render: t => <span className="text-xs text-gray-400">{t.Modified ? formatDate(t.Modified) : '—'}</span> },
    ...(canAssign ? [{
      key: 'assign', label: 'Assign', align: 'center' as const,
      render: (t: Ticket) => (
        <button onClick={e => { e.stopPropagation(); setAssignTarget(t); setSelectedAgentEmail(t.AssignedEmail ?? '') }}
          className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 transition-colors"
          title="Assign Agent">
          <UserCheck size={15} />
        </button>
      ),
    }] : []),
  ]

  return (
    <div>
      <Header title="Agent Dashboard" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : statCards.map(s => (
              <Card key={s.label}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              </Card>
            ))
          }
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="ค้นหา Ticket..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">สถานะทั้งหมด</option>
            {['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">Priority ทั้งหมด</option>
            {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
          </select>
          {['Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '') && (
            <input placeholder="กรอง Agent Email..." value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
          )}
        </div>

        {/* Table — เรียงได้ทุกคอลัมน์ (คลิกหัวคอลัมน์) */}
        {loading ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : (
          <DataTable
            rows={filtered}
            rowKey={t => t.id}
            onRowClick={t => navigate(`/tickets/${t.id}`)}
            emptyText="ไม่มี Ticket"
            rowClass={t => getDueDateRowClass(getDueDateColor(t.DueDate, t.Status === 'Closed'))}
            columns={ticketColumns}
          />
        )}
        <p className="text-xs text-gray-400">แสดง {filtered.length} จาก {tickets.length} Ticket</p>
      </div>

      {/* Quick Assign Modal */}
      <Modal open={!!assignTarget} onClose={() => setAssignTarget(null)} title="Assign Agent" size="sm">
        {assignTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium truncate">{assignTarget.Title}</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">เลือก Agent</label>
              <select value={selectedAgentEmail} onChange={e => setSelectedAgentEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">-- ยังไม่ Assign --</option>
                {agents.map(a => (
                  <option key={a.id} value={a.EmailText}>
                    {a.Title}{a.SupportGroup ? ` · ${a.SupportGroup}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400">หาก Ticket เป็น Open จะเปลี่ยนสถานะเป็น In Progress อัตโนมัติ</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setAssignTarget(null)}>ยกเลิก</Button>
              <Button size="sm" disabled={assigning || !selectedAgentEmail} onClick={doAssign}>
                {assigning ? 'กำลัง Assign...' : 'Assign'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
