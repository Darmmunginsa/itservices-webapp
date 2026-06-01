import { useEffect, useState, useMemo } from 'react'
import {
  format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths, isSameDay, isSameMonth,
  isToday, startOfDay, endOfDay,
} from 'date-fns'
import { th } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Video, MapPin } from 'lucide-react'
import { useOutlook } from '../../hooks/useOutlook'
import type { OutlookEvent } from '../../services/graph'

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

export function OutlookCalendar() {
  const { events, loading, fetchRange } = useOutlook()
  const [view, setView] = useState<ViewMode>('week')
  const [cursor, setCursor] = useState(new Date())

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
    </div>
  )
}
