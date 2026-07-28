import { useState } from 'react'
import { LayoutGrid, Table2 } from 'lucide-react'

export type ViewMode = 'card' | 'table'

/** จำมุมมองที่เลือกไว้ต่อหน้า (แยกตาม storageKey) */
export function useViewMode(storageKey: string, initial: ViewMode = 'card') {
  const [mode, setMode] = useState<ViewMode>(() => {
    const v = localStorage.getItem(`view_${storageKey}`)
    return v === 'table' || v === 'card' ? v : initial
  })
  function set(m: ViewMode) {
    localStorage.setItem(`view_${storageKey}`, m)
    setMode(m)
  }
  return [mode, set] as const
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const btn = (m: ViewMode) =>
    `flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
      mode === m
        ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100'
        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
    }`
  return (
    <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      <button type="button" onClick={() => onChange('card')} className={btn('card')} title="มุมมองการ์ด">
        <LayoutGrid size={13} /> การ์ด
      </button>
      <button type="button" onClick={() => onChange('table')} className={btn('table')} title="มุมมองตาราง">
        <Table2 size={13} /> ตาราง
      </button>
    </div>
  )
}
