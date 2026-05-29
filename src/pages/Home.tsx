import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket as TicketIcon, FolderOpen, AlertTriangle, CheckCircle, Pin } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { CompanyCalendar } from '../components/calendar/CompanyCalendar'
import { OutlookCalendar } from '../components/calendar/OutlookCalendar'
import { SkeletonCard } from '../components/common/Skeleton'
import { spGet } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { Project } from '../types/project'
import type { FocusItem } from '../types/common'
import type { Asset as AssetType } from '../types/asset'
import { getDueDateEmoji, getDueDateColor, formatDate, isWarrantyExpiringSoon } from '../utils/dateUtils'
import { getStatusColor } from '../utils/colorUtils'

interface Stats {
  openTickets: number
  activeProjects: number
  pendingLeave: number
  acknowledged: number
}

export default function Home() {
  const { user } = useAppStore()
  const [stats, setStats] = useState<Stats>({ openTickets: 0, activeProjects: 0, pendingLeave: 0, acknowledged: 0 })
  const [focusItems, setFocusItems] = useState<FocusItem[]>([])
  const [warningAssets, setWarningAssets] = useState<AssetType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([
      spGet<Ticket>('HD_Tickets', "Status ne 'Closed'"),
      spGet<Project>('PM_Projects', "Status eq 'Active'"),
      spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}'`, undefined, 'DueDate asc'),
      spGet<AssetType>('IT_Assets'),
    ]).then(([tickets, projects, focus, assets]) => {
      setStats({
        openTickets: tickets.length,
        activeProjects: projects.length,
        pendingLeave: 0,
        acknowledged: tickets.filter(t => t.IsAcknowledged).length,
      })
      setFocusItems(focus)
      setWarningAssets(assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate)))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  const statCards = [
    { label: 'Ticket เปิดอยู่', value: stats.openTickets,    icon: TicketIcon,     color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10' },
    { label: 'โครงการ Active', value: stats.activeProjects, icon: FolderOpen,     color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/10' },
    { label: 'รับทราบแล้ว',   value: stats.acknowledged,   icon: CheckCircle,    color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10' },
    { label: 'Asset หมดประกัน', value: warningAssets.length, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/10' },
  ]

  return (
    <div>
      <Header title={`สวัสดี, ${user?.displayName ?? '...'}`} />

      <div className="p-4 md:p-6 space-y-6">
        {/* Warranty Alert */}
        {warningAssets.length > 0 && (
          <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
            <p className="text-sm text-orange-700 dark:text-orange-400">
              มี {warningAssets.length} รายการ Asset ที่ประกันจะหมดภายใน 60 วัน
              <Link to="/assets" className="ml-1 underline font-medium">ดูรายการ</Link>
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : statCards.map(s => (
              <Card key={s.label} className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${s.bg}`}>
                  <s.icon size={20} className={s.color} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              </Card>
            ))
          }
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Focus Items */}
          <div className="xl:col-span-1">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Pin size={16} className="text-primary-600" />
                <h3 className="text-sm font-semibold">Focus Items</h3>
              </div>
              {focusItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">ไม่มีงาน Pin ไว้</p>
              ) : (
                <div className="space-y-2">
                  {focusItems.map(f => {
                    const color = getDueDateColor(f.DueDate)
                    return (
                      <Link
                        key={f.id}
                        to={f.FocusType === 'Ticket' ? `/tickets/${f.RefID}` : `/projects/${f.RefID}`}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800"
                      >
                        <span className="text-base">{getDueDateEmoji(color) || '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{f.Title}</p>
                          <p className="text-xs text-gray-400">{f.FocusType} • {formatDate(f.DueDate)}</p>
                        </div>
                        <Badge className={getStatusColor(f.Status)}>{f.Status}</Badge>
                      </Link>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Calendars */}
          <div className="xl:col-span-2 space-y-6">
            <OutlookCalendar />
            <CompanyCalendar />
          </div>
        </div>
      </div>
    </div>
  )
}
