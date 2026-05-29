import { useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { useOutlook } from '../../hooks/useOutlook'
import { SkeletonRow } from '../common/Skeleton'

export function OutlookCalendar() {
  const { events, loading, fetchWeekly } = useOutlook()

  useEffect(() => {
    fetchWeekly()
  }, [fetchWeekly])

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <Calendar size={16} className="text-primary-600" />
        <span className="text-sm font-semibold">Outlook Calendar (สัปดาห์นี้)</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-64 overflow-y-auto">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">ไม่มีกิจกรรมสัปดาห์นี้</div>
        ) : (
          events.map(ev => (
            <div key={ev.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <div className="flex-shrink-0 w-10 text-center">
                <div className="text-[10px] text-gray-400 uppercase">
                  {format(parseISO(ev.start.dateTime), 'EEE', { locale: th })}
                </div>
                <div className="text-sm font-bold text-primary-600">
                  {format(parseISO(ev.start.dateTime), 'd')}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ev.subject}</p>
                <p className="text-xs text-gray-400">
                  {ev.isAllDay
                    ? 'ทั้งวัน'
                    : `${format(parseISO(ev.start.dateTime), 'HH:mm')} – ${format(parseISO(ev.end.dateTime), 'HH:mm')}`}
                </p>
                {ev.location?.displayName && (
                  <p className="text-xs text-gray-400 truncate">{ev.location.displayName}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
