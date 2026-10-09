import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapIcon, Save, RotateCcw, Undo2, AlertTriangle, Info, Eraser } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { useAppStore } from '../../store/useAppStore'
import { getOfficeMapRows, saveOfficeMap, resetOfficeMap } from '../../services/office'
import { DEFAULT_MAP, TILE_PALETTE, PLANT_TILES, isFurnitureTile, setTile, resizeMap, blankMap, validateMap, parseMap, spawnPoint } from '../../utils/officeMap'
import { OfficeTile, OfficeDefs } from '../team/OfficeTile'
import { PlantArt } from '../team/PlantArt'

// ── Admin: ตัวแก้ผังออฟฟิศ 2D — ระบายสีช่องด้วยเมาส์ ไม่ต้องพิมพ์ตัวอักษรเอง ──
//
// บันทึกเป็นแถวใน HD_Options (Category=OfficeMap) ทีมเห็นผังใหม่ในการโหลดหน้าครั้งถัดไป
// ตรวจก่อนบันทึก: ขอบต้องเป็นกำแพง · ต้องมีจุดเกิด · เตือนห้องที่เดินไปไม่ถึง

const TILE = 24

// ตัวอย่างในจานสี — วางช่องนั้นกลางผัง 3×3: เฟอร์นิเจอร์อยู่บนพื้นไม้ · กำแพงมีพื้นข้างล่างเลยเห็นหน้าผนัง · พื้นโชว์ลายเต็ม
const PALETTE_ROWS: Record<string, string[]> = Object.fromEntries(
  TILE_PALETTE.map(t => [t.ch,
    t.ch === '#' ? ['###', '###', '...']
      : isFurnitureTile(t.ch) ? ['...', `.${t.ch}.`, '...']
        : [t.ch.repeat(3), t.ch.repeat(3), t.ch.repeat(3)]]),
)

