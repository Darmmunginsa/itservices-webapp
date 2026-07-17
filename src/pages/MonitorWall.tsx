import { useEffect, useMemo, useRef, useState } from 'react'
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Activity, ExternalLink, GripVertical, Maximize2, Plus, RefreshCw, Trash2, WifiOff, ZoomIn, ZoomOut } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { spGet, spCreate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n/useT'

const Grid = WidthProvider(GridLayout)

// จอ Monitor Wall — embed Grafana / Uptime Kuma ฯลฯ ผ่าน iframe
// รายการ tile เก็บใน HD_Options: Category='MonitorWall', Title='ชื่อ|URL' (SortOrder เรียงลำดับ)
// layout (ตำแหน่ง/ขนาด/zoom) จำต่อเครื่องใน localStorage — ลากหัว tile เพื่อย้าย, ลากมุมขวาล่างเพื่อปรับขนาด
interface TileRow { id: number; Title: string; Category: string; SortOrder?: number }
interface Tile { id: number; name: string; url: string }

const LAYOUT_KEY = 'monitorWallLayout'
const ZOOM_KEY = 'monitorWallZoom'

function parseTile(row: TileRow): Tile | null {
  const [name, ...rest] = row.Title.split('|')
  const url = rest.join('|').trim()
  if (!name?.trim() || !/^https?:\/\//.test(url)) return null
  return { id: row.id, name: name.trim(), url }
}

function loadJson<T>(key: string, fallback: T): T {
  try { const v = JSON.parse(localStorage.getItem(key) || ''); return v ?? fallback } catch { return fallback }
}

export default function MonitorWall() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const isAdmin = ['Admin', 'Boss'].includes(user?.role ?? '')

  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState<Record<number, number>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '' })
  const [saving, setSaving] = useState(false)
  const [layout, setLayout] = useState<Layout[]>(() => loadJson<Layout[]>(LAYOUT_KEY, []))
  const [zoom, setZoom] = useState<Record<string, number>>(() => loadJson<Record<string, number>>(ZOOM_KEY, {}))
  // ระหว่างลาก/ปรับขนาด ต้องปิด pointer-events ของ iframe ไม่งั้น iframe กลืนเมาส์แล้วลากค้าง
  const [dragging, setDragging] = useState(false)
  const wrapRefs = useRef<Record<number, HTMLDivElement | null>>({})

  function load() {
    spGet<TileRow>('HD_Options', "Category eq 'MonitorWall'", 'Id,Title,Category,SortOrder', 'SortOrder asc', 100)
      .then(rows => setTiles(rows.map(parseTile).filter(Boolean) as Tile[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // layout สมบูรณ์ = ของที่จำไว้ + ค่า default สำหรับ tile ใหม่ (วางเรียง 2 ต่อแถว)
  const fullLayout = useMemo<Layout[]>(() => {
    return tiles.map((t, i) => {
      const saved = layout.find(l => l.i === String(t.id))
      return saved ?? { i: String(t.id), x: (i % 2) * 6, y: Math.floor(i / 2) * 5, w: 6, h: 5, minW: 3, minH: 3 }
    })
  }, [tiles, layout])

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

  async function addTile(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim(), url = form.url.trim()
    if (!name || !/^https?:\/\//.test(url)) { addToast('error', tr('mon.badUrl')); return }
    // หน้า SharePoint/M365 ต้อง login Microsoft ซึ่งทำใน iframe ไม่ได้ → จะวน redirect จนแอปช้า
    if (/sharepoint\.com|microsoftonline\.com|office\.com/i.test(url)) { addToast('error', tr('mon.msUrl')); return }
    setSaving(true)
    try {
      await spCreate('HD_Options', { Title: `${name}|${url}`, Category: 'MonitorWall', SortOrder: tiles.length + 1 })
      setForm({ name: '', url: '' }); setShowAdd(false)
      load()
      addToast('success', `เพิ่ม ${name} แล้ว`)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  async function removeTile(t: Tile) {
    if (!window.confirm(`ลบ "${t.name}" ออกจาก Monitor Wall?`)) return
    try {
      await spDelete('HD_Options', t.id)
      setTiles(prev => prev.filter(x => x.id !== t.id))
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  function fullscreen(id: number) {
    wrapRefs.current[id]?.requestFullscreen?.().catch(() => {})
  }

  const inputCx = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div>
      <Header title="Monitor Wall" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <WifiOff size={13} /> {tr('mon.vpnHint')}
          </p>
          <p className="text-xs text-gray-400 hidden md:block">· {tr('mon.dragHint')}</p>
          {isAdmin && (
            <Button size="sm" className="ml-auto" onClick={() => setShowAdd(s => !s)}>
              <Plus size={14} /> {tr('mon.addTile')}
            </Button>
          )}
        </div>

        {/* Add form (Admin) */}
        {showAdd && isAdmin && (
          <Card>
            <form onSubmit={addTile} className="flex flex-col md:flex-row gap-2">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={tr('mon.tileName')} className={`${inputCx} md:w-56`} required />
              <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://grafana.local/d/xxx?kiosk" className={`${inputCx} flex-1`} required />
              <Button type="submit" size="sm" disabled={saving}>{saving ? '...' : tr('common.save')}</Button>
            </form>
            <p className="text-[11px] text-gray-400 mt-2">{tr('mon.grafanaTip')}</p>
          </Card>
        )}

        {/* Tiles — drag/resize grid */}
        {loading ? (
          <p className="text-sm text-gray-400">{tr('comp.loading')}</p>
        ) : tiles.length === 0 ? (
          <Card className="text-center py-12">
            <Activity size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">{tr('mon.empty')}</p>
            {isAdmin && <p className="text-xs text-gray-400 mt-1">{tr('mon.emptyHint')}</p>}
          </Card>
        ) : (
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
                  {/* Tile header = drag handle */}
                  <div className="mon-drag cursor-move flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800 select-none">
                    <GripVertical size={13} className="text-gray-300 flex-shrink-0" />
                    <Activity size={13} className="text-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate flex-1">{t.name}</span>
                    <span className="text-[10px] text-gray-400 w-9 text-center tabular-nums">{Math.round(z * 100)}%</span>
                    <button onClick={() => setTileZoom(t.id, -0.15)} onMouseDown={e => e.stopPropagation()}
                      title={tr('mon.zoomOut')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
                      <ZoomOut size={13} />
                    </button>
                    <button onClick={() => setTileZoom(t.id, 0.15)} onMouseDown={e => e.stopPropagation()}
                      title={tr('mon.zoomIn')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
                      <ZoomIn size={13} />
                    </button>
                    <button onClick={() => setReloadKey(k => ({ ...k, [t.id]: (k[t.id] ?? 0) + 1 }))} onMouseDown={e => e.stopPropagation()}
                      title={tr('mon.refresh')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
                      <RefreshCw size={13} />
                    </button>
                    <button onClick={() => fullscreen(t.id)} onMouseDown={e => e.stopPropagation()}
                      title={tr('mon.fullscreen')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
                      <Maximize2 size={13} />
                    </button>
                    <a href={t.url} target="_blank" rel="noopener noreferrer" onMouseDown={e => e.stopPropagation()}
                      title={tr('mon.openTab')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
                      <ExternalLink size={13} />
                    </a>
                    {isAdmin && (
                      <button onClick={() => removeTile(t)} onMouseDown={e => e.stopPropagation()}
                        title={tr('assets.delete')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-300 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  {/* iframe + zoom (scale แล้วขยาย canvas ชดเชย เพื่อให้เต็มพื้นที่ tile) */}
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
        )}
      </div>
    </div>
  )
}
