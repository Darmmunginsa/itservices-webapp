import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, ExternalLink, Link as LinkIcon, Lock, Plus, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Modal } from '../components/common/Modal'
import { Skeleton } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Project, Task, Note, ProjectIncident, ProjectLink } from '../types/project'
import type { AgentProfile } from '../types/common'
import { getStatusColor, getSeverityColor } from '../utils/colorUtils'
import { getDueDateColor, getDueDateRowClass, getDueDateEmoji, formatDate } from '../utils/dateUtils'

const LINK_TYPES = ['GitHub', 'Docs', 'Drive', 'Jira', 'Confluence', 'Other']

const EMPTY_INCIDENT = {
  title: '', severity: 'Medium', status: 'Open',
  incidentDate: new Date().toISOString().slice(0, 10),
  resolvedDate: '', description: '', assignedAgentEmail: '', resolution: '',
}

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
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showSecure, setShowSecure] = useState(false)
  // Link form
  const [showLink, setShowLink] = useState(false)
  const [linkForm, setLinkForm] = useState({ title: '', url: '', linkType: 'Other', linkNote: '' })
  const [savingLink, setSavingLink] = useState(false)
  // Incident form
  const [showIncident, setShowIncident] = useState(false)
  const [incidentForm, setIncidentForm] = useState({ ...EMPTY_INCIDENT })
  const [savingIncident, setSavingIncident] = useState(false)
  // Add Task form
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', assignedEmail: '', dueDate: '', daysCount: '', taskNote: '' })
  const [savingTask, setSavingTask] = useState(false)

  const canSeeSecure = user?.role === 'Admin' || project?.CreatedByEmail === user?.email

  function load() {
    if (!id || !/^\d+$/.test(id)) return   // guard: id must be numeric
    const numId = Number(id)
    Promise.all([
      spGet<Project>('PM_Projects', `Id eq ${numId}`),
      // ProjectID is a Number field in SP — no quotes in the filter
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
    spGet<AgentProfile>('HD_AgentProfiles', 'IsAvailable eq true', undefined, 'Title asc')
      .then(setAgents).catch(() => {})
  }, [id])

  async function acknowledgeTask(task: Task) {
    if (!user) return
    try {
      await spUpdate('PM_Tasks', task.id, {
        IsAcknowledged: true,
        AcknowledgedBy: user.displayName,
        AcknowledgedDate: new Date().toISOString(),
      })
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, IsAcknowledged: true, AcknowledgedBy: user.displayName } : t))
      addToast('success', 'รับทราบ Task แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function completeTask(task: Task) {
    try {
      await spUpdate('PM_Tasks', task.id, { IsCompleted: !task.IsCompleted })
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, IsCompleted: !t.IsCompleted } : t))
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !noteText.trim()) return
    try {
      // ProjectID is Number — pass as number
      await spCreate('PM_Notes', {
        Title: noteText.slice(0, 100),
        ProjectID: Number(id),
        NoteText: noteText,
        NoteBy: user.displayName,
      })
      addToast('success', 'บันทึก Note แล้ว')
      setNoteText('')
      setShowNote(false)
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

  async function addLink(e: React.FormEvent) {
    e.preventDefault()
    if (!linkForm.url.trim()) return
    setSavingLink(true)
    try {
      await spCreate('PM_Links', {
        Title: linkForm.title || linkForm.url.slice(0, 100),
        ProjectID: Number(id),
        URL: linkForm.url,
        LinkType: linkForm.linkType,
        LinkNote: linkForm.linkNote,
      })
      addToast('success', 'เพิ่ม Link แล้ว')
      setLinkForm({ title: '', url: '', linkType: 'Other', linkNote: '' })
      setShowLink(false)
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

  async function addTask(e: React.FormEvent) {
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
    try {
      await spCreate('PM_Tasks', {
        Title: taskForm.title,
        ProjectID: Number(id),
        IsCompleted: false,
        IsAcknowledged: false,
        AssignedTo: agent?.Title ?? '',
        AssignedEmail: taskForm.assignedEmail || undefined,
        DueDate: dueDate,
        TaskNote: taskForm.taskNote || undefined,
      })
      addToast('success', 'เพิ่ม Task แล้ว')
      setTaskForm({ title: '', assignedEmail: '', dueDate: '', daysCount: '', taskNote: '' })
      setShowAddTask(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingTask(false) }
  }

  async function addIncident(e: React.FormEvent) {
    e.preventDefault()
    setSavingIncident(true)
    const agent = agents.find(a => a.EmailText === incidentForm.assignedAgentEmail)
    try {
      await spCreate('PM_Incidents', {
        Title: incidentForm.title,
        ProjectID: Number(id),
        Severity: incidentForm.severity,
        Status: incidentForm.status,
        IncidentDate: incidentForm.incidentDate || undefined,
        ResolvedDate: incidentForm.resolvedDate || undefined,
        Description: incidentForm.description,
        AssignedTo: agent?.Title ?? '',
        AssignedEmail: incidentForm.assignedAgentEmail || undefined,
        Resolution: incidentForm.resolution || undefined,
      })
      addToast('success', 'บันทึก Incident แล้ว')
      setIncidentForm({ ...EMPTY_INCIDENT })
      setShowIncident(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingIncident(false) }
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const order: Record<string, number> = { red: 0, orange: 1, yellow: 2, normal: 3, gray: 4 }
    return (order[getDueDateColor(a.DueDate, a.IsCompleted)] ?? 3) - (order[getDueDateColor(b.DueDate, b.IsCompleted)] ?? 3)
  })

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

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

        {/* Tasks */}
        {tab === 'tasks' && (
          <div className="space-y-3">
            {['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '') && (
              <Button size="sm" onClick={() => setShowAddTask(true)}><Plus size={14} /> เพิ่ม Task</Button>
            )}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {sortedTasks.length === 0 ? <p className="text-center text-sm text-gray-400 py-10">ไม่มี Task</p>
              : sortedTasks.map(task => {
                  const color = getDueDateColor(task.DueDate, task.IsCompleted)
                  return (
                    <div key={task.id} className={`flex items-start gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 ${getDueDateRowClass(color)}`}>
                      <button onClick={() => completeTask(task)} className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.IsCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-500'}`}>
                        {task.IsCompleted && <CheckCircle2 size={12} className="text-white" />}
                      </button>
                      <span className="text-sm w-4 mt-0.5">{getDueDateEmoji(color)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${task.IsCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{task.Title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                          <span>{task.AssignedTo}</span>
                          {task.DueDate && <span>{formatDate(task.DueDate)}</span>}
                          {task.IsAcknowledged && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> {task.AcknowledgedBy}</span>}
                        </div>
                        {task.TaskNote && <p className="text-xs text-gray-500 mt-1 italic">{task.TaskNote}</p>}
                      </div>
                      {!task.IsAcknowledged && task.AssignedEmail === user?.email && (
                        <Button size="sm" variant="outline" onClick={() => acknowledgeTask(task)}>รับทราบ</Button>
                      )}
                    </div>
                  )
                })
            }
          </div>
          </div>
        )}

        {/* Notes */}
        {tab === 'notes' && (
          <div className="space-y-3">
            <Button size="sm" onClick={() => setShowNote(true)}><Plus size={14} /> เพิ่ม Note</Button>
            {notes.map(note => (
              <Card key={note.id} className="relative">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.NoteText}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                  <span>{note.NoteBy} • {formatDate(note.Created)}</span>
                  {(user?.role === 'Admin' || note.NoteBy === user?.displayName) && (
                    <button onClick={() => deleteNote(note.id)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                  )}
                </div>
              </Card>
            ))}
            {notes.length === 0 && <p className="text-sm text-gray-400 text-center py-8">ไม่มี Note</p>}
          </div>
        )}

        {/* Incidents */}
        {tab === 'incidents' && (
          <div className="space-y-3">
            <Button size="sm" variant="outline" onClick={() => setShowIncident(true)}><Plus size={14} /> แจ้ง Incident</Button>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {incidents.length === 0 ? <p className="text-center text-sm text-gray-400 py-10">ไม่มี Incident</p>
              : incidents.map(inc => (
                  <div key={inc.id} className="flex items-start gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <Badge className={getSeverityColor(inc.Severity)}>{inc.Severity}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{inc.Title}</p>
                      <p className="text-xs text-gray-400 truncate">{inc.Description}</p>
                      {inc.Resolution && <p className="text-xs text-green-600 mt-0.5">✓ {inc.Resolution}</p>}
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <Badge className={getStatusColor(inc.Status)}>{inc.Status}</Badge>
                      {inc.IncidentDate && <span className="text-xs text-gray-400">{formatDate(inc.IncidentDate)}</span>}
                    </div>
                  </div>
                ))
            }
          </div>
          </div>
        )}

        {/* Links */}
        {tab === 'links' && (
          <div className="space-y-3">
            <Button size="sm" onClick={() => setShowLink(true)}><Plus size={14} /> เพิ่ม Link</Button>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              {links.length === 0 ? <p className="text-center text-sm text-gray-400 py-10">ไม่มี Link</p>
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
                      {(user?.role === 'Admin' || user?.role === 'Boss') && (
                        <button onClick={() => deleteLink(link.id)} className="text-red-400 hover:text-red-600 flex-shrink-0"><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))
              }
            </div>
          </div>
        )}
      </div>

      {/* Add Task Modal */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="เพิ่ม Task" size="md">
        <form onSubmit={addTask} className="space-y-4">
          <div>
            <label className={labelClass}>ชื่อ Task *</label>
            <input required value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              className={inputClass} placeholder="ระบุชื่อ Task..." />
          </div>
          <div>
            <label className={labelClass}>Assign ให้</label>
            <select value={taskForm.assignedEmail}
              onChange={e => setTaskForm(f => ({ ...f, assignedEmail: e.target.value }))}
              className={inputClass}>
              <option value="">-- ยังไม่ Assign --</option>
              {agents.map(a => <option key={a.id} value={a.EmailText}>{a.Title}{a.SupportGroup ? ` · ${a.SupportGroup}` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Due Date</label>
              <input type="date" value={taskForm.dueDate}
                disabled={!!taskForm.daysCount}
                onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>หรือกำหนดวัน (นับจากวันนี้)</label>
              <input type="number" min="1" placeholder="เช่น 7 = 1 สัปดาห์"
                value={taskForm.daysCount}
                onChange={e => setTaskForm(f => ({ ...f, daysCount: e.target.value }))}
                className={inputClass} />
            </div>
          </div>
          {taskForm.daysCount && Number(taskForm.daysCount) > 0 && (
            <p className="text-xs text-primary-600">
              📅 Due date: {(() => { const d = new Date(); d.setDate(d.getDate() + Number(taskForm.daysCount)); return d.toISOString().slice(0, 10) })()}
            </p>
          )}
          <div>
            <label className={labelClass}>Task Note</label>
            <textarea value={taskForm.taskNote}
              onChange={e => setTaskForm(f => ({ ...f, taskNote: e.target.value }))}
              rows={3} className={inputClass} placeholder="รายละเอียดเพิ่มเติม หรือขั้นตอนที่ต้องทำ..." />
          </div>
          <Button type="submit" disabled={savingTask} className="w-full justify-center">
            {savingTask ? 'กำลังบันทึก...' : 'เพิ่ม Task'}
          </Button>
        </form>
      </Modal>

      {/* Add Note Modal */}
      <Modal open={showNote} onClose={() => setShowNote(false)} title="เพิ่ม Note">
        <form onSubmit={addNote} className="space-y-3">
          <textarea required value={noteText} onChange={e => setNoteText(e.target.value)} rows={5}
            className={inputClass}
            placeholder="รายละเอียด Note..." />
          <Button type="submit" className="w-full justify-center">บันทึก</Button>
        </form>
      </Modal>

      {/* Add Incident Modal */}
      <Modal open={showIncident} onClose={() => setShowIncident(false)} title="แจ้ง Incident" size="md">
        <form onSubmit={addIncident} className="space-y-4">
          <div>
            <label className={labelClass}>ชื่อ Incident *</label>
            <input required value={incidentForm.title} onChange={e => setIncidentForm(f => ({ ...f, title: e.target.value }))}
              className={inputClass} placeholder="อธิบายปัญหาที่เกิดขึ้น..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>ความรุนแรง</label>
              <select value={incidentForm.severity} onChange={e => setIncidentForm(f => ({ ...f, severity: e.target.value }))} className={inputClass}>
                {['Low', 'Medium', 'High', 'Critical'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>สถานะ</label>
              <select value={incidentForm.status} onChange={e => setIncidentForm(f => ({ ...f, status: e.target.value }))} className={inputClass}>
                {['Open', 'In Progress', 'Resolved'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>วันที่เกิด Incident</label>
              <input type="date" value={incidentForm.incidentDate} onChange={e => setIncidentForm(f => ({ ...f, incidentDate: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>วันที่แก้ไขได้</label>
              <input type="date" value={incidentForm.resolvedDate} onChange={e => setIncidentForm(f => ({ ...f, resolvedDate: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>รายละเอียด</label>
            <textarea value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className={inputClass} placeholder="อธิบายรายละเอียดของปัญหา..." />
          </div>
          <div>
            <label className={labelClass}>Assign ให้</label>
            <select value={incidentForm.assignedAgentEmail} onChange={e => setIncidentForm(f => ({ ...f, assignedAgentEmail: e.target.value }))} className={inputClass}>
              <option value="">-- เลือก Agent --</option>
              {agents.map(a => <option key={a.id} value={a.EmailText}>{a.Title}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>วิธีแก้ไข (ถ้ามี)</label>
            <textarea value={incidentForm.resolution} onChange={e => setIncidentForm(f => ({ ...f, resolution: e.target.value }))}
              rows={2} className={inputClass} placeholder="อธิบายวิธีที่แก้ไขปัญหา..." />
          </div>
          <Button type="submit" disabled={savingIncident} className="w-full justify-center">{savingIncident ? 'กำลังบันทึก...' : 'บันทึก Incident'}</Button>
        </form>
      </Modal>

      {/* Add Link Modal */}
      <Modal open={showLink} onClose={() => setShowLink(false)} title="เพิ่ม Link">
        <form onSubmit={addLink} className="space-y-4">
          <div>
            <label className={labelClass}>URL *</label>
            <input required type="url" value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))}
              className={inputClass} placeholder="https://..." />
          </div>
          <div>
            <label className={labelClass}>ชื่อ Link</label>
            <input value={linkForm.title} onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))}
              className={inputClass} placeholder="(ถ้าไม่กรอกจะใช้ URL)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>ประเภท</label>
              <select value={linkForm.linkType} onChange={e => setLinkForm(f => ({ ...f, linkType: e.target.value }))} className={inputClass}>
                {LINK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>หมายเหตุ</label>
              <input value={linkForm.linkNote} onChange={e => setLinkForm(f => ({ ...f, linkNote: e.target.value }))}
                className={inputClass} placeholder="..." />
            </div>
          </div>
          <Button type="submit" disabled={savingLink} className="w-full justify-center">{savingLink ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </form>
      </Modal>
    </div>
  )
}