export function OfficeMapEditor() {
  const { addToast } = useAppStore()
  const [rows, setRows] = useState<string[]>(DEFAULT_MAP)
  const [savedRows, setSavedRows] = useState<string[]>(DEFAULT_MAP)
  const [brush, setBrush] = useState('#')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<string[][]>([])
  const painting = useRef(false)
  const strokeStart = useRef<string[] | null>(null)

  useEffect(() => {
    getOfficeMapRows().then(r => { setRows(r); setSavedRows(r) }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const issues = useMemo(() => validateMap(rows), [rows])
  const hasError = issues.some(i => i.level === 'error')
  const dirty = rows.join('\n') !== savedRows.join('\n')
  const map = useMemo(() => parseMap(rows), [rows])
  const spawn = useMemo(() => (hasError ? null : spawnPoint(map, 0)), [map, hasError])
  const w = rows[0]?.length ?? 0, h = rows.length

  // ลากระบาย: จำสถานะตอนเริ่มลากไว้ 1 ช่อง undo ต่อ 1 การลาก ไม่ใช่ต่อ 1 ช่อง
  function beginStroke(x: number, y: number) {
    painting.current = true
    strokeStart.current = rows
    setRows(r => setTile(r, x, y, brush))
  }
  function paint(x: number, y: number) {
    if (!painting.current) return
    setRows(r => setTile(r, x, y, brush))
  }
  function endStroke() {
    if (!painting.current) return
    painting.current = false
    const before = strokeStart.current
    strokeStart.current = null
    if (before && before.join('\n') !== rows.join('\n')) setHistory(hist => [...hist.slice(-29), before])
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
    setRows(prev)
  }
  function resize(nw: number, nh: number) {
    setHistory(hist => [...hist.slice(-29), rows])
    setRows(resizeMap(rows, nw, nh))
  }

  async function save() {
    if (hasError) return
    setSaving(true)
    try {
      await saveOfficeMap(rows)
      setSavedRows(rows)
      addToast('success', 'บันทึกผังออฟฟิศแล้ว — ทีมเห็นผังใหม่เมื่อเปิดหน้าสถานะทีมครั้งถัดไป')
    } catch (e) { addToast('error', `บันทึกไม่สำเร็จ: ${(e as Error).message}`) }
    finally { setSaving(false) }
  }
  async function reset() {
    if (!window.confirm('กลับไปใช้ผังมาตรฐานของระบบ? ผังที่แก้ไว้จะถูกลบ')) return
    setSaving(true)
    try {
      await resetOfficeMap()
      setRows(DEFAULT_MAP); setSavedRows(DEFAULT_MAP); setHistory([])
      addToast('success', 'กลับไปใช้ผังมาตรฐานแล้ว')
    } catch (e) { addToast('error', `ไม่สำเร็จ: ${(e as Error).message}`) }
    finally { setSaving(false) }
  }

  const btn = 'text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 disabled:opacity-40'

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <MapIcon size={18} className="text-primary-600" />
        <h2 className="text-sm font-semibold">ผังออฟฟิศ 2D (หน้าสถานะทีม)</h2>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={undo} disabled={!history.length} className={btn} title="ย้อนกลับ (ต่อการลาก 1 ครั้ง)"><span className="inline-flex items-center gap-1"><Undo2 size={12} /> ย้อน</span></button>
          <button onClick={reset} disabled={saving} className={btn} title="ลบผังที่แก้ไว้ กลับไปใช้ของระบบ"><span className="inline-flex items-center gap-1"><RotateCcw size={12} /> ผังมาตรฐาน</span></button>
          <Button size="sm" onClick={save} disabled={saving || hasError || !dirty}>
            <Save size={14} /> {saving ? 'กำลังบันทึก…' : dirty ? 'บันทึกผัง' : 'บันทึกแล้ว'}
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        เลือกชนิดช่องด้านล่าง แล้ว<b>คลิก/ลาก</b>ระบายบนผัง · เดินเข้าโซนไหน สถานะของคนนั้นเปลี่ยนตามโซน · ขอบนอกสุดต้องเป็นกำแพงเสมอ
      </p>

      {/* จานสี */}
      <OfficeDefs />
      <div className="flex flex-wrap gap-1.5 mb-3">
        {TILE_PALETTE.map(t => {
          const on = brush === t.ch
          return (
            <button key={t.ch} onClick={() => setBrush(t.ch)} title={t.hint}
              className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg border text-xs ${on ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {PLANT_TILES.includes(t.ch) ? (
                <svg width="22" height="34" viewBox="0 -34 36 70" aria-hidden="true" className="rounded bg-amber-50"><PlantArt ch={t.ch} /></svg>
              ) : (
                <span className="inline-flex rounded overflow-hidden"><OfficeTile rows={PALETTE_ROWS[t.ch]} x={1} y={1} size={22} /></span>
              )}
              {t.label}
              <span className="font-mono text-[10px] text-gray-400">{t.ch}</span>
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
        <span className="text-gray-400">ช่อง (8–60) · ช่องใหม่เป็นพื้นโต๊ะทำงาน</span>
        <button onClick={() => { setHistory(hh => [...hh.slice(-29), rows]); setRows(blankMap(w, h)) }}
          className={`${btn} ml-auto`} title="ล้างเป็นพื้นว่างทั้งหมด (เหลือกำแพงรอบ)"><span className="inline-flex items-center gap-1"><Eraser size={12} /> ล้างผัง</span></button>
      </div>

      {/* ผัง */}
      {loading ? <p className="text-xs text-gray-400 py-6 text-center">กำลังโหลดผัง…</p> : (
        <div className="overflow-auto border border-gray-200 dark:border-gray-800 rounded-xl select-none" style={{ maxHeight: '60vh' }}
          onMouseLeave={endStroke}>
          <div className="relative" style={{ width: w * TILE, height: h * TILE }}>
            <OfficeDefs />
            {rows.map((row, y) => row.split('').map((ch, x) => {
              const isSpawn = spawn && spawn.x === x && spawn.y === y
              return (
                <div key={`${x},${y}`}
                  onMouseDown={e => { e.preventDefault(); beginStroke(x, y) }}
                  onMouseEnter={() => paint(x, y)}
                  title={`(${x},${y}) ${TILE_PALETTE.find(t => t.ch === ch)?.label ?? ch}`}
                  className="absolute cursor-crosshair hover:brightness-110"
                  style={{ left: x * TILE, top: y * TILE, width: TILE, height: TILE, zIndex: isFurnitureTile(ch) ? 1 : undefined }}>
                  <OfficeTile rows={rows} x={x} y={y} size={TILE} />
                  {isSpawn && <span title="จุดเกิดของคนใหม่" className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full bg-primary-600 ring-2 ring-white" />}
                </div>
              )
            }))}
          </div>
        </div>
      )}

      {/* ผลตรวจ */}
      <div className="mt-3 space-y-1">
        {issues.length === 0 && <p className="text-xs text-green-600 inline-flex items-center gap-1"><Info size={12} /> ผังใช้ได้ — จุดสีน้ำเงินคือจุดเกิดของคนที่เข้าออฟฟิศครั้งแรก</p>}
        {issues.map((i, k) => (
          <p key={k} className={`text-xs inline-flex items-center gap-1 ${i.level === 'error' ? 'text-red-600' : 'text-amber-600'}`}>
            <AlertTriangle size={12} /> {i.text}
          </p>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">
        เก็บใน HD_Options (Category = OfficeMap, 1 แถวต่อ 1 บรรทัดของผัง) — ไม่ต้องสร้างคอลัมน์ใหม่ · คนที่ยืนอยู่บนช่องที่กลายเป็นกำแพงจะถูกย้ายไปจุดเกิดเอง
      </p>
    </Card>
  )
}
