import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert, Search, RefreshCw, Download, Plus, Trash2, ShieldCheck, Paperclip } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { DataTable, type Column } from '../components/common/DataTable'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n/useT'
import { formatDate } from '../utils/dateUtils'

// ── รายงาน phishing ที่ส่งมาจากแอดอิน PhishGuard ใน Outlook ──
// อีกฝั่งเขียนเข้า HD_PhishingReports ; whitelist โดเมนอยู่ใน HD_Options (Category='SafeDomain')
interface PhishReport {
  id: number
  Title: string
  SenderName?: string
  SenderEmail?: string
  SenderDomain?: string
  RiskScore?: number
  RiskLevel?: string
  Findings?: string
  LinkCount?: number
  SuspiciousLinks?: string
  ReportedBy?: string
  ReportedEmail?: string
  Status?: string
  Created?: string
}
interface SafeDomainRow { id: number; Title: string; Created?: string; Author?: { Title: string } }

const SAFE_CATEGORY = 'SafeDomain'
const STATUSES = ['New', 'Investigating', 'Confirmed', 'False positive', 'Closed']

const LEVEL_BADGE: Record<string, string> = {
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  suspicious: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  safe: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}
const LEVEL_LABEL: Record<string, string> = {
  danger: 'เสี่ยงสูง', suspicious: 'น่าสงสัย', safe: 'ปกติ',
}
const STATUS_BADGE: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Investigating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Confirmed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'False positive': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  Closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
}

