import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SLA_OPTIONS, SLA_BY_SEVERITY, computeSlaDue } from '../utils/sla'
import { ackOnCreate } from '../utils/ackInbox'
import { reporterFields, reporterWatchers, REPORTER_COLUMNS, type ReporterKind } from '../utils/reporter'
import { notifyAssigned, assignFailMessage } from '../services/ackNotify'
import { textToHtml, appLink, mailFailText } from '../utils/emailTemplate'
import { meetingBody } from '../utils/meetingBody'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { OptionSelect } from '../components/common/OptionSelect'
import { SearchSelect, SearchMultiSelect } from '../components/common/SearchSelect'
import { getDirectoryPeople, DirectoryConsentError } from '../services/graph'
import { mergePeople, type DirectoryPerson } from '../utils/people'
import { incidentMailPlan } from '../utils/incidentMail'
import { buildGroups, toggleGroup, customerOptions, presetCustomerEmails, type ProjectCustomer } from '../utils/customerGroups'
import { spGet, spCreate } from '../services/sharepoint'
import { sendTemplateEmail } from '../services/emailService'
import { createNotification } from '../services/notificationService'
import { useT } from '../i18n/useT'
import { createCalendarEvent } from '../services/graph'
import { useAppStore } from '../store/useAppStore'
import type { AgentProfile } from '../types/common'
import type { Contract } from '../types/ticket'
import type { Project } from '../types/project'

type SubmitType = 'Ticket' | 'Task' | 'Incident'

// เก็บรายชื่อไว้แค่ช่วง session — ปิดแท็บแล้วหาย จะได้ไม่ค้างเมื่อมีคนเข้า/ออกบริษัท
const DIR_CACHE = 'hdDirectoryPeople'

function readCachedDirectory(): DirectoryPerson[] {
  try { return JSON.parse(sessionStorage.getItem(DIR_CACHE) ?? '[]') } catch { return [] }
}

const DEPARTMENTS = ['IT', 'HR', 'บัญชี/การเงิน', 'ฝ่ายขาย', 'ฝ่ายการตลาด', 'Operations', 'ผู้บริหาร', 'อื่นๆ']
const DEFAULT_CATEGORIES = ['IT Hardware', 'IT Software', 'Network', 'Access & Account', 'IT Security', 'Other']

