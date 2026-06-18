import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Edit2, Eye, EyeOff, ExternalLink, Link as LinkIcon, Lock, Paperclip, Pin, Plus, Trash2, ChevronDown, Monitor } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { SmartText } from '../components/common/SmartText'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Modal } from '../components/common/Modal'
import { Skeleton } from '../components/common/Skeleton'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { SearchSelect, SearchMultiSelect } from '../components/common/SearchSelect'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { createCalendarEvent } from '../services/graph'
import { useAppStore } from '../store/useAppStore'
import { createNotification } from '../services/notificationService'
import { CommentSection } from '../components/common/CommentSection'
import type { Project, Task, Note, ProjectIncident, ProjectLink, ProjectAsset } from '../types/project'
import type { AgentProfile, FocusItem } from '../types/common'
import type { Contract } from '../types/ticket'
import type { Asset } from '../types/asset'
import { OptionSelect } from '../components/common/OptionSelect'
import { getStatusColor } from '../utils/colorUtils'
import { getDueDateColor, getDueDateRowClass, getDueDateEmoji, formatDate, daysUntil } from '../utils/dateUtils'
import { useT } from '../i18n/useT'

const LINK_TYPES = ['GitHub', 'Docs', 'Drive', 'Jira', 'Confluence', 'Other']
const PROJECT_GROUPS = ['Internal', 'External', 'R&D', 'Maintenance', 'อื่นๆ']
const PROJECT_STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']

// สถานะ monitor (Uptime Kuma bridge ผ่าน HD_MonitorStatus)
interface MonitorStatusRow { id: number; MonitorId: number; Status: string; LastCheck?: string; Uptime24?: number }
function monitorIdFromUrl(url?: string): number | null {
  if (!url) return null
  const m = url.match(/\/dashboard\/(\d+)/)
  return m ? Number(m[1]) : null
}

