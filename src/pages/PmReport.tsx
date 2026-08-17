import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, FileDown, Trash2, ClipboardPaste, Server, ChevronRight, Check,
  AlertTriangle, Upload, Settings2, FileText, Loader2, ChevronUp, ChevronDown, Copy, Pencil, Code2, ListPlus,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Modal } from '../components/common/Modal'
import { spGet, spCreate, spUpdate, spDelete, spUploadAttachment, spDeleteAttachment, spAttachmentBlobUrl, spWaitForItem } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { resizeImageFile } from '../utils/imageFile'
import { formatDate } from '../utils/dateUtils'
import {
  parseTemplate, parseJobData, numberFigures, figuresOf, progressOf,
  slotKey, shotFileName, serializeTemplate, emptyTemplate, newDeviceKey,
  renumberTasks, nextTaskNo, parseTaskLines, parseInventoryLines, moveItem,
  type PmTemplate, type PmJobData, type TaskResult, type InvStatus, type FiguredShot,
} from '../utils/pmReport'

const TPL_LIST = 'PM_ReportTemplates'
const JOB_LIST = 'PM_ReportJobs'
const NLC = String.fromCharCode(10)
const MAX_W = 1600            // ย่อภาพก่อนอัปโหลด — เท่ากับเครื่องมือเดิม

interface TplRow { id: number; Title: string; Structure?: string; IsActive?: boolean }
interface JobRow {
  id: number
  Title: string
  TemplateID?: number
  Customer?: string
  PMDate?: string
  JobStatus?: string
  Data?: string
  Modified?: string
  Author?: { Title: string }
}

const RESULTS: TaskResult[] = ['Pass', 'Fail', 'N/A']
const RESULT_CLS: Record<string, string> = {
  Pass: 'bg-green-600 text-white border-green-600',
  Fail: 'bg-red-500 text-white border-red-500',
  'N/A': 'bg-gray-400 text-white border-gray-400',
}
const RESULT_MARK: Record<string, string> = { Pass: '✅', Fail: '❌', 'N/A': 'N/A' }
const INV: InvStatus[] = ['Normal', 'Attention', 'Fault']

/** รูปหนึ่งภาพในตัวแก้ไข — โหลดผ่าน blob url (ต้องมี bearer token) */
function Shot({ jobId, file, caption, onCaption, onRemove }: {
  jobId: number; file: string; caption: string
  onCaption: (v: string) => void; onRemove: () => void
}) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true; let made = ''
    spAttachmentBlobUrl(JOB_LIST, jobId, file)
      .then(u => { if (alive) { made = u; setUrl(u) } else URL.revokeObjectURL(u) })
      .catch(() => {})
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [jobId, file])
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {url
        ? <img src={url} alt={caption} className="w-full max-h-56 object-contain bg-gray-50 dark:bg-gray-800" />
        : <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 animate-pulse" />}
      <div className="flex items-center gap-1 p-1.5">
        <input value={caption} onChange={e => onCaption(e.target.value)} placeholder="คำบรรยายรูป..."
          className="flex-1 min-w-0 text-xs bg-transparent border-b border-transparent focus:border-primary-500 focus:outline-none px-1 py-0.5" />
        <button onClick={onRemove} title="ลบรูปนี้" className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

/** รูปในหน้าพิมพ์ */
function PrintShot({ jobId, f }: { jobId: number; f: FiguredShot }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let alive = true; let made = ''
    spAttachmentBlobUrl(JOB_LIST, jobId, f.file)
      .then(u => { if (alive) { made = u; setUrl(u) } else URL.revokeObjectURL(u) })
      .catch(() => {})
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
  }, [jobId, f.file])
  return (
    <div className="print-avoid-break" style={{ textAlign: 'center', marginBottom: 14 }}>
      {url && <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '11cm', objectFit: 'contain' }} />}
      <p style={{ fontSize: 10, color: '#444', marginTop: 4 }}>
        Figure {f.figure}: {f.caption || '-'}
      </p>
    </div>
  )
}