export default function PhishReports() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  // ยืนยันโดเมน/เปลี่ยนสถานะเป็น security control → Agent ขึ้นไป (ตรงกับแอดอิน)
  const canManage = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  const [rows, setRows] = useState<PhishReport[]>([])
  const [safe, setSafe] = useState<SafeDomainRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [days, setDays] = useState('30')
  const [open, setOpen] = useState<PhishReport | null>(null)
  const [newDomain, setNewDomain] = useState('')
  const [busy, setBusy] = useState('')

  function loadReports() {
    setLoading(true)
    const filter = days === 'all' ? undefined
      : `Created ge datetime'${new Date(Date.now() - Number(days) * 86400_000).toISOString()}'`
    // ใช้ select=* กัน 400 ถ้าคอลัมน์ใดยังไม่ถูกสร้าง (ลิสต์ตั้งด้วยมือ)
    spGet<PhishReport>('HD_PhishingReports', filter, '*', 'Created desc', 2000)
      .then(setRows)
      .catch(() => addToast('error', 'โหลดรายงานไม่ได้ — ตรวจว่ามีลิสต์ HD_PhishingReports'))
      .finally(() => setLoading(false))
  }
  function loadSafe() {
    spGet<SafeDomainRow>('HD_Options', `Category eq '${SAFE_CATEGORY}'`,
      'Id,Title,Created,Author/Title', 'Title asc', 500, 'Author')
      .then(setSafe).catch(() => setSafe([]))
  }
  useEffect(() => { loadReports() }, [days])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadSafe() }, [])

  const filtered = useMemo(() => rows.filter(r =>
    (!levelFilter || r.RiskLevel === levelFilter) &&
    (!statusFilter || (r.Status ?? 'New') === statusFilter) &&
    (!search || [r.Title, r.SenderEmail, r.SenderName, r.SenderDomain, r.ReportedBy, r.Findings]
      .some(s => (s ?? '').toLowerCase().includes(search.toLowerCase())))
  ), [rows, levelFilter, statusFilter, search])

  const stats = useMemo(() => ({
    total: rows.length,
    danger: rows.filter(r => r.RiskLevel === 'danger').length,
    open: rows.filter(r => !r.Status || r.Status === 'New' || r.Status === 'Investigating').length,
    week: rows.filter(r => r.Created && Date.now() - new Date(r.Created).getTime() < 7 * 86400_000).length,
  }), [rows])

  async function setStatus(r: PhishReport, status: string) {
    try {
      await spUpdate('HD_PhishingReports', r.id, { Status: status })
      setRows(prev => prev.map(x => x.id === r.id ? { ...x, Status: status } : x))
      setOpen(o => o && o.id === r.id ? { ...o, Status: status } : o)
      addToast('success', `อัปเดตสถานะเป็น ${status}`)
    } catch { addToast('error', tr('common.error')) }
  }

  async function addSafeDomain() {
    const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    if (!d || !d.includes('.')) { addToast('error', 'กรุณาใส่ชื่อโดเมน เช่น vendor.co.th'); return }
    if (safe.some(s => s.Title.toLowerCase() === d)) { addToast('info', 'มีโดเมนนี้อยู่แล้ว'); return }
    setBusy(d)
    try {
      await spCreate('HD_Options', { Title: d, Category: SAFE_CATEGORY })
      setNewDomain(''); loadSafe()
      addToast('success', `เพิ่ม ${d} เข้ารายการปลอดภัยแล้ว`)
    } catch { addToast('error', tr('common.error')) } finally { setBusy('') }
  }

  async function removeSafeDomain(s: SafeDomainRow) {
    if (!window.confirm(`ถอน "${s.Title}" ออกจากรายการปลอดภัย?\n\nลิงก์จากโดเมนนี้จะกลับมาถูกเตือนตามปกติ`)) return
    setBusy(s.Title)
    try {
      await spDelete('HD_Options', s.id)
      setSafe(prev => prev.filter(x => x.id !== s.id))
      addToast('success', 'ถอนออกแล้ว')
    } catch { addToast('error', tr('common.error')) } finally { setBusy('') }
  }

  async function exportExcel() {
    if (filtered.length === 0) { addToast('info', 'ไม่มีรายการให้ส่งออก'); return }
    try {
      const XLSX = await import('xlsx')
      const data = filtered.map(r => ({
        'วันที่': r.Created ? new Date(r.Created).toLocaleString('th-TH') : '',
        'หัวข้ออีเมล': r.Title,
        'ผู้ส่ง': r.SenderName || '',
        'อีเมลผู้ส่ง': r.SenderEmail || '',
        'โดเมนผู้ส่ง': r.SenderDomain || '',
        'คะแนน': r.RiskScore ?? '',
        'ระดับ': LEVEL_LABEL[r.RiskLevel ?? ''] ?? r.RiskLevel ?? '',
        'สถานะ': r.Status || 'New',
        'จำนวนลิงก์': r.LinkCount ?? '',
        'ผู้รายงาน': r.ReportedBy || '',
        'สิ่งที่ตรวจพบ': (r.Findings || '').replace(/\s+/g, ' ').slice(0, 2000),
      }))
      const ws = XLSX.utils.json_to_sheet(data)
      ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 28 }, { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 70 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'PhishingReports')
      XLSX.writeFile(wb, `phishing-reports-${new Date().toISOString().slice(0, 10)}.xlsx`)
      addToast('success', `ส่งออกแล้ว ${filtered.length} รายการ`)
    } catch { addToast('error', tr('common.error')) }
  }

  const columns: Column<PhishReport>[] = [
    { key: 'created', label: 'วันที่', sortValue: r => r.Created ?? '',
      render: r => <span className="text-xs text-gray-500 whitespace-nowrap">{r.Created ? formatDate(r.Created) : '—'}</span> },
    { key: 'level', label: 'ระดับ', sortValue: r => ({ danger: 0, suspicious: 1, safe: 2 }[r.RiskLevel ?? ''] ?? 9),
      render: r => <Badge className={LEVEL_BADGE[r.RiskLevel ?? ''] ?? 'bg-gray-100 text-gray-600'}>
        {LEVEL_LABEL[r.RiskLevel ?? ''] ?? r.RiskLevel ?? '—'}</Badge> },
    { key: 'score', label: 'คะแนน', sortValue: r => r.RiskScore ?? 0, align: 'right',
      render: r => <span className="text-xs font-semibold tabular-nums">{r.RiskScore ?? '—'}</span> },
    { key: 'title', label: 'หัวข้ออีเมล', sortValue: r => r.Title,
      render: r => <span className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1 max-w-xs">{r.Title}</span> },
    { key: 'sender', label: 'ผู้ส่ง', sortValue: r => r.SenderEmail ?? '',
      render: r => (
        <span className="text-xs">
          <span className="block text-gray-700 dark:text-gray-200 truncate max-w-[180px]">{r.SenderName || '—'}</span>
          <span className="block text-gray-400 truncate max-w-[180px]">{r.SenderEmail}</span>
        </span>
      ) },
    { key: 'links', label: 'ลิงก์', sortValue: r => r.LinkCount ?? 0, align: 'right',
      render: r => <span className="text-xs text-gray-500 tabular-nums">{r.LinkCount ?? 0}</span> },
    { key: 'status', label: 'สถานะ', sortValue: r => STATUSES.indexOf(r.Status ?? 'New'),
      render: r => <Badge className={STATUS_BADGE[r.Status ?? 'New'] ?? 'bg-gray-100 text-gray-600'}>{r.Status || 'New'}</Badge> },
    { key: 'reporter', label: 'ผู้รายงาน', sortValue: r => r.ReportedBy ?? '',
      render: r => <span className="text-xs text-gray-500 truncate max-w-[140px] inline-block">{r.ReportedBy || '—'}</span> },
  ]

  const selCx = 'px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900'

  return (
    <div>
      <Header title="ความปลอดภัยอีเมล" />
      <div className="p-4 md:p-6 space-y-5">

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'รายงานทั้งหมด', value: stats.total, cls: 'text-gray-900 dark:text-gray-100' },
            { label: 'เสี่ยงสูง', value: stats.danger, cls: 'text-red-600' },
            { label: 'ยังไม่ปิดเคส', value: stats.open, cls: 'text-amber-600' },
            { label: '7 วันล่าสุด', value: stats.week, cls: 'text-blue-600' },
          ].map(s => (
            <Card key={s.label}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา หัวข้อ / ผู้ส่ง / โดเมน / ผู้รายงาน"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          <select value={days} onChange={e => setDays(e.target.value)} className={selCx}>
            <option value="7">7 วัน</option>
            <option value="30">30 วัน</option>
            <option value="90">90 วัน</option>
            <option value="all">ทั้งหมด</option>
          </select>
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className={selCx}>
            <option value="">ทุกระดับ</option>
            {Object.entries(LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selCx}>
            <option value="">ทุกสถานะ</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <Button size="sm" variant="secondary" onClick={loadReports}><RefreshCw size={14} /> โหลดใหม่</Button>
          <Button size="sm" variant="secondary" onClick={exportExcel}><Download size={14} /> Excel ({filtered.length})</Button>
        </div>

        {/* Reports */}
        {loading ? (
          <p className="text-sm text-gray-400 py-10 text-center">{tr('comp.loading')}</p>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-14">
            <ShieldAlert size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">ยังไม่มีรายงานในช่วงเวลาที่เลือก</p>
            <p className="text-xs text-gray-400 mt-1">รายงานจะเข้ามาเมื่อมีคนกด “🚩 รายงานอีเมลนี้ให้ IT” ในแท็บ PhishGuard บน Outlook</p>
          </Card>
        ) : (
          <DataTable rows={filtered} columns={columns} rowKey={r => r.id}
            onRowClick={r => setOpen(r)} emptyText="ไม่มีรายงาน"
            rowClass={r => r.RiskLevel === 'danger' && (!r.Status || r.Status === 'New') ? 'bg-red-50/40 dark:bg-red-900/10' : ''} />
        )}

        {/* Whitelist */}
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold">โดเมนที่ทีมยืนยันว่าปลอดภัย ({safe.length})</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            ลิงก์จากโดเมนเหล่านี้จะไม่ถูกเตือนใน PhishGuard อีก · การตรวจผู้ส่ง ไฟล์แนบ และเนื้อหา ยังทำงานปกติ
          </p>

          {canManage && (
            <div className="flex gap-2 mb-3">
              <input value={newDomain} onChange={e => setNewDomain(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSafeDomain() } }}
                placeholder="เช่น vendor.co.th"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
              <Button size="sm" onClick={addSafeDomain} disabled={!!busy}><Plus size={14} /> เพิ่ม</Button>
            </div>
          )}

          {safe.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีโดเมนในรายการ</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {safe.map(s => (
                <span key={s.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40"
                  title={`${s.Author?.Title ? `ยืนยันโดย ${s.Author.Title}` : ''}${s.Created ? ` · ${formatDate(s.Created)}` : ''}`}>
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">{s.Title}</span>
                  {canManage && (
                    <button onClick={() => removeSafeDomain(s)} disabled={busy === s.Title}
                      className="text-emerald-400 hover:text-red-500 disabled:opacity-40" title="ถอนออก">
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* รายละเอียดรายงาน */}
      <Modal open={!!open} onClose={() => setOpen(null)} title="รายละเอียดรายงาน" size="lg">
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={LEVEL_BADGE[open.RiskLevel ?? ''] ?? 'bg-gray-100 text-gray-600'}>
                {LEVEL_LABEL[open.RiskLevel ?? ''] ?? open.RiskLevel}
              </Badge>
              <span className="text-xs text-gray-500">คะแนน {open.RiskScore ?? '—'}</span>
              <span className="text-xs text-gray-400">· {open.Created ? new Date(open.Created).toLocaleString('th-TH') : ''}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                ['หัวข้ออีเมล', open.Title],
                ['ผู้ส่ง', `${open.SenderName ?? ''} <${open.SenderEmail ?? ''}>`],
                ['โดเมนผู้ส่ง', open.SenderDomain],
                ['ผู้รายงาน', `${open.ReportedBy ?? ''} ${open.ReportedEmail ? `(${open.ReportedEmail})` : ''}`],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-gray-400">{k}</p>
                  <p className="text-gray-800 dark:text-gray-200 break-all">{v || '—'}</p>
                </div>
              ))}
            </div>

            {/* สถานะ */}
            <div>
              <p className="text-xs text-gray-400 mb-1">สถานะ</p>
              {canManage ? (
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map(s => (
                    <button key={s} onClick={() => setStatus(open, s)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        (open.Status || 'New') === s
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary-300'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              ) : <Badge className={STATUS_BADGE[open.Status ?? 'New']}>{open.Status || 'New'}</Badge>}
            </div>

            {open.SuspiciousLinks && (
              <div>
                <p className="text-xs text-gray-400 mb-1">ลิงก์น่าสงสัย</p>
                <pre className="text-[11px] bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-2.5 whitespace-pre-wrap break-all text-red-800 dark:text-red-300 max-h-32 overflow-y-auto">{open.SuspiciousLinks}</pre>
                <p className="text-[10px] text-gray-400 mt-1">อย่าเปิดลิงก์เหล่านี้โดยตรง — ใช้ Kasm หรือเครื่องแยก</p>
              </div>
            )}

            {open.Findings && (
              <div>
                <p className="text-xs text-gray-400 mb-1">สิ่งที่ตรวจพบ</p>
                <pre className="text-[11px] bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-lg p-2.5 whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300 max-h-72 overflow-y-auto">{open.Findings}</pre>
              </div>
            )}

            {/* อีเมลต้นฉบับ (.eml) ที่แอดอินแนบมา */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Paperclip size={11} /> อีเมลต้นฉบับ</p>
              <AttachmentSection listName="HD_PhishingReports" itemId={open.id} readOnly={!canManage} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
