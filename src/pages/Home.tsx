import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket as TicketIcon, FolderOpen, AlertTriangle, CheckCircle, Pin, X, Calendar as CalendarIcon } from 'lucide-react'
import { OutlookCalendar } from '../components/calendar/OutlookCalendar'
import { FloatingVideo } from '../components/common/FloatingVideo'

// Convert any YouTube URL/ID → embed URL
function youtubeEmbed(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  let id = ''
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
  if (m) id = m[1]
  else if (/^[A-Za-z0-9_-]{11}$/.test(s)) id = s
  return id ? `https://www.youtube.com/embed/${id}` : ''
}
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
import { getStatusColor, getPriorityColor } from '../utils/colorUtils'
import { sendTemplateEmail } from '../services/emailService'
import { GlobalSearch } from '../components/common/GlobalSearch'
import { useT } from '../i18n/useT'

interface Stats {
  openTickets: number
  activeProjects: number
  openIncidents: number
}

export default function Home() {
  const { user, addToast } = useAppStore()
  const t = useT()
  const [stats, setStats] = useState<Stats>({ openTickets: 0, activeProjects: 0, openIncidents: 0 })
  const [focusItems, setFocusItems] = useState<FocusItem[]>([])
  const [warningAssets, setWarningAssets] = useState<AssetType[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const dragId = useRef<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [videoEmbed, setVideoEmbed] = useState('')

  // Load Home video URL from HD_Options (Category = HomeVideo)
  useEffect(() => {
    spGet<{ Title: string; Category: string }>('HD_Options', "Category eq 'HomeVideo'", 'Title,Category')
      .then(rows => { if (rows[0]?.Title) setVideoEmbed(youtubeEmbed(rows[0].Title)) })
      .catch(() => {})
  }, [])

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
      spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}'`, 'Id,Title,RefID,FocusType,FocusedBy,FocusedEmail,DueDate,Status,SortOrder,PinTarget', 'SortOrder asc', 200),
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
      setMyTickets(tickets)
      setFocusItems((focus ?? []).filter(f => f.PinTarget !== 'Navigator'))
      setWarningAssets(assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate || a.ExpiryDate)))
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

  function onDragStart(id: number) { dragId.current = id }

  function onDragOver(e: React.DragEvent, overId: number) {
    e.preventDefault()
    if (dragId.current === null || dragId.current === overId) return
    setDragOverId(overId)
  }

  function onDrop(overId: number) {
    if (dragId.current === null || dragId.current === overId) { setDragOverId(null); return }
    const from = focusItems.findIndex(f => f.id === dragId.current)
    const to   = focusItems.findIndex(f => f.id === overId)
    if (from === -1 || to === -1) { setDragOverId(null); return }
    const reordered = [...focusItems]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    // assign new SortOrder (10, 20, 30, ...) แล้วบันทึก
    const updated = reordered.map((f, i) => ({ ...f, SortOrder: (i + 1) * 10 }))
    setFocusItems(updated)
    setDragOverId(null)
    dragId.current = null
    // บันทึกลง SharePoint (fire-and-forget)
    updated.forEach(f => spUpdate('HD_Focus', f.id, { SortOrder: f.SortOrder }).catch(() => {}))
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
      const leaveItem = pendingLeaves.find(l => l.id === id)
      setPendingLeaves(prev => prev.filter(l => l.id !== id))
      addToast('success', approved ? 'อนุมัติการลาแล้ว' : 'ปฏิเสธการลาแล้ว')
      // ส่ง email แจ้งผู้ขอลา
      if (leaveItem?.RequestedEmail) {
        sendTemplateEmail('leave_decision', {
          requester_name:  leaveItem.RequestedBy ?? '',
          leave_type:      leaveItem.LeaveType ?? '',
          leave_date:      leaveItem.LeaveDate ?? '',
          leave_status:    approved ? 'อนุมัติ' : 'ไม่อนุมัติ',
          approver_name:   user?.displayName ?? '',
          link:            window.location.origin,
        }, [leaveItem.RequestedEmail])
      }
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setApprovingId(null) }
  }

  const statCards = [
    { label: t('home.stat.openTickets'),  value: stats.openTickets,    icon: TicketIcon,    color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/10',   link: '/my-work' },
    { label: t('home.stat.activeProjects'),   value: stats.activeProjects, icon: FolderOpen,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/10',  link: '/projects' },
    { label: t('home.stat.openIncidents'), value: stats.openIncidents,  icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/10', link: '/my-work' },
    { label: t('home.stat.expiringAssets'),  value: warningAssets.length, icon: CheckCircle,   color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/10', link: '/assets' },
  ]

  return (
    <div>
      <Header title={`${t('home.greeting')}, ${user?.displayName ?? '...'}`} />

      <div className="p-4 md:p-6 space-y-6">
        {/* Global Search */}
        <GlobalSearch />

        {/* Warranty Alert */}
        {warningAssets.length > 0 && (
          <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3">
            <AlertTriangle size={16} className="text-orange-600 flex-shrink-0" />
            <p className="text-sm text-orange-700 dark:text-orange-400">
              {warningAssets.length} {t('home.warranty')}
              <Link to="/assets" className="ml-1 underline font-medium">{t('home.viewList')}</Link>
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
                    >{t('common.approve')}</button>
                    <button
                      onClick={() => approveLeave(l.id, false)}
                      disabled={approvingId === l.id}
                      className="px-2.5 py-1 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >{t('common.reject')}</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* My Tickets — End User only */}
        {user?.role === 'EndUser' && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TicketIcon size={16} className="text-primary-600" />
                <h3 className="text-sm font-semibold">{t('home.myTickets')}</h3>
              </div>
              <Link to="/my-work" className="text-xs text-primary-600 hover:underline">{t('common.viewAll')} →</Link>
            </div>
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-4">{t('common.loading')}</p>
            ) : myTickets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t('home.noOpenTickets')}</p>
            ) : (
              <div className="space-y-2">
                {myTickets.slice(0, 5).map(t => (
                  <Link key={t.id} to={`/tickets/${t.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <span className="text-base flex-shrink-0">{getDueDateEmoji(getDueDateColor(t.DueDate, false))}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{t.Title}</p>
                      <p className="text-xs text-gray-400">{t.TicketNumber} · {formatDate(t.Created)}</p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Badge className={getPriorityColor(t.Priority)}>{t.Priority}</Badge>
                      <Badge className={getStatusColor(t.Status)}>{t.Status}</Badge>
                    </div>
                  </Link>
                ))}
                {myTickets.length > 5 && (
                  <p className="text-xs text-center text-gray-400 pt-1">และอีก {myTickets.length - 5} รายการ</p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Focus Items (half) + Calendar (half, pinned) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Pin size={16} className="text-primary-600" />
              <h3 className="text-sm font-semibold">Focus Items</h3>
            </div>
            {focusItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">{t('home.noPinned')}</p>
            ) : (
              <div className="space-y-2">
                {focusItems.map(f => {
                  const color = getDueDateColor(f.DueDate)
                  const isDragOver = dragOverId === f.id
                  return (
                    <div key={f.id}
                      draggable
                      onDragStart={() => onDragStart(f.id)}
                      onDragOver={e => onDragOver(e, f.id)}
                      onDrop={() => onDrop(f.id)}
                      onDragEnd={() => { setDragOverId(null); dragId.current = null }}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all group cursor-grab active:cursor-grabbing select-none
                        ${isDragOver
                          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 scale-[1.01] shadow-md'
                          : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <span className="text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-grab" title="ลากเพื่อเรียงลำดับ">⠿</span>
                      <span className="text-base flex-shrink-0">{getDueDateEmoji(color) || '📌'}</span>
                      <Link
                        to={f.FocusType === 'Ticket' ? `/tickets/${f.RefID}` : f.FocusType === 'Note' ? `/tools?note=${f.RefID}` : `/projects/${f.RefID}`}
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

          {/* Pinned calendar — visible on Home */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon size={16} className="text-primary-600" />
              <h3 className="text-sm font-semibold">{t('common.calendar')}</h3>
            </div>
            <OutlookCalendar />
          </Card>
        </div>

      </div>

      {/* Floating draggable + resizable video */}
      {videoEmbed && <FloatingVideo embed={videoEmbed} storageKey={`homeVideoBox_${user?.email ?? ''}`} />}
    </div>
  )
}
