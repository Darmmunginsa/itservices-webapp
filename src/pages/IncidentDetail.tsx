import { useEffect, useRef, useState } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Edit2, FolderOpen, Pin, Trash2, UserCheck, X } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Skeleton } from '../components/common/Skeleton'
import { SearchSelect } from '../components/common/SearchSelect'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { SmartText } from '../components/common/SmartText'
import { CloseReply } from '../components/common/CloseReply'
import { CommentSection } from '../components/common/CommentSection'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { createNotification } from '../services/notificationService'
import { sendTemplateEmail } from '../services/emailService'
import { useAppStore } from '../store/useAppStore'
import type { ProjectIncident, Project } from '../types/project'
import type { AgentProfile, FocusItem } from '../types/common'
import { OptionSelect } from '../components/common/OptionSelect'
import { getStatusColor, getSeverityColor } from '../utils/colorUtils'
import { formatDate } from '../utils/dateUtils'
import { SLA_OPTIONS, computeSlaDue, slaInfo, slaCountdown, SLA_STATE_META } from '../utils/sla'
import { incidentMailPlan, justResolved, justAssigned } from '../utils/incidentMail'
import { assignWork, ackColumnWarning } from '../services/assignWork'
import { mailFailText } from '../utils/emailTemplate'
import { useT } from '../i18n/useT'

const STATUSES: ProjectIncident['Status'][] = ['Open', 'In Progress', 'Resolved']

/** หน่วงก่อนเด้งออกหลังปิดเคส — สั้นพอที่จะไม่รู้สึกค้าง ยาวพอให้เห็นว่าสำเร็จ */
const CLOSE_EXIT_MS = 1400
const CLOSED = ['Resolved', 'Closed', 'Done', 'Completed']

/**
 * พื้นที่ทำงานของ Incident — โครงเดียวกับ Ticket
 *
 * เดิม Incident แก้ได้แต่ในโมดัลบนหน้าโครงการ ซึ่งพอเคสยืดเยื้อก็ไม่มีที่คุยกัน
 * ไม่มีที่เก็บไฟล์เพิ่มระหว่างทาง และส่งลิงก์ให้ใครดูเฉพาะเคสนั้นไม่ได้
 * ทั้งที่ลักษณะงานเหมือน Ticket แทบทุกอย่าง ต่างกันแค่ Ticket คือคำขอ
 * ส่วน Incident คือปัญหาที่มีเส้นตาย
 */
