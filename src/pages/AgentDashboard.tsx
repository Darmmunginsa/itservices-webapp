import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { SkeletonCard, SkeletonRow } from '../components/common/Skeleton'
import { spGet } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import { getStatusColor, getPriorityColor } from '../utils/colorUtils'
import { formatDate, getDueDateColor, getDueDateRowClass, getDueDateEmoji } from '../utils/dateUtils'

export default function AgentDashboard() {
  const { user } = useAppStore()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')

  useEffect(() => {
    if (!user) return
    const isSupervisor = ['Supervisor', 'Boss', 'Admin'].includes(user.role)
    const filter = isSupervisor ? undefined : `AssignedEmail eq '${user.email}'`
    spGet<Ticket>('HD_Tickets', filter, undefined, 'Modified desc', 200)
      .then(setTickets).catch(() => {}).finally(() => setLoading(false))
  }, [user])

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
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="ค้นหา Ticket..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-48" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">สถานะทั้งหมด</option>
            {['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">Priority ทั้งหมด</option>
            {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
          </select>
          {['Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '') && (
            <input placeholder="กรอง Assigned Email..." value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-52" />
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-500 flex items-center gap-3">
            <span className="w-5" />
            <span className="flex-1">Ticket</span>
            <span className="w-24">Priority</span>
            <span className="w-24">Status</span>
            <span className="w-32 hidden md:block">Assigned</span>
            <span className="w-24 hidden md:block">Due Date</span>
          </div>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Ticket</p>
              : filtered.map(t => {
                  const color = getDueDateColor(t.DueDate, t.Status === 'Closed')
                  return (
                    <div key={t.id} className={`flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm ${getDueDateRowClass(color)}`}>
                      <span className="w-5 text-center">{getDueDateEmoji(color)}</span>
                      <div className="flex-1 min-w-0">
                        <Link to={`/tickets/${t.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate block">{t.Title}</Link>
                        <span className="text-xs text-gray-400">{t.TicketNumber}</span>
                      </div>
                      <span className="w-24"><Badge className={getPriorityColor(t.Priority)}>{t.Priority}</Badge></span>
                      <span className="w-24"><Badge className={getStatusColor(t.Status)}>{t.Status}</Badge></span>
                      <span className="w-32 hidden md:block text-xs text-gray-500 truncate">{t.AssignedToName || t.AssignedEmail || '-'}</span>
                      <span className="w-24 hidden md:block text-xs text-gray-500">{formatDate(t.DueDate)}</span>
                    </div>
                  )
                })
          }
        </div>
        <p className="text-xs text-gray-400">แสดง {filtered.length} จาก {tickets.length} Ticket</p>
      </div>
    </div>
  )
}
