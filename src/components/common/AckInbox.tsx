import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Check, AlertTriangle, Ticket as TicketIcon, ListChecks } from 'lucide-react'
import { Card } from './Card'
import { Badge } from './Badge'
import { spUpdate } from '../../services/sharepoint'
import { notifyAcknowledged, ackFailMessage } from '../../services/ackNotify'
import { useAppStore } from '../../store/useAppStore'
import { ackPayload, type AckRow } from '../../utils/ackInbox'
import { getSeverityColor } from '../../utils/colorUtils'
import { formatDate, timeAgo } from '../../utils/dateUtils'

interface Props {
  rows: AckRow[]
  loading?: boolean
  /** เรียกหลังกดรับสำเร็จ เพื่อให้หน้าที่ใช้ไปโหลดรายการใหม่ */
  onAcked: (row: AckRow) => void
}

const ICON = {
  Ticket: <TicketIcon size={14} className="text-blue-500" />,
  Incident: <AlertTriangle size={14} className="text-red-500" />,
  Task: <ListChecks size={14} className="text-emerald-500" />,
}

/**
 * กล่องรอรับงาน
 *
 * งานที่คนอื่นมอบหมายมาจะมาจ่อที่นี่ก่อน ยังไม่นับเป็นงานของเราจนกดรับ
 * เพราะ "ถูกมอบหมาย" กับ "รู้แล้วและกำลังทำ" ไม่ใช่เรื่องเดียวกัน
 * และคนที่มอบหมายมาก็ควรได้รู้ว่าปลายทางเห็นแล้ว
 */
export function AckInbox({ rows, loading, onAcked }: Props) {
  const { user, addToast } = useAppStore()
  const [busy, setBusy] = useState<string | null>(null)

  async function accept(row: AckRow) {
    if (!user) return
    setBusy(row.key)
    try {
      await spUpdate(row.listName, row.id, ackPayload(user.displayName))
      onAcked(row)
      addToast('success', `รับงาน "${row.title}" แล้ว`)

      // แจ้งคนที่มอบหมายมา — ถ้าไม่บอก เขาจะไม่รู้เลยว่างานถึงมือแล้วหรือยัง
      const res = await notifyAcknowledged({
        kind: row.kind, id: row.id, title: row.title, link: row.link,
        fromEmail: row.fromEmail, fromName: row.from,
        due: row.due, tag: row.tag, status: row.status,
        agentName: user.displayName, agentEmail: user.email,
      })
      const msg = res.sent ? null : ackFailMessage(res.reason)
      if (msg) addToast('error', msg)
    } catch {
      addToast('error', 'รับงานไม่สำเร็จ')
    } finally { setBusy(null) }
  }

  return (
    <Card className="lg:sticky lg:top-4">
      <div className="flex items-center gap-2 mb-3">
        <Inbox size={16} className="text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">รอรับงาน</h3>
        {rows.length > 0 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary-600 text-white font-semibold">
            {rows.length}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">กำลังโหลด...</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Check size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">ไม่มีงานรอรับ</p>
          <p className="text-xs mt-0.5">งานที่คนอื่นมอบหมายมาจะมาจ่อที่นี่ก่อน</p>
        </div>
      ) : (
        <div className="space-y-2 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto pr-0.5">
          {rows.map(r => (
            <div key={r.key}
              className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">{ICON[r.kind]}</span>
                <div className="min-w-0 flex-1">
                  <Link to={r.link} state={{ from: '/my-work' }}
                    className="block text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 leading-snug">
                    {r.title}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {r.from ? `จาก ${r.from}` : 'ไม่ทราบผู้มอบหมาย'}
                    {r.created && ` · ${timeAgo(r.created)}`}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{r.kind}</span>
                    {r.tag && <Badge className={`${getSeverityColor(r.tag)} !text-[10px] !px-1.5 !py-0`}>{r.tag}</Badge>}
                    {r.due && <span className="text-[10px] text-gray-400">กำหนด {formatDate(r.due)}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => accept(r)} disabled={busy === r.key}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
                  <Check size={13} /> {busy === r.key ? '...' : 'รับงาน'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
