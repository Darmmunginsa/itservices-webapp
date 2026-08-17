import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, FileDown, Trash2, ClipboardPaste, Server, ChevronRight, Check,
  AlertTriangle, Upload, Settings2, FileText, Loader2,
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
  slotKey, shotFileName,
  type PmTemplate, type PmJobData, type TaskResult, type InvStatus, type FiguredShot,
} from '../utils/pmReport'

const TPL_LIST = 'PM_ReportTemplates'
const JOB_LIST = 'PM_ReportJobs'
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
  const [showTplMgr, setShowTplMgr] = useState(false)
  const [tplForm, setTplForm] = useState({ title: '', json: '' })
  const [tplErr, setTplErr] = useState('')

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

  // ── template ──
  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault()
    setTplErr('')
    try {
      const parsed = parseTemplate(tplForm.json)
      await spCreate(TPL_LIST, {
        Title: tplForm.title.trim() || parsed.title,
        Structure: tplForm.json,
        IsActive: true,
      })
      addToast('success', `เพิ่ม template แล้ว (${parsed.devices.length} อุปกรณ์)`)
      setShowTplMgr(false)
      setTplForm({ title: '', json: '' })
      load()
    } catch (e2) {
      setTplErr((e2 as Error).message)
    }
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
                <Button variant="secondary" onClick={() => { setTplErr(''); setShowTplMgr(true) }}>
                  <Settings2 size={15} /> จัดการ Template
                </Button>
              )}
              <p className="text-xs text-gray-400">
                {templates.length === 0
                  ? 'ยังไม่มี template — กด "จัดการ Template" แล้ววาง JSON ของ template เข้ามา'
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

        {/* template ใหม่ */}
        <Modal open={showTplMgr} onClose={() => setShowTplMgr(false)} title="เพิ่ม Template" size="lg">
          <form onSubmit={saveTemplate} className="space-y-3">
            <p className="text-xs text-gray-500">
              วาง JSON ของ template ได้เลย — ใช้ไฟล์ <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">config/*.json</code> ของเครื่องมือ PM Report เดิมได้ตรง ๆ
              (ต้องมี <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">devices</code> อย่างน้อย)
            </p>
            <div>
              <label className={labelCx}>ชื่อ Template</label>
              <input value={tplForm.title} onChange={e => setTplForm(f => ({ ...f, title: e.target.value }))}
                className={inputCx} placeholder="เว้นว่างได้ — จะใช้ชื่อจากใน JSON" />
            </div>
            <div>
              <label className={labelCx}>JSON *</label>
              <textarea required value={tplForm.json} onChange={e => { setTplForm(f => ({ ...f, json: e.target.value })); setTplErr('') }}
                rows={14} className={inputCx + ' font-mono text-[12px]'} placeholder='{ "devices": [ ... ] }' />
            </div>
            {tplErr && <p className="text-xs text-red-500">⚠ {tplErr}</p>}
            {!tplErr && tplForm.json.trim() && (() => {
              try {
                const p = parseTemplate(tplForm.json)
                return (
                  <p className="text-xs text-emerald-600">
                    ✓ อ่านได้: {p.devices.length} อุปกรณ์ · {p.devices.reduce((n, d) => n + d.tasks.length, 0)} รายการตรวจ · inventory {p.inventory.length} แถว
                  </p>
                )
              } catch { return null }
            })()}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 justify-center">บันทึก Template</Button>
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
