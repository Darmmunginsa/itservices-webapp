import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, CalendarDays, Megaphone, Pencil, ToggleLeft, ToggleRight, Plane, Mail, Eye } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Modal } from '../components/common/Modal'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spCreate, spDelete, spUpdate } from '../services/sharepoint'
import { clearEmailTemplateCache } from '../services/emailService'
import type { EmailTemplate } from '../services/emailService'
import { createCalendarEvent, deleteCalendarEvent } from '../services/graph'
import { useAppStore } from '../store/useAppStore'
import type { Holiday, Announcement, AgentProfile, LeaveQuota } from '../types/common'
import { formatDate } from '../utils/dateUtils'

const HOLIDAY_TYPES: Holiday['HolidayType'][] = ['ราชการ', 'บริษัท']
const EMPTY_FORM = { title: '', holidayDate: '', holidayType: 'บริษัท' as Holiday['HolidayType'] }

const EMPTY_ANN = { title: '', message: '', isActive: true, sortOrder: 0 }

export default function Admin() {
  const { addToast } = useAppStore()

  // Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [annLoading, setAnnLoading] = useState(true)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null)
  const [annForm, setAnnForm] = useState({ ...EMPTY_ANN })
  const [savingAnn, setSavingAnn] = useState(false)

  function load() {
    setLoading(true)
    spGet<Holiday>('HD_Holidays', undefined, undefined, 'HolidayDate asc', 200)
      .then(setHolidays).catch(() => {}).finally(() => setLoading(false))
  }

  function loadAnn() {
    setAnnLoading(true)
    spGet<Announcement>('HD_Announcements', undefined, undefined, 'SortOrder asc', 200)
      .then(setAnnouncements).catch(() => {}).finally(() => setAnnLoading(false))
  }

  // Leave quota state (per-employee)
  const [agentsList, setAgentsList] = useState<AgentProfile[]>([])
  const [savingApprover, setSavingApprover] = useState<number | null>(null)
  const [quotaEmail, setQuotaEmail] = useState('')      // พนักงานที่เลือก
  const [quotas, setQuotas] = useState<LeaveQuota[]>([]) // โควต้าของพนักงานที่เลือก
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [qForm, setQForm] = useState({ title: '', days: '' })
  const [savingQuota, setSavingQuota] = useState(false)

  const LEAVE_TYPES = ['ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาอื่นๆ']

  function loadAgentsList() {
    spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText,Role,ApproverEmail', 'Title asc', 500)
      .then(setAgentsList).catch(() => {})
  }

  function loadQuotas(email: string) {
    if (!email) { setQuotas([]); return }
    setQuotaLoading(true)
    spGet<LeaveQuota>('HD_LeaveQuota', `EmployeeEmail eq '${email}'`, 'Id,Title,Days,EmployeeEmail', 'Title asc', 100)
      .then(setQuotas).catch(() => {}).finally(() => setQuotaLoading(false))
  }

  async function addQuota(e: React.FormEvent) {
    e.preventDefault()
    if (!quotaEmail) { addToast('error', 'เลือกพนักงานก่อน'); return }
    if (!qForm.title.trim() || qForm.days === '') return
    if (quotas.some(q => q.Title === qForm.title.trim())) { addToast('error', 'ประเภทนี้มีอยู่แล้ว'); return }
    setSavingQuota(true)
    try {
      await spCreate('HD_LeaveQuota', { Title: qForm.title.trim(), Days: Number(qForm.days), EmployeeEmail: quotaEmail })
      setQForm({ title: '', days: '' })
      addToast('success', 'เพิ่มโควต้าวันลาแล้ว')
      loadQuotas(quotaEmail)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingQuota(false) }
  }

  async function updateQuotaDays(q: LeaveQuota, days: number) {
    if (days === q.Days) return
    setQuotas(prev => prev.map(x => x.id === q.id ? { ...x, Days: days } : x))
    try { await spUpdate('HD_LeaveQuota', q.id, { Days: days }) }
    catch { addToast('error', 'บันทึกไม่สำเร็จ'); loadQuotas(quotaEmail) }
  }

  async function deleteQuota(id: number, title: string) {
    if (!window.confirm(`ลบโควต้า "${title}"?`)) return
    try {
      await spDelete('HD_LeaveQuota', id)
      setQuotas(prev => prev.filter(q => q.id !== id))
      addToast('success', 'ลบแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  // คัดลอกโควต้าเริ่มต้นให้พนักงานที่เลือก (เฉพาะประเภทที่ยังไม่มี)
  async function applyDefaultQuota() {
    if (!quotaEmail) { addToast('error', 'เลือกพนักงานก่อน'); return }
    const defaults: Record<string, number> = { 'ลาพักร้อน': 6, 'ลาป่วย': 30, 'ลากิจ': 3 }
    const missing = Object.entries(defaults).filter(([t]) => !quotas.some(q => q.Title === t))
    if (missing.length === 0) { addToast('error', 'มีครบแล้ว'); return }
    setSavingQuota(true)
    try {
      for (const [title, days] of missing) {
        await spCreate('HD_LeaveQuota', { Title: title, Days: days, EmployeeEmail: quotaEmail })
      }
      addToast('success', `เพิ่มโควต้าเริ่มต้น ${missing.length} ประเภทแล้ว`)
      loadQuotas(quotaEmail)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingQuota(false) }
  }

  // Home video (HD_Options Category=HomeVideo, single row)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoRowId, setVideoRowId] = useState<number | null>(null)
  const [savingVideo, setSavingVideo] = useState(false)

  function loadVideo() {
    spGet<{ id: number; Title: string; Category: string }>('HD_Options', "Category eq 'HomeVideo'", 'Id,Title,Category')
      .then(rows => { if (rows[0]) { setVideoRowId(rows[0].id); setVideoUrl(rows[0].Title || '') } })
      .catch(() => {})
  }

  async function saveVideo() {
    setSavingVideo(true)
    try {
      if (videoRowId) await spUpdate('HD_Options', videoRowId, { Title: videoUrl })
      else {
        const res = await spCreate('HD_Options', { Title: videoUrl, Category: 'HomeVideo', SortOrder: 0 })
        setVideoRowId(res.id)
      }
      addToast('success', 'บันทึกวิดีโอหน้าหลักแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingVideo(false) }
  }

  useEffect(() => { load(); loadAnn(); loadVideo(); loadAgentsList() }, [])
  useEffect(() => { loadQuotas(quotaEmail) }, [quotaEmail])

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.holidayDate) return
    setSaving(true)
    try {
      await spCreate('HD_Holidays', {
        Title: form.title,
        HolidayDate: form.holidayDate,
        HolidayType: form.holidayType,
      })

      // สร้าง Calendar event + invite ทีมทั้งหมด
      try {
        const agents = await spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText')
        const attendees = agents.map(a => a.EmailText).filter(Boolean)

        // all-day event: end = วันถัดไป
        const startDate = new Date(form.holidayDate)
        const endDate = new Date(form.holidayDate)
        endDate.setDate(endDate.getDate() + 1)
        const toISO = (d: Date) => d.toISOString().split('T')[0] + 'T00:00:00'

        const calEvent = await createCalendarEvent({
          subject: `🏖 ${form.holidayType === 'ราชการ' ? '[วันหยุดราชการ]' : '[วันหยุดบริษัท]'} ${form.title}`,
          start: toISO(startDate),
          end: toISO(endDate),
          attendees,
          isAllDay: true,
          body: `วันหยุด${form.holidayType}: ${form.title}\nวันที่: ${form.holidayDate}`,
        })
        // บันทึก CalendarEventId กลับ SP เพื่อใช้ตอนลบ
        if (calEvent?.id) {
          const latest = await spGet<Holiday>('HD_Holidays',
            `Title eq '${form.title}' and HolidayDate eq '${form.holidayDate}'`)
          if (latest[0]) await spUpdate('HD_Holidays', latest[0].id, { CalendarEventId: calEvent.id })
        }
        addToast('success', `เพิ่มวันหยุดและส่ง Calendar invite ให้ทีม ${attendees.length} คนแล้ว`)
      } catch {
        addToast('success', 'เพิ่มวันหยุดสำเร็จ (Calendar invite ไม่สำเร็จ)')
      }

      setForm({ ...EMPTY_FORM })
      setShowAdd(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  async function deleteHoliday(id: number, title: string, calEventId?: string) {
    if (!window.confirm(`ลบ "${title}"?\nจะยกเลิก Calendar event ของทีมด้วย`)) return
    try {
      // ลบ Calendar event (ส่ง cancellation ให้ attendees อัตโนมัติ)
      if (calEventId) {
        try { await deleteCalendarEvent(calEventId) } catch { /* non-critical */ }
      }
      await spDelete('HD_Holidays', id)
      setHolidays(prev => prev.filter(h => h.id !== id))
      addToast('success', calEventId ? 'ลบวันหยุดและยกเลิก Calendar event แล้ว' : 'ลบวันหยุดแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  function openNewAnn() {
    setEditingAnn(null)
    setAnnForm({ ...EMPTY_ANN })
    setShowAnnModal(true)
  }

  function openEditAnn(ann: Announcement) {
    setEditingAnn(ann)
    setAnnForm({ title: ann.Title, message: ann.Message, isActive: ann.IsActive, sortOrder: ann.SortOrder })
    setShowAnnModal(true)
  }

  async function saveAnn(e: React.FormEvent) {
    e.preventDefault()
    if (!annForm.title.trim() || !annForm.message.trim()) return
    setSavingAnn(true)
    const payload = {
      Title: annForm.title,
      Message: annForm.message,
      IsActive: annForm.isActive,
      SortOrder: Number(annForm.sortOrder),
    }
    try {
      if (editingAnn) {
        await spUpdate('HD_Announcements', editingAnn.id, payload)
        addToast('success', 'บันทึกสำเร็จ')
      } else {
        await spCreate('HD_Announcements', payload)
        addToast('success', 'เพิ่มประกาศสำเร็จ')
      }
      setShowAnnModal(false)
      loadAnn()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingAnn(false) }
  }

  async function toggleAnn(ann: Announcement) {
    try {
      await spUpdate('HD_Announcements', ann.id, { IsActive: !ann.IsActive })
      setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, IsActive: !a.IsActive } : a))
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function deleteAnn(id: number, title: string) {
    if (!window.confirm(`ลบ "${title}"?`)) return
    try {
      await spDelete('HD_Announcements', id)
      setAnnouncements(prev => prev.filter(a => a.id !== id))
      addToast('success', 'ลบประกาศแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  const years = [...new Set(holidays.map(h => h.HolidayDate?.slice(0, 4)).filter(Boolean))].sort()
  const filtered = yearFilter
    ? holidays.filter(h => h.HolidayDate?.startsWith(yearFilter))
    : holidays

  // ── Email Templates ──────────────────────────────────────────────────────────
  // ชื่อ event ทั้งหมดที่ระบบรองรับ (ใช้ตรวจว่ามี template ครบไหม + สร้างที่ขาด)
  const TPL_LABELS: Record<string, string> = {
    ticket_created:          'Ticket Created',
    task_assigned:           'Task Assigned',
    ticket_status_changed:   'Ticket Status Changed',
    comment_added:           'Comment Added',
    comment_mention:         'Comment Mention (@)',
    incident_created:        'Incident Created',
    incident_status_changed: 'Incident Status Changed',
    leave_requested:         'Leave Requested',
    leave_decision:          'Leave Approved/Rejected',
  }

  const TPL_VARS: Record<string, { key: string; desc: string }[]> = {
    ticket_created: [
      { key: 'ticket_number', desc: 'หมายเลข Ticket' },
      { key: 'ticket_title',  desc: 'ชื่อ Ticket' },
      { key: 'priority',      desc: 'ความสำคัญ' },
      { key: 'category',      desc: 'ประเภท' },
      { key: 'description',   desc: 'รายละเอียด' },
      { key: 'customer_name', desc: 'ชื่อลูกค้า' },
      { key: 'assigned_name', desc: 'ชื่อ Agent' },
      { key: 'link',          desc: 'ลิงก์เข้าระบบ' },
    ],
    task_assigned: [
      { key: 'task_title',    desc: 'ชื่อ Task' },
      { key: 'assigned_name', desc: 'ชื่อ Agent' },
      { key: 'due_date',      desc: 'กำหนดส่ง' },
      { key: 'task_note',     desc: 'รายละเอียด/Task Note' },
      { key: 'link',          desc: 'ลิงก์เข้าระบบ' },
    ],
    ticket_status_changed: [
      { key: 'ticket_number',  desc: 'หมายเลข Ticket' },
      { key: 'ticket_title',   desc: 'ชื่อ Ticket' },
      { key: 'ticket_status',  desc: 'สถานะใหม่' },
      { key: 'customer_name',  desc: 'ชื่อลูกค้า' },
      { key: 'assigned_name',  desc: 'ชื่อ Agent' },
      { key: 'link',           desc: 'ลิงก์เข้าระบบ' },
    ],
    comment_added: [
      { key: 'ticket_number', desc: 'หมายเลข Ticket' },
      { key: 'ticket_title',  desc: 'ชื่อ Ticket' },
      { key: 'customer_name', desc: 'ชื่อลูกค้า' },
      { key: 'assigned_name', desc: 'ชื่อ Agent' },
      { key: 'comment_text',  desc: 'ข้อความ Comment' },
      { key: 'link',          desc: 'ลิงก์เข้าระบบ' },
    ],
    comment_mention: [
      { key: 'ticket_number', desc: 'หมายเลข Ticket' },
      { key: 'ticket_title',  desc: 'ชื่อ Ticket' },
      { key: 'mentioned_by',  desc: 'คนที่ tag คุณ' },
      { key: 'comment_text',  desc: 'ข้อความ/คำถาม' },
      { key: 'link',          desc: 'ลิงก์เข้าระบบ' },
    ],
    incident_created: [
      { key: 'incident_title',  desc: 'ชื่อ Incident' },
      { key: 'severity',        desc: 'ระดับความรุนแรง' },
      { key: 'incident_status', desc: 'สถานะ' },
      { key: 'assigned_name',   desc: 'ชื่อ Agent' },
      { key: 'description',     desc: 'รายละเอียด' },
      { key: 'link',            desc: 'ลิงก์เข้าระบบ' },
    ],
    incident_status_changed: [
      { key: 'incident_title',  desc: 'ชื่อ Incident' },
      { key: 'incident_status', desc: 'สถานะใหม่' },
      { key: 'severity',        desc: 'ระดับความรุนแรง' },
      { key: 'assigned_name',   desc: 'ชื่อ Agent' },
      { key: 'resolution',      desc: 'แนวทางแก้ไข' },
      { key: 'link',            desc: 'ลิงก์เข้าระบบ' },
    ],
    leave_requested: [
      { key: 'requester_name', desc: 'ชื่อพนักงานผู้ขอลา' },
      { key: 'leave_type',     desc: 'ประเภทการลา' },
      { key: 'leave_date',     desc: 'วันที่ลา' },
      { key: 'approver_name',  desc: 'ชื่อผู้อนุมัติ' },
      { key: 'link',           desc: 'ลิงก์เข้าระบบ' },
    ],
    leave_decision: [
      { key: 'requester_name', desc: 'ชื่อพนักงานผู้ขอลา' },
      { key: 'leave_type',     desc: 'ประเภทการลา' },
      { key: 'leave_date',     desc: 'วันที่ลา' },
      { key: 'leave_status',   desc: 'ผลการพิจารณา (อนุมัติ/ไม่อนุมัติ)' },
      { key: 'approver_name',  desc: 'ชื่อผู้อนุมัติ' },
      { key: 'link',           desc: 'ลิงก์เข้าระบบ' },
    ],
  }

  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([])
  const [emailLoading, setEmailLoading] = useState(true)
  const [editingTpl, setEditingTpl] = useState<EmailTemplate | null>(null)
  const [tplForm, setTplForm] = useState({ Subject: '', Body: '', IsEnabled: true, Recipients: '' })
  const [savingTpl, setSavingTpl] = useState(false)
  const [previewTpl, setPreviewTpl] = useState<EmailTemplate | null>(null)

  // refs สำหรับแทรกตัวแปรลงช่องที่กำลังเลือก (Subject / Body)
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<'Subject' | 'Body'>('Body')

  /** แทรก {{tag}} ลงช่องที่ focus ล่าสุด ณ ตำแหน่ง cursor */
  function insertVar(key: string) {
    const tag = `{{${key}}}`
    const field = lastFocused.current
    const el = field === 'Subject' ? subjectRef.current : bodyRef.current
    if (!el) {
      setTplForm(f => ({ ...f, [field]: f[field] + tag }))
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const cur = tplForm[field]
    const next = cur.slice(0, start) + tag + cur.slice(end)
    setTplForm(f => ({ ...f, [field]: next }))
    // คืน focus + ตั้ง cursor หลัง tag ที่แทรก
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + tag.length
      el.setSelectionRange(pos, pos)
    })
  }

  // บัญชีกลางสำหรับส่งอีเมล (Send As) — เก็บใน HD_Options Category='EmailConfig'
  const [senderRow, setSenderRow] = useState<{ id: number; Title: string } | null>(null)
  const [senderInput, setSenderInput] = useState('')
  const [savingSender, setSavingSender] = useState(false)

  useEffect(() => {
    spGet<EmailTemplate>('HD_EmailTemplates', undefined,
      'Id,Title,EventKey,Subject,Body,IsEnabled,Recipients')
      .then(setEmailTemplates).catch(() => {}).finally(() => setEmailLoading(false))
    spGet<{ id: number; Title: string; Category: string }>('HD_Options', "Category eq 'EmailConfig'", 'Id,Title,Category')
      .then(rows => {
        if (rows[0]) { setSenderRow(rows[0]); setSenderInput(rows[0].Title || '') }
      }).catch(() => {})
  }, [])

  // สร้าง template ที่ยังไม่มีใน HD_EmailTemplates (เช่น task_assigned ที่ขาด)
  const [creatingKey, setCreatingKey] = useState<string | null>(null)
  async function createTpl(eventKey: string) {
    setCreatingKey(eventKey)
    try {
      const title = TPL_LABELS[eventKey] ?? eventKey
      const res = await spCreate('HD_EmailTemplates', {
        Title: title,
        EventKey: eventKey,
        Subject: '',
        Body: '',
        IsEnabled: false,
        Recipients: '',
      })
      const row: EmailTemplate = { id: res.id, Title: title, EventKey: eventKey, Subject: '', Body: '', IsEnabled: false, Recipients: '' }
      setEmailTemplates(prev => [...prev, row])
      clearEmailTemplateCache()
      addToast('success', `สร้าง Template "${title}" แล้ว — กดแก้ไขเพื่อตั้งค่า`)
      openEditTpl(row)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
    finally { setCreatingKey(null) }
  }

  // กำหนดผู้อนุมัติการลาให้พนักงาน (Admin)
  async function setApprover(agentId: number, approverEmail: string) {
    setSavingApprover(agentId)
    try {
      await spUpdate('HD_AgentProfiles', agentId, { ApproverEmail: approverEmail || '' })
      setAgentsList(prev => prev.map(a => a.id === agentId ? { ...a, ApproverEmail: approverEmail } : a))
      addToast('success', 'บันทึกผู้อนุมัติแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
    finally { setSavingApprover(null) }
  }

  async function saveSender() {
    setSavingSender(true)
    try {
      const value = senderInput.trim()
      if (senderRow) {
        await spUpdate('HD_Options', senderRow.id, { Title: value })
        setSenderRow({ ...senderRow, Title: value })
      } else {
        const res = await spCreate('HD_Options', { Title: value, Category: 'EmailConfig', SortOrder: 0 })
        setSenderRow({ id: res.id, Title: value })
      }
      clearEmailTemplateCache()
      addToast('success', 'บันทึกบัญชีผู้ส่งแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
    finally { setSavingSender(false) }
  }

  function openEditTpl(tpl: EmailTemplate) {
    setEditingTpl(tpl)
    setTplForm({ Subject: tpl.Subject || '', Body: tpl.Body || '', IsEnabled: tpl.IsEnabled, Recipients: tpl.Recipients || '' })
  }

  async function saveTpl(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTpl) return
    setSavingTpl(true)
    try {
      await spUpdate('HD_EmailTemplates', editingTpl.id, {
        Subject: tplForm.Subject,
        Body: tplForm.Body,
        IsEnabled: tplForm.IsEnabled,
        Recipients: tplForm.Recipients,
      })
      clearEmailTemplateCache()
      setEmailTemplates(prev => prev.map(t => t.id === editingTpl.id
        ? { ...t, ...tplForm } : t))
      setEditingTpl(null)
      addToast('success', 'บันทึก Template แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingTpl(false) }
  }

  async function toggleTpl(tpl: EmailTemplate) {
    await spUpdate('HD_EmailTemplates', tpl.id, { IsEnabled: !tpl.IsEnabled })
    clearEmailTemplateCache()
    setEmailTemplates(prev => prev.map(t => t.id === tpl.id ? { ...t, IsEnabled: !t.IsEnabled } : t))
  }

  const SAMPLE_VARS: Record<string, string> = {
    ticket_number: 'HD-2026-0042',
    ticket_title: 'ไม่สามารถเข้าใช้งาน VPN ได้',
    customer_name: 'คุณสมชาย ใจดี',
    agent_name: 'Darm Munginsa',
    status: 'In Progress',
    link: window.location.origin,
    requester_name: 'คุณสมชาย ใจดี',
    leave_type: 'ลาพักร้อน',
    leave_date: '10 มิ.ย. 2569',
    leave_status: 'อนุมัติ',
    approver_name: 'ผู้จัดการ',
    comment_text: 'เราได้รับเรื่องของคุณแล้วและกำลังดำเนินการ',
    task_title: 'ติดตั้ง Windows 11',
  }

  function renderPreview(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE_VARS[k] ?? `{{${k}}}`)
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div>
      <Header title="Admin — จัดการข้อมูล" />
      <div className="p-4 md:p-6 space-y-6 max-w-3xl">

        {/* Announcements Management */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Megaphone size={18} className="text-primary-600" />
            <h2 className="text-sm font-semibold">ข้อความวิ่ง (HD_Announcements)</h2>
            <div className="ml-auto">
              <Button size="sm" onClick={openNewAnn}><Plus size={14} /> เพิ่มประกาศ</Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {annLoading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              : announcements.length === 0
                ? <p className="text-center text-sm text-gray-400 py-10">ไม่มีประกาศ</p>
                : announcements.map(ann => (
                    <div key={ann.id} className="flex items-start gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ann.Title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{ann.Message}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-400 mr-1">#{ann.SortOrder}</span>
                        <Badge className={ann.IsActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'}>
                          {ann.IsActive ? 'แสดง' : 'ซ่อน'}
                        </Badge>
                        <button onClick={() => toggleAnn(ann)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                          {ann.IsActive ? <ToggleRight size={16} className="text-primary-600" /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => openEditAnn(ann)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteAnn(ann.id, ann.Title)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
            }
          </div>
          <p className="text-xs text-gray-400 mt-2">{announcements.length} ประกาศ</p>
        </Card>

        {/* Holiday Management */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays size={18} className="text-primary-600" />
            <h2 className="text-sm font-semibold">วันหยุดบริษัท / ราชการ</h2>
            <div className="ml-auto flex items-center gap-2">
              {years.length > 0 && (
                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  <option value="">ทุกปี</option>
                  {years.map(y => <option key={y}>{y}</option>)}
                </select>
              )}
              <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> เพิ่มวันหยุด</Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? <p className="text-center text-sm text-gray-400 py-10">ไม่มีวันหยุด</p>
                : filtered.map(h => (
                    <div key={h.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{h.Title}</p>
                        <p className="text-xs text-gray-400">{formatDate(h.HolidayDate)}</p>
                      </div>
                      <Badge className={h.HolidayType === 'ราชการ'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}>
                        {h.HolidayType}
                      </Badge>
                      <button onClick={() => deleteHoliday(h.id, h.Title, h.CalendarEventId)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
            }
          </div>
          <p className="text-xs text-gray-400 mt-2">{filtered.length} วัน</p>
        </Card>

        {/* Leave Approver Management (per-employee) */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Plane size={18} className="text-primary-600" />
            <h2 className="text-sm font-semibold">ผู้อนุมัติการลารายบุคคล (HD_AgentProfiles)</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">กำหนดผู้อนุมัติของพนักงานแต่ละคน — พนักงานจะส่งคำขอลาไปหาผู้อนุมัติที่กำหนดนี้โดยอัตโนมัติ (เลือกเองไม่ได้)</p>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {agentsList.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{a.Title}</p>
                  <p className="text-xs text-gray-400 truncate">{a.EmailText}</p>
                </div>
                <select
                  value={a.ApproverEmail ?? ''}
                  disabled={savingApprover === a.id}
                  onChange={e => setApprover(a.id, e.target.value)}
                  className={`${inputClass} max-w-[55%]`}>
                  <option value="">-- ยังไม่กำหนด --</option>
                  {agentsList.filter(x => x.EmailText && x.EmailText !== a.EmailText).map(x => (
                    <option key={x.id} value={x.EmailText}>{x.Title} ({x.Role})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>

        {/* Leave Quota Management (per-employee) */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Plane size={18} className="text-primary-600" />
            <h2 className="text-sm font-semibold">โควต้าวันลารายบุคคล (HD_LeaveQuota)</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">เลือกพนักงานแล้วกำหนดจำนวนวันลาที่ใช้ได้ต่อปีในแต่ละประเภท — พนักงานจะกดตรวจสอบวันคงเหลือของตัวเองในฟอร์มขอลาได้</p>

          {/* Employee selector */}
          <div className="mb-3">
            <label className={labelClass}>พนักงาน</label>
            <select value={quotaEmail} onChange={e => setQuotaEmail(e.target.value)} className={inputClass}>
              <option value="">-- เลือกพนักงาน --</option>
              {agentsList.map(a => <option key={a.id} value={a.EmailText}>{a.Title} ({a.Role})</option>)}
            </select>
          </div>

          {quotaEmail && (
            <>
              {/* Add row */}
              <form onSubmit={addQuota} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 mb-3 space-y-2 border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-500 mb-1">เพิ่มโควต้าประเภทใหม่</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className={labelClass}>ประเภทการลา</label>
                    <select value={qForm.title} onChange={e => setQForm(f => ({ ...f, title: e.target.value }))} className={inputClass}>
                      <option value="">-- เลือกประเภท --</option>
                      {LEAVE_TYPES.filter(t => !quotas.some(q => q.Title === t)).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className={labelClass}>วันที่ใช้ได้/ปี</label>
                    <input type="number" min={0} value={qForm.days}
                      onChange={e => setQForm(f => ({ ...f, days: e.target.value }))}
                      placeholder="0" className={inputClass} />
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={savingQuota} className="w-full justify-center">
                  <Plus size={14} /> เพิ่มโควต้า
                </Button>
              </form>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                {quotaLoading
                  ? Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)
                  : quotas.length === 0
                    ? <div className="text-center py-8">
                        <p className="text-sm text-gray-400 mb-3">ยังไม่ได้กำหนดโควต้าให้พนักงานคนนี้</p>
                        <Button size="sm" variant="secondary" onClick={applyDefaultQuota} disabled={savingQuota}>ใช้ค่าเริ่มต้น (พักร้อน 6 / ป่วย 30 / กิจ 3)</Button>
                      </div>
                    : quotas.map(q => (
                        <div key={q.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{q.Title}</span>
                          <input type="number" min={0} defaultValue={q.Days}
                            onBlur={e => updateQuotaDays(q, Number(e.target.value))}
                            className="w-20 px-2 py-1 text-sm text-right border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          <span className="text-xs text-gray-400 w-10">วัน/ปี</span>
                          <button onClick={() => deleteQuota(q.id, q.Title)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                }
              </div>
              <p className="text-xs text-gray-400 mt-2">แก้จำนวนวันแล้วคลิกออกจากช่องเพื่อบันทึกอัตโนมัติ</p>
            </>
          )}
        </Card>

        {/* Home Video */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-red-600" />
            <h2 className="text-sm font-semibold">วิดีโอหน้าหลัก (YouTube)</h2>
          </div>
          <p className="text-xs text-gray-400 mb-2">วางลิงก์ YouTube (เช่น https://youtu.be/xxxx หรือ https://www.youtube.com/watch?v=xxxx) — เว้นว่างเพื่อซ่อน</p>
          <div className="flex gap-2">
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://youtu.be/..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <Button size="sm" onClick={saveVideo} disabled={savingVideo}>{savingVideo ? '...' : 'บันทึก'}</Button>
          </div>
        </Card>
        {/* Email Templates */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Mail size={18} className="text-primary-600" />
            <h2 className="text-sm font-semibold">Email Templates (HD_EmailTemplates)</h2>
          </div>

          {/* บัญชีกลางสำหรับส่งอีเมล (Send As) */}
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">บัญชีผู้ส่ง (Send As)</label>
            <div className="flex items-center gap-2 mt-1.5">
              <input value={senderInput} onChange={e => setSenderInput(e.target.value)}
                type="email" placeholder="support@itservices.co.th (เว้นว่าง = ใช้ค่า default นี้)"
                className={`${inputClass} flex-1`} />
              <Button type="button" onClick={saveSender} disabled={savingSender} className="flex-shrink-0">
                {savingSender ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              อีเมลแจ้งเตือนทั้งหมดจะส่งในนามบัญชีนี้ — ผู้ใช้ที่ login ต้องได้รับสิทธิ์ <strong>Send As</strong> บน mailbox นี้ใน Microsoft 365 ก่อน มิฉะนั้นจะส่งไม่สำเร็จ
            </p>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            ตัวแปรที่ใช้ได้จะแสดงเฉพาะของแต่ละ Template เมื่อกดแก้ไข (✏️)
          </p>
          {emailLoading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : emailTemplates.map(tpl => (
              <div key={tpl.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{tpl.Title}</p>
                    <code className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{tpl.EventKey}</code>
                  </div>
                  {tpl.Subject
                    ? <p className="text-xs text-gray-500 mt-0.5 truncate">{tpl.Subject}</p>
                    : <p className="text-xs text-orange-400 mt-0.5">⚠️ ยังไม่ได้ตั้งค่า Subject</p>}
                  {tpl.Recipients && <p className="text-xs text-gray-400 mt-0.5">ส่งถึง: {tpl.Recipients}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge className={tpl.IsEnabled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}>
                    {tpl.IsEnabled ? 'เปิด' : 'ปิด'}
                  </Badge>
                  <button onClick={() => setPreviewTpl(tpl)} title="Preview"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => openEditTpl(tpl)} title="แก้ไข"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => toggleTpl(tpl)} title="เปิด/ปิด"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                    {tpl.IsEnabled
                      ? <ToggleRight size={16} className="text-primary-600" />
                      : <ToggleLeft size={16} className="text-gray-400" />}
                  </button>
                </div>
              </div>
            ))}

          {/* Template ที่ยังไม่มี — กดสร้างได้เลย */}
          {!emailLoading && Object.keys(TPL_LABELS)
            .filter(k => !emailTemplates.some(t => t.EventKey === k))
            .map(k => (
              <div key={k} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 bg-orange-50/40 dark:bg-orange-900/10">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-500">{TPL_LABELS[k]}</p>
                    <code className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{k}</code>
                  </div>
                  <p className="text-xs text-orange-500 mt-0.5">⚠️ ยังไม่มี Template นี้ในระบบ</p>
                </div>
                <Button type="button" size="sm" disabled={creatingKey === k}
                  onClick={() => createTpl(k)} className="flex-shrink-0">
                  <Plus size={14} /> {creatingKey === k ? 'กำลังสร้าง...' : 'สร้าง'}
                </Button>
              </div>
            ))}
        </Card>

      </div>

      {/* Edit Template Modal */}
      <Modal open={!!editingTpl} onClose={() => setEditingTpl(null)}
        title={`แก้ไข Template: ${editingTpl?.Title ?? ''}`} size="lg">
        <form onSubmit={saveTpl} className="space-y-4">

          {/* Variables reference */}
          {editingTpl && TPL_VARS[editingTpl.EventKey] && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">ตัวแปรที่ใช้ได้ใน Template นี้ — คลิกที่ช่อง Subject หรือ Body ก่อน แล้วคลิกตัวแปรเพื่อแทรก</p>
              <div className="flex flex-wrap gap-1.5">
                {TPL_VARS[editingTpl.EventKey].map(v => (
                  <button key={v.key} type="button"
                    title={v.desc}
                    onClick={() => insertVar(v.key)}
                    className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                    <code>{`{{${v.key}}}`}</code>
                    <span className="text-gray-400 text-[10px]">— {v.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Subject *</label>
            <input ref={subjectRef} required value={tplForm.Subject}
              onChange={e => setTplForm(f => ({ ...f, Subject: e.target.value }))}
              onFocus={() => { lastFocused.current = 'Subject' }}
              className={inputClass} placeholder="เช่น [iT Services] Ticket {{ticket_number}} — {{ticket_title}}" />
          </div>
          <div>
            <label className={labelClass}>ส่งถึง (Recipients)</label>
            <input value={tplForm.Recipients} onChange={e => setTplForm(f => ({ ...f, Recipients: e.target.value }))}
              className={inputClass} placeholder="customer, agent, approver, requester (คั่นด้วย ,)" />
            <p className="text-xs text-gray-400 mt-1">ใช้สำหรับอ้างอิงเท่านั้น — code จะส่งอีเมลที่ถูกต้องตาม event</p>
          </div>
          <div>
            <label className={labelClass}>Body (HTML)</label>
            <textarea ref={bodyRef} required value={tplForm.Body}
              onChange={e => setTplForm(f => ({ ...f, Body: e.target.value }))}
              onFocus={() => { lastFocused.current = 'Body' }}
              onKeyDown={e => e.key === 'Enter' && e.stopPropagation()}
              rows={10} className={`${inputClass} font-mono text-xs resize-y`}
              placeholder={'<p>สวัสดีคุณ <strong>{{customer_name}}</strong>,</p>\n<p>Ticket <strong>{{ticket_number}}</strong> ...</p>'} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={tplForm.IsEnabled}
              onChange={e => setTplForm(f => ({ ...f, IsEnabled: e.target.checked }))}
              className="w-4 h-4 accent-primary-600" />
            เปิดใช้งาน Template นี้
          </label>
          <Button type="submit" disabled={savingTpl} className="w-full justify-center">
            {savingTpl ? 'กำลังบันทึก...' : 'บันทึก Template'}
          </Button>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal open={!!previewTpl} onClose={() => setPreviewTpl(null)}
        title={`Preview: ${previewTpl?.Title ?? ''}`} size="lg">
        {previewTpl && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Subject</p>
              <p className="text-sm bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                {renderPreview(previewTpl.Subject || '(ว่าง)')}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Body (rendered)</p>
              <div className="text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-80 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: renderPreview(previewTpl.Body || '<em>(ว่าง)</em>') }} />
            </div>
          </div>
        )}
      </Modal>

      {/* Add Holiday Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="เพิ่มวันหยุด" size="sm">
        <form onSubmit={addHoliday} className="space-y-4">
          <div>
            <label className={labelClass}>ชื่อวันหยุด *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={inputClass} placeholder="เช่น วันปีใหม่, วันหยุดชดเชย..." />
          </div>
          <div>
            <label className={labelClass}>วันที่ *</label>
            <input required type="date" value={form.holidayDate}
              onChange={e => setForm(f => ({ ...f, holidayDate: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ประเภท</label>
            <div className="flex gap-2">
              {HOLIDAY_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, holidayType: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.holidayType === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full justify-center">
            {saving ? 'กำลังบันทึก...' : 'เพิ่มวันหยุด'}
          </Button>
        </form>
      </Modal>

      {/* Add/Edit Announcement Modal */}
      <Modal open={showAnnModal} onClose={() => setShowAnnModal(false)}
        title={editingAnn ? 'แก้ไขประกาศ' : 'เพิ่มประกาศ'} size="sm">
        <form onSubmit={saveAnn} className="space-y-4">
          <div>
            <label className={labelClass}>ชื่อประกาศ *</label>
            <input required value={annForm.title}
              onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))}
              className={inputClass} placeholder="เช่น ประกาศปิดระบบ..." />
          </div>
          <div>
            <label className={labelClass}>ข้อความวิ่ง *</label>
            <textarea required rows={3} value={annForm.message}
              onChange={e => setAnnForm(f => ({ ...f, message: e.target.value }))}
              className={inputClass} placeholder="ข้อความที่จะแสดงบนแถบวิ่ง..." />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={labelClass}>ลำดับ (SortOrder)</label>
              <input type="number" min={0} value={annForm.sortOrder}
                onChange={e => setAnnForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className={inputClass} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>สถานะ</label>
              <div className="flex gap-2 mt-1">
                {[true, false].map(v => (
                  <button key={String(v)} type="button"
                    onClick={() => setAnnForm(f => ({ ...f, isActive: v }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      annForm.isActive === v
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                    {v ? 'แสดง' : 'ซ่อน'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button type="submit" disabled={savingAnn} className="w-full justify-center">
            {savingAnn ? 'กำลังบันทึก...' : editingAnn ? 'บันทึก' : 'เพิ่มประกาศ'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
