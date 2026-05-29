import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday, getDay } from 'date-fns'
import { th } from 'date-fns/locale'
import { spGet, spCreate } from '../../services/sharepoint'
import type { Holiday, LeaveRequest, AgentProfile } from '../../types/common'
import type { Project } from '../../types/project'
import { cn } from '../../utils/colorUtils'
import { useAppStore } from '../../store/useAppStore'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'

const WEEKDAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

type ModalMode = 'leave' | 'task' | 'holiday'

const EMPTY_LEAVE    = { leaveType: 'ลาพักร้อน', reason: '', approverEmail: '' }
const EMPTY_HOLIDAY  = { title: '', holidayType: 'บริษัท' as Holiday['HolidayType'] }
const EMPTY_TASK     = { title: '', taskNote: '', taskType: 'personal' as 'personal' | 'project', projectId: '', assignees: [] as string[] }

export function CompanyCalendar() {
  const { user, addToast } = useAppStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [holidays, setHolidays]   = useState<Holiday[]>([])
  const [leaves, setLeaves]       = useState<LeaveRequest[]>([])
  const [agents, setAgents]       = useState<AgentProfile[]>([])
  const [projects, setProjects]   = useState<Project[]>([])

  // Modal state
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showModal, setShowModal]     = useState(false)
  const [modalMode, setModalMode]     = useState<ModalMode>('leave')
  const [leaveForm, setLeaveForm]     = useState({ ...EMPTY_LEAVE })
  const [holidayForm, setHolidayForm] = useState({ ...EMPTY_HOLIDAY })
  const [taskForm, setTaskForm]       = useState({ ...EMPTY_TASK })
  const [saving, setSaving]           = useState(false)

  const isAdmin = ['Admin', 'Boss'].includes(user?.role ?? '')

  function loadData() {
    spGet<Holiday>('HD_Holidays').then(setHolidays).catch(() => {})
    spGet<LeaveRequest>('HD_LeaveRequests', "Status eq 'Approved'").then(setLeaves).catch(() => {})
  }

  useEffect(() => {
    loadData()
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc')
      .then(setAgents).catch(() => {})
    spGet<Project>('PM_Projects', "Status eq 'Active'", undefined, 'Title asc')
      .then(setProjects).catch(() => {})
  }, [])

  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  function getDayInfo(day: Date) {
    const holiday   = holidays.find(h => isSameDay(new Date(h.HolidayDate), day))
    const dayLeaves = leaves.filter(l => isSameDay(new Date(l.LeaveDate), day))
    return { holiday, dayLeaves }
  }

  function prev() { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d) }
  function next() { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d) }

  function toggleAssignee(email: string) {
    setTaskForm(f => ({
      ...f,
      assignees: f.assignees.includes(email)
        ? f.assignees.filter(e => e !== email)
        : [...f.assignees, email],
    }))
  }

  function openModal(day: Date) {
    setSelectedDay(day)
    setModalMode('leave')
    setLeaveForm({ ...EMPTY_LEAVE })
    setHolidayForm({ ...EMPTY_HOLIDAY })
    setTaskForm({ ...EMPTY_TASK })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setSelectedDay(null) }

  /* ── Leave request ── */
  async function submitLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedDay) return
    if (!leaveForm.approverEmail) { addToast('error', 'กรุณาเลือกผู้อนุมัติ'); return }
    setSaving(true)
    try {
      const approver  = agents.find(a => a.EmailText === leaveForm.approverEmail)
      const dateStr   = format(selectedDay, 'yyyy-MM-dd')
      await spCreate('HD_LeaveRequests', {
        Title:         leaveForm.reason || `ลา ${dateStr} - ${user.displayName}`,
        LeaveDate:     dateStr,
        LeaveType:     leaveForm.leaveType,
        RequestedBy:   user.displayName,
        RequestedEmail: user.email,
        ApproverEmail: leaveForm.approverEmail,
        ApproverName:  approver?.Title ?? '',
        Status:        'Pending',
        Note:          leaveForm.reason,
      })
      addToast('success', `ส่งคำขอลา ${format(selectedDay, 'd MMM yyyy', { locale: th })} แล้ว — รอการอนุมัติ`)
      closeModal()
    } catch { addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally  { setSaving(false) }
  }

  /* ── Holiday ── */
  async function submitHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedDay || !holidayForm.title.trim()) return
    setSaving(true)
    try {
      await spCreate('HD_Holidays', {
        Title:       holidayForm.title,
        HolidayDate: format(selectedDay, 'yyyy-MM-dd'),
        HolidayType: holidayForm.holidayType,
      })
      addToast('success', `เพิ่มวันหยุด ${format(selectedDay, 'd MMM yyyy', { locale: th })} แล้ว`)
      closeModal()
      loadData()
    } catch { addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally  { setSaving(false) }
  }

  /* ── Task ── */
  async function submitTask(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedDay || !taskForm.title.trim()) return
    if (taskForm.taskType === 'project' && !taskForm.projectId) {
      addToast('error', 'กรุณาเลือกโครงการ'); return
    }
    setSaving(true)
    try {
      const dateStr   = format(selectedDay, 'yyyy-MM-dd')
      const projectID = taskForm.taskType === 'project' ? Number(taskForm.projectId) : 0

      // Build assignee list: if no one selected → assign to self
      const assigneeList =
        taskForm.taskType === 'project' && taskForm.assignees.length > 0
          ? taskForm.assignees.map(email => {
              const a = agents.find(ag => ag.EmailText === email)
              return { name: a?.Title ?? email, email }
            })
          : [{ name: user.displayName, email: user.email }]

      await Promise.all(
        assigneeList.map(a =>
          spCreate('PM_Tasks', {
            Title:          taskForm.title,
            DueDate:        dateStr,
            ProjectID:      projectID,
            AssignedTo:     a.name,
            AssignedEmail:  a.email,
            IsCompleted:    false,
            IsAcknowledged: false,
            TaskNote:       taskForm.taskNote || null,
          })
        )
      )

      const n = assigneeList.length
      addToast('success', `เพิ่ม Task "${taskForm.title}"${n > 1 ? ` ให้ ${n} คน` : ''} สำเร็จ`)
      closeModal()
    } catch { addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally  { setSaving(false) }
  }

  const approvers    = agents.filter(a => ['Boss', 'Admin', 'Supervisor'].includes(a.Role))
  const approverList = approvers.length > 0 ? approvers : agents

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const tabCx   = (active: boolean) =>
    `flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500'
    }`

  /* modal tabs visible to all users */
  const modalTabs: { key: ModalMode; label: string }[] = [
    { key: 'leave', label: '📅 ขอลา' },
    { key: 'task',  label: '✅ เพิ่ม Task' },
    ...(isAdmin ? [{ key: 'holiday' as ModalMode, label: '🏖 วันหยุด' }] : []),
  ]

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <button onClick={prev} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold">{format(currentDate, 'MMMM yyyy', { locale: th })}</span>
          <button onClick={next} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight size={16} /></button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-4 py-2 text-xs border-b border-gray-100 dark:border-gray-700">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> วันหยุดราชการ</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> วันหยุดบริษัท</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> วันลา (Approved)</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> วันนี้</span>
          <span className="ml-auto text-gray-400 italic">กดที่วันเพื่อจัดการ</span>
        </div>

        {/* Grid */}
        <table className="w-full text-xs">
          <thead>
            <tr>
              {WEEKDAYS.map(w => (
                <th key={w} className="py-2 text-center text-gray-400 font-medium">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIdx) => (
              <tr key={weekIdx}>
                {days.slice(weekIdx * 7, weekIdx * 7 + 7).map(day => {
                  const { holiday, dayLeaves } = getDayInfo(day)
                  const inMonth           = day.getMonth() === currentDate.getMonth()
                  const isSun             = getDay(day) === 0
                  const isRajakanHoliday  = holiday?.HolidayType === 'ราชการ'
                  const isCompanyHoliday  = holiday?.HolidayType === 'บริษัท'
                  return (
                    <td
                      key={day.toISOString()}
                      onClick={() => inMonth && openModal(day)}
                      className={cn(
                        'p-1 align-top border border-gray-100 dark:border-gray-600 min-h-[52px] transition-colors',
                        !inMonth && 'opacity-30',
                        inMonth && !holiday && 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20',
                        inMonth && isRajakanHoliday && 'bg-red-50 dark:bg-red-900/30 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40',
                        inMonth && isCompanyHoliday && 'bg-violet-50 dark:bg-violet-900/30 cursor-pointer hover:bg-violet-100 dark:hover:bg-violet-900/40',
                      )}
                    >
                      <div className={cn(
                        'w-6 h-6 flex items-center justify-center rounded-full mb-0.5 mx-auto font-bold text-[11px]',
                        isToday(day)              && 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700',
                        isSun && !isToday(day) && !holiday && 'text-red-500',
                        isRajakanHoliday && !isToday(day) && 'bg-red-500 text-white',
                        isCompanyHoliday && !isToday(day) && 'bg-violet-500 text-white',
                        !holiday && !isToday(day) && !isSun && 'text-gray-700 dark:text-gray-300',
                      )}>
                        {format(day, 'd')}
                      </div>
                      {holiday && (
                        <div className={cn(
                          'text-[9px] text-center leading-tight truncate px-0.5 font-medium',
                          isRajakanHoliday && 'text-red-600 dark:text-red-400',
                          isCompanyHoliday && 'text-violet-600 dark:text-violet-400',
                        )}>
                          {holiday.Title}
                        </div>
                      )}
                      {dayLeaves.map(l => (
                        <div key={l.id} className="text-[9px] bg-amber-400 dark:bg-amber-400 text-gray-900 dark:text-gray-900 rounded px-0.5 truncate mt-0.5 font-bold">
                          {l.RequestedBy}
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Day Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={selectedDay ? format(selectedDay, 'EEEE d MMMM yyyy', { locale: th }) : ''}
        size="sm"
      >
        {/* Mode tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4">
          {modalTabs.map(({ key, label }) => (
            <button key={key} onClick={() => setModalMode(key)} className={tabCx(modalMode === key)}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Leave Form ── */}
        {modalMode === 'leave' && (
          <form onSubmit={submitLeave} className="space-y-3">
            <div>
              <label className={labelCx}>ประเภทการลา</label>
              <select value={leaveForm.leaveType}
                onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value }))}
                className={inputCx}>
                {['ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาอื่นๆ'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCx}>เหตุผล</label>
              <textarea value={leaveForm.reason}
                onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                className={inputCx} rows={2} placeholder="ระบุเหตุผล..." />
            </div>
            <div>
              <label className={labelCx}>ผู้อนุมัติ *</label>
              <select required value={leaveForm.approverEmail}
                onChange={e => setLeaveForm(f => ({ ...f, approverEmail: e.target.value }))}
                className={inputCx}>
                <option value="">-- เลือกผู้อนุมัติ --</option>
                {approverList.map(a => (
                  <option key={a.id} value={a.EmailText}>{a.Title} ({a.Role})</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={saving} className="w-full justify-center">
              {saving ? 'กำลังส่ง...' : 'ส่งคำขอลา'}
            </Button>
          </form>
        )}

        {/* ── Task Form ── */}
        {modalMode === 'task' && (
          <form onSubmit={submitTask} className="space-y-2.5">
            {/* Task type toggle */}
            <div>
              <label className={labelCx}>ประเภท Task</label>
              <div className="flex gap-2">
                {([
                  { v: 'personal', label: '👤 ส่วนตัว' },
                  { v: 'project',  label: '📁 ใน Project' },
                ] as const).map(({ v, label }) => (
                  <button key={v} type="button"
                    onClick={() => setTaskForm(f => ({ ...f, taskType: v, projectId: '' }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      taskForm.taskType === v
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Project selector + invite — only when 'project' mode */}
            {taskForm.taskType === 'project' && (
              <>
                <div>
                  <label className={labelCx}>โครงการ *</label>
                  <select required value={taskForm.projectId}
                    onChange={e => setTaskForm(f => ({ ...f, projectId: e.target.value }))}
                    className={inputCx}>
                    <option value="">-- เลือกโครงการ --</option>
                    {projects.map(p => (
                      <option key={p.id} value={String(p.id)}>{p.Title}</option>
                    ))}
                  </select>
                </div>

                {/* Team invite checklist */}
                <div>
                  <label className={labelCx}>
                    มอบหมายให้ทีม
                    <span className="text-gray-400 font-normal ml-1">(ไม่เลือก = มอบให้ตัวเอง)</span>
                  </label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60 max-h-36 overflow-y-auto">
                    {agents.map(a => {
                      const isSelf  = a.EmailText === user?.email
                      const checked = taskForm.assignees.includes(a.EmailText)
                      return (
                        <label key={a.id}
                          className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 select-none">
                          <input
                            type="checkbox"
                            className="rounded accent-primary-600 flex-shrink-0"
                            checked={checked}
                            onChange={() => toggleAssignee(a.EmailText)}
                          />
                          <span className="text-sm flex-1 truncate">{a.Title}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">คุณ</span>
                          )}
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{a.Role}</span>
                        </label>
                      )
                    })}
                  </div>
                  {taskForm.assignees.length > 0 && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                      จะสร้าง {taskForm.assignees.length} Task สำหรับ {taskForm.assignees.length} คน
                    </p>
                  )}
                </div>
              </>
            )}

            <div>
              <label className={labelCx}>ชื่อ Task *</label>
              <input required value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                className={inputCx} placeholder="ระบุชื่องาน..." />
            </div>

            <div>
              <label className={labelCx}>หมายเหตุ</label>
              <textarea value={taskForm.taskNote}
                onChange={e => setTaskForm(f => ({ ...f, taskNote: e.target.value }))}
                className={inputCx} rows={2} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)..." />
            </div>

            <Button type="submit" disabled={saving} className="w-full justify-center">
              {saving ? 'กำลังบันทึก...' : 'เพิ่ม Task'}
            </Button>
          </form>
        )}

        {/* ── Holiday Form (Admin/Boss only) ── */}
        {modalMode === 'holiday' && isAdmin && (
          <form onSubmit={submitHoliday} className="space-y-3">
            <div>
              <label className={labelCx}>ชื่อวันหยุด *</label>
              <input required value={holidayForm.title}
                onChange={e => setHolidayForm(f => ({ ...f, title: e.target.value }))}
                className={inputCx} placeholder="เช่น วันปีใหม่, วันหยุดชดเชย..." />
            </div>
            <div>
              <label className={labelCx}>ประเภท</label>
              <div className="flex gap-2">
                {(['ราชการ', 'บริษัท'] as Holiday['HolidayType'][]).map(t => (
                  <button key={t} type="button"
                    onClick={() => setHolidayForm(f => ({ ...f, holidayType: t }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      holidayForm.holidayType === t
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={saving} className="w-full justify-center">
              {saving ? 'กำลังบันทึก...' : 'เพิ่มวันหยุด'}
            </Button>
          </form>
        )}
      </Modal>
    </>
  )
}
