import { Trees, VolumeX, Volume1, Volume2 } from 'lucide-react'
import type { GardenSoundSettings } from '../../utils/focusMusic'

// ── การ์ดเสียงธรรมชาติ — โผล่เมื่ออยู่ในสวน ──

interface Props { s: GardenSoundSettings; onChange: (s: GardenSoundSettings) => void; water: number; ducked: boolean }

export function GardenSoundCard({ s, onChange, water, ducked }: Props) {
  const VolIcon = s.volume === 0 ? VolumeX : s.volume < 0.4 ? Volume1 : Volume2
  const bars = Math.round(water * 5)
  return (
    <div className="mb-2 p-2 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50 to-sky-50 dark:from-emerald-900/10 dark:to-sky-900/10 text-xs flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 ${s.enabled ? '' : 'opacity-60'}`}>
        <Trees size={13} /> สวน · เสียงธรรมชาติ
      </span>
      <span className="text-gray-500">💧 น้ำตก · 🐦 นก · 🍃 ลม · 🦆 เป็ด</span>
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
      {ducked && s.enabled && <span className="w-full text-[10px] text-gray-500">🔉 ลดเสียงลงให้ระหว่างคุยเสียงกับคนอื่น</span>}
    </div>
  )
}
