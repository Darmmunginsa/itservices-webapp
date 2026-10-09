import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { OfficeTile, OfficeDefs } from '../src/components/team/OfficeTile'
import { TILE_PALETTE, PLANT_TILES } from '../src/utils/officeMap'

// ต้นไม้ทั้ง 9 ชนิด เรียงบนพื้นไม้ มีกำแพงด้านหลัง — ดูขนาด/มิติ/การล้นขึ้นช่องบน
const T = 64
const rows = ['#'.repeat(PLANT_TILES.length * 2 + 1), '.'.repeat(PLANT_TILES.length * 2 + 1), '.' + [...PLANT_TILES].join('.') + '.', '.'.repeat(PLANT_TILES.length * 2 + 1)]
createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 16 }}>
    <div style={{ position: 'relative', width: rows[0].length * T, height: rows.length * T }}>
      <OfficeDefs />
      {rows.map((r, y) => r.split('').map((ch, x) => (
        <div key={`${x},${y}`} style={{ position: 'absolute', left: x * T, top: y * T, zIndex: PLANT_TILES.includes(ch) ? 1 : undefined }}>
          <OfficeTile rows={rows} x={x} y={y} size={T} />
        </div>
      )))}
    </div>
    <div style={{ display: 'flex', marginTop: 4 }}>
      {[...PLANT_TILES].map((ch) => (
        <div key={ch} style={{ width: T * 2, textAlign: 'center', fontSize: 13, marginLeft: ch === 'P' ? T : 0 }}>{TILE_PALETTE.find(t => t.ch === ch)?.label}</div>
      ))}
    </div>
  </div>,
)
