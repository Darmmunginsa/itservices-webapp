import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Pin, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useT } from '../i18n/useT'
import { Badge } from '../components/common/Badge'
import { SkeletonRow } from '../components/common/Skeleton'
import { DataTable, type Column } from '../components/common/DataTable'
import { ViewToggle, useViewMode } from '../components/common/ViewToggle'
import { spGet, spCreate, spUpdate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket, TicketMember } from '../types/ticket'
import type { Task, ProjectIncident } from '../types/project'
import type { FocusItem } from '../types/common'
import { getDueDateColor, getDueDateRowClass, getDueDateBadgeClass, getDueDateEmoji, formatDate } from '../utils/dateUtils'
import { getPriorityColor, getSeverityColor, getStatusColor } from '../utils/colorUtils'

type TabType = 'tickets' | 'tasks' | 'incidents'

const DONE_TICKET_STATUSES = new Set(['Resolved', 'Closed'])

export default function MyWork() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const navigate = useNavigate()
  const [view, setView] = useViewMode('mywork')
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
  const [focusItems, setFocusItems] = useState<FocusItem[]>([])

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
      spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}'`),
      spGet<TicketMember>('HD_TicketMembers', `AgentEmail eq '${user.email}'`),
    ]).then(async ([assigned, tk, inc, focus, memberships]) => {
      // Load member tickets that aren't already in assigned list
      let memberTickets: Ticket[] = []
      if (memberships.length > 0) {
        const assignedIds = new Set(assigned.map(t => t.id))
        const memberIds = [...new Set(memberships.map(m => m.TicketID))].filter(id => !assignedIds.has(id))
        if (memberIds.length > 0) {
          const filter = memberIds.map(id => `Id eq ${id}`).join(' or ')
          memberTickets = await spGet<Ticket>('HD_Tickets', filter, undefined, 'Modified desc').catch(() => [])
        }
      }
      setTickets([...assigned, ...memberTickets])
      setTasks(tk)
      setIncidents(inc)
      setFocusItems(focus)
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
      setFocusItems(prev => [...prev, {
        id: Date.now(), Title: item.Title, RefID: refId,
        FocusType: type as FocusItem['FocusType'],
        FocusedBy: user.displayName, FocusedEmail: user.email,
        Status: '', DueDate: undefined,
      }])
      addToast('success', 'Pin ไว้ใน Focus Items แล้ว')
    } catch {
      addToast('error', 'ไม่สามารถ Pin ได้')
    }
  }

  const pinnedSet = new Set(focusItems.map(f => `${f.FocusType}|${f.Title}`))

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

  // ── Card renderers ──
  function ticketCard(t: Ticket) {
    const color = getDueDateColor(t.DueDate, t.Status === 'Closed')
    return (
      <div key={t.id} className={`flex flex-col gap-2 p-3 subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow ${getDueDateRowClass(color)}`}>
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">{getDueDateEmoji(color)}</span>
          <Link to={`/tickets/${t.id}`} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 flex-1 leading-snug">{t.Title}</Link>
          <button onClick={() => pinFocus('Ticket', t)} className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0 ${pinnedSet.has(`Ticket|${t.Title}`) ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`} title="Pin"><Pin size={14} /></button>
        </div>
        <span className="text-xs text-gray-400">{t.TicketNumber}</span>
        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
          <Badge className={getPriorityColor(t.Priority)}>{t.Priority}</Badge>
          {t.DueDate && <span className={`text-xs px-1.5 py-0.5 rounded ${getDueDateBadgeClass(color)}`}>{formatDate(t.DueDate)}</span>}
          {!t.IsAcknowledged && ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '') && (
            <button onClick={() => acknowledgeTicket(t)} className="ml-auto p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-green-600" title={tr('common.acknowledge')}><CheckCircle2 size={15} /></button>
          )}
        </div>
      </div>
    )
  }

  function taskCard(task: Task) {
    const color = getDueDateColor(task.DueDate, task.IsCompleted)
    return (
      <div key={task.id} className={`flex flex-col gap-2 p-3 subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow ${getDueDateRowClass(color)}`}>
        <div className="flex items-start gap-2">
          <span className="text-base flex-shrink-0">{getDueDateEmoji(color)}</span>
          {task.ProjectID
            ? <Link to={`/projects/${task.ProjectID}`} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 flex-1 leading-snug">{task.Title}</Link>
            : <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1 leading-snug">{task.Title}</p>}
          <button onClick={() => pinFocus('Task', task)} className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0 ${pinnedSet.has(`Task|${task.Title}`) ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`} title="Pin"><Pin size={14} /></button>
        </div>
        {task.TaskNote && <p className="text-xs text-gray-500 italic line-clamp-2">{task.TaskNote}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
          {task.DueDate && <span className={`text-xs px-1.5 py-0.5 rounded ${getDueDateBadgeClass(color)}`}>{formatDate(task.DueDate)}</span>}
          {task.IsAcknowledged && <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 size={11} /> {tr('common.acknowledge')}</span>}
        </div>
      </div>
    )
  }

  function incidentCard(inc: ProjectIncident) {
    return (
      <div key={inc.id} className="flex flex-col gap-2 p-3 subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-2">
          <AlertTriangle size={15} className="flex-shrink-0 text-orange-500 mt-0.5" />
          {inc.ProjectID > 0
            ? <Link to={`/projects/${inc.ProjectID}`} className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 flex-1 leading-snug">{inc.Title}</Link>
            : <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1 leading-snug">{inc.Title}</p>}
          <button onClick={() => pinFocus('Incident', inc)} className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0 ${pinnedSet.has(`Incident|${inc.Title}`) ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`} title="Pin"><Pin size={14} /></button>
        </div>
        {inc.Description && <p className="text-xs text-gray-500 line-clamp-2">{inc.Description}</p>}
        <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
          <Badge className={getSeverityColor(inc.Severity)}>{inc.Severity}</Badge>
          {inc.IncidentDate && <span className="text-xs text-gray-400">{formatDate(inc.IncidentDate)}</span>}
        </div>
      </div>
    )
  }

  // Kanban column wrapper
  function Columns<T>({ cols, items, keyOf, render }: { cols: { key: string; label: string; color?: string }[]; items: T[]; keyOf: (i: T) => string; render: (i: T) => ReactNode }) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cols.map(col => {
          const list = items.filter(i => keyOf(i) === col.key)
          return (
            <div key={col.key} className="flex-shrink-0 w-72">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2 h-2 rounded-full ${col.color ?? 'bg-gray-400'}`} />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{col.label}</span>
                <span className="text-xs text-gray-400">({list.length})</span>
              </div>
              <div className="space-y-3">
                {list.length === 0 ? <p className="text-xs text-gray-300 dark:text-gray-600 text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">—</p> : list.map(render)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Table columns (มุมมองตาราง) ──
  const dueCell = (date?: string, done?: boolean) => {
    if (!date) return <span className="text-gray-300">—</span>
    const color = getDueDateColor(date, done)
    return <span className={`text-xs px-1.5 py-0.5 rounded ${getDueDateBadgeClass(color)}`}>{getDueDateEmoji(color)} {formatDate(date)}</span>
  }
  const pinCell = (type: string, item: { id: number; Title: string }, onPin: () => void) => (
    <button onClick={e => { e.stopPropagation(); onPin() }} title="Pin"
      className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${pinnedSet.has(`${type}|${item.Title}`) ? 'text-primary-600' : 'text-gray-300 hover:text-primary-600'}`}>
      <Pin size={13} />
    </button>
  )

  const ticketTableCols: Column<Ticket>[] = [
    { key: 'no', label: 'Ticket', sortValue: t => t.TicketNumber ?? '',
      render: t => <span className="text-xs font-mono text-gray-500">{t.TicketNumber || '—'}</span> },
    { key: 'title', label: tr('pd.projectName'), sortValue: t => t.Title,
      render: t => <span className="font-medium text-gray-900 dark:text-gray-100">{t.Title}</span> },
    { key: 'status', label: tr('common.status'), sortValue: t => t.Status,
      render: t => <Badge className={getStatusColor(t.Status)}>{t.Status}</Badge> },
    { key: 'priority', label: tr('common.priority'), sortValue: t => t.Priority ?? '',
      render: t => <Badge className={getPriorityColor(t.Priority)}>{t.Priority}</Badge> },
    { key: 'due', label: tr('common.dueDate'), sortValue: t => t.DueDate ?? '',
      render: t => dueCell(t.DueDate, t.Status === 'Closed') },
    { key: 'ack', label: '', align: 'right', render: t =>
      !t.IsAcknowledged && ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
        ? <button onClick={e => { e.stopPropagation(); acknowledgeTicket(t) }} title={tr('common.acknowledge')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-green-600"><CheckCircle2 size={14} /></button>
        : <CheckCircle2 size={14} className="text-green-500 inline" /> },
    { key: 'pin', label: '', align: 'right', render: t => pinCell('Ticket', t, () => pinFocus('Ticket', t)) },
  ]

  const taskTableCols: Column<Task>[] = [
    { key: 'title', label: tr('pd.projectName'), sortValue: t => t.Title,
      render: t => <span className={`font-medium ${t.IsCompleted ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{t.Title}</span> },
    { key: 'note', label: tr('common.note'), sortValue: t => t.TaskNote ?? '',
      render: t => <span className="text-xs text-gray-500 italic line-clamp-1 max-w-xs">{t.TaskNote || '—'}</span> },
    { key: 'status', label: tr('common.status'), sortValue: t => (t.IsCompleted ? 1 : 0),
      render: t => t.IsCompleted
        ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">เสร็จแล้ว</Badge>
        : <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">กำลังทำ</Badge> },
    { key: 'due', label: tr('common.dueDate'), sortValue: t => t.DueDate ?? '',
      render: t => dueCell(t.DueDate, t.IsCompleted) },
    { key: 'pin', label: '', align: 'right', render: t => pinCell('Task', t, () => pinFocus('Task', t)) },
  ]

  const incidentTableCols: Column<ProjectIncident>[] = [
    { key: 'title', label: tr('pd.projectName'), sortValue: i => i.Title,
      render: i => <span className="font-medium text-gray-900 dark:text-gray-100">{i.Title}</span> },
    { key: 'desc', label: tr('common.note'), sortValue: i => i.Description ?? '',
      render: i => <span className="text-xs text-gray-500 line-clamp-1 max-w-xs">{i.Description || '—'}</span> },
    { key: 'severity', label: 'Severity', sortValue: i => i.Severity ?? '',
      render: i => <Badge className={getSeverityColor(i.Severity)}>{i.Severity}</Badge> },
    { key: 'status', label: tr('common.status'), sortValue: i => i.Status ?? '',
      render: i => <Badge className={getStatusColor(i.Status)}>{i.Status}</Badge> },
    { key: 'date', label: tr('common.dueDate'), sortValue: i => i.IncidentDate ?? '',
      render: i => <span className="text-xs text-gray-500">{i.IncidentDate ? formatDate(i.IncidentDate) : '—'}</span> },
    { key: 'pin', label: '', align: 'right', render: i => pinCell('Incident', i, () => pinFocus('Incident', i)) },
  ]

  const TICKET_COLS = [
    { key: 'Open', label: 'Open', color: 'bg-blue-500' },
    { key: 'In Progress', label: 'In Progress', color: 'bg-amber-500' },
    { key: 'Pending', label: 'Pending', color: 'bg-purple-500' },
    { key: 'Resolved', label: 'Resolved', color: 'bg-green-500' },
    { key: 'Closed', label: 'Closed', color: 'bg-gray-400' },
  ]
  const INCIDENT_COLS = [
    { key: 'Open', label: 'Open', color: 'bg-red-500' },
    { key: 'In Progress', label: 'In Progress', color: 'bg-amber-500' },
    { key: 'Resolved', label: 'Resolved', color: 'bg-green-500' },
  ]
  const TASK_COLS = [
    { key: 'open', label: 'กำลังทำ', color: 'bg-blue-500' },
    { key: 'done', label: 'เสร็จแล้ว', color: 'bg-green-500' },
  ]

  return (
    <div>
      <Header title={tr('mywork.header')} />
      <div className="p-4 md:p-6">

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4 w-full md:w-fit">
          {(['tickets', 'tasks', 'incidents'] as TabType[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(''); setStatusFilter('') }}
              className={`flex-1 md:flex-none px-3 md:px-4 py-1.5 rounded-lg text-sm font-medium transition-colors text-center ${
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
          <div className="relative w-full sm:w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder={tr('common.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full"
            />
          </div>

          {tab === 'tickets' && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <option value="">{tr('common.allStatus')}</option>
              {['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'].map(s => <option key={s}>{s}</option>)}
            </select>
          )}
          {tab === 'incidents' && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <option value="">{tr('common.allStatus')}</option>
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
          <div className="ml-auto"><ViewToggle mode={view} onChange={setView} /></div>
        </div>

        {/* Tickets */}
        {tab === 'tickets' && (
          loading
            ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            : filteredTickets.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">{tr('mywork.noTickets')}</p>
              : view === 'table'
                ? <DataTable rows={filteredTickets} columns={ticketTableCols} rowKey={t => t.id}
                    onRowClick={t => navigate(`/tickets/${t.id}`)} emptyText={tr('mywork.noTickets')}
                    rowClass={t => getDueDateRowClass(getDueDateColor(t.DueDate, t.Status === 'Closed'))} />
                : <Columns cols={TICKET_COLS.filter(c => showAllTickets || !DONE_TICKET_STATUSES.has(c.key))} items={filteredTickets} keyOf={t => t.Status} render={t => ticketCard(t)} />
        )}

        {/* Tasks */}
        {tab === 'tasks' && (
          loading
            ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            : filteredTasks.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">{tr('mywork.noTasks')}</p>
              : view === 'table'
                ? <DataTable rows={filteredTasks} columns={taskTableCols} rowKey={t => t.id}
                    onRowClick={t => t.ProjectID && navigate(`/projects/${t.ProjectID}`)} emptyText={tr('mywork.noTasks')}
                    rowClass={t => getDueDateRowClass(getDueDateColor(t.DueDate, t.IsCompleted))} />
                : <Columns cols={TASK_COLS} items={filteredTasks} keyOf={t => t.IsCompleted ? 'done' : 'open'} render={t => taskCard(t)} />
        )}

        {/* Incidents */}
        {tab === 'incidents' && (
          loading
            ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
            : filteredIncidents.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">{tr('mywork.noIncidents')}</p>
              : view === 'table'
                ? <DataTable rows={filteredIncidents} columns={incidentTableCols} rowKey={i => i.id}
                    onRowClick={i => i.ProjectID > 0 && navigate(`/projects/${i.ProjectID}`)} emptyText={tr('mywork.noIncidents')} />
                : <Columns cols={INCIDENT_COLS.filter(c => showAllIncidents || c.key !== 'Resolved')} items={filteredIncidents} keyOf={i => i.Status} render={i => incidentCard(i)} />
        )}
      </div>
    </div>
  )
}
