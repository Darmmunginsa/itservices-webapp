import { useEffect, useMemo, useState } from 'react'
import { Users, Search, ChevronDown, ChevronRight, ZoomIn, ZoomOut, FileDown, AlertTriangle, Camera, X, Pencil } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { PersonPhoto, PHOTO_PREFIX, isPhotoFile, clearPhotoCache } from '../components/common/PersonPhoto'
import { makeSquareImageFile } from '../utils/imageFile'
import { spGet, spUpdate, spUploadAttachment, spDeleteAttachment, spGetAttachments } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n/useT'
import { SELF_APPROVE } from '../components/calendar/CompanyCalendar'
import type { AgentProfile } from '../types/common'

// ── ผังองค์กร ──
// สร้างจาก HD_AgentProfiles โดยใช้ ApproverEmail เป็น "ผู้บังคับบัญชา"
// (ฟิลด์เดียวกับที่ใช้อนุมัติวันลา — ไม่ต้องเพิ่มคอลัมน์ใหม่ และข้อมูลไม่แตกเป็นสองชุด)
const norm = (e?: string) => (e ?? '').trim().toLowerCase()

const ROLE_STYLE: Record<string, string> = {
  Admin:      'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Boss:       'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Supervisor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Agent:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  EndUser:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
}

// รายชื่อ + ชื่อไฟล์แนบ (ใช้หารูปพนักงาน)
type AgentRow = AgentProfile & { AttachmentFiles?: { FileName: string }[] }

