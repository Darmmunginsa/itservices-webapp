import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserCheck, Ticket as TicketIcon, AlertTriangle, CheckSquare } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonCard, SkeletonRow } from '../components/common/Skeleton'
import { DataTable, type Column } from '../components/common/DataTable'
import { spGet, spUpdate } from '../services/sharepoint'
import { sendTemplateEmail } from '../services/emailService'
import { incidentMailPlan } from '../utils/incidentMail'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { AgentProfile } from '../types/common'
import type { Project, ProjectIncident, Task } from '../types/project'
import { getStatusColor, getPriorityColor } from '../utils/colorUtils'
import { formatDate, getDueDateColor, getDueDateRowClass, getDueDateEmoji } from '../utils/dateUtils'
import {
  ticketRows, incidentRows, taskRows, workStats, filterWork, statusOptions, priorityOptions,
  workLink, isDone, type WorkRow, type WorkKind,
} from '../utils/dashboardWork'

/** ลิสต์ที่ต้องเขียนกลับตอน assign — ผูกกับชนิดงานที่เดียว */
const LIST_OF: Record<WorkKind, string> = {
  ticket: 'HD_Tickets', incident: 'PM_Incidents', task: 'PM_Tasks',
}

export default function AgentDashboard() {
  const { user, addToast } = useAppStore()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [incidents, setIncidents] = useState<ProjectIncident[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<WorkKind>('ticket')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('')
  const [hideDone, setHideDone] = useState(false)

  // Quick-assign modal
  const [assignTarget, setAssignTarget] = useState<WorkRow | null>(null)
  const [selectedAgentEmail, setSelectedAgentEmail] = useState('')
  const [assigning, setAssigning] = useState(false)

  function loadWork() {
    if (!user) return
    const isSupervisor = ['Supervisor', 'Boss', 'Admin'].includes(user.role)
    const mine = `AssignedEmail eq '${user.email}'`
    const filter = isSupervisor ? undefined : mine
    Promise.allSettled([
      spGet<Ticket>('HD_Tickets', filter, undefined, 'Modified desc', 200).then(setTickets),
      // Incident/Task ยังไม่มีในบางที่ติดตั้ง — catch ไว้ ไม่ให้ทั้งหน้าล้มเพราะลิสต์เดียว
      spGet<ProjectIncident>('PM_Incidents', filter, '*,Author/Title', 'Modified desc', 200, 'Author')
        .then(setIncidents).catch(() => {}),
      spGet<Task>('PM_Tasks', filter, '*,Author/Title', 'Modified desc', 200, 'Author')
        .then(setTasks).catch(() => {}),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user) return
    // loadWork ตั้ง state ผ่าน .then เท่านั้น ไม่ได้ตั้งตรง ๆ ระหว่าง render
    loadWork()
    spGet<AgentProfile>('HD_AgentProfiles', 'IsAvailable eq true', undefined, 'Title asc')
      .then(setAgents).catch(() => {})
    // ชื่อโครงการ — Incident/Task เก็บแค่ ProjectID จึงต้องแปลงเป็นชื่อให้อ่านออก
    spGet<Project>('PM_Projects', undefined, 'Id,Title,CreatedByEmail', 'Title asc', 500)
      .then(setProjects).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const names = useMemo(() => projects.map(p => ({ id: p.id, Title: p.Title })), [projects])
  const rowsOf = useMemo(() => ({
    ticket: ticketRows(tickets, names),
    incident: incidentRows(incidents, names),
    task: taskRows(tasks, names),
  }), [tickets, incidents, tasks, names])

  const rows = rowsOf[tab]
  const filtered = useMemo(
    () => filterWork(rows, { search, status: statusFilter, priority: priorityFilter, assignee: assignedFilter, hideDone }),
    [rows, search, statusFilter, priorityFilter, assignedFilter, hideDone])

  const stats = useMemo(() => workStats(rows), [rows])
  const statuses = useMemo(() => statusOptions(rows), [rows])
  const priorities = useMemo(() => priorityOptions(rows), [rows])

  const statCards = [
    { label: 'Open',              value: stats.open,       color: 'text-blue-600' },
    { label: 'In Progress',       value: stats.inProgress, color: 'text-purple-600' },
    { label: 'ยังไม่มีผู้รับผิดชอบ', value: stats.unassigned, color: 'text-orange-600' },
    { label: 'เสร็จแล้ว',           value: stats.done,       color: 'text-green-600' },
  ]

  const canAssign = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  /**
   * Assign ได้ทั้งสามชนิดจากที่นี่
   *
   * Incident ส่งเมลด้วย เหมือนที่หน้า Incident ทำ — ถ้าเงียบ คนที่ถูกมอบหมายจะไม่รู้
   * และหน้าจอสองหน้าจะให้ผลต่างกันทั้งที่เป็นการกระทำเดียวกัน
   * Ticket กับ Task ไม่ส่ง เพราะทางเดิมก็ไม่ส่ง — ที่นี่ไม่ใช่ที่ที่ควรเปลี่ยนกฎนั้น
   */
  async function doAssign() {
    if (!assignTarget || !user) return
    const t = assignTarget
    const agent = agents.find(a => a.EmailText === selectedAgentEmail)
    setAssigning(true)
    try {
      const payload: Record<string, unknown> = t.kind === 'ticket'
        ? {
          AssignedEmail: selectedAgentEmail,
          AssignedToName: agent?.Title ?? '',
          Status: t.status === 'Open' ? 'In Progress' : t.status,
        }
        : {
          AssignedEmail: selectedAgentEmail,
          AssignedTo: agent?.Title ?? selectedAgentEmail,
          // งานที่เพิ่งมอบหมายยังไม่มีใครกดรับ — ต้องไปรออยู่ในกล่อง "รอรับงาน"
          IsAcknowledged: false,
        }
      await spUpdate(LIST_OF[t.kind], t.id, payload)
      addToast('success', `Assign ให้ ${agent?.Title ?? selectedAgentEmail} แล้ว`)

      if (t.kind === 'incident') {
        const inc = incidents.find(i => i.id === t.id)
        const project = projects.find(p => p.id === t.projectId)
        const plan = incidentMailPlan({
          title: t.title,
          severity: t.priority,
          status: t.status,
          description: inc?.Description,
          incidentDate: inc?.IncidentDate,
          slaHours: inc?.SLAHours,
          projectName: t.projectName,
          projectId: t.projectId,
          assignedName: agent?.Title ?? selectedAgentEmail,
          assignedEmail: selectedAgentEmail,
          requesterEmail: project?.CreatedByEmail,
          actorEmail: user.email,
          baseUrl: window.location.origin + window.location.pathname,
        })
        const res = await sendTemplateEmail('incident_assigned', plan.vars, plan.to, plan.cc)
        // มอบหมายสำเร็จแล้ว เมลไม่ออกคือคนละเรื่อง — บอกแยก ไม่ใช่กลบเป็นความสำเร็จ
        // ถ้อยคำเดียวกับหน้า Incident เพราะเป็นความล้มเหลวแบบเดียวกัน
        if (!res.ok) {
          addToast('error', res.reason === 'no-template'
            ? 'Assign แล้ว แต่ไม่ได้ส่งเมล — ยังไม่ได้เปิด template "incident_assigned"'
            : 'Assign แล้ว แต่ส่งเมลไม่สำเร็จ — ผู้รับผิดชอบยังไม่รู้เรื่อง')
        }
      }

      setAssignTarget(null)
      setSelectedAgentEmail('')
      loadWork()
    } catch {
      addToast('error', 'Assign ไม่สำเร็จ')
    } finally {
      setAssigning(false)
    }
  }

  const TABS: Array<{ v: WorkKind; label: string; icon: typeof TicketIcon }> = [
    { v: 'ticket',   label: 'Ticket',   icon: TicketIcon },
    { v: 'incident', label: 'Incident', icon: AlertTriangle },
    { v: 'task',     label: 'Task',     icon: CheckSquare },
  ]

  // เรียงตามลำดับความเร่งด่วน/ขั้นตอนจริง ไม่ใช่ตามตัวอักษร
  const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 }
  const STATUS_ORDER: Record<string, number> = {
    Open: 0, 'In Progress': 1, Pending: 2, Resolved: 3, Closed: 4, Completed: 5, Cancelled: 6,
  }

  const columns: Column<WorkRow>[] = [
    { key: 'due_icon', label: '', align: 'center',
      render: r => <span>{getDueDateEmoji(getDueDateColor(r.due, isDone(r.status)))}</span> },
    { key: 'ref', label: tab === 'ticket' ? 'Ticket No.' : 'เลขที่', sortValue: r => r.ref,
      render: r => <span className="text-xs font-mono text-gray-500">{r.ref}</span> },
    { key: 'title', label: 'หัวข้อ', sortValue: r => r.title,
      render: r => (
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {r.title}
          {/* ถูกมอบหมายแล้วแต่ยังไม่กดรับ — ยังไม่มีใครเริ่มลงมือจริง */}
          {r.waitingAck && (
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              รอรับงาน
            </span>
          )}
        </span>
      ) },
    // Ticket ผูกโครงการหรือไม่ก็ได้ แต่ Incident/Task อยู่ในโครงการเสมอ
    ...(tab === 'ticket' ? [] : [{
      key: 'project', label: 'โครงการ', sortValue: (r: WorkRow) => r.projectName,
      render: (r: WorkRow) => <span className="text-xs text-gray-500">{r.projectName || '—'}</span>,
    }]),
    ...(tab === 'task' ? [] : [{
      key: 'priority', label: tab === 'incident' ? 'Severity' : 'Priority',
      sortValue: (r: WorkRow) => PRIORITY_ORDER[r.priority] ?? 9,
      render: (r: WorkRow) => r.priority
        ? <Badge className={getPriorityColor(r.priority)}>{r.priority}</Badge>
        : <span className="text-xs text-gray-300">—</span>,
    }]),
    { key: 'status', label: 'สถานะ', sortValue: r => STATUS_ORDER[r.status] ?? 9,
      render: r => <Badge className={getStatusColor(r.status)}>{r.status}</Badge> },
    { key: 'assigned', label: 'ผู้รับผิดชอบ', sortValue: r => r.assignedName || r.assignedEmail || 'zzz',
      render: r => r.assignedName || r.assignedEmail
        ? <span className="text-xs text-gray-600 dark:text-gray-300">{r.assignedName || r.assignedEmail}</span>
        : <span className="text-xs text-orange-500 italic">ยังไม่ assign</span> },
    { key: 'requester', label: tab === 'task' ? 'ผู้สั่งงาน' : 'ผู้แจ้ง', sortValue: r => r.requester,
      render: r => <span className="text-xs text-gray-500">{r.requester || '—'}</span> },
    { key: 'due', label: tab === 'incident' ? 'ครบ SLA' : 'กำหนดส่ง', sortValue: r => r.due,
      render: r => <span className="text-xs text-gray-500">{r.due ? formatDate(r.due) : '—'}</span> },
    { key: 'modified', label: 'อัปเดตล่าสุด', sortValue: r => r.modified,
      render: r => <span className="text-xs text-gray-400">{r.modified ? formatDate(r.modified) : '—'}</span> },
    ...(canAssign ? [{
      key: 'assign', label: 'Assign', align: 'center' as const,
      render: (r: WorkRow) => (
        <button onClick={e => { e.stopPropagation(); setAssignTarget(r); setSelectedAgentEmail(r.assignedEmail) }}
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
      <div className="p-4 md:p-6 space-y-4">

        {/* สลับชนิดงาน — ตัวเลขติดอยู่บนแท็บ ไม่ต้องกดเข้าไปดูว่ามีงานค้างไหม */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
          {TABS.map(o => {
            const kindRows = rowsOf[o.v]
            const pending = kindRows.filter(r => !isDone(r.status)).length
            const Icon = o.icon
            return (
              <button key={o.v} onClick={() => { setTab(o.v); setStatusFilter(''); setPriorityFilter('') }}
                title={`${kindRows.length} รายการ · ยังไม่จบ ${pending}`}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === o.v ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                <Icon size={14} /> {o.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  pending > 0 ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                  {pending}
                </span>
              </button>
            )
          })}
        </div>

        {/* Stats — ของชนิดที่กำลังดูอยู่ */}
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
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="ค้นหา หัวข้อ / เลขที่ / โครงการ / คน" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          {/* ตัวเลือกมาจากข้อมูลจริงของแท็บนี้ — ไม่เสนอสถานะที่เลือกแล้วว่างเปล่า */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">สถานะทั้งหมด</option>
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
          {priorities.length > 0 && (
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <option value="">{tab === 'incident' ? 'Severity ทั้งหมด' : 'Priority ทั้งหมด'}</option>
              {priorities.map(p => <option key={p}>{p}</option>)}
            </select>
          )}
          {['Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '') && (
            <input placeholder="กรอง Agent Email..." value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
              className="w-full sm:w-44 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} className="rounded" />
            ซ่อนงานที่จบแล้ว
          </label>
        </div>

        {/* Table — เรียงได้ทุกคอลัมน์ (คลิกหัวคอลัมน์) */}
        {loading ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : (
          <DataTable
            rows={filtered}
            rowKey={r => `${r.kind}-${r.id}`}
            onRowClick={r => navigate(workLink(r), { state: { from: '/dashboard' } })}
            emptyText={`ไม่มี ${TABS.find(t => t.v === tab)?.label}`}
            rowClass={r => getDueDateRowClass(getDueDateColor(r.due, isDone(r.status)))}
            columns={columns}
          />
        )}
        <p className="text-xs text-gray-400">
          แสดง {filtered.length} จาก {rows.length} รายการ
          {tab === 'task' && ' · Task ยังไม่มีหน้าของตัวเอง คลิกแล้วจะเปิดที่โครงการ'}
        </p>
      </div>

      {/* Quick Assign Modal */}
      <Modal open={!!assignTarget} onClose={() => setAssignTarget(null)} title="Assign Agent" size="sm">
        {assignTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium truncate">{assignTarget.title}</p>
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
            <p className="text-xs text-gray-400">
              {assignTarget.kind === 'ticket'
                ? 'หาก Ticket เป็น Open จะเปลี่ยนสถานะเป็น In Progress อัตโนมัติ'
                : assignTarget.kind === 'incident'
                  ? 'จะส่งเมลแจ้งผู้รับผิดชอบ และงานจะไปรออยู่ในกล่อง “รอรับงาน” ของเขา'
                  : 'งานจะไปรออยู่ในกล่อง “รอรับงาน” ของผู้รับผิดชอบ'}
            </p>
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
