import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Phone, PhoneOff, Send, Search, ExternalLink, Lock } from 'lucide-react'
import { PersonPhoto } from '../common/PersonPhoto'
import { dmThread, voiceState, kindOf, textOf, QUICK_DECLINE, type Conversation, type DMKind, type DMRow } from '../../utils/officeDM'
import { teamsChatLink } from '../../utils/virtualOffice'

// ── แชทส่วนตัวในออฟฟิศ: รายชื่อ → ห้องแชทของคนนั้น · ขอคุยเสียงก่อนต่อสาย ──

export interface DMPerson { email: string; name: string; online: boolean; profileId: number; photoFile?: string }

interface Props {
  me: string
  rows: DMRow[]
  convs: Conversation[]
  now: number
  people: DMPerson[]
  openWith: string | null
  setOpenWith: (email: string | null) => void
  send: (to: string, kind: DMKind, text?: string) => Promise<boolean>
  markRead: (partner: string) => void
  callWith: string | null
}

const fmtClock = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function OfficeDMPanel({ me, rows, convs, now, people, openWith, setOpenWith, send, markRead, callWith }: Props) {
  const [q, setQ] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const personOf = (email: string): DMPerson =>
    people.find(p => p.email.toLowerCase() === email) ?? { email, name: convs.find(c => c.partner === email)?.name ?? email.split('@')[0], online: false, profileId: 0 }

  // รายชื่อ: คนที่เคยคุย (ใหม่สุดก่อน) ตามด้วยคนออนไลน์ที่ยังไม่เคยคุย
  const list = useMemo(() => {
    const known = new Set(convs.map(c => c.partner))
    const fresh = people.filter(p => p.online && p.email.toLowerCase() !== me && !known.has(p.email.toLowerCase()))
    const match = (name: string, email: string) => !q.trim() || `${name} ${email}`.toLowerCase().includes(q.trim().toLowerCase())
    return {
      convs: convs.filter(c => match(c.name, c.partner)),
      fresh: fresh.filter(p => match(p.name, p.email)),
    }
  }, [convs, people, me, q])

  const thread = openWith ? dmThread(rows, me, openWith) : []
  const st = openWith ? voiceState(rows, me, openWith, now) : { kind: 'none' as const }

  // เปิดห้องอยู่ = อ่านแล้ว (ทุกครั้งที่มีข้อความใหม่เข้ามาในห้องที่เปิด)
  useEffect(() => { if (openWith) markRead(openWith) }, [openWith, thread.length, markRead])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [thread.length, openWith])

  async function act(kind: DMKind, note?: string) {
    if (!openWith) return
    setBusy(true)
    // รับสายใหม่ขณะคุยกับคนอื่นอยู่ = วางสายเก่าก่อน (คุยส่วนตัวทีละคน)
    if (kind === 'voice-yes' && callWith && callWith !== openWith) await send(callWith, 'voice-end')
    await send(openWith, kind, note)
    setBusy(false); setDeclineOpen(false)
  }
  async function submit() {
    const t = text.trim()
    if (!t || !openWith) return
    setBusy(true)
    if (await send(openWith, 'text', t)) setText('')
    setBusy(false)
  }

  // ── รายชื่อ ──
  if (!openWith) {
    const renderRow = ({ email, name, sub, unread, online, photo, pid }: { email: string; name: string; sub: string; unread: number; online: boolean; photo?: string; pid: number }) => (
      <button key={email} onClick={() => setOpenWith(email)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white dark:hover:bg-gray-800 text-left">
        <span className="relative flex-shrink-0">
          <PersonPhoto itemId={pid} fileName={photo} name={name} size={30} />
          <span className={`absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-gray-900 ${online ? 'bg-green-500' : 'bg-gray-300'}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-xs truncate ${unread ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200'}`}>{name}</span>
          <span className="block text-[10px] text-gray-400 truncate">{sub}</span>
        </span>
        {callWith === email && <Lock size={11} className="text-green-600 flex-shrink-0" />}
        {unread > 0 && <span className="text-[10px] min-w-[18px] text-center px-1 rounded-full bg-red-500 text-white">{unread}</span>}
      </button>
    )
    return (
      <div className="flex-1 overflow-y-auto p-2 bg-gray-50/60 dark:bg-gray-900/40">
        <div className="relative mb-2">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาคน…"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
        </div>
        {list.convs.map(c => {
          const p = personOf(c.partner)
          return renderRow({ email: c.partner, name: c.name, sub: c.lastText, unread: c.unread, online: p.online, photo: p.photoFile, pid: p.profileId })
        })}
        {list.fresh.length > 0 && <p className="text-[10px] text-gray-400 px-2 mt-2 mb-1">ออนไลน์อยู่ — เริ่มคุยได้เลย</p>}
        {list.fresh.map(p => renderRow({ email: p.email.toLowerCase(), name: p.name, sub: 'แตะเพื่อทัก', unread: 0, online: true, photo: p.photoFile, pid: p.profileId }))}
        {list.convs.length === 0 && list.fresh.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-6">ยังไม่มีใครออนไลน์ — หรือกดที่ตัวคนบนแผนที่เพื่อทัก</p>
        )}
      </div>
    )
  }

  // ── ห้องแชทของคนหนึ่ง ──
  const p = personOf(openWith)
  const btn = 'inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full'
  return (<>
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 dark:border-gray-800">
      <button onClick={() => setOpenWith(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="กลับรายชื่อ"><ArrowLeft size={14} /></button>
      <PersonPhoto itemId={p.profileId} fileName={p.photoFile} name={p.name} size={24} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold truncate">{p.name}</span>
        <span className={`block text-[10px] ${p.online ? 'text-green-600' : 'text-gray-400'}`}>{p.online ? 'อยู่ในออฟฟิศ' : 'ไม่ได้อยู่ในออฟฟิศตอนนี้'}</span>
      </span>
      {/* ขอได้เมื่อยังไม่มีอะไรค้าง — ตอนอีกฝั่งกำลังขอ ให้ตอบที่การ์ดแทน ไม่ขอซ้อน */}
      {(st.kind === 'none' || st.kind === 'declined') && (
        <button onClick={() => act('voice-ask')} disabled={busy} title="ทักถามก่อนว่าสะดวกคุยด้วยเสียงไหม"
          className={`${btn} bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50`}><Phone size={11} /> ขอคุยเสียง</button>
      )}
      <a href={teamsChatLink(openWith)} target="_blank" rel="noopener noreferrer" title="เปิดใน Microsoft Teams" className="p-1 text-gray-400 hover:text-primary-600"><ExternalLink size={13} /></a>
    </div>

    {/* การ์ดสถานะการคุยเสียงของคู่นี้ */}
    {st.kind === 'asking-out' && (
      <div className="mx-2 mt-2 p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-[11px] flex items-center gap-2">
        <span className="animate-pulse">📞</span>
        <span className="flex-1">รอ {p.name.split(/\s+/)[0]} ตอบว่าสะดวกคุยด้วยเสียงไหม…</span>
        <button onClick={() => act('voice-end')} disabled={busy} className="text-gray-500 hover:text-red-600 underline">ยกเลิก</button>
      </div>
    )}
    {st.kind === 'asking-in' && (
      <div className="mx-2 mt-2 p-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 text-[11px] space-y-1.5">
        <p><b>{p.name.split(/\s+/)[0]}</b> ถามว่า สะดวกคุยด้วยเสียงไหม? 📞</p>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => act('voice-yes')} disabled={busy} className={`${btn} bg-green-600 text-white hover:bg-green-700`}><Phone size={11} /> สะดวก — คุยเลย</button>
          <button onClick={() => setDeclineOpen(o => !o)} disabled={busy} className={`${btn} border border-gray-300 dark:border-gray-600`}>ยังไม่สะดวก</button>
        </div>
        {declineOpen && (
          <div className="flex flex-wrap gap-1">
            {QUICK_DECLINE.map(qd => <button key={qd} onClick={() => act('voice-no', qd)} className={`${btn} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700`}>{qd}</button>)}
            <button onClick={() => act('voice-no')} className={`${btn} text-gray-500 underline`}>ไม่ระบุ</button>
          </div>
        )}
      </div>
    )}
    {st.kind === 'active' && (
      <div className="mx-2 mt-2 p-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-[11px] flex items-center gap-2">
        <Lock size={12} className="text-green-600" />
        <span className="flex-1">กำลังคุยส่วนตัว — คนรอบตัวไม่ได้ยิน</span>
        <button onClick={() => act('voice-end')} disabled={busy} className={`${btn} bg-red-600 text-white hover:bg-red-700`}><PhoneOff size={11} /> วางสาย</button>
      </div>
    )}
    {st.kind === 'declined' && !st.byMe && (
      <div className="mx-2 mt-2 p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-600 dark:text-gray-300">
        🙏 ยังไม่สะดวก{st.note ? ` — ${st.note}` : ''} · ลองพิมพ์คุยกันก่อน หรือขอใหม่ภายหลัง
      </div>
    )}

    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gray-50/60 dark:bg-gray-900/40">
      {thread.length === 0 && <p className="text-[11px] text-gray-400 text-center py-6">เริ่มทักทาย {p.name.split(/\s+/)[0]} ได้เลย 👋</p>}
      {thread.map(r => {
        const mine = r.FromEmail.toLowerCase() === me
        const k = kindOf(r)
        if (k !== 'text') {
          const who = mine ? 'คุณ' : p.name.split(/\s+/)[0]
          const line = k === 'voice-ask' ? `📞 ${who}ขอคุยด้วยเสียง` : k === 'voice-yes' ? `🎧 ${who}รับสาย` : k === 'voice-no' ? `🙏 ${who}ยังไม่สะดวก${textOf(r) ? ` — ${textOf(r)}` : ''}` : `📴 ${who}วางสาย`
          return <p key={r.id} className="text-center text-[10px] text-gray-400">{line} · {fmtClock(r.Created)}</p>
        }
        return (
          <div key={r.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] px-2.5 py-1.5 rounded-2xl text-xs whitespace-pre-wrap break-words ${mine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm border border-gray-100 dark:border-gray-700'}`}>
              {textOf(r)}
            </div>
            <span className="text-[9px] text-gray-300 px-1">{fmtClock(r.Created)}</span>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
    <div className="flex gap-1.5 p-2 border-t border-gray-200 dark:border-gray-800">
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        placeholder={`พิมพ์ถึง ${p.name.split(/\s+/)[0]}…`}
        className="flex-1 min-w-0 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      <button onClick={submit} disabled={busy || !text.trim()} className="px-2.5 rounded-lg bg-primary-600 text-white disabled:opacity-50"><Send size={13} /></button>
    </div>
  </>)
}
