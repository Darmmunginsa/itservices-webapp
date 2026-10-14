import { Phone, X } from 'lucide-react'

// ── แถบ "อยู่ใกล้ใคร" กลางจอด้านบน (แบบ Gather) ──
// เดินเข้าระยะคุยได้ → เด้งขึ้นเองพร้อมปุ่ม "ขอคุยด้วยเสียง" · ใช้ทั้ง 2D / 3D / หน้าต่างลอย

export interface NearbyTalk { email: string; name: string; state: 'none' | 'asking-out' }

interface Props {
  items: NearbyTalk[]
  onAsk: (email: string) => void
  onCancel: (email: string) => void
  onDismiss: (email: string) => void
  compact?: boolean
}

export function NearbyTalkBar({ items, onAsk, onCancel, onDismiss, compact }: Props) {
  if (!items.length) return null
  return (
    <div className={`absolute z-30 left-1/2 -translate-x-1/2 ${compact ? 'top-1' : 'top-2'} flex flex-col items-center gap-1 pointer-events-none`}>
      {items.slice(0, 3).map(p => (
        <div key={p.email} className={`pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 dark:bg-gray-900/95 shadow-lg border border-primary-200 dark:border-primary-800 ${compact ? 'pl-2 pr-1 py-0.5 text-[10px]' : 'pl-3 pr-1.5 py-1 text-xs'}`}>
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <span className="truncate max-w-[10rem]">อยู่ใกล้ <b>{p.name}</b></span>
          {p.state === 'asking-out' ? (
            <>
              <span className="text-amber-600 dark:text-amber-400 animate-pulse">📞 รอตอบ…</span>
              <button onClick={() => onCancel(p.email)} className="text-gray-500 hover:text-red-600 underline">ยกเลิก</button>
            </>
          ) : (
            <button onClick={() => onAsk(p.email)}
              className={`inline-flex items-center gap-1 rounded-full bg-primary-600 text-white hover:bg-primary-700 ${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}>
              <Phone size={compact ? 10 : 11} /> ขอคุยด้วยเสียง
            </button>
          )}
          <button onClick={() => onDismiss(p.email)} title="ซ่อน" className="p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={compact ? 10 : 12} /></button>
        </div>
      ))}
    </div>
  )
}
