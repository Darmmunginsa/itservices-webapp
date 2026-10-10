import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapIcon, Save, RotateCcw, Undo2, AlertTriangle, Info, Eraser, Trash2 } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { useAppStore } from '../../store/useAppStore'
import { getOfficeMapRows, saveOfficeMap, resetOfficeMap, getOfficeProps, saveOfficeProps, resetOfficeProps } from '../../services/office'
import { DEFAULT_MAP, TILE_PALETTE, PLANT_TILES, isFurnitureTile, setTile, resizeMap, blankMap, validateMap, parseMap, spawnPoint, type MapIssue } from '../../utils/officeMap'
import { PROPS, propDef, propBlocked, canPlaceProp, propAt, parseProps, serializeProp, DEFAULT_PROPS, type Prop } from '../../utils/officeProps'
import { OfficeTile, OfficeDefs } from '../team/OfficeTile'
import { PlantArt } from '../team/PlantArt'
import { PropSprite } from '../team/PropArt'

// ── Admin: ตัวแก้ผังออฟฟิศ 2D ──
// ระบายพื้น/ห้อง/ต้นไม้ทีละช่อง + วางสิ่งของชิ้นใหญ่ (น้ำตก ศาลา โต๊ะปิงปอง ...) ที่กินหลายช่อง
// บันทึกเป็นแถวใน HD_Options (OfficeMap = ผัง · OfficeMapProps = สิ่งของ) ทีมเห็นในการโหลดหน้าครั้งถัดไป

const TILE = 24

type Tab = 'พื้นและห้อง' | 'ต้นไม้' | 'สวน' | 'สันทนาการ' | 'ครัว/คาเฟ่' | 'สำนักงาน'
const TABS: { key: Tab; icon: string }[] = [
  { key: 'พื้นและห้อง', icon: '🧱' }, { key: 'ต้นไม้', icon: '🌳' }, { key: 'สวน', icon: '🌷' },
  { key: 'สันทนาการ', icon: '🏓' }, { key: 'ครัว/คาเฟ่', icon: '☕' }, { key: 'สำนักงาน', icon: '🖨️' },
]
const tileTab = (ch: string): Tab => (PLANT_TILES.includes(ch) ? 'ต้นไม้' : TILE_PALETTE.find(t => t.ch === ch)?.group === 'สวน' ? 'สวน' : 'พื้นและห้อง')

type Tool = { type: 'tile'; ch: string } | { type: 'prop'; kind: string } | { type: 'erase' }

// ตัวอย่างในจานสี — ช่องนั้นกลางผัง 3×3: เฟอร์นิเจอร์อยู่บนพื้นไม้ · กำแพงมีพื้นข้างล่าง · พื้นโชว์ลายเต็ม
const PALETTE_ROWS: Record<string, string[]> = Object.fromEntries(
  TILE_PALETTE.map(t => [t.ch,
    t.ch === '#' ? ['###', '###', '...']
      : t.ch === 'h' ? ['ggg', 'ghg', 'ggg']
        : isFurnitureTile(t.ch) ? ['...', `.${t.ch}.`, '...']
          : [t.ch.repeat(3), t.ch.repeat(3), t.ch.repeat(3)]]),
)

interface Snap { rows: string[]; props: Prop[] }

