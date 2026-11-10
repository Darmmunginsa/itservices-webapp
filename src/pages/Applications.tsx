import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppWindow, ExternalLink, FolderOpen, Globe, Pencil, Plus, Search, Server, Siren, Ticket, Trash2, Building2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonCard } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { useCanEdit } from '../hooks/useCanEdit'
import { parseIds, joinIds, type Application, type AppStatus } from '../types/application'

// ── แอปพลิเคชัน: ผลงานของโครงการที่ส่งมอบให้ลูกค้าแล้ว ──
// รวม URL + บันทึก + ผูกโครงการ / Asset / Ticket / Incident / Portal ไว้ที่เดียว — ดูแลหลังส่งมอบได้ง่าย

const LIST = 'PM_Applications'

interface Opt { id: number; label: string; sub?: string; projectId?: number | null; portalId?: number | null; company?: string }
const STATUS: { v: AppStatus; label: string; cls: string }[] = [
  { v: 'Active', label: 'ใช้งานอยู่', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { v: 'Maintenance', label: 'ปรับปรุง/ดูแล', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { v: 'Retired', label: 'เลิกใช้แล้ว', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
]
const statusOf = (s?: string) => STATUS.find(x => x.v === s) ?? STATUS[0]

interface Form { Title: string; URL: string; Note: string; Customer: string; Status: AppStatus; ProjectID: number | null; assets: number[]; tickets: number[]; incidents: number[]; portals: number[] }
const EMPTY: Form = { Title: '', URL: '', Note: '', Customer: '', Status: 'Active', ProjectID: null, assets: [], tickets: [], incidents: [], portals: [] }

/** เลือกหลายรายการ พร้อมช่องค้นหา (รายการที่เลือกแสดงเป็นชิปด้านบน) */
function MultiPick({ label, icon, options, value, onChange, hint }: { label: string; icon: React.ReactNode; options: Opt[]; value: number[]; onChange: (v: number[]) => void; hint?: string }) {
  const [q, setQ] = useState('')
  const picked = options.filter(o => value.includes(o.id))
  const shown = options.filter(o => !value.includes(o.id) && `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40)
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{icon} {label} {value.length > 0 && <span className="text-primary-600">({value.length})</span>}</p>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {picked.map(o => (
            <button key={o.id} type="button" onClick={() => onChange(value.filter(v => v !== o.id))} title="คลิกเพื่อเอาออก"
              className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 hover:bg-red-50 hover:text-red-600">
              {o.label} ✕
            </button>
          ))}
        </div>
      )}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={hint ?? 'ค้นหาเพื่อเพิ่ม…'}
        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      {q && (
        <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
          {shown.length === 0 ? <p className="px-2.5 py-2 text-xs text-gray-400">ไม่พบ</p> : shown.map(o => (
            <button key={o.id} type="button" onClick={() => { onChange([...value, o.id]); setQ('') }}
              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
              {o.label}{o.sub && <span className="text-gray-400"> · {o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Applications() {
  const { addToast, allowedPages } = useAppStore()
  const canEdit = useCanEdit('applications', ['Agent', 'Supervisor', 'Boss', 'Admin'])
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [projects, setProjects] = useState<Opt[]>([])
  const [assets, setAssets] = useState<Opt[]>([])
  const [tickets, setTickets] = useState<Opt[]>([])
  const [incidents, setIncidents] = useState<Opt[]>([])
  const [portals, setPortals] = useState<(Opt & { url?: string })[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | AppStatus>('')
  const [detail, setDetail] = useState<Application | null>(null)
  const [editing, setEditing] = useState<Application | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    spGet<Application>(LIST, undefined, undefined, 'Title asc', 1000)
      .then(r => { setApps(r); setMissing(false) })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    // รายการให้เลือกผูก — โหลดครั้งเดียว (ลิสต์ไหนไม่มีสิทธิ์ก็แค่ว่าง)
    spGet<{ id: number; Title: string; Company?: string }>('PM_Projects', undefined, 'Id,Title,Company', 'Title asc', 1000)
      .then(r => setProjects(r.map(p => ({ id: p.id, label: p.Title, company: p.Company })))).catch(() => {})
    spGet<{ id: number; Title: string; AssetCode?: string; Category?: string; PortalID?: number }>('IT_Assets', undefined, 'Id,Title,AssetCode,Category,PortalID', 'Title asc', 2000)
      .then(r => setAssets(r.map(a => ({ id: a.id, label: a.Title, sub: [a.AssetCode, a.Category].filter(Boolean).join(' · '), portalId: a.PortalID })))).catch(() => {})
    spGet<{ id: number; Title: string; TicketNumber?: string; Status?: string; ProjectID?: number }>('HD_Tickets', undefined, 'Id,Title,TicketNumber,Status,ProjectID', 'Id desc', 2000)
      .then(r => setTickets(r.map(t => ({ id: t.id, label: `${t.TicketNumber ? t.TicketNumber + ' ' : ''}${t.Title}`, sub: t.Status, projectId: t.ProjectID })))).catch(() => {})
    spGet<{ id: number; Title: string; Severity?: string; Status?: string; ProjectID?: number }>('PM_Incidents', undefined, 'Id,Title,Severity,Status,ProjectID', 'Id desc', 2000)
      .then(r => setIncidents(r.map(i => ({ id: i.id, label: i.Title, sub: [i.Severity, i.Status].filter(Boolean).join(' · '), projectId: i.ProjectID })))).catch(() => {})
    spGet<{ id: number; Title: string; URL?: string; Category?: string }>('IT_Portals', undefined, 'Id,Title,URL,Category', 'Title asc', 1000)
      .then(r => setPortals(r.map(p => ({ id: p.id, label: p.Title, sub: p.Category, url: p.URL })))).catch(() => {})
  }, [load])

  const byId = <T extends Opt>(list: T[]) => new Map(list.map(o => [o.id, o]))
  const projectMap = useMemo(() => byId(projects), [projects])
  const assetMap = useMemo(() => byId(assets), [assets])
  const ticketMap = useMemo(() => byId(tickets), [tickets])
  const incidentMap = useMemo(() => byId(incidents), [incidents])
  const portalMap = useMemo(() => byId(portals), [portals])

  // ── ดึงอัตโนมัติจากโครงการ: Asset ของโครงการ · Ticket/Incident ของโครงการ · Portal ที่ผูกกับ Asset เหล่านั้น · ลูกค้า (Company) ──
  // รวมกับที่เลือกไว้แล้ว (ไม่ลบของเดิม) — เลือกโครงการแล้วดึงให้เอง หรือกดปุ่ม "ดึงจากโครงการ" ซ้ำได้
  const [pulling, setPulling] = useState(false)
  const [pullNote, setPullNote] = useState('')
  async function pullFromProject(pid: number | null) {
    if (!pid) { setPullNote(''); return }
    setPulling(true)
    try {
      const pa = await spGet<{ AssetID?: number }>('PM_ProjectAssets', `ProjectID eq ${pid}`, 'AssetID', undefined, 1000).catch(() => [])
      const assetIds = pa.map(x => Number(x.AssetID)).filter(n => n > 0)
      const ticketIds = tickets.filter(t => t.projectId === pid).map(t => t.id)
      const incidentIds = incidents.filter(i => i.projectId === pid).map(i => i.id)
      const portalIds = assetIds.map(id => assetMap.get(id)?.portalId).filter((n): n is number => !!n && n > 0)
      const company = projectMap.get(pid)?.company
      setForm(f => {
        const add = (cur: number[], more: number[]) => [...new Set([...cur, ...more])]
        const next = { ...f, assets: add(f.assets, assetIds), tickets: add(f.tickets, ticketIds), incidents: add(f.incidents, incidentIds), portals: add(f.portals, portalIds), Customer: f.Customer || company || '' }
        const n = (k: 'assets' | 'tickets' | 'incidents' | 'portals') => next[k].length - f[k].length
        const parts = [[n('assets'), 'Asset'], [n('portals'), 'Portal'], [n('tickets'), 'Ticket'], [n('incidents'), 'Incident']].filter(([c]) => (c as number) > 0).map(([c, t]) => `${c} ${t}`)
        setPullNote(parts.length || (!f.Customer && company) ? `✨ ดึงจากโครงการแล้ว: ${[...parts, ...(!f.Customer && company ? ['ลูกค้า'] : [])].join(' · ')}` : 'ไม่มีรายการใหม่จากโครงการนี้')
        return next
      })
    } finally { setPulling(false) }
  }

  // ── จิ้มรายการที่ผูก = โชว์ข้อมูลแบบ toast ในหน้าต่างนี้ (ไม่พาออกจากหน้า Application) ──
  // ปุ่ม "เปิดดู" ขึ้นเฉพาะคนที่มีสิทธิ์เข้าหน้านั้น และเปิดเป็นแท็บใหม่ — กลับมาหน้านี้ได้เสมอ
  type Peek = { kind: string; title: string; sub?: string; href?: string; external?: boolean }
  const [peek, setPeek] = useState<Peek | null>(null)
  useEffect(() => { if (!peek) return; const t = setTimeout(() => setPeek(null), 8000); return () => clearTimeout(t) }, [peek])
  const can = (k: string) => !!allowedPages?.has(k)
  const appUrl = (path: string) => `${window.location.origin}${window.location.pathname}#${path}`
  const showPeek = (p: Peek) => setPeek(p)

  const openCreate = () => { setEditing(null); setForm(EMPTY); setPullNote(''); setShowModal(true) }
  const openEdit = (a: Application) => {
    setEditing(a); setPullNote('')
    setForm({
      Title: a.Title, URL: a.URL ?? '', Note: a.Note ?? '', Customer: a.Customer ?? '', Status: (a.Status as AppStatus) ?? 'Active',
      ProjectID: a.ProjectID ?? null, assets: parseIds(a.AssetIDs), tickets: parseIds(a.TicketIDs), incidents: parseIds(a.IncidentIDs), portals: parseIds(a.PortalIDs),
    })
    setShowModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.Title.trim()) return
    setSaving(true)
    const payload = {
      Title: form.Title.trim(), URL: form.URL.trim() || null, Note: form.Note.trim() || null, Customer: form.Customer.trim() || null, Status: form.Status,
      ProjectID: form.ProjectID, AssetIDs: joinIds(form.assets), TicketIDs: joinIds(form.tickets), IncidentIDs: joinIds(form.incidents), PortalIDs: joinIds(form.portals),
    }
    // คอลัมน์ไหนยังไม่ได้สร้างในลิสต์ → SharePoint ตอบ "The property 'X' does not exist"
    // ตัดคอลัมน์นั้นออกแล้วบันทึกส่วนที่เหลือก่อน + บอกชื่อคอลัมน์ที่ขาดทั้งหมด (ไม่ใช่ล้มทั้งก้อน)
    const data: Record<string, unknown> = { ...payload }
    const missingCols: string[] = []
    try {
      for (let i = 0; i < 12; i++) {
        try {
          if (editing) await spUpdate(LIST, editing.id, data)
          else await spCreate(LIST, data)
          break
        } catch (err) {
          const m = /property '([^']+)' does not exist/i.exec(String((err as Error)?.message ?? err))
          if (!m || !(m[1] in data)) throw err
          missingCols.push(m[1]); delete data[m[1]]
        }
      }
      if (missingCols.length) addToast('error', `บันทึกแล้ว แต่ลิสต์ PM_Applications ยังไม่มีคอลัมน์: ${missingCols.join(', ')} — ข้อมูลช่องนั้นจึงยังไม่ถูกเก็บ (สร้างคอลัมน์ตาม docs/Applications-Setup.md แล้วบันทึกใหม่)`)
      else addToast('success', editing ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มแอปพลิเคชันแล้ว')
      setShowModal(false); load()
    } catch { addToast('error', 'บันทึกไม่สำเร็จ — ตรวจว่ามีลิสต์ PM_Applications และคอลัมน์ครบ (docs/Applications-Setup.md)') }
    finally { setSaving(false) }
  }

  async function remove(a: Application) {
    if (!window.confirm(`ลบแอปพลิเคชัน "${a.Title}"?\n(ไม่กระทบโครงการ / Ticket / Asset ที่ผูกไว้)`)) return
    try { await spDelete(LIST, a.id); setApps(p => p.filter(x => x.id !== a.id)); setDetail(null); addToast('success', 'ลบแล้ว') }
    catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  const filtered = apps.filter(a => (!statusFilter || (a.Status ?? 'Active') === statusFilter) &&
    [a.Title, a.URL, a.Customer, a.Note, a.ProjectID ? projectMap.get(a.ProjectID)?.label : ''].some(s => (s ?? '').toLowerCase().includes(search.toLowerCase())))

  // Ticket/Incident ของโครงการที่เลือก ขึ้นก่อน (ส่วนใหญ่ผูกกับโครงการเดียวกัน)
  const sortByProject = (list: Opt[]) => form.ProjectID ? [...list].sort((a, b) => Number(b.projectId === form.ProjectID) - Number(a.projectId === form.ProjectID)) : list
  const view = detail ? apps.find(a => a.id === detail.id) ?? detail : null
  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const chip = 'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/30'

  const counts = (a: Application) => [
    { icon: <Server size={11} />, n: parseIds(a.AssetIDs).length, t: 'Asset' },
    { icon: <Ticket size={11} />, n: parseIds(a.TicketIDs).length, t: 'Ticket' },
    { icon: <Siren size={11} />, n: parseIds(a.IncidentIDs).length, t: 'Incident' },
    { icon: <Globe size={11} />, n: parseIds(a.PortalIDs).length, t: 'Portal' },
  ].filter(c => c.n > 0)

  return (
    <div>
      <Header title="Application" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[14rem] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อแอป, URL, ลูกค้า, โครงการ…" className="flex-1 bg-transparent text-sm focus:outline-none" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as '' | AppStatus)} className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-900">
            <option value="">ทุกสถานะ</option>
            {STATUS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
          {canEdit && <Button onClick={openCreate}><Plus size={15} /> เพิ่มแอปพลิเคชัน</Button>}
        </div>

        {missing && (
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
            ยังไม่มีลิสต์ <b>PM_Applications</b> บน SharePoint — สร้างตามคู่มือ <code>docs/Applications-Setup.md</code> แล้วรีเฟรชหน้านี้
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <AppWindow size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{apps.length ? 'ไม่พบตามที่ค้นหา' : 'ยังไม่มีแอปพลิเคชัน — กด "เพิ่มแอปพลิเคชัน" เพื่อบันทึกผลงานที่ส่งมอบลูกค้าแล้ว'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => {
              const st = statusOf(a.Status), proj = a.ProjectID ? projectMap.get(a.ProjectID) : undefined
              return (
                <div key={a.id} onClick={() => setDetail(a)} role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(a) } }}
                  className="subpanel bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600"><AppWindow size={16} /></span>
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{a.Title}</h3>
                    </div>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    {a.URL && <p className="flex items-center gap-1.5"><ExternalLink size={12} className="text-gray-400" /> <a href={a.URL} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-primary-600 hover:underline truncate">{a.URL}</a></p>}
                    {proj && <p className="flex items-center gap-1.5"><FolderOpen size={12} className="text-gray-400" /> <span className="truncate">{proj.label}</span></p>}
                    {a.Customer && <p className="flex items-center gap-1.5"><Building2 size={12} className="text-gray-400" /> <span className="truncate">{a.Customer}</span></p>}
                    {a.Note && <p className="text-gray-500 line-clamp-2 pt-1">{a.Note}</p>}
                  </div>
                  {counts(a).length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
                      {counts(a).map(c => <span key={c.t} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{c.icon} {c.n} {c.t}</span>)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* รายละเอียด */}
      <Modal open={!!view} onClose={() => { setDetail(null); setPeek(null) }} title={view?.Title} size="lg">
        {view && (() => {
          const st = statusOf(view.Status), proj = view.ProjectID ? projectMap.get(view.ProjectID) : undefined
          const section = (title: string, icon: React.ReactNode, items: React.ReactNode[]) => items.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 mb-1.5">{icon} {title} ({items.length})</p>
              <div className="flex flex-wrap gap-1.5">{items}</div>
            </div>
          )
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                {view.Customer && <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800"><Building2 size={11} /> {view.Customer}</span>}
              </div>
              {view.URL && <a href={view.URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline break-all"><ExternalLink size={14} /> {view.URL}</a>}
              {proj && <p className="text-sm"><FolderOpen size={14} className="inline mr-1 text-gray-400" />โครงการ: <button type="button" onClick={() => showPeek({ kind: 'โครงการ', title: proj.label, sub: proj.company, href: can('projects') ? appUrl(`/projects/${proj.id}`) : undefined })} className="text-primary-600 hover:underline">{proj.label}</button></p>}
              {view.Note && <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm whitespace-pre-wrap">{view.Note}</div>}
              {section('Asset', <Server size={13} />, parseIds(view.AssetIDs).map(id => { const o = assetMap.get(id); return <button type="button" key={id} className={chip} onClick={() => showPeek({ kind: 'Asset', title: o?.label ?? `#${id}`, sub: o?.sub, href: can('assets') ? appUrl(`/assets?id=${id}`) : undefined })}><Server size={10} /> {o?.label ?? `#${id}`}</button> }))}
              {section('Ticket', <Ticket size={13} />, parseIds(view.TicketIDs).map(id => { const o = ticketMap.get(id); return <button type="button" key={id} className={chip} onClick={() => showPeek({ kind: 'Ticket', title: o?.label ?? `#${id}`, sub: o?.sub ? `สถานะ: ${o.sub}` : undefined, href: can('my-work') || can('dashboard') ? appUrl(`/tickets/${id}`) : undefined })}><Ticket size={10} /> {o?.label ?? `#${id}`}</button> }))}
              {section('Incident', <Siren size={13} />, parseIds(view.IncidentIDs).map(id => { const o = incidentMap.get(id); return <button type="button" key={id} className={chip} onClick={() => showPeek({ kind: 'Incident', title: o?.label ?? `#${id}`, sub: o?.sub, href: can('my-work') || can('dashboard') ? appUrl(`/incidents/${id}`) : undefined })}><Siren size={10} /> {o?.label ?? `#${id}`}</button> }))}
              {section('Portal', <Globe size={13} />, parseIds(view.PortalIDs).map(id => {
                const p = portalMap.get(id) as (Opt & { url?: string }) | undefined
                return <button type="button" key={id} className={chip} onClick={() => showPeek({ kind: 'Portal', title: p?.label ?? `#${id}`, sub: [p?.sub, p?.url].filter(Boolean).join(' · ') || undefined, href: can('portals') ? (p?.url || appUrl('/portals')) : undefined, external: !!p?.url })}><Globe size={10} /> {p?.label ?? `#${id}`}</button>
              }))}
              {/* toast ข้อมูลของรายการที่จิ้ม */}
              {peek && (
                <div className="sticky bottom-0 z-10 flex items-start gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-100 shadow-lg">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-[10px] uppercase tracking-wide opacity-70">{peek.kind}</p>
                    <p className="font-semibold break-words">{peek.title}</p>
                    {peek.sub && <p className="text-xs opacity-80 break-all">{peek.sub}</p>}
                    {!peek.href && <p className="text-[11px] opacity-60 mt-0.5">คุณไม่มีสิทธิ์เปิดหน้านี้ — ดูได้เฉพาะข้อมูลสรุป</p>}
                  </div>
                  {peek.href && <a href={peek.href} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary-600 text-white hover:bg-primary-700"><ExternalLink size={11} /> {peek.external ? 'เปิด URL' : 'เปิดดู (แท็บใหม่)'}</a>}
                  <button type="button" onClick={() => setPeek(null)} className="shrink-0 text-blue-400 hover:text-blue-700">✕</button>
                </div>
              )}
              {canEdit && (
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Button variant="secondary" onClick={() => { setDetail(null); openEdit(view) }}><Pencil size={14} /> แก้ไข</Button>
                  <Button variant="danger" onClick={() => remove(view)}><Trash2 size={14} /> ลบ</Button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      {/* เพิ่ม / แก้ไข */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'แก้ไขแอปพลิเคชัน' : 'เพิ่มแอปพลิเคชัน'} size="lg">
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className={labelClass}>ชื่อแอปพลิเคชัน *</label>
              <input required value={form.Title} onChange={e => setForm(f => ({ ...f, Title: e.target.value }))} className={inputClass} placeholder="เช่น ระบบใบเสนอราคา (Power Apps)" />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>URL</label>
              <input value={form.URL} onChange={e => setForm(f => ({ ...f, URL: e.target.value }))} className={inputClass} placeholder="https://…" />
            </div>
            <div>
              <label className={labelClass}>โครงการ</label>
              <select value={form.ProjectID ?? ''} onChange={e => { const pid = e.target.value ? Number(e.target.value) : null; setForm(f => ({ ...f, ProjectID: pid })); void pullFromProject(pid) }} className={inputClass}>
                <option value="">— ไม่ผูก —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>สถานะ</label>
              <select value={form.Status} onChange={e => setForm(f => ({ ...f, Status: e.target.value as AppStatus }))} className={inputClass}>
                {STATUS.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>ลูกค้า / ผู้ใช้งาน</label>
              <input value={form.Customer} onChange={e => setForm(f => ({ ...f, Customer: e.target.value }))} className={inputClass} placeholder="ชื่อบริษัทหรือหน่วยงานที่ใช้งาน" />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>บันทึก (Note)</label>
              <textarea rows={3} value={form.Note} onChange={e => setForm(f => ({ ...f, Note: e.target.value }))} className={inputClass} placeholder="ข้อมูลการส่งมอบ, วิธีใช้, ผู้ติดต่อ, ข้อควรระวัง…" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
            <span className="flex-1 text-gray-500">{pulling ? 'กำลังดึงข้อมูลจากโครงการ…' : pullNote || 'เลือกโครงการแล้วระบบจะดึง Asset · Portal · Ticket · Incident · ลูกค้า ของโครงการมาให้อัตโนมัติ (แก้/เอาออกได้)'}</span>
            {form.ProjectID && <button type="button" onClick={() => void pullFromProject(form.ProjectID)} disabled={pulling} className="px-2.5 py-1 rounded-full border border-primary-300 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30 disabled:opacity-50">↻ ดึงจากโครงการ</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MultiPick label="Asset" icon={<Server size={12} />} options={assets} value={form.assets} onChange={v => setForm(f => ({ ...f, assets: v }))} hint="ค้นหาเครื่อง / Asset…" />
            <MultiPick label="Portal" icon={<Globe size={12} />} options={portals} value={form.portals} onChange={v => setForm(f => ({ ...f, portals: v }))} hint="ค้นหา Portal…" />
            <MultiPick label="Ticket" icon={<Ticket size={12} />} options={sortByProject(tickets)} value={form.tickets} onChange={v => setForm(f => ({ ...f, tickets: v }))} hint="ค้นหาเลข Ticket / หัวข้อ…" />
            <MultiPick label="Incident" icon={<Siren size={12} />} options={sortByProject(incidents)} value={form.incidents} onChange={v => setForm(f => ({ ...f, incidents: v }))} hint="ค้นหา Incident…" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก…' : editing ? 'บันทึกการแก้ไข' : 'เพิ่มแอปพลิเคชัน'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
