import { useEffect, useMemo, useState } from 'react'
import { Activity, Search, RefreshCw, Download, ChevronDown, Plus, Pencil, Trash2, Paperclip, LogIn } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { spGet } from '../services/sharepoint'
import { ACTIVITY_LIST, type ActivityRow } from '../services/activityLog'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n/useT'
import { timeAgo } from '../utils/dateUtils'

const ACTION_META: Record<string, { label: string; icon: typeof Plus; cls: string }> = {
  create: { label: 'สร้าง',    icon: Plus,      cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  update: { label: 'แก้ไข',    icon: Pencil,    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  delete: { label: 'ลบ',       icon: Trash2,    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  attach: { label: 'แนบไฟล์',  icon: Paperclip, cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  detach: { label: 'ลบไฟล์',   icon: Paperclip, cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  login:  { label: 'เข้าระบบ', icon: LogIn,     cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
}

const PAGE_SIZE = 100

export default function ActivityLog() {
  const { addToast } = useAppStore()
  const tr = useT()
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [listFilter, setListFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [days, setDays] = useState('7')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [openId, setOpenId] = useState<number | null>(null)

  function load() {
    setLoading(true)
    // กรองช่วงเวลาที่ฝั่ง SharePoint เพื่อไม่ดึงทั้งลิสต์ (log โตเร็วมาก)
    const since = new Date(Date.now() - Number(days) * 86400_000).toISOString()
    const filter = days === 'all' ? undefined : `Created ge datetime'${since}'`
    spGet<ActivityRow>(ACTIVITY_LIST, filter,
      'Id,Title,UserEmail,UserName,Action,ListName,ItemID,ItemTitle,Details,PagePath,Created',
      'Created desc', 4000)
      .then(setRows)
      .catch(() => addToast('error', `โหลดไม่ได้ — ตรวจว่าสร้างลิสต์ ${ACTIVITY_LIST} แล้วหรือยัง`))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(); setLimit(PAGE_SIZE) }, [days])  // eslint-disable-line react-hooks/exhaustive-deps

  const lists = useMemo(() => [...new Set(rows.map(r => r.ListName).filter(Boolean))].sort() as string[], [rows])
  const users = useMemo(() => [...new Set(rows.map(r => r.UserName || r.UserEmail).filter(Boolean))].sort() as string[], [rows])

  const filtered = useMemo(() => rows.filter(r =>
    (!actionFilter || r.Action === actionFilter) &&
    (!listFilter || r.ListName === listFilter) &&
    (!userFilter || (r.UserName || r.UserEmail) === userFilter) &&
    (!search || [r.Title, r.ItemTitle, r.Details, r.UserName, r.UserEmail, r.ListName]
      .some(s => (s ?? '').toLowerCase().includes(search.toLowerCase())))
  ), [rows, actionFilter, listFilter, userFilter, search])

  async function exportExcel() {
    if (filtered.length === 0) { addToast('info', 'ไม่มีรายการให้ส่งออก'); return }
    try {
      const XLSX = await import('xlsx')
      const data = filtered.map(r => ({
        'เวลา': r.Created ? new Date(r.Created).toLocaleString('th-TH') : '',
        'ผู้ใช้': r.UserName || '',
        'อีเมล': r.UserEmail || '',
        'การกระทำ': ACTION_META[r.Action ?? '']?.label ?? r.Action ?? '',
        'ลิสต์': r.ListName || '',
        'ItemID': r.ItemID ?? '',
        'ชื่อรายการ': r.ItemTitle || '',
        'หน้า': r.PagePath || '',
        'รายละเอียด': (r.Details || '').replace(/\s+/g, ' ').slice(0, 1000),
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 26 }, { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 34 }, { wch: 20 }, { wch: 60 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'ActivityLog')
      XLSX.writeFile(wb, `activity-log-${new Date().toISOString().slice(0, 10)}.xlsx`)
      addToast('success', `ส่งออกแล้ว ${filtered.length} รายการ`)
    } catch { addToast('error', tr('common.error')) }
  }

  const selCx = 'px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900'

  return (
    <div>
      <Header title="Activity Log" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ผู้ใช้ / รายการ / รายละเอียด"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          <select value={days} onChange={e => setDays(e.target.value)} className={selCx}>
            <option value="1">24 ชั่วโมง</option>
            <option value="7">7 วัน</option>
            <option value="30">30 วัน</option>
            <option value="90">90 วัน</option>
            <option value="all">ทั้งหมด</option>
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className={selCx}>
            <option value="">ทุกการกระทำ</option>
            {Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={listFilter} onChange={e => setListFilter(e.target.value)} className={selCx}>
            <option value="">ทุกลิสต์</option>
            {lists.map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className={selCx}>
            <option value="">ทุกคน</option>
            {users.map(u => <option key={u}>{u}</option>)}
          </select>
          <Button size="sm" variant="secondary" onClick={load}><RefreshCw size={14} /> โหลดใหม่</Button>
          <Button size="sm" variant="secondary" onClick={exportExcel}><Download size={14} /> Excel ({filtered.length})</Button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-10 text-center">{tr('comp.loading')}</p>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-14">
            <Activity size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">ไม่พบกิจกรรมในช่วงเวลาที่เลือก</p>
          </Card>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              {filtered.slice(0, limit).map(r => {
                const meta = ACTION_META[r.Action ?? ''] ?? { label: r.Action ?? '?', icon: Activity, cls: 'bg-gray-100 text-gray-600' }
                const open = openId === r.id
                return (
                  <div key={r.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <button onClick={() => setOpenId(open ? null : r.id)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <span className={`flex-shrink-0 mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.cls}`}>
                        <meta.icon size={10} /> {meta.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 dark:text-gray-100 truncate">
                          <span className="font-medium">{r.UserName || r.UserEmail || '—'}</span>
                          {r.ItemTitle ? <> · {r.ItemTitle}</> : null}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {r.ListName}{r.ItemID ? ` #${r.ItemID}` : ''} · {r.Created ? timeAgo(r.Created) : ''}
                          {r.Created ? ` · ${new Date(r.Created).toLocaleString('th-TH')}` : ''}
                        </p>
                      </div>
                      <ChevronDown size={14} className={`flex-shrink-0 mt-1 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="px-3 pb-3 pl-16 space-y-1">
                        {r.PagePath && <p className="text-[11px] text-gray-400">หน้า: {r.PagePath}</p>}
                        {r.UserEmail && <p className="text-[11px] text-gray-400">อีเมล: {r.UserEmail}</p>}
                        {r.Details && (
                          <pre className="text-[11px] bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                            {r.Details}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {filtered.length > limit && (
              <div className="text-center">
                <Button size="sm" variant="secondary" onClick={() => setLimit(l => l + PAGE_SIZE)}>
                  โหลดเพิ่ม ({filtered.length - limit} รายการ)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
