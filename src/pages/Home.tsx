import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ticket as TicketIcon, FolderOpen, AlertTriangle, CheckCircle, Pin, X, Calendar as CalendarIcon, CalendarClock, Users } from 'lucide-react'
import { OutlookCalendar } from '../components/calendar/OutlookCalendar'
import { FloatingVideo } from '../components/common/FloatingVideo'
import { youtubeEmbed } from '../utils/youtube'

import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { SkeletonCard } from '../components/common/Skeleton'
import { spGet, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket } from '../types/ticket'
import type { Project, Task } from '../types/project'
import type { FocusItem, LeaveRequest } from '../types/common'
import type { Asset as AssetType } from '../types/asset'
import type { ProjectIncident } from '../types/project'
import { getDueDateEmoji, getDueDateColor, getDueDateBadgeClass, formatDate, isWarrantyExpiringSoon } from '../utils/dateUtils'
import { getStatusColor, getPriorityColor } from '../utils/colorUtils'
import { buildDueRows, isUndated, isOverdue } from '../utils/homeDue'
import { slaCountdown } from '../utils/sla'
import { sendTemplateEmail } from '../services/emailService'
import { GlobalSearch } from '../components/common/GlobalSearch'
import { useT } from '../i18n/useT'

interface Stats {
  openTickets: number
  activeProjects: number
  openIncidents: number
}