export function OfficeMapEditor() {
  const { addToast } = useAppStore()
  const [rows, setRows] = useState<string[]>(DEFAULT_MAP)
  const [props, setProps] = useState<Prop[]>(DEFAULT_PROPS)
  const [saved, setSaved] = useState<Snap>({ rows: DEFAULT_MAP, props: DEFAULT_PROPS })
  const [tab, setTab] = useState<Tab>('พื้นและห้อง')
  const [tool, setTool] = useState<Tool>({ type: 'tile', ch: '#' })
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<Snap[]>([])
  const painting = useRef(false)
  const strokeStart = useRef<Snap | null>(null)

  useEffect(() => {
    getOfficeMapRows()
      .then(r => getOfficeProps(r).then(p => { setRows(r); setProps(p); setSaved({ rows: r, props: p }) }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const blocked = useMemo(() => propBlocked(props), [props])
  // ของที่วางไม่ถูกที่อีกแล้ว (ระบายกำแพงทับ / ย่อผังจนล้น) — ต้องแก้ก่อนบันทึก
  const badProps = useMemo(() => props.filter((p, i) => !canPlaceProp(rows, props.filter((_, j) => j !== i), p.kind, p).ok), [rows, props])
  const issues: MapIssue[] = useMemo(() => {
    const out = validateMap(rows, blocked)
    if (badProps.length) out.unshift({ level: 'error', text: `มีสิ่งของ ${badProps.length} ชิ้นทับกำแพงหรือล้นขอบ (กรอบแดง) — ลบหรือย้ายก่อนบันทึก` })
    return out
  }, [rows, blocked, badProps])
  const hasError = issues.some(i => i.level === 'error')
  const dirty = rows.join('\n') !== saved.rows.join('\n') || props.map(serializeProp).join('|') !== saved.props.map(serializeProp).join('|')
  const map = useMemo(() => parseMap(rows), [rows])
  const spawn = useMemo(() => (hasError ? null : spawnPoint(map, 0)), [map, hasError])
  const w = rows[0]?.length ?? 0, h = rows.length

  const snap = (): Snap => ({ rows, props })
  const remember = (s: Snap) => setHistory(hist => [...hist.slice(-39), s])

  // ระบายพื้น: ลาก 1 ครั้ง = undo 1 ครั้ง · วาง/ลบสิ่งของ: คลิกละ 1 ครั้ง
  function down(x: number, y: number) {
    if (tool.type === 'tile') {
      painting.current = true
      strokeStart.current = snap()
      setRows(r => setTile(r, x, y, tool.ch))
      return
    }
    if (tool.type === 'prop') {
      const c = canPlaceProp(rows, props, tool.kind, { x, y })
      if (!c.ok) { addToast('error', c.reason); return }
      remember(snap())
      setProps(ps => [...ps, { kind: tool.kind, x, y }])
      return
    }
    const hit = propAt(props, { x, y })
    if (!hit) return
    remember(snap())
    setProps(ps => ps.filter(p => p !== hit))
  }
  function enter(x: number, y: number) {
    setHover({ x, y })
    if (painting.current && tool.type === 'tile') setRows(r => setTile(r, x, y, tool.ch))
  }
  function endStroke() {
    if (!painting.current) return
    painting.current = false
    const before = strokeStart.current
    strokeStart.current = null
    if (before && before.rows.join('\n') !== rows.join('\n')) remember(before)
  }
  useEffect(() => {
    const up = () => endStroke()
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  })

  function undo() {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory(hist => hist.slice(0, -1))
    setRows(prev.rows); setProps(prev.props)
  }
  function resize(nw: number, nh: number) {
    remember(snap())
    const next = resizeMap(rows, nw, nh)
    setRows(next)
    setProps(ps => parseProps(ps.map(serializeProp), next))   // ทิ้งชิ้นที่ล้นผังใหม่
  }

  async function save() {
    if (hasError) return
    setSaving(true)
    try {
      await saveOfficeMap(rows)
      await saveOfficeProps(props)
      setSaved({ rows, props })
      addToast('success', 'บันทึกผังออฟฟิศแล้ว — ทีมเห็นผังใหม่เมื่อเปิดหน้าสถานะทีมครั้งถัดไป')
    } catch (e) { addToast('error', `บันทึกไม่สำเร็จ: ${(e as Error).message}`) }
    finally { setSaving(false) }
  }
  async function reset() {
    if (!window.confirm('กลับไปใช้ผังมาตรฐานของระบบ (รวมสวนและสิ่งของ)? ผังที่แก้ไว้จะถูกลบ')) return
    setSaving(true)
    try {
      await resetOfficeMap(); await resetOfficeProps()
      setRows(DEFAULT_MAP); setProps(DEFAULT_PROPS); setSaved({ rows: DEFAULT_MAP, props: DEFAULT_PROPS }); setHistory([])
      addToast('success', 'กลับไปใช้ผังมาตรฐานแล้ว')
    } catch (e) { addToast('error', `ไม่สำเร็จ: ${(e as Error).message}`) }
    finally { setSaving(false) }
  }

  const btn = 'text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 disabled:opacity-40'
  const chip = (on: boolean) => `flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg border text-xs ${on ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`
  const tabTiles = TILE_PALETTE.filter(t => tileTab(t.ch) === tab)
  const tabProps = PROPS.filter(p => p.group === tab)
  const ghost = tool.type === 'prop' && hover ? { d: propDef(tool.kind)!, ok: canPlaceProp(rows, props, tool.kind, hover).ok } : null
  const eraseHit = tool.type === 'erase' && hover ? propAt(props, hover) : undefined

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <MapIcon size={18} className="text-primary-600" />
        <h2 className="text-sm font-semibold">ผังออฟฟิศ 2D (หน้าสถานะทีม)</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={undo} disabled={!history.length} className={btn} title="ย้อนกลับ"><span className="inline-flex items-center gap-1"><Undo2 size={12} /> ย้อน</span></button>
          <button onClick={reset} disabled={saving} className={btn} title="ลบผังที่แก้ไว้ กลับไปใช้ของระบบ"><span className="inline-flex items-center gap-1"><RotateCcw size={12} /> ผังมาตรฐาน</span></button>
          <Button size="sm" onClick={save} disabled={saving || hasError || !dirty}>
            <Save size={14} /> {saving ? 'กำลังบันทึก…' : dirty ? 'บันทึกผัง' : 'บันทึกแล้ว'}
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        เลือกหมวด → เลือกของ → <b>คลิก/ลาก</b>บนผัง · ของชิ้นใหญ่วางที่มุมซ้ายบน (เงาเขียว = วางได้ · แดง = วางไม่ได้) · 🧽 ยางลบ = ลบของชิ้นใหญ่
      </p>

      {/* หมวด */}
      <OfficeDefs />
      <div className="flex flex-wrap gap-1 mb-2">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full border ${tab === t.key ? 'bg-primary-600 border-primary-600 text-white font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400'}`}>
            {t.icon} {t.key}
          </button>
        ))}
        <button onClick={() => setTool({ type: 'erase' })} title="คลิกที่ของชิ้นใหญ่เพื่อลบ"
          className={`ml-auto text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1 ${tool.type === 'erase' ? 'bg-red-600 border-red-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-red-400'}`}>
          <Trash2 size={12} /> ยางลบสิ่งของ
        </button>
      </div>

      {/* จานสีของหมวดนี้ */}
      <div className="flex flex-wrap gap-1.5 mb-3 p-2 rounded-xl bg-gray-50 dark:bg-gray-800/40 min-h-[48px]">
        {tabTiles.map(t => (
          <button key={t.ch} onClick={() => setTool({ type: 'tile', ch: t.ch })} title={t.hint} className={chip(tool.type === 'tile' && tool.ch === t.ch)}>
            {PLANT_TILES.includes(t.ch) ? (
              <svg width="22" height="34" viewBox="0 -34 36 70" aria-hidden="true" className="rounded bg-amber-50"><PlantArt ch={t.ch} /></svg>
            ) : (
              <span className="inline-flex rounded overflow-hidden"><OfficeTile rows={PALETTE_ROWS[t.ch]} x={1} y={1} size={22} /></span>
            )}
            {t.label}
            <span className="font-mono text-[10px] text-gray-400">{t.ch}</span>
          </button>
        ))}
        {tabProps.map(p => {
          const sz = Math.min(44 / p.w, 30 / p.h)
          return (
            <button key={p.kind} onClick={() => setTool({ type: 'prop', kind: p.kind })} title={p.hint} className={chip(tool.type === 'prop' && tool.kind === p.kind)}>
              <span className="inline-flex items-center justify-center rounded bg-emerald-50 dark:bg-emerald-900/20" style={{ width: 48, height: 34 }}>
                <PropSprite kind={p.kind} size={sz} />
              </span>
              <span className="text-left leading-tight">{p.label}<br /><span className="text-[10px] text-gray-400">{p.w}×{p.h} ช่อง</span></span>
            </button>
          )
        })}
      </div>

      {/* ขนาด */}
      <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
        <span className="text-gray-500">ขนาด</span>
        <input type="number" min={8} max={60} value={w} onChange={e => resize(Number(e.target.value), h)} className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
        <span className="text-gray-400">×</span>
        <input type="number" min={8} max={60} value={h} onChange={e => resize(w, Number(e.target.value))} className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900" />
        <span className="text-gray-400">ช่อง (8–60) · ช่องใหม่เป็นพื้นโต๊ะทำงาน · ของ {props.length} ชิ้น</span>
        <button onClick={() => { remember(snap()); setRows(blankMap(w, h)); setProps([]) }}
          className={`${btn} ml-auto`} title="ล้างเป็นพื้นว่างทั้งหมด (เหลือกำแพงรอบ) และเอาสิ่งของออก"><span className="inline-flex items-center gap-1"><Eraser size={12} /> ล้างผัง</span></button>
      </div>

      {/* ผัง */}
      {loading ? <p className="text-xs text-gray-400 py-6 text-center">กำลังโหลดผัง…</p> : (
        <div className="overflow-auto border border-gray-200 dark:border-gray-800 rounded-xl select-none" style={{ maxHeight: '60vh' }}
          onMouseLeave={() => { endStroke(); setHover(null) }}>
          <div className="relative" style={{ width: w * TILE, height: h * TILE }}>
            <OfficeDefs />
            {rows.map((row, y) => row.split('').map((ch, x) => {
              const isSpawn = spawn && spawn.x === x && spawn.y === y
              return (
                <div key={`${x},${y}`}
                  onMouseDown={e => { e.preventDefault(); down(x, y) }}
                  onMouseEnter={() => enter(x, y)}
                  title={`(${x},${y}) ${TILE_PALETTE.find(t => t.ch === ch)?.label ?? ch}`}
                  className={`absolute ${tool.type === 'erase' ? 'cursor-not-allowed' : 'cursor-crosshair'} hover:brightness-110`}
                  style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE, zIndex: isFurnitureTile(ch) ? 1 : undefined }}>
                  <OfficeTile rows={rows} x={x} y={y} size={TILE} />
                  {isSpawn && <span title="จุดเกิดของคนใหม่" className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-primary-600 ring-2 ring-white z-[3]" />}
                </div>
              )
            }))}
            {/* สิ่งของชิ้นใหญ่ */}
            {props.map((p, i) => {
              const d = propDef(p.kind)
              if (!d) return null
              const bad = badProps.includes(p), hit = eraseHit === p
              return (
                <div key={`p${i}`} className={`absolute pointer-events-none ${bad ? 'outline outline-2 outline-red-500' : hit ? 'outline outline-2 outline-red-400 opacity-60' : ''}`}
                  style={{ left: p.x * TILE, top: p.y * TILE, width: d.w * TILE, height: d.h * TILE, zIndex: 2 }}>
                  <PropSprite kind={p.kind} size={TILE} />
                </div>
              )
            })}
            {/* เงาตัวอย่างก่อนวาง */}
            {ghost && hover && (
              <div className={`absolute pointer-events-none rounded-md border-2 border-dashed ${ghost.ok ? 'border-green-500 bg-green-400/20' : 'border-red-500 bg-red-400/20'}`}
                style={{ left: hover.x * TILE, top: hover.y * TILE, width: ghost.d.w * TILE, height: ghost.d.h * TILE, zIndex: 4 }}>
                <div className="opacity-60"><PropSprite kind={ghost.d.kind} size={TILE} /></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ผลตรวจ */}
      <div className="mt-3 space-y-1">
        {issues.length === 0 && <p className="text-xs text-green-600 inline-flex items-center gap-1"><Info size={12} /> ผังใช้ได้ — จุดสีน้ำเงินคือจุดเกิดของคนที่เข้าออฟฟิศครั้งแรก</p>}
        {issues.map((i, k) => (
          <p key={k} className={`text-xs flex items-center gap-1 ${i.level === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
            <AlertTriangle size={12} /> {i.text}
          </p>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">
        เก็บใน HD_Options (OfficeMap = 1 แถวต่อ 1 บรรทัดผัง · OfficeMapProps = 1 แถวต่อ 1 ชิ้น) — ไม่ต้องสร้างคอลัมน์ใหม่ · คนที่ยืนตรงที่กลายเป็นกำแพง/ของ จะถูกย้ายไปจุดเกิดเอง
      </p>
    </Card>
  )
}
