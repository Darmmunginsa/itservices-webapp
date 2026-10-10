import { useState } from 'react'
import { Trees, VolumeX, Volume1, Volume2, SlidersHorizontal } from 'lucide-react'
import { GARDEN_LAYERS, type GardenSoundSettings } from '../../utils/focusMusic'

// ── การ์ดเสียงธรรมชาติ — โผล่เมื่ออยู่ในสวน ──

interface Props { s: GardenSoundSettings; onChange: (s: GardenSoundSettings) => void; water: number; ducked: boolean }

export function GardenSoundCard({ s, onChange, water, ducked }: Props) {
  const VolIcon = s.volume === 0 ? VolumeX : s.volume < 0.4 ? Volume1 : Volume2
  const bars = Math.round(water * 5)
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-2 p-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50 to-sky-50 dark:from-emerald-900/10 dark:to-sky-900/10 text-xs flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 ${s.enabled ? '' : 'opacity-60'}`}>
        <Trees size={13} /> สวน · เสียงธรรมชาติ
      </span>
      <button onClick={() => setOpen(o => !o)} disabled={!s.enabled} aria-expanded={open}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 disabled:opacity-50">
        <SlidersHorizontal size={12} /> ปรับแต่ละเสียง
      </button>
      {s.enabled && (
        <span className="inline-flex items-end gap-0.5 h-3" title="เสียงน้ำดังขึ้นเมื่อเดินเข้าใกล้น้ำตก/น้ำพุ">
          {[1, 2, 3, 4, 5].map(i => <span key={i} className={`w-1 rounded-sm ${i <= bars ? 'bg-sky-500' : 'bg-gray-300 dark:bg-gray-600'}`} style={{ height: 3 + i * 2 }} />)}
        </span>
      )}
      <label className="inline-flex items-center gap-1 ml-auto" title="ความดัง (ได้ยินเฉพาะในเครื่องคุณ)">
        <VolIcon size={13} className="text-gray-500" />
        <input type="range" min={0} max={100} value={Math.round(s.volume * 100)} disabled={!s.enabled}
          onChange={e => onChange({ ...s, volume: Number(e.target.value) / 100 })} className="w-20 accent-emerald-500" aria-label="ความดังเสียงสวน" />
      </label>
      <button onClick={() => onChange({ ...s, enabled: !s.enabled })}
        className={`px-2 py-0.5 rounded-full border ${s.enabled ? 'border-gray-300 dark:border-gray-600 hover:border-red-400 hover:text-red-600' : 'bg-emerald-600 text-white border-emerald-600'}`}>
        {s.enabled ? 'ปิดเสียง' : '▶ เปิดเสียง'}
      </button>
      {open && s.enabled && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 pt-1">
          {GARDEN_LAYERS.map(l => (
            <label key={l.key} className="flex items-center gap-2">
              <span className="w-16 shrink-0">{l.icon} {l.label}</span>
              <input type="range" min={0} max={100} value={Math.round(s.mix[l.key] * 100)}
                onChange={e => onChange({ ...s, mix: { ...s.mix, [l.key]: Number(e.target.value) / 100 } })}
                className="flex-1 min-w-0 accent-emerald-500" aria-label={`ความดังเสียง${l.label}`} />
              <span className="w-8 text-right tabular-nums text-gray-500">{Math.round(s.mix[l.key] * 100)}</span>
            </label>
          ))}
          <span className="w-full text-[10px] text-gray-500 sm:col-span-2 lg:col-span-3">เสียงน้ำตกยังดังขึ้นเมื่อเดินเข้าใกล้ · ลากไปที่ 0 = ปิดเสียงนั้น</span>
        </div>
      )}
      {ducked && s.enabled && <span className="w-full text-[10px] text-gray-500">🔉 ลดเสียงลงให้ระหว่างคุยเสียงกับคนอื่น</span>}
    </div>
  )
}