// 07:00–21:00 in 30-min steps
const HOURS = Array.from({ length: 29 }, (_, i) => {
  const h = String(Math.floor(i / 2) + 7).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const EMPTY_FORM = {
  title: '', description: '', priority: 'Medium',
  category: '', department: '', customerEmail: '', customerName: '',
  assignedEmail: '', assignedName: '',
  dueDate: '', daysCount: '',
  projectId: '', taskNote: '',
  incidentSeverity: 'Medium',
  incidentSlaHours: String(SLA_BY_SEVERITY.Medium),   // SLA ตั้งต้นตามความรุนแรง
  incidentDate: new Date().toISOString().slice(0, 10),
  incidentStatus: 'Open',
  // Calendar
  calendarDate: '', startHour: '09:00', endHour: '10:00', externalAttendees: '',
}

export default function Submit() {
  const { user, addToast } = useAppStore()
  const t = useT()
  const [type, setType] = useState<SubmitType>('Ticket')
  const [loading, setLoading] = useState(false)
  const [addCalendar, setAddCalendar] = useState(false)
  const [trackItem, setTrackItem] = useState(false)
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false)

  const cachedDirectory = useMemo(() => readCachedDirectory(), [])

  // Multi-select for calendar attendees
  const [calInternalEmails, setCalInternalEmails] = useState<string[]>([])
  // รายชื่อคนทั้งองค์กร — โหลดครั้งเดียวต่อ session แล้วเก็บไว้ ไม่ยิงซ้ำทุกครั้งที่เข้าหน้านี้
  const [directory, setDirectory] = useState<DirectoryPerson[]>(cachedDirectory)
  // เริ่มที่ loading เลยเมื่อยังไม่มีของใน cache — จะได้ไม่ต้อง setState ใน effect
  const [dirState, setDirState] = useState<'idle' | 'loading' | 'need-consent' | 'error'>(
    cachedDirectory.length ? 'idle' : 'loading')
  const [calCustomerEmails, setCalCustomerEmails] = useState<string[]>([])

  // Master data
  const [categories, setCategories] = useState<Array<{ id: number; Title: string }>>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  // ผู้ติดต่อฝั่งลูกค้าที่ผูกไว้กับโครงการ — ใช้ทำกลุ่มให้เลือกทีเดียวทั้งชุด
  const [projectCustomers, setProjectCustomers] = useState<ProjectCustomer[]>([])
  const [activeProjectsOnly, setActiveProjectsOnly] = useState(true)

  const [searchParams] = useSearchParams()
  // มาจากปุ่ม "เปิด Ticket ในโครงการนี้" → เติมโครงการให้ล่วงหน้า
  const [form, setForm] = useState({ ...EMPTY_FORM, projectId: searchParams.get('project') ?? '' })

  useEffect(() => {
    spGet<{ id: number; Title: string }>('HD_Categories', undefined, undefined, 'Title asc')
      .then(setCategories).catch(() => {})
    // Load ALL agents — no IsAvailable filter
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc')
      .then(setAgents).catch(() => {})
    // Load ALL projects — filter client-side via activeProjectsOnly
    spGet<Project>('PM_Projects', undefined, undefined, 'Title asc')
      .then(setProjects).catch(() => {})
    // Include Active + Inactive contracts, exclude only Expired
    spGet<Contract>('HD_Contracts', "Status ne 'Expired'", undefined, 'Title asc')
      .then(setContracts).catch(() => {})
    // ยังไม่ได้สร้างลิสต์นี้ก็ไม่เป็นไร — แค่ไม่มีกลุ่มให้เลือก
    spGet<ProjectCustomer>('PM_ProjectCustomers', undefined, undefined, 'Title asc', 2000)
      .then(rows => {
        setProjectCustomers(rows)
        // มาจากปุ่มในโครงการ (?project=) → ลูกค้าของโครงการนั้นถูกเลือกไว้ให้เลย เอาออกได้
        const pid = Number(searchParams.get('project') ?? '')
        if (pid) setCalCustomerEmails(presetCustomerEmails(rows, pid))
      }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // กรอง Active อย่างเดียวก็จริง แต่โครงการที่เลือกไว้แล้วต้องอยู่ในลิสต์เสมอ
  // ไม่งั้นถ้าโครงการนั้นไม่ใช่ Active ช่องจะว่างทั้งที่ผูกอยู่ แล้วบันทึกทับเป็นไม่ผูก
  const filteredProjects = activeProjectsOnly
    ? projects.filter(p => p.Status === 'Active' || String(p.id) === form.projectId)
    : projects

  const set = (key: keyof typeof EMPTY_FORM, val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  // เปลี่ยนโครงการ = เปลี่ยนชุดลูกค้าที่รอไว้ — แทนที่ทั้งชุด ไม่ใช่เติมทับ
  // ไม่งั้นสลับโครงการไปมาแล้วลูกค้าของโครงการก่อนจะติดมาด้วย
  const selectProject = (pid: string) => {
    set('projectId', pid)
    setCalCustomerEmails(pid ? presetCustomerEmails(projectCustomers, Number(pid)) : [])
  }

  const selectAgent = (email: string) => {
    const agent = agents.find(a => a.EmailText === email)
    setForm(f => ({ ...f, assignedEmail: email, assignedName: agent?.Title ?? '' }))
  }

  const selectCustomer = (title: string) => {
    const contract = contracts.find(c => c.Title === title)
    setForm(f => ({ ...f, customerName: title, customerEmail: contract?.CustomerEmail ?? '' }))
  }

  /**
   * สร้างรายการพร้อมคนแจ้งสำรอง — ถ้าลิสต์ยังไม่มีคอลัมน์ ReporterName/Email
   * SharePoint จะปฏิเสธทั้งรายการ → สร้างซ้ำโดยไม่ใส่ แล้วบอกให้ไปเพิ่มคอลัมน์
   * งานต้องถูกสร้างได้เสมอ คอลัมน์ที่ขาดเป็นเรื่องรอง
   */
  async function createWithReporter(list: string, kind: ReporterKind, payload: Record<string, unknown>) {
    const rep = reporterFields(kind, { name: form.customerName, email: form.customerEmail })
    if (Object.keys(rep).length === 0 || kind === 'Ticket') return spCreate(list, { ...payload, ...rep })
    try {
      return await spCreate(list, { ...payload, ...rep })
    } catch {
      const created = await spCreate(list, payload)
      addToast('error', `บันทึกแล้ว แต่เก็บคนแจ้งสำรองไม่ได้ — ต้องเพิ่มคอลัมน์ ${REPORTER_COLUMNS[kind]} ก่อน`)
      return created
    }
  }

  const computedDueDate = () => {
    if (form.daysCount && Number(form.daysCount) > 0) {
      const d = new Date()
      d.setDate(d.getDate() + Number(form.daysCount))
      return d.toISOString().slice(0, 10)
    }
    return form.dueDate || undefined
  }

  const genTicketNumber = () => {
    const now = new Date()
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    return `HD-${ymd}-${Math.floor(Math.random() * 900 + 100)}`
  }

  const buildCalendarAttendees = () => [
    ...calInternalEmails,
    ...calCustomerEmails,
    ...form.externalAttendees.split(',').map(s => s.trim()).filter(Boolean),
  ]

  function resetAll() {
    setForm({ ...EMPTY_FORM })
    setAddCalendar(false)
    setTrackItem(false)
    setIsOnlineMeeting(false)
    setCalInternalEmails([])
    setCalCustomerEmails([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      if (type === 'Ticket') {
        const ticketNum = genTicketNumber()
        const dueDate = computedDueDate()
        const created = await spCreate('HD_Tickets', {
          Title: form.title,
          TicketNumber: ticketNum,
          Status: 'Open',
          Priority: form.priority,
          Category: form.category || undefined,
          Department: form.department || undefined,
          Description: form.description || undefined,
          CustomerEmail: form.customerEmail || user.email,
          CustomerName: form.customerName || user.displayName,
          AssignedEmail: form.assignedEmail || undefined,
          AssignedToName: form.assignedName || undefined,
          IsAcknowledged: false,
          DueDate: dueDate ?? null,
          // Ticket = คำขอให้ทำบางอย่าง อาจอยู่ในโครงการหรือไม่ก็ได้ → ไม่บังคับ
          ProjectID: form.projectId ? Number(form.projectId) : null,
        })

        if (addCalendar && form.calendarDate) {
          await createCalendarEvent({
            subject: `[${ticketNum}] ${form.title}`,
            start: `${form.calendarDate}T${form.startHour}:00`,
            end: `${form.calendarDate}T${form.endHour}:00`,
            attendees: buildCalendarAttendees(),
            // เนื้อนัดแบบทางการ — ผู้เข้าร่วม (รวมลูกค้าที่เข้าระบบไม่ได้) เห็นครบในนัดเดียว
            bodyHtml: meetingBody({
              kind: 'Ticket', ref: ticketNum, title: form.title,
              projectName: projects.find(p => String(p.id) === form.projectId)?.Title,
              assigneeName: form.assignedName, customerName: form.customerName,
              priority: form.priority, due: computedDueDate() ?? form.dueDate,
              description: form.description, organizer: user.displayName,
              link: created?.id ? appLink(`/tickets/${created.id}`) : appLink(), isOnlineMeeting,
            }),
            isOnlineMeeting,
          })
        }

        if (trackItem && created?.id) {
          await spCreate('HD_Tracking', {
            Title: form.title,
            TrackingType: 'Ticket',
            RefID: created.id,
            TrackedBy: user.displayName,
            TrackedEmail: user.email,
            AssignedTo: form.assignedName,
            Status: 'Open',
            IsAcknowledged: false,
          })
        }
        // Email: 1 ฉบับ — To = ลูกค้า, CC = agent + ผู้แจ้ง (อยู่ใน thread เดียว reply ได้)
        // เดิมยิงแล้วไม่รอผล — template หายหรือ Graph ล้ม ลูกค้าไม่ได้เมล แต่หน้าจอบอกสำเร็จ
        const mailRes = await sendTemplateEmail('ticket_created', {
          ticket_number: ticketNum,
          ticket_title: form.title,
          priority: form.priority || '-',
          category: form.category || '-',
          description: textToHtml(form.description || '-'),
          customer_name: form.customerName || user.displayName,
          assigned_name: form.assignedName || '-',
          link: appLink(),
        },
          [form.customerEmail || user.email],            // To
          // CC = ผู้รับผิดชอบ + ผู้แจ้ง + ลูกค้าใน loop (ลูกค้าหลักอยู่ที่ To แล้ว service ตัดซ้ำให้)
          [form.assignedEmail, user.email, ...calCustomerEmails].filter(Boolean) as string[],  // CC
        )
        const mailWarn = mailFailText(`สร้าง Ticket ${ticketNum} แล้ว`, mailRes, 'ticket_created', 'ลูกค้ายังไม่ได้รับเมล')
        if (mailWarn) addToast('error', mailWarn)
        else addToast('success', `สร้าง Ticket สำเร็จ (${ticketNum})`)

      } else if (type === 'Task') {
        const dueDate = computedDueDate()
        const created = await createWithReporter('PM_Tasks', 'Task', {
          Title: form.title,
          ProjectID: Number(form.projectId),
          IsCompleted: false,
          IsAcknowledged: false,
          AssignedTo: form.assignedName || undefined,
          AssignedEmail: form.assignedEmail || undefined,
          DueDate: dueDate ?? null,
          TaskNote: form.taskNote || undefined,
        })

        if (addCalendar && form.calendarDate) {
          await createCalendarEvent({
            subject: form.title,
            start: `${form.calendarDate}T${form.startHour}:00`,
            end: `${form.calendarDate}T${form.endHour}:00`,
            attendees: buildCalendarAttendees(),
            bodyHtml: meetingBody({
              kind: 'Task', title: form.title,
              projectName: projects.find(p => String(p.id) === form.projectId)?.Title,
              assigneeName: form.assignedName, customerName: form.customerName,
              due: dueDate ?? undefined, description: form.taskNote || form.description,
              organizer: user.displayName,
              link: form.projectId ? appLink(`/projects/${form.projectId}`) : appLink(), isOnlineMeeting,
            }),
            isOnlineMeeting,
          })
        }

        if (trackItem && created?.id) {
          await spCreate('HD_Tracking', {
            Title: form.title,
            TrackingType: 'Task',
            RefID: created.id,
            TrackedBy: user.displayName,
            TrackedEmail: user.email,
            AssignedTo: form.assignedName,
            Status: 'Pending',
            IsAcknowledged: false,
          })
        }
        // แจ้งเตือน agent ที่ถูก assign (in-app) — ยกเว้นคนสร้างเอง
        if (form.assignedEmail && form.assignedEmail.toLowerCase() !== user.email.toLowerCase()) {
          createNotification({
            recipients: [form.assignedEmail],
            title: `📋 ได้รับมอบหมาย Task: ${form.title}`,
            message: form.taskNote || (dueDate ? `กำหนดส่ง ${dueDate}` : 'มี Task ใหม่'),
            linkPath: form.projectId ? `/projects/${form.projectId}` : '/my-work',
            eventType: 'task_assigned',
          })
        }
        // Task ไม่มีเมลของตัวเองเลย — แจ้งในแอปอย่างเดียวคือหวังว่าเขาจะเปิดแอปมาเห็น
        // Ticket ไม่ต้องเพิ่มตรงนี้ เพราะผู้รับผิดชอบถูก CC ในเมล ticket_created อยู่แล้ว
        // ส่งสองฉบับเรื่องเดียวกันแย่กว่าฉบับเดียวที่ดี
        if (form.assignedEmail && form.assignedEmail.toLowerCase() !== user.email.toLowerCase()) {
          const mail = await notifyAssigned({
            kind: 'Task', id: 0, title: form.title,
            cc: calCustomerEmails,
            link: form.projectId ? `/projects/${form.projectId}` : '/my-work',
            fromEmail: user.email, fromName: user.displayName,
            due: dueDate ?? undefined, status: 'Open', note: form.taskNote,
            agentName: form.assignedName || form.assignedEmail, agentEmail: form.assignedEmail,
          })
          const warn = mail.sent ? null : assignFailMessage(mail.reason, mail.detail)
          if (warn) addToast('error', warn)
        }
        addToast('success', 'สร้าง Task สำเร็จ')

      } else if (type === 'Incident') {
        // กันอีกชั้น — ถ้า required ของฟอร์มถูกข้ามไปได้ ก็ยังต้องไม่มี Incident ที่ไม่มีโครงการ
        if (!form.projectId) {
          addToast('error', 'ต้องเลือกโครงการที่เกี่ยวข้องก่อนจึงจะบันทึก Incident ได้')
          setLoading(false)
          return
        }
        const agent = agents.find(a => a.EmailText === form.assignedEmail)
        const createdInc = await createWithReporter('PM_Incidents', 'Incident', {
          Title: form.title,
          ProjectID: Number(form.projectId),
          Severity: form.incidentSeverity,
          Status: form.incidentStatus,
          Description: form.description || undefined,
          AssignedTo: (agent?.Title ?? form.assignedName) || undefined,
          AssignedEmail: form.assignedEmail || undefined,
          // เคสที่มอบหมายให้คนอื่นต้องไปรอในกล่อง "รอรับงาน" ก่อน
          // (Ticket กับ Task ทำอยู่แล้ว แต่ Incident ตกไป)
          ...ackOnCreate(form.assignedEmail, user.email),
          IncidentDate: form.incidentDate || undefined,
          // SLA — เคสใหม่จึงนับจากตอนนี้ (ยังไม่มี Created ให้อ้าง)
          SLAHours: form.incidentSlaHours ? Number(form.incidentSlaHours) : null,
          SLADue: computeSlaDue(form.incidentSlaHours ? Number(form.incidentSlaHours) : null),
          // เปิดเป็น Resolved เลย ก็ต้องรู้ว่าปิดเมื่อไหร่ ไม่งั้นวัด SLA ไม่ได้
          ...(form.incidentStatus === 'Resolved' ? { ResolvedDate: new Date().toISOString() } : {}),
        })
        // ปฏิทินกับ Track — Incident เคยไม่มีสองอย่างนี้ ทั้งที่เป็นงานที่ต้องนัดและตามมากกว่า Ticket
        if (addCalendar && form.calendarDate) {
          try {
            await createCalendarEvent({
              subject: `[Incident] ${form.title}`,
              start: `${form.calendarDate}T${form.startHour}:00`,
              end: `${form.calendarDate}T${form.endHour}:00`,
              attendees: buildCalendarAttendees(),
              bodyHtml: meetingBody({
                kind: 'Incident', title: form.title,
                projectName: projects.find(p => String(p.id) === form.projectId)?.Title,
                assigneeName: form.assignedName, customerName: form.customerName,
                priority: form.incidentSeverity,
                due: (() => { const d = computeSlaDue(form.incidentSlaHours ? Number(form.incidentSlaHours) : null); return d ? new Date(d).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : undefined })(),
                description: form.description, organizer: user.displayName,
                link: createdInc?.id ? appLink(`/incidents/${createdInc.id}`) : appLink(), isOnlineMeeting,
              }),
              isOnlineMeeting,
            })
          } catch { addToast('error', 'บันทึก Incident แล้ว แต่สร้างนัดหมายไม่สำเร็จ') }
        }
        if (trackItem && createdInc?.id) {
          await spCreate('HD_Tracking', {
            Title: form.title,
            TrackingType: 'Incident',
            RefID: createdInc.id,
            TrackedBy: user.displayName,
            TrackedEmail: user.email,
            AssignedTo: form.assignedName,
            Status: form.incidentStatus,
            IsAcknowledged: false,
          })
        }
        // แจ้งเตือน Assigned เมื่อสร้าง Incident (in-app) — ยกเว้นคนสร้างเอง
        if (form.assignedEmail && form.assignedEmail.toLowerCase() !== user.email.toLowerCase()) {
          createNotification({
            recipients: [form.assignedEmail],
            title: `🚨 ได้รับมอบหมาย Incident: ${form.title}`,
            message: `ความรุนแรง ${form.incidentSeverity}${form.description ? ' — ' + form.description.slice(0, 120) : ''}`,
            linkPath: `/projects/${form.projectId}`,
            eventType: 'incident_created',
          })
        }
        // แจ้งทางอีเมลด้วย — แจ้งเตือนในแอปคนเห็นก็ต่อเมื่อเปิดแอปอยู่
        // Incident คือเรื่องเร่งด่วน รอให้คนบังเอิญเข้าแอปไม่ทัน
        {
          const proj = projects.find(p => String(p.id) === form.projectId)
          const plan = incidentMailPlan({
            title: form.title,
            severity: form.incidentSeverity,
            status: form.incidentStatus,
            description: form.description,
            incidentDate: form.incidentDate,
            slaHours: form.incidentSlaHours ? Number(form.incidentSlaHours) : null,
            projectName: proj?.Title,
            projectId: form.projectId,
            assignedName: form.assignedName,
            assignedEmail: form.assignedEmail,
            requesterEmail: user.email,
            // คนแจ้งสำรองคือเจ้าของปัญหาจริง — ต้องได้เมลด้วย เหมือนลูกค้าของ Ticket
            watchers: [proj?.CreatedByEmail, ...reporterWatchers(form.customerEmail), ...calCustomerEmails],
            actorEmail: user.email,
            baseUrl: window.location.origin + window.location.pathname,
          })
          if (plan.to.length > 0) {
            const res = await sendTemplateEmail('incident_created', plan.vars, plan.to, plan.cc)
            const warn = mailFailText('บันทึกแล้ว', res, 'incident_created', 'ผู้รับผิดชอบยังไม่รู้เรื่อง')
            if (warn) addToast('error', warn)
          }
        }
        addToast('success', 'บันทึก Incident สำเร็จ')
      }

      resetAll()
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const cx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const lx = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  async function loadDirectory(interactive: boolean) {
    try {
      const people = await getDirectoryPeople(interactive) as DirectoryPerson[]
      setDirectory(people)
      setDirState('idle')
      try { sessionStorage.setItem(DIR_CACHE, JSON.stringify(people)) } catch { /* โควตาเต็มก็ไม่เป็นไร */ }
    } catch (e) {
      setDirState(e instanceof DirectoryConsentError ? 'need-consent' : 'error')
    }
  }

  // ลองดึงเงียบ ๆ ครั้งแรก — เคยยินยอมแล้วจะได้เลย ยังไม่เคยก็ไม่รบกวน
  useEffect(() => {
    // loadDirectory เป็น async — setState เกิดหลัง await ทั้งหมด ไม่ได้ยิงตอน effect ทำงาน
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    if (directory.length === 0) void loadDirectory(false)
  }, [])

  // ทีมซัพพอร์ตขึ้นก่อน แล้วต่อด้วยคนอื่นในองค์กร
  const internalPeopleOptions = mergePeople(agents, directory)

  // Searchable dropdown options — agent: value = EmailText
  const agentOptions = agents
    .map(a => ({ value: a.EmailText ?? '', label: `${a.Title}${a.SupportGroup ? ` · ${a.SupportGroup}` : ''}` }))
    .filter(o => o.value)

  // Contract single-select — value = Title (for selectCustomer lookup)
  const contractOptions = contracts.map(c => ({
    value: c.Title,
    label: `${c.Title}${c.Company ? ` (${c.Company})` : ''}`,
  }))

  // Contract multi-select (calendar attendees) — value = CustomerEmail
  // รวมลูกค้าจากสัญญา + ผู้ติดต่อในโครงการ ไม่งั้นเลือกกลุ่มมาแล้วจะเห็นอีเมลลอย ๆ ไม่มีชื่อ
  const contractEmailOptions = customerOptions(contracts, projectCustomers)
  const customerGroups = buildGroups(projects, projectCustomers)

  // Calendar section shared by Ticket and Task
  // คนแจ้งสำรอง — เลือกจากทะเบียนลูกค้า หรือพิมพ์เองก็ได้ (คนนอกที่ไม่อยู่ในทะเบียนมีเสมอ)
  // ใช้ช่อง customerName/customerEmail ชุดเดียวทั้งสามชนิด แล้วค่อยแปลงชื่อคอลัมน์ตอนบันทึก
  // เป็นฟังก์ชันคืน JSX ไม่ใช่ component ในตัว — component ที่ประกาศระหว่าง render
  // จะถูกสร้างใหม่ทุกครั้งที่พิมพ์ ช่องกรอกหลุดโฟกัสทีละตัวอักษร
  function renderReporter() {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-3 space-y-2">
        <label className={lx}>🙋 คนแจ้งสำรอง (ลูกค้า / คนนอกที่แจ้งเรื่องมา)</label>
        <SearchSelect
          options={contractOptions}
          value={contracts.some(c => c.Title === form.customerName) ? form.customerName : ''}
          onChange={selectCustomer}
          placeholder="เลือกจากทะเบียนลูกค้า…"
          emptyLabel={`-- ไม่ระบุ (แจ้งเอง: ${user?.displayName ?? ''}) --`}
        />
        <div className="grid grid-cols-2 gap-2">
          <input value={form.customerName} onChange={e => set('customerName', e.target.value)}
            placeholder="หรือพิมพ์ชื่อ" className={cx} />
          <input type="email" value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)}
            placeholder="อีเมล (จะได้รับเมลแจ้งด้วย)" className={cx} />
        </div>
        <p className="text-[11px] text-gray-400">
          ว่างไว้ = คุณเป็นผู้แจ้งเอง · ระบุแล้วคนนี้จะขึ้นเป็น "แจ้งแทน" และได้เมลตอนเปิด/มอบหมาย/ปิดงาน
        </p>
      </div>
    )
  }

  /**
   * ลูกค้าใน loop — คนชุดเดียวกันได้ทั้ง "เมลแจ้ง" และ "นัดหมายปฏิทิน"
   *
   * เดิมอยู่ในส่วนปฏิทิน จึงเห็นก็ต่อเมื่อติ๊กเพิ่มนัด และมีผลแค่กับนัด
   * แต่ลูกค้าของโครงการควรรู้เรื่องงานที่เกี่ยวกับเขาตั้งแต่เมลฉบับแรก ไม่ใช่รอนัดถึงจะเห็น
   * เลือกไว้ให้ก่อนจากลูกค้าของโครงการ — ตัดออกได้ ตัวที่เหลือคือคนที่จะได้เมลจริง
   */
  function renderCustomerLoop() {
    return (
      <div>
        <label className={lx}>🔔 ลูกค้าใน loop (ได้เมลแจ้ง + นัดหมาย)</label>
        <SearchMultiSelect
          label="ลูกค้า"
          options={contractEmailOptions}
          groups={customerGroups}
          onToggleGroup={g => setCalCustomerEmails(prev => toggleGroup(
            { ...g, projectId: 0 }, prev))}
          selected={calCustomerEmails}
          onToggle={v => setCalCustomerEmails(prev =>
            prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v]
          )}
        />
        <p className="text-[11px] text-gray-400 mt-1 truncate">
          {calCustomerEmails.length > 0
            ? `จะได้เมล: ${calCustomerEmails.join(', ')}`
            : form.projectId
              ? 'โครงการนี้ยังไม่มีลูกค้าผูกไว้ — เลือกเพิ่มได้ หรือเว้นไว้'
              : 'เลือกโครงการแล้วลูกค้าของโครงการจะถูกเลือกไว้ให้'}
        </p>
      </div>
    )
  }

  // เหตุผลเดียวกับ renderReporter — ประกาศเป็น component ในตัวแล้วช่องวันที่หลุดโฟกัสตอนพิมพ์
  function renderCalendar() {
    return (
      <div className="space-y-3 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
        <p className="text-xs font-medium text-primary-600">{t('submit.calTitle')}</p>

        {/* Date + time */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-3 sm:col-span-1">
            <label className={lx}>{t('submit.date')} *</label>
            <input required={addCalendar} type="date" value={form.calendarDate}
              onChange={e => set('calendarDate', e.target.value)} className={cx} />
          </div>
          <div>
            <label className={lx}>{t('submit.start')}</label>
            <select value={form.startHour} onChange={e => set('startHour', e.target.value)} className={cx}>
              {HOURS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label className={lx}>{t('submit.end')}</label>
            <select value={form.endHour} onChange={e => set('endHour', e.target.value)} className={cx}>
              {HOURS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
        </div>

        {/* Online meeting */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isOnlineMeeting} onChange={e => setIsOnlineMeeting(e.target.checked)}
            className="rounded accent-primary-600" />
          <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.teams')}</span>
        </label>

        {/* Internal attendees */}
        <div>
          <label className={lx}>
            {t('submit.internalAttendees')}
            {directory.length > 0 && (
              <span className="ml-1 font-normal text-gray-400">· ทั้งองค์กร {internalPeopleOptions.length} คน</span>
            )}
          </label>
          <SearchMultiSelect
            label="Internal"
            options={internalPeopleOptions}
            selected={calInternalEmails}
            onToggle={v => setCalInternalEmails(prev =>
              prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v]
            )}
          />
          {/* ยังไม่ได้ยินยอมให้อ่านรายชื่อ — เลือกจากทีมซัพพอร์ตได้ตามปกติ แต่บอกว่ามีทางขยาย */}
          {dirState === 'need-consent' && (
            <button type="button" onClick={() => { setDirState('loading'); loadDirectory(true) }}
              className="text-xs text-primary-600 hover:underline mt-1">
              + แสดงรายชื่อทุกคนในองค์กร (ต้องกดยินยอมครั้งเดียว)
            </button>
          )}
          {dirState === 'loading' && <p className="text-xs text-gray-400 mt-1">กำลังโหลดรายชื่อ...</p>}
          {dirState === 'error' && (
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              โหลดรายชื่อทั้งองค์กรไม่สำเร็จ — ยังเลือกจากทีมซัพพอร์ตได้ตามปกติ
            </p>
          )}
          {calInternalEmails.length > 0 && (
            <p className="text-xs text-gray-400 mt-1 truncate">{calInternalEmails.join(', ')}</p>
          )}
        </div>

        {/* ลูกค้าย้ายไปอยู่นอกส่วนปฏิทิน (renderCustomerLoop) — เขาอยู่ใน loop เมลด้วย ไม่ใช่แค่นัดหมาย */}

        {/* External emails */}
        <div>
          <label className={lx}>{t('submit.externalEmail')}</label>
          <input value={form.externalAttendees} onChange={e => set('externalAttendees', e.target.value)}
            className={cx} placeholder="ext@company.com, partner@co.th" />
        </div>

        {buildCalendarAttendees().length > 0 && (
          <p className="text-xs text-primary-600">
            รวม {buildCalendarAttendees().length} ผู้เข้าร่วม
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <Header title={t('submit.header')} />
      <div className="p-4 md:p-6 max-w-2xl">
        <Card>
          {/* Type Tabs */}
          <div className="mb-6">
            <label className={lx}>{t('submit.type')}</label>
            <div className="flex gap-2">
              {(['Ticket', 'Task', 'Incident'] as SubmitType[]).map(t => (
                <button key={t} type="button"
                  onClick={() => { setType(t); resetAll() }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {t === 'Ticket' ? '🎫 Ticket' : t === 'Task' ? '📋 Task' : '🚨 Incident'}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Title + Description (shared) */}
            <div>
              <label className={lx}>{t('submit.title')} *</label>
              <input required value={form.title} onChange={e => set('title', e.target.value)}
                className={cx} placeholder={type === 'Incident' ? 'อธิบายปัญหา / ชื่อ Incident...' : 'ระบุหัวข้อ...'} />
            </div>
            {/* Task ใช้ช่อง "Task Note" แทน — ซ่อนช่องนี้เพื่อไม่ให้ซ้ำซ้อน */}
            {type !== 'Task' && (
              <div>
                <label className={lx}>{t('submit.description')}</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  className={cx} rows={3} placeholder={t('submit.descPlaceholder')} />
              </div>
            )}

            {/* ── Ticket fields ── */}
            {type === 'Ticket' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>Priority</label>
                    <OptionSelect category="TicketPriority" defaults={['Low', 'Medium', 'High', 'Critical']} value={form.priority} onChange={v => set('priority', v)} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>{t('submit.category')}</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)} className={cx}>
                      <option value="">{t('submit.selectCategory')}</option>
                      {(categories.length > 0 ? categories.map(c => c.Title) : DEFAULT_CATEGORIES)
                        .map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={lx}>{t('submit.department')}</label>
                  <OptionSelect category="Department" defaults={[...DEPARTMENTS]} value={form.department} onChange={v => set('department', v)} className={cx} />
                </div>

                {/* ผูกกับโครงการ (ไม่บังคับ) — Ticket ก็เป็นงานส่วนหนึ่งของโครงการได้ */}
                <div>
                  <label className={lx}>{t('submit.projectOptional')}</label>
                  <select value={form.projectId} onChange={e => selectProject(e.target.value)} className={cx}>
                    <option value="">{t('submit.noProject')}</option>
                    {filteredProjects.map(p => (
                      <option key={p.id} value={String(p.id)}>
                        {p.Title}{p.Status !== 'Active' ? ` [${p.Status}]` : ''}{p.Company ? ` (${p.Company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {isAgent && renderReporter()}
                {isAgent && renderCustomerLoop()}

                <div>
                  <label className={lx}>{t('submit.assignAgent')}</label>
                  <SearchSelect
                    options={agentOptions}
                    value={form.assignedEmail}
                    onChange={selectAgent}
                    placeholder={t('submit.searchAgent')}
                    emptyLabel="-- ยังไม่ Assign --"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                      disabled={!!form.daysCount} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>{t('submit.daysFromNow')}</label>
                    <input type="number" min="1" placeholder={t('submit.daysExample')}
                      value={form.daysCount} onChange={e => set('daysCount', e.target.value)} className={cx} />
                  </div>
                </div>
                {form.daysCount && Number(form.daysCount) > 0 && (
                  <p className="text-xs text-primary-600">📅 Due date: {computedDueDate()}</p>
                )}

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={trackItem} onChange={e => setTrackItem(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.trackTicket')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.addCalendar')}</span>
                  </label>
                </div>
                {addCalendar && renderCalendar()}
              </>
            )}

            {/* ── Task fields ── */}
            {type === 'Task' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={lx} style={{marginBottom:0}}>{t('submit.project')} *</label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                      <input type="checkbox" checked={activeProjectsOnly} onChange={e => setActiveProjectsOnly(e.target.checked)}
                        className="w-3 h-3 accent-primary-600" />
                      {t('submit.onlyActive')}
                    </label>
                  </div>
                  <select required value={form.projectId} onChange={e => selectProject(e.target.value)} className={cx}>
                    <option value="">{t('submit.selectProject')}</option>
                    {filteredProjects.length > 0
                      ? filteredProjects.map(p => <option key={p.id} value={String(p.id)}>{p.Title}{p.Status !== 'Active' ? ` [${p.Status}]` : ''}{p.Company ? ` (${p.Company})` : ''}</option>)
                      : <option disabled>{t('common.loading')}</option>}
                  </select>
                </div>

                {isAgent && renderReporter()}
                {isAgent && renderCustomerLoop()}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>{t('submit.assignTo')}</label>
                    <SearchSelect
                      options={agentOptions}
                      value={form.assignedEmail}
                      onChange={selectAgent}
                      placeholder={t('submit.searchAgent')}
                      emptyLabel="-- ยังไม่ Assign --"
                    />
                  </div>
                  <div>
                    <label className={lx}>Due Date</label>
                    <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
                      disabled={!!form.daysCount} className={cx} />
                  </div>
                </div>

                <div>
                  <label className={lx}>{t('submit.dueFromNow')}</label>
                  <input type="number" min="1" placeholder={t('submit.weekExample')}
                    value={form.daysCount} onChange={e => set('daysCount', e.target.value)} className={cx} />
                </div>
                {form.daysCount && Number(form.daysCount) > 0 && (
                  <p className="text-xs text-primary-600">📅 Due date: {computedDueDate()}</p>
                )}

                <div>
                  <label className={lx}>Task Note</label>
                  <textarea value={form.taskNote} onChange={e => set('taskNote', e.target.value)}
                    className={cx} rows={3} placeholder={t('submit.taskNotePlaceholder')} />
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={trackItem} onChange={e => setTrackItem(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.trackTask')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.addCalendar')}</span>
                  </label>
                </div>
                {addCalendar && renderCalendar()}
              </>
            )}

            {/* ── Incident fields ── */}
            {type === 'Incident' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>{t('submit.severity')}</label>
                    <OptionSelect category="IncidentSeverity" defaults={['Low', 'Medium', 'High', 'Critical']} value={form.incidentSeverity}
                      onChange={v => setForm(f => ({
                        ...f, incidentSeverity: v,
                        // เลื่อน SLA ตามความรุนแรงให้ — เคสใหม่เสมอ จึงไม่มีของเก่าให้ทับ
                        incidentSlaHours: String(SLA_BY_SEVERITY[v] ?? f.incidentSlaHours),
                      }))} className={cx} />
                  </div>
                  <div>
                    <label className={lx}>{t('submit.status')}</label>
                    <OptionSelect category="IncidentStatus" defaults={['Open', 'In Progress', 'Resolved']} value={form.incidentStatus} onChange={v => set('incidentStatus', v)} className={cx} />
                  </div>
                </div>

                {/* SLA — วัดที่ Incident เท่านั้น ใช้กติกาเดียวกับหน้าโครงการ */}
                <div>
                  <label className={lx}>{t('submit.sla')}</label>
                  <select value={form.incidentSlaHours} onChange={e => set('incidentSlaHours', e.target.value)} className={cx}>
                    <option value="">{t('submit.noSla')}</option>
                    {SLA_OPTIONS.map(o => <option key={o.hours} value={o.hours}>{o.labelTh}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {t('submit.slaHint')}
                    {form.incidentSlaHours && (() => {
                      const due = computeSlaDue(Number(form.incidentSlaHours))
                      return due ? ` · ${t('submit.slaDue')} ${new Date(due).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}` : ''
                    })()}
                  </p>
                </div>

                <div>
                  <label className={lx}>{t('submit.category')}</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)} className={cx}>
                    <option value="">{t('submit.categoryOptional')}</option>
                    {(categories.length > 0 ? categories.map(c => c.Title) : DEFAULT_CATEGORIES)
                      .map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lx}>{t('submit.incidentDate')}</label>
                    <input type="date" value={form.incidentDate} onChange={e => set('incidentDate', e.target.value)} className={cx} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={lx} style={{marginBottom:0}}>{t('submit.relatedProject')} <span className="text-red-500">*</span></label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                        <input type="checkbox" checked={activeProjectsOnly} onChange={e => setActiveProjectsOnly(e.target.checked)}
                          className="w-3 h-3 accent-primary-600" />
                        {t('submit.onlyActive')}
                      </label>
                    </div>
                    {/* Incident ต้องมีโครงการเสมอ — ปัญหาที่ไม่รู้ว่าของงานไหน ตามต่อไม่ได้
                        และหลุดจากรายงานทั้งหมดที่จัดกลุ่มตามโครงการ */}
                    <select required value={form.projectId} onChange={e => selectProject(e.target.value)} className={cx}>
                      <option value="">— เลือกโครงการ —</option>
                      {filteredProjects.map(p => <option key={p.id} value={String(p.id)}>{p.Title}{p.Status !== 'Active' ? ` [${p.Status}]` : ''}{p.Company ? ` (${p.Company})` : ''}</option>)}
                    </select>
                    {projects.length > 0 && filteredProjects.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        ไม่มีโครงการที่ยัง Active — เอาเครื่องหมายถูก "เฉพาะที่ Active" ออกเพื่อเลือกโครงการอื่น
                      </p>
                    )}
                    {projects.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        ยังไม่มีโครงการในระบบ — ต้องสร้างโครงการก่อนจึงจะแจ้ง Incident ได้
                      </p>
                    )}
                  </div>
                </div>

                {isAgent && renderReporter()}
                {isAgent && renderCustomerLoop()}

                <div>
                  <label className={lx}>{t('submit.assignAgent')}</label>
                  <SearchSelect
                    options={agentOptions}
                    value={form.assignedEmail}
                    onChange={selectAgent}
                    placeholder={t('submit.searchAgent')}
                    emptyLabel="-- ยังไม่ Assign --"
                  />
                </div>

                {/* Track + ปฏิทิน — เหมือน Ticket/Task · Incident เคยไม่มี ทั้งที่ต้องนัดและตามมากกว่า */}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={trackItem} onChange={e => setTrackItem(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">📌 Track Incident นี้</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('submit.addCalendar')}</span>
                  </label>
                </div>
                {addCalendar && renderCalendar()}
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full justify-center mt-2">
              {loading ? t('submit.sending') : type === 'Incident' ? t('submit.saveIncident') : t('submit.submitReq')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
