import { useMemo, useRef, useState } from 'react'
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Edit2, ExternalLink, GripVertical, Maximize2, Monitor, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react'
import { useT } from '../../i18n/useT'

// จอ Monitor ประจำโปรเจกต์ — ลากหัว tile ย้าย, ลากมุมขวาล่างปรับขนาด, zoom ต่อ tile
// layout/zoom จำต่อเครื่องใน localStorage แยกตามโปรเจกต์
export interface MonitorTile { id: number; name: string; url: string }

interface Props {
  projectId: number
  tiles: MonitorTile[]
  onEdit: (id: number) => void
}

const Grid = WidthProvider(GridLayout)

function loadJson<T>(key: string, fallback: T): T {
  try { const v = JSON.parse(localStorage.getItem(key) || ''); return v ?? fallback } catch { return fallback }
}

export default function ProjectMonitor({ projectId, tiles, onEdit }: Props) {
  const tr = useT()
  const LAYOUT_KEY = `projMonLayout:${projectId}`
  const ZOOM_KEY = `projMonZoom:${projectId}`

  const [layout, setLayout] = useState<Layout[]>(() => loadJson<Layout[]>(LAYOUT_KEY, []))
  const [zoom, setZoom] = useState<Record<string, number>>(() => loadJson<Record<string, number>>(ZOOM_KEY, {}))
  const [reloadKey, setReloadKey] = useState<Record<number, number>>({})
  // ระหว่างลาก/ปรับขนาด ปิด pointer-events ของ iframe — กัน iframe กลืนเมาส์แล้วลากค้าง
  const [dragging, setDragging] = useState(false)
  const wrapRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const fullLayout = useMemo<Layout[]>(() => tiles.map((t, i) => {
    const saved = layout.find(l => l.i === String(t.id))
    return saved ?? { i: String(t.id), x: (i % 2) * 6, y: Math.floor(i / 2) * 5, w: 6, h: 5, minW: 3, minH: 3 }
  }), [tiles, layout])

  function onLayoutChange(next: Layout[]) {
    setLayout(next)
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function setTileZoom(id: number, delta: number) {
    setZoom(prev => {
      const cur = prev[String(id)] ?? 1
      const next = Math.min(2, Math.max(0.4, Math.round((cur + delta) * 100) / 100))
      const out = { ...prev, [String(id)]: next }
      try { localStorage.setItem(ZOOM_KEY, JSON.stringify(out)) } catch { /* ignore */ }
      return out
    })
  }

  return (
    <Grid
      layout={fullLayout}
      cols={12}
      rowHeight={90}
      margin={[12, 12]}
      draggableHandle=".mon-drag"
      onLayoutChange={onLayoutChange}
      onDragStart={() => setDragging(true)}
      onDragStop={() => setDragging(false)}
      onResizeStart={() => setDragging(true)}
      onResizeStop={() => setDragging(false)}
    >
      {tiles.map(t => {
        const z = zoom[String(t.id)] ?? 1
        return (
          <div key={String(t.id)} ref={el => { wrapRefs.current[t.id] = el }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col shadow-sm">
            {/* Header = drag handle */}
            <div className="mon-drag cursor-move flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800 select-none">
              <GripVertical size={13} className="text-gray-300 flex-shrink-0" />
              <Monitor size={13} className="text-emerald-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate flex-1">{t.name}</span>
              <span className="text-[10px] text-gray-400 w-9 text-center tabular-nums">{Math.round(z * 100)}%</span>
              <button onClick={() => setTileZoom(t.id, -0.15)} onMouseDown={e => e.stopPropagation()}
                title={tr('mon.zoomOut')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600"><ZoomOut size={13} /></button>
              <button onClick={() => setTileZoom(t.id, 0.15)} onMouseDown={e => e.stopPropagation()}
                title={tr('mon.zoomIn')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600"><ZoomIn size={13} /></button>
              <button onClick={() => setReloadKey(k => ({ ...k, [t.id]: (k[t.id] ?? 0) + 1 }))} onMouseDown={e => e.stopPropagation()}
                title={tr('mon.refresh')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600"><RefreshCw size={13} /></button>
              <button onClick={() => wrapRefs.current[t.id]?.requestFullscreen?.().catch(() => {})} onMouseDown={e => e.stopPropagation()}
                title={tr('mon.fullscreen')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600"><Maximize2 size={13} /></button>
              <a href={t.url} target="_blank" rel="noopener noreferrer" onMouseDown={e => e.stopPropagation()}
                title={tr('mon.openTab')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600"><ExternalLink size={13} /></a>
              <button onClick={() => onEdit(t.id)} onMouseDown={e => e.stopPropagation()}
                title={tr('common.edit')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600"><Edit2 size={13} /></button>
            </div>
            {/* iframe + zoom */}
            <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-950">
              <iframe key={reloadKey[t.id] ?? 0} src={t.url} title={t.name} loading="lazy"
                style={{
                  width: `${100 / z}%`, height: `${100 / z}%`,
                  transform: `scale(${z})`, transformOrigin: 'top left',
                  pointerEvents: dragging ? 'none' : 'auto', border: 0,
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
            </div>
          </div>
        )
      })}
    </Grid>
  )
}
