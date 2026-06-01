import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket as TicketIcon, FolderOpen, AlertTriangle, CheckCircle, Pin, X } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { SkeletonCard } from '../components/common/Skeleton'
import { spGet, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { Project } from '../types/project'
import type { FocusItem, LeaveRequest } from '../types/common'
import type { Asset as AssetType } from '../types/asset'
import type { ProjectIncident } from '../types/project'
import { getDueDateEmoji, getDueDateColor, formatDate, isWarrantyExpiringSoon } from '../utils/dateUtils'
import { getStatusColor } from '../utils/colorUtils'

interface Stats {
  openTickets: number
  activeProjects: number
  openIncidents: number
}

export default function Home() {
  const { user, addToast } = useAppStore()
  const [stats, setStats] = useState<Stats>({ openTickets: 0, activeProjects: 0, openIncidents: 0 })
  const [focusItems, setFocusItems] = useState<FocusItem[]>([])
  const [warningAssets, setWarningAssets] = useState<AssetType[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user.role)
    const isBoss = ['Boss', 'Admin'].includes(user.role)

    // Ticket filter: same as MyWork — only tickets assigned/created by this user
    const ticketFilter = isAgent
      ? `AssignedEmail eq '${user.email}' and Status ne 'Closed'`
      : `CustomerEmail eq '${user.email}' and Status ne 'Closed'`

    // Incident filter: assigned to user and not resolved
    const incidentFilter = `AssignedEmail eq '${user.email}' and Status ne 'Resolved'`

    const promises: Promise<unknown>[] = [
      spGet<Ticket>('HD_Tickets', ticketFilter),
      spGet<Project>('PM_Projects', "Status eq 'Active'", undefined, 'Title asc'),
      spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}'`, undefined, 'DueDate asc'),
      spGet<AssetType>('IT_Assets'),
      spGet<ProjectIncident>('PM_Incidents', incidentFilter),
    ]
    if (isBoss) {
      promises.push(
        spGet<LeaveRequest>('HD_LeaveRequests',
          `ApproverEmail eq '${user.email}' and Status eq 'Pending'`,
          undefined, 'Created asc')
      )
    }

    Promise.all(promises).then(results => {
      const [tickets, projects, focus, assets, incidents, leaves] = results as [
        Ticket[], Project[], FocusItem[], AssetType[], ProjectIncident[], LeaveRequest[]?
      ]
      setStats({
        openTickets: tickets.length,
        activeProjects: projects.length,
        openIncidents: incidents.length,
      })
      setFocusItems(focus)
      setWarningAssets(assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate)))
      if (leaves) setPendingLeaves(leaves)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  async function unpinFocus(focusId: number) {
    try {
      await spDelete('HD_Focus', focusId)
      setFocusItems(prev => prev.filter(f => f.id !== focusId))
      addToast('success', 'ลบออกจาก Focus Items แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function approveLeave(id: number, approved: boolean) {
    setApprovingId(id)
    try {
      if (approved) {
        await spUpdate('HD_LeaveRequests', id, {
          Status: 'Approved',
          ApproverName: user?.displayName ?? '',
          ApprovedDate: new Date().toISOString(),
        })
      } else {
        const reason = window.prompt('เหตุผลที่ปฏิเสธ (ไม่บังคับ):') ?? ''
        await spUpdate('HD_LeaveRequests', id, {
          Status: 'Rejected',
          ApproverName: user?.displayName ?? '',
          RejectReason: reason,
        })
      }
      setPendingLeaves(prev => prev.filter(l => l.id !== id))
      addToast('success', approved ? 'อนุมัติการลาแล้ว' : 'ปฏิเสธการลาแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setApprovingId(null) }
  }

  const statCards = [
    { label: 'Ticket เปิดอยู่',  value: stats.openTickets,    icon: TicketIcon,    color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/10',   link: '/my-work' },
    { label: 'โครงการ Active',   value: stats.activeProjects, icon: FolderOpen,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/10',  link: '/projects' },
    { label: 'Incident เปิดอยู่', value: stats.openIncidents,  icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/10', link: '/my-work' },
    { label: 'Asset หมดประกัน',  value: warningAssets.length, icon: CheckCircle,   color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10', link: '/assets' },
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
              <Link key={s.label} to={s.link} className="block hover:scale-[1.02] transition-transform">
                <Card className="flex items-center gap-4 h-full">
                  <div className={`p-3 rounded-xl ${s.bg}`}>
                    <s.icon size={20} className={s.color} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                </Card>
              </Link>
            ))
          }
        </div>

        {/* Leave Approval — Boss/Admin only */}
        {pendingLeaves.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-purple-600" />
              <h3 className="text-sm font-semibold">คำขอลาที่รออนุมัติ ({pendingLeaves.length})</h3>
            </div>
            <div className="space-y-2">
              {pendingLeaves.map(l => (
                <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{l.RequestedBy}</p>
                    <p className="text-xs text-gray-500">{l.LeaveType} · {l.LeaveDate}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => approveLeave(l.id, true)}
                      disabled={approvingId === l.id}
                      className="px-2.5 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >อนุมัติ</button>
                    <button
                      onClick={() => approveLeave(l.id, false)}
                      disabled={approvingId === l.id}
                      className="px-2.5 py-1 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >ปฏิเสธ</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Focus Items — full width */}
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
                  <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 group">
                    <span className="text-base flex-shrink-0">{getDueDateEmoji(color) || '📌'}</span>
                    <Link
                      to={f.FocusType === 'Ticket' ? `/tickets/${f.RefID}` : `/projects/${f.RefID}`}
                      className="flex-1 min-w-0"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{f.Title}</p>
                      <p className="text-xs text-gray-400">{f.FocusType} • {formatDate(f.DueDate)}</p>
                    </Link>
                    <Badge className={getStatusColor(f.Status)}>{f.Status}</Badge>
                    <button
                      onClick={() => unpinFocus(f.id)}
                      title="ลบออกจาก Focus"
                      className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 flex-shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
