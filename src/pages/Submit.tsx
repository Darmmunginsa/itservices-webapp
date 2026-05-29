import { useState } from 'react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { spCreate } from '../services/sharepoint'
import { createCalendarEvent } from '../services/graph'
import { useAppStore } from '../store/useAppStore'

type SubmitType = 'Ticket' | 'Task' | 'Leave'

export default function Submit() {
  const { user, addToast } = useAppStore()
  const [type, setType] = useState<SubmitType>('Ticket')
  const [loading, setLoading] = useState(false)
  const [addCalendar, setAddCalendar] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    category: '',
    customerEmail: '',
    assignedEmail: '',
    dueDate: '',
    projectId: '',
    leaveType: 'ลาพักร้อน',
    leaveDate: '',
    approverEmail: '',
    attendees: '',
    location: '',
  })

  function set(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      if (type === 'Ticket') {
        const ticketNum = `TK-${Date.now().toString().slice(-6)}`
        await spCreate('HD_Tickets', {
          Title: form.title,
          TicketNumber: ticketNum,
          Status: 'Open',
          Priority: form.priority,
          Category: form.category,
          Description: form.description,
          CustomerEmail: form.customerEmail || user.email,
          AssignedEmail: form.assignedEmail,
          CreatedByEmail: user.email,
          IsAcknowledged: false,
          DueDate: form.dueDate || null,
        })
        if (addCalendar && form.dueDate) {
          await createCalendarEvent({
            subject: `[Ticket] ${form.title}`,
            start: `${form.dueDate}T09:00:00`,
            end: `${form.dueDate}T10:00:00`,
            location: form.location,
            attendees: form.attendees.split(',').map(s => s.trim()).filter(Boolean),
            body: form.description,
          })
        }
        addToast('success', `สร้าง Ticket เรียบร้อย (${ticketNum})`)
      } else if (type === 'Task') {
        await spCreate('PM_Tasks', {
          Title: form.title,
          ProjectID: form.projectId,
          IsCompleted: false,
          IsAcknowledged: false,
          AssignedEmail: form.assignedEmail,
          DueDate: form.dueDate || null,
        })
        addToast('success', 'สร้าง Task เรียบร้อย')
      } else if (type === 'Leave') {
        await spCreate('HD_LeaveRequests', {
          Title: `ลา ${form.leaveDate} - ${user.displayName}`,
          LeaveDate: form.leaveDate,
          LeaveType: form.leaveType,
          RequestedBy: user.displayName,
          RequestedByEmail: user.email,
          ApproverEmail: form.approverEmail,
          Status: 'Pending',
        })
        addToast('success', 'ส่งคำขอลาแล้ว รอการอนุมัติ')
      }
      setForm({ title: '', description: '', priority: 'Medium', category: '', customerEmail: '', assignedEmail: '', dueDate: '', projectId: '', leaveType: 'ลาพักร้อน', leaveDate: '', approverEmail: '', attendees: '', location: '' })
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div>
      <Header title="แจ้งงาน / Submit" />
      <div className="p-4 md:p-6 max-w-2xl">
        <Card>
          <div className="mb-6">
            <label className={labelClass}>ประเภท</label>
            <div className="flex gap-2">
              {(['Ticket', 'Task', 'Leave'] as SubmitType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {t === 'Ticket' ? '🎫 Ticket' : t === 'Task' ? '📋 Task' : '📅 ขอลา'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {(type === 'Ticket' || type === 'Task') && (
              <>
                <div>
                  <label className={labelClass}>หัวข้อ *</label>
                  <input required value={form.title} onChange={e => set('title', e.target.value)} className={inputClass} placeholder="ระบุหัวข้อ..." />
                </div>
                <div>
                  <label className={labelClass}>รายละเอียด</label>
                  <textarea value={form.description} onChange={e => set('description', e.target.value)} className={inputClass} rows={4} placeholder="รายละเอียดเพิ่มเติม..." />
                </div>
              </>
            )}

            {type === 'Ticket' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Priority</label>
                    <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputClass}>
                      {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>หมวดหมู่</label>
                    <input value={form.category} onChange={e => set('category', e.target.value)} className={inputClass} placeholder="เช่น Network, Software..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Email ผู้แจ้ง</label>
                    <input type="email" value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)} className={inputClass} placeholder={user?.email} />
                  </div>
                  <div>
                    <label className={labelClass}>Assign ให้ (Email)</label>
                    <input type="email" value={form.assignedEmail} onChange={e => set('assignedEmail', e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className={inputClass} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="addCal" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)} className="rounded" />
                  <label htmlFor="addCal" className="text-sm text-gray-600 dark:text-gray-400">เพิ่มใน Outlook Calendar</label>
                </div>
                {addCalendar && (
                  <div className="space-y-3 pl-4 border-l-2 border-primary-200">
                    <div>
                      <label className={labelClass}>เชิญผู้เข้าร่วม (Email คั่นด้วย ,)</label>
                      <input value={form.attendees} onChange={e => set('attendees', e.target.value)} className={inputClass} placeholder="email1@co.th, email2@co.th" />
                    </div>
                    <div>
                      <label className={labelClass}>สถานที่</label>
                      <input value={form.location} onChange={e => set('location', e.target.value)} className={inputClass} />
                    </div>
                  </div>
                )}
              </>
            )}

            {type === 'Task' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Project ID</label>
                    <input value={form.projectId} onChange={e => set('projectId', e.target.value)} className={inputClass} placeholder="ID โครงการ" />
                  </div>
                  <div>
                    <label className={labelClass}>Assign ให้ (Email)</label>
                    <input type="email" value={form.assignedEmail} onChange={e => set('assignedEmail', e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className={inputClass} />
                </div>
              </>
            )}

            {type === 'Leave' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>วันที่ลา *</label>
                    <input required type="date" value={form.leaveDate} onChange={e => set('leaveDate', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>ประเภทการลา</label>
                    <select value={form.leaveType} onChange={e => set('leaveType', e.target.value)} className={inputClass}>
                      {['ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาอื่นๆ'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email ผู้อนุมัติ *</label>
                  <input required type="email" value={form.approverEmail} onChange={e => set('approverEmail', e.target.value)} className={inputClass} placeholder="approver@company.com" />
                </div>
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full justify-center">
              {loading ? 'กำลังส่ง...' : 'ส่งคำขอ'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
