import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday, getDay } from 'date-fns'
import { th } from 'date-fns/locale'
import { spGet, spCreate } from '../../services/sharepoint'
import { sendTemplateEmail } from '../../services/emailService'
import type { Holiday, LeaveRequest, AgentProfile, LeaveQuota } from '../../types/common'
import { cn } from '../../utils/colorUtils'
import { useAppStore } from '../../store/useAppStore'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import { OptionSelect } from '../common/OptionSelect'

const WEEKDAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

// mapping ภาษาอังกฤษ ↔ ไทย (รองรับข้อมูลเก่าที่กรอกเป็นอังกฤษ)
const LEAVE_TYPE_ALIASES: Record<string, string[]> = {
  'ลาพักร้อน': ['annual', 'vacation', 'พักร้อน'],
  'ลาป่วย':    ['sick', 'ป่วย'],
  'ลากิจ':     ['personal', 'กิจ', 'ลากิจธุระ'],
  'ลาคลอด':   ['maternity', 'คลอด'],
  'ลาอื่นๆ':   ['other', 'others', 'อื่น', 'อื่นๆ'],
}
function leaveTypeMatch(stored: string, quotaTitle: string): boolean {
  const s = stored.trim().toLowerCase()
  const q = quotaTitle.trim().toLowerCase()
  if (s === q) return true
  const aliases = LEAVE_TYPE_ALIASES[quotaTitle] ?? []
  return aliases.some(a => s === a || s.startsWith(a))
}

type ModalMode = 'leave' | 'holiday'

const EMPTY_LEAVE    = { leaveType: 'ลาพักร้อน', reason: '' }
const EMPTY_HOLIDAY  = { title: '', holidayType: 'บริษัท' as Holiday['HolidayType'] }

