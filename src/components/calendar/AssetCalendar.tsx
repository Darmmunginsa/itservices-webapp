import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, HardDrive, ShieldAlert } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isToday, getDay, differenceInCalendarDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { spGet } from '../../services/sharepoint'
import type { Asset } from '../../types/asset'
import { cn } from '../../utils/colorUtils'
import { Modal } from '../common/Modal'
import { useT } from '../../i18n/useT'

// เหตุการณ์ครบกำหนดของ asset 1 รายการ (ประกันหมด หรือ license/cert หมดอายุ)
interface DueEvent {
  asset: Asset
  date: string            // yyyy-MM-dd
  kind: 'warranty' | 'expiry'
}


export function AssetCalendar() {
  const tr = useT()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [assets, setAssets] = useState<Asset[]>([])
  const [dayModal, setDayModal] = useState<{ date: Date; events: DueEvent[] } | null>(null)

  useEffect(() => {
    // ตัด Retired ออก — ของที่ปลดระวางแล้วไม่ต้องเตือน
    spGet<Asset>('IT_Assets', "Status ne 'Retired'",
      'Id,Title,AssetCode,Category,Status,WarrantyDate,ExpiryDate', 'Title asc', 2000)
      .then(setAssets).catch(() => {})
  }, [])

  // รวมทุกวันครบกำหนด → group ตามวัน (asset หนึ่งชิ้นอาจมีทั้งประกันและ expiry)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DueEvent[]>()
    for (const a of assets) {
      const push = (raw: string | undefined, kind: DueEvent['kind']) => {
        if (!raw) return
        const date = raw.slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
        const arr = map.get(date) ?? []
        arr.push({ asset: a, date, kind })
        map.set(date, arr)
      }
      push(a.WarrantyDate, 'warranty')
      push(a.ExpiryDate, 'expiry')
    }
    return map
  }, [assets])

  // รายการใกล้ครบกำหนดภายใน 90 วัน (group ตามวัน เรียงวันใกล้สุดก่อน) — โชว์ใต้ปฏิทิน
  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const groups: { date: string; days: number; events: DueEvent[] }[] = []
    for (const [date, events] of eventsByDay) {
      const days = differenceInCalendarDays(new Date(date), today)
      if (days >= 0 && days <= 90) groups.push({ date, days, events })
    }
    return groups.sort((a, b) => a.days - b.days).slice(0, 10)
  }, [eventsByDay])

  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: calStart, end: calEnd })

  function prev() { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d) }
  function next() { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d) }

  // สีตามความเร่งด่วนของวันครบกำหนด (เทียบวันนี้)
  function urgencyCls(date: Date): string {
    const diff = differenceInCalendarDays(date, new Date())
    if (diff < 0)   return 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200'      // ผ่านมาแล้ว
    if (diff <= 30) return 'bg-red-500 text-white'                                              // ≤30 วัน
    if (diff <= 90) return 'bg-amber-400 text-gray-900'                                         // ≤90 วัน
    return 'bg-emerald-500 text-white'                                                          // ไกล
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <button onClick={prev} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold flex items-center gap-1.5">
            <HardDrive size={14} className="text-primary-600" />
            {format(currentDate, 'MMMM yyyy', { locale: th })}
          </span>
          <button onClick={next} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight size={16} /></button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-4 py-2 text-xs border-b border-gray-100 dark:border-gray-700">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> ≤30 {tr('cc.daysUnit')}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> ≤90 {tr('cc.daysUnit')}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> {tr('assetCal.far')}</span>
          <span className="hidden sm:inline ml-auto text-gray-400 italic">{tr('assetCal.tapDay')}</span>
        </div>

        {/* Grid */}
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr>
              {[tr('cal.dowMon'), tr('cal.dowTue'), tr('cal.dowWed'), tr('cal.dowThu'), tr('cal.dowFri'), tr('cal.dowSat'), tr('cal.dowSun')].map((w, wi) => (
                <th key={wi} className="py-2 text-center text-gray-400 font-medium">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil(days.length / 7) }).map((_, weekIdx) => (
              <tr key={weekIdx}>
                {days.slice(weekIdx * 7, weekIdx * 7 + 7).map(day => {
                  const dayKey  = format(day, 'yyyy-MM-dd')
                  const events  = eventsByDay.get(dayKey) ?? []
                  const inMonth = day.getMonth() === currentDate.getMonth()
                  const isSun   = getDay(day) === 0
                  return (
                    <td
                      key={day.toISOString()}
                      onClick={() => { if (inMonth && events.length) setDayModal({ date: day, events }) }}
                      className={cn(
                        'p-1 align-top border border-gray-100 dark:border-gray-600 min-h-[52px] overflow-hidden transition-colors',
                        !inMonth && 'opacity-30',
                        inMonth && events.length > 0 && 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20',
                      )}
                    >
                      <div className={cn(
                        'w-6 h-6 flex items-center justify-center rounded-full mb-0.5 mx-auto font-bold text-[11px]',
                        isToday(day) && 'bg-blue-500 text-white ring-2 ring-blue-300 dark:ring-blue-700',
                        isSun && !isToday(day) && 'text-red-500',
                        !isToday(day) && !isSun && 'text-gray-700 dark:text-gray-300',
                      )}>
                        {format(day, 'd')}
                      </div>
                      {/* หลายชิ้นหมดวันเดียวกัน → badge จำนวนเดียว ไม่ล้นช่อง */}
                      {inMonth && events.length > 0 && (
                        events.length === 1
                          ? <div className={cn('text-[9px] rounded px-0.5 truncate mt-0.5 font-bold text-center', urgencyCls(day))}>
                              {events[0].asset.Title}
                            </div>
                          : <div className={cn('text-[10px] rounded-full px-1 py-0.5 mt-0.5 font-bold text-center', urgencyCls(day))}>
                              {events.length} {tr('assetCal.items')}
                            </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── ใกล้ครบกำหนด 90 วัน (group ตามวัน) ── */}
      {upcoming.length > 0 && (
        <div className="mt-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-amber-500" /> {tr('assetCal.upcoming')}
          </h4>
          <div className="space-y-2">
            {upcoming.map(g => (
              <div key={g.date} className="flex items-start gap-2">
                <span className={cn('flex-shrink-0 text-[10px] font-bold rounded-full px-2 py-0.5 mt-0.5', urgencyCls(new Date(g.date)))}>
                  {g.days === 0 ? tr('cc.today') : `${g.days} ${tr('cc.daysUnit')}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-gray-400">{format(new Date(g.date), 'd MMM yyyy', { locale: th })} · {g.events.length} {tr('assetCal.items')}</p>
                  <p className="text-xs text-gray-700 dark:text-gray-200 truncate">
                    {g.events.map(e => e.asset.Title).join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal รายการ asset ของวันที่กด ── */}
      {dayModal && (
        <Modal open title={`${format(dayModal.date, 'd MMMM yyyy', { locale: th })} · ${dayModal.events.length} ${tr('assetCal.items')}`}
          onClose={() => setDayModal(null)}>
          <div className="space-y-2">
            {dayModal.events.map((e, i) => (
              <Link key={i} to="/assets" onClick={() => setDayModal(null)}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <HardDrive size={16} className="text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{e.asset.Title}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[e.asset.AssetCode, e.asset.Category].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 flex-shrink-0',
                  e.kind === 'warranty' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300')}>
                  {e.kind === 'warranty' ? tr('assetCal.warranty') : tr('assetCal.expiry')}
                </span>
              </Link>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
