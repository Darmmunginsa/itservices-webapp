import { useState } from 'react'
import { MessageSquare, Phone, Mail, X, CheckCircle2, Clock } from 'lucide-react'
import { PersonPhoto } from '../common/PersonPhoto'
import { ROOMS, groupByRoom, teamsChatLink, teamsCallLink, type RoomKey } from '../../utils/virtualOffice'
import { STATUS_META, type StatusType, type TeamStatusSlot, type CalendarBusySlot } from '../../types/teamStatus'

// ── ออฟฟิศเสมือน — แผนผังห้อง อวาตาร์ย้ายห้องตามสถานะ กดคนแล้วทักผ่าน Teams ──

export interface OfficePerson {
  email: string
  name: string
  supportGroup?: string
  /** id ใน HD_AgentProfiles + ชื่อไฟล์รูป (ถ้ามี) — ใช้ PersonPhoto ตัวเดียวกับผังองค์กร */
  profileId: number
  photoFile?: string
  slot: TeamStatusSlot | null
  calBusy: CalendarBusySlot | null
}

interface Props {
  people: OfficePerson[]
  meEmail: string
  now: Date
  remaining: (endIso: string, now: Date) => string
  fmtTime: (iso: string) => string
  onEndMine: (slotId: number) => void
  onSetMine: () => void
}

function ringColor(p: OfficePerson): string {
  if (p.slot) return STATUS_META[p.slot.StatusType as StatusType]?.color ?? '#6366f1'
  if (p.calBusy) return '#6366f1'
  return STATUS_META.Available.color
}

export function VirtualOffice({ people, meEmail, now, remaining, fmtTime, onEndMine, onSetMine }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const me = meEmail.toLowerCase()
  const rooms = groupByRoom(people, p => ({ statusType: (p.slot?.StatusType as StatusType) ?? null, calendarBusy: !!p.calBusy }))
  const sel = picked ? people.find(p => p.email.toLowerCase() === picked) ?? null : null

  const roomClass: Record<RoomKey, string> = {
    desk:    'border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/10',
    focus:   'border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/10',
    meeting: 'border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10',
    site:    'border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-900/10',
    lounge:  'border-cyan-200 dark:border-cyan-900/50 bg-cyan-50/50 dark:bg-cyan-900/10',
    away:    'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40',
  }

  return (
    <div className="relative">
      {/* แผนผัง 3×2 — ห้องว่างก็ยังอยู่ที่เดิม จะได้มองหาคนจากตำแหน่งห้องได้ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {ROOMS.map(room => {
          const occupants = rooms[room.key]
          return (
            <div key={room.key} className={`rounded-2xl border-2 border-dashed p-3 min-h-[120px] transition-colors ${roomClass[room.key]}`} title={room.hint}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base leading-none">{room.icon}</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{room.label}</span>
                <span className="text-[10px] text-gray-400 ml-auto">{occupants.length}</span>
              </div>
              {occupants.length === 0 ? (
                <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center pt-3">— ว่าง —</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {occupants.map(p => {
                    const isMe = p.email.toLowerCase() === me
                    const isSel = picked === p.email.toLowerCase()
                    return (
                      <button key={p.email} onClick={() => setPicked(isSel ? null : p.email.toLowerCase())}
                        title={`${p.name}${p.slot ? ` · ${p.slot.Title}` : p.calBusy ? ` · ${p.calBusy.Title}` : ' · ว่าง'}`}
                        className={`flex flex-col items-center w-14 group ${isSel ? 'scale-105' : ''} transition-transform`}>
                        <span className={`rounded-full p-0.5 ring-2 ${isMe ? 'ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''}`}
                          style={{ ['--tw-ring-color' as string]: ringColor(p) }}>
                          <PersonPhoto itemId={p.profileId} fileName={p.photoFile} name={p.name} size={36} />
                        </span>
                        <span className={`text-[10px] mt-1 truncate w-full text-center ${isMe ? 'font-semibold text-primary-600' : 'text-gray-600 dark:text-gray-300'} group-hover:text-primary-600`}>
                          {isMe ? 'ฉัน' : p.name.split(/\s+/)[0]}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* การ์ดคนที่เลือก — ทัก / โทร / เมล ผ่าน Teams ที่ทุกคนมีอยู่แล้ว */}
      {sel && (() => {
        const meta = sel.slot ? STATUS_META[sel.slot.StatusType as StatusType] : null
        const isMe = sel.email.toLowerCase() === me
        const free = !sel.slot && !sel.calBusy
        const btn = 'inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600'
        return (
          <div className="mt-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-sm">
            <PersonPhoto itemId={sel.profileId} fileName={sel.photoFile} name={sel.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {sel.name}{isMe ? ' (ฉัน)' : ''}
                {sel.supportGroup && <span className="ml-1 text-[11px] font-normal text-gray-400">· {sel.supportGroup}</span>}
              </p>
              <p className="text-xs truncate" style={{ color: free ? STATUS_META.Available.color : meta?.color ?? '#6366f1' }}>
                {sel.slot
                  ? `${meta?.label} · ${sel.slot.Title} · ${remaining(sel.slot.EndTime, now)} (ถึง ${fmtTime(sel.slot.EndTime)})`
                  : sel.calBusy
                    ? `📅 ${sel.calBusy.Title} · ถึง ${fmtTime(sel.calBusy.EndTime)}`
                    : '🟢 ว่าง — ทักได้เลย'}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isMe ? (
                <>
                  {sel.slot && <button onClick={() => onEndMine(sel.slot!.id)} className={`${btn} text-green-600 border-green-300`}><CheckCircle2 size={13} /> เสร็จแล้ว / ว่าง</button>}
                  <button onClick={onSetMine} className={btn}><Clock size={13} /> {sel.slot ? 'ตั้งใหม่' : 'แจ้งว่าไม่ว่าง'}</button>
                </>
              ) : (
                <>
                  <a href={teamsChatLink(sel.email)} target="_blank" rel="noopener noreferrer" className={btn} title="เปิดแชทใน Microsoft Teams"><MessageSquare size={13} /> แชท Teams</a>
                  <a href={teamsCallLink(sel.email)} target="_blank" rel="noopener noreferrer" className={`${btn} ${free ? '' : 'opacity-60'}`} title={free ? 'โทรผ่าน Teams' : 'กำลังไม่ว่าง — โทรได้แต่ควรแชทก่อน'}><Phone size={13} /> โทร</a>
                  <a href={`mailto:${sel.email}`} className={btn}><Mail size={13} /> เมล</a>
                </>
              )}
              <button onClick={() => setPicked(null)} className="p-1.5 text-gray-400 hover:text-gray-600" title="ปิด"><X size={14} /></button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
