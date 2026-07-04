import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Send, UserCheck, UserPlus, X, ChevronDown, Settings2, ThumbsUp, MessageSquare, ImagePlus } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Skeleton } from '../components/common/Skeleton'
import { SearchSelect } from '../components/common/SearchSelect'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { SmartText } from '../components/common/SmartText'
import { spGet, spCreate, spUpdate, spDelete, spUploadAttachment, spWaitForItem } from '../services/sharepoint'
import { AttachmentThumb } from '../components/common/AttachmentThumb'
import { createNotification } from '../services/notificationService'
import { useAppStore } from '../store/useAppStore'
import type { Ticket, TicketComment, TicketStatus, TicketMember } from '../types/ticket'
import type { AgentProfile } from '../types/common'
import { getStatusColor, getPriorityColor, TICKET_STATUS_DESC } from '../utils/colorUtils'
import { formatDate, timeAgo } from '../utils/dateUtils'
import { useT } from '../i18n/useT'

// Deterministic avatar color from name (YouTube-style colored circles)
const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#4f46e5']
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default function TicketDetail() {
  const { id } = useParams()
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [comments, setComments] = useState<TicketComment[]>([])
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [commentType, setCommentType] = useState<'Internal' | 'External'>('Internal')
  const [sending, setSending] = useState(false)
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  // @mention เพื่อนในทีม
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [newStatus, setNewStatus] = useState<TicketStatus>('Open')
  const [resolutionNote, setResolutionNote] = useState('')
  const [newAssignedEmail, setNewAssignedEmail] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(true)
  const [likeBusy, setLikeBusy] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<{ id: number; author: string } | null>(null)
  const [openThreads, setOpenThreads] = useState<Record<number, boolean>>({})
  const [manageOpen, setManageOpen] = useState(false)
  const [members, setMembers] = useState<TicketMember[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)

  function load() {
    if (!id || !/^\d+$/.test(id)) return   // guard: id must be numeric
    Promise.all([
      spGet<Ticket>('HD_Tickets', `Id eq ${id}`, '*,Author/Title,Author/EMail', undefined, 500, 'Author'),
      // TicketID is a Number field — no quotes in the filter
      spGet<TicketComment>('HD_TicketComments', `TicketID eq ${id}`, 'Id,TicketID,CommentText,CommentType,CommentDate,LikedBy,ParentID,Author/Title,AttachmentFiles/FileName,AttachmentFiles/ServerRelativeUrl', 'CommentDate asc', 500, 'Author,AttachmentFiles'),
    ]).then(([t, c]) => {
      setTicket(t[0] ?? null)
      if (t[0]) {
        setNewStatus(t[0].Status)
        setResolutionNote(t[0].ResolutionNote ?? '')
      }
      setComments(c)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  function loadMembers() {
    if (!id) return
    spGet<TicketMember>('HD_TicketMembers', `TicketID eq ${id}`)
      .then(setMembers).catch(() => {})
  }

  useEffect(() => {
    load()
    loadMembers()
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc')
      .then(setAgents).catch(() => {})
  }, [id])

  async function inviteMember() {
    if (!ticket || !inviteEmail || !user) return
    const agent = agents.find(a => a.EmailText === inviteEmail)
    if (!agent) return
    // Prevent duplicates
    if (members.some(m => m.AgentEmail === inviteEmail)) {
      addToast('info', 'สมาชิกนี้อยู่ในทีมแล้ว'); return
    }
    setInviting(true)
    try {
      await spCreate('HD_TicketMembers', {
        Title: agent.Title,
        TicketID: ticket.id,
        TicketTitle: ticket.Title,
        TicketNumber: ticket.TicketNumber ?? '',
        AgentEmail: inviteEmail,
        AddedBy: user.displayName,
      })
      // แจ้งเตือนในแอป (กระดิ่ง) ให้คนที่ถูกเชิญ
      createNotification({
        recipients: [inviteEmail],
        title: `👥 ${user.displayName} เชิญคุณเข้า Ticket ${ticket.TicketNumber ?? ''}`,
        message: ticket.Title,
        linkPath: `/tickets/${ticket.id}`,
        eventType: 'ticket_invite',
      })
      setInviteEmail('')
      loadMembers()
      addToast('success', `เพิ่ม ${agent.Title} เข้าทีมแล้ว`)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setInviting(false) }
  }

  async function removeMember(member: TicketMember) {
    try {
      await spDelete('HD_TicketMembers', member.id)
      setMembers(prev => prev.filter(m => m.id !== member.id))
      addToast('success', `ลบ ${member.Title} ออกจากทีมแล้ว`)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  // รายชื่อที่ @mention ได้ — เฉพาะคนใน Ticket (assignee + สมาชิกที่ invite)
  const mentionCandidates = (() => {
    const list: { name: string; email: string }[] = []
    if (ticket?.AssignedEmail) list.push({ name: ticket.AssignedToName || ticket.AssignedEmail, email: ticket.AssignedEmail })
    for (const m of members) if (m.AgentEmail) list.push({ name: m.Title, email: m.AgentEmail })
    // dedupe ตามอีเมล
    return list.filter((c, i, arr) => arr.findIndex(x => x.email.toLowerCase() === c.email.toLowerCase()) === i)
  })()

  const mentionMatches = mentionCandidates.filter(c =>
    c.name.toLowerCase().includes(mentionQuery.toLowerCase()))

  // ตรวจ @ ที่ตำแหน่ง cursor แล้วเปิด dropdown
  function onCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setComment(val)
    const pos = e.target.selectionStart ?? val.length
    const before = val.slice(0, pos)
    const at = before.lastIndexOf('@')
    // @ ต้องอยู่ต้นข้อความ หรือมีช่องว่าง/ขึ้นบรรทัดนำหน้า และยังไม่ขึ้นบรรทัดใหม่หลัง @
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1])) && !/\n/.test(before.slice(at))) {
      setMentionStart(at)
      setMentionQuery(before.slice(at + 1))
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
    }
  }

  function selectMention(c: { name: string; email: string }) {
    const el = commentRef.current
    const pos = el?.selectionStart ?? comment.length
    const tag = `@${c.name} `
    const next = comment.slice(0, mentionStart) + tag + comment.slice(pos)
    setComment(next)
    setMentionOpen(false)
    requestAnimationFrame(() => {
      if (el) { el.focus(); const p = mentionStart + tag.length; el.setSelectionRange(p, p) }
    })
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !comment.trim()) return
    setSending(true)
    try {
      const createdComment = await spCreate('HD_TicketComments', {
        Title: comment.slice(0, 100),
        TicketID: Number(id),
        CommentText: comment,
        CommentType: isAgent ? commentType : 'External',
        CommentDate: new Date().toISOString(),
        ParentID: replyTo?.id ?? 0,
      })
      // อัปโหลดรูปแนบของ comment นี้ (ผูกกับ comment item โดยตรง)
      if (commentFiles.length) {
        if (!createdComment?.id) {
          addToast('error', 'แนบไฟล์ไม่สำเร็จ: ไม่พบรหัส comment')
        } else {
          await spWaitForItem('HD_TicketComments', createdComment.id)   // รอ item พร้อมก่อน (กัน race)
          let failedUploads = 0, lastErr = ''
          for (const f of commentFiles) {
            try { await spUploadAttachment('HD_TicketComments', createdComment.id, f) }
            catch (e) { failedUploads++; lastErr = e instanceof Error ? e.message : String(e) }
          }
          if (failedUploads > 0) addToast('error', `แนบไฟล์ไม่สำเร็จ ${failedUploads} ไฟล์ (${lastErr})`)
        }
      }
      setComment('')
      setCommentFiles([])
      if (replyTo) setOpenThreads(p => ({ ...p, [replyTo.id]: true }))
      setReplyTo(null)
      load()
      // แจ้งเตือนภายใน (in-app) — agent + ผู้แจ้ง + สมาชิก ยกเว้นคนที่กดเอง
      if (ticket) {
        const submitter = ticket.Author?.EMail || ticket.CreatedByEmail
        const memberEmails = members.map(m => m.AgentEmail)
        const mentioned = mentionCandidates.filter(c =>
          comment.includes(`@${c.name}`) && c.email.toLowerCase() !== user.email.toLowerCase())
        const mentionedSet = new Set(mentioned.map(m => m.email.toLowerCase()))
        const link = `/tickets/${id}`
        const snippet = comment.slice(0, 200)

        // คนที่ถูก @ → แจ้งแบบเจาะจง (ไม่ให้ซ้ำกับ comment ปกติ)
        if (mentioned.length) {
          createNotification({
            recipients: mentioned.map(m => m.email),
            title: `📣 ${user.displayName} ถามถึงคุณใน ${ticket.TicketNumber}`,
            message: snippet,
            linkPath: link,
            eventType: 'comment_mention',
          })
        }
        // คนภายในอื่นๆ → แจ้ง comment ปกติ (ตัดคนที่ถูก @ และคนกดเองออก)
        const internal = [...new Set([ticket.AssignedEmail, submitter, ...memberEmails].filter(Boolean) as string[])]
          .filter(e => e.toLowerCase() !== user.email.toLowerCase() && !mentionedSet.has(e.toLowerCase()))
        if (internal.length) {
          createNotification({
            recipients: internal,
            title: `💬 ${user.displayName} คอมเมนต์ใน ${ticket.TicketNumber}`,
            message: snippet,
            linkPath: link,
            eventType: 'comment_added',
          })
        }
      }
      addToast('success', 'บันทึก Comment แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSending(false) }
  }

  function parseLikes(raw: string | undefined): string[] {
    if (!raw) return []
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a : [] } catch { return [] }
  }

  async function toggleLike(c: TicketComment) {
    if (!user?.email || likeBusy === c.id) return
    const current = parseLikes(c.LikedBy)
    const next = current.includes(user.email)
      ? current.filter(e => e !== user.email)
      : [...current, user.email]
    const json = JSON.stringify(next)
    // optimistic
    setComments(prev => prev.map(x => x.id === c.id ? { ...x, LikedBy: json } : x))
    setLikeBusy(c.id)
    try {
      await spUpdate('HD_TicketComments', c.id, { LikedBy: json })
    } catch {
      // revert on failure
      setComments(prev => prev.map(x => x.id === c.id ? { ...x, LikedBy: c.LikedBy } : x))
      addToast('error', 'กดถูกใจไม่สำเร็จ')
    } finally { setLikeBusy(null) }
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
      // แจ้งเตือนภายใน (in-app) — agent + ผู้แจ้ง + สมาชิก ยกเว้นคนที่กดเอง
      {
        const actorEmail = user?.email?.toLowerCase() ?? ''
        const submitter = ticket.Author?.EMail || ticket.CreatedByEmail
        const memberEmails = members.map(m => m.AgentEmail)
        const internal = [...new Set([ticket.AssignedEmail, submitter, ...memberEmails].filter(Boolean) as string[])]
          .filter(e => e.toLowerCase() !== actorEmail)
        if (internal.length) {
          createNotification({
            recipients: internal,
            title: `🔄 ${ticket.TicketNumber} เปลี่ยนสถานะเป็น ${newStatus}`,
            message: ticket.Title,
            linkPath: `/tickets/${id}`,
            eventType: 'ticket_status_changed',
          })
        }
      }
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
      // แจ้งเตือนในแอป (กระดิ่ง) ให้คนรับช่วง — ยกเว้นถ้า reassign ให้ตัวเอง
      if (newAssignedEmail.toLowerCase() !== (user?.email?.toLowerCase() ?? '')) {
        createNotification({
          recipients: [newAssignedEmail],
          title: `🔁 คุณได้รับมอบหมาย Ticket ${ticket.TicketNumber ?? ''}`,
          message: ticket.Title,
          linkPath: `/tickets/${ticket.id}`,
          eventType: 'ticket_reassigned',
        })
      }
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

  const agentOptions = agents.map(a => ({
    value: a.EmailText ?? '',
    label: `${a.Title}${a.SupportGroup ? ` · ${a.SupportGroup}` : ''}${a.EmailText === ticket?.AssignedEmail ? ` ${tr('ticket.current')}` : ''}`,
  })).filter(o => o.value)

  if (loading) return <div className="p-6"><Skeleton className="h-96" /></div>
  if (!ticket) return <div className="p-6 text-gray-400">{tr('ticket.notFound')}</div>

  // group replies under their parent
  const repliesByParent = new Map<number, TicketComment[]>()
  comments.forEach(c => {
    if (c.ParentID) {
      const arr = repliesByParent.get(c.ParentID) ?? []
      arr.push(c)
      repliesByParent.set(c.ParentID, arr)
    }
  })
  const topComments = comments.filter(c => !c.ParentID)

  const renderComment = (c: TicketComment, isReply: boolean) => {
    const author = c.Author?.Title ?? '—'
    const handle = '@' + author.replace(/\s+/g, '')
    const likeList = parseLikes(c.LikedBy)
    const liked = !!user?.email && likeList.includes(user.email)
    const avatarSize = isReply ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
    return (
      <div key={c.id} className="flex gap-3">
        <div className={`${avatarSize} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
          style={{ backgroundColor: avatarColor(author) }} title={author}>
          {author.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">{handle}</span>
            <span className="text-xs text-gray-400">{timeAgo(c.CommentDate)}</span>
            {c.CommentType === 'Internal' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">{tr('ticket.internal')}</span>
            )}
          </div>
          <SmartText text={c.CommentText} className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed" />
          {c.AttachmentFiles && c.AttachmentFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {c.AttachmentFiles.map(f => (
                <AttachmentThumb key={f.FileName} listName="HD_TicketComments" itemId={c.id} fileName={f.FileName} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 mt-1.5 -ml-1.5">
            <button type="button" disabled={likeBusy === c.id} onClick={() => toggleLike(c)}
              className={`flex items-center gap-1 px-1.5 py-1 rounded-full text-xs transition-colors disabled:opacity-50 ${liked ? 'text-primary-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <ThumbsUp size={14} fill={liked ? 'currentColor' : 'none'} />
              {likeList.length > 0 && <span>{likeList.length}</span>}
            </button>
            <button type="button"
              onClick={() => { setReplyTo({ id: isReply ? (c.ParentID as number) : c.id, author }); document.getElementById('comment-box')?.focus() }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <MessageSquare size={13} /> {tr('ticket.reply')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title={ticket.TicketNumber ?? 'Ticket'} backTo="/my-work" backLabel={tr('ticket.myWork')} />
      <div className="p-4 md:p-6 max-w-4xl space-y-5">

        {/* Main Info */}
        <Card>
          <div className="flex items-start justify-between mb-4 gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex-1">{ticket.Title}</h2>
            <div className="flex gap-2 flex-shrink-0">
              <Badge className={getPriorityColor(ticket.Priority)}>{ticket.Priority}</Badge>
              <span className="relative group/badge inline-flex">
                <Badge className={getStatusColor(ticket.Status)}>{ticket.Status}</Badge>
                {TICKET_STATUS_DESC[ticket.Status] && (
                  <span className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover/badge:block w-60 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none whitespace-normal">
                    <span className="font-semibold block mb-0.5">{ticket.Status}</span>
                    <span className="text-gray-300">{TICKET_STATUS_DESC[ticket.Status].desc}</span>
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
            <div>
              <p className="text-xs text-gray-400">{tr('ticket.reporter')}</p>
              <p className="font-medium">{ticket.CustomerName || '-'}</p>
              <p className="text-xs text-gray-400 truncate">{ticket.CustomerEmail}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Assigned</p>
              <p className="font-medium">{ticket.AssignedToName || '-'}</p>
              <p className="text-xs text-gray-400 truncate">{ticket.AssignedEmail}</p>
            </div>
            <div><p className="text-xs text-gray-400">{tr('ticket.createdAt')}</p><p>{formatDate(ticket.Created)}</p></div>
            <div><p className="text-xs text-gray-400">Due Date</p><p>{formatDate(ticket.DueDate)}</p></div>
          </div>

          {ticket.IsAcknowledged && (() => {
            const by = ticket.AcknowledgedBy?.trim()
            const at = ticket.AcknowledgedDate ? formatDate(ticket.AcknowledgedDate) : ''
            const label = by && at
              ? tr('ticket.ackByAt').replace('{by}', by).replace('{at}', at)
              : by
                ? `${tr('tracking.acked')} — ${by}`
                : tr('tracking.acked')
            return (
              <div className="flex items-center gap-2 text-green-600 text-sm mb-4 bg-green-50 dark:bg-green-900/10 rounded-lg px-3 py-2">
                <CheckCircle2 size={15} />
                <span>{label}</span>
              </div>
            )
          })()}

          {ticket.Description && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-3">
              <p className="text-xs text-gray-400 mb-1">{tr('ticket.description')}</p>
              <SmartText text={ticket.Description} className="text-sm text-gray-700 dark:text-gray-300" />
            </div>
          )}

          {ticket.ResolutionNote && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900 rounded-lg p-4">
              <p className="text-xs text-green-600 dark:text-green-400 mb-1 font-medium">{tr('ticket.resolution')}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.ResolutionNote}</p>
              {ticket.ResolvedDate && <p className="text-xs text-gray-400 mt-1">{tr('ticket.at')} {formatDate(ticket.ResolvedDate)}</p>}
            </div>
          )}
        </Card>

        {/* Comments */}
        <Card>
          <button onClick={() => setCommentsOpen(o => !o)} className="w-full flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Comments ({comments.length})</h3>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${commentsOpen ? 'rotate-180' : ''}`} />
          </button>
          {commentsOpen && (
            <div className="space-y-5 mb-6">
              {comments.length === 0 && <p className="text-sm text-gray-400 text-center py-4">{tr('ticket.noComments')}</p>}
              {topComments.map(c => {
                const kids = repliesByParent.get(c.id) ?? []
                const open = openThreads[c.id]
                return (
                  <div key={c.id}>
                    {renderComment(c, false)}
                    {kids.length > 0 && (
                      <div className="ml-12 mt-2">
                        <button type="button" onClick={() => setOpenThreads(p => ({ ...p, [c.id]: !p[c.id] }))}
                          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-2 py-1 rounded-full transition-colors">
                          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                          {kids.length} {tr('ticket.replies')}
                        </button>
                        {open && <div className="space-y-4 mt-3">{kids.map(k => renderComment(k, true))}</div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <form onSubmit={sendComment} className="flex gap-3 pt-4 pr-16 md:pr-20 border-t border-gray-100 dark:border-gray-800">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
              style={{ backgroundColor: avatarColor(user?.displayName ?? 'U') }} title={user?.displayName}>
              {(user?.displayName ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {replyTo && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-gray-400">{tr('ticket.replyingTo')}</span>
                  <span className="font-medium text-primary-600">@{replyTo.author.replace(/\s+/g, '')}</span>
                  <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500">
                    <X size={12} />
                  </button>
                </div>
              )}
              {isAgent && (
                <div className="flex gap-2">
                  {(['Internal', 'External'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setCommentType(t)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${commentType === t ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                      {t === 'Internal' ? tr('ticket.internal') : tr('ticket.toCustomer')}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <textarea ref={commentRef} id="comment-box" required value={comment} onChange={onCommentChange} rows={1}
                  placeholder={tr('ticket.commentPlaceholder')}
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                  className="w-full px-0 py-1.5 text-sm bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-primary-500 resize-none transition-colors" />
                {/* @mention dropdown */}
                {mentionOpen && mentionMatches.length > 0 && (
                  <div className="absolute z-20 left-0 bottom-full mb-1 w-64 max-h-56 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">{tr('ticket.askTeam')}</p>
                    {mentionMatches.map(c => (
                      <button key={c.email} type="button" onClick={() => selectMention(c)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20">
                        <span className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">{c.name.charAt(0)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-gray-800 dark:text-gray-100">{c.name}</span>
                          <span className="block truncate text-[11px] text-gray-400">{c.email}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                {(comment || replyTo) && (
                  <button type="button" onClick={() => { setComment(''); setReplyTo(null) }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    {tr('common.cancel')}
                  </button>
                )}
                <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                  <ImagePlus size={14} /> {tr('ticket.attachImage')}
                  <input type="file" multiple className="hidden"
                    onChange={e => { if (e.target.files) setCommentFiles(prev => [...prev, ...Array.from(e.target.files!)]); e.target.value = '' }} />
                </label>
                <Button type="submit" size="sm" disabled={sending || !comment.trim()}>
                  <Send size={14} /> {sending ? tr('ticket.sending') : 'Comment'}
                </Button>
              </div>
              {commentFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {commentFiles.map((f, i) => (
                    <div key={i} className="relative">
                      {f.type.startsWith('image/')
                        ? <img src={URL.createObjectURL(f)} alt={f.name} className="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                        : <div className="w-14 h-14 flex flex-col items-center justify-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1"><span className="text-lg">📄</span><span className="text-[8px] text-gray-500 truncate w-full text-center">{f.name}</span></div>}
                      <button type="button" onClick={() => setCommentFiles(prev => prev.filter((_, x) => x !== i))}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </Card>
       </div>

        {/* Floating manage button */}
        {!manageOpen && (
          <button onClick={() => setManageOpen(true)}
            className="fixed bottom-[8rem] right-3 md:bottom-20 md:right-4 z-40 flex items-center gap-2 bg-primary-600 text-white rounded-full px-3.5 py-2 shadow-lg hover:bg-primary-700 transition-colors text-sm font-medium">
            <Settings2 size={15} /> {tr('ticket.manage')}
          </button>
        )}

        {/* Manage slide-over panel */}
        {manageOpen && <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setManageOpen(false)} />}
        <div className={`fixed top-0 right-0 h-full w-full sm:w-[28rem] z-50 bg-gray-50 dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl transition-transform duration-300 ease-out flex flex-col ${manageOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Settings2 size={15} className="text-primary-600" /> {tr('ticket.manage')}</h2>
            <button onClick={() => setManageOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="p-4 space-y-5 overflow-y-auto">

        {/* Actions */}
        {isAgent && (
          <Card>
            <h3 className="text-sm font-semibold mb-3">{tr('ticket.statusReassign')}</h3>

            {/* Status + Acknowledge */}
            <div className="space-y-3 mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative group/status">
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value as TicketStatus)}
                    className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 pr-8">
                    {(['Open', 'In Progress', 'Pending', 'Resolved', 'Closed'] as TicketStatus[]).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {/* Tooltip คำจำกัดความของสถานะที่เลือกอยู่ */}
                  {TICKET_STATUS_DESC[newStatus] && (
                    <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover/status:block w-64 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
                      <p className="font-semibold mb-0.5">{newStatus}</p>
                      <p className="text-gray-300">{TICKET_STATUS_DESC[newStatus].desc}</p>
                    </div>
                  )}
                </div>
                <Button size="sm" onClick={updateStatus} disabled={newStatus === ticket.Status}>{tr('ticket.updateStatus')}</Button>
                {!ticket.IsAcknowledged && (
                  <Button size="sm" variant="outline" onClick={acknowledge}>
                    <CheckCircle2 size={14} /> {tr('tracking.ack')}
                  </Button>
                )}
              </div>

              {/* ResolutionNote — required when closing */}
              {isClosingStatus && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {tr('ticket.resolution')} {newStatus === 'Resolved' || newStatus === 'Closed' ? tr('ticket.recommendFill') : ''}
                  </label>
                  <textarea
                    value={resolutionNote}
                    onChange={e => setResolutionNote(e.target.value)}
                    rows={3}
                    placeholder={tr('ticket.resolutionPlaceholder')}
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
                <SearchSelect
                  options={agentOptions}
                  value={newAssignedEmail}
                  onChange={setNewAssignedEmail}
                  placeholder={tr('ticket.searchAgent')}
                  emptyLabel={tr('ticket.selectAgent')}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={reassignAgent}
                  disabled={reassigning || !newAssignedEmail || newAssignedEmail === ticket.AssignedEmail}>
                  {reassigning ? '...' : 'Reassign'}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Team Members */}
        <Card>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <UserPlus size={15} className="text-primary-600" /> {tr('ticket.team')}
          </h3>

          {/* Current members */}
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-full pl-1 pr-2 py-1">
                  <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {m.Title.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{m.Title}</span>
                  {isAgent && (
                    <button onClick={() => removeMember(m)}
                      className="text-gray-400 hover:text-red-500 transition-colors ml-0.5">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add member */}
          {isAgent && (
            <div className="flex gap-2">
              <SearchSelect
                options={agentOptions.filter(o => !members.some(m => m.AgentEmail === o.value) && o.value !== ticket.AssignedEmail)}
                value={inviteEmail}
                onChange={setInviteEmail}
                placeholder={tr('ticket.searchAgentAdd')}
                emptyLabel={tr('ticket.selectAgent')}
                className="flex-1"
              />
              <Button size="sm" onClick={inviteMember}
                disabled={inviting || !inviteEmail}>
                {inviting ? '...' : '+ Invite'}
              </Button>
            </div>
          )}

          {members.length === 0 && !isAgent && (
            <p className="text-sm text-gray-400">{tr('ticket.noMembers')}</p>
          )}
        </Card>

        {/* Attachments */}
        <Card>
          <h3 className="text-sm font-semibold mb-3">{tr('ticket.attachments')}</h3>
          <AttachmentSection listName="HD_Tickets" itemId={ticket.id} />
        </Card>
          </div>
        </div>
    </div>
  )
}
