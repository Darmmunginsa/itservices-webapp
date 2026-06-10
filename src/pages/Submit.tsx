import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { OptionSelect } from '../components/common/OptionSelect'
import { SearchSelect, SearchMultiSelect } from '../components/common/SearchSelect'
import { spGet, spCreate } from '../services/sharepoint'
import { sendTemplateEmail } from '../services/emailService'
import { createNotification } from '../services/notificationService'
import { useT } from '../i18n/useT'
import { createCalendarEvent } from '../services/graph'
import { useAppStore } from '../store/useAppStore'
import type { AgentProfile } from '../types/common'
import type { Contract } from '../types/ticket'
import type { Project } from '../types/project'

type SubmitType = 'Ticket' | 'Task' | 'Incident'

const DEPARTMENTS = ['IT', 'HR', 'บัญชี/การเงิน', 'ฝ่ายขาย', 'ฝ่ายการตลาด', 'Operations', 'ผู้บริหาร', 'อื่นๆ']
const DEFAULT_CATEGORIES = ['IT Hardware', 'IT Software', 'Network', 'Access & Account', 'IT Security', 'Other']

// 07:00–21:00 in 30-min steps
const HOURS = Array.from({ length: 29 }, (_, i) => {
  const h = String(Math.floor(i / 2) + 7).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const EMPTY_FORM = {
  title: '', description: '', priority: 'Medium',
  category: '', department: '', customerEmail: '', customerName: '',
  assignedEmail: '', assignedName: '',
  dueDate: '', daysCount: '',
  projectId: '', taskNote: '',
  incidentSeverity: 'Medium',
  incidentDate: new Date().toISOString().slice(0, 10),
  incidentStatus: 'Open',
  // Calendar
  calendarDate: '', startHour: '09:00', endHour: '10:00', externalAttendees: '',
}

export default function Submit() {
  const { user, addToast } = useAppStore()
  const t = useT()
  const [type, setType] = useState<SubmitType>('Ticket')
  const [loading, setLoading] = useState(false)
  const [addCalendar, setAddCalendar] = useState(false)
  const [trackItem, setTrackItem] = useState(false)
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false)

  // Multi-select for calendar attendees
  const [calInternalEmails, setCalInternalEmails] = useState<string[]>([])
  const [calCustomerEmails, setCalCustomerEmails] = useState<string[]>([])

  // Master data
  const [categories, setCategories] = useState<Array<{ id: number; Title: string }>>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [activeProjectsOnly, setActiveProjectsOnly] = useState(true)

  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    spGet<{ id: number; Title: string }>('HD_Categories', undefined, undefined, 'Title asc')
      .then(setCategories).catch(() => {})
    // Load ALL agents — no IsAvailable filter
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc')
      .then(setAgents).catch(() => {})
    // Load ALL projects — filter client-side via activeProjectsOnly
    spGet<Project>('PM_Projects', undefined, undefined, 'Title asc')
      .then(setProjects).catch(() => {})
    // Include Active + Inactive contracts, exclude only Expired
    spGet<Contract>('HD_Contracts', "Status ne 'Expired'", undefined, 'Title asc')
      .then(setContracts).catch(() => {})
  }, [])

  const filteredProjects = activeProjectsOnly
    ? projects.filter(p => p.Status === 'Active')
    : projects

  const set = (key: keyof typeof EMPTY_FORM, val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  const selectAgent = (email: string) => {
    const agent = agents.find(a => a.EmailText === email)
    setForm(f => ({ ...f, assignedEmail: email, assignedName: agent?.Title ?? '' }))
  }

  const selectCustomer = (title: string) => {
    const contract = contracts.find(c => c.Title === title)
    setForm(f => ({ ...f, customerName: title, customerEmail: contract?.CustomerEmail ?? '' }))
  }

  const computedDueDate = () => {
    if (form.daysCount && Number(form.daysCount) > 0) {
      const d = new Date()
      d.setDate(d.getDate() + Number(form.daysCount))
      return d.toISOString().slice(0, 10)
    }
    return form.dueDate || undefined
  }

  const genTicketNumber = () => {
    const now = new Date()
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    return `HD-${ymd}-${Math.floor(Math.random() * 900 + 100)}`
  }

  const buildCalendarAttendees = () => [
    ...calInternalEmails,
    ...calCustomerEmails,
    ...form.externalAttendees.split(',').map(s => s.trim()).filter(Boolean),
  ]

  function resetAll() {
    setForm({ ...EMPTY_FORM })
    setAddCalendar(false)
    setTrackItem(false)
    setIsOnlineMeeting(false)
    setCalInternalEmails([])
    setCalCustomerEmails([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      if (type === 'Ticket') {
        const ticketNum = genTicketNumber()
        const dueDate = computedDueDate()
        const created = await spCreate('HD_Tickets', {
          Title: form.title,
          TicketNumber: ticketNum,
          Status: 'Open',
          Priority: form.priority,
          Category: form.category || undefined,
          Department: form.department || undefined,
          Description: form.description || undefined,
          CustomerEmail: form.customerEmail || user.email,
          CustomerName: form.customerName || user.displayName,
          AssignedEmail: form.assignedEmail || undefined,
          AssignedToName: form.assignedName || undefined,
          IsAcknowledged: false,
          DueDate: dueDate ?? null,
        })

        if (addCalendar && form.calendarDate) {
          await createCalendarEvent({
            subject: `[${ticketNum}] ${form.title}`,
            start: `${form.calendarDate}T${form.startHour}:00`,
            end: `${form.calendarDate}T${form.endHour}:00`,
            attendees: buildCalendarAttendees(),
            body: form.description,
            isOnlineMeeting,
          })
        }

        if (trackItem && created?.id) {
          await spCreate('HD_Tracking', {
            Title: form.title,
            TrackingType: 'Ticket',
            RefID: created.id,
            TrackedBy: user.displayName,
            TrackedEmail: user.email,
            AssignedTo: form.assignedName,
            Status: 'Open',
            IsAcknowledged: false,
          })
        }
        // Email: 1 ฉบับ — To = ลูกค้า, CC = agent + ผู้แจ้ง (อยู่ใน thread เดียว reply ได้)
        sendTemplateEmail('ticket_created', {
          ticket_number: ticketNum,
          ticket_title: form.title,
          priority: form.priority || '-',
          category: form.category || '-',
          description: (form.description || '-').replace(/\n/g, '<br>'),
          customer_name: form.customerName || user.displayName,
          assigned_name: form.assignedName || '-',
          link: window.location.origin,
        },
          [form.customerEmail || user.email],            // To
          [form.assignedEmail, user.email].filter(Boolean) as string[],  // CC
        )

        addToast('success', `สร้าง Ticket สำเร็จ (${ticketNum})`)

      } else if (type === 'Task') {
        const dueDate = computedDueDate()
        const created = await spCreate('PM_Tasks', {
          Title: form.title,
          ProjectID: Number(form.projectId),
          IsCompleted: false,
          IsAcknowledged: false,
          AssignedTo: form.assignedName || undefined,
          AssignedEmail: form.assignedEmail || undefined,
          DueDate: dueDate ?? null,
          TaskNote: form.taskNote || undefined,
        })

        if (addCalendar && form.calendarDate) {
          await createCalendarEvent({
            subject: form.title,
            start: `${form.calendarDate}T${form.startHour}:00`,
            end: `${form.calendarDate}T${form.endHour}:00`,
            attendees: buildCalendarAttendees(),
            body: form.taskNote || form.description,
            isOnlineMeeting,
          })
        }

        if (trackItem && created?.id) {
          await spCreate('HD_Tracking', {
            Title: form.title,
            TrackingType: 'Task',
            RefID: created.id,
            TrackedBy: user.displayName,
            TrackedEmail: user.email,
            AssignedTo: form.assignedName,
            Status: 'Pending',
            IsAcknowledged: false,
          })
        }
        // แจ้งเตือน agent ที่ถูก assign (in-app) — ยกเว้นคนสร้างเอง
        if (form.assignedEmail && form.assignedEmail.toLowerCase() !== user.email.toLowerCase()) {
          createNotification({
            recipients: [form.assignedEmail],
            title: `📋 ได้รับมอบหมาย Task: ${form.title}`,
            message: form.taskNote || (dueDate ? `กำหนดส่ง ${dueDate}` : 'มี Task ใหม่'),
            linkPath: form.projectId ? `/projects/${form.projectId}` : '/my-work',
            eventType: 'task_assigned',
          })
        }
        addToast('success', 'สร้าง Task สำเร็จ')

      } else if (type === 'Incident') {
        const agent = agents.find(a => a.EmailText === form.assignedEmail)
        await spCreate('PM_Incidents', {
          Title: form.title,
          ProjectID: form.projectId ? Number(form.projectId) : 0,
          Severity: form.incidentSeverity,
          Status: form.incidentStatus,
          Description: form.description || undefined,
          AssignedTo: (agent?.Title ?? form.assignedName) || undefined,
          AssignedEmail: form.assignedEmail || undefined,
          IncidentDate: form.incidentDate || undefined,
        })
        // แจ้งเตือน Assigned เมื่อสร้าง Incident (in-app) — ยกเว้นคนสร้างเอง
        if (form.assignedEmail && form.assignedEmail.toLowerCase() !== user.email.toLowerCase()) {
          createNotification({
            recipients: [form.assignedEmail],
            title: `🚨 ได้รับมอบหมาย Incident: ${form.title}`,
            message: `ความรุนแรง ${form.incidentSeverity}${form.description ? ' — ' + form.description.slice(0, 120) : ''}`,
            linkPath: form.projectId ? `/projects/${form.projectId}` : '/my-work',
            eventType: 'incident_created',
          })
        }
        addToast('success', 'บันทึก Incident สำเร็จ')
      }

      resetAll()
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const cx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const lx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  // Searchable dropdown options — agent: value = EmailText
  const agentOptions = agents
    .map(a => ({ value: a.EmailText ?? '', label: `${a.Title}${a.SupportGroup ? ` · ${a.SupportGroup}` : ''}` }))
    .filter(o => o.value)

  // Contract single-select — value = Title (for selectCustomer lookup)
  const contractOptions = contracts.map(c => ({
    value: c.Title,
    label: `${c.Title}${c.Company ? ` (${c.Company})` : ''}`,
  }))

  // Contract multi-select (calendar attendees) — value = CustomerEmail
  const contractEmailOptions = contracts
    .filter(c => c.CustomerEmail)
    .map(c => ({ value: c.CustomerEmail ?? '', label: `${c.Title}${c.Company ? ` (${c.Company})` : ''}` }))
    .filter(o => o.value)

  // Calendar section shared by Ticket and Task
  function CalendarSection() {
    return (
      <div className="space-y-3 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
        <p className="text-xs font-medium text-primary-600">{t('submit.calTitle')}</p>

        {/* Date + time */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1">
            <label className={lx}>{t('submit.date')} *</label>
            <input required={addCalendar} type="date" value={form.calendarDate}
              onChange={e => set('calendarDate', e.target.value)} className={cx} />
          </div>
          <div>
            <label className={lx}>{t('submit.start')}</label>
            <select value={form.startHour} onChange={e => set('startHour', e.target.value)} className={cx}>
              {HOURS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className={lx}>{t('submit.end')}</label>
            <select value={form.endHour} onChange={e => set('endHour', e.target.value)} className={cx}>
              {HOURS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
        </div>

        {/* Online meeting */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isOnlineMeeting} onChange={e => setIsOnlineMeeting(e.target.checked)}
            className="rounded accent-primary-600" />
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.teams')}</span>
        </label>

        {/* Internal attendees */}
        <div>
          <label className={lx}>{t('submit.internalAttendees')}</label>
          <SearchMultiSelect
            label="Internal"
            options={agentOptions}
            selected={calInternalEmails}
            onToggle={v => setCalInternalEmails(prev =>
              prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v]
            )}
          />
          {calInternalEmails.length > 0 && (
            <p className="text-xs text-gray-400 mt-1 truncate">{calInternalEmails.join(', ')}</p>
          )}
        </div>

        {/* Customer attendees */}
        <div>
          <label className={lx}>{t('submit.customerAttendees')}</label>
          <SearchMultiSelect
            label="ลูกค้า"
            options={contractEmailOptions}
            selected={calCustomerEmails}
            onToggle={v => setCalCustomerEmails(prev =>
              prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v]
            )}
          />
          {calCustomerEmails.length > 0 && (
            <p className="text-xs text-gray-400 mt-1 truncate">{calCustomerEmails.join(', ')}</p>
          )}
        </div>

        {/* External emails */}
        <div>
          <label className={lx}>{t('submit.externalEmail')}</label>
          <input value={form.externalAttendees} onChange={e => set('externalAttendees', e.target.value)}
            className={cx} placeholder="ext@company.com, partner@co.th" />
        </div>

        {buildCalendarAttendees().length > 0 && (
          <p className="text-xs text-primary-600">
            รวม {buildCalendarAttendees().length} ผู้เข้าร่วม
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <Header title={t('submit.header')} />
      <div className="p-4 md:p-6 max-w-2xl">
        <Card>
          {/* Type Tabs */}
          <div className="mb-6">
            <label className={lx}>{t('submit.type')}</label>
            <div className="flex gap-2">
              {(['Ticket', 'Task', 'Incident'] as SubmitType[]).map(t => (
                <button key={t} type="button"
                  onClick={() => { setType(t); resetAll() }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {t === 'Ticket' ? '🎫 Ticket' : t === 'Task' ? '📋 Task' : '🚨 Incident'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Title + Description (shared) */}
            <div>
              <label className={lx}>{t('submit.title')} *</label>
              <input required value={form.title} onChange={e => set('title', e.target.value)}
                className={cx} placeholder={type === 'Incident' ? 'อธิบายปัญหา / ชื่อ Incident...' : 'ระบุหัวข้อ...'} />
            </div>
            {/* Task ใช้ช่อง "Task Note" แทน — ซ่อนช่องนี้เพื่อไม่ให้ซ้ำซ้อน */}
            {type !== 'Task' && (
              <div>
                <label className={lx}>{t('submit.description')}</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className={cx} rows={3} placeholder={t('submit.descPlaceholder')} />
              </div>
            )}

            {/* ── Ticket fields ── */}
            {type === 'Ticket' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>Priority</label>
                    <OptionSelect category="TicketPriority" defaults={['Low', 'Medium', 'High', 'Critical']} value={form.priority} onChange={v => set('priority', v)} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>{t('submit.category')}</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)} className={cx}>
                      <option value="">{t('submit.selectCategory')}</option>
                      {(categories.length > 0 ? categories.map(c => c.Title) : DEFAULT_CATEGORIES)
                        .map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={lx}>{t('submit.department')}</label>
                  <OptionSelect category="Department" defaults={[...DEPARTMENTS]} value={form.department} onChange={v => set('department', v)} className={cx} />
                </div>

                {isAgent && (
                  <div>
                    <label className={lx}>{t('submit.customer')}</label>
                    <SearchSelect
                      options={contractOptions}
                      value={form.customerName}
                      onChange={selectCustomer}
                      placeholder={`ตัวเอง (${user?.displayName ?? ''})`}
                      emptyLabel={`-- ตัวเอง (${user?.displayName ?? ''}) --`}
                    />
                    {form.customerEmail && <p className="text-xs text-gray-400 mt-1">📧 {form.customerEmail}</p>}
                  </div>
                )}

                <div>
                  <label className={lx}>{t('submit.assignAgent')}</label>
                  <SearchSelect
                    options={agentOptions}
                    value={form.assignedEmail}
                    onChange={selectAgent}
                    placeholder={t('submit.searchAgent')}
                    emptyLabel="-- ยังไม่ Assign --"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                      disabled={!!form.daysCount} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>{t('submit.daysFromNow')}</label>
                    <input type="number" min="1" placeholder={t('submit.daysExample')}
                      value={form.daysCount} onChange={e => set('daysCount', e.target.value)} className={cx} />
                  </div>
                </div>
                {form.daysCount && Number(form.daysCount) > 0 && (
                  <p className="text-xs text-primary-600">📅 Due date: {computedDueDate()}</p>
                )}

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={trackItem} onChange={e => setTrackItem(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.trackTicket')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.addCalendar')}</span>
                  </label>
                </div>
                {addCalendar && <CalendarSection />}
              </>
            )}

            {/* ── Task fields ── */}
            {type === 'Task' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={lx} style={{marginBottom:0}}>{t('submit.project')} *</label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                      <input type="checkbox" checked={activeProjectsOnly} onChange={e => setActiveProjectsOnly(e.target.checked)}
                        className="w-3 h-3 accent-primary-600" />
                      {t('submit.onlyActive')}
                    </label>
                  </div>
                  <select required value={form.projectId} onChange={e => set('projectId', e.target.value)} className={cx}>
                    <option value="">{t('submit.selectProject')}</option>
                    {filteredProjects.length > 0
                      ? filteredProjects.map(p => <option key={p.id} value={String(p.id)}>{p.Title}{p.Status !== 'Active' ? ` [${p.Status}]` : ''}{p.Company ? ` (${p.Company})` : ''}</option>)
                      : <option disabled>{t('common.loading')}</option>}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>{t('submit.assignTo')}</label>
                    <SearchSelect
                      options={agentOptions}
                      value={form.assignedEmail}
                      onChange={selectAgent}
                      placeholder={t('submit.searchAgent')}
                      emptyLabel="-- ยังไม่ Assign --"
                    />
                  </div>
                  <div>
                    <label className={lx}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                      disabled={!!form.daysCount} className={cx} />
                  </div>
                </div>

                <div>
                  <label className={lx}>{t('submit.dueFromNow')}</label>
                  <input type="number" min="1" placeholder={t('submit.weekExample')}
                    value={form.daysCount} onChange={e => set('daysCount', e.target.value)} className={cx} />
                </div>
                {form.daysCount && Number(form.daysCount) > 0 && (
                  <p className="text-xs text-primary-600">📅 Due date: {computedDueDate()}</p>
                )}

                <div>
                  <label className={lx}>Task Note</label>
                  <textarea value={form.taskNote} onChange={e => set('taskNote', e.target.value)}
                    className={cx} rows={3} placeholder={t('submit.taskNotePlaceholder')} />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={trackItem} onChange={e => setTrackItem(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.trackTask')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.addCalendar')}</span>
                  </label>
                </div>
                {addCalendar && <CalendarSection />}
              </>
            )}

            {/* ── Incident fields ── */}
            {type === 'Incident' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>{t('submit.severity')}</label>
                    <OptionSelect category="IncidentSeverity" defaults={['Low', 'Medium', 'High', 'Critical']} value={form.incidentSeverity} onChange={v => set('incidentSeverity', v)} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>{t('submit.status')}</label>
                    <OptionSelect category="IncidentStatus" defaults={['Open', 'In Progress', 'Resolved']} value={form.incidentStatus} onChange={v => set('incidentStatus', v)} className={cx} />
                  </div>
                </div>

                <div>
                  <label className={lx}>{t('submit.category')}</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)} className={cx}>
                    <option value="">{t('submit.categoryOptional')}</option>
                    {(categories.length > 0 ? categories.map(c => c.Title) : DEFAULT_CATEGORIES)
                      .map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>{t('submit.incidentDate')}</label>
                    <input type="date" value={form.incidentDate} onChange={e => set('incidentDate', e.target.value)} className={cx} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={lx} style={{marginBottom:0}}>{t('submit.relatedProject')}</label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                        <input type="checkbox" checked={activeProjectsOnly} onChange={e => setActiveProjectsOnly(e.target.checked)}
                          className="w-3 h-3 accent-primary-600" />
                        {t('submit.onlyActive')}
                      </label>
                    </div>
                    <select value={form.projectId} onChange={e => set('projectId', e.target.value)} className={cx}>
                      <option value="">{t('submit.notSpecified')}</option>
                      {filteredProjects.map(p => <option key={p.id} value={String(p.id)}>{p.Title}{p.Status !== 'Active' ? ` [${p.Status}]` : ''}{p.Company ? ` (${p.Company})` : ''}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={lx}>{t('submit.assignAgent')}</label>
                  <SearchSelect
                    options={agentOptions}
                    value={form.assignedEmail}
                    onChange={selectAgent}
                    placeholder={t('submit.searchAgent')}
                    emptyLabel="-- ยังไม่ Assign --"
                  />
                </div>
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full justify-center mt-2">
              {loading ? t('submit.sending') : type === 'Incident' ? t('submit.saveIncident') : t('submit.submitReq')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
