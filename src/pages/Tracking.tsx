import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, CheckCircle2, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { TrackingItem } from '../types/common'
import type { Ticket } from '../types/ticket'
import type { Project, ProjectIncident, Task } from '../types/project'
import { getStatusColor } from '../utils/colorUtils'
import { formatDate } from '../utils/dateUtils'
import { useT } from '../i18n/useT'
import {
  ticketRows, incidentRows, taskRows, submittedByMe, submittedSummary, progressLabel, workLink,
  type WorkKind, type WorkRow,
} from '../utils/dashboardWork'

const TONE: Record<ReturnType<typeof progressLabel>['tone'], string> = {
  gray:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  green:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

export default function Tracking() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [items, setItems] = useState<TrackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [ackFilter, setAckFilter] = useState('')

  // งานที่ฉันแจ้ง/มอบหมายไป — สร้างจากข้อมูลจริง ไม่ต้องกด Track ก่อน
  // เดิมถ้าไม่ Track ก็ไม่เห็นความคืบหน้าของงานที่สั่งทีมไปเลย ต้องไปเปิดทีละใบ
  const [subRows, setSubRows] = useState<WorkRow[]>([])
  const [subLoading, setSubLoading] = useState(true)
  const [subKind, setSubKind] = useState<WorkKind | ''>('')
  const [subHideDone, setSubHideDone] = useState(true)

  function loadSubmitted() {
    if (!user) return
    // ไม่ตั้ง loading ตรงนี้ — ค่าเริ่มต้นเป็น true อยู่แล้ว ส่วนตอน Refresh ให้แถวเดิมค้างไว้
    // ดีกว่ากระพริบเป็นโครงว่างทั้งที่ข้อมูลเก่ายังใช้ได้
    // กรองฝั่งเบราว์เซอร์ด้วยอีเมลผู้สร้าง (Author) — SharePoint กรอง Author/EMail ตรง ๆ ไม่ได้
    // ดึง 500 แถวล่าสุดต่อลิสต์ พอสำหรับงานที่ยังเดินอยู่
    Promise.allSettled([
      spGet<Ticket>('HD_Tickets', undefined, '*,Author/Title,Author/EMail', 'Modified desc', 500, 'Author'),
      spGet<ProjectIncident>('PM_Incidents', undefined, '*,Author/Title,Author/EMail', 'Modified desc', 500, 'Author'),
      spGet<Task>('PM_Tasks', undefined, '*,Author/Title,Author/EMail', 'Modified desc', 500, 'Author'),
      spGet<Project>('PM_Projects', undefined, 'Id,Title', 'Title asc', 500),
    ]).then(([t, i, k, p]) => {
      const pick = <T,>(r: PromiseSettledResult<T[]>): T[] => (r.status === 'fulfilled' ? r.value : [])
      const names = pick(p).map(x => ({ id: x.id, Title: x.Title }))
      setSubRows([
        ...ticketRows(pick(t), names),
        ...incidentRows(pick(i), names),
        ...taskRows(pick(k), names),
      ])
    }).finally(() => setSubLoading(false))
  }

  function load() {
    if (!user) return
    setLoading(true)
    // TrackedEmail = email field; TrackedBy = display name — use TrackedEmail for filter
    spGet<TrackingItem>('HD_Tracking', `TrackedEmail eq '${user.email}'`, undefined, 'Modified desc')
      .then(setItems).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(); loadSubmitted() }, [user])

  async function syncStatus(item: TrackingItem) {
    try {
      let latestStatus = item.Status
      if (item.TrackingType === 'Ticket') {
        const rows = await spGet<{ Status: string }>('HD_Tickets', `Id eq ${item.RefID}`, 'Id,Status')
        if (rows[0]) latestStatus = rows[0].Status
      } else {
        const rows = await spGet<{ IsCompleted: boolean }>('PM_Tasks', `Id eq ${item.RefID}`, 'Id,IsCompleted')
        if (rows[0]) latestStatus = rows[0].IsCompleted ? 'Completed' : 'Active'
      }
      if (latestStatus !== item.Status) {
        await spUpdate('HD_Tracking', item.id, { Status: latestStatus })
      }
      addToast('success', `Sync แล้ว: ${latestStatus}`)
      load()
    } catch { addToast('error', 'Sync ไม่สำเร็จ') }
  }

  async function acknowledge(item: TrackingItem) {
    try {
      await spUpdate('HD_Tracking', item.id, { IsAcknowledged: true })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, IsAcknowledged: true } : i))
      addToast('success', 'รับทราบแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function removeTracking(item: TrackingItem) {
    if (!window.confirm('หยุดติดตามรายการนี้?')) return
    try {
      await spDelete('HD_Tracking', item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      addToast('success', 'ลบออกจาก Tracking แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  const submitted = submittedByMe(subRows, user?.email ?? '', { hideDone: subHideDone, kind: subKind })
  const subAll = submittedByMe(subRows, user?.email ?? '')
  const summary = submittedSummary(subAll)

  const filtered = items.filter(i =>
    (!typeFilter || i.TrackingType === typeFilter) &&
    (!ackFilter || (ackFilter === 'yes' ? i.IsAcknowledged : !i.IsAcknowledged))
  )

  return (
    <div>
      <Header title="My Tracking" />
      <div className="p-4 md:p-6 space-y-6">

        {/* ── งานที่ฉันแจ้ง / มอบหมายไป ── */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">งานที่ฉันแจ้ง / มอบหมายไป</h2>
            <span className="text-xs text-gray-400">ตามได้เลย ไม่ต้องกด Track</span>
            {/* ตัวเลขบอกว่าค้างที่ขั้นไหน — สิ่งที่คนสั่งงานอยากรู้ก่อนอ่านรายการ */}
            <div className="ml-auto flex flex-wrap gap-1.5 text-[11px]">
              {summary.unassigned > 0 && <Badge className={TONE.orange}>ยังไม่มีผู้รับผิดชอบ {summary.unassigned}</Badge>}
              {summary.waitingAck > 0 && <Badge className={TONE.amber}>รอรับงาน {summary.waitingAck}</Badge>}
              <Badge className={TONE.blue}>กำลังทำ {summary.inProgress}</Badge>
              <Badge className={TONE.green}>เสร็จแล้ว {summary.done}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={subKind} onChange={e => setSubKind(e.target.value as WorkKind | '')}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
              <option value="">ทุกประเภท</option>
              <option value="ticket">Ticket</option>
              <option value="incident">Incident</option>
              <option value="task">Task</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={subHideDone} onChange={e => setSubHideDone(e.target.checked)} className="rounded" />
              ซ่อนที่เสร็จแล้ว
            </label>
            <Button size="sm" variant="outline" onClick={loadSubmitted}><RefreshCw size={14} /> Refresh</Button>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {subLoading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              : submitted.length === 0
                ? <p className="text-center text-sm text-gray-400 py-10">
                    {subAll.length === 0 ? 'ยังไม่มีงานที่คุณแจ้งหรือมอบหมายให้คนอื่น' : 'ไม่มีรายการตามตัวกรองนี้'}
                  </p>
                : submitted.map(r => {
                    const p = progressLabel(r)
                    return (
                      <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm">
                        <div className="flex-1 min-w-0">
                          <Link to={workLink(r)} state={{ from: '/tracking' }}
                            className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate block">
                            {r.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                            <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 capitalize">{r.kind}</Badge>
                            <span className="font-mono">{r.ref}</span>
                            {r.projectName && <span>· {r.projectName}</span>}
                            <span>· {r.assignedName || r.assignedEmail
                              ? `ผู้รับผิดชอบ: ${r.assignedName || r.assignedEmail}`
                              : <span className="text-orange-500">ยังไม่ assign</span>}</span>
                            {r.due && <span>· กำหนด {formatDate(r.due)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={getStatusColor(r.status)}>{r.status}</Badge>
                          <Badge className={TONE[p.tone]}>{p.text}</Badge>
                          {r.modified && <span className="text-[11px] text-gray-400 hidden sm:inline">{formatDate(r.modified)}</span>}
                        </div>
                      </div>
                    )
                  })
            }
          </div>
          <p className="text-xs text-gray-400">
            แสดง {submitted.length} จาก {subAll.length} รายการ · งานที่มอบหมายให้ตัวเองไม่นับ (อยู่ในหน้างานของฉันแล้ว)
          </p>
        </section>

        {/* ── รายการที่กด Track เอง ── */}
        <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">รายการที่ติดตามเอง</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">{tr('tracking.allTypes')}</option>
            <option value="Ticket">Ticket</option>
            <option value="Task">Task</option>
          </select>
          <select value={ackFilter} onChange={e => setAckFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">{tr('tracking.allAck')}</option>
            <option value="yes">{tr('tracking.acked')}</option>
            <option value="no">{tr('tracking.notAcked')}</option>
          </select>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw size={14} /> Refresh</Button>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">{tr('tracking.empty')}</p>
              : filtered.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={item.TrackingType === 'Ticket' ? `/tickets/${item.RefID}` : `/projects`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 truncate block"
                      >
                        {item.Title}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{item.TrackingType}</Badge>
                        <span>Assigned: {item.AssignedTo}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={getStatusColor(item.Status)}>{item.Status}</Badge>
                      {item.IsAcknowledged
                        ? <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 size={12} /> {tr('tracking.acked')}</span>
                        : (
                          <button
                            onClick={() => acknowledge(item)}
                            className="text-xs text-orange-500 hover:text-orange-700 underline"
                          >
                            {tr('tracking.ack')}
                          </button>
                        )
                      }
                      <button onClick={() => syncStatus(item)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400" title={tr('tracking.syncStatus')}>
                        <RefreshCw size={13} />
                      </button>
                      <button onClick={() => removeTracking(item)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400" title={tr('tracking.stopTracking')}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
          }
        </div>
        <p className="text-xs text-gray-400">{filtered.length} {tr('assets.items')}</p>
        </section>
      </div>
    </div>
  )
}
