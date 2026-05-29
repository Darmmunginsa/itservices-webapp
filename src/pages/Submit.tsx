import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { spGet, spCreate } from '../services/sharepoint'
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

// Reusable multi-checkbox list
function MultiCheckList({
  label, items, selected, onToggle,
}: {
  label: string
  items: { value: string; label: string }[]
  selected: string[]
  onToggle: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-left">
        <span className="text-gray-600 dark:text-gray-400">
          {selected.length > 0 ? `${label}: ${selected.length} คน` : `เลือก${label}...`}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 max-h-40 overflow-y-auto">
          {items.length === 0
            ? <p className="text-xs text-gray-400 p-3">ไม่มีข้อมูล</p>
            : items.map(item => (
                <label key={item.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input type="checkbox" checked={selected.includes(item.value)}
                    onChange={() => onToggle(item.value)}
                    className="rounded accent-primary-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.label}</span>
                </label>
              ))
          }
        </div>
      )}
    </div>
  )
}

export default function Submit() {
  const { user, addToast } = useAppStore()
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

  const [form, setForm] = useState({ ...EMPTY_FORM })

  useEffect(() => {
    // Load ALL agents (no IsAvailable filter — let user pick from full list)
    spGet<{ id: number; Title: string }>('HD_Categories', undefined, undefined, 'Title asc')
      .then(setCategories).catch(() => {})
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc')
      .then(setAgents).catch(() => {})
    spGet<Project>('PM_Projects', "Status eq 'Active'", undefined, 'Title asc')
      .then(setProjects).catch(() => {})
    spGet<Contract>('HD_Contracts', "Status eq 'Active'", undefined, 'Title asc')
      .then(setContracts).catch(() => {})
  }, [])

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

  const toggleCalEmail = (email: string, arr: string[], setter: (v: string[]) => void) => {
    setter(arr.includes(email) ? arr.filter(e => e !== email) : [...arr, email])
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
          CreatedByEmail: user.email,
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

  // Data options for calendar multi-select
  const agentOptions = agents.map(a => ({ value: a.EmailText, label: `${a.Title}${a.SupportGroup ? ` · ${a.SupportGroup}` : ''}` }))
  const customerOptions = contracts.map(c => ({ value: c.CustomerEmail ?? '', label: `${c.Title}${c.Company ? ` (${c.Company})` : ''}` })).filter(o => o.value)

  // Calendar section shared by Ticket and Task
  function CalendarSection() {
    return (
      <div className="space-y-3 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
        <p className="text-xs font-medium text-primary-600">📅 ตั้งค่านัดหมาย Outlook Calendar</p>

        {/* Date + time */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1">
            <label className={lx}>วันที่ *</label>
            <input required={addCalendar} type="date" value={form.calendarDate}
              onChange={e => set('calendarDate', e.target.value)} className={cx} />
          </div>
          <div>
            <label className={lx}>เริ่ม</label>
            <select value={form.startHour} onChange={e => set('startHour', e.target.value)} className={cx}>
              {HOURS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className={lx}>สิ้นสุด</label>
            <select value={form.endHour} onChange={e => set('endHour', e.target.value)} className={cx}>
              {HOURS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
        </div>

        {/* Online meeting */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isOnlineMeeting} onChange={e => setIsOnlineMeeting(e.target.checked)}
            className="rounded accent-primary-600" />
          <span className="text-sm text-gray-600 dark:text-gray-400">🎥 เพิ่มการประชุมออนไลน์ (Teams)</span>
        </label>

        {/* Internal attendees */}
        <div>
          <label className={lx}>ผู้เข้าร่วม Internal (เลือกได้หลายคน)</label>
          <MultiCheckList
            label="Internal"
            items={agentOptions}
            selected={calInternalEmails}
            onToggle={v => toggleCalEmail(v, calInternalEmails, setCalInternalEmails)}
          />
          {calInternalEmails.length > 0 && (
            <p className="text-xs text-gray-400 mt-1 truncate">{calInternalEmails.join(', ')}</p>
          )}
        </div>

        {/* Customer attendees */}
        <div>
          <label className={lx}>ผู้เข้าร่วม ลูกค้า (เลือกได้หลายคน)</label>
          <MultiCheckList
            label="ลูกค้า"
            items={customerOptions}
            selected={calCustomerEmails}
            onToggle={v => toggleCalEmail(v, calCustomerEmails, setCalCustomerEmails)}
          />
          {calCustomerEmails.length > 0 && (
            <p className="text-xs text-gray-400 mt-1 truncate">{calCustomerEmails.join(', ')}</p>
          )}
        </div>

        {/* External emails */}
        <div>
          <label className={lx}>Email ภายนอก (คั่นด้วย ,)</label>
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
      <Header title="แจ้งงาน / Submit" />
      <div className="p-4 md:p-6 max-w-2xl">
        <Card>
          {/* Type Tabs */}
          <div className="mb-6">
            <label className={lx}>ประเภท</label>
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
              <label className={lx}>หัวข้อ *</label>
              <input required value={form.title} onChange={e => set('title', e.target.value)}
                className={cx} placeholder={type === 'Incident' ? 'อธิบายปัญหา / ชื่อ Incident...' : 'ระบุหัวข้อ...'} />
            </div>
            <div>
              <label className={lx}>รายละเอียด</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                className={cx} rows={3} placeholder="รายละเอียดเพิ่มเติม..." />
            </div>

            {/* ── Ticket fields ── */}
            {type === 'Ticket' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>Priority</label>
                    <select value={form.priority} onChange={e => set('priority', e.target.value)} className={cx}>
                      {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lx}>หมวดหมู่</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)} className={cx}>
                      <option value="">-- เลือกหมวดหมู่ --</option>
                      {(categories.length > 0 ? categories.map(c => c.Title) : DEFAULT_CATEGORIES)
                        .map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={lx}>แผนก (Department)</label>
                  <select value={form.department} onChange={e => set('department', e.target.value)} className={cx}>
                    <option value="">-- เลือกแผนก --</option>
                    {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>

                {isAgent && (
                  <div>
                    <label className={lx}>ลูกค้า / ผู้แจ้ง</label>
                    <select value={form.customerName} onChange={e => selectCustomer(e.target.value)} className={cx}>
                      <option value="">-- ตัวเอง ({user?.displayName}) --</option>
                      {contracts.map(c => (
                        <option key={c.id} value={c.Title}>
                          {c.Title}{c.Company ? ` (${c.Company})` : ''}
                        </option>
                      ))}
                    </select>
                    {form.customerEmail && <p className="text-xs text-gray-400 mt-1">📧 {form.customerEmail}</p>}
                  </div>
                )}

                <div>
                  <label className={lx}>Assign ให้ Agent</label>
                  <select value={form.assignedEmail} onChange={e => selectAgent(e.target.value)} className={cx}>
                    <option value="">-- ยังไม่ Assign --</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.EmailText}>
                        {a.Title}{a.SupportGroup ? ` · ${a.SupportGroup}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                      disabled={!!form.daysCount} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>หรือกำหนดจากวันนี้ (วัน)</label>
                    <input type="number" min="1" placeholder="เช่น 3 = 3 วัน"
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
                    <span className="text-sm text-gray-600 dark:text-gray-400">📌 Track Ticket นี้</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">📅 เพิ่มใน Outlook Calendar</span>
                  </label>
                </div>
                {addCalendar && <CalendarSection />}
              </>
            )}

            {/* ── Task fields ── */}
            {type === 'Task' && (
              <>
                <div>
                  <label className={lx}>โครงการ *</label>
                  <select required value={form.projectId} onChange={e => set('projectId', e.target.value)} className={cx}>
                    <option value="">-- เลือกโครงการ --</option>
                    {projects.length > 0
                      ? projects.map(p => <option key={p.id} value={String(p.id)}>{p.Title}{p.Company ? ` (${p.Company})` : ''}</option>)
                      : <option disabled>กำลังโหลด...</option>}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>Assign ให้</label>
                    <select value={form.assignedEmail} onChange={e => selectAgent(e.target.value)} className={cx}>
                      <option value="">-- ยังไม่ Assign --</option>
                      {agents.map(a => <option key={a.id} value={a.EmailText}>{a.Title}{a.SupportGroup ? ` · ${a.SupportGroup}` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lx}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                      disabled={!!form.daysCount} className={cx} />
                  </div>
                </div>

                <div>
                  <label className={lx}>กำหนดจากวันนี้ (วัน) — แทน Due Date</label>
                  <input type="number" min="1" placeholder="เช่น 7 = 1 สัปดาห์"
                    value={form.daysCount} onChange={e => set('daysCount', e.target.value)} className={cx} />
                </div>
                {form.daysCount && Number(form.daysCount) > 0 && (
                  <p className="text-xs text-primary-600">📅 Due date: {computedDueDate()}</p>
                )}

                <div>
                  <label className={lx}>Task Note</label>
                  <textarea value={form.taskNote} onChange={e => set('taskNote', e.target.value)}
                    className={cx} rows={3} placeholder="รายละเอียดเพิ่มเติม หรือขั้นตอนที่ต้องทำ..." />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={trackItem} onChange={e => setTrackItem(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">📌 Track Task นี้</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">📅 เพิ่มใน Outlook Calendar</span>
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
                    <label className={lx}>ความรุนแรง (Severity)</label>
                    <select value={form.incidentSeverity} onChange={e => set('incidentSeverity', e.target.value)} className={cx}>
                      {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lx}>สถานะ</label>
                    <select value={form.incidentStatus} onChange={e => set('incidentStatus', e.target.value)} className={cx}>
                      {['Open', 'In Progress', 'Resolved'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={lx}>หมวดหมู่</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)} className={cx}>
                    <option value="">-- เลือกหมวดหมู่ (ไม่บังคับ) --</option>
                    {(categories.length > 0 ? categories.map(c => c.Title) : DEFAULT_CATEGORIES)
                      .map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>วันที่เกิด Incident</label>
                    <input type="date" value={form.incidentDate} onChange={e => set('incidentDate', e.target.value)} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>โครงการที่เกี่ยวข้อง</label>
                    <select value={form.projectId} onChange={e => set('projectId', e.target.value)} className={cx}>
                      <option value="">-- ไม่ระบุ --</option>
                      {projects.map(p => <option key={p.id} value={String(p.id)}>{p.Title}{p.Company ? ` (${p.Company})` : ''}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={lx}>Assign ให้ Agent</label>
                  <select value={form.assignedEmail} onChange={e => selectAgent(e.target.value)} className={cx}>
                    <option value="">-- ยังไม่ Assign --</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.EmailText}>
                        {a.Title}{a.SupportGroup ? ` · ${a.SupportGroup}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full justify-center mt-2">
              {loading ? 'กำลังส่ง...' : type === 'Incident' ? 'บันทึก Incident' : 'ส่งคำขอ'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
