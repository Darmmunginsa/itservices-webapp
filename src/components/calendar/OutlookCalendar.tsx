import { useEffect, useState, useMemo } from 'react'
import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isSameMonth,
  isToday, startOfDay, endOfDay,
} from 'date-fns'
import { th } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Video, MapPin, Plus } from 'lucide-react'
import { useOutlook } from '../../hooks/useOutlook'
import { useAppStore } from '../../store/useAppStore'
import { spGet, spCreate } from '../../services/sharepoint'
import { Modal } from '../common/Modal'
import { Button } from '../common/Button'
import type { OutlookEvent } from '../../services/graph'
import type { AgentProfile } from '../../types/common'
import type { Project } from '../../types/project'

type ViewMode = 'day' | 'week' | 'month'

function joinUrl(ev: OutlookEvent): string | null {
  return ev.onlineMeeting?.joinUrl ?? ev.onlineMeetingUrl ?? null
}

function timeLabel(ev: OutlookEvent): string {
  if (ev.isAllDay) return 'ทั้งวัน'
  const s = format(parseISO(ev.start.dateTime), 'HH:mm')
  const e = format(parseISO(ev.end.dateTime), 'HH:mm')
  return `${s} – ${e}`
}

/** Single event card used in Day and Week views */
function EventCard({ ev }: { ev: OutlookEvent }) {
  const url = joinUrl(ev)
  return (
    <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 space-y-1 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug flex-1">
          {ev.subject}
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md px-2 py-0.5 transition-colors"
          >
            <Video size={10} /> Join
          </a>
        )}
      </div>
      <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">{timeLabel(ev)}</p>
      {ev.location?.displayName && (
        <p className="text-xs text-gray-400 flex items-center gap-1 truncate">
          <MapPin size={10} className="flex-shrink-0" />
          {ev.location.displayName}
        </p>
      )}
    </div>
  )
}

/** Day view: events for a single date */
function DayView({ date, events }: { date: Date; events: OutlookEvent[] }) {
  const dayEvents = events.filter(ev =>
    isSameDay(parseISO(ev.start.dateTime), date)
  )
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 pb-1">
        {format(date, 'EEEE d MMMM yyyy', { locale: th })}
      </p>
      {dayEvents.length === 0
        ? <p className="text-sm text-gray-400 text-center py-6">ไม่มีกิจกรรม</p>
        : dayEvents.map(ev => <EventCard key={ev.id} ev={ev} />)
      }
    </div>
  )
}

