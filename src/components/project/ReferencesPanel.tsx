import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, X, ExternalLink, Search, Copy, Check, BookOpen, Quote, Paperclip, Pencil } from 'lucide-react'
import { Button } from '../common/Button'
import { Modal } from '../common/Modal'
import { Badge } from '../common/Badge'
import { AttachmentSection } from '../common/AttachmentSection'
import { spGet, spCreate, spUpdate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { formatCitation, formatBibliography } from '../../utils/citation'
import { REF_TYPE_TH, REF_TYPE_ICON, type ProjectReference, type ProjectReferenceLink } from '../../types/reference'

const LIST = 'PM_References'
const LINK_LIST = 'PM_ProjectReferences'

interface Props {
  projectId: number
  canEdit: boolean       // ผูก/ถอดแหล่งอ้างอิงเข้าออกโครงการได้ (ไม่ใช่แก้ตัวแหล่งอ้างอิงเอง)
  onCount?: (n: number) => void
}

/**
 * แท็บอ้างอิงในหน้าโครงการ — "ผูกกับคลัง แล้วเปิดอ่าน" เท่านั้น
 * ตัวเนื้อหาแหล่งอ้างอิงแก้ที่หน้าคลัง (ทรัพยากร → แหล่งอ้างอิง) ที่เดียว
 * ที่นี่แก้ได้เฉพาะบริบทของโครงการนี้: อ้างถึงหน้าไหน และใช้กับเรื่องอะไร
 */
export function ReferencesPanel({ projectId, canEdit, onCount }: Props) {
  const { addToast } = useAppStore()
  const [links, setLinks] = useState<ProjectReferenceLink[]>([])
  const [library, setLibrary] = useState<ProjectReference[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [copied, setCopied] = useState('')

  const [showPicker, setShowPicker] = useState(false)
  const [pickSearch, setPickSearch] = useState('')
  const [busy, setBusy] = useState(false)

  // แก้บริบทของโครงการ (หน้า/เรื่องที่ใช้) — ไม่ได้แก้ตัวแหล่งอ้างอิง
  const [editLink, setEditLink] = useState<ProjectReferenceLink | null>(null)
  const [ctxForm, setCtxForm] = useState({ Locator: '', AppliedTo: '' })

  function load() {
    setLoading(true)
    Promise.all([
      spGet<ProjectReferenceLink>(LINK_LIST, `ProjectID eq ${projectId}`,
        'Id,Title,ProjectID,ReferenceID,Locator,AppliedTo', 'Title asc', 500).catch(() => [] as ProjectReferenceLink[]),
      spGet<ProjectReference>(LIST, undefined, '*', 'Title asc', 1000)
        .catch(() => { setMissing(true); return [] as ProjectReference[] }),
    ]).then(([lk, lib]) => {
      setLinks(lk); setLibrary(lib); onCount?.(lk.length)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [projectId])   // eslint-disable-line react-hooks/exhaustive-deps

  const refById = useMemo(() => new Map(library.map(r => [r.id, r])), [library])
  const linkedIds = useMemo(() => new Set(links.map(l => l.ReferenceID)), [links])

  const rows = useMemo(() => links.map(l => ({ link: l, ref: refById.get(l.ReferenceID) })), [links, refById])

  const pickable = useMemo(() => {
    const q = pickSearch.trim().toLowerCase()
    return library
      .filter(r => !linkedIds.has(r.id))
      .filter(r => !q || [r.Title, r.Authors, r.Identifier, r.Topics].some(v => (v || '').toLowerCase().includes(q)))
      .slice(0, 60)
  }, [library, linkedIds, pickSearch])

  async function attach(r: ProjectReference) {
    if (busy) return
    setBusy(true)
    try {
      const res = await spCreate(LINK_LIST, {
        Title: r.Title,
        ProjectID: projectId,
        ReferenceID: r.id,
        Locator: r.Locator || undefined,   // ตั้งต้นจากคลัง แก้เฉพาะโครงการนี้ได้ทีหลัง
      })
      const next = [...links, { id: res.id, Title: r.Title, ProjectID: projectId, ReferenceID: r.id, Locator: r.Locator }]
      setLinks(next); onCount?.(next.length)
      addToast('success', `ผูก "${r.Title}" แล้ว`)
    } catch { addToast('error', 'ผูกไม่สำเร็จ') } finally { setBusy(false) }
  }

  async function detach(l: ProjectReferenceLink) {
    if (!window.confirm(`นำ "${l.Title}" ออกจากโครงการนี้?\n\n(ตัวแหล่งอ้างอิงยังอยู่ในคลัง ไม่ได้ถูกลบ)`)) return
    try {
      await spDelete(LINK_LIST, l.id)
      const next = links.filter(x => x.id !== l.id)
      setLinks(next); onCount?.(next.length)
      addToast('success', 'นำออกแล้ว')
    } catch { addToast('error', 'นำออกไม่สำเร็จ') }
  }

  function openCtx(l: ProjectReferenceLink) {
    setEditLink(l)
    setCtxForm({ Locator: l.Locator || '', AppliedTo: l.AppliedTo || '' })
  }

  async function saveCtx(e: React.FormEvent) {
    e.preventDefault()
    if (!editLink) return
    setBusy(true)
    try {
      await spUpdate(LINK_LIST, editLink.id, {
        Locator: ctxForm.Locator || undefined,
        AppliedTo: ctxForm.AppliedTo || undefined,
      })
      setLinks(prev => prev.map(x => x.id === editLink.id ? { ...x, ...ctxForm } : x))
      setEditLink(null)
      addToast('success', 'บันทึกแล้ว')
    } catch { addToast('error', 'บันทึกไม่สำเร็จ') } finally { setBusy(false) }
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

  // บรรณานุกรมของโครงการนี้ — ใช้ locator ของโครงการแทนค่าตั้งต้นจากคลัง
  const bibliography = () => formatBibliography(
    rows.filter(r => r.ref).map(r => ({ ...r.ref!, Locator: r.link.Locator || r.ref!.Locator })))

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'

  if (loading) return <p className="text-center text-sm text-gray-400 py-10">กำลังโหลด...</p>

  if (missing) {
    return (
      <div className="text-center py-12 text-gray-400">
        <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">ยังไม่มีคลังแหล่งอ้างอิง</p>
        <p className="text-xs mt-1">สร้างลิสต์ <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">PM_References</code> และ <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">PM_ProjectReferences</code> ก่อน (ดู References-Setup.md)</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && <Button size="sm" onClick={() => { setPickSearch(''); setShowPicker(true) }}><Plus size={14} /> ผูกแหล่งอ้างอิง</Button>}
        {rows.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => copy(bibliography(), '__all__')}>
            {copied === '__all__' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            คัดลอกบรรณานุกรม
          </Button>
        )}
        <Link to="/references" className="ml-auto text-xs text-primary-600 hover:underline inline-flex items-center gap-1">
          จัดการคลังแหล่งอ้างอิง <ExternalLink size={11} />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <BookOpen size={30} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">ยังไม่ได้ผูกแหล่งอ้างอิงกับโครงการนี้</p>
          {canEdit && <p className="text-xs mt-1">กด "ผูกแหล่งอ้างอิง" เพื่อเลือกจากคลัง</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(({ link: l, ref: r }) => {
            const citation = r ? formatCitation({ ...r, Locator: l.Locator || r.Locator }) : ''
            const open = openId === l.id
            return (
              <div key={l.id} className="subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-base flex-shrink-0">{REF_TYPE_ICON[r?.RefType ?? 'Other'] ?? '🔖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r?.Title ?? l.Title}</p>
                    {/* แหล่งถูกลบออกจากคลังไปแล้ว — บอกตรง ๆ ดีกว่าโชว์ชื่อเปล่า ๆ ให้เข้าใจผิดว่ายังมี */}
                    {!r && <p className="text-xs text-amber-600 mt-0.5">แหล่งนี้ถูกลบออกจากคลังแล้ว — เหลือแต่ชื่อที่บันทึกไว้ตอนผูก</p>}
                    {citation && citation !== `${r?.Title}.` && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">{citation}</p>
                    )}
                    {l.AppliedTo && (
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">ใช้กับ: {l.AppliedTo}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {r?.RefType && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{REF_TYPE_TH[r.RefType] ?? r.RefType}</Badge>}
                      {l.Locator && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{l.Locator}</Badge>}
                      {r?.URL && (
                        <a href={r.URL} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline">
                          เปิดลิงก์ <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {citation && (
                      <button onClick={() => copy(citation, String(l.id))} title="คัดลอกบรรทัดอ้างอิง"
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                        {copied === String(l.id) ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    )}
                    {r && (
                      <button onClick={() => setOpenId(open ? null : l.id)} title="อ่านสรุป / ไฟล์แนบ"
                        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${open ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`}>
                        <Paperclip size={13} />
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => openCtx(l)} title="แก้หน้าที่อ้างถึง / เรื่องที่ใช้"
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                        <Pencil size={13} />
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => detach(l)} title="นำออกจากโครงการ"
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {open && r && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
                    {r.Summary && (
                      <div className="flex gap-2">
                        <Quote size={13} className="text-gray-300 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{r.Summary}</p>
                      </div>
                    )}
                    {/* อ่าน/ดาวน์โหลดได้ แต่แก้ไฟล์แนบต้องไปที่หน้าคลัง — กันแก้ของกลางจากในโครงการ */}
                    <AttachmentSection listName={LIST} itemId={r.id} readOnly />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* เลือกจากคลัง */}
      <Modal open={showPicker} onClose={() => setShowPicker(false)} title="ผูกแหล่งอ้างอิงจากคลัง" size="lg">
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400" />
            <input autoFocus value={pickSearch} onChange={e => setPickSearch(e.target.value)}
              placeholder="ค้นหาในคลัง — ชื่อเรื่อง / ผู้แต่ง / หัวข้อ..."
              className="flex-1 bg-transparent text-sm focus:outline-none" />
          </div>
          {pickable.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {library.length === linkedIds.size ? 'ผูกครบทุกรายการในคลังแล้ว' : 'ไม่พบรายการที่ค้นหา'}
            </p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto space-y-1.5">
              {pickable.map(r => (
                <button key={r.id} onClick={() => attach(r)} disabled={busy}
                  className="w-full text-left flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50">
                  <span className="text-base flex-shrink-0">{REF_TYPE_ICON[r.RefType ?? 'Other'] ?? '🔖'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-gray-900 dark:text-gray-100 truncate">{r.Title}</span>
                    <span className="block text-xs text-gray-400 truncate">{formatCitation(r)}</span>
                  </span>
                  <Plus size={14} className="text-primary-600 flex-shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400 text-center">
            ไม่มีที่ต้องการ? <Link to="/references" className="text-primary-600 hover:underline">เพิ่มเข้าคลังก่อน</Link>
          </p>
        </div>
      </Modal>

      {/* บริบทเฉพาะโครงการนี้ */}
      <Modal open={!!editLink} onClose={() => setEditLink(null)} title="บริบทในโครงการนี้" size="md">
        <form onSubmit={saveCtx} className="space-y-3">
          <p className="text-xs text-gray-400">
            แก้เฉพาะโครงการนี้ ไม่กระทบรายการในคลังหรือโครงการอื่น
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ตำแหน่งที่อ้างถึง</label>
            <input value={ctxForm.Locator} onChange={e => setCtxForm(f => ({ ...f, Locator: e.target.value }))}
              className={inputCx} placeholder="บทที่ 4 น.120-135" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ใช้กับเรื่องอะไรในโครงการนี้</label>
            <input value={ctxForm.AppliedTo} onChange={e => setCtxForm(f => ({ ...f, AppliedTo: e.target.value }))}
              className={inputCx} placeholder="เช่น ใช้กำหนดเกณฑ์ SLO ของระบบลูกค้า" />
          </div>
          <Button type="submit" disabled={busy} className="w-full justify-center">
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
