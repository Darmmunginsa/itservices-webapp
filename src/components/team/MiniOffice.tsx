import { memo, type ComponentProps } from 'react'
import { Mic, MicOff, PhoneOff, MessageCircle, Maximize2 } from 'lucide-react'
import { AvatarSprite } from './AvatarSprite'
import { ScreenVideo } from './ScreenVideo'
import { NearbyTalkBar } from './NearbyTalkBar'
import type { Avatar, Facing } from '../../utils/officeAvatar'

// ── ออฟฟิศย่อในหน้าต่างลอย: แผนที่ย่อ + ตัวละครทุกคน + ไมค์ + จอที่แชร์ ──
// แผนที่วาดเป็นสีพื้นต่อช่อง (เบา ไม่วาดของตกแต่ง) — ไว้ดูว่าใครอยู่ไหน ใครกำลังพูด

const FLOOR: Record<string, string> = {
  '#': '#475569', '.': '#f5e6c8', M: '#dbe3ee', F: '#fbe4ea', C: '#d5f1f5', S: '#e9e3fb', E: '#c08457',
  g: '#86c96b', p: '#d6d3d1', w: '#5bb3e6', f: '#e88fb2', h: '#2f7a3a', T: '#a16207', d: '#c79a63', K: '#64748b', W: '#f8fafc',
}
const floorOf = (ch: string) => FLOOR[ch] ?? (/[PGYLRUZNJ]/.test(ch) ? '#4d9a4f' : '#f5e6c8')

export interface MiniPerson { email: string; x: number; y: number; name: string; avatar: Avatar; face: Facing; speaking: boolean; muted: boolean; me?: boolean; sitting?: boolean }

interface Props {
  rows: string[]
  people: MiniPerson[]
  zoneLabel: string
  unread: number
  micOn: boolean
  muted: boolean
  onToggleMute: () => void
  onLeaveVoice: () => void
  onBack: () => void
  screen: MediaStream | null
  screenBy: string
  /** แถบ "อยู่ใกล้ — ขอคุยด้วยเสียง" (เหมือนหน้าหลัก) */
  nearBar?: ComponentProps<typeof NearbyTalkBar>
}

function MiniOfficeBase({ rows, people, zoneLabel, unread, micOn, muted, onToggleMute, onLeaveVoice, onBack, screen, screenBy, nearBar }: Props) {
  const h = rows.length, w = rows[0]?.length ?? 1
  return (
    <div className="relative h-full flex flex-col text-xs text-gray-700 dark:text-gray-200 select-none">
      {nearBar && <NearbyTalkBar {...nearBar} compact />}
      {screen ? (
        <div className="relative flex-1 min-h-0 bg-black">
          <ScreenVideo stream={screen} className="w-full h-full object-contain" />
          <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">🖥️ {screenBy}</span>
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 flex items-center justify-center bg-slate-700 overflow-hidden" style={{ containerType: 'size' }}>
          {/* แผนที่คงอัตราส่วน ย่อ/ขยายตามขนาดหน้าต่างลอย */}
          <div className="relative" style={{ aspectRatio: `${w} / ${h}`, width: `min(100cqw, ${(w / h).toFixed(4)} * 100cqh)` }}>
            <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 w-full h-full" shapeRendering="crispEdges" aria-hidden="true">
              {rows.map((row, y) => row.split('').map((ch, x) => <rect key={`${x},${y}`} x={x} y={y} width="1.02" height="1.02" fill={floorOf(ch)} />))}
            </svg>
            {people.map(p => (
              <div key={p.email} className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-full"
                style={{ left: `${((p.x + 0.5) / w) * 100}%`, top: `${((p.y + 1) / h) * 100}%`, transition: 'left 1s linear, top 1s linear', zIndex: p.me ? 2 : 1 }}>
                <span className={`text-[8px] leading-none px-1 py-px rounded whitespace-nowrap ${p.me ? 'bg-primary-600 text-white' : 'bg-white/90 text-gray-700'}`}>
                  {p.speaking ? '🔊 ' : p.muted ? '🔇 ' : ''}{p.name}
                </span>
                <span className={`rounded-full ${p.speaking ? 'ring-2 ring-green-400' : ''}`}>
                  <AvatarSprite a={p.avatar} facing={p.face} sitting={p.sitting} size={20} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* แถบควบคุม */}
      <div className="h-[34px] shrink-0 flex items-center gap-1.5 px-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <span className="truncate text-gray-500">📍 {zoneLabel}</span>
        {unread > 0 && <span className="inline-flex items-center gap-0.5 px-1.5 rounded-full bg-red-500 text-white"><MessageCircle size={10} /> {unread}</span>}
        <span className="ml-auto" />
        {micOn && (
          <>
            <button onClick={onToggleMute} title={muted ? 'เปิดไมค์' : 'ปิดไมค์'}
              className={`p-1.5 rounded-full ${muted ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>{muted ? <MicOff size={12} /> : <Mic size={12} />}</button>
            <button onClick={onLeaveVoice} title="ออกจากเสียง" className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-red-100"><PhoneOff size={12} /></button>
          </>
        )}
        <button onClick={onBack} title="กลับไปหน้าต่างออฟฟิศ" className="p-1.5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-primary-100"><Maximize2 size={12} /></button>
      </div>
    </div>
  )
}

export const MiniOffice = memo(MiniOfficeBase)
