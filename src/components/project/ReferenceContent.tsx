import { useState } from 'react'
import { Play, ExternalLink, Quote } from 'lucide-react'
import { parseMediaLinks, youtubeThumb } from '../../utils/youtube'

const CLAMP_CHARS = 320   // ยาวกว่านี้ค่อยพับ — สั้น ๆ พับแล้วกวนกว่าเดิม

/**
 * เนื้อหาของแหล่งอ้างอิงที่แสดงบนการ์ดเลย ไม่ต้องกดเปิด
 * — สรุปสาระ (ยาวมากค่อยพับ)
 * — คลิป/ลิงก์ ใส่ได้ไม่จำกัด ยูทูบเล่นในหน้าได้เลย
 * ใช้ร่วมกันทั้งหน้าคลังและแท็บอ้างอิงในโครงการ ให้เห็นเหมือนกันทั้งสองที่
 */
export function ReferenceContent({ summary, media, compact }: {
  summary?: string
  media?: string
  compact?: boolean       // ในโครงการพื้นที่แคบกว่า → กริดคลิปแคบลง
}) {
  const [expanded, setExpanded] = useState(false)
  // เก็บเฉพาะคลิปที่ผู้ใช้กดเล่น — ฝัง iframe ทุกอันตั้งแต่แรกจะหน่วงทั้งหน้า
  const [playing, setPlaying] = useState<Set<string>>(new Set())

  const links = parseMediaLinks(media)
  const text = (summary ?? '').trim()
  const long = text.length > CLAMP_CHARS
  const shown = long && !expanded ? text.slice(0, CLAMP_CHARS).trimEnd() + '…' : text

  if (!text && links.length === 0) return null

  const play = (url: string) => setPlaying(prev => new Set(prev).add(url))

  return (
    <div className="mt-2 space-y-2">
      {text && (
        <div className="flex gap-2">
          <Quote size={12} className="text-gray-300 dark:text-gray-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed flex-1 min-w-0">
            {shown}
            {long && (
              <button onClick={() => setExpanded(e => !e)}
                className="ml-1 text-primary-600 hover:underline font-medium whitespace-nowrap">
                {expanded ? 'ย่อ' : 'อ่านเพิ่ม'}
              </button>
            )}
          </p>
        </div>
      )}

      {links.length > 0 && (
        <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {links.map(l => {
            // ไม่ใช่ยูทูบ → ไม่ฝัง เปิดแท็บใหม่แทน (เว็บส่วนใหญ่บล็อกการฝังอยู่แล้ว)
            if (!l.youtubeId) {
              return (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 text-xs text-primary-600 transition-colors">
                  <ExternalLink size={12} className="flex-shrink-0" />
                  <span className="truncate">{l.label}</span>
                </a>
              )
            }
            if (playing.has(l.url)) {
              return (
                <div key={l.url} className="space-y-1">
                  <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${l.youtubeId}?autoplay=1`}
                      title={l.label}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full border-0"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 truncate" title={l.label}>{l.label}</p>
                </div>
              )
            }
            return (
              <div key={l.url} className="space-y-1">
                <button onClick={() => play(l.url)} title={`เล่น: ${l.label}`}
                  className="group relative block w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800"
                  style={{ paddingTop: '56.25%' }}>
                  <img src={youtubeThumb(l.youtubeId)} alt=""
                    loading="lazy"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                    className="absolute inset-0 w-full h-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition-colors">
                    <span className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <Play size={16} className="text-red-600 ml-0.5" fill="currentColor" />
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <p className="text-[11px] text-gray-500 truncate flex-1" title={l.label}>{l.label}</p>
                  <a href={l.url} target="_blank" rel="noopener noreferrer" title="เปิดใน YouTube"
                    className="text-gray-400 hover:text-primary-600 flex-shrink-0">
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