const HOURS = Array.from({ length: 29 }, (_, i) => {
  const h = String(Math.floor(i / 2) + 7).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const EMPTY_TASK = { title: '', assignedEmail: '', dueDate: '', daysCount: '', taskNote: '', calendarDate: '', startHour: '09:00', endHour: '10:00', externalAttendees: '' }
const EMPTY_INCIDENT = {
  title: '', severity: 'Medium', status: 'Open',
  incidentDate: new Date().toISOString().slice(0, 10),
  resolvedDate: '', description: '', assignedAgentEmail: '', resolution: '',
}
const EMPTY_LINK = { title: '', url: '', linkType: 'Other', linkNote: '' }
const EMPTY_PROJECT_FORM = {
  title: '', company: '', projectGroup: 'Internal', status: 'Planning',
  startDate: '', endDate: '', daysCount: '', progress: '0',
  comment: '', secureNote: '',
}

/** Resolve a SharePoint Hyperlink field to a plain URL string */
function resolveUrl(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'object') return (raw as { Url?: string }).Url ?? ''
  return raw as string
}

export default function ProjectDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [incidents, setIncidents] = useState<ProjectIncident[]>([])
  const [links, setLinks] = useState<ProjectLink[]>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [focusItems, setFocusItems] = useState<FocusItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'tasks' | 'notes' | 'incidents' | 'links' | 'assets' | 'comments' | 'files'>('tasks')
  const [showSecure, setShowSecure] = useState(false)
  const [infoOpen, setInfoOpen] = useState(true)

  // Linked assets (PM_ProjectAssets) + asset picker
  const [linkedAssets, setLinkedAssets] = useState<ProjectAsset[]>([])
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [showAssetPicker, setShowAssetPicker] = useState(false)
  const [assetSearch, setAssetSearch] = useState('')
  const [viewAsset, setViewAsset] = useState<Asset | null>(null)
  const [monitorStatus, setMonitorStatus] = useState<Record<number, MonitorStatusRow>>({})
  const [portals, setPortals] = useState<{ id: number; Title: string; URL?: string; Username?: string }[]>([])

  // Attachment panel toggle key: 'task-42' | 'note-7' | 'incident-3'
  const [attachKey, setAttachKey] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Project edit modal
  const [showEditProject, setShowEditProject] = useState(false)
  const [projectForm, setProjectForm] = useState({ ...EMPTY_PROJECT_FORM })
  const [savingProject, setSavingProject] = useState(false)

  // Task modal (create & edit)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState({ ...EMPTY_TASK })
  const [savingTask, setSavingTask] = useState(false)
  // Task: Track + Outlook Calendar (เหมือนหน้าแจ้งงาน)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [trackTask, setTrackTask] = useState(false)
  const [addCalendar, setAddCalendar] = useState(false)
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false)
  const [calInternalEmails, setCalInternalEmails] = useState<string[]>([])
  const [calCustomerEmails, setCalCustomerEmails] = useState<string[]>([])

  // Note modal (create & edit)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')

  // Incident modal (create & edit)
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [editingIncident, setEditingIncident] = useState<ProjectIncident | null>(null)
  const [incidentForm, setIncidentForm] = useState({ ...EMPTY_INCIDENT })
  const [savingIncident, setSavingIncident] = useState(false)

  // Link modal (create & edit)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingLink, setEditingLink] = useState<ProjectLink | null>(null)
  const [linkForm, setLinkForm] = useState({ ...EMPTY_LINK })
  const [savingLink, setSavingLink] = useState(false)

  const canSeeSecure = user?.role === 'Admin' || project?.CreatedByEmail === user?.email
  const canEditProject = ['Admin', 'Boss', 'Supervisor'].includes(user?.role ?? '') || project?.CreatedByEmail === user?.email
  const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const isBossAdmin = ['Boss', 'Admin'].includes(user?.role ?? '')

  // Agent options for SearchSelect
  const agentOptions = agents.map(a => ({
    value: a.EmailText ?? '',
    label: `${a.Title}${a.SupportGroup ? ` · ${a.SupportGroup}` : ''}`,
  }))

  // Customer (contract) options for calendar attendees
  const contractEmailOptions = contracts
    .filter(c => c.CustomerEmail)
    .map(c => ({ value: c.CustomerEmail, label: `${c.Title}${c.Company ? ` (${c.Company})` : ''}` }))

  const buildCalendarAttendees = () => [...new Set([
    // คนที่ถูก assign → ใส่เป็น attendee อัตโนมัติ เพื่อให้ Outlook ส่ง invite
    ...(taskForm.assignedEmail ? [taskForm.assignedEmail] : []),
    ...calInternalEmails,
    ...calCustomerEmails,
    ...taskForm.externalAttendees.split(',').map(s => s.trim()).filter(Boolean),
  ].filter(Boolean))]

  function load() {
    if (!id || !/^\d+$/.test(id)) return
    const numId = Number(id)
    setLoading(true)
    Promise.all([
      spGet<Project>('PM_Projects', `Id eq ${numId}`),
      spGet<Task>('PM_Tasks', `ProjectID eq ${numId}`, undefined, 'DueDate asc'),
      spGet<Note>('PM_Notes', `ProjectID eq ${numId}`, undefined, 'Created desc'),
      spGet<ProjectIncident>('PM_Incidents', `ProjectID eq ${numId}`, '*,Author/Title,Author/EMail', undefined, 500, 'Author'),
      spGet<ProjectLink>('PM_Links', `ProjectID eq ${numId}`, undefined, 'Title asc'),
      spGet<ProjectAsset>('PM_ProjectAssets', `ProjectID eq ${numId}`).catch(() => []),
    ]).then(([proj, t, n, inc, lnk, pa]) => {
      setProject(proj[0] ?? null)
      setTasks(t)
      setNotes(n)
      setIncidents(inc)
      setLinks(lnk)
      setLinkedAssets(pa as ProjectAsset[])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc')
      .then(setAgents).catch(() => {})
    spGet<Asset>('IT_Assets', undefined, undefined, 'Title asc')
      .then(setAllAssets).catch(() => {})
    spGet<Contract>('HD_Contracts', undefined, 'Id,Title,CustomerEmail,Company', 'Title asc', 500)
      .then(setContracts).catch(() => {})
    spGet<MonitorStatusRow>('HD_MonitorStatus', undefined, 'Id,MonitorId,Status,LastCheck,Uptime24', undefined, 500)
      .then(rows => {
        const m: Record<number, MonitorStatusRow> = {}
        for (const r of rows) if (r.MonitorId != null) m[r.MonitorId] = r
        setMonitorStatus(m)
      }).catch(() => {})
    spGet<{ id: number; Title: string; URL?: string; Username?: string }>('IT_Portals', undefined, 'Id,Title,URL,Username', 'Title asc', 500)
      .then(setPortals).catch(() => {})
    if (user?.email) {
      spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}'`)
        .then(setFocusItems).catch(() => {})
    }
  }, [id, user?.email])

  // เปิดแท็บ comments อัตโนมัติเมื่อมาจากลิงก์แจ้งเตือน (?tab=comments)
  useEffect(() => { if (searchParams.get('tab') === 'comments') setTab('comments') }, [searchParams])

  // ── Asset linking ───────────────────────────────────────────────────────────
  async function linkAsset(asset: Asset) {
    if (!id) return
    if (linkedAssets.some(la => la.AssetID === asset.id)) { addToast('info', 'อุปกรณ์นี้ผูกอยู่แล้ว'); return }
    try {
      const res = await spCreate('PM_ProjectAssets', {
        Title: asset.Title,
        ProjectID: Number(id),
        AssetID: asset.id,
        AssetTitle: asset.Title,
        AssetCode: asset.AssetCode || '',
      })
      setLinkedAssets(prev => [...prev, { id: res.id, ProjectID: Number(id), AssetID: asset.id, AssetTitle: asset.Title, AssetCode: asset.AssetCode || '', Title: asset.Title }])
      addToast('success', `ผูก ${asset.Title} แล้ว`)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }
  async function unlinkAsset(la: ProjectAsset) {
    try {
      await spDelete('PM_ProjectAssets', la.id)
      setLinkedAssets(prev => prev.filter(x => x.id !== la.id))
      addToast('success', 'นำอุปกรณ์ออกแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  // ── Project Edit ────────────────────────────────────────────────────────────
  function openEditProject() {
    if (!project) return
    setProjectForm({
      title: project.Title,
      company: project.Company ?? '',
      projectGroup: project.ProjectGroup ?? 'Internal',
      status: project.Status,
      startDate: project.StartDate ? project.StartDate.slice(0, 10) : '',
      endDate: project.EndDate ? project.EndDate.slice(0, 10) : '',
      daysCount: '',
      progress: String(project.Progress ?? 0),
      comment: project.Comment ?? '',
      secureNote: canSeeSecure ? (project.SecureNote ?? '') : '',
    })
    setShowEditProject(true)
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault()
    if (!project) return
    setSavingProject(true)
    let endDate: string | null = null
    if (projectForm.daysCount && Number(projectForm.daysCount) > 0 && projectForm.startDate) {
      const d = new Date(projectForm.startDate)
      d.setDate(d.getDate() + Number(projectForm.daysCount))
      endDate = d.toISOString().slice(0, 10)
    } else {
      endDate = projectForm.endDate || null
    }
    try {
      await spUpdate('PM_Projects', project.id, {
        Title: projectForm.title,
        Company: projectForm.company || undefined,
        ProjectGroup: projectForm.projectGroup || undefined,
        Status: projectForm.status,
        Progress: Number(projectForm.progress),
        StartDate: projectForm.startDate || undefined,
        EndDate: endDate,
        Comment: projectForm.comment || undefined,
        ...(canSeeSecure ? { SecureNote: projectForm.secureNote || undefined } : {}),
      })
      addToast('success', 'อัปเดตโครงการแล้ว')
      setShowEditProject(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingProject(false) }
  }

  // ── Acknowledge / Complete ──────────────────────────────────────────────────
  async function acknowledgeTask(task: Task) {
    if (!user) return
    try {
      await spUpdate('PM_Tasks', task.id, {
        IsAcknowledged: true,
        AcknowledgedBy: user.displayName,
        AcknowledgedDate: new Date().toISOString(),
      })
      setTasks(prev => prev.map(t => t.id === task.id
        ? { ...t, IsAcknowledged: true, AcknowledgedBy: user.displayName } : t))
      addToast('success', 'รับทราบ Task แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function completeTask(task: Task) {
    try {
      await spUpdate('PM_Tasks', task.id, { IsCompleted: !task.IsCompleted })
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, IsCompleted: !t.IsCompleted } : t))
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  // ── Task CRUD ───────────────────────────────────────────────────────────────
  function resetTaskExtras() {
    setTrackTask(false); setAddCalendar(false); setIsOnlineMeeting(false)
    setCalInternalEmails([]); setCalCustomerEmails([])
  }
  function openAddTask() {
    setEditingTask(null)
    setTaskForm({ ...EMPTY_TASK })
    resetTaskExtras()
    setShowTaskModal(true)
  }

  function openEditTask(task: Task) {
    setEditingTask(task)
    setTaskForm({
      ...EMPTY_TASK,
      title: task.Title,
      assignedEmail: task.AssignedEmail ?? '',
      dueDate: task.DueDate ? task.DueDate.slice(0, 10) : '',
      daysCount: '',
      taskNote: task.TaskNote ?? '',
    })
    resetTaskExtras()
    setShowTaskModal(true)
  }

  async function saveTask(e: React.FormEvent) {
    e.preventDefault()
    if (!taskForm.title.trim()) return
    setSavingTask(true)
    const agent = agents.find(a => a.EmailText === taskForm.assignedEmail)
    let dueDate: string | null = null
    if (taskForm.daysCount && Number(taskForm.daysCount) > 0) {
      const d = new Date()
      d.setDate(d.getDate() + Number(taskForm.daysCount))
      dueDate = d.toISOString().slice(0, 10)
    } else if (taskForm.dueDate) {
      dueDate = taskForm.dueDate
    }
    const payload: Record<string, unknown> = {
      Title: taskForm.title,
      AssignedTo: agent?.Title ?? taskForm.assignedEmail,
      AssignedEmail: taskForm.assignedEmail || undefined,
      DueDate: dueDate,
      TaskNote: taskForm.taskNote || undefined,
    }
    try {
      if (editingTask) {
        await spUpdate('PM_Tasks', editingTask.id, payload)
        addToast('success', 'อัปเดต Task แล้ว')
      } else {
        const created = await spCreate('PM_Tasks', { ...payload, ProjectID: Number(id), IsCompleted: false, IsAcknowledged: false })
        addToast('success', 'เพิ่ม Task แล้ว')

        // เพิ่มนัดหมาย Outlook Calendar (+ Teams ถ้าติ๊ก)
        if (addCalendar && taskForm.calendarDate) {
          try {
            await createCalendarEvent({
              subject: taskForm.title,
              start: `${taskForm.calendarDate}T${taskForm.startHour}:00`,
              end: `${taskForm.calendarDate}T${taskForm.endHour}:00`,
              attendees: buildCalendarAttendees(),
              body: taskForm.taskNote,
              isOnlineMeeting,
            })
          } catch { addToast('error', 'สร้าง Task แล้ว แต่สร้างนัดหมายไม่สำเร็จ') }
        }

        // Track Task
        if (trackTask && created?.id && user) {
          await spCreate('HD_Tracking', {
            Title: taskForm.title,
            TrackingType: 'Task',
            RefID: created.id,
            TrackedBy: user.displayName,
            TrackedEmail: user.email,
            AssignedTo: agent?.Title ?? taskForm.assignedEmail,
            Status: 'Pending',
            IsAcknowledged: false,
          }).catch(() => {})
        }

        // แจ้ง agent ที่ถูก assign (in-app) — ยกเว้นคนสร้างเอง
        if (taskForm.assignedEmail && taskForm.assignedEmail.toLowerCase() !== (user?.email?.toLowerCase() ?? '')) {
          createNotification({
            recipients: [taskForm.assignedEmail],
            title: `📋 ได้รับมอบหมาย Task: ${taskForm.title}`,
            message: taskForm.taskNote || (dueDate ? `กำหนดส่ง ${dueDate}` : 'มี Task ใหม่'),
            linkPath: `/projects/${id}`,
            eventType: 'task_assigned',
          })
        }
      }
      setShowTaskModal(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingTask(false) }
  }

  async function deleteTask(taskId: number) {
    if (!window.confirm('ลบ Task นี้?')) return
    try {
      await spDelete('PM_Tasks', taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
      addToast('success', 'ลบ Task แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  // ── Note CRUD ───────────────────────────────────────────────────────────────
  function openAddNote() {
    setEditingNote(null)
    setNoteTitle('')
    setNoteText('')
    setShowNoteModal(true)
  }

  function openEditNote(note: Note) {
    setEditingNote(note)
    setNoteTitle(note.Title ?? '')
    setNoteText(note.NoteText)
    setShowNoteModal(true)
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !noteTitle.trim()) return
    const payload: Record<string, unknown> = {
      Title: noteTitle.trim(),
      NoteText: noteText || undefined,
    }
    try {
      if (editingNote) {
        await spUpdate('PM_Notes', editingNote.id, payload)
        addToast('success', 'อัปเดต Note แล้ว')
      } else {
        await spCreate('PM_Notes', { ...payload, ProjectID: Number(id), NoteBy: user.displayName })
        addToast('success', 'บันทึก Note แล้ว')
      }
      setNoteTitle('')
      setNoteText('')
      setShowNoteModal(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function deleteNote(noteId: number) {
    if (!window.confirm('ลบ Note นี้?')) return
    try {
      await spDelete('PM_Notes', noteId)
      setNotes(prev => prev.filter(n => n.id !== noteId))
      addToast('success', 'ลบ Note แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  // ── Incident CRUD ───────────────────────────────────────────────────────────
  function openAddIncident() {
    setEditingIncident(null)
    setIncidentForm({ ...EMPTY_INCIDENT })
    setShowIncidentModal(true)
  }

  function openEditIncident(inc: ProjectIncident) {
    setEditingIncident(inc)
    setIncidentForm({
      title: inc.Title,
      severity: inc.Severity,
      status: inc.Status,
      incidentDate: inc.IncidentDate ? inc.IncidentDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      resolvedDate: inc.ResolvedDate ? inc.ResolvedDate.slice(0, 10) : '',
      description: inc.Description ?? '',
      assignedAgentEmail: inc.AssignedEmail ?? '',
      resolution: inc.Resolution ?? '',
    })
    setShowIncidentModal(true)
  }

  async function saveIncident(e: React.FormEvent) {
    e.preventDefault()
    setSavingIncident(true)
    const agent = agents.find(a => a.EmailText === incidentForm.assignedAgentEmail)
    const payload: Record<string, unknown> = {
      Title: incidentForm.title,
      Severity: incidentForm.severity,
      Status: incidentForm.status,
      IncidentDate: incidentForm.incidentDate || undefined,
      ResolvedDate: incidentForm.resolvedDate || undefined,
      Description: incidentForm.description || undefined,
      AssignedTo: agent?.Title ?? '',
      AssignedEmail: incidentForm.assignedAgentEmail || undefined,
      Resolution: incidentForm.resolution || undefined,
    }
    try {
      const actorEmail = user?.email?.toLowerCase() ?? ''
      if (editingIncident) {
        await spUpdate('PM_Incidents', editingIncident.id, payload)
        addToast('success', 'อัปเดต Incident แล้ว')
        // แจ้ง Requester (ผู้แจ้ง) เมื่อสถานะเปลี่ยน (in-app)
        const requester = editingIncident.Author?.EMail || editingIncident.CreatedByEmail
        if (incidentForm.status !== editingIncident.Status && requester && requester.toLowerCase() !== actorEmail) {
          createNotification({
            recipients: [requester],
            title: `🚨 Incident เปลี่ยนสถานะเป็น ${incidentForm.status}`,
            message: incidentForm.title,
            linkPath: `/projects/${id}`,
            eventType: 'incident_status_changed',
          })
        }
      } else {
        await spCreate('PM_Incidents', { ...payload, ProjectID: Number(id) })
        addToast('success', 'บันทึก Incident แล้ว')
        // แจ้ง Assigned เมื่อสร้าง Incident (in-app) — ยกเว้นคนสร้างเอง
        if (incidentForm.assignedAgentEmail && incidentForm.assignedAgentEmail.toLowerCase() !== actorEmail) {
          createNotification({
            recipients: [incidentForm.assignedAgentEmail],
            title: `🚨 ได้รับมอบหมาย Incident: ${incidentForm.title}`,
            message: `ความรุนแรง ${incidentForm.severity}${incidentForm.description ? ' — ' + incidentForm.description.slice(0, 120) : ''}`,
            linkPath: `/projects/${id}`,
            eventType: 'incident_created',
          })
        }
      }
      setShowIncidentModal(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingIncident(false) }
  }

  async function deleteIncident(incId: number) {
    if (!window.confirm('ลบ Incident นี้?')) return
    try {
      await spDelete('PM_Incidents', incId)
      setIncidents(prev => prev.filter(i => i.id !== incId))
      addToast('success', 'ลบ Incident แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  // ── Link CRUD ───────────────────────────────────────────────────────────────
  function openAddLink() {
    setEditingLink(null)
    setLinkForm({ ...EMPTY_LINK })
    setShowLinkModal(true)
  }

  function openEditLink(link: ProjectLink) {
    setEditingLink(link)
    setLinkForm({
      title: link.Title ?? '',
      url: resolveUrl(link.URL),
      linkType: link.LinkType ?? 'Other',
      linkNote: link.LinkNote ?? '',
    })
    setShowLinkModal(true)
  }

  async function saveLink(e: React.FormEvent) {
    e.preventDefault()
    if (!linkForm.url.trim()) return
    setSavingLink(true)
    const payload: Record<string, unknown> = {
      Title: linkForm.title || linkForm.url.slice(0, 100),
      URL: { Url: linkForm.url, Description: linkForm.title || linkForm.url },
      LinkType: linkForm.linkType,
      LinkNote: linkForm.linkNote || undefined,
    }
    try {
      if (editingLink) {
        await spUpdate('PM_Links', editingLink.id, payload)
        addToast('success', 'อัปเดต Link แล้ว')
      } else {
        await spCreate('PM_Links', { ...payload, ProjectID: Number(id) })
        addToast('success', 'เพิ่ม Link แล้ว')
      }
      setShowLinkModal(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingLink(false) }
  }

  async function deleteLink(linkId: number) {
    if (!window.confirm('ลบ Link นี้?')) return
    try {
      await spDelete('PM_Links', linkId)
      setLinks(prev => prev.filter(l => l.id !== linkId))
      addToast('success', 'ลบ Link แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  function toggleAttach(type: string, itemId: number) {
    const key = `${type}-${itemId}`
    setAttachKey(prev => prev === key ? null : key)
  }

  function toggleExpand(key: string) {
    setExpandedKey(prev => prev === key ? null : key)
  }

  // Kanban columns wrapper for project sections
  function PdColumns<T>({ cols, items, keyOf, render }: { cols: { key: string; label: string; color?: string }[]; items: T[]; keyOf: (i: T) => string; render: (i: T) => React.ReactNode }) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cols.map(col => {
          const list = items.filter(i => keyOf(i) === col.key)
          return (
            <div key={col.key} className="flex-shrink-0 w-72">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2 h-2 rounded-full ${col.color ?? 'bg-gray-400'}`} />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{col.label}</span>
                <span className="text-xs text-gray-400">({list.length})</span>
              </div>
              <div className="space-y-3">
                {list.length === 0 ? <p className="text-xs text-gray-300 dark:text-gray-600 text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">—</p> : list.map(render)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderTaskCard(task: Task) {
    const color = getDueDateColor(task.DueDate, task.IsCompleted)
    const ak = `task-${task.id}`
    const isOpen = expandedKey === ak
    return (
      <div key={task.id} className={`subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden ${getDueDateRowClass(color)}`}>
        <div className="flex items-start gap-2 p-3 cursor-pointer" onClick={() => toggleExpand(ak)}>
          <button onClick={(e) => { e.stopPropagation(); completeTask(task) }}
            className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.IsCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-500'}`}>
            {task.IsCompleted && <CheckCircle2 size={12} className="text-white" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${task.IsCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{getDueDateEmoji(color)} {task.Title}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
              {task.DueDate && <span>{formatDate(task.DueDate)}</span>}
              {task.IsAcknowledged && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> {tr('tracking.ack')}</span>}
            </div>
          </div>
          <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        {isOpen && (
          <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800 pt-2.5 space-y-2">
            {task.AssignedTo && <p className="text-xs text-gray-500">{tr('pd.assignee')}: {task.AssignedTo}</p>}
            {task.TaskNote && <p className="text-xs text-gray-600 dark:text-gray-300 italic">{task.TaskNote}</p>}
            <div className="flex items-center gap-1 flex-wrap">
              {!task.IsAcknowledged && task.AssignedEmail === user?.email && (
                <Button size="sm" variant="outline" onClick={() => acknowledgeTask(task)}>{tr('tracking.ack')}</Button>
              )}
              <button onClick={() => pinFocusItem('Task', task)} title="Pin"
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${pinnedSet.has(`Task|${task.Title}`) ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`}>
                <Pin size={14} />
              </button>
              {isAgent && (<>
                <button onClick={() => toggleAttach('task', task.id)} title={tr('pd.attach')}
                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${attachKey === ak ? 'text-primary-600' : 'text-gray-400'}`}>
                  <Paperclip size={14} />
                </button>
                <button onClick={() => openEditTask(task)} title={tr('common.edit')}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => deleteTask(task.id)} title={tr('assets.delete')}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </>)}
            </div>
            {attachKey === ak && <AttachmentSection listName="PM_Tasks" itemId={task.id} />}
          </div>
        )}
      </div>
    )
  }

  function renderIncidentCard(inc: ProjectIncident) {
    const ak = `incident-${inc.id}`
    const isOpen = expandedKey === ak
    const isResolved = inc.Status === 'Resolved'
    return (
      <div key={inc.id} className={`subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden ${isResolved ? 'opacity-60' : ''}`}>
        <div className="flex items-start gap-2 p-3 cursor-pointer" onClick={() => toggleExpand(ak)}>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${isResolved ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>{inc.Title}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge className={getStatusColor(inc.Status)}>{inc.Status}</Badge>
              {inc.IncidentDate && <span className="text-xs text-gray-400">{formatDate(inc.IncidentDate)}</span>}
            </div>
          </div>
          <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        {isOpen && (
          <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800 pt-2.5 space-y-2">
            {inc.Description && <p className="text-xs text-gray-600 dark:text-gray-300">{inc.Description}</p>}
            {inc.Resolution && <p className="text-xs text-green-600">✓ {inc.Resolution}</p>}
            <div className="flex items-center gap-1">
              <button onClick={() => pinFocusItem('Incident', inc)} title="Pin"
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${pinnedSet.has(`Incident|${inc.Title}`) ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`}>
                <Pin size={14} />
              </button>
              <button onClick={() => toggleAttach('incident', inc.id)} title={tr('pd.attach')}
                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${attachKey === ak ? 'text-primary-600' : 'text-gray-400'}`}>
                <Paperclip size={14} />
              </button>
              <button onClick={() => openEditIncident(inc)} title={tr('common.edit')}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                <Edit2 size={14} />
              </button>
              {isBossAdmin && (
                <button onClick={() => deleteIncident(inc.id)} title={tr('assets.delete')}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            {attachKey === ak && <AttachmentSection listName="PM_Incidents" itemId={inc.id} />}
          </div>
        )}
      </div>
    )
  }

  const PD_TASK_COLS = [
    { key: 'open', label: tr('pd.inProgress'), color: 'bg-blue-500' },
    { key: 'done', label: tr('pd.done'), color: 'bg-green-500' },
  ]
  const PD_INCIDENT_COLS = [
    { key: 'Critical', label: 'Critical', color: 'bg-red-600' },
    { key: 'High', label: 'High', color: 'bg-orange-500' },
    { key: 'Medium', label: 'Medium', color: 'bg-amber-500' },
    { key: 'Low', label: 'Low', color: 'bg-green-500' },
  ]

  async function pinFocusItem(type: 'Task' | 'Incident', item: Task | ProjectIncident) {
    if (!user || !project) return
    try {
      // RefID = project.id so Home page link /projects/:id works correctly
      await spCreate('HD_Focus', {
        Title: item.Title,
        RefID: String(project.id),
        FocusType: type,
        FocusedBy: user.displayName,
        FocusedEmail: user.email,
        DueDate: type === 'Task' ? (item as Task).DueDate ?? null : null,
        Status: type === 'Task'
          ? ((item as Task).IsCompleted ? 'Completed' : 'Active')
          : (item as ProjectIncident).Status,
      })
      setFocusItems(prev => [...prev, {
        id: Date.now(), Title: item.Title, RefID: String(project.id),
        FocusType: type as FocusItem['FocusType'],
        FocusedBy: user.displayName, FocusedEmail: user.email,
        Status: '', DueDate: undefined,
      }])
      addToast('success', 'Pin ไว้ใน Focus Items แล้ว')
    } catch { addToast('error', 'ไม่สามารถ Pin ได้') }
  }

  const pinnedSet = new Set(focusItems.map(f => `${f.FocusType}|${f.Title}`))

  // Pin/unpin ตัวโครงการเอง — เลือกปลายทางได้ (Focus หรือ Navigator)
  const pinnedFocus = focusItems.find(f => f.FocusType === 'Project' && String(f.RefID) === String(project?.id) && f.PinTarget !== 'Navigator')
  const pinnedNav = focusItems.find(f => f.FocusType === 'Project' && String(f.RefID) === String(project?.id) && f.PinTarget === 'Navigator')
  async function togglePinProject(target: 'Focus' | 'Navigator') {
    if (!user || !project) return
    const existing = target === 'Navigator' ? pinnedNav : pinnedFocus
    try {
      if (existing) {
        await spDelete('HD_Focus', existing.id)
        setFocusItems(prev => prev.filter(f => f.id !== existing.id))
        addToast('success', `เอาออกจาก ${target} แล้ว`)
      } else {
        const res = await spCreate('HD_Focus', {
          Title: project.Title, RefID: String(project.id), FocusType: 'Project',
          FocusedBy: user.displayName, FocusedEmail: user.email, Status: project.Status, PinTarget: target,
        })
        setFocusItems(prev => [...prev, {
          id: res.id, Title: project.Title, RefID: String(project.id),
          FocusType: 'Project', FocusedBy: user.displayName, FocusedEmail: user.email, Status: project.Status, PinTarget: target,
        }])
        addToast('success', target === 'Navigator' ? 'Pin ไว้ที่เมนูซ้าย (Navigator) แล้ว' : 'Pin ไว้ที่ Focus แล้ว')
      }
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }
  const [pinMenuOpen, setPinMenuOpen] = useState(false)

  const sortedTasks = [...tasks].sort((a, b) => {
    const order: Record<string, number> = { red: 0, orange: 1, yellow: 2, normal: 3, gray: 4 }
    return (order[getDueDateColor(a.DueDate, a.IsCompleted)] ?? 3) - (order[getDueDateColor(b.DueDate, b.IsCompleted)] ?? 3)
  })

  const ic = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const lc = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const pf = (key: keyof typeof EMPTY_PROJECT_FORM, val: string) =>
    setProjectForm(f => ({ ...f, [key]: val }))

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>
  if (!project) return <div className="p-6 text-gray-400">{tr('pd.notFound')}</div>

  const projectEndDate = projectForm.daysCount && Number(projectForm.daysCount) > 0 && projectForm.startDate
    ? (() => { const d = new Date(projectForm.startDate); d.setDate(d.getDate() + Number(projectForm.daysCount)); return d.toISOString().slice(0, 10) })()
    : null

  return (
    <div>
      <Header title={project.Title} backTo="/projects" backLabel={tr('pd.backLabel')} />
      <div className="p-4 md:p-6 space-y-5">

        {/* Info Card */}
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 mr-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{project.Title}</h2>
              {project.Company && <p className="text-sm text-gray-500 mt-1">{project.Company}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={getStatusColor(project.Status)}>{project.Status}</Badge>
              <div className="relative">
                <button onClick={() => setPinMenuOpen(o => !o)} title={tr('pd.pinProject')}
                  className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${(pinnedFocus || pinnedNav) ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600'}`}>
                  <Pin size={14} className={(pinnedFocus || pinnedNav) ? 'fill-current' : ''} />
                </button>
                {pinMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setPinMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-40 py-1 text-sm">
                      <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-400">{tr('pd.pinTo')}</p>
                      <button onClick={() => togglePinProject('Focus')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <span>{tr('pd.pinFocus')}</span>
                        {pinnedFocus && <span className="text-xs text-primary-600">✓</span>}
                      </button>
                      <button onClick={() => togglePinProject('Navigator')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <span>{tr('pd.pinNav')}</span>
                        {pinnedNav && <span className="text-xs text-primary-600">✓</span>}
                      </button>
                    </div>
                  </>
                )}
              </div>
              {canEditProject && (
                <button onClick={openEditProject} title={tr('pd.editProject')}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                  <Edit2 size={14} />
                </button>
              )}
              <button onClick={() => setInfoOpen(o => !o)} title={infoOpen ? tr('pd.hideDetail') : tr('pd.showDetail')}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                <ChevronDown size={16} className={`transition-transform ${infoOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          {infoOpen && (<>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{tr('pd.progress')}</span><span className="font-medium">{project.Progress ?? 0}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${project.Progress ?? 0}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400 text-xs">{tr('pd.start')}</span><p>{formatDate(project.StartDate)}</p></div>
            <div><span className="text-gray-400 text-xs">{tr('pd.end')}</span><p>{formatDate(project.EndDate)}</p></div>
          </div>
          {project.ProjectGroup && (
            <span className="inline-block mt-3 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded">
              {project.ProjectGroup}
            </span>
          )}
          {project.Comment && (
            <SmartText text={project.Comment} className="mt-3 text-sm text-gray-600 dark:text-gray-400" />
          )}

          {/* Secure Note */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={14} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500">Secure Note</span>
              {canSeeSecure && project.SecureNote && (
                <button onClick={() => setShowSecure(s => !s)} className="ml-auto">
                  {showSecure ? <EyeOff size={14} className="text-gray-400" /> : <Eye size={14} className="text-gray-400" />}
                </button>
              )}
            </div>
            {canSeeSecure
              ? showSecure
                ? <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{project.SecureNote || tr('pd.empty')}</pre>
                : <p className="text-xs text-gray-400 italic">{project.SecureNote ? tr('pd.clickToView') : tr('pd.empty')}</p>
              : <p className="text-xs text-gray-400 flex items-center gap-1"><Lock size={12} /> {tr('pd.secret')}</p>
            }
          </div>
          </>)}
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
          {(['tasks', 'notes', 'incidents', 'links', 'assets', 'comments', 'files'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
              {t === 'tasks' ? `Tasks (${tasks.length})` : t === 'notes' ? `Notes (${notes.length})` : t === 'incidents' ? `Incidents (${incidents.length})` : t === 'links' ? `Links (${links.length})` : t === 'assets' ? `${tr('pd.devices')} (${linkedAssets.length})` : t === 'comments' ? 'Comments' : tr('ticket.attachments')}
            </button>
          ))}
        </div>

        {/* ── Tasks ── */}
        {tab === 'tasks' && (
          <div className="space-y-3">
            {isAgent && (
              <Button size="sm" onClick={openAddTask}><Plus size={14} /> {tr('pd.addTask')}</Button>
            )}
            {sortedTasks.length === 0
              ? <p className="text-center text-sm text-gray-400 py-10">{tr('pd.noTask')}</p>
              : <PdColumns cols={PD_TASK_COLS} items={sortedTasks} keyOf={t => t.IsCompleted ? 'done' : 'open'} render={t => renderTaskCard(t)} />
            }
          </div>
        )}

        {/* ── Notes ── */}
        {tab === 'notes' && (
          <div className="space-y-3">
            <Button size="sm" onClick={openAddNote}><Plus size={14} /> {tr('pd.addNote')}</Button>
            {notes.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">{tr('pd.noNote')}</p>
              : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {notes.map(note => {
                    const ak = `note-${note.id}`
                    const isOpen = expandedKey === ak
                    const canEdit = user?.role === 'Admin' || note.NoteBy === user?.displayName
                    return (
                      <div key={note.id} className="subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                        <div className="flex items-start gap-2 p-3 cursor-pointer" onClick={() => toggleExpand(ak)}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{note.Title || tr('pd.untitled')}</p>
                            {!isOpen && note.NoteText && <p className="text-xs text-gray-400 truncate mt-0.5">{(note.NoteText).split('\n')[0]}</p>}
                            {isOpen && note.NoteText && <SmartText text={note.NoteText} className="text-sm text-gray-700 dark:text-gray-300 mt-1.5" />}
                            <p className="text-xs text-gray-400 mt-1">{note.NoteBy} • {formatDate(note.Created)}</p>
                          </div>
                          <ChevronDown size={15} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {isOpen && (
                          <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-800 pt-2.5">
                            <div className="flex items-center gap-2 text-gray-400">
                              <button onClick={() => toggleAttach('note', note.id)} title={tr('pd.attach')}
                                className={`hover:text-primary-600 transition-colors ${attachKey === ak ? 'text-primary-600' : ''}`}>
                                <Paperclip size={14} />
                              </button>
                              {canEdit && (<>
                                <button onClick={() => openEditNote(note)} className="hover:text-primary-600 transition-colors"><Edit2 size={14} /></button>
                                <button onClick={() => deleteNote(note.id)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                              </>)}
                            </div>
                            {attachKey === ak && <div className="mt-2"><AttachmentSection listName="PM_Notes" itemId={note.id} /></div>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}

        {/* ── Incidents ── */}
        {tab === 'incidents' && (
          <div className="space-y-3">
            <Button size="sm" variant="outline" onClick={openAddIncident}><Plus size={14} /> {tr('pd.reportIncident')}</Button>
            {incidents.length === 0
              ? <p className="text-center text-sm text-gray-400 py-10">{tr('pd.noIncident')}</p>
              : <PdColumns cols={PD_INCIDENT_COLS} items={incidents} keyOf={i => i.Severity} render={i => renderIncidentCard(i)} />
            }
          </div>
        )}

        {/* ── Links ── */}
        {tab === 'links' && (
          <div className="space-y-3">
            <Button size="sm" onClick={openAddLink}><Plus size={14} /> {tr('pd.addLink')}</Button>
            {links.length === 0
              ? <p className="text-center text-sm text-gray-400 py-10">{tr('pd.noLink')}</p>
              : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {links.map(link => (
                    <div key={link.id} className="flex items-start gap-2 p-4 subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
                      <LinkIcon size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <a href={resolveUrl(link.URL)} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-primary-600 hover:underline flex items-center gap-1">
                          <span className="truncate">{link.Title || resolveUrl(link.URL)}</span>
                          <ExternalLink size={11} className="flex-shrink-0" />
                        </a>
                        {link.LinkNote && <p className="text-xs text-gray-400 mt-0.5">{link.LinkNote}</p>}
                        {link.LinkType && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 mt-1.5">{link.LinkType}</Badge>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditLink(link)} title={tr('common.edit')}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        {isBossAdmin && (
                          <button onClick={() => deleteLink(link.id)} title={tr('assets.delete')}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ── Assets (linked IT_Assets) ── */}
        {tab === 'comments' && project && (
          <CommentSection
            listName="PM_Comments"
            parentField="ProjectID"
            parentId={project.id}
            titleLabel={project.Title}
            linkPath={`/projects/${id}?tab=comments`}
            mentionCandidates={agents.map(a => ({ name: a.Title, email: a.EmailText })).filter(c => c.email)}
            notifyEmails={[...new Set([project.CreatedByEmail, ...tasks.map(t => t.AssignedEmail), ...incidents.map(i => i.AssignedEmail)].filter(Boolean) as string[])]}
          />
        )}

        {/* ── Files (project-level attachments) ── */}
        {tab === 'files' && (
          <Card>
            <AttachmentSection listName="PM_Projects" itemId={project.id} />
          </Card>
        )}

        {tab === 'assets' && (
          <div className="space-y-3">
            {isAgent && (
              <Button size="sm" onClick={() => { setAssetSearch(''); setShowAssetPicker(true) }}><Plus size={14} /> {tr('pd.addDevice')}</Button>
            )}
            {linkedAssets.length === 0
              ? <p className="text-center text-sm text-gray-400 py-10">{tr('pd.noLinkedDevice')}</p>
              : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {linkedAssets.map(la => {
                    const asset = allAssets.find(a => a.id === la.AssetID)
                    return (
                      <div key={la.id} className="flex items-start gap-2 p-4 subpanel rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow">
                        <Monitor size={16} className="text-primary-600 flex-shrink-0 mt-0.5" />
                        <button onClick={() => asset && setViewAsset(asset)} className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 leading-snug">{asset?.Title || la.AssetTitle}</p>
                          {(asset?.AssetCode || la.AssetCode) && <p className="text-xs text-gray-400 font-mono">{asset?.AssetCode || la.AssetCode}</p>}
                          {asset && <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 mt-1.5">{asset.Category}</Badge>}
                          {!asset && <p className="text-xs text-amber-500 mt-1">{tr('pd.deviceRemoved')}</p>}
                        </button>
                        {isAgent && (
                          <button onClick={() => unlinkAsset(la)} title={tr('pd.remove')}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        )}
      </div>

      {/* ── Asset Picker Modal ── */}
      <Modal open={showAssetPicker} onClose={() => setShowAssetPicker(false)} title={tr('pd.pickDevice')} size="md">
        <div className="space-y-3">
          <input value={assetSearch} onChange={e => setAssetSearch(e.target.value)}
            placeholder={tr('pd.searchDevice')} autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <div className="max-h-[50vh] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allAssets
              .filter(a => !assetSearch || a.Title.toLowerCase().includes(assetSearch.toLowerCase()) || a.AssetCode?.toLowerCase().includes(assetSearch.toLowerCase()))
              .map(a => {
                const linked = linkedAssets.some(la => la.AssetID === a.id)
                return (
                  <button key={a.id} disabled={linked} onClick={() => linkAsset(a)}
                    className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-colors ${linked ? 'border-gray-100 dark:border-gray-800 opacity-50 cursor-default' : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10'}`}>
                    <Monitor size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{a.Title}</p>
                      <p className="text-xs text-gray-400">{a.Category}{a.AssetCode ? ` · ${a.AssetCode}` : ''}</p>
                    </div>
                    {linked && <span className="text-xs text-green-600 flex-shrink-0">{tr('pd.linked')}</span>}
                  </button>
                )
              })}
          </div>
        </div>
      </Modal>

      {/* ── View Asset Detail Modal ── */}
      <Modal open={!!viewAsset} onClose={() => setViewAsset(null)} title={viewAsset?.Title ?? ''} size="md">
        {viewAsset && (() => {
          const expiryDate = viewAsset.ExpiryDate || viewAsset.WarrantyDate
          const daysLeft = expiryDate ? daysUntil(expiryDate) : null
          const expiryColor = daysLeft === null ? '' : daysLeft < 0 ? 'text-red-500' : daysLeft <= 30 ? 'text-orange-500' : 'text-green-600 dark:text-green-400'
          // Dynamic SSL note: strip stored "เหลือ:" line, inject live calculation
          const liveNote = (() => {
            if (!viewAsset.Note) return ''
            if (!viewAsset.Note.includes('🔒 SSL Certificate') || !expiryDate) return viewAsset.Note
            const stripped = viewAsset.Note.replace(/เหลือ:.*วัน[^\n]*\n?/, '')
            const marker = 'หมดอายุ:'
            const idx = stripped.indexOf(marker)
            if (idx === -1) return stripped
            const end = stripped.indexOf('\n', idx)
            const pos = end === -1 ? stripped.length : end
            const icon = daysLeft !== null && daysLeft < 0 ? '❌' : daysLeft !== null && daysLeft <= 30 ? '⚠️' : '✅'
            return stripped.slice(0, pos) + `\nเหลือ: ${daysLeft ?? '-'} วัน ${icon}` + stripped.slice(pos)
          })()
          return (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {viewAsset.AssetCode && <div><p className="text-xs text-gray-400">{tr('pd.code')}</p><p className="font-mono">{viewAsset.AssetCode}</p></div>}
              <div><p className="text-xs text-gray-400">{tr('common.category')}</p><p>{viewAsset.Category}</p></div>
              <div><p className="text-xs text-gray-400">{tr('assets.statusLabel')}</p><p>{viewAsset.Status}</p></div>
              {viewAsset.IPAddress && <div><p className="text-xs text-gray-400">IP</p><p className="font-mono whitespace-pre-line">{viewAsset.IPAddress}</p></div>}
              {viewAsset.SerialNumber && <div><p className="text-xs text-gray-400">Serial</p><p>{viewAsset.SerialNumber}</p></div>}
              {viewAsset.OS && <div><p className="text-xs text-gray-400">OS</p><p>{viewAsset.OS}</p></div>}
              {viewAsset.Vendor && <div><p className="text-xs text-gray-400">Vendor</p><p>{viewAsset.Vendor}</p></div>}
              {viewAsset.Spec && <div className="col-span-2"><p className="text-xs text-gray-400">Spec</p><p>{viewAsset.Spec}</p></div>}
              {viewAsset.AssignedTo && <div><p className="text-xs text-gray-400">{tr('assets.user')}</p><p>{viewAsset.AssignedTo}</p></div>}
              {viewAsset.PurchaseDate && <div><p className="text-xs text-gray-400">{tr('assets.purchaseDate')}</p><p>{formatDate(viewAsset.PurchaseDate)}</p></div>}
              {expiryDate && (
                <div>
                  <p className="text-xs text-gray-400">{viewAsset.Category === 'Certificate' ? tr('assets.sslExpiry') : tr('assets.warrantyDate')}</p>
                  <p className={expiryColor}>{formatDate(expiryDate)}{daysLeft !== null && <span className="ml-1 text-xs">({daysLeft < 0 ? tr('assets.expired') : `${daysLeft}`})</span>}</p>
                </div>
              )}
              {viewAsset.PortalID != null && (() => {
                const por = portals.find(p => p.id === viewAsset.PortalID)
                if (!por) return null
                return (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">🌐 Portal</p>
                    {por.URL
                      ? <a href={por.URL} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline break-all">{por.Title}</a>
                      : <p>{por.Title}</p>}
                    {por.Username && <p className="text-gray-400 text-[11px]">{por.Username}</p>}
                  </div>
                )
              })()}
              {viewAsset.PortalURL && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">🌐 Portal URL</p>
                  <a href={viewAsset.PortalURL} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline break-all">{viewAsset.PortalURL}</a>
                </div>
              )}
              {(() => {
                const mid = monitorIdFromUrl(viewAsset.MonitorUrl)
                const st = mid != null ? monitorStatus[mid] : undefined
                if (!viewAsset.MonitorUrl) return null
                const up = st?.Status === 'up' || st?.Status === '1'
                const pending = st?.Status === 'pending'
                return (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">📊 Monitor</p>
                    <div className="flex items-center gap-2">
                      {st ? (
                        <span className={`inline-flex items-center gap-1 text-sm font-medium ${up ? 'text-green-600' : pending ? 'text-amber-500' : 'text-red-600'}`}>
                          <span className={`w-2 h-2 rounded-full ${up ? 'bg-green-500' : pending ? 'bg-amber-400' : 'bg-red-500'}`} />
                          {up ? tr('assets.up') : pending ? tr('assets.waitingData') : tr('assets.down')}
                          {st.Uptime24 != null && <span className="text-xs text-gray-400">· {st.Uptime24}% (24h)</span>}
                        </span>
                      ) : <span className="text-sm text-gray-400">{tr('pd.noData')}</span>}
                      <a href={viewAsset.MonitorUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">{tr('pd.viewInKuma')}</a>
                    </div>
                  </div>
                )
              })()}
              {viewAsset.AccessMethod && <div className="col-span-2"><p className="text-xs text-gray-400">Access / URL</p><p className="break-all">{viewAsset.AccessMethod}</p></div>}
              {liveNote && <div className="col-span-2"><p className="text-xs text-gray-400">{tr('common.note')}</p><p className="whitespace-pre-wrap text-xs">{liveNote}</p></div>}
            </div>
          )
        })()}
      </Modal>

      {/* ── Edit Project Modal ── */}
      <Modal open={showEditProject} onClose={() => setShowEditProject(false)} title={tr('pd.editProject')} size="md">
        <form onSubmit={saveProject} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className={lc}>{tr('pd.projectName')} *</label>
            <input required value={projectForm.title} onChange={e => pf('title', e.target.value)}
              className={ic} placeholder={tr('pd.projectNamePlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>{tr('pd.company')}</label>
              <OptionSelect category="ProjectCompany" defaults={[]} value={projectForm.company} onChange={v => pf('company', v)} className={ic} />
            </div>
            <div>
              <label className={lc}>{tr('pd.group')}</label>
              <OptionSelect category="ProjectGroup" defaults={[...PROJECT_GROUPS]} value={projectForm.projectGroup} onChange={v => pf('projectGroup', v)} className={ic} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>{tr('assets.statusLabel')}</label>
              <OptionSelect category="ProjectStatus" defaults={[...PROJECT_STATUSES]} value={projectForm.status} onChange={v => pf('status', v)} className={ic} />
            </div>
            <div>
              <label className={lc}>{tr('pd.progressPct')}</label>
              <div className="flex items-center gap-2">
                <input type="range" min="0" max="100" value={projectForm.progress}
                  onChange={e => pf('progress', e.target.value)}
                  className="flex-1 accent-primary-600" />
                <span className="text-sm font-medium w-8 text-right">{projectForm.progress}</span>
              </div>
            </div>
          </div>
          <div>
            <label className={lc}>{tr('pd.startDate')}</label>
            <input type="date" value={projectForm.startDate} onChange={e => pf('startDate', e.target.value)} className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>{tr('pd.endDate')}</label>
              <input type="date" value={projectForm.endDate} onChange={e => pf('endDate', e.target.value)}
                disabled={!!projectForm.daysCount} className={ic} />
            </div>
            <div>
              <label className={lc}>{tr('pd.orDays')}</label>
              <input type="number" min="1" placeholder="30" value={projectForm.daysCount}
                onChange={e => pf('daysCount', e.target.value)} className={ic} />
            </div>
          </div>
          {projectEndDate && <p className="text-xs text-primary-600">📅 End date: {projectEndDate}</p>}
          <div>
            <label className={lc}>{tr('pd.detailNote')}</label>
            <textarea value={projectForm.comment} onChange={e => pf('comment', e.target.value)}
              className={ic} rows={4} placeholder={tr('pd.detailNotePlaceholder')} />
          </div>
          {canSeeSecure && (
            <div className="border border-yellow-300 dark:border-yellow-700 rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/10">
              <label className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1.5">
                <Lock size={12} /> Secure Note <span className="font-normal opacity-70">{tr('pd.creatorAdmin')}</span>
              </label>
              <textarea value={projectForm.secureNote} onChange={e => pf('secureNote', e.target.value)}
                className={ic} rows={3} placeholder={tr('pd.secretPlaceholder')} />
            </div>
          )}
          <Button type="submit" disabled={savingProject} className="w-full justify-center">
            {savingProject ? tr('common.saving') : tr('common.saveEdit')}
          </Button>
        </form>
      </Modal>

      {/* ── Task Modal (Create / Edit) ── */}
      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)}
        title={editingTask ? tr('pd.editTask') : tr('pd.addTask')} size="md">
        <form onSubmit={saveTask} className="space-y-4">
          <div>
            <label className={lc}>{tr('pd.taskName')} *</label>
            <input required value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              className={ic} placeholder={tr('pd.taskNamePlaceholder')} />
          </div>
          <div>
            <label className={lc}>{tr('pd.assignTo')}</label>
            <SearchSelect
              options={agentOptions}
              value={taskForm.assignedEmail}
              onChange={v => setTaskForm(f => ({ ...f, assignedEmail: v }))}
              emptyLabel={tr('pd.notAssigned')}
              placeholder={tr('ticket.searchAgent')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>Due Date</label>
              <input type="date" value={taskForm.dueDate}
                disabled={!!taskForm.daysCount}
                onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                className={ic} />
            </div>
            <div>
              <label className={lc}>{tr('pd.orDaysToday')}</label>
              <input type="number" min="1" placeholder="7"
                value={taskForm.daysCount}
                onChange={e => setTaskForm(f => ({ ...f, daysCount: e.target.value }))}
                className={ic} />
            </div>
          </div>
          {taskForm.daysCount && Number(taskForm.daysCount) > 0 && (
            <p className="text-xs text-primary-600">
              📅 Due date: {(() => { const d = new Date(); d.setDate(d.getDate() + Number(taskForm.daysCount)); return d.toISOString().slice(0, 10) })()}
            </p>
          )}
          <div>
            <label className={lc}>Task Note</label>
            <textarea value={taskForm.taskNote}
              onChange={e => setTaskForm(f => ({ ...f, taskNote: e.target.value }))}
              rows={3} className={ic} placeholder={tr('pd.taskNotePlaceholder')} />
          </div>

          {/* Track + Outlook Calendar (เฉพาะตอนสร้างใหม่ — เหมือนหน้าแจ้งงาน) */}
          {!editingTask && (
            <>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={trackTask} onChange={e => setTrackTask(e.target.checked)}
                  className="rounded accent-primary-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{tr('pd.trackTask')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={addCalendar} onChange={e => setAddCalendar(e.target.checked)}
                  className="rounded accent-primary-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{tr('pd.addCalendar')}</span>
              </label>

              {addCalendar && (
                <div className="space-y-3 pl-4 border-l-2 border-primary-200 dark:border-primary-800">
                  <p className="text-xs font-medium text-primary-600">{tr('pd.calSettings')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3 sm:col-span-1">
                      <label className={lc}>{tr('pd.date')} *</label>
                      <input required={addCalendar} type="date" value={taskForm.calendarDate}
                        onChange={e => setTaskForm(f => ({ ...f, calendarDate: e.target.value }))} className={ic} />
                    </div>
                    <div>
                      <label className={lc}>{tr('pd.timeStart')}</label>
                      <select value={taskForm.startHour} onChange={e => setTaskForm(f => ({ ...f, startHour: e.target.value }))} className={ic}>
                        {HOURS.map(h => <option key={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lc}>{tr('pd.timeEnd')}</label>
                      <select value={taskForm.endHour} onChange={e => setTaskForm(f => ({ ...f, endHour: e.target.value }))} className={ic}>
                        {HOURS.map(h => <option key={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={isOnlineMeeting} onChange={e => setIsOnlineMeeting(e.target.checked)}
                      className="rounded accent-primary-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{tr('pd.addTeams')}</span>
                  </label>
                  <div>
                    <label className={lc}>{tr('pd.attendeesInternal')}</label>
                    <SearchMultiSelect label="Internal" options={agentOptions} selected={calInternalEmails}
                      onToggle={v => setCalInternalEmails(prev => prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v])} />
                    {calInternalEmails.length > 0 && <p className="text-xs text-gray-400 mt-1 truncate">{calInternalEmails.join(', ')}</p>}
                  </div>
                  <div>
                    <label className={lc}>{tr('pd.attendeesCustomer')}</label>
                    <SearchMultiSelect label={tr('pd.customer')} options={contractEmailOptions} selected={calCustomerEmails}
                      onToggle={v => setCalCustomerEmails(prev => prev.includes(v) ? prev.filter(e => e !== v) : [...prev, v])} />
                    {calCustomerEmails.length > 0 && <p className="text-xs text-gray-400 mt-1 truncate">{calCustomerEmails.join(', ')}</p>}
                  </div>
                  <div>
                    <label className={lc}>{tr('pd.externalEmail')}</label>
                    <input value={taskForm.externalAttendees} onChange={e => setTaskForm(f => ({ ...f, externalAttendees: e.target.value }))}
                      className={ic} placeholder="ext@company.com, partner@co.th" />
                  </div>
                  {buildCalendarAttendees().length > 0 && (
                    <p className="text-xs text-primary-600">{tr('pd.totalAttendeesPre')} {buildCalendarAttendees().length} {tr('pd.totalAttendeesPost')}</p>
                  )}
                </div>
              )}
            </>
          )}

          <Button type="submit" disabled={savingTask} className="w-full justify-center">
            {savingTask ? tr('common.saving') : editingTask ? tr('common.saveEdit') : tr('pd.addTask')}
          </Button>
        </form>
      </Modal>

      {/* ── Note Modal (Create / Edit) ── */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)}
        title={editingNote ? tr('pd.editNote') : tr('pd.addNote')}>
        <form onSubmit={saveNote} className="space-y-3">
          <div>
            <label className={lc}>{tr('tools.noteName')} *</label>
            <input required value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
              className={ic} placeholder={tr('pd.noteNamePlaceholder')} />
          </div>
          <div>
            <label className={lc}>{tr('ticket.description')}</label>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              rows={5} className={ic} placeholder={tr('pd.noteDetailPlaceholder')} />
          </div>
          <Button type="submit" className="w-full justify-center">
            {editingNote ? tr('common.saveEdit') : tr('common.save')}
          </Button>
        </form>
      </Modal>

      {/* ── Incident Modal (Create / Edit) ── */}
      <Modal open={showIncidentModal} onClose={() => setShowIncidentModal(false)}
        title={editingIncident ? tr('pd.editIncident') : tr('pd.reportIncident')} size="md">
        <form onSubmit={saveIncident} className="space-y-4">
          <div>
            <label className={lc}>{tr('pd.incidentName')} *</label>
            <input required value={incidentForm.title}
              onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))}
              className={ic} placeholder={tr('pd.incidentNamePlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>{tr('pd.severity')}</label>
              <OptionSelect category="IncidentSeverity" defaults={['Low', 'Medium', 'High', 'Critical']} value={incidentForm.severity} onChange={v => setIncidentForm(f => ({ ...f, severity: v }))} className={ic} />
            </div>
            <div>
              <label className={lc}>{tr('assets.statusLabel')}</label>
              <OptionSelect category="IncidentStatus" defaults={['Open', 'In Progress', 'Resolved']} value={incidentForm.status} onChange={v => setIncidentForm(f => ({ ...f, status: v }))} className={ic} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>{tr('pd.incidentDate')}</label>
              <input type="date" value={incidentForm.incidentDate}
                onChange={e => setIncidentForm(f => ({ ...f, incidentDate: e.target.value }))} className={ic} />
            </div>
            <div>
              <label className={lc}>{tr('pd.incidentResolvedDate')}</label>
              <input type="date" value={incidentForm.resolvedDate}
                onChange={e => setIncidentForm(f => ({ ...f, resolvedDate: e.target.value }))} className={ic} />
            </div>
          </div>
          <div>
            <label className={lc}>{tr('ticket.description')}</label>
            <textarea value={incidentForm.description}
              onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className={ic} placeholder={tr('pd.incidentDescPlaceholder')} />
          </div>
          <div>
            <label className={lc}>{tr('pd.assignAgent')}</label>
            <SearchSelect
              options={agentOptions}
              value={incidentForm.assignedAgentEmail}
              onChange={v => setIncidentForm(f => ({ ...f, assignedAgentEmail: v }))}
              emptyLabel={tr('pd.notAssigned')}
              placeholder={tr('ticket.searchAgent')}
            />
          </div>
          <div>
            <label className={lc}>{tr('pd.howToFix')}</label>
            <textarea value={incidentForm.resolution}
              onChange={e => setIncidentForm(f => ({ ...f, resolution: e.target.value }))}
              rows={2} className={ic} placeholder={tr('ticket.resolutionPlaceholder')} />
          </div>
          <Button type="submit" disabled={savingIncident} className="w-full justify-center">
            {savingIncident ? tr('common.saving') : editingIncident ? tr('common.saveEdit') : tr('pd.saveIncident')}
          </Button>
        </form>
      </Modal>

      {/* ── Link Modal (Create / Edit) ── */}
      <Modal open={showLinkModal} onClose={() => setShowLinkModal(false)}
        title={editingLink ? tr('pd.editLink') : tr('pd.addLink')}>
        <form onSubmit={saveLink} className="space-y-4">
          <div>
            <label className={lc}>URL *</label>
            <input required type="url" value={linkForm.url}
              onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
              className={ic} placeholder="https://..." />
          </div>
          <div>
            <label className={lc}>{tr('pd.linkName')}</label>
            <input value={linkForm.title}
              onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))}
              className={ic} placeholder={tr('pd.linkNamePlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>{tr('pd.type')}</label>
              <OptionSelect category="LinkType" defaults={[...LINK_TYPES]} value={linkForm.linkType} onChange={v => setLinkForm(f => ({ ...f, linkType: v }))} className={ic} />
            </div>
            <div>
              <label className={lc}>{tr('common.note')}</label>
              <input value={linkForm.linkNote}
                onChange={e => setLinkForm(f => ({ ...f, linkNote: e.target.value }))}
                className={ic} placeholder="..." />
            </div>
          </div>
          <Button type="submit" disabled={savingLink} className="w-full justify-center">
            {savingLink ? tr('common.saving') : editingLink ? tr('common.saveEdit') : tr('common.save')}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
