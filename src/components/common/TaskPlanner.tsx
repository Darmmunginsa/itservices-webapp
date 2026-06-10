import { useEffect, useRef, useState } from 'react'
import { ListChecks, Plus, Trash2, ChevronDown } from 'lucide-react'
import { spGet, spCreate, spUpdate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { useT } from '../../i18n/useT'

interface PlanItem { id: number; Title: string; IsDone: boolean }

export function TaskPlanner() {
  const { user } = useAppStore()
  const tr = useT()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PlanItem[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const loadedRef = useRef(false)

  // โหลดครั้งแรกเมื่อเปิด drawer (ประหยัด query)
  useEffect(() => {
    if (!open || loadedRef.current || !user?.email) return
    loadedRef.current = true
    setLoading(true)
    spGet<PlanItem>('HD_Planner', `OwnerEmail eq '${user.email}'`, 'Id,Title,IsDone', 'Created asc', 200)
      .then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [open, user?.email])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !user) return
    setAdding(true)
    try {
      const res = await spCreate('HD_Planner', { Title: text.trim(), IsDone: false, OwnerEmail: user.email })
      setItems(prev => [...prev, { id: res.id, Title: text.trim(), IsDone: false }])
      setText('')
    } catch { /* ignore */ } finally { setAdding(false) }
  }

  async function toggle(it: PlanItem) {
    const next = !it.IsDone
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, IsDone: next } : x))
    try { await spUpdate('HD_Planner', it.id, { IsDone: next }) }
    catch { setItems(prev => prev.map(x => x.id === it.id ? { ...x, IsDone: it.IsDone } : x)) }
  }

  async function remove(id: number) {
    setItems(prev => prev.filter(x => x.id !== id))
    try { await spDelete('HD_Planner', id) } catch { /* ignore */ }
  }

  const pending = items.filter(i => !i.IsDone).length

  return (
    <>
      {/* ปุ่มเปิด — มุมล่างซ้าย (เลี่ยงชน calendar/manage ที่อยู่ขวา) */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-32 left-3 md:bottom-[4.75rem] md:left-4 z-40 flex items-center gap-2 bg-gray-800 dark:bg-gray-700 text-white rounded-full px-3.5 py-2 shadow-lg hover:bg-gray-900 transition-colors text-sm font-medium">
          <ListChecks size={15} /> Task Planner{pending > 0 && <span className="bg-primary-500 text-white text-[10px] rounded-full px-1.5 min-w-[16px] text-center">{pending}</span>}
        </button>
      )}

      {/* Drawer (ลิ้นชักด้านล่าง) */}
      {open && <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 rounded-t-2xl shadow-2xl transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2"><ListChecks size={16} className="text-primary-600" /> {tr('planner.title')}</h3>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><ChevronDown size={18} /></button>
          </div>

          <form onSubmit={add} className="flex gap-2 mb-3">
            <input value={text} onChange={e => setText(e.target.value)} placeholder={tr('planner.placeholder')}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <button type="submit" disabled={adding || !text.trim()}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"><Plus size={15} /></button>
          </form>

          <div className="max-h-[40vh] overflow-y-auto space-y-1">
            {loading ? <p className="text-xs text-gray-400 py-4 text-center">{tr('comp.loading')}</p>
              : items.length === 0 ? <p className="text-xs text-gray-400 py-6 text-center">{tr('planner.empty')}</p>
              : items.map(it => (
                <div key={it.id} className="flex items-center gap-2 group px-1 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <input type="checkbox" checked={it.IsDone} onChange={() => toggle(it)} className="w-4 h-4 accent-primary-600 flex-shrink-0" />
                  <span className={`flex-1 text-sm ${it.IsDone ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>{it.Title}</span>
                  <button onClick={() => remove(it.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 flex-shrink-0"><Trash2 size={14} /></button>
                </div>
              ))
            }
          </div>
          <p className="text-[10px] text-gray-400 mt-2">{tr('planner.footerPre')} {pending} {tr('planner.footerPost')}</p>
        </div>
      </div>
    </>
  )
}
