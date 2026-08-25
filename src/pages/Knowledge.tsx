import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Edit2, Trash2, Search, BookOpen, Globe, Download, Eye, Check, FileText, Loader2,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { Badge } from '../components/common/Badge'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { RichNote } from '../components/common/RichNote'
import { DataTable, type Column } from '../components/common/DataTable'
import { spGet, spCreate, spUpdate, spDelete, spAttachmentBlobUrl } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { referencedFiles } from '../utils/richNote'
import { formatDate } from '../utils/dateUtils'
import {
  articleHtml, indexHtml, searchIndex, siteCss, articleIssues, isPublished,
  articleFile, assetPath, tagList,
  type KbArticle, type SiteMeta,
} from '../utils/kb'

const LIST = 'HD_KBArticles'
const NL = String.fromCharCode(10)

const EMPTY = {
  Title: '', ArticleCode: '', Product: '', Tags: '',
  Summary: '', Resolution: '', Cause: '', ArticleStatus: 'Draft',
}
type Form = typeof EMPTY

/** ตั้งค่าเว็บที่ export — เก็บในเครื่อง ไม่ต้องมีคอลัมน์เพิ่มใน SharePoint */
const SITE_KEY = 'kbSiteMeta'
const DEFAULT_SITE: SiteMeta = {
  siteTitle: 'iT Services Knowledge Base',
  org: 'iT Services',
  contact: 'support@itservices.co.th',
  homeUrl: 'https://itservices.co.th',
}

