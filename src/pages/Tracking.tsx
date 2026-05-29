import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { TrackingItem } from '../types/common'
import { getStatusColor } from '../utils/colorUtils'

export default function Tracking() {
  const { user, addToast } = useAppStore()
  const [items, setItems] = useState<TrackingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [ackFilter, setAckFilter] = useState('')

  function load() {
    if (!user) return
    setLoading(true)
    spGet<TrackingItem>('HD_Tracking', `TrackedBy eq '${user.email}'`, undefined, 'Modified desc')
      .then(setItems).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [user])

  async function syncStatus(_item: TrackingItem) {
    try {
      addToast('info', 'Sync สถานะแล้ว')
      load()
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
            <option value="">ประเภททั้งหมด</option>
            <option value="Ticket">Ticket</option>
            <option value="Task">Task</option>
          </select>
          <select value={ackFilter} onChange={e => setAckFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">รับทราบทั้งหมด</option>
            <option value="yes">รับทราบแล้ว</option>
            <option value="no">ยังไม่รับทราบ</option>
          </select>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw size={14} /> Refresh</Button>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
            : filtered.length === 0
              ? <p className="text-center text-sm text-gray-400 py-12">ไม่มีรายการที่ติดตาม</p>
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
                        ? <span className="text-xs text-green-600 flex items-center gap-0.5"><CheckCircle2 size={12} /> รับทราบแล้ว</span>
                        : <span className="text-xs text-orange-500">รอรับทราบ</span>
                      }
                      <button onClick={() => syncStatus(item)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400" title="Sync">
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  </div>
                ))
          }
        </div>
        <p className="text-xs text-gray-400">{filtered.length} รายการ</p>
      </div>
    </div>
  )
}
