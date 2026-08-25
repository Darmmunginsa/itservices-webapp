import { useEffect, useMemo, useState } from 'react'
import { FileText, BookOpen, Check, Plus, Edit2, Trash2, Search, X, AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { Modal } from './Modal'
import { spGet, spCreate, spUpdate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import {
  renderClose, kbLinksBlock, kbUrl, kbBaseMissing, templatesFor, CLOSE_VARS, DEFAULT_TEMPLATES,
  type CloseTemplate, type CloseVars, type KbLink,
} from '../../utils/closeTemplate'

const TPL_LIST = 'HD_CloseTemplates'
const KB_LIST = 'HD_KBArticles'
const OPT_LIST = 'HD_Options'
const KB_BASE_CATEGORY = 'KbBaseUrl'

interface KbRow { id: number; Title: string; ArticleCode?: string; ArticleStatus?: string; Product?: string; Tags?: string }

interface Props {
  kind: 'Ticket' | 'Incident'
  /** ค่าที่จะเติมลง template (ยกเว้น kb_links ที่ประกอบให้เอง) */
  vars: CloseVars
  /** หมวดของงาน — ใช้เสนอ template ที่ตรงกันขึ้นก่อน */
  category?: string
  value: string
  onChange: (text: string) => void
  className?: string
}

/**
 * แถบเลือกข้อความตอบกลับตอนปิดงาน + แนบลิงก์บทความความรู้
 * ใช้ร่วมกันทั้งหน้า Ticket และ Incident — ข้อความที่ส่งลูกค้าควรออกมาเหมือนกัน
 * ไม่ว่าจะปิดงานจากหน้าไหน
 */
export function CloseReply({ kind, vars, category, value, onChange, className = '' }: Props) {
  const { user, addToast } = useAppStore()
  const canManage = ['Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  const [templates, setTemplates] = useState<CloseTemplate[]>([])
  const [articles, setArticles] = useState<KbRow[]>([])
  const [kbBase, setKbBase] = useState('')
  const [baseRowId, setBaseRowId] = useState<number | null>(null)

  const [picked, setPicked] = useState<KbRow[]>([])
  const [tplId, setTplId] = useState('')
  const [showKb, setShowKb] = useState(false)
  const [kbSearch, setKbSearch] = useState('')

  const [showTplMgr, setShowTplMgr] = useState(false)
  const [tplEdit, setTplEdit] = useState<CloseTemplate | null>(null)
  const [tplForm, setTplForm] = useState({ Title: '', Body: '', AppliesTo: 'Both' })
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    spGet<CloseTemplate>(TPL_LIST, undefined, 'Id,Title,Body,AppliesTo,Category,IsActive', 'Title asc', 200)
      .then(setTemplates).catch(() => setTemplates([]))
    // เอาเฉพาะบทความที่เผยแพร่แล้ว — ลิงก์ฉบับร่างส่งไปลูกค้าเปิดไม่ได้
    spGet<KbRow>(KB_LIST, "ArticleStatus eq 'Published'", 'Id,Title,ArticleCode,ArticleStatus,Product,Tags', 'Title asc', 500)
      .then(setArticles).catch(() => setArticles([]))
    spGet<{ id: number; Title: string }>(OPT_LIST, `Category eq '${KB_BASE_CATEGORY}'`, 'Id,Title', undefined, 1)
      .then(r => { if (r[0]) { setKbBase(r[0].Title ?? ''); setBaseRowId(r[0].id) } })
      .catch(() => {})
  }, [])

  const usable = useMemo(() => templatesFor(templates, kind, category), [templates, kind, category])

  const kbLinks: KbLink[] = useMemo(
    () => picked.map(a => ({ id: a.id, code: a.ArticleCode ?? '', title: a.Title })), [picked])

  /** เขียนข้อความใหม่จาก template + บทความที่เลือกอยู่ */
  function apply(templateId: string, chosen: KbRow[]) {
    const t = templates.find(x => String(x.id) === templateId)
    if (!t) return
    const links = chosen.map(a => ({ id: a.id, code: a.ArticleCode ?? '', title: a.Title }))
    onChange(renderClose(t.Body, { ...vars, kb_links: kbLinksBlock(links, kbBase) }))
  }

  function toggleArticle(a: KbRow) {
    const next = picked.some(x => x.id === a.id) ? picked.filter(x => x.id !== a.id) : [...picked, a]
    setPicked(next)
    // ถ้าใช้ template อยู่ ให้เขียนใหม่ทั้งก้อน — ผู้ใช้จะได้เห็นลิงก์ไปอยู่ตำแหน่งที่ template กำหนด
    if (tplId) apply(tplId, next)
  }

  /** แนบลิงก์ต่อท้ายข้อความที่พิมพ์เอง (กรณีไม่ได้ใช้ template) */
  function appendLinks() {
    const block = kbLinksBlock(kbLinks, kbBase)
    if (!block) return
    const NL = String.fromCharCode(10)
    onChange(`${value}${value.trim() ? NL + NL : ''}อ่านรายละเอียดเพิ่มเติมได้ที่${NL}${block}`)
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!tplForm.Title.trim()) return
    try {
      if (tplEdit) {
        await spUpdate(TPL_LIST, tplEdit.id, { Title: tplForm.Title, Body: tplForm.Body, AppliesTo: tplForm.AppliesTo })
        setTemplates(prev => prev.map(t => t.id === tplEdit.id ? { ...t, ...tplForm } : t))
      } else {
        const res = await spCreate(TPL_LIST, { ...tplForm, IsActive: true })
        setTemplates(prev => [...prev, { id: res.id, ...tplForm, IsActive: true }])
      }
      setTplEdit(null); setTplForm({ Title: '', Body: '', AppliesTo: 'Both' })
      addToast('success', 'บันทึก template แล้ว')
    } catch { addToast('error', 'บันทึกไม่สำเร็จ — ลิสต์ HD_CloseTemplates มีหรือยัง') }
  }

  async function removeTemplate(t: CloseTemplate) {
    if (!window.confirm(`ลบ template "${t.Title}"?`)) return
    try {
      await spDelete(TPL_LIST, t.id)
      setTemplates(prev => prev.filter(x => x.id !== t.id))
    } catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  /** ใส่ template สำเร็จรูปให้ครั้งเดียว — ทีมจะได้ไม่ต้องเริ่มจากหน้าว่าง */
  async function seedTemplates() {
    setSeeding(true)
    try {
      const added: CloseTemplate[] = []
      for (const d of DEFAULT_TEMPLATES) {
        const res = await spCreate(TPL_LIST, { Title: d.Title, Body: d.Body, AppliesTo: d.AppliesTo, IsActive: true })
        added.push({ id: res.id, Title: d.Title, Body: d.Body, AppliesTo: d.AppliesTo, IsActive: true })
      }
      setTemplates(prev => [...prev, ...added])
      addToast('success', `เพิ่ม template ตัวอย่าง ${added.length} แบบแล้ว`)
    } catch { addToast('error', 'เพิ่มไม่สำเร็จ — ลิสต์ HD_CloseTemplates มีหรือยัง') }
    finally { setSeeding(false) }
  }

  async function saveKbBase(v: string) {
    setKbBase(v)
    try {
      if (baseRowId) await spUpdate(OPT_LIST, baseRowId, { Title: v })
      else {
        const res = await spCreate(OPT_LIST, { Title: v, Category: KB_BASE_CATEGORY })
        setBaseRowId(res.id)
      }
    } catch { /* บันทึกไม่ได้ก็ยังใช้ค่าที่พิมพ์ในรอบนี้ได้ */ }
  }

  const kbMatches = useMemo(() => {
    const q = kbSearch.trim().toLowerCase()
    return articles.filter(a => !q || [a.Title, a.ArticleCode, a.Product, a.Tags]
      .some(v => (v ?? '').toLowerCase().includes(q))).slice(0, 50)
  }, [articles, kbSearch])

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <select value={tplId} onChange={e => { setTplId(e.target.value); apply(e.target.value, picked) }}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-900 max-w-[240px]">
          <option value="">— เลือกข้อความตอบกลับ —</option>
          {usable.map(t => <option key={t.id} value={String(t.id)}>{t.Title}</option>)}
        </select>

        <button type="button" onClick={() => setShowKb(true)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 inline-flex items-center gap-1">
          <BookOpen size={12} /> แนบบทความ{picked.length ? ` (${picked.length})` : ''}
        </button>

        {canManage && (
          <button type="button" onClick={() => setShowTplMgr(true)}
            className="text-xs text-gray-500 hover:text-primary-600 inline-flex items-center gap-1">
            <FileText size={12} /> จัดการข้อความ
          </button>
        )}
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {picked.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300">
              {a.ArticleCode || `#${a.id}`} · {a.Title.slice(0, 30)}
              <button type="button" onClick={() => toggleArticle(a)} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
          {!tplId && (
            <button type="button" onClick={appendLinks} className="text-[11px] text-primary-600 hover:underline">
              + ใส่ลิงก์ในข้อความ
            </button>
          )}
        </div>
      )}

      {picked.length > 0 && kbBaseMissing(kbBase) && (
        <p className="text-[11px] text-amber-600 flex items-start gap-1">
          <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
          ยังไม่ได้ตั้งที่อยู่เว็บคลังความรู้ — ลิงก์ที่ส่งไปจะกดไม่ได้ ตั้งได้ที่ปุ่ม "แนบบทความ"
        </p>
      )}

      {/* ── เลือกบทความ ── */}
      <Modal open={showKb} onClose={() => setShowKb(false)} title="แนบบทความความรู้" size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ที่อยู่เว็บคลังความรู้</label>
            <input value={kbBase} onChange={e => saveKbBase(e.target.value)} className={inputCx}
              placeholder="https://itservices.co.th/kb" />
            <p className="text-[11px] text-gray-400 mt-1">
              ต้องตรงกับที่อัปโหลดไฟล์จากปุ่ม "สร้างเว็บ" ในหน้าคลังความรู้ · เก็บใน SharePoint ใช้ร่วมกันทั้งทีม
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
            <Search size={15} className="text-gray-400" />
            <input autoFocus value={kbSearch} onChange={e => setKbSearch(e.target.value)}
              placeholder="ค้นหาบทความที่เผยแพร่แล้ว..." className="flex-1 bg-transparent text-sm focus:outline-none" />
          </div>

          {articles.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">
              ยังไม่มีบทความที่เผยแพร่ — เขียนและตั้งเป็น "เผยแพร่" ในหน้าคลังความรู้ก่อน
            </p>
          ) : (
            <div className="max-h-[45vh] overflow-y-auto space-y-1">
              {kbMatches.map(a => {
                const on = picked.some(x => x.id === a.id)
                return (
                  <button key={a.id} type="button" onClick={() => toggleArticle(a)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      on ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'bg-primary-600 border-primary-600' : 'border-gray-300 dark:border-gray-600'}`}>
                        {on && <Check size={11} className="text-white" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-gray-900 dark:text-gray-100 truncate">{a.Title}</span>
                        <span className="block text-[11px] text-gray-400 truncate">
                          {a.ArticleCode} {a.Product ? `· ${a.Product}` : ''}
                        </span>
                        <span className="block text-[10px] text-gray-400 truncate">
                          {kbUrl(kbBase, { id: a.id, code: a.ArticleCode ?? '', title: a.Title })}
                        </span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
          <Button className="w-full justify-center" onClick={() => setShowKb(false)}>เสร็จ</Button>
        </div>
      </Modal>

      {/* ── จัดการ template ── */}
      <Modal open={showTplMgr} onClose={() => { setShowTplMgr(false); setTplEdit(null); setTplForm({ Title: '', Body: '', AppliesTo: 'Both' }) }}
        title="ข้อความตอบกลับตอนปิดงาน" size="xl">
        <div className="space-y-3">
          {templates.length === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-gray-400 mb-2">ยังไม่มีข้อความตอบกลับ</p>
              <Button size="sm" variant="secondary" onClick={() => void seedTemplates()} disabled={seeding}>
                {seeding ? 'กำลังเพิ่ม...' : 'ใส่ตัวอย่างให้ 3 แบบ'}
              </Button>
            </div>
          )}

          {templates.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {templates.map(t => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{t.Title}</p>
                    <p className="text-[11px] text-gray-400">
                      ใช้กับ: {t.AppliesTo === 'Ticket' ? 'Ticket' : t.AppliesTo === 'Incident' ? 'Incident' : 'ทั้งคู่'}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setTplEdit(t); setTplForm({ Title: t.Title, Body: t.Body ?? '', AppliesTo: t.AppliesTo ?? 'Both' }) }}
                    className="p-1 text-gray-400 hover:text-primary-600"><Edit2 size={13} /></button>
                  <button type="button" onClick={() => void removeTemplate(t)}
                    className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={saveTemplate} className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
            <p className="text-xs font-semibold">{tplEdit ? 'แก้ไขข้อความ' : 'เพิ่มข้อความใหม่'}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input required value={tplForm.Title} onChange={e => setTplForm(f => ({ ...f, Title: e.target.value }))}
                  className={inputCx} placeholder="ชื่อข้อความ เช่น ปิดงาน — แก้ไขเรียบร้อย" />
              </div>
              <select value={tplForm.AppliesTo} onChange={e => setTplForm(f => ({ ...f, AppliesTo: e.target.value }))} className={inputCx}>
                <option value="Both">ใช้ได้ทั้งคู่</option>
                <option value="Ticket">เฉพาะ Ticket</option>
                <option value="Incident">เฉพาะ Incident</option>
              </select>
            </div>
            <textarea value={tplForm.Body} onChange={e => setTplForm(f => ({ ...f, Body: e.target.value }))}
              rows={10} className={inputCx + ' font-mono text-[13px]'} placeholder="เนื้อความ..." />
            <p className="text-[11px] text-gray-400">
              ตัวแปรที่ใช้ได้: {CLOSE_VARS.map(v => `{{${v.key}}}`).join(' · ')}
              <br />
              บรรทัดที่มีแต่ตัวแปรว่าง จะถูกตัดทิ้งอัตโนมัติ — เช่นไม่ได้แนบบทความ บรรทัดลิงก์จะไม่ค้างเป็นช่องว่าง
            </p>
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="flex-1 justify-center">
                <Plus size={13} /> {tplEdit ? 'บันทึก' : 'เพิ่ม'}
              </Button>
              {tplEdit && (
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => { setTplEdit(null); setTplForm({ Title: '', Body: '', AppliesTo: 'Both' }) }}>
                  ยกเลิก
                </Button>
              )}
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}
