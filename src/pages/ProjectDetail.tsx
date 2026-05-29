import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff, Lock, Plus, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Modal } from '../components/common/Modal'
import { Skeleton } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Project, Task, Note, ProjectIncident } from '../types/project'
import { getStatusColor, getSeverityColor } from '../utils/colorUtils'
import { getDueDateColor, getDueDateRowClass, getDueDateEmoji, formatDate } from '../utils/dateUtils'

export default function ProjectDetail() {
  const { id } = useParams()
  const { user, addToast } = useAppStore()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [incidents, setIncidents] = useState<ProjectIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'tasks' | 'notes' | 'incidents'>('tasks')
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showSecure, setShowSecure] = useState(false)

  const canSeeSecure = user?.role === 'Admin' || project?.CreatedByEmail === user?.email

  function load() {
    if (!id) return
    Promise.all([
      spGet<Project>('PM_Projects', `Id eq ${id}`),
      spGet<Task>('PM_Tasks', `ProjectID eq '${id}'`, undefined, 'DueDate asc'),
      spGet<Note>('PM_Notes', `ProjectID eq '${id}'`, undefined, 'Created desc'),
      spGet<ProjectIncident>('PM_Incidents', `ProjectID eq '${id}'`),
    ]).then(([proj, t, n, inc]) => {
      setProject(proj[0] ?? null)
      setTasks(t)
      setNotes(n)
      setIncidents(inc)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

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
      await spCreate('PM_Notes', { Title: noteText.slice(0, 50), ProjectID: id, NoteText: noteText, NoteBy: user.displayName })
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

  const sortedTasks = [...tasks].sort((a, b) => {
    const order: Record<string, number> = { red: 0, orange: 1, yellow: 2, normal: 3, gray: 4 }
    return (order[getDueDateColor(a.DueDate, a.IsCompleted)] ?? 3) - (order[getDueDateColor(b.DueDate, b.IsCompleted)] ?? 3)
  })

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
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
          {(['tasks', 'notes', 'incidents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
              {t === 'tasks' ? `Tasks (${tasks.length})` : t === 'notes' ? `Notes (${notes.length})` : `Incidents (${incidents.length})`}
            </button>
          ))}
        </div>

        {/* Tasks */}
        {tab === 'tasks' && (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {sortedTasks.length === 0 ? <p className="text-center text-sm text-gray-400 py-10">ไม่มี Task</p>
              : sortedTasks.map(task => {
                  const color = getDueDateColor(task.DueDate, task.IsCompleted)
                  return (
                    <div key={task.id} className={`flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 ${getDueDateRowClass(color)}`}>
                      <button onClick={() => completeTask(task)} className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${task.IsCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-primary-500'}`}>
                        {task.IsCompleted && <CheckCircle2 size={12} className="text-white" />}
                      </button>
                      <span className="text-sm w-4">{getDueDateEmoji(color)}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${task.IsCompleted ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>{task.Title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                          <span>{task.AssignedTo}</span>
                          {task.DueDate && <span>{formatDate(task.DueDate)}</span>}
                          {task.IsAcknowledged && <span className="text-green-600 flex items-center gap-0.5"><CheckCircle2 size={10} /> {task.AcknowledgedBy}</span>}
                        </div>
                      </div>
                      {!task.IsAcknowledged && task.AssignedEmail === user?.email && (
                        <Button size="sm" variant="outline" onClick={() => acknowledgeTask(task)}>รับทราบ</Button>
                      )}
                    </div>
                  )
                })
            }
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
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {incidents.length === 0 ? <p className="text-center text-sm text-gray-400 py-10">ไม่มี Incident</p>
              : incidents.map(inc => (
                  <div key={inc.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <Badge className={getSeverityColor(inc.Severity)}>{inc.Severity}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{inc.Title}</p>
                      <p className="text-xs text-gray-400 truncate">{inc.Description}</p>
                    </div>
                    <Badge className={getStatusColor(inc.Status)}>{inc.Status}</Badge>
                  </div>
                ))
            }
          </div>
        )}
      </div>

      <Modal open={showNote} onClose={() => setShowNote(false)} title="เพิ่ม Note">
        <form onSubmit={addNote} className="space-y-3">
          <textarea required value={noteText} onChange={e => setNoteText(e.target.value)} rows={5}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="รายละเอียด Note..." />
          <Button type="submit" className="w-full justify-center">บันทึก</Button>
        </form>
      </Modal>
    </div>
  )
}