export default function Home() {
  const { user, addToast, permSource } = useAppStore()
  const t = useT()
  const homeLabel = t('nav.home')
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
  // โปรเจกต์ที่ถูกเชิญเข้าร่วมทีม (PM_ProjectMembers) — ช่องทางลัดเข้าไปทำงาน
  const [invitedProjects, setInvitedProjects] = useState<Project[]>([])
  // งานที่ถึง/เลยกำหนด (Ticket + Task + Incident ทั้งของฉันและที่ถูกเชิญ)
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [myIncidents, setMyIncidents] = useState<ProjectIncident[]>([])
  const [invitedTickets, setInvitedTickets] = useState<Ticket[]>([])
  // เป็น state ไม่ใช่ ref — ต้องให้ประกอบรายการใหม่เมื่อรายชื่อที่ถูกเชิญโหลดเสร็จ
  const [invitedTicketIds, setInvitedTicketIds] = useState<Set<number>>(new Set())

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
      // งานในโครงการที่มอบหมายให้ฉัน — ใช้คู่กับ ticket เพื่อรวมเป็นรายการ "ถึงกำหนด"
      spGet<Task>('PM_Tasks', `AssignedEmail eq '${user.email}'`, undefined, 'DueDate asc', 500)
        .catch(() => [] as Task[]),
    ]
    if (isBoss) {
      promises.push(
        spGet<LeaveRequest>('HD_LeaveRequests',
          `ApproverEmail eq '${user.email}' and Status eq 'Pending'`,
          undefined, 'Created asc')
      )
    }

    // Ticket ที่ฉันถูกเชิญเข้าไป (ไม่ได้เป็นเจ้าของ) — โหลดก่อน แล้วค่อยประกอบรายการงานค้าง
    spGet<{ id: number; TicketID: number }>('HD_TicketMembers', `AgentEmail eq '${user.email}'`, 'Id,TicketID', undefined, 500)
      .then(rows => {
        const ids = new Set(rows.map(r => r.TicketID).filter(Boolean))
        setInvitedTicketIds(ids)
        if (!ids.size) return
        // ตั๋วที่ถูกเชิญมักไม่ได้ assign ให้เรา จึงไม่อยู่ในชุดที่โหลดไว้ — ต้องดึงเพิ่ม
        const filter = [...ids].slice(0, 40).map(i => `Id eq ${i}`).join(' or ')
        return spGet<Ticket>('HD_Tickets', filter, undefined, 'Created desc', 100)
          .then(extra => setInvitedTickets(extra.filter(t => !['Resolved', 'Closed'].includes(t.Status))))
      }).catch(() => {})

    // โปรเจกต์ที่ฉันถูกเชิญ → ดึงชื่อโปรเจกต์มาแสดงเป็นทางลัด (ลิสต์ยังไม่มี/พลาด → เงียบ)
    spGet<{ id: number; ProjectID: number }>('PM_ProjectMembers', `AgentEmail eq '${user.email}'`, 'Id,ProjectID', undefined, 100)
      .then(rows => {
        const ids = [...new Set(rows.map(r => r.ProjectID).filter(Boolean))].slice(0, 20)
        if (!ids.length) { setInvitedProjects([]); return }
        const filter = ids.map(i => `Id eq ${i}`).join(' or ')
        return spGet<Project>('PM_Projects', filter, 'Id,Title,Company,Status', 'Title asc', 50)
          .then(setInvitedProjects)
      }).catch(() => {})

    Promise.all(promises).then(results => {
      const [tickets, projects, focus, assets, incidents, tasks, leaves] = results as [
        Ticket[], Project[], FocusItem[], AssetType[], ProjectIncident[], Task[], LeaveRequest[]?
      ]
      setStats({
        openTickets: tickets.length,
        activeProjects: projects.length,
        openIncidents: incidents.length,
      })
      setMyTickets(tickets)
      setFocusItems((focus ?? []).filter(f => f.PinTarget !== 'Navigator'))
      setWarningAssets(assets.filter(a => isWarrantyExpiringSoon(a.WarrantyDate || a.ExpiryDate)))
      setMyTasks(tasks ?? [])
      setMyIncidents(incidents ?? [])
      if (leaves) setPendingLeaves(leaves)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user])

  // ประกอบใหม่ทุกครั้งที่ข้อมูลชุดใดชุดหนึ่งมาถึง — ตั๋วที่ถูกเชิญโหลดแยกและมาช้ากว่า
  const dueRows = useMemo(() => buildDueRows(
    [...myTickets, ...invitedTickets] as never,
    myTasks as never,
    myIncidents as never,
    { myEmail: user?.email, invitedTicketIds },
  ), [myTickets, invitedTickets, myTasks, myIncidents, invitedTicketIds, user?.email])

  const overdueCount = dueRows.filter(r => r.days !== null && r.days < 0).length
  const todayCount   = dueRows.filter(r => r.days !== null && r.days >= 0 && r.days < 1).length
  const soonCount    = dueRows.filter(r => r.days !== null && r.days >= 1).length
  const undatedCount = dueRows.filter(isUndated).length

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

  // กล่อง "งานที่ถึงกำหนด / เลยกำหนด" — วางในแถวบนคู่กับกล่องสรุป (ฝั่งละครึ่ง)
  const DUE_PANEL = (
    <Card>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <CalendarClock size={16} className="text-primary-600" />
        <h3 className="text-sm font-semibold">{t('home.dueTitle')}</h3>
        <span className="text-xs text-gray-400">{t('home.dueWindow')}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {overdueCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {t('home.dueOverdue')} {overdueCount}
            </span>
          )}
          {todayCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {t('home.dueToday')} {todayCount}
            </span>
          )}
          {soonCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              {t('home.dueSoon')} {soonCount}
            </span>
          )}
          {undatedCount > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              title={t('home.dueNoDateHint')}>
              {t('home.dueNoDate')} {undatedCount}
            </span>
          )}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-6">{t('common.loading')}</p>
      ) : dueRows.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CheckCircle size={26} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t('home.dueEmpty')}</p>
        </div>
      ) : (
        <div className="max-h-[25vh] min-h-[8rem] overflow-y-auto pr-1 space-y-1.5">
          {dueRows.map((r, i) => {
            const undated = isUndated(r)
            const color = undated ? 'normal' : getDueDateColor(r.due ?? undefined)
            const late = isOverdue(r)
            // ขีดคั่นตรงจุดที่เริ่มเป็นงานไม่มีกำหนด — ไม่ต้องอ่านทีละแถวว่าเปลี่ยนกลุ่มตรงไหน
            const firstUndated = undated && (i === 0 || !isUndated(dueRows[i - 1]))
            return (
              <div key={r.key}>
                {firstUndated && (
                  <p className="text-[10px] uppercase tracking-wide text-gray-400 pt-2 pb-1 border-t border-gray-100 dark:border-gray-800 mt-1">
                    {t('home.dueNoDate')} ({undatedCount})
                  </p>
                )}
                <Link to={r.link}
                  className={`flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    late ? 'border-l-4 border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-l-4 border-transparent'}`}>
                  <span className="text-sm flex-shrink-0">
                    {r.type === 'Incident' ? '🚨' : undated ? '⚪' : getDueDateEmoji(color) || '🔵'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 flex-shrink-0 w-14 text-center">
                    {r.type}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-gray-900 dark:text-gray-100 truncate">
                      {r.title}
                      {/* ถูกเชิญ = ไม่ใช่งานของเราโดยตรง แต่เคยหลุดหายไปเลย จึงต้องบอกให้ชัด */}
                      {r.invited && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 align-middle">
                          {t('home.dueInvited')}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {undated ? t('home.dueNoDateHint') : formatDate(r.due ?? undefined)}
                    </span>
                  </span>
                  {r.status && <Badge className={`${getStatusColor(r.status)} hidden xl:inline-flex`}>{r.status}</Badge>}
                  {!undated && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${getDueDateBadgeClass(color)}`}>
                      {r.type === 'Incident'
                        ? slaCountdown((r.days as number) * 24)
                        : (r.days as number) < 0 ? `${t('home.dueLateBy')} ${Math.abs(Math.round(r.days as number))} ${t('home.dueDays')}`
                        : (r.days as number) < 1 ? t('home.dueToday')
                        : `${t('home.dueIn')} ${Math.round(r.days as number)} ${t('home.dueDays')}`}
                    </span>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )

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
        {/* ยังไม่ถูกกำหนดสิทธิ์เข้าถึงหน้า — แจ้งให้ติดต่อ Admin (กันงงว่าทำไมเมนูว่าง) */}
        {permSource === 'none' && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium">บัญชีของคุณยังไม่ได้รับสิทธิ์เข้าถึงเมนูใดๆ</p>
              <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">กรุณาติดต่อผู้ดูแลระบบเพื่อขอเปิดสิทธิ์การใช้งาน</p>
            </div>
          </div>
        )}

        {/* ── แถวบน: สรุปภาพรวม (ซ้าย) + งานที่ถึงกำหนด (ขวา) — ฝั่งละ 1/4 ของหน้า ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ซ้ายบน — ค้นหา + เตือนประกัน + ตัวเลขรวม + โปรเจกต์ที่ร่วมทีม */}
          <div className="space-y-3">
            <GlobalSearch />

            {/* Warranty Alert */}
            {warningAssets.length > 0 && (
              <div className="flex items-center gap-2.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="text-orange-600 flex-shrink-0" />
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  {warningAssets.length} {t('home.warranty')}
                  <Link to="/assets" className="ml-1 underline font-medium">{t('home.viewList')}</Link>
                </p>
              </div>
            )}

            {/* Stats — 2×2 ในครึ่งซ้าย (เดิมเรียง 4 ใบเต็มความกว้าง) */}
            <div className="grid grid-cols-2 gap-3">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : statCards.map(s => (
                  <Link key={s.label} to={s.link} className="block hover:scale-[1.02] transition-transform">
                    <Card className="flex items-center gap-3 h-full !p-3">
                      <div className={`p-2 rounded-lg ${s.bg} flex-shrink-0`}>
                        <s.icon size={17} className={s.color} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{s.value}</p>
                        <p className="text-[11px] text-gray-500 truncate">{s.label}</p>
                      </div>
                    </Card>
                  </Link>
                ))
              }
            </div>

            {/* โปรเจกต์ที่ฉันร่วมทีม (ถูก Invite) */}
            {invitedProjects.length > 0 && (
              <Card className="!p-3">
                <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Users size={14} className="text-primary-600" /> {t('home.invitedProjects')}
                </h3>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {invitedProjects.map(p => (
                    <Link key={p.id} to={`/projects/${p.id}`}
                      className="flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors">
                      <span className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {p.Title.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[11px] font-medium text-primary-700 dark:text-primary-300">{p.Title}</span>
                      {p.Status && <Badge className={`${getStatusColor(p.Status)} !text-[10px] !px-1.5 !py-0`}>{p.Status}</Badge>}
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {DUE_PANEL}
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
                    state={{ from: '/', fromLabel: homeLabel }}
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
