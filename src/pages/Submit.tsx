import { useEffect, useState } from 'react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { spGet, spCreate } from '../services/sharepoint'
import { createCalendarEvent } from '../services/graph'
import { useAppStore } from '../store/useAppStore'
import type { AgentProfile } from '../types/common'
import type { Project } from '../types/project'

type SubmitType = 'Ticket' | 'Task' | 'Leave'

const EMPTY_FORM = {
  title: '', description: '', priority: 'Medium',
  category: '', customerEmail: '', assignedEmail: '', assignedName: '',
  dueDate: '', projectId: '',
  leaveType: 'ลาพักร้อน', leaveDate: '', leaveDateEnd: '', reason: '',
  approverEmail: '',
  attendees: '', location: '',
}

export default function Submit() {
  const { user, addToast } = useAppStore()
  const [type, setType] = useState<SubmitType>('Ticket')
  const [loading, setLoading] = useState(false)
  const [addCalendar, setAddCalendar] = useState(false)

  // Master data
  const [categories, setCategories] = useState<Array<{ id: number; Title: string }>>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    spGet<{ id: number; Title: string }>('HD_Categories', undefined, undefined, 'Title asc')
      .then(setCategories).catch(() => {})
    spGet<AgentProfile>('HD_AgentProfiles', 'IsAvailable eq true', undefined, 'Title asc')
      .then(setAgents).catch(() => {})
    spGet<Project>('PM_Projects', "Status eq 'Active'", undefined, 'Title asc')
      .then(setProjects).catch(() => {})
  }, [])

  const set = (key: keyof typeof EMPTY_FORM, val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  const selectAgent = (email: string) => {
    const agent = agents.find(a => a.EmailText === email)
    setForm(f => ({ ...f, assignedEmail: email, assignedName: agent?.Title ?? '' }))
  }

  const genTicketNumber = () => {
    const now = new Date()
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const rand = Math.floor(Math.random() * 900 + 100)
    return `HD-${ymd}-${rand}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      if (type === 'Ticket') {
        const ticketNum = genTicketNumber()
        await spCreate('HD_Tickets', {
          Title: form.title,
          TicketNumber: ticketNum,
          Status: 'Open',
          Priority: form.priority,
          Category: form.category,
          Description: form.description,
          CustomerEmail: form.customerEmail || user.email,
          CustomerName: user.displayName,
          AssignedEmail: form.assignedEmail,
          AssignedToName: form.assignedName,
          CreatedByEmail: user.email,
          IsAcknowledged: false,
          DueDate: form.dueDate || null,
        })
        if (addCalendar && form.dueDate) {
          await createCalendarEvent({
            subject: `[${ticketNum}] ${form.title}`,
            start: `${form.dueDate}T09:00:00`,
            end: `${form.dueDate}T10:00:00`,
            location: form.location,
            attendees: form.attendees.split(',').map(s => s.trim()).filter(Boolean),
            body: form.description,
          })
        }
        addToast('success', `สร้าง Ticket สำเร็จ (${ticketNum})`)

      } else if (type === 'Task') {
        await spCreate('PM_Tasks', {
          Title: form.title,
          ProjectID: form.projectId,
          IsCompleted: false,
          IsAcknowledged: false,
          AssignedTo: form.assignedName,
          AssignedEmail: form.assignedEmail,
          DueDate: form.dueDate || null,
        })
        addToast('success', 'สร้าง Task สำเร็จ')

      } else if (type === 'Leave') {
        const dateRange = form.leaveDateEnd && form.leaveDateEnd !== form.leaveDate
          ? `${form.leaveDate} ถึง ${form.leaveDateEnd}`
          : form.leaveDate
        await spCreate('HD_LeaveRequests', {
          Title: `ลา ${dateRange} - ${user.displayName}`,
          LeaveDate: form.leaveDate,
          LeaveType: form.leaveType,
          RequestedBy: user.displayName,
          RequestedByEmail: user.email,
          ApproverEmail: form.approverEmail,
          Status: 'Pending',
          ApprovalComment: form.reason,
        })
        addToast('success', 'ส่งคำขอลาแล้ว รอการอนุมัติ')
      }

      setForm(EMPTY_FORM)
      setAddCalendar(false)
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const cx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const lx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const approvers = agents.filter(a => ['Boss', 'Admin', 'Supervisor'].includes(a.Role))

  return (
    <div>
      <Header title="แจ้งงาน / Submit" />
      <div className="p-4 md:p-6 max-w-2xl">
        <Card>
          {/* Type Tabs */}
          <div className="mb-6">
            <label className={lx}>ประเภท</label>
            <div className="flex gap-2">
              {(['Ticket', 'Task', 'Leave'] as SubmitType[]).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {t === 'Ticket' ? '🎫 Ticket' : t === 'Task' ? '📋 Task' : '📅 ขอลา'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Ticket & Task shared ── */}
            {(type === 'Ticket' || type === 'Task') && (
              <>
                <div>
                  <label className={lx}>หัวข้อ *</label>
                  <input required value={form.title} onChange={e => set('title', e.target.value)}
                    className={cx} placeholder="ระบุหัวข้อ..." />
                </div>
                <div>
                  <label className={lx}>รายละเอียด</label>
                  <textarea value={form.description} onChange={e => set('description', e.target.value)}
                    className={cx} rows={4} placeholder="รายละเอียดเพิ่มเติม..." />
                </div>
              </>
            )}

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
                      {categories.length > 0
                        ? categories.map(c => <option key={c.id} value={c.Title}>{c.Title}</option>)
                        : <option disabled>กำลังโหลด...</option>}
                    </select>
                  </div>
                </div>

                {isAgent && (
                  <div>
                    <label className={lx}>Email ผู้แจ้ง (ถ้าต่างจากตัวเอง)</label>
                    <input type="email" value={form.customerEmail}
                      onChange={e => set('customerEmail', e.target.value)}
                      className={cx} placeholder={user?.email} />
                  </div>
                )}

                <div>
                  <label className={lx}>Assign ให้ Agent</label>
                  <select value={form.assignedEmail} onChange={e => selectAgent(e.target.value)} className={cx}>
                    <option value="">-- ยังไม่ Assign (assign ภายหลังได้) --</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.EmailText}>
                        {a.Title}{a.SupportGroup ? ` · ${a.SupportGroup}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={lx}>Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className={cx} />
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                    className="rounded accent-primary-600" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">เพิ่มใน Outlook Calendar</span>
                </label>

                {addCalendar && (
                  <div className="space-y-3 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
                    <div>
                      <label className={lx}>เชิญผู้เข้าร่วม (Email คั่นด้วย ,)</label>
                      <input value={form.attendees} onChange={e => set('attendees', e.target.value)}
                        className={cx} placeholder="email1@co.th, email2@co.th" />
                    </div>
                    <div>
                      <label className={lx}>สถานที่</label>
                      <input value={form.location} onChange={e => set('location', e.target.value)} className={cx} />
                    </div>
                  </div>
                )}
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
                      ? projects.map(p => (
                          <option key={p.id} value={String(p.id)}>
                            {p.Title}{p.Company ? ` (${p.Company})` : ''}
                          </option>
                        ))
                      : <option disabled>กำลังโหลด...</option>}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>Assign ให้</label>
                    <select value={form.assignedEmail} onChange={e => selectAgent(e.target.value)} className={cx}>
                      <option value="">-- ยังไม่ Assign --</option>
                      {agents.map(a => <option key={a.id} value={a.EmailText}>{a.Title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lx}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className={cx} />
                  </div>
                </div>
              </>
            )}

            {/* ── Leave fields ── */}
            {type === 'Leave' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>วันที่เริ่มลา *</label>
                    <input required type="date" value={form.leaveDate}
                      onChange={e => set('leaveDate', e.target.value)} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>ถึงวันที่ (ถ้าลาหลายวัน)</label>
                    <input type="date" value={form.leaveDateEnd} min={form.leaveDate}
                      onChange={e => set('leaveDateEnd', e.target.value)} className={cx} />
                  </div>
                </div>
                <div>
                  <label className={lx}>ประเภทการลา</label>
                  <select value={form.leaveType} onChange={e => set('leaveType', e.target.value)} className={cx}>
                    {['ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาอื่นๆ'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lx}>เหตุผล</label>
                  <textarea value={form.reason} onChange={e => set('reason', e.target.value)}
                    className={cx} rows={2} placeholder="ระบุเหตุผลการลา..." />
                </div>
                <div>
                  <label className={lx}>ผู้อนุมัติ *</label>
                  <select required value={form.approverEmail}
                    onChange={e => set('approverEmail', e.target.value)} className={cx}>
                    <option value="">-- เลือกผู้อนุมัติ --</option>
                    {approvers.length > 0
                      ? approvers.map(a => (
                          <option key={a.id} value={a.EmailText}>
                            {a.Title} ({a.Role})
                          </option>
                        ))
                      : agents.map(a => <option key={a.id} value={a.EmailText}>{a.Title}</option>)}
                  </select>
                </div>
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full justify-center mt-2">
              {loading ? 'กำลังส่ง...' : 'ส่งคำขอ'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
