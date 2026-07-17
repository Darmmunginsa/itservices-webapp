import { useEffect, useRef, useState } from 'react'
import { Activity, ExternalLink, Maximize2, Plus, RefreshCw, Trash2, WifiOff } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { Button } from '../components/common/Button'
import { spGet, spCreate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n/useT'

// จอ Monitor Wall — embed Grafana / Uptime Kuma ฯลฯ ผ่าน iframe
// รายการ tile เก็บใน HD_Options: Category='MonitorWall', Title='ชื่อ|URL' (SortOrder เรียงลำดับ)
// หมายเหตุ: iframe โหลดจากเครื่องคนดู — dashboard หลัง VPN ต้องต่อ VPN ถึงจะเห็น
interface TileRow { id: number; Title: string; Category: string; SortOrder?: number }
interface Tile { id: number; name: string; url: string }

function parseTile(row: TileRow): Tile | null {
  const [name, ...rest] = row.Title.split('|')
  const url = rest.join('|').trim()
  if (!name?.trim() || !/^https?:\/\//.test(url)) return null
  return { id: row.id, name: name.trim(), url }
}

export default function MonitorWall() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const isAdmin = ['Admin', 'Boss'].includes(user?.role ?? '')

  const [tiles, setTiles] = useState<Tile[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState<Record<number, number>>({})  // bump = force iframe reload
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', url: '' })
  const [saving, setSaving] = useState(false)
  const wrapRefs = useRef<Record<number, HTMLDivElement | null>>({})

  function load() {
    spGet<TileRow>('HD_Options', "Category eq 'MonitorWall'", 'Id,Title,Category,SortOrder', 'SortOrder asc', 100)
      .then(rows => setTiles(rows.map(parseTile).filter(Boolean) as Tile[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function addTile(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim(), url = form.url.trim()
    if (!name || !/^https?:\/\//.test(url)) { addToast('error', tr('mon.badUrl')); return }
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

        {/* Tiles */}
        {loading ? (
          <p className="text-sm text-gray-400">{tr('comp.loading')}</p>
        ) : tiles.length === 0 ? (
          <Card className="text-center py-12">
            <Activity size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">{tr('mon.empty')}</p>
            {isAdmin && <p className="text-xs text-gray-400 mt-1">{tr('mon.emptyHint')}</p>}
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {tiles.map(t => (
              <div key={t.id} ref={el => { wrapRefs.current[t.id] = el }}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
                {/* Tile header */}
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                  <Activity size={13} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate flex-1">{t.name}</span>
                  <button onClick={() => setReloadKey(k => ({ ...k, [t.id]: (k[t.id] ?? 0) + 1 }))}
                    title={tr('mon.refresh')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={() => fullscreen(t.id)}
                    title={tr('mon.fullscreen')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
                    <Maximize2 size={13} />
                  </button>
                  <a href={t.url} target="_blank" rel="noopener noreferrer"
                    title={tr('mon.openTab')} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600">
                    <ExternalLink size={13} />
                  </a>
                  {isAdmin && (
                    <button onClick={() => removeTile(t)} title={tr('assets.delete')}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-300 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                {/* iframe — ถ้าปลายทางห้าม embed (X-Frame-Options) จะขึ้นว่างเปล่า → ใช้ปุ่มเปิดแท็บใหม่แทน */}
                <iframe key={reloadKey[t.id] ?? 0} src={t.url} title={t.name}
                  className="w-full flex-1 min-h-[420px] bg-gray-50 dark:bg-gray-950"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
