import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Edit2, Eye, EyeOff, ExternalLink, Link as LinkIcon, Lock, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Modal } from '../components/common/Modal'
import { Skeleton } from '../components/common/Skeleton'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Project, Task, Note, ProjectIncident, ProjectLink } from '../types/project'
import type { AgentProfile } from '../types/common'
import { getStatusColor, getSeverityColor } from '../utils/colorUtils'
import { getDueDateColor, getDueDateRowClass, getDueDateEmoji, formatDate } from '../utils/dateUtils'

const LINK_TYPES = ['GitHub', 'Docs', 'Drive', 'Jira', 'Confluence', 'Other']

const EMPTY_TASK = { title: '', assignedEmail: '', dueDate: '', daysCount: '', taskNote: '' }
const EMPTY_INCIDENT = {
  title: '', severity: 'Medium', status: 'Open',
  incidentDate: new Date().toISOString().slice(0, 10),
  resolvedDate: '', description: '', assignedAgentEmail: '', resolution: '',
}
const EMPTY_LINK = { title: '', url: '', linkType: 'Other', linkNote: '' }

export default function ProjectDetail() {
  const { id } = useParams()
  const { user, addToast } = useAppStore()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [incidents, setIncidents] = useState<ProjectIncident[]>([])
  const [links, setLinks] = useState<ProjectLink[]>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'tasks' | 'notes' | 'incidents' | 'links'>('tasks')
  const [showSecure, setShowSecure] = useState(false)

  // Attachment panel toggle key: 'task-42' | 'note-7' | 'incident-3'
  const [attachKey, setAttachKey] = useState<string | null>(null)

  // Task modal (create & edit)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState({ ...EMPTY_TASK })
  const [savingTask, setSavingTask] = useState(false)

  // Note modal (create & edit)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
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
  const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const isBossAdmin = ['Boss', 'Admin'].includes(user?.role ?? '')

  function load() {
    if (!id || !/^\d+$/.test(id)) return
    const numId = Number(id)
    Promise.all([
      spGet<Project>('PM_Projects', `Id eq ${numId}`),
      spGet<Task>('PM_Tasks', `ProjectID eq ${numId}`, undefined, 'DueDate asc'),
      spGet<Note>('PM_Notes', `ProjectID eq ${numId}`, undefined, 'Created desc'),
      spGet<ProjectIncident>('PM_Incidents', `ProjectID eq ${numId}`),
      spGet<ProjectLink>('PM_Links', `ProjectID eq ${numId}`, undefined, 'Title asc'),
    ]).then(([proj, t, n, inc, lnk]) => {
      setProject(proj[0] ?? null)
      setTasks(t)
      setNotes(n)
      setIncidents(inc)
      setLinks(lnk)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // Load ALL agents — no IsAvailable filter
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc')
      .then(setAgents).catch(() => {})
  }, [id])

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
  function openAddTask() {
    setEditingTask(null)
    setTaskForm({ ...EMPTY_TASK })
    setShowTaskModal(true)
  }

  function openEditTask(task: Task) {
    setEditingTask(task)
    setTaskForm({
      title: task.Title,
      assignedEmail: task.AssignedEmail ?? '',
      dueDate: task.DueDate ?? '',
      daysCount: '',
      taskNote: task.TaskNote ?? '',
    })
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
        await spCreate('PM_Tasks', { ...payload, ProjectID: Number(id), IsCompleted: false, IsAcknowledged: false })
        addToast('success', 'เพิ่ม Task แล้ว')
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
    setNoteText('')
    setShowNoteModal(true)
  }

  function openEditNote(note: Note) {
    setEditingNote(note)
    setNoteText(note.NoteText)
    setShowNoteModal(true)
  }

  async function saveNote(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !noteText.trim()) return
    try {
      if (editingNote) {
        await spUpdate('PM_Notes', editingNote.id, {
          Title: noteText.slice(0, 100),
          NoteText: noteText,
        })
        addToast('success', 'อัปเดต Note แล้ว')
      } else {
        await spCreate('PM_Notes', {
          Title: noteText.slice(0, 100),
          ProjectID: Number(id),
          NoteText: noteText,
          NoteBy: user.displayName,
        })
        addToast('success', 'บันทึก Note แล้ว')
      }
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
      incidentDate: inc.IncidentDate ?? new Date().toISOString().slice(0, 10),
      resolvedDate: inc.ResolvedDate ?? '',
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
      if (editingIncident) {
        await spUpdate('PM_Incidents', editingIncident.id, payload)
        addToast('success', 'อัปเดต Incident แล้ว')
      } else {
        await spCreate('PM_Incidents', { ...payload, ProjectID: Number(id) })
        addToast('success', 'บันทึก Incident แล้ว')
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
      url: link.URL ?? '',
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
      URL: linkForm.url,
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function toggleAttach(type: string, itemId: number) {
    const key = `${type}-${itemId}`
    setAttachKey(prev => prev === key ? null : key)
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const order: Record<string, number> = { red: 0, orange: 1, yellow: 2, normal: 3, gray: 4 }
    return (order[getDueDateColor(a.DueDate, a.IsCompleted)] ?? 3) - (order[getDueDateColor(b.DueDate, b.IsCompleted)] ?? 3)
  })

  const ic = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const lc = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  if (loading) return <div className="p-6"><Skeleton className="h-64" /></div>
  if (!project) return <div className="p-6 text-gray-400">ไม่พบโครงการ</div>

  return (
    <div>
      <Header title={project.Title} />
      <div className="p-4 md:p-6 space-y-5">

        {/* Info Card */}
        <Card>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{project.Title}</h2>
              <p className="text-sm text-gray-500 mt-1">{project.Company}</p>
            </div>
            <Badge className={getStatusColor(project.Status)}>{project.Status}</Badge>
          </div>
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>ความคืบหน้า</span><span className="font-medium">{project.Progress ?? 0}%</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full" style={{ width: `${project.Progress ?? 0}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400 text-xs">เริ่มต้น</span><p>{formatDate(project.StartDate)}</p></div>
            <div><span className="text-gray-400 text-xs">สิ้นสุด</span><p>{formatDate(project.EndDate)}</p></div>
          </div>
          {project.Description && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{project.Description}</p>}

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
                ? <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded-lg font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{project.SecureNote || '(ว่าง)'}</pre>
                : <p className="text-xs text-gray-400 italic">{project.SecureNote ? 'คลิก 👁 เพื่อดูข้อมูล' : '(ว่าง)'}</p>
              : <p className="text-xs text-gray-400 flex items-center gap-1"><Lock size={12} /> ข้อมูลลับ</p>
            }
          </div>
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit flex-wrap">
          {(['tasks', 'notes', 'incidents', 'links'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
              {t === 'tasks' ? `Tasks (${tasks.length})` : t === 'notes' ? `Notes (${notes.length})` : t === 'incidents' ? `Incidents (${incidents.length})` : `Links (${links.length})`}
            </button>
          ))}
        </div>

        {/* ── Tasks ── */}
        {tab === 'tasks' && (
          <div className="space-y-3">
            {isAgent && (
              <Button size="sm" onClick={openAddTask}><Plus size={14} /> เพิ่ม Task</Button>
            )}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              {sortedTasks.length === 0
                ? <p className="text-center text-sm text-gray-400 py-10">ไม่มี Task</p>
                : sortedTasks.map(task => {
                    const color = getDueDateColor(task.DueDate, task.IsCompleted)
                    const ak = `task-${task.id}`
                    return (
                      <div key={task.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div className={`flex items-start gap-3 p-3 ${getDueDateRowClass(color)}`}>
                          <button onClick={() => completeTask(task)}
                            className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.IsCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-500'}`}>
                            {task.IsCompleted && <CheckCircle2 size={12} className="text-white" />}
                          </button>
                          <span className="text-sm w-4 mt-0.5">{getDueDateEmoji(color)}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${task.IsCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{task.Title}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                              {task.AssignedTo && <span>{task.AssignedTo}</span>}
                              {task.DueDate && <span>{formatDate(task.DueDate)}</span>}
                              {task.IsAcknowledged && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> {task.AcknowledgedBy}</span>}
                            </div>
                            {task.TaskNote && <p className="text-xs text-gray-500 mt-1 italic">{task.TaskNote}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!task.IsAcknowledged && task.AssignedEmail === user?.email && (
                              <Button size="sm" variant="outline" onClick={() => acknowledgeTask(task)}>รับทราบ</Button>
                            )}
                            {isAgent && (
                              <>
                                <button onClick={() => toggleAttach('task', task.id)} title="ไฟล์แนบ"
                                  className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${attachKey === ak ? 'text-primary-600' : 'text-gray-400'}`}>
                                  <Paperclip size={13} />
                                </button>
                                <button onClick={() => openEditTask(task)} title="แก้ไข"
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => deleteTask(task.id)} title="ลบ"
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {attachKey === ak && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                            <AttachmentSection listName="PM_Tasks" itemId={task.id} />
                          </div>
                        )}
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {tab === 'notes' && (
          <div className="space-y-3">
            <Button size="sm" onClick={openAddNote}><Plus size={14} /> เพิ่ม Note</Button>
            {notes.map(note => {
              const ak = `note-${note.id}`
              const canEdit = user?.role === 'Admin' || note.NoteBy === user?.displayName
              return (
                <Card key={note.id}>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.NoteText}</p>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                    <span>{note.NoteBy} • {formatDate(note.Created)}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleAttach('note', note.id)} title="ไฟล์แนบ"
                        className={`hover:text-primary-600 transition-colors ${attachKey === ak ? 'text-primary-600' : ''}`}>
                        <Paperclip size={13} />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => openEditNote(note)} className="hover:text-primary-600 transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => deleteNote(note.id)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {attachKey === ak && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <AttachmentSection listName="PM_Notes" itemId={note.id} />
                    </div>
                  )}
                </Card>
              )
            })}
            {notes.length === 0 && <p className="text-sm text-gray-400 text-center py-8">ไม่มี Note</p>}
          </div>
        )}

        {/* ── Incidents ── */}
        {tab === 'incidents' && (
          <div className="space-y-3">
            <Button size="sm" variant="outline" onClick={openAddIncident}><Plus size={14} /> แจ้ง Incident</Button>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              {incidents.length === 0
                ? <p className="text-center text-sm text-gray-400 py-10">ไม่มี Incident</p>
                : incidents.map(inc => {
                    const ak = `incident-${inc.id}`
                    return (
                      <div key={inc.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div className="flex items-start gap-3 p-3">
                          <Badge className={getSeverityColor(inc.Severity)}>{inc.Severity}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{inc.Title}</p>
                            {inc.Description && <p className="text-xs text-gray-400 truncate">{inc.Description}</p>}
                            {inc.Resolution && <p className="text-xs text-green-600 mt-0.5">✓ {inc.Resolution}</p>}
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-1">
                            <Badge className={getStatusColor(inc.Status)}>{inc.Status}</Badge>
                            {inc.IncidentDate && <span className="text-xs text-gray-400">{formatDate(inc.IncidentDate)}</span>}
                            <div className="flex items-center gap-1 mt-0.5">
                              <button onClick={() => toggleAttach('incident', inc.id)} title="ไฟล์แนบ"
                                className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${attachKey === ak ? 'text-primary-600' : 'text-gray-400'}`}>
                                <Paperclip size={13} />
                              </button>
                              <button onClick={() => openEditIncident(inc)} title="แก้ไข"
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                                <Edit2 size={13} />
                              </button>
                              {isBossAdmin && (
                                <button onClick={() => deleteIncident(inc.id)} title="ลบ"
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {attachKey === ak && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800">
                            <AttachmentSection listName="PM_Incidents" itemId={inc.id} />
                          </div>
                        )}
                      </div>
                    )
                  })
              }
            </div>
          </div>
        )}

        {/* ── Links ── */}
        {tab === 'links' && (
          <div className="space-y-3">
            <Button size="sm" onClick={openAddLink}><Plus size={14} /> เพิ่ม Link</Button>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              {links.length === 0
                ? <p className="text-center text-sm text-gray-400 py-10">ไม่มี Link</p>
                : links.map(link => (
                    <div key={link.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <LinkIcon size={15} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a href={link.URL} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-primary-600 hover:underline flex items-center gap-1 truncate">
                          {link.Title || link.URL}
                          <ExternalLink size={11} className="flex-shrink-0" />
                        </a>
                        {link.LinkNote && <p className="text-xs text-gray-400 truncate">{link.LinkNote}</p>}
                      </div>
                      {link.LinkType && (
                        <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 flex-shrink-0">{link.LinkType}</Badge>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEditLink(link)} title="แก้ไข"
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        {isBossAdmin && (
                          <button onClick={() => deleteLink(link.id)} title="ลบ"
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              }
            </div>
          </div>
        )}
      </div>

      {/* ── Task Modal (Create / Edit) ── */}
      <Modal open={showTaskModal} onClose={() => setShowTaskModal(false)}
        title={editingTask ? 'แก้ไข Task' : 'เพิ่ม Task'} size="md">
        <form onSubmit={saveTask} className="space-y-4">
          <div>
            <label className={lc}>ชื่อ Task *</label>
            <input required value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              className={ic} placeholder="ระบุชื่อ Task..." />
          </div>
          <div>
            <label className={lc}>Assign ให้</label>
            <select value={taskForm.assignedEmail}
              onChange={e => setTaskForm(f => ({ ...f, assignedEmail: e.target.value }))}
              className={ic}>
              <option value="">-- ยังไม่ Assign --</option>
              {agents.map(a => <option key={a.id} value={a.EmailText}>{a.Title}{a.SupportGroup ? ` · ${a.SupportGroup}` : ''}</option>)}
            </select>
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
              <label className={lc}>หรือกำหนดวัน (นับจากวันนี้)</label>
              <input type="number" min="1" placeholder="เช่น 7 = 1 สัปดาห์"
                value={taskForm.daysCount}
                onChange={e => setTaskForm(f => ({ ...f, daysCount: e.target.value }))}
                className={ic} />
            </div>
          </div>
          {taskForm.daysCount && Number(taskForm.daysCount) > 0 && (
            <p className="text-xs text-primary-600">
              📅 Due date: {(() => {
                const d = new Date()
                d.setDate(d.getDate() + Number(taskForm.daysCount))
                return d.toISOString().slice(0, 10)
              })()}
            </p>
          )}
          <div>
            <label className={lc}>Task Note</label>
            <textarea value={taskForm.taskNote}
              onChange={e => setTaskForm(f => ({ ...f, taskNote: e.target.value }))}
              rows={3} className={ic} placeholder="รายละเอียดเพิ่มเติม หรือขั้นตอนที่ต้องทำ..." />
          </div>
          <Button type="submit" disabled={savingTask} className="w-full justify-center">
            {savingTask ? 'กำลังบันทึก...' : editingTask ? 'บันทึกการแก้ไข' : 'เพิ่ม Task'}
          </Button>
        </form>
      </Modal>

      {/* ── Note Modal (Create / Edit) ── */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)}
        title={editingNote ? 'แก้ไข Note' : 'เพิ่ม Note'}>
        <form onSubmit={saveNote} className="space-y-3">
          <textarea required value={noteText} onChange={e => setNoteText(e.target.value)}
            rows={5} className={ic} placeholder="รายละเอียด Note..." />
          <Button type="submit" className="w-full justify-center">
            {editingNote ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </Button>
        </form>
      </Modal>

      {/* ── Incident Modal (Create / Edit) ── */}
      <Modal open={showIncidentModal} onClose={() => setShowIncidentModal(false)}
        title={editingIncident ? 'แก้ไข Incident' : 'แจ้ง Incident'} size="md">
        <form onSubmit={saveIncident} className="space-y-4">
          <div>
            <label className={lc}>ชื่อ Incident *</label>
            <input required value={incidentForm.title}
              onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))}
              className={ic} placeholder="อธิบายปัญหาที่เกิดขึ้น..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>ความรุนแรง</label>
              <select value={incidentForm.severity}
                onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))} className={ic}>
                {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={lc}>สถานะ</label>
              <select value={incidentForm.status}
                onChange={e => setIncidentForm(f => ({ ...f, status: e.target.value }))} className={ic}>
                {['Open', 'In Progress', 'Resolved'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>วันที่เกิด Incident</label>
              <input type="date" value={incidentForm.incidentDate}
                onChange={e => setIncidentForm(f => ({ ...f, incidentDate: e.target.value }))} className={ic} />
            </div>
            <div>
              <label className={lc}>วันที่แก้ไขได้</label>
              <input type="date" value={incidentForm.resolvedDate}
                onChange={e => setIncidentForm(f => ({ ...f, resolvedDate: e.target.value }))} className={ic} />
            </div>
          </div>
          <div>
            <label className={lc}>รายละเอียด</label>
            <textarea value={incidentForm.description}
              onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className={ic} placeholder="อธิบายรายละเอียดของปัญหา..." />
          </div>
          <div>
            <label className={lc}>Assign ให้</label>
            <select value={incidentForm.assignedAgentEmail}
              onChange={e => setIncidentForm(f => ({ ...f, assignedAgentEmail: e.target.value }))} className={ic}>
              <option value="">-- เลือก Agent --</option>
              {agents.map(a => <option key={a.id} value={a.EmailText}>{a.Title}</option>)}
            </select>
          </div>
          <div>
            <label className={lc}>วิธีแก้ไข (ถ้ามี)</label>
            <textarea value={incidentForm.resolution}
              onChange={e => setIncidentForm(f => ({ ...f, resolution: e.target.value }))}
              rows={2} className={ic} placeholder="อธิบายวิธีที่แก้ไขปัญหา..." />
          </div>
          <Button type="submit" disabled={savingIncident} className="w-full justify-center">
            {savingIncident ? 'กำลังบันทึก...' : editingIncident ? 'บันทึกการแก้ไข' : 'บันทึก Incident'}
          </Button>
        </form>
      </Modal>

      {/* ── Link Modal (Create / Edit) ── */}
      <Modal open={showLinkModal} onClose={() => setShowLinkModal(false)}
        title={editingLink ? 'แก้ไข Link' : 'เพิ่ม Link'}>
        <form onSubmit={saveLink} className="space-y-4">
          <div>
            <label className={lc}>URL *</label>
            <input required type="url" value={linkForm.url}
              onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
              className={ic} placeholder="https://..." />
          </div>
          <div>
            <label className={lc}>ชื่อ Link</label>
            <input value={linkForm.title}
              onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))}
              className={ic} placeholder="(ถ้าไม่กรอกจะใช้ URL)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lc}>ประเภท</label>
              <select value={linkForm.linkType}
                onChange={e => setLinkForm(f => ({ ...f, linkType: e.target.value }))} className={ic}>
                {LINK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lc}>หมายเหตุ</label>
              <input value={linkForm.linkNote}
                onChange={e => setLinkForm(f => ({ ...f, linkNote: e.target.value }))}
                className={ic} placeholder="..." />
            </div>
          </div>
          <Button type="submit" disabled={savingLink} className="w-full justify-center">
            {savingLink ? 'กำลังบันทึก...' : editingLink ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
