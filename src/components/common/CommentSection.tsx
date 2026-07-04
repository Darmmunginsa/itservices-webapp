import { useEffect, useRef, useState } from 'react'
import { Send, X, ThumbsUp, MessageSquare, ChevronDown, ImagePlus } from 'lucide-react'
import { spGet, spCreate, spUpdate, spUploadAttachment, spWaitForItem, spGetAttachments } from '../../services/sharepoint'
import { AttachmentThumb } from './AttachmentThumb'
import { createNotification } from '../../services/notificationService'
import { useAppStore } from '../../store/useAppStore'
import { SmartText } from './SmartText'
import { Button } from './Button'
import { timeAgo } from '../../utils/dateUtils'
import { useT } from '../../i18n/useT'

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#4f46e5']
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export interface CommentRow {
  id: number
  CommentText: string
  CommentType: 'Internal' | 'External'
  CommentDate: string
  LikedBy?: string
  ParentID?: number
  Author?: { Title: string }
  AttachmentFiles?: { FileName: string; ServerRelativeUrl: string }[]
}

interface Props {
  listName: string                              // เช่น 'PM_Comments'
  parentField: string                           // เช่น 'ProjectID'
  parentId: number
  mentionCandidates: { name: string; email: string }[]
  linkPath: string                              // ใช้ในลิงก์แจ้งเตือน
  titleLabel: string                            // บริบทในหัวข้อแจ้งเตือน
  notifyEmails?: string[]                       // ผู้รับ comment_added (ตัดคนกดเอง+คนถูก @ อัตโนมัติ)
}