export function CompanyCalendar() {
  const { user, addToast } = useAppStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [holidays, setHolidays]   = useState<Holiday[]>([])
  const [leaves, setLeaves]       = useState<LeaveRequest[]>([])
  const [agents, setAgents]       = useState<AgentProfile[]>([])
  const [quotas, setQuotas]       = useState<LeaveQuota[]>([])
  const [myLeaves, setMyLeaves]   = useState<LeaveRequest[]>([])
  const [showBalance, setShowBalance] = useState(false)

  // Modal state
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [showModal, setShowModal]     = useState(false)
  const [modalMode, setModalMode]     = useState<ModalMode>('leave')
  const [leaveForm, setLeaveForm]     = useState({ ...EMPTY_LEAVE })
  const [holidayForm, setHolidayForm] = useState({ ...EMPTY_HOLIDAY })
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
  }, [])

  // โหลดโควต้า + คำขอลาของตัวเอง (ทุกสถานะ) เพื่อคำนวณวันคงเหลือ
  useEffect(() => {
    if (!user?.email) return
    spGet<LeaveQuota>('HD_LeaveQuota', `EmployeeEmail eq '${user.email}'`, 'Id,Title,Days,EmployeeEmail', 'Title asc', 100)
      .then(setQuotas).catch(() => {})
    // ดึงทุก record ของปีนี้ แล้ว filter email ฝั่ง client (case-insensitive)
    // เพื่อรองรับข้อมูลที่กรอก manual ซึ่ง email อาจว่าง/ต่างเคส
    const year = new Date().getFullYear()
    spGet<LeaveRequest & { RequestedEmail: string }>(
      'HD_LeaveRequests',
      `LeaveDate ge '${year}-01-01' and LeaveDate le '${year}-12-31'`,
      'Id,LeaveType,LeaveDate,Status,RequestedEmail',
      undefined, 2000
    ).then(all => {
      const myEmail = user.email.toLowerCase()
      // match: RequestedEmail ตรง (case-insensitive) หรือว่าง (กรอก manual ไม่ได้ใส่)
      const mine = all.filter(l => {
        const re = (l.RequestedEmail ?? '').toLowerCase()
        return re === myEmail || re === ''
      })
      setMyLeaves(mine)
    }).catch(() => {})
  }, [user?.email])

  // คำนวณวันลาคงเหลือปีปัจจุบัน แยกตามประเภท
  const curYear = String(new Date().getFullYear())
  const balance = quotas.map(q => {
    const rows = myLeaves.filter(l => {
      const dateStr = (l.LeaveDate ?? '').slice(0, 4)
      return leaveTypeMatch(l.LeaveType ?? '', q.Title) && dateStr === curYear
    })
    const used = rows.filter(l => l.Status === 'Approved').length
    const pending = rows.filter(l => l.Status === 'Pending').length
    return { type: q.Title, quota: q.Days, used, pending, remaining: q.Days - used - pending }
  })

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

  function openModal(day: Date) {
    setSelectedDay(day)
    setModalMode('leave')
    setLeaveForm({ ...EMPTY_LEAVE })
    setHolidayForm({ ...EMPTY_HOLIDAY })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setSelectedDay(null) }

  /* ── Leave request ── */
  async function submitLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedDay) return
    // ผู้อนุมัติถูกกำหนดโดย Admin (ApproverEmail ใน profile ของผู้ใช้)
    const myProfile = agents.find(a => (a.EmailText ?? '').toLowerCase() === user.email.toLowerCase())
    const approverEmail = myProfile?.ApproverEmail
    if (!approverEmail) { addToast('error', 'ยังไม่ได้กำหนดผู้อนุมัติของคุณ กรุณาติดต่อ Admin'); return }
    const b = balance.find(x => x.type === leaveForm.leaveType)
    if (b && b.remaining <= 0 && !window.confirm(`วันลาประเภท "${leaveForm.leaveType}" คงเหลือ ${b.remaining} วันแล้ว\nต้องการส่งคำขอต่อหรือไม่?`)) return
    setSaving(true)
    try {
      const approver  = agents.find(a => a.EmailText === approverEmail)
      const dateStr   = format(selectedDay, 'yyyy-MM-dd')
      await spCreate('HD_LeaveRequests', {
        Title:          leaveForm.reason || `ลา ${dateStr} - ${user.displayName}`,
        LeaveDate:      dateStr,
        LeaveType:      leaveForm.leaveType,
        RequestedBy:    user.displayName,
        RequestedEmail: user.email,
        ApproverEmail:  approverEmail,
        ApproverName:   approver?.Title ?? '',
        Status:         'Pending',
        Note:           leaveForm.reason,
      })
      addToast('success', `ส่งคำขอลา ${format(selectedDay, 'd MMM yyyy', { locale: th })} แล้ว — รอการอนุมัติ`)
      // ส่ง email แจ้งผู้อนุมัติ
      sendTemplateEmail('leave_requested', {
        requester_name: user.displayName,
        leave_type:     leaveForm.leaveType,
        leave_date:     dateStr,
        approver_name:  approver?.Title ?? '',
        link:           window.location.origin,
      }, [approverEmail])
      // refresh balance
      if (user.email) {
        const yr = new Date().getFullYear()
        spGet<LeaveRequest & { RequestedEmail: string }>(
          'HD_LeaveRequests',
          `LeaveDate ge '${yr}-01-01' and LeaveDate le '${yr}-12-31'`,
          'Id,LeaveType,LeaveDate,Status,RequestedEmail', undefined, 2000
        ).then(all => {
          const myEmail = user.email.toLowerCase()
          setMyLeaves(all.filter(l => { const re = (l.RequestedEmail ?? '').toLowerCase(); return re === myEmail || re === '' }))
        }).catch(() => {})
      }
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

  // ผู้อนุมัติของผู้ใช้ปัจจุบัน (Admin กำหนดใน HD_AgentProfiles.ApproverEmail)
  const myProfile = agents.find(a => (a.EmailText ?? '').toLowerCase() === (user?.email ?? '').toLowerCase())
  const myApprover = myProfile?.ApproverEmail
    ? agents.find(a => a.EmailText === myProfile.ApproverEmail)
    : undefined

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const tabCx   = (active: boolean) =>
    `flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500'
    }`

  /* modal tabs visible to all users */
  const modalTabs: { key: ModalMode; label: string }[] = [
    { key: 'leave', label: '📅 ขอลา' },
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
          <span className="hidden sm:inline ml-auto text-gray-400 italic">กดที่วันเพื่อจัดการ</span>
        </div>

        {/* Grid */}
        <table className="w-full text-xs table-fixed">
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
                        'p-1 align-top border border-gray-100 dark:border-gray-600 min-h-[52px] overflow-hidden transition-colors',
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
              <OptionSelect category="LeaveType" defaults={['ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาอื่นๆ']} value={leaveForm.leaveType} onChange={v => setLeaveForm(f => ({ ...f, leaveType: v }))} className={inputCx} />
              {(() => {
                const b = balance.find(x => leaveTypeMatch(leaveForm.leaveType, x.type) || leaveTypeMatch(x.type, leaveForm.leaveType))
                if (!b) return null
                const color = b.remaining <= 0 ? 'text-red-600' : b.remaining <= 2 ? 'text-amber-600' : 'text-green-600'
                return (
                  <p className={`text-xs mt-1 font-medium ${color}`}>
                    คงเหลือปี {curYear}: {b.remaining}/{b.quota} วัน
                    {b.pending > 0 && <span className="text-gray-400 font-normal"> (รออนุมัติ {b.pending})</span>}
                  </p>
                )
              })()}
            </div>

            {/* Balance checker */}
            {balance.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button type="button" onClick={() => setShowBalance(s => !s)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span>📊 ตรวจสอบวันลาคงเหลือ (ปี {curYear})</span>
                  <span className="text-gray-400">{showBalance ? '▲' : '▼'}</span>
                </button>
                {showBalance && (
                  <table className="w-full text-xs border-t border-gray-100 dark:border-gray-700">
                    <thead>
                      <tr className="text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                        <th className="text-left font-medium px-3 py-1.5">ประเภท</th>
                        <th className="font-medium px-1 py-1.5">โควต้า</th>
                        <th className="font-medium px-1 py-1.5">ใช้ไป</th>
                        <th className="font-medium px-1 py-1.5">รอ</th>
                        <th className="font-medium px-3 py-1.5">คงเหลือ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balance.map(b => (
                        <tr key={b.type} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{b.type}</td>
                          <td className="text-center py-1.5">{b.quota}</td>
                          <td className="text-center py-1.5 text-gray-500">{b.used}</td>
                          <td className="text-center py-1.5 text-amber-600">{b.pending || '-'}</td>
                          <td className={`text-center px-3 py-1.5 font-semibold ${b.remaining <= 0 ? 'text-red-600' : 'text-green-600'}`}>{b.remaining}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            <div>
              <label className={labelCx}>เหตุผล</label>
              <textarea value={leaveForm.reason}
                onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                className={inputCx} rows={2} placeholder="ระบุเหตุผล..." />
            </div>
            <div>
              <label className={labelCx}>ผู้อนุมัติ (กำหนดโดย Admin)</label>
              {myApprover
                ? <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
                    {myApprover.Title} <span className="text-gray-400">({myApprover.Role})</span>
                  </div>
                : <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                    ⚠️ ยังไม่ได้กำหนดผู้อนุมัติ — กรุณาติดต่อ Admin
                  </div>}
            </div>
            <Button type="submit" disabled={saving || !myApprover} className="w-full justify-center">
              {saving ? 'กำลังส่ง...' : 'ส่งคำขอลา'}
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