export default function IncidentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string; fromLabel?: string } | null) ?? null
  const { user, addToast, celebrate } = useAppStore()
  const tr = useT()

  const [inc, setInc] = useState<ProjectIncident | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [commentsMissing, setCommentsMissing] = useState(false)

  const [newStatus, setNewStatus] = useState<ProjectIncident['Status']>('Open')
  const [resolution, setResolution] = useState('')
  const [saving, setSaving] = useState(false)
  const [newAssignedEmail, setNewAssignedEmail] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [slaHours, setSlaHours] = useState('')
  const [savingSla, setSavingSla] = useState(false)
  // แก้เนื้อเคส — เดิมทำได้แต่ในโมดัลบนหน้าโครงการ ซึ่งหายไปพร้อมกับการย้ายมาหน้านี้
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', severity: 'Medium', description: '', incidentDate: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const isBossAdmin = ['Boss', 'Admin'].includes(user?.role ?? '')

  // ตัวจับเวลาเด้งออกหลังปิดงาน — ต้องยกเลิกถ้าผู้ใช้เปลี่ยนหน้าเองก่อน
  // ไม่งั้นกดปิดงานแล้วรีบไปทำอย่างอื่น จะโดนดึงกลับมาที่หน้าเดิมแบบไม่รู้ตัว
  const exitTimer = useRef<number | null>(null)
  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current) }, [])

  function load() {
    if (!id || !/^\d+$/.test(id)) return
    spGet<ProjectIncident>('PM_Incidents', `Id eq ${id}`, '*,Author/Title,Author/EMail', undefined, 1, 'Author')
      .then(rows => {
        const it = rows[0] ?? null
        setInc(it)
        if (it) {
          setNewStatus(it.Status)
          setResolution(it.Resolution ?? '')
          setSlaHours(it.SLAHours ? String(it.SLAHours) : '')
          if (it.ProjectID) {
            spGet<Project>('PM_Projects', `Id eq ${it.ProjectID}`, '*', undefined, 1)
              .then(p => setProject(p[0] ?? null)).catch(() => {})
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc')
      .then(setAgents).catch(() => {})
    // ลิสต์คอมเมนต์ยังไม่ได้สร้างก็ต้องใช้หน้านี้ได้ — แค่ไม่มีที่คุย
    spGet('PM_IncidentComments', undefined, 'Id', undefined, 1)
      .catch(() => setCommentsMissing(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const info = inc ? slaInfo(inc) : null

  /** ผู้รับเมล — ใช้ตัวประกอบเดียวกับหน้าโครงการและ Add-in */
  function mailPlan(overrides: Partial<Parameters<typeof incidentMailPlan>[0]> = {}) {
    const agent = agents.find(a => a.EmailText === (overrides.assignedEmail ?? inc?.AssignedEmail))
    return incidentMailPlan({
      title: inc?.Title ?? '',
      severity: inc?.Severity ?? '',
      status: newStatus,
      description: inc?.Description,
      resolution,
      incidentDate: inc?.IncidentDate,
      slaHours: inc?.SLAHours ?? null,
      projectName: project?.Title,
      projectId: inc?.ProjectID,
      assignedName: agent?.Title ?? inc?.AssignedTo,
      assignedEmail: inc?.AssignedEmail,
      requesterEmail: inc?.Author?.EMail || inc?.CreatedByEmail,
      watchers: [project?.CreatedByEmail],
      actorEmail: user?.email,
      baseUrl: window.location.origin + window.location.pathname,
      ...overrides,
    })
  }

  async function mail(eventKey: string, label: string, overrides?: Partial<Parameters<typeof incidentMailPlan>[0]>) {
    const plan = mailPlan(overrides)
    if (plan.to.length === 0) return
    const res = await sendTemplateEmail(eventKey, plan.vars, plan.to, plan.cc)
    // เงียบไม่ได้ — คนกดจะเชื่อว่าคนที่เกี่ยวข้องรู้เรื่องแล้ว และต้องบอกเหตุจริง
    const warn = mailFailText(`บันทึกแล้ว (เมล${label})`, res, eventKey, 'ผู้เกี่ยวข้องยังไม่รู้เรื่อง')
    if (warn) addToast('error', warn)
  }

  async function updateStatus() {
    if (!inc) return
    setSaving(true)
    const closing = CLOSED.includes(newStatus)
    try {
      const payload: Record<string, unknown> = {
        Status: newStatus,
        Resolution: resolution || undefined,
      }
      // ปิดเคสต้องมีเวลาปิด ไม่งั้นวัด SLA ไม่ได้ — ประทับให้ถ้ายังไม่มี
      if (closing && !inc.ResolvedDate) payload.ResolvedDate = new Date().toISOString()
      await spUpdate('PM_Incidents', inc.id, payload)
      setInc(prev => prev ? { ...prev, ...payload, Status: newStatus, Resolution: resolution } as ProjectIncident : prev)
      addToast('success', 'อัปเดตสถานะแล้ว')

      const requester = inc.Author?.EMail || inc.CreatedByEmail
      if (requester && requester.toLowerCase() !== (user?.email?.toLowerCase() ?? '')) {
        createNotification({
          recipients: [requester],
          title: `🚨 Incident เปลี่ยนสถานะเป็น ${newStatus}`,
          message: inc.Title,
          linkPath: `/incidents/${inc.id}`,
          eventType: 'incident_status_changed',
        })
      }
      if (justResolved(newStatus, inc.Status)) {
        await mail('incident_resolved', 'แจ้งปิดเคส')
      } else if (newStatus !== inc.Status) {
        // เปลี่ยนสถานะที่ไม่ใช่ปิด (เช่น Open → In Progress) — ผู้แจ้งควรรู้ว่าเคสเดินอยู่
        await mail('incident_status_changed', 'แจ้งสถานะ')
      }
      if (justResolved(newStatus, inc.Status)) {
        celebrate()
        // ปิดเคสแล้วไม่มีอะไรให้ทำต่อ — พากลับที่มา (ปลายทางเดียวกับปุ่มย้อนกลับ)
        exitTimer.current = window.setTimeout(
          () => navigate(from?.from ?? (inc.ProjectID ? `/projects/${inc.ProjectID}` : '/my-work')),
          CLOSE_EXIT_MS,
        )
      }
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  async function reassign() {
    if (!inc || !newAssignedEmail) return
    const agent = agents.find(a => a.EmailText === newAssignedEmail)
    setReassigning(true)
    try {
      // โยนงานให้คนอื่นต้องล้างสถานะ "รับงานแล้ว" ของคนก่อนหน้า
      const res = await assignWork('PM_Incidents', inc.id, newAssignedEmail,
        agent?.Title ?? '', user?.email, 'AssignedTo')
      if (res.missingAckColumns) addToast('error', ackColumnWarning('PM_Incidents'))
      const prevEmail = inc.AssignedEmail
      const selfAssign = newAssignedEmail.toLowerCase() === (user?.email?.toLowerCase() ?? '')
      setInc(prev => prev ? {
        ...prev,
        AssignedEmail: newAssignedEmail,
        AssignedTo: agent?.Title ?? '',
        IsAcknowledged: res.ackApplied ? selfAssign : prev.IsAcknowledged,
      } : prev)
      if (newAssignedEmail.toLowerCase() !== (user?.email?.toLowerCase() ?? '')) {
        createNotification({
          recipients: [newAssignedEmail],
          title: `🚨 คุณได้รับมอบหมาย Incident`,
          message: inc.Title,
          linkPath: `/incidents/${inc.id}`,
          eventType: 'incident_created',
        })
      }
      if (justAssigned(newAssignedEmail, prevEmail)) {
        await mail('incident_assigned', 'แจ้งผู้รับผิดชอบ', {
          assignedEmail: newAssignedEmail,
          assignedName: agent?.Title,
        })
      }
      addToast('success', `มอบหมายให้ ${agent?.Title ?? newAssignedEmail} แล้ว`)
      setNewAssignedEmail('')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setReassigning(false) }
  }

  /** แก้ SLA ระหว่างทาง — เส้นตายนับจากเวลาเปิดเคสเดิม ไม่ใช่เวลาที่มากดแก้ */
  async function saveSla() {
    if (!inc) return
    setSavingSla(true)
    const h = slaHours ? Number(slaHours) : null
    try {
      await spUpdate('PM_Incidents', inc.id, { SLAHours: h, SLADue: computeSlaDue(h, inc.Created) })
      setInc(prev => prev ? { ...prev, SLAHours: h ?? undefined, SLADue: computeSlaDue(h, inc.Created) ?? undefined } : prev)
      addToast('success', 'อัปเดต SLA แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingSla(false) }
  }

  function openEdit() {
    if (!inc) return
    setForm({
      title: inc.Title,
      severity: inc.Severity,
      description: inc.Description ?? '',
      incidentDate: (inc.IncidentDate ?? '').slice(0, 10),
    })
    setEditing(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!inc || !form.title.trim()) return
    setSavingEdit(true)
    try {
      const payload = {
        Title: form.title.trim(),
        Severity: form.severity,
        Description: form.description || undefined,
        IncidentDate: form.incidentDate || undefined,
      }
      await spUpdate('PM_Incidents', inc.id, payload)
      setInc(prev => prev ? { ...prev, ...payload } as ProjectIncident : prev)
      setEditing(false)
      addToast('success', 'บันทึกการแก้ไขแล้ว')
    } catch { addToast('error', 'บันทึกไม่สำเร็จ') } finally { setSavingEdit(false) }
  }

  async function removeIncident() {
    if (!inc) return
    if (!window.confirm(`ลบ Incident "${inc.Title}"?\n\nคอมเมนต์และไฟล์แนบของเคสนี้จะเข้าถึงไม่ได้อีก`)) return
    try {
      await spDelete('PM_Incidents', inc.id)
      addToast('success', 'ลบ Incident แล้ว')
      navigate(inc.ProjectID ? `/projects/${inc.ProjectID}` : '/my-work')
    } catch { addToast('error', 'ลบไม่สำเร็จ') }
  }

  async function pinToFocus() {
    if (!inc || !user) return
    try {
      await spCreate('HD_Focus', {
        Title: inc.Title,
        RefID: String(inc.id),
        FocusType: 'Incident' as FocusItem['FocusType'],
        FocusedBy: user.displayName,
        FocusedEmail: user.email,
        Status: inc.Status,
      })
      addToast('success', 'Pin ไว้ใน Focus Items แล้ว')
    } catch { addToast('error', 'ไม่สามารถ Pin ได้') }
  }

  if (loading) return <div className="p-6"><Skeleton className="h-96" /></div>
  if (!inc) return <div className="p-6 text-gray-400">ไม่พบ Incident นี้</div>

  const closing = CLOSED.includes(newStatus)
  const ic = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const agentOptions = agents
    .map(a => ({ value: a.EmailText ?? '', label: `${a.Title}${a.SupportGroup ? ` · ${a.SupportGroup}` : ''}` }))
    .filter(o => o.value)

  return (
    <div>
      <Header title={inc.Title}
        backTo={from?.from ?? (inc.ProjectID ? `/projects/${inc.ProjectID}` : '/my-work')}
        backLabel={from?.fromLabel ?? (project?.Title ?? tr('ticket.myWork'))} />

      <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4 min-w-0">

          {/* ── หัวเรื่อง + สถานะ ── */}
          <Card>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1 leading-snug">
                <AlertTriangle size={18} className="inline mr-1.5 text-red-500 align-[-2px]" />
                {inc.Title}
              </h2>
              <div className="flex gap-2 flex-shrink-0">
                <Badge className={getSeverityColor(inc.Severity)}>{inc.Severity}</Badge>
                <Badge className={getStatusColor(inc.Status)}>{inc.Status}</Badge>
              </div>
            </div>

            {/* นาฬิกา SLA — เคสที่ยังไม่ปิดต้องเห็นว่าเหลือเวลาเท่าไหร่ ไม่ใช่รู้ตอนเลยไปแล้ว */}
            {info && info.state !== 'none' && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-sm font-medium ${
                info.state === 'running' && (info.hoursLeft ?? 99) < 2
                  ? SLA_STATE_META.overdue.cls : SLA_STATE_META[info.state].cls}`}>
                ⏱ {info.hoursLeft !== null ? slaCountdown(info.hoursLeft) : SLA_STATE_META[info.state].label}
                {info.due && <span className="font-normal opacity-80"> · ครบกำหนด {info.due.toLocaleString('th-TH')}</span>}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <p className="text-xs text-gray-400">{tr('ticket.reporter')}</p>
                <p className="font-medium">{inc.Author?.Title || '-'}</p>
                <p className="text-xs text-gray-400 truncate">{inc.Author?.EMail || inc.CreatedByEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Assigned</p>
                <p className="font-medium">{inc.AssignedTo || '-'}</p>
                <p className="text-xs text-gray-400 truncate">{inc.AssignedEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">วันที่เกิดเหตุ</p>
                <p className="font-medium">{inc.IncidentDate ? formatDate(inc.IncidentDate) : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">ปิดเมื่อ</p>
                <p className="font-medium">{inc.ResolvedDate ? formatDate(inc.ResolvedDate) : '-'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {project && (
                <Link to={`/projects/${project.id}`}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-primary-600">
                  <FolderOpen size={13} /> {project.Title}
                </Link>
              )}
              <button type="button" onClick={pinToFocus} title="Pin ไว้ใน Focus Items"
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-primary-600">
                <Pin size={13} /> Pin
              </button>
              {isAgent && (
                <button type="button" onClick={openEdit} title="แก้ไขรายละเอียดเคส"
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-primary-600">
                  <Edit2 size={13} /> {tr('common.edit')}
                </button>
              )}
              {isBossAdmin && (
                <button type="button" onClick={removeIncident} title="ลบเคสนี้"
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-red-500 hover:text-red-600">
                  <Trash2 size={13} /> {tr('assets.delete')}
                </button>
              )}
            </div>

            {editing && (
              <form onSubmit={saveEdit} className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="ชื่อเคส" className={ic} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <OptionSelect category="IncidentSeverity" defaults={['Low', 'Medium', 'High', 'Critical']}
                    value={form.severity} onChange={v => setForm(f => ({ ...f, severity: v }))} className={ic} />
                  <input type="date" value={form.incidentDate}
                    onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} className={ic} />
                </div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4} placeholder="รายละเอียด" className={ic} />
                <div className="flex gap-2">
                  <Button size="sm" type="submit" disabled={savingEdit}>{savingEdit ? 'กำลังบันทึก...' : tr('common.save')}</Button>
                  <Button size="sm" variant="secondary" type="button" onClick={() => setEditing(false)}>
                    <X size={13} /> {tr('common.cancel')}
                  </Button>
                </div>
              </form>
            )}

            {!editing && inc.Description && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 mb-1">{tr('ticket.description')}</p>
                <SmartText text={inc.Description} className="text-sm text-gray-700 dark:text-gray-300" />
              </div>
            )}
          </Card>

          {/* ── จัดการเคส ── */}
          {isAgent && (
            <Card>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">จัดการเคส</p>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as ProjectIncident['Status'])}
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <Button size="sm" onClick={updateStatus} disabled={saving || (newStatus === inc.Status && resolution === (inc.Resolution ?? ''))}>
                  {saving ? 'กำลังบันทึก...' : tr('ticket.updateStatus')}
                </Button>
              </div>

              {/* วิธีแก้ไข — เห็นตอนกำลังปิดเคส ตอนยังไม่ปิดไม่ต้องรก */}
              {closing && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{tr('pd.howToFix')}</label>
                  <CloseReply
                    kind="Incident"
                    vars={{
                      ticket_number: project?.Title ?? '',
                      title: inc.Title,
                      customer_name: project?.Company ?? '',
                      agent_name: user?.displayName ?? '',
                      resolution,
                    }}
                    value={resolution}
                    onChange={setResolution}
                    className="mb-2"
                  />
                  <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={8}
                    placeholder={tr('ticket.resolutionPlaceholder')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              )}

              {/* SLA — แก้ได้ระหว่างทาง เพราะความรุนแรงที่ประเมินไว้ตอนแรกอาจเปลี่ยน */}
              <div className="flex flex-wrap items-center gap-2 mb-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500">SLA</span>
                <select value={slaHours} onChange={e => setSlaHours(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  <option value="">ไม่กำหนด</option>
                  {SLA_OPTIONS.map(o => <option key={o.hours} value={o.hours}>{o.labelTh}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={saveSla}
                  disabled={savingSla || slaHours === (inc.SLAHours ? String(inc.SLAHours) : '')}>
                  {savingSla ? '...' : 'บันทึก SLA'}
                </Button>
                <span className="text-xs text-gray-400">นับจากเวลาที่เปิดเคส</span>
              </div>

              {/* มอบหมายใหม่ */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <UserCheck size={14} className="text-gray-400" />
                <div className="w-56">
                  <SearchSelect options={agentOptions} value={newAssignedEmail}
                    onChange={setNewAssignedEmail} placeholder={tr('submit.searchAgent')} />
                </div>
                <Button size="sm" variant="outline" onClick={reassign} disabled={reassigning || !newAssignedEmail}>
                  {reassigning ? '...' : 'มอบหมาย'}
                </Button>
              </div>
            </Card>
          )}

          {/* ── การแก้ไข (ตอนปิดแล้ว) ── */}
          {inc.Resolution && !closing && (
            <Card>
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-green-600" /> {tr('pd.howToFix')}
              </p>
              <SmartText text={inc.Resolution} className="text-sm text-gray-700 dark:text-gray-300" />
            </Card>
          )}

          {/* ── ไฟล์แนบ ── */}
          <Card>
            <AttachmentSection listName="PM_Incidents" itemId={inc.id} readOnly={!isAgent} />
          </Card>
        </div>

        {/* ── คอมเมนต์ — คุยกันในเคสได้เหมือน Ticket ── */}
        <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {commentsMissing ? (
            <Card>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                ยังไม่ได้สร้างลิสต์ <code className="text-xs">PM_IncidentComments</code> ใน SharePoint —
                ดูขั้นตอนใน <code className="text-xs">docs/Incident-Workspace.md</code>
              </p>
            </Card>
          ) : (
            <CommentSection
              listName="PM_IncidentComments"
              parentField="IncidentID"
              parentId={inc.id}
              titleLabel={inc.Title}
              linkPath={`/incidents/${inc.id}`}
              mentionCandidates={agents.map(a => ({ name: a.Title, email: a.EmailText })).filter(c => c.email)}
              notifyEmails={[...new Set([
                inc.AssignedEmail,
                inc.Author?.EMail || inc.CreatedByEmail,
                project?.CreatedByEmail,
              ].filter(Boolean) as string[])]}
            />
          )}
        </div>
      </div>
    </div>
  )
}