export default function Knowledge() {
  const { user, addToast } = useAppStore()
  const canEdit = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const canPublish = ['Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  const [rows, setRows] = useState<KbArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [search, setSearch] = useState('')
  const [onlyPublished, setOnlyPublished] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editing, setEditing] = useState<KbArticle | null>(null)
  const [form, setForm] = useState<Form>({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)

  const [showSite, setShowSite] = useState(false)
  const [site, setSite] = useState<SiteMeta>(() => {
    try { return { ...DEFAULT_SITE, ...JSON.parse(localStorage.getItem(SITE_KEY) ?? '{}') } }
    catch { return DEFAULT_SITE }
  })
  const [building, setBuilding] = useState('')

  function load() {
    setLoading(true)
    spGet<KbArticle>(LIST, undefined, '*,AttachmentFiles/FileName,Author/Title', 'Modified desc', 1000, 'AttachmentFiles,Author')
      .catch(() => spGet<KbArticle>(LIST, undefined, '*', 'Modified desc', 1000))
      .then(r => { setRows(r); setMissing(false) })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }))

  function openNew() {
    setEditing(null)
    // รหัสถัดไปแบบเดาให้ — แก้เองได้ แต่ส่วนใหญ่ไม่ต้องคิด
    const nums = rows.map(r => Number((r.ArticleCode ?? '').replace(/\D+/g, ''))).filter(n => n > 0)
    const next = (nums.length ? Math.max(...nums) : 0) + 1
    setForm({ ...EMPTY, ArticleCode: `ITS${String(next).padStart(6, '0')}` })
    setPreview(false)
    setShowEdit(true)
  }

  function openEdit(a: KbArticle) {
    setEditing(a)
    setForm({
      Title: a.Title ?? '', ArticleCode: a.ArticleCode ?? '', Product: a.Product ?? '',
      Tags: a.Tags ?? '', Summary: a.Summary ?? '', Resolution: a.Resolution ?? '',
      Cause: a.Cause ?? '', ArticleStatus: a.ArticleStatus ?? 'Draft',
    })
    setPreview(false)
    setShowEdit(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.Title.trim()) return
    setSaving(true)
    const payload = {
      Title: form.Title.trim(),
      ArticleCode: form.ArticleCode.trim() || undefined,
      Product: form.Product || undefined,
      Tags: form.Tags || undefined,
      Summary: form.Summary || undefined,
      Resolution: form.Resolution || undefined,
      Cause: form.Cause || undefined,
      ArticleStatus: form.ArticleStatus,
    }
    try {
      if (editing) { await spUpdate(LIST, editing.id, payload); addToast('success', 'บันทึกบทความแล้ว') }
      else { await spCreate(LIST, payload); addToast('success', 'สร้างบทความแล้ว') }
      setShowEdit(false); load()
    } catch { addToast('error', 'บันทึกไม่สำเร็จ') } finally { setSaving(false) }
  }

  async function remove(a: KbArticle) {
    if (!window.confirm(`ลบบทความ "${a.Title}"?${isPublished(a) ? '\n\nบทความนี้เผยแพร่อยู่ — ลิงก์ที่ส่งให้ลูกค้าไปแล้วจะใช้ไม่ได้หลังสร้างเว็บครั้งถัดไป' : ''}`)) return
    try {
      await spDelete(LIST, a.id)
      setRows(prev => prev.filter(x => x.id !== a.id))
      addToast('success', 'ลบแล้ว')
    } catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  async function togglePublish(a: KbArticle) {
    const to = isPublished(a) ? 'Draft' : 'Published'
    const issues = articleIssues(a)
    if (to === 'Published' && issues.length) {
      if (!window.confirm(`บทความยังไม่ครบ:\n\n${issues.map(x => '• ' + x).join('\n')}\n\nเผยแพร่ต่อไปไหม?`)) return
    }
    try {
      await spUpdate(LIST, a.id, { ArticleStatus: to })
      setRows(prev => prev.map(x => x.id === a.id ? { ...x, ArticleStatus: to } : x))
      addToast('success', to === 'Published' ? 'ตั้งเป็นเผยแพร่แล้ว' : 'เปลี่ยนเป็นฉบับร่างแล้ว')
    } catch { addToast('error', 'เปลี่ยนสถานะไม่สำเร็จ') }
  }

  // ── สร้างเว็บ static ──────────────────────────────────────────────────────
  async function buildSite() {
    const pub = rows.filter(isPublished)
    if (pub.length === 0) { addToast('error', 'ยังไม่มีบทความที่ตั้งเป็นเผยแพร่'); return }
    setBuilding('เริ่ม...')
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      zip.file('style.css', siteCss())
      zip.file('index.html', indexHtml(pub, site))
      zip.file('search.json', JSON.stringify(searchIndex(pub)))
      // กัน index ของ DirectAdmin แสดงรายชื่อไฟล์ในโฟลเดอร์ assets
      zip.file('assets/index.html', '<!doctype html><title>.</title>')

      let done = 0
      let failed = 0
      for (const a of pub) {
        setBuilding(`${++done}/${pub.length} — ${a.Title.slice(0, 40)}`)
        zip.file(articleFile(a), articleHtml(a, site))
        // เอาเฉพาะไฟล์ที่ถูกอ้างถึงจริงในเนื้อหา — ไฟล์แนบอื่นไม่ต้องขึ้นเว็บสาธารณะ
        const used = new Set(
          [a.Summary, a.Resolution, a.Cause].flatMap(t => referencedFiles(t)).map(x => x.toLowerCase()))
        for (const f of a.AttachmentFiles ?? []) {
          if (!used.has(f.FileName.toLowerCase())) continue
          try {
            const url = await spAttachmentBlobUrl(LIST, a.id, f.FileName)
            const blob = await (await fetch(url)).blob()
            URL.revokeObjectURL(url)
            zip.file(assetPath(a, f.FileName), blob)
          } catch { failed++ }
        }
      }

      setBuilding('บีบอัด...')
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const el = document.createElement('a')
      el.href = url
      el.download = `kb-site-${new Date().toISOString().slice(0, 10)}.zip`
      el.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      addToast('success', failed
        ? `สร้างเว็บแล้ว ${pub.length} บทความ (รูปโหลดไม่ได้ ${failed} ไฟล์)`
        : `สร้างเว็บแล้ว ${pub.length} บทความ`)
    } catch {
      addToast('error', 'สร้างเว็บไม่สำเร็จ')
    } finally { setBuilding('') }
  }

  const filtered = useMemo(() => rows.filter(a => {
    if (onlyPublished && !isPublished(a)) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return [a.Title, a.ArticleCode, a.Product, a.Tags, a.Summary, a.Resolution, a.Cause]
      .some(v => (v ?? '').toLowerCase().includes(q))
  }), [rows, search, onlyPublished])

  const publishedCount = rows.filter(isPublished).length

  // ไฟล์ที่เนื้อหาอ้างถึงแต่ยังไม่ได้แนบ — เตือนตอนเขียน ไม่ใช่ไปเจอตอนขึ้นเว็บ
  const missingFiles = useMemo(() => {
    if (!editing) return []
    const attached = (editing.AttachmentFiles ?? []).map(f => f.FileName.toLowerCase())
    return [...new Set([form.Summary, form.Resolution, form.Cause].flatMap(t => referencedFiles(t)))]
      .filter(n => !attached.includes(n.toLowerCase()))
  }, [editing, form.Summary, form.Resolution, form.Cause])

  const columns: Column<KbArticle>[] = [
    {
      key: 'code', label: 'รหัส', sortValue: a => a.ArticleCode ?? '',
      render: a => <span className="font-mono text-gray-500">{a.ArticleCode || '-'}</span>,
    },
    {
      key: 'title', label: 'ชื่อเรื่อง', sortValue: a => a.Title ?? '',
      render: a => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[360px]">{a.Title}</p>
          {a.Tags && <p className="text-[11px] text-gray-400 truncate max-w-[360px]">{a.Tags}</p>}
        </div>
      ),
    },
    { key: 'product', label: 'ผลิตภัณฑ์', sortValue: a => a.Product ?? '',
      render: a => <span className="text-gray-600 dark:text-gray-300">{a.Product || '-'}</span> },
    {
      key: 'status', label: 'สถานะ', align: 'center', sortValue: a => (isPublished(a) ? 0 : 1),
      render: a => isPublished(a)
        ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">เผยแพร่</Badge>
        : <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">ฉบับร่าง</Badge>,
    },
    { key: 'modified', label: 'แก้ล่าสุด', sortValue: a => a.Modified ?? '',
      render: a => <span className="text-gray-500">{formatDate(a.Modified)}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: a => (
        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
          {canPublish && (
            <button onClick={() => void togglePublish(a)} title={isPublished(a) ? 'เปลี่ยนเป็นฉบับร่าง' : 'ตั้งเป็นเผยแพร่'}
              className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${isPublished(a) ? 'text-green-600' : 'text-gray-400 hover:text-green-600'}`}>
              <Globe size={13} />
            </button>
          )}
          {canEdit && (
            <button onClick={() => openEdit(a)} title="แก้ไข"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
              <Edit2 size={13} />
            </button>
          )}
          {canPublish && (
            <button onClick={() => void remove(a)} title="ลบ"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const noteHint = (
    <p className="text-[11px] text-gray-400 mt-1">
      หัวข้อใหม่ <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">## ชื่อหัวข้อ</code> ·
      รายการย่อย <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">-</code> ·
      วาง URL ได้เลย · แทรกรูป <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">[[ชื่อไฟล์.png]]</code>
    </p>
  )

  return (
    <div>
      <Header title="คลังความรู้ (เผยแพร่)" />
      <div className="p-4 md:p-6 space-y-4">
        {missing ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">ยังไม่มีลิสต์ <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">HD_KBArticles</code></p>
            <p className="text-xs mt-1">ดูคอลัมน์ที่ต้องสร้างในเอกสาร Knowledge-Base-Setup.md</p>
          </div>
        ) : (<>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && <Button onClick={openNew}><Plus size={15} /> เขียนบทความ</Button>}
            <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาบทความ..."
                className="flex-1 bg-transparent text-sm focus:outline-none" />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={onlyPublished} onChange={e => setOnlyPublished(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary-600" />
              เฉพาะที่เผยแพร่
            </label>
            {canPublish && (<>
              <Button variant="secondary" onClick={() => setShowSite(true)}>
                <FileText size={15} /> ตั้งค่าเว็บ
              </Button>
              <Button onClick={() => void buildSite()} disabled={!!building || publishedCount === 0}>
                {building ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {building ? building : `สร้างเว็บ (${publishedCount})`}
              </Button>
            </>)}
          </div>

          {!loading && rows.length > 0 && (
            <p className="text-[11px] text-gray-400">
              แสดง {filtered.length} จาก {rows.length} บทความ · เผยแพร่อยู่ {publishedCount}
            </p>
          )}

          {loading ? (
            <p className="text-center text-sm text-gray-400 py-12">กำลังโหลด...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{rows.length === 0 ? 'ยังไม่มีบทความ' : 'ไม่พบบทความที่ค้นหา'}</p>
            </div>
          ) : (
            <DataTable rows={filtered} columns={columns} rowKey={a => a.id}
              onRowClick={a => canEdit ? openEdit(a) : undefined} emptyText="ไม่พบบทความ" />
          )}
        </>)}
      </div>

      {/* ── เขียน / แก้บทความ ── */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)}
        title={editing ? 'แก้ไขบทความ' : 'เขียนบทความ'} size="xl">
        <form onSubmit={save} className="space-y-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPreview(false)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${!preview ? 'bg-primary-600 text-white' : 'text-gray-500 border border-gray-200 dark:border-gray-700'}`}>
              เขียน
            </button>
            <button type="button" onClick={() => setPreview(true)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1 ${preview ? 'bg-primary-600 text-white' : 'text-gray-500 border border-gray-200 dark:border-gray-700'}`}>
              <Eye size={12} /> ดูตัวอย่าง
            </button>
            <span className="ml-auto text-[11px] text-gray-400">
              {form.ArticleStatus === 'Published' ? '🌐 เผยแพร่' : '📝 ฉบับร่าง'}
            </span>
          </div>

          {preview ? (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{form.Title || '(ยังไม่มีชื่อเรื่อง)'}</h2>
              <p className="text-[11px] text-gray-400">
                {form.ArticleCode} {form.Product && `· ${form.Product}`}
              </p>
              {tagList({ id: 0, Title: '', Tags: form.Tags }).map(t => (
                <Badge key={t} className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 mr-1">{t}</Badge>
              ))}
              {([['อาการ / รายละเอียด', form.Summary], ['วิธีแก้ไข', form.Resolution], ['สาเหตุ', form.Cause]] as const)
                .filter(([, v]) => v.trim()).map(([h, v]) => (
                <div key={h}>
                  <h3 className="text-sm font-semibold border-b border-gray-200 dark:border-gray-700 pb-1 mb-1">{h}</h3>
                  <RichNote text={v} defaultOpenFirst={false}
                    files={editing ? { listName: LIST, itemId: editing.id, names: (editing.AttachmentFiles ?? []).map(f => f.FileName) } : undefined} />
                </div>
              ))}
            </div>
          ) : (<>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-3">
                <label className={labelCx}>ชื่อเรื่อง *</label>
                <input required value={form.Title} onChange={e => set('Title', e.target.value)} className={inputCx}
                  placeholder="เช่น พิมพ์ในช่องค้นหาไม่ได้เมื่อเผยแพร่ Explorer เป็น App" />
              </div>
              <div>
                <label className={labelCx}>รหัสบทความ</label>
                <input value={form.ArticleCode} onChange={e => set('ArticleCode', e.target.value)} className={inputCx + ' font-mono'} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCx}>ผลิตภัณฑ์ / ระบบ</label>
                <input value={form.Product} onChange={e => set('Product', e.target.value)} className={inputCx} placeholder="Citrix VDA" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCx}>แท็ก (คั่นด้วย ,)</label>
                <input value={form.Tags} onChange={e => set('Tags', e.target.value)} className={inputCx} placeholder="Citrix, Explorer, Search" />
              </div>
            </div>

            <div>
              <label className={labelCx}>อาการ / รายละเอียด</label>
              <textarea value={form.Summary} onChange={e => set('Summary', e.target.value)} rows={3} className={inputCx}
                placeholder="อธิบายอาการที่ผู้ใช้เจอ" />
            </div>

            <div>
              <label className={labelCx}>วิธีแก้ไข</label>
              <textarea value={form.Resolution} onChange={e => set('Resolution', e.target.value)} rows={10}
                className={inputCx + ' font-mono text-[13px]'}
                placeholder={['## ตรวจสอบ Windows patch', '- ยืนยันว่า KB5014021 ติดตั้งแล้ว', '- ดูรายละเอียดที่ https://support.microsoft.com/...', '', '## แก้ไข registry', '[[registry.png]]'].join(NL)} />
              {noteHint}
            </div>

            <div>
              <label className={labelCx}>สาเหตุ</label>
              <textarea value={form.Cause} onChange={e => set('Cause', e.target.value)} rows={2} className={inputCx} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCx}>สถานะ</label>
                <select value={form.ArticleStatus} onChange={e => set('ArticleStatus', e.target.value)}
                  className={inputCx} disabled={!canPublish}>
                  <option value="Draft">ฉบับร่าง (ไม่ขึ้นเว็บ)</option>
                  <option value="Published">เผยแพร่</option>
                </select>
                {!canPublish && <p className="text-[11px] text-gray-400 mt-1">ต้องเป็น Supervisor ขึ้นไปจึงจะเผยแพร่ได้</p>}
              </div>
            </div>

            {editing ? (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
                <AttachmentSection listName={LIST} itemId={editing.id} />
                {(editing.AttachmentFiles ?? []).length > 0 && (
                  <div>
                    <p className="text-[11px] text-gray-500 mb-1">แทรกรูปลงเนื้อหา (กดเพื่อเพิ่มท้ายวิธีแก้ไข)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(editing.AttachmentFiles ?? []).map(f => (
                        <button key={f.FileName} type="button"
                          onClick={() => set('Resolution', form.Resolution + (!form.Resolution || form.Resolution.endsWith(NL) ? '' : NL) + '[[' + f.FileName + ']]' + NL)}
                          className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 text-gray-600 dark:text-gray-300">
                          + {f.FileName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {missingFiles.length > 0 && (
                  <p className="text-[11px] text-amber-600">⚠ เนื้อหาอ้างถึงไฟล์ที่ยังไม่ได้แนบ: {missingFiles.join(', ')}</p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">แนบรูปได้หลังบันทึกครั้งแรก (กดแก้ไขอีกครั้ง)</p>
            )}
          </>)}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1 justify-center">
              {saving ? 'กำลังบันทึก...' : editing ? 'บันทึก' : 'สร้างบทความ'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowEdit(false)}>ปิด</Button>
          </div>
        </form>
      </Modal>

      {/* ── ตั้งค่าเว็บที่ export ── */}
      <Modal open={showSite} onClose={() => setShowSite(false)} title="ตั้งค่าเว็บเผยแพร่" size="md">
        <div className="space-y-3">
          {([['siteTitle', 'ชื่อเว็บ'], ['org', 'ชื่อองค์กร'], ['contact', 'อีเมลติดต่อ'], ['homeUrl', 'ลิงก์กลับเว็บบริษัท']] as const).map(([k, label]) => (
            <div key={k}>
              <label className={labelCx}>{label}</label>
              <input value={site[k]} onChange={e => setSite(s => ({ ...s, [k]: e.target.value }))} className={inputCx} />
            </div>
          ))}
          <p className="text-[11px] text-gray-400">
            ค่านี้เก็บในเครื่องของคุณ ไม่ได้เก็บใน SharePoint — คนที่กด "สร้างเว็บ" ควรตั้งให้ตรงกัน
          </p>
          <Button className="w-full justify-center" onClick={() => {
            localStorage.setItem(SITE_KEY, JSON.stringify(site))
            setShowSite(false)
            addToast('success', 'บันทึกการตั้งค่าแล้ว')
          }}>
            <Check size={14} /> บันทึก
          </Button>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 text-[11px] text-gray-500 space-y-1">
            <p className="font-semibold text-gray-600 dark:text-gray-300">วิธีนำขึ้นเว็บ</p>
            <p>1. กด <b>สร้างเว็บ</b> → ได้ไฟล์ zip</p>
            <p>2. แตกไฟล์แล้วอัปโหลดทั้งหมดขึ้น DirectAdmin ที่โฟลเดอร์ <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">public_html/kb/</code></p>
            <p>3. ลิงก์บทความจะเป็น <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">itservices.co.th/kb/its000123.html</code></p>
            <p className="text-amber-600">⚠ ทุกครั้งที่แก้บทความ ต้องกดสร้างเว็บและอัปโหลดใหม่ — เว็บที่เผยแพร่ไม่ได้ต่อกับ SharePoint</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
