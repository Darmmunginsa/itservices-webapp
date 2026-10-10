import { useState } from 'react'
import { Shuffle, X, RotateCcw } from 'lucide-react'
import { AvatarSprite } from './AvatarSprite'
import {
  ACCS, BOTTOMS, CLOTH_COLORS, FACES, HAIR_COLORS, HAIRS, SKINS, TOPS, avatarFromSeed,
  type Avatar, type Facing,
} from '../../utils/officeAvatar'

// ── ห้องแต่งตัว: เลือกทีละส่วน เห็นตัวอย่างสด หมุนดูได้ 4 ทิศ ──

interface Props { initial: Avatar; seed: string; saving: boolean; onSave: (a: Avatar) => void; onClose: () => void }

type Tab = 'body' | 'hair' | 'outfit' | 'acc'
const TABS: { key: Tab; label: string }[] = [
  { key: 'body', label: '🙂 หน้าและผิว' }, { key: 'hair', label: '💇 ทรงผม' },
  { key: 'outfit', label: '👕 ชุด' }, { key: 'acc', label: '👑 ของประดับ' },
]
const FACINGS: Facing[] = ['down', 'right', 'up', 'left']

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: string; onPick: (c: string) => void; label: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map(c => (
          <button key={c} onClick={() => onPick(c)} aria-label={`${label} ${c}`}
            className={`w-6 h-6 rounded-full border ${value === c ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : 'border-black/10'}`}
            style={{ background: c }} />
        ))}
      </div>
    </div>
  )
}

function Options<K extends string>({ items, value, onPick, label, preview }: {
  items: readonly { key: K; label: string }[]; value: K; onPick: (k: K) => void; label: string; preview: (k: K) => Avatar
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-500 mb-1">{label}</div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
        {items.map(it => (
          <button key={it.key} onClick={() => onPick(it.key)} title={it.label}
            className={`flex flex-col items-center rounded-xl border p-1 ${value === it.key ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}>
            <AvatarSprite a={preview(it.key)} size={34} />
            <span className="text-[10px] text-gray-600 dark:text-gray-300 truncate w-full text-center">{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function AvatarEditor({ initial, seed, saving, onSave, onClose }: Props) {
  const [a, setA] = useState<Avatar>(initial)
  const [tab, setTab] = useState<Tab>('body')
  const [face, setFace] = useState(0)
  const set = <K extends keyof Avatar>(k: K, v: Avatar[K]) => setA(p => ({ ...p, [k]: v }))
  const random = () => setA(avatarFromSeed(`${seed}:${Date.now()}:${Math.random()}`))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold">👤 แต่งตัวละครของฉัน</h3>
          <span className="text-xs text-gray-500">ทุกคนในออฟฟิศเห็นตัวละครนี้</span>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="ปิด"><X size={16} /></button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 p-4">
          {/* ตัวอย่าง */}
          <div className="sm:w-48 shrink-0 flex flex-col items-center gap-2">
            <div className="w-44 h-52 rounded-2xl bg-gradient-to-b from-amber-50 to-orange-100 dark:from-gray-800 dark:to-gray-700 flex items-end justify-center pb-3 border border-amber-100 dark:border-gray-700">
              <AvatarSprite a={a} facing={FACINGS[face]} moving size={110} />
            </div>
            <div className="flex gap-1">
              {FACINGS.map((f, i) => (
                <button key={f} onClick={() => setFace(i)} className={`rounded-lg border p-0.5 ${face === i ? 'border-primary-500' : 'border-gray-200 dark:border-gray-700'}`} aria-label={`หัน ${f}`}>
                  <AvatarSprite a={a} facing={f} size={26} />
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={random} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:border-primary-400"><Shuffle size={12} /> สุ่ม</button>
              <button onClick={() => setA(initial)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:border-primary-400"><RotateCcw size={12} /> เริ่มใหม่</button>
            </div>
          </div>
          {/* ตัวเลือก */}
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-wrap gap-1">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`text-xs px-2.5 py-1 rounded-full ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'}`}>{t.label}</button>
              ))}
            </div>
            {tab === 'body' && <>
              <Swatches label="สีผิว" colors={SKINS} value={a.skin} onPick={c => set('skin', c)} />
              <Options label="สีหน้า" items={FACES} value={a.face} onPick={k => set('face', k)} preview={k => ({ ...a, face: k })} />
            </>}
            {tab === 'hair' && <>
              <Options label="ทรงผม" items={HAIRS} value={a.hair} onPick={k => set('hair', k)} preview={k => ({ ...a, hair: k, acc: 'none' })} />
              <Swatches label="สีผม" colors={HAIR_COLORS} value={a.hairColor} onPick={c => set('hairColor', c)} />
            </>}
            {tab === 'outfit' && <>
              <Options label="เสื้อ" items={TOPS} value={a.top} onPick={k => set('top', k)} preview={k => ({ ...a, top: k })} />
              <Swatches label="สีเสื้อ" colors={CLOTH_COLORS} value={a.topColor} onPick={c => set('topColor', c)} />
              <Options label="กางเกง / กระโปรง" items={BOTTOMS} value={a.bottom} onPick={k => set('bottom', k)} preview={k => ({ ...a, bottom: k })} />
              <Swatches label="สีกางเกง / กระโปรง" colors={CLOTH_COLORS} value={a.bottomColor} onPick={c => set('bottomColor', c)} />
              <Swatches label="สีรองเท้า" colors={['#111827', '#7c2d12', '#f8fafc', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899']} value={a.shoes} onPick={c => set('shoes', c)} />
            </>}
            {tab === 'acc' && (
              <Options label="ของประดับ" items={ACCS} value={a.acc} onPick={k => set('acc', k)} preview={k => ({ ...a, acc: k })} />
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">ยกเลิก</button>
          <button onClick={() => onSave(a)} disabled={saving} className="text-sm px-3 py-1.5 rounded-lg bg-primary-600 text-white disabled:opacity-60">{saving ? 'กำลังบันทึก…' : 'บันทึกตัวละคร'}</button>
        </div>
      </div>
    </div>
  )
}
