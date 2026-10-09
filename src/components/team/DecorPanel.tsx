import { RotateCw, FlipHorizontal2, Trash2, Save, X, MoveRight, LogOut, RotateCcwSquare } from 'lucide-react'
import { CATALOG, DESK_STYLES, MAX_ITEMS, DECOR_RADIUS, DESK_SLOTS, type MyDecor } from '../../utils/officeDecor'
import { DecorSprite } from './DecorSprite'
import { DeskSprite } from './DeskSprite'

// ── แผงตกแต่งโต๊ะ (แทนช่องแชทระหว่างตกแต่ง): แคตตาล็อก + เครื่องมือของชิ้นที่เลือก + บันทึก ──

interface Props {
  draft: MyDecor
  kind: string | null
  pickKind: (k: string | null) => void
  selectedLabel: string
  hasSelection: boolean
  act: (what: 'rotate' | 'flip' | 'remove') => void
  movingDesk: boolean
  startMoveDesk: () => void
  releaseDesk: () => void
  dirty: boolean
  saving: boolean
  save: () => void
  cancel: () => void
  deskStyle: string
  pickDeskStyle: (style: string) => void
  turnDesk: () => void
}

const GROUPS = [...new Set(CATALOG.map(c => c.group))]

export function DecorPanel(p: Props) {
  const btn = 'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:text-primary-600 disabled:opacity-40'
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-primary-50/60 dark:bg-primary-900/10">
        <p className="text-xs font-semibold">🎨 ตกแต่งโต๊ะของฉัน</p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {!p.draft.desk
            ? 'เลือกแบบโต๊ะด้านล่าง แล้วคลิกช่องเขียวบนแผนที่ เพื่อวางโต๊ะตรงไหนก็ได้ในโซนทำงาน / ห้องโฟกัส'
            : p.movingDesk ? 'คลิกช่องเขียวเพื่อย้ายโต๊ะไปที่นั่น — ของแต่งย้ายตาม'
            : `เลือกของแล้วคลิกช่องสีเขียวรอบโต๊ะ (${DECOR_RADIUS} ช่อง) · บนโต๊ะวางได้ ${DESK_SLOTS} ชิ้น · ${p.draft.items.length}/${MAX_ITEMS} ชิ้น`}
        </p>
      </div>

      {/* ชิ้นที่เลือกอยู่ */}
      {p.hasSelection && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium flex-1 min-w-0 truncate">✋ {p.selectedLabel}</span>
          <button onClick={() => p.act('rotate')} className={btn} title="หมุน 90° (R)"><RotateCw size={11} /> หมุน</button>
          <button onClick={() => p.act('flip')} className={btn} title="กลับซ้าย-ขวา (F)"><FlipHorizontal2 size={11} /> กลับ</button>
          <button onClick={() => p.act('remove')} className={`${btn} hover:!border-red-400 hover:!text-red-600`} title="เอาออก (Delete)"><Trash2 size={11} /></button>
          <p className="w-full text-[10px] text-gray-400">คลิกช่องว่างเพื่อย้ายชิ้นนี้ · R หมุน · F กลับ · Delete ลบ · Esc เลิกเลือก</p>
        </div>
      )}

      {/* แคตตาล็อก */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 bg-gray-50/60 dark:bg-gray-900/40">
        {/* แบบโต๊ะ — เปลี่ยนได้ตลอด ของบนโต๊ะไม่หาย */}
        <div>
          <div className="flex items-center gap-1 mb-1 px-1">
            <p className="text-[10px] font-semibold text-gray-500 flex-1">แบบโต๊ะ</p>
            {p.draft.desk && <button onClick={p.turnDesk} className="inline-flex items-center gap-1 text-[10px] text-primary-600 hover:underline" title="หมุนโต๊ะ 90° (หันเก้าอี้ไปทิศอื่น)"><RotateCcwSquare size={11} /> หมุนโต๊ะ</button>}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {DESK_STYLES.map(d => {
              const on = p.deskStyle === d.style
              return (
                <button key={d.style} onClick={() => p.pickDeskStyle(d.style)} title={d.hint}
                  className={`flex flex-col items-center gap-0.5 pt-1.5 pb-1 rounded-lg border bg-amber-50/60 dark:bg-gray-900 ${on ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}>
                  <DeskSprite style={d.style} size={44} />
                  <span className="text-[9px] leading-tight mt-1.5 text-gray-600 dark:text-gray-300">{d.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        {GROUPS.map(g => (
          <div key={g}>
            <p className="text-[10px] font-semibold text-gray-500 mb-1 px-1">{g}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CATALOG.filter(c => c.group === g).map(c => {
                const on = p.kind === c.kind
                return (
                  <button key={c.kind} onClick={() => p.pickKind(on ? null : c.kind)} disabled={!p.draft.desk || p.movingDesk}
                    title={`${c.label} — ${c.surface === 'desk' ? 'วางบนโต๊ะ' : 'วางบนพื้นรอบโต๊ะ'}`}
                    className={`flex flex-col items-center gap-0.5 p-1 rounded-lg border bg-white dark:bg-gray-900 disabled:opacity-40 ${on ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}>
                    <DecorSprite kind={c.kind} size={34} />
                    <span className="text-[9px] leading-tight text-center text-gray-600 dark:text-gray-300 line-clamp-1">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-1.5">
        {p.draft.desk && !p.movingDesk && (
          <div className="flex gap-1.5">
            <button onClick={p.startMoveDesk} className={btn}><MoveRight size={11} /> ย้ายโต๊ะ</button>
            <button onClick={p.releaseDesk} className={`${btn} hover:!border-red-400 hover:!text-red-600`}><LogOut size={11} /> คืนโต๊ะ</button>
          </div>
        )}
        <div className="flex gap-1.5">
          <button onClick={p.save} disabled={p.saving || !p.dirty}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
            <Save size={12} /> {p.saving ? 'กำลังบันทึก…' : p.dirty ? 'บันทึก' : 'ยังไม่มีอะไรเปลี่ยน'}
          </button>
          <button onClick={p.cancel} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700"><X size={12} /> {p.dirty ? 'ยกเลิก' : 'ปิด'}</button>
        </div>
      </div>
    </div>
  )
}