export default function OrgChart() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [zoom, setZoom] = useState(1)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // ดึงชื่อไฟล์รูปมาพร้อมรายชื่อในคำขอเดียว ($expand) — ไม่ต้องยิงถามไฟล์แนบทีละคน
  function loadAgents() {
    // ใช้ '*' ไม่ระบุชื่อคอลัมน์ทีละตัว — ทนต่อ schema ที่ยังไม่มีคอลัมน์ Position
    // (ถ้า $select ระบุคอลัมน์ที่ไม่มีอยู่ SharePoint จะตอบ 400 ทำให้ทั้งหน้าโหลดไม่ขึ้น)
    spGet<AgentRow>('HD_AgentProfiles', undefined, '*,AttachmentFiles/FileName', 'Title asc', 500, 'AttachmentFiles')
      .then(setAgents)
      .catch(() => {
        // เผื่อ $expand ใช้ไม่ได้ → โหลดแบบไม่มีรูป ยังเห็นผังปกติ
        spGet<AgentRow>('HD_AgentProfiles', undefined, undefined, 'Title asc', 500)
          .then(setAgents).catch(() => {})
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => { loadAgents() }, [])

  const photoOf = (a?: AgentRow) => a?.AttachmentFiles?.find(f => isPhotoFile(f.FileName))?.FileName

  /** อัปโหลดรูปได้: ของตัวเอง หรือ Admin/Boss (แก้ให้คนอื่นได้) */
  const canEditPhoto = (a: AgentRow) =>
    norm(a.EmailText) === norm(user?.email) || ['Admin', 'Boss'].includes(user?.role ?? '')

  const [uploadingId, setUploadingId] = useState<number | null>(null)
  async function uploadPhoto(a: AgentRow, file: File) {
    setUploadingId(a.id)
    try {
      const photo = await makeSquareImageFile(file, 128, PHOTO_PREFIX)
      // ต้องใช้ชื่อที่ SharePoint บันทึกจริง (ถูก sanitize + เติมสุ่มกันซ้ำ)
      const storedName = await spUploadAttachment('HD_AgentProfiles', a.id, photo)
      // ลบรูปเก่าทุกไฟล์ ไม่ให้เหลือหลายรูปแล้วเลือกผิดใบ
      try {
        const files = await spGetAttachments('HD_AgentProfiles', a.id)
        for (const f of files) {
          if (f.FileName !== storedName && isPhotoFile(f.FileName)) {
            try { await spDeleteAttachment('HD_AgentProfiles', a.id, f.FileName) } catch { /* ข้าม */ }
          }
        }
      } catch { /* อ่านรายการไฟล์ไม่ได้ — รูปใหม่ยังใช้ได้ */ }
      clearPhotoCache(a.id)
      addToast('success', `อัปเดตรูปของ ${a.Title} แล้ว`)
      loadAgents()
    } catch { addToast('error', 'อัปโหลดรูปไม่สำเร็จ') }
    finally { setUploadingId(null) }
  }

  // ── แก้ตำแหน่งงาน (inline) — สิทธิ์เดียวกับการเปลี่ยนรูป ──
  const [editPosId, setEditPosId] = useState<number | null>(null)
  const [posDraft, setPosDraft] = useState('')
  const [savingPos, setSavingPos] = useState(false)

  function startEditPos(a: AgentRow) {
    setEditPosId(a.id)
    setPosDraft(a.Position ?? '')
  }
  async function savePosition(a: AgentRow) {
    const value = posDraft.trim()
    if (value === (a.Position ?? '')) { setEditPosId(null); return }
    setSavingPos(true)
    try {
      await spUpdate('HD_AgentProfiles', a.id, { Position: value || null })
      addToast('success', `อัปเดตตำแหน่งของ ${a.Title} แล้ว`)
      setEditPosId(null)
      loadAgents()
    } catch {
      // ยังไม่มีคอลัมน์ Position → บอกให้ชัดว่าต้องไปสร้างก่อน (ไม่ใช่ error ลอยๆ)
      addToast('error', 'บันทึกไม่ได้ — ต้องเพิ่มคอลัมน์ Position (Single line of text) ใน HD_AgentProfiles ก่อน')
    } finally { setSavingPos(false) }
  }

  async function removePhoto(a: AgentRow) {
    const f = photoOf(a)
    if (!f || !window.confirm(`ลบรูปของ ${a.Title}?`)) return
    try {
      await spDeleteAttachment('HD_AgentProfiles', a.id, f)
      clearPhotoCache(a.id)
      addToast('success', 'ลบรูปแล้ว')
      loadAgents()
    } catch { addToast('error', 'ลบรูปไม่สำเร็จ') }
  }

  // ── สร้างโครงต้นไม้จาก ApproverEmail ──
  const { roots, childrenOf, byEmail, orphans } = useMemo(() => {
    const byEmail = new Map<string, AgentProfile>()
    for (const a of agents) if (norm(a.EmailText)) byEmail.set(norm(a.EmailText), a)

    const childrenOf = new Map<string, string[]>()
    const roots: string[] = []
    for (const a of agents) {
      const me = norm(a.EmailText)
      if (!me) continue
      const boss = norm(a.ApproverEmail)
      // เป็นระดับสูงสุดเมื่อ: ไม่ได้กำหนดผู้อนุมัติ / อนุมัติเอง / ชี้กลับมาที่ตัวเอง / ผู้อนุมัติไม่มีใน profile
      if (!boss || boss === norm(SELF_APPROVE) || boss === me || !byEmail.has(boss)) {
        roots.push(me)
      } else {
        const arr = childrenOf.get(boss) ?? []
        arr.push(me); childrenOf.set(boss, arr)
      }
    }

    // กันข้อมูลวน (A→B→A) ทำให้บางคนหลุดจากผัง — หาคนที่เข้าไม่ถึงจาก root แล้วยกขึ้นเป็น root
    const reachable = new Set<string>()
    const queue = [...roots]
    while (queue.length) {
      const cur = queue.shift()!
      if (reachable.has(cur)) continue
      reachable.add(cur)
      for (const k of childrenOf.get(cur) ?? []) queue.push(k)
    }
    const orphans = [...byEmail.keys()].filter(e => !reachable.has(e))

    const sortByName = (a: string, b: string) =>
      (byEmail.get(a)?.Title ?? '').localeCompare(byEmail.get(b)?.Title ?? '', 'th')
    roots.sort(sortByName)
    for (const [, arr] of childrenOf) arr.sort(sortByName)

    return { roots: [...roots, ...orphans], childrenOf, byEmail, orphans: new Set(orphans) }
  }, [agents])

  const matches = (email: string) => {
    if (!search.trim()) return false
    const a = byEmail.get(email)
    return [a?.Title, a?.EmailText, a?.SupportGroup, a?.SpecialtyCategory, a?.Position]
      .some(s => (s ?? '').toLowerCase().includes(search.toLowerCase()))
  }

  function toggle(email: string) {
    setCollapsed(prev => {
      const n = new Set(prev)
      n.has(email) ? n.delete(email) : n.add(email)
      return n
    })
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

  // ── การ์ดหนึ่งคน ──
  function NodeCard({ email }: { email: string }) {
    const a = byEmail.get(email)
    if (!a) return null
    const kids = childrenOf.get(email) ?? []
    const isMe = norm(user?.email) === email
    const hit = matches(email)
    const isCollapsed = collapsed.has(email)
    return (
      <div className={`group relative w-52 rounded-xl border px-3 py-2.5 bg-white dark:bg-gray-900 transition-colors ${
        isMe ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900'
        : hit ? 'border-amber-400 ring-2 ring-amber-200 dark:ring-amber-900/50'
        : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="flex items-start gap-2">
          <span className="relative flex-shrink-0">
            <PersonPhoto itemId={a.id} fileName={photoOf(a)} name={a.Title || email} size={38} />
            {canEditPhoto(a) && (
              <>
                <label title="เปลี่ยนรูป"
                  className={`no-print absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:text-primary-600 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity ${uploadingId === a.id ? 'opacity-100 pointer-events-none' : ''}`}>
                  <Camera size={10} />
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPhoto(a, f) }} />
                </label>
                {photoOf(a) && uploadingId !== a.id && (
                  <button onClick={() => removePhoto(a)} title="ลบรูป"
                    className="no-print absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={8} />
                  </button>
                )}
              </>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={a.Title}>{a.Title}</p>
            {/* ตำแหน่งงาน — คลิกดินสอเพื่อแก้ (เจ้าตัว หรือ Admin/Boss) */}
            {editPosId === a.id ? (
              <input autoFocus value={posDraft} disabled={savingPos}
                onChange={e => setPosDraft(e.target.value)}
                onBlur={() => savePosition(a)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); savePosition(a) }
                  if (e.key === 'Escape') setEditPosId(null)
                }}
                placeholder="เช่น IT Manager"
                className="no-print w-full mt-0.5 px-1 py-0.5 text-[11px] border border-primary-400 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 outline-none" />
            ) : (
              <p className="flex items-center gap-1 mt-0.5">
                <span className={`text-[11px] truncate ${a.Position ? 'text-gray-600 dark:text-gray-300 font-medium' : 'text-gray-300 dark:text-gray-600 italic'}`}
                  title={a.Position || ''}>
                  {a.Position || 'ยังไม่ระบุตำแหน่ง'}
                </span>
                {canEditPhoto(a) && (
                  <button onClick={() => startEditPos(a)} title="แก้ตำแหน่งงาน"
                    className="no-print flex-shrink-0 text-gray-300 hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil size={9} />
                  </button>
                )}
              </p>
            )}
            <p className="text-[10px] text-gray-400 truncate" title={a.EmailText}>{a.EmailText}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 mt-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_STYLE[a.Role] ?? ROLE_STYLE.EndUser}`}>{a.Role}</span>
          {a.SupportGroup && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">{a.SupportGroup}</span>}
          {a.IsAvailable === false && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">ไม่ว่าง</span>}
          {orphans.has(email) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 inline-flex items-center gap-0.5"
              title="สายบังคับบัญชาวนกลับมาที่ตัวเอง — ตรวจ ApproverEmail ใน HD_AgentProfiles">
              <AlertTriangle size={8} /> สายวน
            </span>
          )}
        </div>
        {kids.length > 0 && (
          <button onClick={() => toggle(email)}
            className="no-print absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-primary-600 hover:border-primary-300">
            {isCollapsed ? <ChevronRight size={9} /> : <ChevronDown size={9} />}{kids.length}
          </button>
        )}
      </div>
    )
  }

  // ── ต้นไม้ (recursive) — มี visited กันข้อมูลวนทำให้ render ไม่จบ ──
  function Node({ email, visited }: { email: string; visited: Set<string> }) {
    if (visited.has(email)) return null
    const kids = childrenOf.get(email) ?? []
    const showKids = kids.length > 0 && !collapsed.has(email)
    const nextVisited = new Set(visited).add(email)
    return (
      <div className="flex flex-col items-center">
        <NodeCard email={email} />
        {showKids && (
          <>
            {/* เส้นตั้งจากหัวหน้าลงมาถึงเส้นนอน */}
            <span className="w-px h-6 bg-gray-300 dark:bg-gray-700" />
            <div className="flex items-start">
              {kids.map((k, i) => (
                <div key={k} className="relative px-3 pt-6">
                  {/* เส้นตั้งขึ้นไปหาเส้นนอน */}
                  <span className="absolute left-1/2 top-0 w-px h-6 bg-gray-300 dark:bg-gray-700" />
                  {/* เส้นนอน: ครึ่งซ้าย (ไม่วาดที่ลูกคนแรก) + ครึ่งขวา (ไม่วาดที่ลูกคนสุดท้าย) */}
                  {i > 0 && <span className="absolute top-0 left-0 w-1/2 h-px bg-gray-300 dark:bg-gray-700" />}
                  {i < kids.length - 1 && <span className="absolute top-0 left-1/2 w-1/2 h-px bg-gray-300 dark:bg-gray-700" />}
                  <Node email={k} visited={nextVisited} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  const matchCount = search.trim() ? [...byEmail.keys()].filter(matches).length : 0

  return (
    <div>
      <Header title="ผังองค์กร" />
      <div className="p-4 md:p-6 space-y-4">

        {/* หัวเอกสาร — เฉพาะตอนพิมพ์ */}
        <div className="print-only mb-4 pb-3" style={{ borderBottom: '2px solid #111' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>ผังองค์กร — iT Services</h1>
          <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            พิมพ์เมื่อ {new Date().toLocaleString('th-TH')} · ทั้งหมด {agents.length} คน
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ / อีเมล / ทีม"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          {search.trim() && <span className="text-xs text-gray-400">พบ {matchCount} คน</span>}
          <span className="text-[10px] text-gray-400 w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} title="ย่อ"
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-600"><ZoomOut size={13} /></button>
          <button onClick={() => setZoom(z => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))} title="ขยาย"
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-600"><ZoomIn size={13} /></button>
          <button onClick={() => setCollapsed(new Set())}
            className="text-xs text-primary-600 underline">กางทั้งหมด</button>
          <Button size="sm" variant="secondary" onClick={exportPdf} disabled={loading}>
            <FileDown size={14} /> Export PDF
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-12 text-center">{tr('comp.loading')}</p>
        ) : agents.length === 0 ? (
          <Card className="text-center py-14">
            <Users size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">ยังไม่มีข้อมูลพนักงานใน HD_AgentProfiles</p>
          </Card>
        ) : (
          <>
            <div className="overflow-x-auto pb-6">
              <div className="inline-flex items-start gap-10 min-w-full justify-center px-4 py-2"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                {roots.map(r => <Node key={r} email={r} visited={new Set()} />)}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              ทั้งหมด {agents.length} คน · สายบังคับบัญชาอ่านจากช่อง “ผู้อนุมัติ” (ApproverEmail) ใน HD_AgentProfiles
            </p>
          </>
        )}
      </div>
    </div>
  )
}
