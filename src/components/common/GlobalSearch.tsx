import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Loader2 } from 'lucide-react'
import { spGet } from '../../services/sharepoint'

interface Hit {
  type: string        // ป้ายหมวด
  icon: string
  title: string
  subtitle?: string
  link: string
}

const MIN = 2
const DEBOUNCE = 350

export function GlobalSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const reqId = useRef(0)

  useEffect(() => {
    function onClick(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    const term = q.trim().replace(/'/g, '')   // กัน single quote ทำ filter พัง
    if (term.length < MIN) { setHits([]); setLoading(false); return }
    setLoading(true)
    const myId = ++reqId.current
    const t = setTimeout(async () => {
      const sub = (f: string) => `substringof('${term}',${f})`
      const results: Hit[] = []
      try {
        const [tk, pj, ts, inc, as, nt] = await Promise.all([
          spGet<any>('HD_Tickets', `${sub('Title')} or ${sub('TicketNumber')}`, 'Id,Title,TicketNumber,Status', undefined, 8).catch(() => []),
          spGet<any>('PM_Projects', sub('Title'), 'Id,Title,Status', undefined, 8).catch(() => []),
          spGet<any>('PM_Tasks', sub('Title'), 'Id,Title,ProjectID', undefined, 8).catch(() => []),
          spGet<any>('PM_Incidents', sub('Title'), 'Id,Title,ProjectID,Severity', undefined, 8).catch(() => []),
          spGet<any>('IT_Assets', `${sub('Title')} or ${sub('AssetCode')}`, 'Id,Title,AssetCode,Category', undefined, 8).catch(() => []),
          spGet<any>('IT_Tools', sub('Title'), 'Id,Title,Category', undefined, 8).catch(() => []),
        ])
        if (myId !== reqId.current) return  // มี request ใหม่กว่าแล้ว ทิ้งผลเก่า
        for (const t of tk) results.push({ type: 'Ticket', icon: '🎫', title: t.Title, subtitle: t.TicketNumber || `Ticket #${t.id}`, link: `/tickets/${t.id}` })
        for (const p of pj) results.push({ type: 'Project', icon: '📁', title: p.Title, subtitle: p.Status, link: `/projects/${p.id}` })
        for (const k of ts) results.push({ type: 'Task', icon: '✅', title: k.Title, subtitle: 'ในโครงการ', link: `/projects/${k.ProjectID}` })
        for (const i of inc) results.push({ type: 'Incident', icon: '🚨', title: i.Title, subtitle: i.Severity, link: `/projects/${i.ProjectID}` })
        for (const a of as) results.push({ type: 'Asset', icon: '🖥️', title: a.Title, subtitle: a.AssetCode || a.Category, link: `/assets` })
        for (const n of nt) results.push({ type: 'Note', icon: '📝', title: n.Title, subtitle: n.Category || 'Tools & Notes', link: `/tools?note=${n.id}` })
        setHits(results)
      } finally {
        if (myId === reqId.current) setLoading(false)
      }
    }, DEBOUNCE)
    return () => clearTimeout(t)
  }, [q])

  function go(h: Hit) { setOpen(false); setQ(''); setHits([]); navigate(h.link) }

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3.5 py-2.5 shadow-sm focus-within:border-primary-400 transition-colors">
        <Search size={18} className="text-gray-400 flex-shrink-0" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="ค้นหาทุกอย่าง — Ticket, โครงการ, Task, Incident, Asset, Note..."
          className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 dark:text-gray-100"
        />
        {loading && <Loader2 size={16} className="text-gray-400 animate-spin flex-shrink-0" />}
        {q && !loading && (
          <button onClick={() => { setQ(''); setHits([]) }} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={16} /></button>
        )}
      </div>

      {open && q.trim().length >= MIN && (
        <div className="absolute z-40 left-0 right-0 mt-2 max-h-[28rem] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl">
          {!loading && hits.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">ไม่พบผลลัพธ์สำหรับ "{q}"</p>
          )}
          {hits.map((h, i) => (
            <button key={i} onClick={() => go(h)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 border-b border-gray-50 dark:border-gray-800/60 last:border-0">
              <span className="text-lg flex-shrink-0">{h.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{h.title}</span>
                <span className="block text-xs text-gray-400 truncate">{h.subtitle}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1.5 py-0.5 flex-shrink-0">{h.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
