import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Pin, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { Task, ProjectIncident } from '../types/project'
import { getDueDateColor, getDueDateRowClass, getDueDateBadgeClass, getDueDateEmoji, formatDate } from '../utils/dateUtils'
import { getPriorityColor, getStatusColor, getSeverityColor } from '../utils/colorUtils'

type TabType = 'tickets' | 'tasks' | 'incidents'

const DONE_TICKET_STATUSES = new Set(['Resolved', 'Closed'])

export default function MyWork() {
  const { user, addToast } = useAppStore()
  const [tab, setTab] = useState<TabType>('tickets')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [incidents, setIncidents] = useState<ProjectIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Show-all toggles (default: hide done items)
  const [showAllTickets, setShowAllTickets] = useState(false)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [showAllIncidents, setShowAllIncidents] = useState(false)

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
      spGet<ProjectIncident>('PM_Incidents', `AssignedEmail eq '${user.email}'`, undefined, 'Created desc'),
    ]).then(([t, tk, inc]) => {
      setTickets(t)
      setTasks(tk)
      setIncidents(inc)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  async function pinFocus(type: 'Ticket' | 'Task' | 'Incident', item: Ticket | Task | ProjectIncident) {
    if (!user) return
    try {
      // For Task/Incident: RefID must be ProjectID (Home links to /projects/:id)
      // For Ticket: RefID is the ticket's own id (Home links to /tickets/:id)
      const refId = type === 'Ticket'
        ? String(item.id)
        : String((item as Task | ProjectIncident).ProjectID)
      await spCreate('HD_Focus', {
        Title: item.Title,
        RefID: refId,
        FocusType: type,
        FocusedBy: user.displayName,
        FocusedEmail: user.email,
        DueDate: (item as Ticket).DueDate ?? (item as Task).DueDate ?? null,
        Status: type === 'Incident'
          ? (item as ProjectIncident).Status
          : (item as Ticket).Status ?? ((item as Task).IsCompleted ? 'Completed' : 'Active'),
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

  // Filtered & sorted data
  const filteredTickets = tickets
    .filter(t =>
      (showAllTickets || !DONE_TICKET_STATUSES.has(t.Status)) &&
      (!search || t.Title.toLowerCase().includes(search.toLowerCase()) || t.TicketNumber?.includes(search)) &&
      (!statusFilter || t.Status === statusFilter)
    )
    .sort((a, b) => {
      const order: Record<string, number> = { red: 0, orange: 1, yellow: 2, normal: 3, gray: 4 }
      return (order[getDueDateColor(a.DueDate, a.Status === 'Closed')] ?? 3) -
             (order[getDueDateColor(b.DueDate, b.Status === 'Closed')] ?? 3)
    })

  const filteredTasks = tasks
    .filter(t =>
      (showAllTasks || !t.IsCompleted) &&
      (!search || t.Title.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      const order: Record<string, number> = { red: 0, orange: 1, yellow: 2, normal: 3, gray: 4 }
      return (order[getDueDateColor(a.DueDate, a.IsCompleted)] ?? 3) -
             (order[getDueDateColor(b.DueDate, b.IsCompleted)] ?? 3)
    })

  const filteredIncidents = incidents.filter(inc =>
    (showAllIncidents || inc.Status !== 'Resolved') &&
    (!search || inc.Title.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || inc.Status === statusFilter)
  )

  const tabCounts = {
    tickets: tickets.filter(t => !DONE_TICKET_STATUSES.has(t.Status)).length,
    tasks: tasks.filter(t => !t.IsCompleted).length,
    incidents: incidents.filter(inc => inc.Status !== 'Resolved').length,
  }

  return (
    <div>
      <Header title="งานของฉัน" />
      <div className="p-4 md:p-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4 w-fit">
          {(['tickets', 'tasks', 'incidents'] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(''); setStatusFilter('') }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500'
              }`}
            >
              {t === 'tickets'
                ? `Tickets (${tabCounts.tickets})`
                : t === 'tasks'
                ? `Tasks (${tabCounts.tasks})`
                : `Incidents (${tabCounts.incidents})`}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 items-center">
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
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <option value="">สถานะทั้งหมด</option>
              {['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'].map(s => <option key={s}>{s}</option>)}
            </select>
          )}
          {tab === 'incidents' && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <option value="">สถานะทั้งหมด</option>
              {['Open', 'In Progress', 'Resolved'].map(s => <option key={s}>{s}</option>)}
            </select>
          )}

          {/* Show-all toggle */}
          {tab === 'tickets' && (
            <button onClick={() => setShowAllTickets(s => !s)}
              className="text-xs text-primary-600 underline ml-1">
              {showAllTickets ? 'ซ่อนที่เสร็จแล้ว' : `ดูทั้งหมด (${tickets.length})`}
            </button>
          )}
          {tab === 'tasks' && (
            <button onClick={() => setShowAllTasks(s => !s)}
              className="text-xs text-primary-600 underline ml-1">
              {showAllTasks ? 'ซ่อนที่เสร็จแล้ว' : `ดูทั้งหมด (${tasks.length})`}
            </button>
          )}
          {tab === 'incidents' && (
            <button onClick={() => setShowAllIncidents(s => !s)}
              className="text-xs text-primary-600 underline ml-1">
              {showAllIncidents ? 'ซ่อนที่เสร็จแล้ว' : `ดูทั้งหมด (${incidents.length})`}
            </button>
          )}
        </div>

        {/* Tickets */}
        {tab === 'tickets' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : filteredTickets.length === 0
                ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Ticket ที่ยังค้างอยู่</p>
                : filteredTickets.map(t => {
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
                            <button onClick={() => acknowledgeTicket(t)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-green-600" title="รับทราบ">
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
              : filteredTasks.length === 0
                ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Task ที่ยังค้างอยู่</p>
                : filteredTasks.map(task => {
                    const color = getDueDateColor(task.DueDate, task.IsCompleted)
                    // Use absolute left-bar indicator instead of border-l to avoid flex clipping
                    const barColor = color === 'red' ? 'bg-red-500' : color === 'orange' ? 'bg-orange-500' : color === 'yellow' ? 'bg-yellow-500' : ''
                    return (
                      <div key={task.id} className={`relative flex items-center gap-2 pl-4 pr-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 ${color === 'gray' ? 'opacity-60' : ''}`}>
                        {/* Left colour bar — absolutely positioned, doesn't affect flex layout */}
                        {barColor && <span className={`absolute left-0 top-0 bottom-0 w-1 ${barColor} rounded-l`} />}
                        <span className="text-sm w-4 flex-shrink-0 text-center">{getDueDateEmoji(color)}</span>
                        <div className="flex-1 min-w-0">
                          {task.ProjectID
                            ? (
                              <Link to={`/projects/${task.ProjectID}`} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate block">
                                {task.Title}
                              </Link>
                            )
                            : <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.Title}</p>
                          }
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {task.DueDate && <span className={`text-xs px-1.5 py-0.5 rounded ${getDueDateBadgeClass(color)}`}>{formatDate(task.DueDate)}</span>}
                            {task.IsAcknowledged && <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 size={11} /> รับทราบแล้ว</span>}
                          </div>
                          {task.TaskNote && <p className="text-xs text-gray-500 mt-0.5 italic truncate">{task.TaskNote}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {task.IsCompleted
                            ? <Badge className="bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 text-[11px]">Done</Badge>
                            : <Badge className="bg-blue-600 text-white dark:bg-blue-500 dark:text-white text-[11px]">Active</Badge>
                          }
                          <button onClick={() => pinFocus('Task', task)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-600" title="Pin">
                            <Pin size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })
            }
          </div>
        )}

        {/* Incidents */}
        {tab === 'incidents' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              : filteredIncidents.length === 0
                ? <p className="text-center text-sm text-gray-400 py-12">ไม่มี Incident ที่ยังค้างอยู่</p>
                : filteredIncidents.map(inc => (
                    <div key={inc.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <AlertTriangle size={15} className="flex-shrink-0 text-orange-500" />
                      <div className="flex-1 min-w-0">
                        {inc.ProjectID > 0
                          ? (
                            <Link to={`/projects/${inc.ProjectID}`} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate block">
                              {inc.Title}
                            </Link>
                          )
                          : <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{inc.Title}</p>
                        }
                        <div className="flex items-center gap-2 mt-0.5">
                          {inc.IncidentDate && <span className="text-xs text-gray-400">{formatDate(inc.IncidentDate)}</span>}
                          {inc.Description && <span className="text-xs text-gray-400 truncate max-w-[200px]">{inc.Description}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={getSeverityColor(inc.Severity)}>{inc.Severity}</Badge>
                        <Badge className={getStatusColor(inc.Status)}>{inc.Status}</Badge>
                        <button onClick={() => pinFocus('Incident', inc)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600" title="Pin">
                          <Pin size={15} />
                        </button>
                      </div>
                    </div>
                  ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
