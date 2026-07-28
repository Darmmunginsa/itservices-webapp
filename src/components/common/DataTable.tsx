import { useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

// ── ตารางกลาง ใช้ร่วมกันทุกหน้า (Projects / MyWork / Assets) ──
// คลิกหัวคอลัมน์เพื่อเรียง · scroll แนวนอนได้บนจอเล็ก · คลิกแถวเพื่อเปิดรายการ
export interface Column<T> {
  key: string
  label: string
  /** เนื้อหาที่แสดงในเซลล์ */
  render: (row: T) => React.ReactNode
  /** ค่าที่ใช้เรียง — ไม่ใส่ = คอลัมน์นี้เรียงไม่ได้ */
  sortValue?: (row: T) => string | number
  className?: string
  /** ชิดขวา (เช่นตัวเลข/ปุ่ม) */
  align?: 'left' | 'right' | 'center'
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  /** แถวที่ต้องเน้น เช่น ใกล้หมดประกัน */
  rowClass?: (row: T) => string
  emptyText?: string
}

export function DataTable<T>({ rows, columns, rowKey, onRowClick, rowClass, emptyText = 'ไม่มีข้อมูล' }: Props<T>) {
  const [sortKey, setSortKey] = useState('')
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sortKey)
    if (!col?.sortValue) return rows
    const val = col.sortValue
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b)
      // ค่าว่างไปท้ายเสมอ ไม่ว่าจะเรียงขึ้นหรือลง
      if (x === '' && y !== '') return 1
      if (y === '' && x !== '') return -1
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'th')
      return dir === 'asc' ? r : -r
    })
  }, [rows, columns, sortKey, dir])

  function toggleSort(c: Column<T>) {
    if (!c.sortValue) return
    if (sortKey === c.key) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(c.key); setDir('asc') }
  }

  const alignCls = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left')

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900">
      <table className="w-full text-sm min-w-max">
        <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800">
          <tr>
            {columns.map(c => (
              <th key={c.key} onClick={() => toggleSort(c)}
                className={`px-3 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap ${alignCls(c.align)} ${c.sortValue ? 'cursor-pointer select-none hover:text-primary-600' : ''}`}>
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {c.sortValue && (
                    sortKey === c.key
                      ? (dir === 'asc' ? <ArrowUp size={11} className="text-primary-600" /> : <ArrowDown size={11} className="text-primary-600" />)
                      : <ArrowUpDown size={11} className="text-gray-300 dark:text-gray-600" />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center text-sm text-gray-400 py-10">{emptyText}</td></tr>
          ) : sorted.map(row => (
            <tr key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-primary-50/40 dark:hover:bg-primary-900/10' : ''} ${rowClass?.(row) ?? ''}`}>
              {columns.map(c => (
                <td key={c.key} className={`px-3 py-2.5 ${alignCls(c.align)} ${c.className ?? ''}`}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
