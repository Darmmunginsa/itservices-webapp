import { useEffect, useMemo, useState } from 'react'
import { Plus, Edit2, Trash2, ExternalLink, Search, Copy, Check, BookOpen, Quote, Paperclip } from 'lucide-react'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'
import { Badge } from '../common/Badge'
import { AttachmentSection } from '../common/AttachmentSection'
import { spGet, spCreate, spUpdate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { formatCitation, formatBibliography } from '../../utils/citation'
import { REF_TYPES, REF_TYPE_TH, REF_TYPE_ICON, type ProjectReference } from '../../types/reference'

const LIST = 'PM_References'

const EMPTY = {
  Title: '', RefType: 'Book', Authors: '', Year: '', Publisher: '',
  Edition: '', Identifier: '', Locator: '', URL: '', Summary: '', AppliedTo: '',
}
type Form = typeof EMPTY

interface Props {
  projectId: number
  canEdit: boolean       // เพิ่ม/แก้ไขได้ (สมาชิกโครงการ)
  canDelete: boolean     // ลบได้ (Boss/Admin) — อ้างอิงที่ถูกลบไปแล้วตามกลับยาก
  onCount?: (n: number) => void
}

export function ReferencesPanel({ projectId, canEdit, canDelete, onCount }: Props) {
  const { addToast } = useAppStore()
  const [rows, setRows] = useState<ProjectReference[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)     // ลิสต์ยังไม่ถูกสร้างใน SharePoint
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ProjectReference | null>(null)
  const [form, setForm] = useState<Form>({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  function load() {
    setLoading(true)
    // select='*' — ลิสต์ที่สร้างเองอาจมีคอลัมน์ไม่ครบ ระบุชื่อคอลัมน์ตรง ๆ จะ 400 ทั้งคำขอ
    spGet<ProjectReference>(LIST, `ProjectID eq ${projectId}`, '*', 'Title asc', 500)
      .then(r => { setRows(r); setMissing(false); onCount?.(r.length) })
      .catch(() => { setMissing(true); setRows([]); onCount?.(0) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [projectId])   // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))

  function openAdd() { setEditing(null); setForm({ ...EMPTY }); setShowModal(true) }
  function openEdit(r: ProjectReference) {
    setEditing(r)
    setForm({
      Title: r.Title || '', RefType: r.RefType || 'Book', Authors: r.Authors || '',
      Year: r.Year || '', Publisher: r.Publisher || '', Edition: r.Edition || '',
      Identifier: r.Identifier || '', Locator: r.Locator || '', URL: r.URL || '',
      Summary: r.Summary || '', AppliedTo: r.AppliedTo || '',
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
      AppliedTo: form.AppliedTo || undefined,
    }
    try {
      if (editing) { await spUpdate(LIST, editing.id, payload); addToast('success', 'อัปเดตแหล่งอ้างอิงแล้ว') }
      else { await spCreate(LIST, { ...payload, ProjectID: projectId }); addToast('success', 'เพิ่มแหล่งอ้างอิงแล้ว') }
      setShowModal(false); load()
    } catch { addToast('error', 'บันทึกไม่สำเร็จ') } finally { setSaving(false) }
  }

  async function remove(r: ProjectReference) {
    if (!window.confirm(`ลบแหล่งอ้างอิง "${r.Title}"?`)) return
    try {
      await spDelete(LIST, r.id)
      setRows(prev => { const next = prev.filter(x => x.id !== r.id); onCount?.(next.length); return next })
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

  const filtered = useMemo(() => rows.filter(r => {
    if (typeFilter && (r.RefType || 'Other') !== typeFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [r.Title, r.Authors, r.Publisher, r.Identifier, r.Summary, r.AppliedTo]
      .some(v => (v || '').toLowerCase().includes(q))
  }), [rows, search, typeFilter])

  // จัดกลุ่มตามชนิด เรียงตามลำดับใน REF_TYPES (หนังสือ/มาตรฐานขึ้นก่อน "อื่นๆ" ท้ายสุด)
  const grouped = useMemo(() => {
    const m = new Map<string, ProjectReference[]>()
    for (const r of filtered) {
      const k = r.RefType || 'Other'
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()].sort(([a], [b]) => REF_TYPES.indexOf(a as never) - REF_TYPES.indexOf(b as never))
  }, [filtered])

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(r.RefType || 'Other', (m.get(r.RefType || 'Other') ?? 0) + 1)
    return m
  }, [rows])

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  if (loading) return <p className="text-center text-sm text-gray-400 py-10">กำลังโหลด...</p>

  if (missing) {
    return (
      <div className="text-center py-12 text-gray-400">
        <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">ยังไม่มีลิสต์ <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">PM_References</code> ใน SharePoint</p>
        <p className="text-xs mt-1">สร้างลิสต์ก่อนจึงจะใช้แท็บนี้ได้ (ดูคอลัมน์ที่ต้องมีในเอกสาร References-Setup.md)</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && <Button size="sm" onClick={openAdd}><Plus size={14} /> เพิ่มแหล่งอ้างอิง</Button>}
        <div className="flex items-center gap-2 flex-1 min-w-[180px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-1.5">
          <Search size={14} className="text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อเรื่อง / ผู้แต่ง / ISBN..."
            className="flex-1 bg-transparent text-sm focus:outline-none" />
        </div>
        {rows.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => copy(formatBibliography(rows), '__all__')}
            title="ก็อปบรรณานุกรมทั้งชุดไปวางในรายงาน">
            {copied === '__all__' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            คัดลอกบรรณานุกรม
          </Button>
        )}
      </div>

      {/* ตัวกรองตามชนิด */}
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

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BookOpen size={30} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{rows.length === 0 ? 'ยังไม่มีแหล่งอ้างอิงในโครงการนี้' : 'ไม่พบรายการที่ค้นหา'}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([type, items]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {REF_TYPE_ICON[type] ?? '🔖'} {REF_TYPE_TH[type] ?? type}
                </h4>
                <span className="text-xs text-gray-400">({items.length})</span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="space-y-2">
                {items.map(r => {
                  const citation = formatCitation(r)
                  const open = openId === r.id
                  return (
                    <div key={r.id} className="subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.Title}</p>
                          {/* บรรทัดอ้างอิงสำเร็จรูป — กดคัดลอกไปวางในเอกสารได้เลย */}
                          {citation && citation !== `${r.Title}.` && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">{citation}</p>
                          )}
                          {r.AppliedTo && (
                            <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                              ใช้กับ: {r.AppliedTo}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {r.Locator && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{r.Locator}</Badge>}
                            {r.Identifier && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{r.Identifier}</Badge>}
                            {r.URL && (
                              <a href={r.URL} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                                เปิดลิงก์ <ExternalLink size={10} />
                              </a>
                            )}
                            {r.Author?.Title && <span className="text-[11px] text-gray-400">เพิ่มโดย {r.Author.Title}</span>}
                          </div>
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
                            <button onClick={() => remove(r)} title="ลบ"
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      {open && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
                          {r.Summary && (
                            <div className="flex gap-2">
                              <Quote size={13} className="text-gray-300 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{r.Summary}</p>
                            </div>
                          )}
                          {/* สแกนหน้าหนังสือ / ไฟล์ PDF ของมาตรฐาน */}
                          <AttachmentSection listName={LIST} itemId={r.id} readOnly={!canEdit} />
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'แก้ไขแหล่งอ้างอิง' : 'เพิ่มแหล่งอ้างอิง'} size="lg">
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
              <label className={labelCx}>ตำแหน่งที่อ้างถึง</label>
              <input value={form.Locator} onChange={e => set('Locator', e.target.value)} className={inputCx} placeholder="บทที่ 4 น.120-135" />
            </div>
          </div>

          <div>
            <label className={labelCx}>URL</label>
            <input value={form.URL} onChange={e => set('URL', e.target.value)} className={inputCx} placeholder="https://..." />
          </div>

          <div>
            <label className={labelCx}>ใช้กับเรื่องอะไรในโครงการนี้</label>
            <input value={form.AppliedTo} onChange={e => set('AppliedTo', e.target.value)} className={inputCx}
              placeholder="เช่น ใช้กำหนดเกณฑ์ SLO ของระบบลูกค้า" />
          </div>

          <div>
            <label className={labelCx}>สรุปสาระ / ข้อความที่ยกมา</label>
            <textarea value={form.Summary} onChange={e => set('Summary', e.target.value)} rows={4} className={inputCx}
              placeholder="สรุปสั้น ๆ ว่าแหล่งนี้บอกอะไร หรือวางข้อความที่ต้องการอ้างถึงตรง ๆ" />
          </div>

          {/* ตัวอย่างบรรทัดอ้างอิงที่จะได้ — เห็นผลก่อนบันทึก */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
            <p className="text-[11px] text-gray-500 mb-1">บรรทัดอ้างอิงที่จะได้</p>
            <p className="text-xs text-gray-700 dark:text-gray-200 break-words">{formatCitation(form) || '—'}</p>
          </div>

          {editing && (
            <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
              <AttachmentSection listName={LIST} itemId={editing.id} />
            </div>
          )}

          <Button type="submit" disabled={saving} className="w-full justify-center">
            {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มแหล่งอ้างอิง'}
          </Button>
          {!editing && <p className="text-[11px] text-gray-400 text-center">แนบไฟล์ได้หลังบันทึกแล้ว (กดแก้ไขอีกครั้ง)</p>}
        </form>
      </Modal>
    </div>
  )
}