export function CommentSection({ listName, parentField, parentId, mentionCandidates, linkPath, titleLabel, notifyEmails = [] }: Props) {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const isAgent = ['Agent', 'Supervisor', 'Boss', 'Admin'].includes(user?.role ?? '')

  const [comments, setComments] = useState<CommentRow[]>([])
  const [comment, setComment] = useState('')
  const [commentType, setCommentType] = useState<'Internal' | 'External'>('Internal')
  const [sending, setSending] = useState(false)
  const [commentFiles, setCommentFiles] = useState<File[]>([])
  const [replyTo, setReplyTo] = useState<{ id: number; author: string } | null>(null)
  const [openThreads, setOpenThreads] = useState<Record<number, boolean>>({})
  const [likeBusy, setLikeBusy] = useState<number | null>(null)

  // @mention
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)

  function load() {
    spGet<CommentRow>(listName, `${parentField} eq ${parentId}`,
      'Id,CommentText,CommentType,CommentDate,LikedBy,ParentID,Author/Title,AttachmentFiles/FileName,AttachmentFiles/ServerRelativeUrl', 'CommentDate asc', 500, 'Author,AttachmentFiles')
      .then(setComments).catch(() => {})
  }
  useEffect(() => { if (parentId) load() }, [parentId])  // eslint-disable-line react-hooks/exhaustive-deps

  function parseLikes(raw: string | undefined): string[] {
    if (!raw) return []
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a : [] } catch { return [] }
  }

  const mentionMatches = mentionCandidates.filter(c => c.name.toLowerCase().includes(mentionQuery.toLowerCase()))

  function onCommentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setComment(val)
    const pos = e.target.selectionStart ?? val.length
    const before = val.slice(0, pos)
    const at = before.lastIndexOf('@')
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1])) && !/\n/.test(before.slice(at))) {
      setMentionStart(at); setMentionQuery(before.slice(at + 1)); setMentionOpen(true)
    } else setMentionOpen(false)
  }
  function selectMention(c: { name: string; email: string }) {
    const el = commentRef.current
    const pos = el?.selectionStart ?? comment.length
    const tag = `@${c.name} `
    const next = comment.slice(0, mentionStart) + tag + comment.slice(pos)
    setComment(next); setMentionOpen(false)
    requestAnimationFrame(() => { if (el) { el.focus(); const p = mentionStart + tag.length; el.setSelectionRange(p, p) } })
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !comment.trim()) return
    setSending(true)
    try {
      const created = await spCreate(listName, {
        [parentField]: parentId,
        Title: comment.slice(0, 100),
        CommentText: comment,
        CommentType: isAgent ? commentType : 'External',
        CommentDate: new Date().toISOString(),
        ParentID: replyTo?.id ?? 0,
      })
      // อัปโหลดรูปแนบของ comment นี้ (ผูกกับ comment item โดยตรง)
      if (commentFiles.length) {
        if (!created?.id) {
          addToast('error', 'แนบไฟล์ไม่สำเร็จ: ไม่พบรหัส comment')
        } else {
          const cid = created.id
          console.log('[CMT] comment created id=', cid, 'files=', commentFiles.length)
          await spWaitForItem(listName, cid)   // รอ item พร้อมก่อน (กัน race)
          console.log('[CMT] item ready, uploading…')
          let failed = 0, lastErr = ''
          for (let i = 0; i < commentFiles.length; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 400))   // เว้นจังหวะ กัน burst throttle
            try {
              await spUploadAttachment(listName, cid, commentFiles[i])
              console.log('[CMT] uploaded', commentFiles[i].name)
            } catch (e) {
              failed++; lastErr = e instanceof Error ? e.message : String(e)
              console.warn('[CMT] upload FAILED', commentFiles[i].name, lastErr)
            }
          }
          // ตรวจซ้ำด้วย path เดียวกับ ไฟล์แนบ tab (เชื่อถือได้) ว่าไฟล์ persist จริงกี่ไฟล์
          let persisted = -1
          try { persisted = (await spGetAttachments(listName, cid)).length } catch { /* ignore */ }
          console.log('[CMT] verify persisted=', persisted)
          if (failed > 0) addToast('error', `แนบไฟล์ไม่สำเร็จ ${failed} ไฟล์ (${lastErr})`)
          else if (persisted === 0) addToast('error', `อัปโหลดผ่านแต่ไฟล์ไม่ถูกบันทึก (persisted 0)`)
        }
      }
      const snippet = comment.slice(0, 200)
      const mentioned = mentionCandidates.filter(c =>
        comment.includes(`@${c.name}`) && c.email.toLowerCase() !== user.email.toLowerCase())
      const mentionedSet = new Set(mentioned.map(m => m.email.toLowerCase()))
      if (mentioned.length) {
        createNotification({
          recipients: mentioned.map(m => m.email),
          title: `📣 ${user.displayName} ถามถึงคุณใน ${titleLabel}`,
          message: snippet, linkPath, eventType: 'comment_mention',
        })
      }
      const internal = [...new Set(notifyEmails.filter(Boolean))]
        .filter(em => em.toLowerCase() !== user.email.toLowerCase() && !mentionedSet.has(em.toLowerCase()))
      if (internal.length) {
        createNotification({
          recipients: internal,
          title: `💬 ${user.displayName} คอมเมนต์ใน ${titleLabel}`,
          message: snippet, linkPath, eventType: 'comment_added',
        })
      }
      setComment('')
      setCommentFiles([])
      if (replyTo) setOpenThreads(p => ({ ...p, [replyTo.id]: true }))
      setReplyTo(null)
      load()
      addToast('success', 'บันทึก Comment แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSending(false) }
  }

  async function toggleLike(c: CommentRow) {
    if (!user?.email) return
    setLikeBusy(c.id)
    const current = parseLikes(c.LikedBy)
    const next = current.includes(user.email) ? current.filter(e => e !== user.email) : [...current, user.email]
    const json = JSON.stringify(next)
    setComments(prev => prev.map(x => x.id === c.id ? { ...x, LikedBy: json } : x))
    try { await spUpdate(listName, c.id, { LikedBy: json }) }
    catch {
      setComments(prev => prev.map(x => x.id === c.id ? { ...x, LikedBy: c.LikedBy } : x))
      addToast('error', 'กดถูกใจไม่สำเร็จ')
    } finally { setLikeBusy(null) }
  }

  const repliesByParent = new Map<number, CommentRow[]>()
  comments.forEach(c => {
    if (c.ParentID) { const arr = repliesByParent.get(c.ParentID) ?? []; arr.push(c); repliesByParent.set(c.ParentID, arr) }
  })
  const topComments = comments.filter(c => !c.ParentID)

  const renderComment = (c: CommentRow, isReply: boolean) => {
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
                <AttachmentThumb key={f.FileName} listName={listName} itemId={c.id} fileName={f.FileName} />
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
              onClick={() => { setReplyTo({ id: isReply ? (c.ParentID as number) : c.id, author }); document.getElementById('proj-comment-box')?.focus() }}
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
              <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
            </div>
          )}
          {isAgent && (
            <div className="flex gap-2">
              {(['Internal', 'External'] as const).map(t => (
                <button key={t} type="button" onClick={() => setCommentType(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${commentType === t ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                  {t === 'Internal' ? tr('ticket.internal') : tr('ticket.external')}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <textarea ref={commentRef} id="proj-comment-box" required value={comment} onChange={onCommentChange} rows={1}
              placeholder={tr('ticket.commentPlaceholder')}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
              className="w-full px-0 py-1.5 text-sm bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-primary-500 resize-none transition-colors" />
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
                className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">{tr('common.cancel')}</button>
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
    </div>
  )
}
