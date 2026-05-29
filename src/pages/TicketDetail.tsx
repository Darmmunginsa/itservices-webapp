import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Send, UserCheck } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Skeleton } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Ticket, TicketComment, TicketStatus } from '../types/ticket'
import type { AgentProfile } from '../types/common'
import { getStatusColor, getPriorityColor } from '../utils/colorUtils'
import { formatDateTime, formatDate } from '../utils/dateUtils'

export default function TicketDetail() {
  const { id } = useParams()
  const { user, addToast } = useAppStore()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [commentType, setCommentType] = useState<'Internal' | 'External'>('Internal')
  const [sending, setSending] = useState(false)
  const [newStatus, setNewStatus] = useState<TicketStatus>('Open')
  const [resolutionNote, setResolutionNote] = useState('')
  const [newAssignedEmail, setNewAssignedEmail] = useState('')
  const [reassigning, setReassigning] = useState(false)

  function load() {
    if (!id || !/^\d+$/.test(id)) return   // guard: id must be numeric
    Promise.all([
      spGet<Ticket>('HD_Tickets', `Id eq ${id}`),
      // TicketID is a Number field — no quotes in the filter
      spGet<TicketComment>('HD_TicketComments', `TicketID eq ${id}`, undefined, 'CommentDate asc'),
    ]).then(([t, c]) => {
      setTicket(t[0] ?? null)
      if (t[0]) {
        setNewStatus(t[0].Status)
        setResolutionNote(t[0].ResolutionNote ?? '')
      }
      setComments(c)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    spGet<AgentProfile>('HD_AgentProfiles', 'IsAvailable eq true', undefined, 'Title asc')
      .then(setAgents).catch(() => {})
  }, [id])

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !comment.trim()) return
    setSending(true)
    try {
      // CommentByEmail does NOT exist in HD_TicketComments SP schema — omitted
      // TicketID is a Number field — pass as number
      await spCreate('HD_TicketComments', {
        Title: comment.slice(0, 100),
        TicketID: Number(id),
        CommentText: comment,
        CommentBy: user.displayName,
        CommentType: isAgent ? commentType : 'External',
        CommentDate: new Date().toISOString(),
      })
      setComment('')
      load()
      addToast('success', 'บันทึก Comment แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSending(false) }
  }

  async function updateStatus() {
    if (!ticket) return
    const isClosing = ['Resolved', 'Closed'].includes(newStatus)
    try {
      await spUpdate('HD_Tickets', ticket.id, {
        Status: newStatus,
        ...(isClosing && {
          ResolvedDate: new Date().toISOString(),
          ResolutionNote: resolutionNote,
        }),
      })
      setTicket(prev => prev ? {
        ...prev,
        Status: newStatus,
        ...(isClosing && { ResolvedDate: new Date().toISOString(), ResolutionNote: resolutionNote }),
      } : prev)
      addToast('success', 'อัปเดตสถานะแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function reassignAgent() {
    if (!ticket || !newAssignedEmail) return
    const agent = agents.find(a => a.EmailText === newAssignedEmail)
    setReassigning(true)
    try {
      await spUpdate('HD_Tickets', ticket.id, {
        AssignedEmail: newAssignedEmail,
        AssignedToName: agent?.Title ?? '',
      })
      setTicket(prev => prev ? { ...prev, AssignedEmail: newAssignedEmail, AssignedToName: agent?.Title ?? '' } : prev)
      addToast('success', `Reassign ให้ ${agent?.Title} แล้ว`)
      setNewAssignedEmail('')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setReassigning(false) }
  }

  async function acknowledge() {
    if (!ticket || !user) return
    try {
      await spUpdate('HD_Tickets', ticket.id, {
        IsAcknowledged: true,
        AcknowledgedBy: user.displayName,
        AcknowledgedDate: new Date().toISOString(),
      })
      setTicket(prev => prev ? { ...prev, IsAcknowledged: true } : prev)
      addToast('success', 'รับทราบ Ticket แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')
  const isClosingStatus = ['Resolved', 'Closed'].includes(newStatus)

  if (loading) return <div className="p-6"><Skeleton className="h-96" /></div>
  if (!ticket) return <div className="p-6 text-gray-400">ไม่พบ Ticket</div>

  return (
    <div>
      <Header title={ticket.TicketNumber ?? 'Ticket'} />
      <div className="p-4 md:p-6 space-y-5 max-w-4xl">

        {/* Main Info */}
        <Card>
          <div className="flex items-start justify-between mb-4 gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1">{ticket.Title}</h2>
            <div className="flex gap-2 flex-shrink-0">
              <Badge className={getPriorityColor(ticket.Priority)}>{ticket.Priority}</Badge>
              <Badge className={getStatusColor(ticket.Status)}>{ticket.Status}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <p className="text-xs text-gray-400">ผู้แจ้ง</p>
              <p className="font-medium">{ticket.CustomerName || '-'}</p>
              <p className="text-xs text-gray-400 truncate">{ticket.CustomerEmail}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Assigned</p>
              <p className="font-medium">{ticket.AssignedToName || '-'}</p>
              <p className="text-xs text-gray-400 truncate">{ticket.AssignedEmail}</p>
            </div>
            <div><p className="text-xs text-gray-400">สร้างเมื่อ</p><p>{formatDate(ticket.Created)}</p></div>
            <div><p className="text-xs text-gray-400">Due Date</p><p>{formatDate(ticket.DueDate)}</p></div>
          </div>

          {ticket.IsAcknowledged && (
            <div className="flex items-center gap-2 text-green-600 text-sm mb-4 bg-green-50 dark:bg-green-900/10 rounded-lg px-3 py-2">
              <CheckCircle2 size={15} />
              <span>รับทราบโดย {ticket.AcknowledgedBy} เมื่อ {formatDate(ticket.AcknowledgedDate)}</span>
            </div>
          )}

          {ticket.Description && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-3">
              <p className="text-xs text-gray-400 mb-1">รายละเอียด</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.Description}</p>
            </div>
          )}

          {ticket.ResolutionNote && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900 rounded-lg p-4">
              <p className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">บันทึกการแก้ไข</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.ResolutionNote}</p>
              {ticket.ResolvedDate && <p className="text-xs text-gray-400 mt-1">เมื่อ {formatDate(ticket.ResolvedDate)}</p>}
            </div>
          )}
        </Card>

        {/* Actions */}
        {isAgent && (
          <Card>
            <h3 className="text-sm font-semibold mb-3">จัดการ Ticket</h3>

            {/* Status + Acknowledge */}
            <div className="space-y-3 mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value as TicketStatus)}
                  className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  {(['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'] as TicketStatus[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Button size="sm" onClick={updateStatus} disabled={newStatus === ticket.Status}>อัปเดตสถานะ</Button>
                {!ticket.IsAcknowledged && (
                  <Button size="sm" variant="outline" onClick={acknowledge}>
                    <CheckCircle2 size={14} /> รับทราบ
                  </Button>
                )}
              </div>

              {/* ResolutionNote — required when closing */}
              {isClosingStatus && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    บันทึกการแก้ไข {newStatus === 'Resolved' || newStatus === 'Closed' ? '(แนะนำให้กรอก)' : ''}
                  </label>
                  <textarea
                    value={resolutionNote}
                    onChange={e => setResolutionNote(e.target.value)}
                    rows={3}
                    placeholder="อธิบายวิธีที่แก้ไขปัญหา..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Reassign Agent */}
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <UserCheck size={12} /> Reassign Agent
              </p>
              <div className="flex gap-2">
                <select value={newAssignedEmail} onChange={e => setNewAssignedEmail(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  <option value="">-- เลือก Agent --</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.EmailText}
                      disabled={a.EmailText === ticket.AssignedEmail}>
                      {a.Title}{a.SupportGroup ? ` · ${a.SupportGroup}` : ''}{a.EmailText === ticket.AssignedEmail ? ' (ปัจจุบัน)' : ''}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={reassignAgent}
                  disabled={reassigning || !newAssignedEmail || newAssignedEmail === ticket.AssignedEmail}>
                  {reassigning ? '...' : 'Reassign'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Comments */}
        <Card>
          <h3 className="text-sm font-semibold mb-4">Comments ({comments.length})</h3>
          <div className="space-y-3 mb-5">
            {comments.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ยังไม่มี Comment</p>}
            {comments.map(c => (
              <div key={c.id} className={`p-3 rounded-lg text-sm ${c.CommentType === 'Internal'
                ? 'bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900'
                : 'bg-gray-50 dark:bg-gray-800'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{c.CommentBy}</span>
                  <Badge className={c.CommentType === 'Internal' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}>{c.CommentType}</Badge>
                  <span className="ml-auto text-xs text-gray-400">{formatDateTime(c.CommentDate)}</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.CommentText}</p>
              </div>
            ))}
          </div>

          <form onSubmit={sendComment} className="space-y-3">
            {isAgent && (
              <div className="flex gap-2">
                {(['Internal', 'External'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setCommentType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${commentType === t ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
            <textarea required value={comment} onChange={e => setComment(e.target.value)} rows={3}
              placeholder="พิมพ์ Comment..."
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
            <Button type="submit" size="sm" disabled={sending}>
              <Send size={14} /> {sending ? 'กำลังส่ง...' : 'ส่ง Comment'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
