import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday, getDay } from 'date-fns'
import { th } from 'date-fns/locale'
import { spGet } from '../../services/sharepoint'
import type { Holiday, LeaveRequest } from '../../types/common'
import { cn } from '../../utils/colorUtils'

const WEEKDAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

export function CompanyCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])

  useEffect(() => {
    spGet<Holiday>('HD_Holidays').then(setHolidays).catch(() => {})
    spGet<LeaveRequest>('HD_LeaveRequests', "Status eq 'Approved'").then(setLeaves).catch(() => {})
  }, [])

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function getDayInfo(day: Date) {
    const holiday = holidays.find(h => isSameDay(new Date(h.HolidayDate), day))
    const dayLeaves = leaves.filter(l => isSameDay(new Date(l.LeaveDate), day))
    return { holiday, dayLeaves }
  }

  function prev() {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() - 1)
    setCurrentDate(d)
  }

  function next() {
    const d = new Date(currentDate)
    d.setMonth(d.getMonth() + 1)
    setCurrentDate(d)
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <button onClick={prev} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold">
          {format(currentDate, 'MMMM yyyy', { locale: th })}
        </span>
        <button onClick={next} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2 text-xs border-b border-gray-100 dark:border-gray-800">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> วันหยุดราชการ</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> วันหยุดบริษัท</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> วันลา (Approved)</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> วันนี้</span>
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
                const inMonth = day.getMonth() === currentDate.getMonth()
                const isSun = getDay(day) === 0
                return (
                  <td
                    key={day.toISOString()}
                    className={cn(
                      'p-1 align-top border border-gray-100 dark:border-gray-800 min-h-[52px]',
                      !inMonth && 'opacity-30',
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 flex items-center justify-center rounded-full mb-0.5 mx-auto font-medium',
                      isToday(day) && 'bg-blue-500 text-white',
                      isSun && !isToday(day) && 'text-red-500',
                      holiday?.HolidayType === 'ราชการ' && !isToday(day) && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                      holiday?.HolidayType === 'บริษัท' && !isToday(day) && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                    )}>
                      {format(day, 'd')}
                    </div>
                    {holiday && (
                      <div className="text-[9px] text-center text-gray-500 dark:text-gray-400 leading-tight truncate px-0.5">
                        {holiday.Title}
                      </div>
                    )}
                    {dayLeaves.map(l => (
                      <div key={l.id} className="text-[9px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded px-0.5 truncate mt-0.5">
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
  )
}
