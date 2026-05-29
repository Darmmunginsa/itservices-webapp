import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserCheck } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonCard, SkeletonRow } from '../components/common/Skeleton'
import { spGet, spUpdate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { AgentProfile } from '../types/common'
import { getStatusColor, getPriorityColor } from '../utils/colorUtils'
import { formatDate, getDueDateColor, getDueDateRowClass, getDueDateEmoji } from '../utils/dateUtils'

export default function AgentDashboard() {
  const { user, addToast } = useAppStore()
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
            <input placeholder="กรอง Agent Email..." value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-48" />
          )}
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 text-xs font-medium text-gray-500 flex items-center gap-3">
            <span className="w-5" />
            <span className="flex-1">Ticket</span>
            <span className="w-20">Priority</span>
            <span className="w-24">Status</span>
            <span className="w-32 hidden md:block">Assigned</span>
            <span className="w-24 hidden md:block">Due Date</span>
            {canAssign && <span className="w-20 text-center">Assign</span>}
          </div>

          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Ticket</p>
              : filtered.map(t => {
                  const color = getDueDateColor(t.DueDate, t.Status === 'Closed')
                  return (
                    <div key={t.id} className={`flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm ${getDueDateRowClass(color)}`}>
                      <span className="w-5 text-center flex-shrink-0">{getDueDateEmoji(color)}</span>
                      <div className="flex-1 min-w-0">
                        <Link to={`/tickets/${t.id}`} className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate block">{t.Title}</Link>
                        <span className="text-xs text-gray-400">{t.TicketNumber}</span>
                      </div>
                      <span className="w-20 flex-shrink-0"><Badge className={getPriorityColor(t.Priority)}>{t.Priority}</Badge></span>
                      <span className="w-24 flex-shrink-0"><Badge className={getStatusColor(t.Status)}>{t.Status}</Badge></span>
                      <span className="w-32 hidden md:block text-xs text-gray-500 truncate flex-shrink-0">
                        {t.AssignedToName || t.AssignedEmail || <span className="text-orange-400 italic">ยังไม่ assign</span>}
                      </span>
                      <span className="w-24 hidden md:block text-xs text-gray-500 flex-shrink-0">{formatDate(t.DueDate)}</span>
                      {canAssign && (
                        <span className="w-20 flex-shrink-0 flex justify-center">
                          <button
                            onClick={() => { setAssignTarget(t); setSelectedAgentEmail(t.AssignedEmail ?? '') }}
                            className="p-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-400 hover:text-primary-600 transition-colors"
                            title="Assign Agent"
                          >
                            <UserCheck size={15} />
                          </button>
                        </span>
                      )}
                    </div>
                  )
                })
          }
        </div>
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
