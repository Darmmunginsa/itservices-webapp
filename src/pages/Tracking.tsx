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
import { getStatusColor } from '../utils/colorUtils'
import { useT } from '../i18n/useT'

export default function Tracking() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [items, setItems] = useState<TrackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [ackFilter, setAckFilter] = useState('')

  function load() {
    if (!user) return
    setLoading(true)
    // TrackedEmail = email field; TrackedBy = display name — use TrackedEmail for filter
    spGet<TrackingItem>('HD_Tracking', `TrackedEmail eq '${user.email}'`, undefined, 'Modified desc')
      .then(setItems).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [user])

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

  const filtered = items.filter(i =>
    (!typeFilter || i.TrackingType === typeFilter) &&
    (!ackFilter || (ackFilter === 'yes' ? i.IsAcknowledged : !i.IsAcknowledged))
  )

  return (
    <div>
      <Header title="My Tracking" />
      <div className="p-4 md:p-6 space-y-4">
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
      </div>
    </div>
  )
}
