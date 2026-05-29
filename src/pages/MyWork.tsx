import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Pin, CheckCircle2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { Task } from '../types/project'
import { getDueDateColor, getDueDateRowClass, getDueDateBadgeClass, getDueDateEmoji, formatDate } from '../utils/dateUtils'
import { getPriorityColor, getStatusColor } from '../utils/colorUtils'

type TabType = 'tickets' | 'tasks'

export default function MyWork() {
  const { user, addToast } = useAppStore()
  const [tab, setTab] = useState<TabType>('tickets')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user.role)
    const ticketFilter = isAgent
      ? `AssignedEmail eq '${user.email}'`
      : `CustomerEmail eq '${user.email}'`

    Promise.all([
      spGet<Ticket>('HD_Tickets', ticketFilter, undefined, 'Modified desc'),
      spGet<Task>('PM_Tasks', `AssignedEmail eq '${user.email}'`, undefined, 'DueDate asc'),
    ]).then(([t, tk]) => {
      setTickets(t)
      setTasks(tk)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  async function pinFocus(type: 'Ticket' | 'Task', item: Ticket | Task) {
    if (!user) return
    try {
      await spCreate('HD_Focus', {
        Title: item.Title,
        RefID: String(item.id),
        FocusType: type,
        FocusedBy: user.displayName,
        FocusedEmail: user.email,
        DueDate: (item as Ticket).DueDate ?? (item as Task).DueDate,
        Status: (item as Ticket).Status ?? (item as Task).IsCompleted ? 'Completed' : 'Active',
      })
      addToast('success', 'Pin ไว้ใน Focus Items แล้ว')
    } catch {
      addToast('error', 'ไม่สามารถ Pin ได้')
    }
  }

  async function acknowledgeTicket(ticket: Ticket) {
    if (!user) return
    try {
      await spUpdate('HD_Tickets', ticket.id, {
        IsAcknowledged: true,
        AcknowledgedBy: user.displayName,
        AcknowledgedDate: new Date().toISOString(),
      })
      setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, IsAcknowledged: true } : t))
      addToast('success', 'รับทราบ Ticket แล้ว')
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด')
    }
  }

  const filteredTickets = tickets.filter(t =>
    (!search || t.Title.toLowerCase().includes(search.toLowerCase()) || t.TicketNumber?.includes(search)) &&
    (!statusFilter || t.Status === statusFilter)
  )

  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const order: Record<string, number> = { red: 0, orange: 1, yellow: 2, normal: 3, gray: 4 }
    return (order[getDueDateColor(a.DueDate, a.Status === 'Closed')] ?? 3) -
           (order[getDueDateColor(b.DueDate, b.Status === 'Closed')] ?? 3)
  })

  const sortedTasks = [...tasks].sort((a, b) => {
    const order: Record<string, number> = { red: 0, orange: 1, yellow: 2, normal: 3, gray: 4 }
    return (order[getDueDateColor(a.DueDate, a.IsCompleted)] ?? 3) -
           (order[getDueDateColor(b.DueDate, b.IsCompleted)] ?? 3)
  })

  return (
    <div>
      <Header title="งานของฉัน" />
      <div className="p-4 md:p-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4 w-fit">
          {(['tickets', 'tasks'] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500'
              }`}
            >
              {t === 'tickets' ? `Tickets (${tickets.length})` : `Tasks (${tasks.length})`}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="ค้นหา..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-48"
            />
          </div>
          {tab === 'tickets' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
            >
              <option value="">สถานะทั้งหมด</option>
              {['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        {/* Tickets */}
        {tab === 'tickets' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : sortedTickets.length === 0
                ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Ticket</p>
                : sortedTickets.map(t => {
                    const color = getDueDateColor(t.DueDate, t.Status === 'Closed')
                    return (
                      <div key={t.id} className={`flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${getDueDateRowClass(color)}`}>
                        <span className="text-base w-5 text-center">{getDueDateEmoji(color)}</span>
                        <div className="flex-1 min-w-0">
                          <Link to={`/tickets/${t.id}`} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate block">
                            {t.Title}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400">{t.TicketNumber}</span>
                            {t.DueDate && <span className={`text-xs px-1.5 py-0.5 rounded ${getDueDateBadgeClass(color)}`}>{formatDate(t.DueDate)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={getPriorityColor(t.Priority)}>{t.Priority}</Badge>
                          <Badge className={getStatusColor(t.Status)}>{t.Status}</Badge>
                          {!t.IsAcknowledged && ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '') && (
                            <button
                              onClick={() => acknowledgeTicket(t)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-green-600"
                              title="รับทราบ"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}
                          <button onClick={() => pinFocus('Ticket', t)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600" title="Pin">
                            <Pin size={15} />
                          </button>
                        </div>
                      </div>
                    )
                  })
            }
          </div>
        )}

        {/* Tasks */}
        {tab === 'tasks' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : sortedTasks.length === 0
                ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Task</p>
                : sortedTasks.map(task => {
                    const color = getDueDateColor(task.DueDate, task.IsCompleted)
                    return (
                      <div key={task.id} className={`flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${getDueDateRowClass(color)}`}>
                        <span className="text-base w-5 text-center">{getDueDateEmoji(color)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.Title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.DueDate && <span className={`text-xs px-1.5 py-0.5 rounded ${getDueDateBadgeClass(color)}`}>{formatDate(task.DueDate)}</span>}
                            {task.IsAcknowledged && <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 size={11} /> รับทราบแล้ว</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {task.IsCompleted
                            ? <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800">Completed</Badge>
                            : <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Active</Badge>
                          }
                          <button onClick={() => pinFocus('Task', task)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600" title="Pin">
                            <Pin size={15} />
                          </button>
                        </div>
                      </div>
                    )
                  })
            }
          </div>
        )}
      </div>
    </div>
  )
}
