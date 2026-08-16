import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, ExternalLink, Search, Copy, Check, BookOpen, Paperclip, FolderOpen, FileSpreadsheet, X } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { Badge } from '../components/common/Badge'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { DataTable, type Column } from '../components/common/DataTable'
import { ViewToggle, useViewMode } from '../components/common/ViewToggle'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { formatCitation, formatBibliography } from '../utils/citation'
import { ReferenceContent } from '../components/project/ReferenceContent'
import { parseMediaLinks } from '../utils/youtube'
import { parseSections, countLinks, referencedFiles } from '../utils/richNote'
import { RichNote } from '../components/common/RichNote'
import { REF_TYPES, REF_TYPE_TH, REF_TYPE_ICON, type ProjectReference, type ProjectReferenceLink } from '../types/reference'
import { useT } from '../i18n/useT'

const LIST = 'PM_References'
const NL = String.fromCharCode(10)
const LINK_LIST = 'PM_ProjectReferences'

const EMPTY = {
  Title: '', RefType: 'Book', Authors: '', Year: '', Publisher: '',
  Edition: '', Identifier: '', Locator: '', URL: '', Summary: '', Topics: '', Media: '',
}
type Form = typeof EMPTY

export default function References() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const canEdit = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const canDelete = ['Boss', 'Admin'].includes(user?.role ?? '')

  const [rows, setRows] = useState<ProjectReference[]>([])
  const [usage, setUsage] = useState<ProjectReferenceLink[]>([])
  const [projectNames, setProjectNames] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ProjectReference | null>(null)
  const [form, setForm] = useState<Form>({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [view, setView] = useViewMode('references')
  const [topicFilter, setTopicFilter] = useState('')
  const [detail, setDetail] = useState<ProjectReference | null>(null)   // รายละเอียดเต็ม (ใช้กับมุมมองตาราง)
  const [preview, setPreview] = useState(false)   // ดูตัวอย่างเนื้อหาในฟอร์มก่อนบันทึก

  function load() {
    setLoading(true)
    // select='*' — ลิสต์ที่สร้างเองอาจมีคอลัมน์ไม่ครบ ระบุชื่อคอลัมน์ตรง ๆ จะ 400 ทั้งคำขอ
    // $expand=AttachmentFiles — ได้ชื่อไฟล์แนบมาพร้อมกัน ไม่ต้องยิงทีละรายการ
    spGet<ProjectReference>(LIST, undefined, '*,AttachmentFiles/FileName', 'Title asc', 1000, 'AttachmentFiles')
      .then(r => { setRows(r); setMissing(false) })
      .catch(() => spGet<ProjectReference>(LIST, undefined, '*', 'Title asc', 1000)
        .then(r => { setRows(r); setMissing(false) }))
      .catch(() => { setMissing(true); setRows([]) })
      .finally(() => setLoading(false))
    // ผูกอยู่กับโครงการไหนบ้าง — ลิสต์เชื่อมยังไม่มีก็ไม่เป็นไร
    spGet<ProjectReferenceLink>(LINK_LIST, undefined, 'Id,Title,ProjectID,ReferenceID,Locator,AppliedTo', undefined, 2000)
      .then(setUsage).catch(() => setUsage([]))
    spGet<{ id: number; Title: string }>('PM_Projects', undefined, 'Id,Title', 'Title asc', 500)
      .then(ps => setProjectNames(Object.fromEntries(ps.map(p => [p.id, p.Title]))))
      .catch(() => {})
  }
  useEffect(() => { load() }, [])

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setPreview(false); setShowModal(true) }
  function openEdit(r: ProjectReference) {
    setEditing(r)
    setPreview(false)
    setForm({
      Title: r.Title || '', RefType: r.RefType || 'Book', Authors: r.Authors || '',
      Year: r.Year || '', Publisher: r.Publisher || '', Edition: r.Edition || '',
      Identifier: r.Identifier || '', Locator: r.Locator || '', URL: r.URL || '',
      Summary: r.Summary || '', Topics: r.Topics || '', Media: r.Media || '',
    })
    setShowModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.Title.trim()) return
    setSaving(true)
    const payload = {
      Title: form.Title.trim(),
      RefType: form.RefType || undefined,
      Authors: form.Authors || undefined,
      Year: form.Year || undefined,
      Publisher: form.Publisher || undefined,
      Edition: form.Edition || undefined,
      Identifier: form.Identifier || undefined,
      Locator: form.Locator || undefined,
      URL: form.URL || undefined,
      Summary: form.Summary || undefined,
      Topics: form.Topics || undefined,
      Media: form.Media || undefined,
    }
    try {
      if (editing) { await spUpdate(LIST, editing.id, payload); addToast('success', 'อัปเดตแหล่งอ้างอิงแล้ว') }
      else { await spCreate(LIST, payload); addToast('success', 'เพิ่มเข้าคลังแล้ว') }
      setShowModal(false); load()
    } catch { addToast('error', 'บันทึกไม่สำเร็จ') } finally { setSaving(false) }
  }

  async function remove(r: ProjectReference) {
    const used = usage.filter(u => u.ReferenceID === r.id)
    const warn = used.length
      ? `\n\nแหล่งนี้ถูกอ้างอิงอยู่ใน ${used.length} โครงการ — ลบแล้วโครงการเหล่านั้นจะเสียแหล่งที่มาไปด้วย`
      : ''
    if (!window.confirm(`ลบ "${r.Title}" ออกจากคลัง?${warn}`)) return
    try {
      await spDelete(LIST, r.id)
      // เก็บกวาดลิสต์เชื่อม ไม่ให้เหลือรายการชี้ไปหาของที่ไม่มีแล้ว
      for (const u of used) { try { await spDelete(LINK_LIST, u.id) } catch { /* ข้ามไป */ } }
      setRows(prev => prev.filter(x => x.id !== r.id))
      setUsage(prev => prev.filter(u => u.ReferenceID !== r.id))
      addToast('success', 'ลบแล้ว')
    } catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  async function copy(text: string, key: string) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text)
      else {
        const ta = document.createElement('textarea')
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
      }
      setCopied(key); setTimeout(() => setCopied(''), 1500)
    } catch { addToast('error', 'คัดลอกไม่สำเร็จ') }
  }

  // หัวข้อทั้งหมดที่มีในคลัง เรียงตามจำนวนที่ใช้ — พอหนังสือเยอะ ตัวกรองนี้แคบกว่าประเภท
  const topicCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      for (const t of (r.Topics || '').split(',').map(x => x.trim()).filter(Boolean)) {
        m.set(t, (m.get(t) ?? 0) + 1)
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'))
  }, [rows])

  const filtered = useMemo(() => rows.filter(r => {
    if (typeFilter && (r.RefType || 'Other') !== typeFilter) return false
    if (topicFilter && !(r.Topics || '').split(',').map(x => x.trim()).includes(topicFilter)) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [r.Title, r.Authors, r.Publisher, r.Identifier, r.Summary, r.Topics, r.Media]
      .some(v => (v || '').toLowerCase().includes(q))
  }), [rows, search, typeFilter, topicFilter])

  const grouped = useMemo(() => {
    const m = new Map<string, ProjectReference[]>()
    for (const r of filtered) m.set(r.RefType || 'Other', [...(m.get(r.RefType || 'Other') ?? []), r])
    return [...m.entries()].sort(([a], [b]) => REF_TYPES.indexOf(a as never) - REF_TYPES.indexOf(b as never))
  }, [filtered])

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.RefType || 'Other', (m.get(r.RefType || 'Other') ?? 0) + 1)
    return m
  }, [rows])

  const usageByRef = useMemo(() => {
    const m = new Map<number, ProjectReferenceLink[]>()
    for (const u of usage) m.set(u.ReferenceID, [...(m.get(u.ReferenceID) ?? []), u])
    return m
  }, [usage])

  async function exportExcel() {
    try {
      const XLSX = await import('xlsx')
      const rowsOut = filtered.map(r => ({
        'ประเภท': REF_TYPE_TH[r.RefType ?? 'Other'] ?? r.RefType ?? '',
        'ชื่อเรื่อง': r.Title,
        'ผู้แต่ง': r.Authors ?? '',
        'ปี': r.Year ?? '',
        'สำนักพิมพ์': r.Publisher ?? '',
        'ครั้งที่พิมพ์': r.Edition ?? '',
        'เลขอ้างอิง': r.Identifier ?? '',
        'ตำแหน่งที่อ้างถึง': r.Locator ?? '',
        'หัวข้อ': r.Topics ?? '',
        'URL': r.URL ?? '',
        'จำนวนคลิป/ลิงก์': parseMediaLinks(r.Media).length,
        'จำนวนหัวข้อ': parseSections(r.Summary).filter(x => x.heading).length,
        'ลิงก์ในเนื้อหา': countLinks(r.Summary),
        'ใช้ในโครงการ': (usageByRef.get(r.id) ?? []).map(u => projectNames[u.ProjectID] ?? `#${u.ProjectID}`).join(', '),
        'สรุปสาระ': r.Summary ?? '',
        'บรรทัดอ้างอิง': formatCitation(r),
      }))
      const ws = XLSX.utils.json_to_sheet(rowsOut)
      ws['!cols'] = [12, 40, 24, 6, 20, 12, 20, 18, 22, 34, 14, 11, 13, 28, 60, 60].map(w => ({ wch: w }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'แหล่งอ้างอิง')
      XLSX.writeFile(wb, `references-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch { addToast('error', 'สร้างไฟล์ Excel ไม่สำเร็จ') }
  }

  // ── มุมมองตาราง — ใช้ตอนคลังใหญ่ เรียง/กวาดสายตาได้เร็วกว่าการ์ด ──
  const columns: Column<ProjectReference>[] = [
    {
      key: 'type', label: 'ประเภท', sortValue: r => REF_TYPE_TH[r.RefType ?? 'Other'] ?? '',
      render: r => (
        <span className="whitespace-nowrap text-gray-600 dark:text-gray-300">
          {REF_TYPE_ICON[r.RefType ?? 'Other'] ?? '🔖'} {REF_TYPE_TH[r.RefType ?? 'Other'] ?? r.RefType}
        </span>
      ),
    },
    {
      key: 'title', label: 'ชื่อเรื่อง', sortValue: r => r.Title ?? '',
      render: r => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[320px]">{r.Title}</p>
          {r.Topics && <p className="text-[11px] text-gray-400 truncate max-w-[320px]">{r.Topics}</p>}
        </div>
      ),
    },
    { key: 'authors', label: 'ผู้แต่ง', sortValue: r => r.Authors ?? '',
      render: r => <span className="text-gray-600 dark:text-gray-300 truncate block max-w-[180px]">{r.Authors || '-'}</span> },
    { key: 'year', label: 'ปี', align: 'center', sortValue: r => r.Year ?? '',
      render: r => <span className="text-gray-500">{r.Year || '-'}</span> },
    { key: 'ident', label: 'เลขอ้างอิง', sortValue: r => r.Identifier ?? '',
      render: r => <span className="text-gray-500 truncate block max-w-[160px]">{r.Identifier || '-'}</span> },
    {
      key: 'sections', label: 'หัวข้อ', align: 'center',
      sortValue: r => parseSections(r.Summary).filter(x => x.heading).length,
      render: r => {
        const n = parseSections(r.Summary).filter(x => x.heading).length
        const l = countLinks(r.Summary)
        return n || l
          ? <span className="text-gray-500 whitespace-nowrap">{n || '-'}{l > 0 && <span className="text-gray-400"> · 🔗{l}</span>}</span>
          : <span className="text-gray-300">-</span>
      },
    },
    {
      key: 'media', label: 'คลิป', align: 'center', sortValue: r => parseMediaLinks(r.Media).length,
      render: r => {
        const n = parseMediaLinks(r.Media).length
        return n ? <span className="text-red-600 dark:text-red-400 font-medium">▶ {n}</span> : <span className="text-gray-300">-</span>
      },
    },
    {
      key: 'usage', label: 'ใช้ในโครงการ', align: 'center', sortValue: r => (usageByRef.get(r.id) ?? []).length,
      render: r => {
        const n = (usageByRef.get(r.id) ?? []).length
        return n ? <span className="text-primary-600 font-medium">{n}</span> : <span className="text-gray-300">-</span>
      },
    },
    {
      key: 'actions', label: '', align: 'right',
      render: r => (
        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
          <button onClick={() => copy(formatCitation(r), String(r.id))} title="คัดลอกบรรทัดอ้างอิง"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
            {copied === String(r.id) ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          {canEdit && (
            <button onClick={() => openEdit(r)} title="แก้ไข"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
              <Edit2 size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => remove(r)} title="ลบออกจากคลัง"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ]

  // ชื่อไฟล์แนบของรายการ — ใช้ให้ [[ชื่อไฟล์]] ในเนื้อหาหาไฟล์เจอ
  const noteFiles = (r: ProjectReference) => ({
    listName: LIST, itemId: r.id,
    names: (r.AttachmentFiles ?? []).map(f => f.FileName),
  })

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div>
      <Header title={tr('nav.references')} />
      <div className="p-4 md:p-6 space-y-4">

        {missing ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">ยังไม่มีลิสต์ <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">PM_References</code> ใน SharePoint</p>
            <p className="text-xs mt-1">ดูคอลัมน์ที่ต้องสร้างในเอกสาร References-Setup.md</p>
          </div>
        ) : (<>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && <Button onClick={openAdd}><Plus size={15} /> เพิ่มแหล่งอ้างอิง</Button>}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อเรื่อง / ผู้แต่ง / ISBN / หัวข้อ..."
                className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            {rows.length > 0 && (<>
              <ViewToggle mode={view} onChange={setView} />
              <Button variant="secondary" onClick={() => copy(formatBibliography(filtered), '__all__')}
                title="คัดลอกบรรณานุกรมของรายการที่เห็นอยู่">
                {copied === '__all__' ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                คัดลอกบรรณานุกรม
              </Button>
              <Button variant="secondary" onClick={exportExcel} title="ส่งออกรายการที่กรองอยู่">
                <FileSpreadsheet size={15} /> Excel
              </Button>
            </>)}
          </div>

          {typeCounts.size > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setTypeFilter('')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!typeFilter ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                ทั้งหมด ({rows.length})
              </button>
              {REF_TYPES.filter(t => typeCounts.has(t)).map(t => (
                <button key={t} onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${typeFilter === t ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                  {REF_TYPE_ICON[t]} {REF_TYPE_TH[t]} ({typeCounts.get(t)})
                </button>
              ))}
            </div>
          )}

          {topicCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-gray-400 mr-0.5">หัวข้อ</span>
              {topicCounts.slice(0, 14).map(([t, n]) => (
                <button key={t} onClick={() => setTopicFilter(topicFilter === t ? '' : t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${topicFilter === t ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                  {t} ({n})
                </button>
              ))}
              {topicFilter && (
                <button onClick={() => setTopicFilter('')} className="text-xs text-gray-400 hover:text-red-500 inline-flex items-center gap-0.5">
                  <X size={11} /> ล้าง
                </button>
              )}
            </div>
          )}

          {/* จำนวนที่เห็นอยู่ตอนนี้ — พอกรองแล้วต้องรู้ว่าเหลือเท่าไหร่จากทั้งหมด */}
          {!loading && rows.length > 0 && (
            <p className="text-[11px] text-gray-400">
              แสดง {filtered.length} จาก {rows.length} รายการ
              {(typeFilter || topicFilter || search.trim()) && ' (กรองอยู่)'}
            </p>
          )}

          {loading ? (
            <p className="text-center text-sm text-gray-400 py-12">กำลังโหลด...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{rows.length === 0 ? 'ยังไม่มีแหล่งอ้างอิงในคลัง' : 'ไม่พบรายการที่ค้นหา'}</p>
            </div>
          ) : view === 'table' ? (
            <DataTable
              rows={filtered}
              columns={columns}
              rowKey={r => r.id}
              onRowClick={r => setDetail(r)}
              emptyText="ไม่พบรายการ"
            />
          ) : (
            <div className="space-y-5">
              {grouped.map(([type, items]) => (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {REF_TYPE_ICON[type] ?? '🔖'} {REF_TYPE_TH[type] ?? type}
                    </h2>
                    <span className="text-xs text-gray-400">({items.length})</span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                  </div>
                  <div className="space-y-2">
                    {items.map(r => {
                      const citation = formatCitation(r)
                      const open = openId === r.id
                      const used = usageByRef.get(r.id) ?? []
                      return (
                        <div key={r.id} className="subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.Title}</p>
                              {citation && citation !== `${r.Title}.` && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">{citation}</p>
                              )}
                              {/* เนื้อหาโชว์บนการ์ดเลย ไม่ต้องกดเปิด */}
                              <ReferenceContent summary={r.Summary} media={r.Media} files={noteFiles(r)} />
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {(r.Topics || '').split(',').map(t => t.trim()).filter(Boolean).map(t => (
                                  <Badge key={t} className="bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">{t}</Badge>
                                ))}
                                {r.Identifier && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{r.Identifier}</Badge>}
                                {parseSections(r.Summary).filter(x => x.heading).length > 0 && (
                                  <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    {parseSections(r.Summary).filter(x => x.heading).length} หัวข้อ
                                  </Badge>
                                )}
                                {countLinks(r.Summary) > 0 && (
                                  <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    🔗 {countLinks(r.Summary)}
                                  </Badge>
                                )}
                                {parseMediaLinks(r.Media).length > 0 && (
                                  <Badge className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                                    ▶ {parseMediaLinks(r.Media).length} คลิป
                                  </Badge>
                                )}
                                {r.URL && (
                                  <a href={r.URL} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                                    เปิดลิงก์ <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                              {/* ถูกใช้ในโครงการไหนบ้าง — กดไปดูบริบทที่ใช้จริงได้ */}
                              {used.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  <FolderOpen size={11} className="text-gray-400" />
                                  {used.map(u => (
                                    <Link key={u.id} to={`/projects/${u.ProjectID}`}
                                      className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                                      title={u.AppliedTo || undefined}>
                                      {projectNames[u.ProjectID] ?? `โครงการ #${u.ProjectID}`}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => copy(citation, String(r.id))} title="คัดลอกบรรทัดอ้างอิง"
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                                {copied === String(r.id) ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                              </button>
                              <button onClick={() => setOpenId(open ? null : r.id)} title="สรุป / ไฟล์แนบ"
                                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${open ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`}>
                                <Paperclip size={13} />
                              </button>
                              {canEdit && (
                                <button onClick={() => openEdit(r)} title="แก้ไข"
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {canDelete && (
                                <button onClick={() => remove(r)} title="ลบออกจากคลัง"
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {open && (
                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
                              <AttachmentSection listName={LIST} itemId={r.id} readOnly={!canEdit} />
                              {r.Author?.Title && <p className="text-[11px] text-gray-400">เพิ่มเข้าคลังโดย {r.Author.Title}</p>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>

      {/* รายละเอียดเต็ม — ใช้ตอนกดแถวในมุมมองตาราง */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.Title} size="lg">
        {detail && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {REF_TYPE_ICON[detail.RefType ?? 'Other'] ?? '🔖'} {REF_TYPE_TH[detail.RefType ?? 'Other'] ?? detail.RefType}
              </Badge>
              {(detail.Topics || '').split(',').map(t => t.trim()).filter(Boolean).map(t => (
                <Badge key={t} className="bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">{t}</Badge>
              ))}
            </div>

            <div className="flex items-start gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
              <p className="text-xs text-gray-700 dark:text-gray-200 break-words flex-1">{formatCitation(detail)}</p>
              <button onClick={() => copy(formatCitation(detail), `d${detail.id}`)} title="คัดลอกบรรทัดอ้างอิง"
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-primary-600 flex-shrink-0">
                {copied === `d${detail.id}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            </div>

            {detail.URL && (
              <a href={detail.URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline break-all">
                {detail.URL} <ExternalLink size={11} className="flex-shrink-0" />
              </a>
            )}

            <ReferenceContent summary={detail.Summary} media={detail.Media} files={noteFiles(detail)} />

            {(usageByRef.get(detail.id) ?? []).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">ใช้ในโครงการ</p>
                <div className="flex flex-wrap gap-1.5">
                  {(usageByRef.get(detail.id) ?? []).map(u => (
                    <Link key={u.id} to={`/projects/${u.ProjectID}`} onClick={() => setDetail(null)}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                      title={u.AppliedTo || undefined}>
                      {projectNames[u.ProjectID] ?? `โครงการ #${u.ProjectID}`}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
              <AttachmentSection listName={LIST} itemId={detail.id} readOnly={!canEdit} />
            </div>

            {canEdit && (
              <Button variant="secondary" className="w-full justify-center"
                onClick={() => { const r = detail; setDetail(null); openEdit(r) }}>
                <Edit2 size={14} /> แก้ไขรายการนี้
              </Button>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'แก้ไขแหล่งอ้างอิง' : 'เพิ่มแหล่งอ้างอิงเข้าคลัง'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCx}>ชื่อเรื่อง / ชื่อหนังสือ *</label>
              <input required value={form.Title} onChange={e => set('Title', e.target.value)} className={inputCx}
                placeholder="เช่น Site Reliability Engineering" />
            </div>
            <div>
              <label className={labelCx}>ประเภท</label>
              <select value={form.RefType} onChange={e => set('RefType', e.target.value)} className={inputCx}>
                {REF_TYPES.map(t => <option key={t} value={t}>{REF_TYPE_ICON[t]} {REF_TYPE_TH[t]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCx}>ผู้แต่ง / องค์กร</label>
              <input value={form.Authors} onChange={e => set('Authors', e.target.value)} className={inputCx}
                placeholder="เช่น Beyer, B., Jones, C." />
            </div>
            <div>
              <label className={labelCx}>ปี</label>
              <input value={form.Year} onChange={e => set('Year', e.target.value)} className={inputCx} placeholder="2016" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCx}>สำนักพิมพ์ / ผู้เผยแพร่</label>
              <input value={form.Publisher} onChange={e => set('Publisher', e.target.value)} className={inputCx} placeholder="O'Reilly Media" />
            </div>
            <div>
              <label className={labelCx}>ครั้งที่พิมพ์ / เวอร์ชัน</label>
              <input value={form.Edition} onChange={e => set('Edition', e.target.value)} className={inputCx} placeholder="2nd ed. / v3.1" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCx}>เลขอ้างอิง (ISBN / DOI / RFC)</label>
              <input value={form.Identifier} onChange={e => set('Identifier', e.target.value)} className={inputCx} placeholder="ISBN 978-1491929124" />
            </div>
            <div>
              <label className={labelCx}>ตำแหน่งที่มักอ้างถึง</label>
              <input value={form.Locator} onChange={e => set('Locator', e.target.value)} className={inputCx} placeholder="บทที่ 4 น.120-135" />
            </div>
          </div>

          <div>
            <label className={labelCx}>URL</label>
            <input value={form.URL} onChange={e => set('URL', e.target.value)} className={inputCx} placeholder="https://..." />
          </div>

          <div>
            <label className={labelCx}>หัวข้อ / แท็ก (คั่นด้วย ,)</label>
            <input value={form.Topics} onChange={e => set('Topics', e.target.value)} className={inputCx} placeholder="SRE, SLO, Monitoring" />
          </div>

          <div>
            <label className={labelCx}>คลิป / ลิงก์ (บรรทัดละ 1 ใส่ได้ไม่จำกัด)</label>
            <textarea value={form.Media} onChange={e => set('Media', e.target.value)} rows={3} className={inputCx}
              placeholder={['https://youtu.be/xxxxxxxxxxx', 'ตอนที่ 2 SLO | https://youtu.be/yyyyyyyyyyy'].join('\n')} />
            <p className="text-[11px] text-gray-400 mt-1">
              คลิป YouTube เล่นได้ในหน้าเลย · ตั้งชื่อคลิปด้วยรูปแบบ <code>ชื่อ | ลิงก์</code>
              {parseMediaLinks(form.Media).length > 0 && ` · ตอนนี้ ${parseMediaLinks(form.Media).length} รายการ`}
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className={labelCx + ' !mb-0'}>เนื้อหา / บันทึกความรู้</label>
              {parseSections(form.Summary).filter(x => x.heading).length > 0 && (
                <span className="text-[11px] text-gray-400">
                  {parseSections(form.Summary).filter(x => x.heading).length} หัวข้อ · {countLinks(form.Summary)} ลิงก์
                </span>
              )}
              <button type="button" onClick={() => setPreview(p => !p)}
                className="ml-auto text-[11px] text-primary-600 hover:underline">
                {preview ? 'กลับไปแก้ไข' : 'ดูตัวอย่าง'}
              </button>
            </div>
            {preview ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 min-h-[8rem] bg-gray-50 dark:bg-gray-800/40">
                {form.Summary.trim()
                  ? <RichNote text={form.Summary} defaultOpenFirst={false} />
                  : <p className="text-xs text-gray-400">ยังไม่มีเนื้อหา</p>}
              </div>
            ) : (
              <textarea value={form.Summary} onChange={e => set('Summary', e.target.value)} rows={10}
                className={inputCx + ' font-mono text-[13px] leading-relaxed'}
                placeholder={[
                  'สรุปสั้น ๆ ว่าแหล่งนี้บอกอะไร',
                  '',
                  '## การตั้ง SLO',
                  '- เริ่มจาก SLI ที่ลูกค้ารู้สึกได้จริง',
                  '- อ้างอิงเพิ่ม https://sre.google/workbook/implementing-slos/',
                  '',
                  '## Error budget',
                  'ดูตัวอย่างการคำนวณที่ [หน้า workbook](https://sre.google/workbook/) ประกอบ',
                ].join(String.fromCharCode(10))} />
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              เพิ่มหัวข้อใหม่ด้วย <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">## ชื่อหัวข้อ</code> ·
              รายการย่อยด้วย <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">-</code> ·
              วาง URL ตรงไหนก็กดได้ หรือตั้งชื่อลิงก์ด้วย <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">[ชื่อ](url)</code> ·
              แทรกไฟล์แนบด้วย <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">[[ชื่อไฟล์.png]]</code>
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
            <p className="text-[11px] text-gray-500 mb-1">บรรทัดอ้างอิงที่จะได้</p>
            <p className="text-xs text-gray-700 dark:text-gray-200 break-words">{formatCitation(form) || '—'}</p>
          </div>

          {editing && (
            <div className="pt-1 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <AttachmentSection listName={LIST} itemId={editing.id} />
              {/* กดชื่อไฟล์เพื่อแทรกลงในเนื้อหา — พิมพ์ [[ชื่อไฟล์]] เองก็ได้ แต่พิมพ์ผิดง่าย */}
              {(editing.AttachmentFiles ?? []).length > 0 && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">แทรกไฟล์ลงในเนื้อหา (กดเพื่อเพิ่มท้ายเนื้อหา)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(editing.AttachmentFiles ?? []).map(f => (
                      <button key={f.FileName} type="button"
                        onClick={() => set('Summary', form.Summary + (!form.Summary || form.Summary.endsWith(NL) ? '' : NL) + '[[' + f.FileName + ']]' + NL)}
                        className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 text-gray-600 dark:text-gray-300">
                        + {f.FileName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* อ้างถึงไฟล์ที่ยังไม่ได้แนบ — เตือนตั้งแต่ตอนเขียน ไม่ต้องรอไปเจอบนการ์ด */}
              {(() => {
                const attached = (editing.AttachmentFiles ?? []).map(f => f.FileName.toLowerCase())
                const missingFiles = referencedFiles(form.Summary).filter(n => !attached.includes(n.toLowerCase()))
                return missingFiles.length > 0 ? (
                  <p className="text-[11px] text-amber-600">
                    ⚠ เนื้อหาอ้างถึงไฟล์ที่ยังไม่ได้แนบ: {missingFiles.join(', ')}
                  </p>
                ) : null
              })()}
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full justify-center">
            {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มเข้าคลัง'}
          </Button>
          {!editing && <p className="text-[11px] text-gray-400 text-center">แนบไฟล์ได้หลังบันทึกแล้ว (กดแก้ไขอีกครั้ง)</p>}
        </form>
      </Modal>
    </div>
  )
}