export default function PmReport() {
  const { user, addToast } = useAppStore()
  const canManageTpl = ['Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  const [templates, setTemplates] = useState<TplRow[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  const [openJob, setOpenJob] = useState<JobRow | null>(null)
  const [tpl, setTpl] = useState<PmTemplate | null>(null)
  const [data, setData] = useState<PmJobData | null>(null)
  const [activeDevice, setActiveDevice] = useState(0)
  const [armed, setArmed] = useState('')          // slot ที่พร้อมรับ Ctrl+V
  const [busySlot, setBusySlot] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', templateId: '' })
  // ── ตัวสร้าง/แก้ template ──
  const [showTplMgr, setShowTplMgr] = useState(false)
  const [tplEditId, setTplEditId] = useState<number | null>(null)   // null = สร้างใหม่
  const [draft, setDraft] = useState<PmTemplate>(emptyTemplate())
  const [tplMode, setTplMode] = useState<'form' | 'json'>('form')
  const [tplJson, setTplJson] = useState('')
  const [tplErr, setTplErr] = useState('')
  const [openDev, setOpenDev] = useState<number | null>(0)
  const [bulk, setBulk] = useState({ dev: -1, text: '' })          // วางรายการตรวจหลายบรรทัด
  const [bulkInv, setBulkInv] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const dirty = useRef(false)

  function load() {
    setLoading(true)
    Promise.all([
      spGet<TplRow>(TPL_LIST, undefined, 'Id,Title,Structure,IsActive', 'Title asc', 200),
      // ไม่เอา Data มาในรายการ — JSON ของงานหนึ่งหลาย KB คูณจำนวนงานแล้วหนักเปล่า ๆ
      spGet<JobRow>(JOB_LIST, undefined, 'Id,Title,TemplateID,Customer,PMDate,JobStatus,Modified,Author/Title', 'Modified desc', 300, 'Author'),
    ]).then(([t, j]) => { setTemplates(t); setJobs(j); setMissing(false) })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // ── เปิดงานขึ้นมาแก้ ──
  async function openEditor(job: JobRow) {
    const row = templates.find(t => t.id === job.TemplateID)
    if (!row?.Structure) { addToast('error', 'ไม่พบ template ของงานนี้'); return }
    let parsed: PmTemplate
    try {
      parsed = parseTemplate(row.Structure)
    } catch (e) {
      addToast('error', `template ใช้ไม่ได้: ${(e as Error).message}`)
      return
    }
    // โหลด Data ของงานนี้ตอนเปิด (รายการไม่ได้ดึงมา)
    let raw = job.Data
    if (raw === undefined) {
      try {
        const rows = await spGet<JobRow>(JOB_LIST, `Id eq ${job.id}`, 'Id,Data', undefined, 1)
        raw = rows[0]?.Data ?? ''
      } catch {
        addToast('error', 'โหลดข้อมูลงานไม่สำเร็จ')
        return
      }
    }
    setTpl(parsed)
    setData(parseJobData(raw, parsed))
    setOpenJob({ ...job, Data: raw })
    setActiveDevice(0)
    setArmed('')
    setSaveState('idle')
    dirty.current = false
  }

  const patch = (fn: (d: PmJobData) => PmJobData) => {
    setData(prev => (prev ? fn(structuredClone(prev)) : prev))
    dirty.current = true
    setSaveState('idle')
  }

  // บันทึกอัตโนมัติ — งานยาวเป็นชั่วโมง ปล่อยให้พึ่งการกดปุ่มอย่างเดียวเสี่ยงเกินไป
  useEffect(() => {
    if (!openJob || !data) return
    const t = setTimeout(() => { if (dirty.current) void save(false) }, 4000)
    return () => clearTimeout(t)
  }, [data, openJob])   // eslint-disable-line react-hooks/exhaustive-deps

  async function save(explicit = true) {
    if (!openJob || !data) return
    setSaveState('saving')
    try {
      await spUpdate(JOB_LIST, openJob.id, {
        Data: JSON.stringify(data),
        Customer: data.meta.customer || undefined,
        PMDate: data.meta.pm_date || undefined,
      })
      dirty.current = false
      setSaveState('saved')
      if (explicit) addToast('success', 'บันทึกแล้ว')
      setJobs(prev => prev.map(j => j.id === openJob.id
        ? { ...j, Data: JSON.stringify(data), Customer: data.meta.customer, PMDate: data.meta.pm_date }
        : j))
    } catch {
      setSaveState('idle')
      addToast('error', 'บันทึกไม่สำเร็จ — ลองกดบันทึกอีกครั้ง')
    }
  }

  // ── รับรูป: Ctrl+V / ลากวาง / เลือกไฟล์ ──
  async function addShots(slot: string, files: File[]) {
    if (!openJob || !slot || files.length === 0) return
    setBusySlot(slot)
    const [deviceKey, taskNo] = slot.split('/')
    let added = 0
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue
        const seq = ((data?.shots[slot] ?? []).length) + added + 1
        const name = shotFileName(deviceKey, taskNo, seq)
        const small = await resizeImageFile(f, MAX_W, name)
        // อัปโหลดทันทีทีละภาพ — ถ้าเบราว์เซอร์ปิดกลางทาง ภาพที่ขึ้นไปแล้วไม่หาย
        const stored = await spUploadAttachment(JOB_LIST, openJob.id, small)
        patch(d => {
          d.shots[slot] = [...(d.shots[slot] ?? []), { file: stored || name, caption: '' }]
          return d
        })
        added += 1
      }
      if (added) { addToast('success', `เพิ่ม ${added} รูป`); void save(false) }
      else addToast('error', 'ไม่พบไฟล์รูปในสิ่งที่วางมา')
    } catch {
      addToast('error', 'อัปโหลดรูปไม่สำเร็จ')
    } finally { setBusySlot('') }
  }

  // Ctrl+V ทำงานเฉพาะเมื่อ "ติดอาวุธ" ช่องไว้แล้ว — กันวางรูปผิดช่องโดยไม่รู้ตัว
  useEffect(() => {
    if (!armed || !openJob) return
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? [])
      const imgs = files.filter(f => f.type.startsWith('image/'))
      if (imgs.length === 0) return
      e.preventDefault()
      void addShots(armed, imgs)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [armed, openJob, data])   // eslint-disable-line react-hooks/exhaustive-deps

  async function removeShot(slot: string, file: string) {
    if (!openJob) return
    patch(d => { d.shots[slot] = (d.shots[slot] ?? []).filter(s => s.file !== file); return d })
    try { await spDeleteAttachment(JOB_LIST, openJob.id, file) } catch { /* ไฟล์อาจถูกลบไปแล้ว */ }
    void save(false)
  }

  // ── งานใหม่ ──
  async function createJob(e: React.FormEvent) {
    e.preventDefault()
    const t = templates.find(x => x.id === Number(newForm.templateId))
    if (!t || !newForm.title.trim()) return
    try {
      const res = await spCreate(JOB_LIST, {
        Title: newForm.title.trim(),
        TemplateID: t.id,
        JobStatus: 'Draft',
        Data: '',
      })
      await spWaitForItem(JOB_LIST, res.id)
      const job: JobRow = { id: res.id, Title: newForm.title.trim(), TemplateID: t.id, JobStatus: 'Draft', Data: '' }
      setJobs(prev => [job, ...prev])
      setShowNew(false)
      setNewForm({ title: '', templateId: '' })
      void openEditor(job)
    } catch { addToast('error', 'สร้างงานไม่สำเร็จ') }
  }

  async function deleteJob(job: JobRow) {
    if (!window.confirm(`ลบงาน "${job.Title}" และรูปทั้งหมดในงานนี้?`)) return
    try {
      await spDelete(JOB_LIST, job.id)
      setJobs(prev => prev.filter(j => j.id !== job.id))
      if (openJob?.id === job.id) { setOpenJob(null); setTpl(null); setData(null) }
      addToast('success', 'ลบแล้ว')
    } catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  // ── ตัวสร้าง/แก้ template ──
  function openTplNew() {
    setTplEditId(null); setDraft(emptyTemplate()); setTplMode('form')
    setTplJson(''); setTplErr(''); setOpenDev(0); setBulk({ dev: -1, text: '' }); setBulkInv('')
    setShowTplMgr(true)
  }

  function openTplEdit(row: TplRow) {
    try {
      const t = parseTemplate(row.Structure ?? '')
      setTplEditId(row.id); setDraft(t); setTplMode('form')
      setTplJson(row.Structure ?? ''); setTplErr(''); setOpenDev(0)
      setBulk({ dev: -1, text: '' }); setBulkInv('')
      setShowTplMgr(true)
    } catch (e) { addToast('error', `เปิดไม่ได้: ${(e as Error).message}`) }
  }

  function openTplCopy(row: TplRow) {
    try {
      const t = parseTemplate(row.Structure ?? '')
      // ทำสำเนาเป็น "ของใหม่" — ลูกค้ารายใหม่มักใช้โครงเดิมแล้วแก้ชื่ออุปกรณ์
      setTplEditId(null)
      setDraft({ ...t, title: `${t.title} (สำเนา)` })
      setTplMode('form'); setTplErr(''); setOpenDev(0)
      setBulk({ dev: -1, text: '' }); setBulkInv('')
      setShowTplMgr(true)
    } catch (e) { addToast('error', `คัดลอกไม่ได้: ${(e as Error).message}`) }
  }

  const dr = (fn: (t: PmTemplate) => PmTemplate) => setDraft(prev => fn(structuredClone(prev)))

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault()
    setTplErr('')
    // โหมด JSON: อ่านจากช่องข้อความ · โหมดฟอร์ม: ประกอบจาก draft
    let json: string, parsed: PmTemplate
    try {
      if (tplMode === 'json') { parsed = parseTemplate(tplJson); json = tplJson }
      else { parsed = parseTemplate(serializeTemplate(draft)); json = serializeTemplate(draft) }
    } catch (e2) { setTplErr((e2 as Error).message); return }

    const title = (tplMode === 'json' ? parsed.title : draft.title).trim() || parsed.title
    try {
      if (tplEditId) {
        await spUpdate(TPL_LIST, tplEditId, { Title: title, Structure: json })
        addToast('success', 'บันทึก template แล้ว')
      } else {
        await spCreate(TPL_LIST, { Title: title, Structure: json, IsActive: true })
        addToast('success', `เพิ่ม template แล้ว (${parsed.devices.length} อุปกรณ์)`)
      }
      setShowTplMgr(false)
      load()
    } catch { setTplErr('บันทึกไม่สำเร็จ') }
  }

  async function deleteTemplate(row: TplRow) {
    const used = jobs.filter(j => j.TemplateID === row.id).length
    const warn = used ? `

มีงานที่ใช้ template นี้อยู่ ${used} งาน — งานเหล่านั้นจะเปิดไม่ได้` : ''
    if (!window.confirm(`ลบ template "${row.Title}"?${warn}`)) return
    try {
      await spDelete(TPL_LIST, row.id)
      setTemplates(prev => prev.filter(t => t.id !== row.id))
      addToast('success', 'ลบแล้ว')
    } catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  /** สลับโหมด — ต้องพา draft ไป-กลับให้ตรงกัน ไม่ให้ที่พิมพ์ไว้หาย */
  function switchMode(to: 'form' | 'json') {
    setTplErr('')
    if (to === 'json') { setTplJson(serializeTemplate(draft)); setTplMode('json'); return }
    try { setDraft(parseTemplate(tplJson)); setTplMode('form') }
    catch (e) { setTplErr(`กลับไปโหมดฟอร์มไม่ได้: ${(e as Error).message}`) }
  }

  function exportPdf() {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    if (wasDark) root.classList.remove('dark')
    const restore = () => { if (wasDark) root.classList.add('dark'); window.removeEventListener('afterprint', restore) }
    window.addEventListener('afterprint', restore)
    setTimeout(restore, 60_000)
    window.print()
  }

  const figures = useMemo(() => (tpl && data ? numberFigures(tpl, data) : []), [tpl, data])
  const prog = useMemo(() => (tpl && data ? progressOf(tpl, data) : null), [tpl, data])

  const inputCx = 'w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCx = 'block text-[11px] font-medium text-gray-500 mb-0.5'

  // ══════════════════ รายการงาน ══════════════════
  if (!openJob || !tpl || !data) {
    return (
      <div>
        <Header title="รายงาน PM" />
        <div className="p-4 md:p-6 space-y-4">
          {missing ? (
            <div className="text-center py-16 text-gray-400">
              <FileText size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">ยังไม่มีลิสต์ <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">PM_ReportTemplates</code> / <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">PM_ReportJobs</code></p>
              <p className="text-xs mt-1">ดูคอลัมน์ที่ต้องสร้างในเอกสาร PM-Report-Setup.md</p>
            </div>
          ) : (<>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setShowNew(true)} disabled={templates.length === 0}>
                <Plus size={15} /> เริ่มรายงานใหม่
              </Button>
              {canManageTpl && (
                <Button variant="secondary" onClick={openTplNew}>
                  <Settings2 size={15} /> สร้าง Template
                </Button>
              )}
              <p className="text-xs text-gray-400">
                {templates.length === 0
                  ? 'ยังไม่มี template — กด "สร้าง Template" เพื่อร่างโครงรายงาน'
                  : `${templates.length} template · ${jobs.length} งาน`}
              </p>
            </div>

            {loading ? (
              <p className="text-center text-sm text-gray-400 py-12">กำลังโหลด...</p>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FileText size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">ยังไม่มีรายงาน</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {jobs.map(j => (
                  <Card key={j.id} className="!p-3">
                    <div className="flex items-start gap-2">
                      <button onClick={() => void openEditor(j)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{j.Title}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {j.Customer || 'ยังไม่ระบุลูกค้า'}{j.PMDate ? ` · ${j.PMDate}` : ''}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {templates.find(t => t.id === j.TemplateID)?.Title ?? `template #${j.TemplateID}`}
                          {j.Modified ? ` · แก้ล่าสุด ${formatDate(j.Modified)}` : ''}
                        </p>
                      </button>
                      <button onClick={() => deleteJob(j)} title="ลบงาน"
                        className="p-1 rounded text-gray-300 hover:text-red-500 flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <Button size="sm" variant="secondary" className="w-full justify-center mt-2" onClick={() => void openEditor(j)}>
                      เปิดทำงาน <ChevronRight size={13} />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </>)}
        </div>

        {/* ── รายการ template ── */}
        {canManageTpl && templates.length > 0 && !missing && (
          <Card>
            <h3 className="text-sm font-semibold mb-2">Template ({templates.length})</h3>
            <div className="space-y-1">
              {templates.map(t => {
                let info: string
                try {
                  const p = parseTemplate(t.Structure ?? '')
                  info = `${p.devices.length} อุปกรณ์ · ${p.devices.reduce((n, d) => n + d.tasks.length, 0)} รายการตรวจ`
                } catch { info = '⚠ โครงมีปัญหา' }
                const used = jobs.filter(j => j.TemplateID === t.id).length
                return (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{t.Title}</p>
                      <p className="text-[11px] text-gray-400">{info}{used ? ` · ใช้อยู่ ${used} งาน` : ''}</p>
                    </div>
                    <button onClick={() => openTplEdit(t)} title="แก้ไข"
                      className="p-1 rounded text-gray-400 hover:text-primary-600"><Pencil size={13} /></button>
                    <button onClick={() => openTplCopy(t)} title="ทำสำเนา (สำหรับลูกค้ารายใหม่)"
                      className="p-1 rounded text-gray-400 hover:text-primary-600"><Copy size={13} /></button>
                    <button onClick={() => deleteTemplate(t)} title="ลบ"
                      className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* งานใหม่ */}
        <Modal open={showNew} onClose={() => setShowNew(false)} title="เริ่มรายงานใหม่" size="md">
          <form onSubmit={createJob} className="space-y-3">
            <div>
              <label className={labelCx}>ชื่องาน *</label>
              <input required value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
                className={inputCx} placeholder="เช่น PM ไตรมาส 3/2026 — บริษัท ก" />
            </div>
            <div>
              <label className={labelCx}>Template *</label>
              <select required value={newForm.templateId} onChange={e => setNewForm(f => ({ ...f, templateId: e.target.value }))} className={inputCx}>
                <option value="">-- เลือก template --</option>
                {templates.filter(t => t.IsActive !== false).map(t => <option key={t.id} value={String(t.id)}>{t.Title}</option>)}
              </select>
            </div>
            <Button type="submit" className="w-full justify-center">สร้างและเริ่มทำงาน</Button>
          </form>
        </Modal>

        {/* ══════ ตัวสร้าง / แก้ template ══════ */}
        <Modal open={showTplMgr} onClose={() => setShowTplMgr(false)}
          title={tplEditId ? 'แก้ไข Template' : 'สร้าง Template'} size="xl">
          <form onSubmit={saveTemplate} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs">
                <button type="button" onClick={() => switchMode('form')}
                  className={`px-3 py-1.5 font-medium ${tplMode === 'form' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>
                  กรอกฟอร์ม
                </button>
                <button type="button" onClick={() => switchMode('json')}
                  className={`px-3 py-1.5 font-medium inline-flex items-center gap-1 ${tplMode === 'json' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>
                  <Code2 size={12} /> JSON
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                {tplMode === 'form' ? 'กรอกทีละช่อง ไม่ต้องเขียน JSON' : 'วางไฟล์ config เดิมได้ตรง ๆ'}
              </p>
            </div>

            {tplMode === 'json' ? (
              <textarea required value={tplJson} onChange={e => { setTplJson(e.target.value); setTplErr('') }}
                rows={16} className={inputCx + ' font-mono text-[12px]'} placeholder={'{ "devices": [ ... ] }'} />
            ) : (<>
              <div>
                <label className={labelCx}>ชื่อรายงาน / Template *</label>
                <input required value={draft.title} onChange={e => dr(t => { t.title = e.target.value; return t })}
                  className={inputCx} placeholder="เช่น Preventive Maintenance — บริษัท ก" />
              </div>

              {/* ── อุปกรณ์ + รายการตรวจ ── */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold">อุปกรณ์ ({draft.devices.length})</p>
                  <Button type="button" size="sm" variant="secondary" className="ml-auto"
                    onClick={() => dr(t => { t.devices.push({ key: newDeviceKey(t.devices), name: '', tasks: [] }); return t })}>
                    <Plus size={13} /> เพิ่มอุปกรณ์
                  </Button>
                </div>

                {draft.devices.length === 0 && (
                  <p className="text-xs text-gray-400 py-3 text-center">ยังไม่มีอุปกรณ์ — กด "เพิ่มอุปกรณ์"</p>
                )}

                <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                  {draft.devices.map((d, di) => (
                    <div key={d.key} className="border border-gray-100 dark:border-gray-800 rounded-lg">
                      <div className="flex items-center gap-1 p-1.5">
                        <button type="button" onClick={() => setOpenDev(openDev === di ? null : di)}
                          className="p-1 text-gray-400 hover:text-primary-600">
                          <ChevronRight size={13} className={`transition-transform ${openDev === di ? 'rotate-90' : ''}`} />
                        </button>
                        <input value={d.name} onChange={e => dr(t => { t.devices[di].name = e.target.value; return t })}
                          placeholder={`ชื่ออุปกรณ์ ${di + 1} — เช่น HPE DL380 Gen10 (SGH123W04V)`}
                          className="flex-1 min-w-0 text-sm bg-transparent border-b border-transparent focus:border-primary-500 focus:outline-none px-1 py-0.5" />
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{d.tasks.length} รายการ</span>
                        <button type="button" onClick={() => dr(t => { t.devices = moveItem(t.devices, di, -1); return t })}
                          title="ขึ้น" className="p-0.5 text-gray-300 hover:text-primary-600"><ChevronUp size={13} /></button>
                        <button type="button" onClick={() => dr(t => { t.devices = moveItem(t.devices, di, 1); return t })}
                          title="ลง" className="p-0.5 text-gray-300 hover:text-primary-600"><ChevronDown size={13} /></button>
                        <button type="button"
                          onClick={() => { if (window.confirm(`ลบอุปกรณ์ "${d.name || di + 1}" และรายการตรวจทั้งหมด?`)) dr(t => { t.devices.splice(di, 1); return t }) }}
                          title="ลบอุปกรณ์" className="p-0.5 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>

                      {openDev === di && (
                        <div className="px-2 pb-2 space-y-1">
                          {d.tasks.map((task, ti) => (
                            <div key={ti} className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400 w-6 text-right">{task.no}</span>
                              <input value={task.name}
                                onChange={e => dr(t => { t.devices[di].tasks[ti].name = e.target.value; return t })}
                                placeholder={`รายการตรวจที่ ${ti + 1}`}
                                className="flex-1 min-w-0 text-xs bg-transparent border-b border-gray-100 dark:border-gray-800 focus:border-primary-500 focus:outline-none px-1 py-0.5" />
                              <button type="button" onClick={() => dr(t => { t.devices[di].tasks = renumberTasks(moveItem(t.devices[di].tasks, ti, -1)); return t })}
                                className="p-0.5 text-gray-300 hover:text-primary-600"><ChevronUp size={12} /></button>
                              <button type="button" onClick={() => dr(t => { t.devices[di].tasks = renumberTasks(moveItem(t.devices[di].tasks, ti, 1)); return t })}
                                className="p-0.5 text-gray-300 hover:text-primary-600"><ChevronDown size={12} /></button>
                              <button type="button" onClick={() => dr(t => { t.devices[di].tasks.splice(ti, 1); t.devices[di].tasks = renumberTasks(t.devices[di].tasks); return t })}
                                className="p-0.5 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                            </div>
                          ))}

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <button type="button"
                              onClick={() => dr(t => { t.devices[di].tasks.push({ no: nextTaskNo(t.devices[di].tasks), name: '' }); return t })}
                              className="text-[11px] text-primary-600 hover:underline inline-flex items-center gap-1">
                              <Plus size={11} /> เพิ่มรายการตรวจ
                            </button>
                            <button type="button" onClick={() => setBulk({ dev: bulk.dev === di ? -1 : di, text: '' })}
                              className="text-[11px] text-gray-500 hover:text-primary-600 inline-flex items-center gap-1">
                              <ListPlus size={11} /> วางหลายรายการ
                            </button>
                            {di > 0 && (
                              <button type="button"
                                onClick={() => dr(t => { t.devices[di].tasks = t.devices[di - 1].tasks.map(x => ({ ...x })); return t })}
                                className="text-[11px] text-gray-500 hover:text-primary-600">
                                คัดลอกรายการจากอุปกรณ์ก่อนหน้า
                              </button>
                            )}
                          </div>

                          {bulk.dev === di && (
                            <div className="pt-1">
                              <textarea value={bulk.text} onChange={e => setBulk({ dev: di, text: e.target.value })}
                                rows={4} className={inputCx + ' text-xs'}
                                placeholder={['วางรายการตรวจ บรรทัดละ 1 รายการ', 'Checking event logs', 'Checking LED/LCD displays'].join(NLC)} />
                              <div className="flex gap-2 mt-1">
                                <Button type="button" size="sm"
                                  onClick={() => {
                                    const add = parseTaskLines(bulk.text)
                                    if (!add.length) return
                                    dr(t => { t.devices[di].tasks = renumberTasks([...t.devices[di].tasks, ...add]); return t })
                                    setBulk({ dev: -1, text: '' })
                                  }}>
                                  เพิ่ม {parseTaskLines(bulk.text).length} รายการ
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setBulk({ dev: -1, text: '' })}>ยกเลิก</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Inventory ── */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold">ตาราง Inventory ({draft.inventory.length})</p>
                  <span className="text-[11px] text-gray-400">ไม่ใส่ก็ได้</span>
                  <Button type="button" size="sm" variant="secondary" className="ml-auto"
                    onClick={() => dr(t => { t.inventory.push({ no: String(t.inventory.length + 1).padStart(2, '0'), serial: '', role: '' }); return t })}>
                    <Plus size={13} /> เพิ่มแถว
                  </Button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {draft.inventory.map((r, ri) => (
                    <div key={ri} className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-400 w-6 text-right">{r.no}</span>
                      <input value={r.serial} onChange={e => dr(t => { t.inventory[ri].serial = e.target.value; return t })}
                        placeholder="Serial" className="w-32 text-xs bg-transparent border-b border-gray-100 dark:border-gray-800 focus:border-primary-500 focus:outline-none px-1 py-0.5" />
                      <input value={r.role} onChange={e => dr(t => { t.inventory[ri].role = e.target.value; return t })}
                        placeholder="Role / รุ่น" className="flex-1 min-w-0 text-xs bg-transparent border-b border-gray-100 dark:border-gray-800 focus:border-primary-500 focus:outline-none px-1 py-0.5" />
                      <button type="button" onClick={() => dr(t => {
                        t.inventory.splice(ri, 1)
                        t.inventory = t.inventory.map((x, i) => ({ ...x, no: String(i + 1).padStart(2, '0') }))
                        return t
                      })} className="p-0.5 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <details className="mt-1">
                  <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-primary-600">วางหลายแถว (serial, role)</summary>
                  <textarea value={bulkInv} onChange={e => setBulkInv(e.target.value)} rows={3}
                    className={inputCx + ' text-xs mt-1'}
                    placeholder={['SGH123W04V, HPE DL380 Gen10 (VMware ESX)', 'EZL1913S05R, HPE SN3600B (SAN Switch)'].join(NLC)} />
                  <Button type="button" size="sm" className="mt-1"
                    onClick={() => {
                      const add = parseInventoryLines(bulkInv, draft.inventory.length + 1)
                      if (!add.length) return
                      dr(t => { t.inventory = [...t.inventory, ...add]; return t })
                      setBulkInv('')
                    }}>
                    เพิ่ม {parseInventoryLines(bulkInv).length} แถว
                  </Button>
                </details>
              </div>

              {/* ── Version history ── */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-semibold">Version History ({draft.versionHistory.length})</p>
                  <Button type="button" size="sm" variant="secondary" className="ml-auto"
                    onClick={() => dr(t => { t.versionHistory.push({ version: '', date: '', change: '', author: '' }); return t })}>
                    <Plus size={13} /> เพิ่มแถว
                  </Button>
                </div>
                <div className="space-y-1">
                  {draft.versionHistory.map((v, vi) => (
                    <div key={vi} className="flex items-center gap-1">
                      {(['version', 'date', 'change', 'author'] as const).map(f => (
                        <input key={f} value={v[f]} onChange={e => dr(t => { t.versionHistory[vi][f] = e.target.value; return t })}
                          placeholder={f} className={`${f === 'change' ? 'flex-1 min-w-0' : 'w-24'} text-xs bg-transparent border-b border-gray-100 dark:border-gray-800 focus:border-primary-500 focus:outline-none px-1 py-0.5`} />
                      ))}
                      <button type="button" onClick={() => dr(t => { t.versionHistory.splice(vi, 1); return t })}
                        className="p-0.5 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </>)}

            {tplErr && <p className="text-xs text-red-500">⚠ {tplErr}</p>}

            {tplMode === 'form' && draft.devices.length > 0 && (
              <p className="text-xs text-emerald-600">
                ✓ {draft.devices.length} อุปกรณ์ · {draft.devices.reduce((n, d) => n + d.tasks.length, 0)} รายการตรวจ · inventory {draft.inventory.length} แถว
              </p>
            )}
            {tplEditId && (
              <p className="text-[11px] text-amber-600">
                ⚠ ลบหรือสลับลำดับรายการตรวจของ template ที่มีงานทำอยู่แล้ว จะทำให้รูปและผลของงานเก่าหาที่อยู่ไม่เจอ —
                ถ้าจะรื้อโครงใหญ่ ให้กด "ทำสำเนา" แล้วแก้ในสำเนาแทน
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 justify-center"
                disabled={tplMode === 'form' && draft.devices.length === 0}>
                {tplEditId ? 'บันทึกการแก้ไข' : 'สร้าง Template'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowTplMgr(false)}>ยกเลิก</Button>
            </div>
          </form>
        </Modal>
      </div>
    )
  }

  // ══════════════════ ตัวแก้ไขงาน ══════════════════
  const dev = tpl.devices[activeDevice]

  return (
    <div>
      <Header title={openJob.Title} />

      {/* ── แถบเครื่องมือ ── */}
      <div className="no-print p-4 md:p-6 pb-0 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => { if (dirty.current) void save(false); setOpenJob(null); setTpl(null); setData(null) }}>
          ← กลับรายการ
        </Button>
        <Button size="sm" onClick={() => save(true)} disabled={saveState === 'saving'}>
          {saveState === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} บันทึก
        </Button>
        <Button size="sm" variant="secondary" onClick={exportPdf}>
          <FileDown size={14} /> พิมพ์ / บันทึก PDF
        </Button>
        <span className="text-[11px] text-gray-400">
          {saveState === 'saving' ? 'กำลังบันทึก...' : saveState === 'saved' ? 'บันทึกแล้ว' : dirty.current ? 'ยังไม่บันทึก' : ''}
        </span>
        {prog && (
          <span className="ml-auto text-[11px] text-gray-500">
            ติ๊กผล {prog.answered}/{prog.tasks} · รูป {prog.shots}
          </span>
        )}
      </div>

      {/* ── ตรวจก่อนพิมพ์ ── */}
      {prog && (prog.metaMissing.length > 0 || prog.devicesNoShot.length > 0 || prog.answered < prog.tasks || prog.invBlank > 0) && (
        <div className="no-print px-4 md:px-6 pt-3">
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 dark:text-amber-300 space-y-0.5">
              <p className="font-semibold">ยังไม่ครบ (พิมพ์ได้ แต่เช็คก่อน)</p>
              {prog.metaMissing.length > 0 && <p>• หัวรายงานยังว่าง: {prog.metaMissing.join(', ')}</p>}
              {prog.answered < prog.tasks && <p>• ยังไม่ติ๊กผล {prog.tasks - prog.answered} รายการ</p>}
              {prog.devicesNoShot.length > 0 && <p>• ยังไม่มีรูป: {prog.devicesNoShot.join(' · ')}</p>}
              {prog.invBlank > 0 && <p>• ตาราง Inventory ยังไม่เลือกสถานะ {prog.invBlank} แถว</p>}
              {prog.devicesNoRec.length > 0 && <p>• ยังไม่เขียนข้อเสนอแนะ: {prog.devicesNoRec.length} อุปกรณ์</p>}
            </div>
          </div>
        </div>
      )}

      <div className="no-print p-4 md:p-6 space-y-4">
        {/* ── หัวรายงาน ── */}
        <Card>
          <h3 className="text-sm font-semibold mb-3">ข้อมูลรายงาน</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {([['customer', 'ลูกค้า'], ['site', 'สถานที่'], ['pm_date', 'วันที่ PM'], ['engineer', 'วิศวกร'], ['so_number', 'เลข SO']] as const).map(([k, label]) => (
              <div key={k}>
                <label className={labelCx}>{label}</label>
                <input value={data.meta[k]} onChange={e => patch(d => { d.meta[k] = e.target.value; return d })} className={inputCx} />
              </div>
            ))}
          </div>
        </Card>

        {/* ── Inventory ── */}
        {tpl.inventory.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold mb-3">สถานะอุปกรณ์ (Inventory)</h3>
            <div className="space-y-1.5">
              {tpl.inventory.map(r => (
                <div key={r.serial + r.no} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-gray-400 w-7">{r.no}</span>
                  <span className="font-mono text-gray-600 dark:text-gray-300 w-32 truncate">{r.serial}</span>
                  <span className="flex-1 min-w-[140px] text-gray-600 dark:text-gray-300 truncate">{r.role}</span>
                  <div className="flex gap-1">
                    {INV.filter(Boolean).map(s => (
                      <button key={s} onClick={() => patch(d => { d.invStatus[r.serial] = d.invStatus[r.serial] === s ? '' : s as InvStatus; return d })}
                        className={`px-2 py-0.5 rounded-full border text-[11px] transition-colors ${
                          data.invStatus[r.serial] === s
                            ? s === 'Normal' ? 'bg-green-600 text-white border-green-600'
                              : s === 'Attention' ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-red-500 text-white border-red-500'
                            : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── อุปกรณ์ + รายการตรวจ ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          {/* รายชื่ออุปกรณ์ */}
          <Card className="!p-2 lg:sticky lg:top-4">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 px-2 py-1">อุปกรณ์ ({tpl.devices.length})</p>
            <div className="max-h-[60vh] overflow-y-auto space-y-0.5">
              {tpl.devices.map((d, i) => {
                const shots = d.tasks.reduce((n, t) => n + (data.shots[slotKey(d.key, t.no)] ?? []).length, 0)
                const done = d.tasks.filter(t => data.results[slotKey(d.key, t.no)]).length
                return (
                  <button key={d.key} onClick={() => { setActiveDevice(i); setArmed('') }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      i === activeDevice ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
                    <span className="flex items-center gap-1.5">
                      <Server size={11} className="flex-shrink-0" />
                      <span className="truncate flex-1">{d.name}</span>
                    </span>
                    <span className="text-[10px] text-gray-400 pl-4">
                      ติ๊ก {done}/{d.tasks.length} · รูป {shots}
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* รายการตรวจของอุปกรณ์ที่เลือก */}
          <div className="lg:col-span-3 space-y-3">
            <Card>
              <p className="text-sm font-semibold mb-1">{dev.name}</p>
              <p className="text-[11px] text-gray-400 mb-3">
                กดที่กรอบรูปเพื่อเลือกช่อง (กรอบเป็นสีน้ำเงิน) แล้วกด <b>Ctrl+V</b> วางภาพที่แคปมา · ลากไฟล์มาวางก็ได้
              </p>

              <div className="space-y-3">
                {dev.tasks.map(task => {
                  const k = slotKey(dev.key, task.no)
                  const shots = data.shots[k] ?? []
                  const isArmed = armed === k
                  return (
                    <div key={k} className="border-t border-gray-100 dark:border-gray-800 pt-3 first:border-0 first:pt-0">
                      <div className="flex flex-wrap items-start gap-2">
                        <span className="text-[11px] text-gray-400 w-6 pt-1">{task.no}</span>
                        <p className="flex-1 min-w-[180px] text-sm text-gray-800 dark:text-gray-200">{task.name}</p>
                        <div className="flex gap-1">
                          {RESULTS.map(r => (
                            <button key={r} onClick={() => patch(d => { d.results[k] = d.results[k] === r ? '' : r; return d })}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                data.results[k] === r ? RESULT_CLS[r] : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* ช่องวางรูป */}
                      <div
                        onClick={() => setArmed(isArmed ? '' : k)}
                        onDragOver={e => { e.preventDefault(); setArmed(k) }}
                        onDrop={e => { e.preventDefault(); void addShots(k, Array.from(e.dataTransfer.files)) }}
                        className={`mt-2 rounded-xl border-2 border-dashed p-2 transition-colors cursor-pointer ${
                          isArmed ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 px-1">
                          <ClipboardPaste size={12} />
                          {busySlot === k ? 'กำลังอัปโหลด...' : isArmed ? 'พร้อมรับ — กด Ctrl+V เดี๋ยวนี้' : `กดเพื่อเลือกช่องนี้ (${shots.length} รูป)`}
                          <button onClick={e => { e.stopPropagation(); setArmed(k); fileRef.current?.click() }}
                            className="ml-auto inline-flex items-center gap-1 text-primary-600 hover:underline">
                            <Upload size={11} /> เลือกไฟล์
                          </button>
                        </div>
                        {shots.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 mt-2" onClick={e => e.stopPropagation()}>
                            {shots.map(s => (
                              <Shot key={s.file} jobId={openJob.id} file={s.file} caption={s.caption}
                                onCaption={v => patch(d => {
                                  d.shots[k] = (d.shots[k] ?? []).map(x => x.file === s.file ? { ...x, caption: v } : x)
                                  return d
                                })}
                                onRemove={() => void removeShot(k, s.file)} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            <Card>
              <label className={labelCx}>Recommendations and Action plans — {dev.name}</label>
              <textarea value={data.recommendations[dev.key] ?? ''}
                onChange={e => patch(d => { d.recommendations[dev.key] = e.target.value; return d })}
                rows={4} className={inputCx} placeholder="ขึ้นบรรทัดใหม่ = 1 bullet" />
            </Card>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { const fs = Array.from(e.target.files ?? []); if (armed) void addShots(armed, fs); e.target.value = '' }} />
      </div>

      {/* ══════════ หน้าพิมพ์ ══════════ */}
      <div className="print-only" style={{ color: '#111', fontSize: 12 }}>
        {/* ปก */}
        <div style={{ textAlign: 'center', paddingTop: '3cm' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{tpl.title}</h1>
          <p style={{ fontSize: 14, marginTop: 10 }}>{data.meta.customer || '-'}</p>
          <p style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{data.meta.site}</p>
          <table style={{ margin: '1.5cm auto 0', fontSize: 11, borderCollapse: 'collapse' }}>
            <tbody>
              {([['วันที่ PM', data.meta.pm_date], ['วิศวกร', data.meta.engineer], ['เลข SO', data.meta.so_number]] as const)
                .filter(([, v]) => v).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: '3px 12px', color: '#555', textAlign: 'right' }}>{k}</td>
                  <td style={{ padding: '3px 12px', fontWeight: 600 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Version history */}
        {data.versionHistory.length > 0 && (
          <div className="print-break-before">
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Version History</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>{['Version', 'Date', 'Change', 'Author'].map(h => (
                  <th key={h} style={{ border: '1px solid #999', padding: 4, background: '#eee', textAlign: 'left' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {data.versionHistory.map((v, i) => (
                  <tr key={i}>
                    {[v.version, v.date, v.change, v.author].map((c, j) => (
                      <td key={j} style={{ border: '1px solid #999', padding: 4 }}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Inventory */}
        {tpl.inventory.length > 0 && (
          <div className="print-break-before">
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Inventory</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>{['No.', 'Serial', 'Role', 'Report Status'].map(h => (
                  <th key={h} style={{ border: '1px solid #999', padding: 4, background: '#eee', textAlign: 'left' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {tpl.inventory.map(r => (
                  <tr key={r.no + r.serial}>
                    <td style={{ border: '1px solid #999', padding: 4 }}>{r.no}</td>
                    <td style={{ border: '1px solid #999', padding: 4 }}>{r.serial}</td>
                    <td style={{ border: '1px solid #999', padding: 4 }}>{r.role}</td>
                    <td style={{ border: '1px solid #999', padding: 4 }}>{data.invStatus[r.serial] || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ทีละอุปกรณ์ — ขึ้นหน้าใหม่ทุกตัว เหมือนรายงานเดิม */}
        {tpl.devices.map(d => (
          <div key={d.key} className="print-break-before">
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>{d.name}</h2>
            <h3 style={{ fontSize: 12, fontWeight: 700, marginTop: 8 }}>Check List</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #999', padding: 4, background: '#eee', width: 34 }}>No.</th>
                  <th style={{ border: '1px solid #999', padding: 4, background: '#eee', textAlign: 'left' }}>Tasks</th>
                  <th style={{ border: '1px solid #999', padding: 4, background: '#eee', width: 90 }}>Check/Results</th>
                </tr>
              </thead>
              <tbody>
                {d.tasks.map(t => (
                  <tr key={t.no}>
                    <td style={{ border: '1px solid #999', padding: 4, textAlign: 'center' }}>{t.no}</td>
                    <td style={{ border: '1px solid #999', padding: 4 }}>{t.name}</td>
                    <td style={{ border: '1px solid #999', padding: 4, textAlign: 'center' }}>
                      {RESULT_MARK[data.results[slotKey(d.key, t.no)]] ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {figuresOf(figures, d.key).map(f => <PrintShot key={f.file} jobId={openJob.id} f={f} />)}

            <h3 style={{ fontSize: 12, fontWeight: 700, marginTop: 10 }}>Recommendations and Action plans</h3>
            {(data.recommendations[d.key] ?? '').trim()
              ? <ul style={{ margin: '4px 0 0 18px', fontSize: 11 }}>
                  {(data.recommendations[d.key] ?? '').split('\n').map(x => x.trim()).filter(Boolean)
                    .map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              : <p style={{ fontSize: 11, color: '#555' }}>N/A</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
