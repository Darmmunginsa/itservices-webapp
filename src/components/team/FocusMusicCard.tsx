import { Music, VolumeX, Volume1, Volume2 } from 'lucide-react'
import { PRESETS, type MusicSettings } from '../../utils/focusMusic'

// ── การ์ดเพลงผ่อนคลาย — โผล่เมื่ออยู่ในห้องโฟกัส ──

interface Props { s: MusicSettings; onChange: (s: MusicSettings) => void; ducked: boolean }

export function FocusMusicCard({ s, onChange, ducked }: Props) {
  const VolIcon = s.volume === 0 ? VolumeX : s.volume < 0.4 ? Volume1 : Volume2
  return (
    <div className="mb-2 p-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-gradient-to-r from-rose-50 to-emerald-50 dark:from-rose-900/10 dark:to-emerald-900/10 text-xs flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1 font-semibold text-rose-700 dark:text-rose-300 ${s.enabled ? '' : 'opacity-60'}`}>
        <Music size={13} className={s.enabled ? 'animate-pulse' : ''} /> ห้องโฟกัส · เพลงผ่อนคลาย
      </span>
      <div className="flex gap-1">
        {PRESETS.map(p => (
          <button key={p.key} title={p.hint} onClick={() => onChange({ ...s, preset: p.key, enabled: true })}
            className={`px-2 py-0.5 rounded-full border ${s.enabled && s.preset === p.key ? 'bg-white dark:bg-gray-900 border-rose-300 dark:border-rose-700 font-semibold shadow-sm' : 'border-transparent text-gray-500 hover:bg-white/70 dark:hover:bg-gray-900/50'}`}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>
      <label className="inline-flex items-center gap-1 ml-auto" title="ความดัง (เพลงเล่นในเครื่องคุณเท่านั้น ไม่ส่งผ่านไมค์)">
        <VolIcon size={13} className="text-gray-500" />
        <input type="range" min={0} max={100} value={Math.round(s.volume * 100)} disabled={!s.enabled}
          onChange={e => onChange({ ...s, volume: Number(e.target.value) / 100 })}
          className="w-20 accent-rose-500" aria-label="ความดังเพลง" />
      </label>
      <button onClick={() => onChange({ ...s, enabled: !s.enabled })}
        className={`px-2 py-0.5 rounded-full border ${s.enabled ? 'border-gray-300 dark:border-gray-600 hover:border-red-400 hover:text-red-600' : 'bg-rose-600 text-white border-rose-600'}`}>
        {s.enabled ? 'ปิดเพลง' : '▶ เปิดเพลง'}
      </button>
      {ducked && s.enabled && <span className="w-full text-[10px] text-gray-500">🔉 ลดเสียงเพลงลงให้ระหว่างคุยเสียงกับคนอื่น</span>}
    </div>
  )
}