/** Week view: grouped by day Mon–Sun */
function WeekView({ weekStart, events }: { weekStart: Date; events: OutlookEvent[] }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  return (
    <div className="space-y-3">
      {days.map(day => {
        const dayEvents = events.filter(ev =>
          isSameDay(parseISO(ev.start.dateTime), day)
        )
        return (
          <div key={day.toISOString()}>
            <div className={`flex items-center gap-2 mb-1.5 pb-1 border-b border-gray-300 dark:border-gray-600 ${
              isToday(day) ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'
            }`}>
              <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                isToday(day) ? 'bg-primary-600 text-white' : ''
              }`}>
                {format(day, 'd')}
              </span>
              <span className="text-xs font-medium">{format(day, 'EEEE', { locale: th })}</span>
              {dayEvents.length > 0 && (
                <span className="ml-auto text-xs text-gray-400">{dayEvents.length} รายการ</span>
              )}
            </div>
            {dayEvents.length === 0
              ? <p className="text-xs text-gray-300 dark:text-gray-600 pl-1">—</p>
              : <div className="space-y-1.5">
                  {dayEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </div>
            }
          </div>
        )
      })}
    </div>
  )
}

/** Month view: calendar grid */
function MonthView({
  monthStart, events, onDayClick,
}: {
  monthStart: Date
  events: OutlookEvent[]
  onDayClick: (d: Date) => void
}) {
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 })
  const days: Date[] = []
  let cur = gridStart
  while (cur <= gridEnd) {
    days.push(cur)
    cur = addDays(cur, 1)
  }

  const DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px bg-gray-300 dark:bg-gray-600 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
        {days.map(day => {
          const dayEvents = events.filter(ev =>
            isSameDay(parseISO(ev.start.dateTime), day)
          )
          const hasJoin = dayEvents.some(ev => joinUrl(ev))
          const inMonth = isSameMonth(day, monthStart)
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`bg-white dark:bg-gray-900 min-h-[48px] p-1 text-left transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20 ${
                !inMonth ? 'opacity-30' : ''
              }`}
            >
              <span className={`text-xs font-medium flex items-center justify-center w-5 h-5 rounded-full ${
                isToday(day)
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {format(day, 'd')}
              </span>
              {/* Event dots / chips */}
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 2).map(ev => (
                  <div
                    key={ev.id}
                    className={`text-[9px] leading-tight truncate rounded px-1 py-px ${
                      joinUrl(ev)
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                    }`}
                  >
                    {ev.subject}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-gray-400">+{dayEvents.length - 2}</div>
                )}
              </div>
              {hasJoin && dayEvents.length === 0 && null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const EMPTY_TASK = { title: '', taskType: 'personal' as 'personal' | 'project', projectId: '', assigneeEmail: '', date: '', time: '09:00', taskNote: '' }

export function OutlookCalendar() {
  const { events, loading, fetchRange } = useOutlook()
  const { user, addToast } = useAppStore()
  const [view, setView] = useState<ViewMode>('week')
  const [cursor, setCursor] = useState(new Date())

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ ...EMPTY_TASK })
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc').then(setAgents).catch(() => {})
    spGet<Project>('PM_Projects', "Status eq 'Active'", undefined, 'Title asc').then(setProjects).catch(() => {})
  }, [])

  function openTaskModal(date?: Date) {
    setTaskForm({
      ...EMPTY_TASK,
      date: format(date ?? new Date(), 'yyyy-MM-dd'),
      assigneeEmail: user?.email ?? '',
    })
    setShowTaskModal(true)
  }

  async function submitTask(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { addToast('error', 'ไม่พบข้อมูล User กรุณา refresh'); return }
    if (!taskForm.title.trim()) { addToast('error', 'กรุณาระบุชื่อ Task'); return }
    if (!taskForm.date) { addToast('error', 'กรุณาเลือกวันที่'); return }
    if (taskForm.taskType === 'project' && !taskForm.projectId) { addToast('error', 'กรุณาเลือกโครงการ'); return }
    setSaving(true)
    try {
      const dueDateTime = taskForm.time
        ? `${taskForm.date}T${taskForm.time}:00`
        : taskForm.date
      const assignedAgent = agents.find(a => a.EmailText === taskForm.assigneeEmail)
      await spCreate('PM_Tasks', {
        Title:          taskForm.title,
        DueDate:        dueDateTime,
        ProjectID:      taskForm.taskType === 'project' && taskForm.projectId ? Number(taskForm.projectId) : 0,
        AssignedTo:     assignedAgent?.Title ?? user.displayName,
        AssignedEmail:  taskForm.assigneeEmail || user.email,
        IsCompleted:    false,
        IsAcknowledged: false,
        TaskNote:       taskForm.taskNote || null,
      })
      addToast('success', `เพิ่ม Task "${taskForm.title}" สำเร็จ`)
      setShowTaskModal(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addToast('error', msg)
      console.error('submitTask error:', err)
    } finally { setSaving(false) }
  }

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  // Compute date range to fetch based on view
  const { rangeStart, rangeEnd, label } = useMemo(() => {
    if (view === 'day') {
      const s = startOfDay(cursor)
      const e = endOfDay(cursor)
      return {
        rangeStart: s, rangeEnd: e,
        label: format(cursor, 'd MMMM yyyy', { locale: th }),
      }
    }
    if (view === 'week') {
      const s = startOfWeek(cursor, { weekStartsOn: 1 })
      const e = endOfWeek(cursor, { weekStartsOn: 1 })
      return {
        rangeStart: s, rangeEnd: e,
        label: `${format(s, 'd MMM', { locale: th })} – ${format(e, 'd MMM yyyy', { locale: th })}`,
      }
    }
    // month
    const s = startOfMonth(cursor)
    const e = endOfMonth(cursor)
    return {
      rangeStart: startOfWeek(s, { weekStartsOn: 1 }),
      rangeEnd: endOfWeek(e, { weekStartsOn: 1 }),
      label: format(cursor, 'MMMM yyyy', { locale: th }),
    }
  }, [view, cursor])

  useEffect(() => {
    fetchRange(rangeStart, rangeEnd)
  }, [rangeStart, rangeEnd, fetchRange])

  function navigate(dir: 1 | -1) {
    if (view === 'day') setCursor(d => addDays(d, dir))
    else if (view === 'week') setCursor(d => (dir === 1 ? addWeeks(d, 1) : subWeeks(d, 1)))
    else setCursor(d => (dir === 1 ? addMonths(d, 1) : subMonths(d, 1)))
  }

  function goToday() { setCursor(new Date()) }

  // Month view: clicking a day switches to day view
  function handleDayClick(day: Date) {
    setCursor(day)
    setView('day')
  }

  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 })
  const monthStart = startOfMonth(cursor)

  return (
    <div className="space-y-3">
      {/* View switcher */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {(['day', 'week', 'month'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${
              view === v
                ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {v === 'day' ? 'วัน' : v === 'week' ? 'สัปดาห์' : 'เดือน'}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => openTaskModal(cursor)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus size={12} /> Task
        </button>
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</span>
          <button
            onClick={goToday}
            className="text-[10px] px-2 py-0.5 rounded-full border border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors font-medium"
          >
            วันนี้
          </button>
        </div>
        <button
          onClick={() => navigate(1)}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar content */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {view === 'day' && <DayView date={cursor} events={events} />}
          {view === 'week' && <WeekView weekStart={weekStart} events={events} />}
          {view === 'month' && (
            <MonthView monthStart={monthStart} events={events} onDayClick={handleDayClick} />
          )}
        </>
      )}

      {/* Task Modal */}
      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)} title="✅ เพิ่ม Task" size="sm">
        <form onSubmit={submitTask} className="space-y-3">

          {/* Task type toggle */}
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

          <div>
            <label className={labelCx}>ชื่อ Task *</label>
            <input required value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              className={inputCx} placeholder="ระบุชื่องาน..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCx}>วันที่ *</label>
              <input required type="date" value={taskForm.date}
                onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))}
                className={inputCx} />
            </div>
            <div>
              <label className={labelCx}>เวลา</label>
              <input type="time" value={taskForm.time}
                onChange={e => setTaskForm(f => ({ ...f, time: e.target.value }))}
                className={inputCx} />
            </div>
          </div>

          {/* Project — only when project mode */}
          {taskForm.taskType === 'project' && (
            <div>
              <label className={labelCx}>โครงการ *</label>
              <select required value={taskForm.projectId}
                onChange={e => setTaskForm(f => ({ ...f, projectId: e.target.value }))}
                className={inputCx}>
                <option value="">-- เลือกโครงการ --</option>
                {projects.map(p => <option key={p.id} value={String(p.id)}>{p.Title}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCx}>มอบหมายให้</label>
            <select value={taskForm.assigneeEmail}
              onChange={e => setTaskForm(f => ({ ...f, assigneeEmail: e.target.value }))}
              className={inputCx}>
              <option value={user?.email ?? ''}>{user?.displayName} (ฉัน)</option>
              {agents.filter(a => a.EmailText !== user?.email).map(a => (
                <option key={a.id} value={a.EmailText}>{a.Title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCx}>หมายเหตุ</label>
            <textarea value={taskForm.taskNote}
              onChange={e => setTaskForm(f => ({ ...f, taskNote: e.target.value }))}
              className={inputCx} rows={2} placeholder="รายละเอียดเพิ่มเติม..." />
          </div>

          <Button type="submit" disabled={saving} className="w-full justify-center">
            {saving ? 'กำลังบันทึก...' : 'เพิ่ม Task'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
