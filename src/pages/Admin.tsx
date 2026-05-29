import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarDays } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Modal } from '../components/common/Modal'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spCreate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Holiday } from '../types/common'
import { formatDate } from '../utils/dateUtils'

const HOLIDAY_TYPES: Holiday['HolidayType'][] = ['ราชการ', 'บริษัท']

const EMPTY_FORM = { title: '', holidayDate: '', holidayType: 'บริษัท' as Holiday['HolidayType'] }

export default function Admin() {
  const { addToast } = useAppStore()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))

  function load() {
    setLoading(true)
    spGet<Holiday>('HD_Holidays', undefined, undefined, 'HolidayDate asc', 200)
      .then(setHolidays).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.holidayDate) return
    setSaving(true)
    try {
      await spCreate('HD_Holidays', {
        Title: form.title,
        HolidayDate: form.holidayDate,
        HolidayType: form.holidayType,
      })
      addToast('success', 'เพิ่มวันหยุดสำเร็จ')
      setForm({ ...EMPTY_FORM })
      setShowAdd(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  async function deleteHoliday(id: number, title: string) {
    if (!window.confirm(`ลบ "${title}"?`)) return
    try {
      await spDelete('HD_Holidays', id)
      setHolidays(prev => prev.filter(h => h.id !== id))
      addToast('success', 'ลบวันหยุดแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  const years = [...new Set(holidays.map(h => h.HolidayDate?.slice(0, 4)).filter(Boolean))].sort()
  const filtered = yearFilter
    ? holidays.filter(h => h.HolidayDate?.startsWith(yearFilter))
    : holidays

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div>
      <Header title="Admin — จัดการข้อมูล" />
      <div className="p-4 md:p-6 space-y-6 max-w-3xl">

        {/* Holiday Management */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays size={18} className="text-primary-600" />
            <h2 className="text-sm font-semibold">วันหยุดบริษัท / ราชการ</h2>
            <div className="ml-auto flex items-center gap-2">
              {years.length > 0 && (
                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  <option value="">ทุกปี</option>
                  {years.map(y => <option key={y}>{y}</option>)}
                </select>
              )}
              <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> เพิ่มวันหยุด</Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : filtered.length === 0
                ? <p className="text-center text-sm text-gray-400 py-10">ไม่มีวันหยุด</p>
                : filtered.map(h => (
                    <div key={h.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{h.Title}</p>
                        <p className="text-xs text-gray-400">{formatDate(h.HolidayDate)}</p>
                      </div>
                      <Badge className={h.HolidayType === 'ราชการ'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}>
                        {h.HolidayType}
                      </Badge>
                      <button onClick={() => deleteHoliday(h.id, h.Title)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
            }
          </div>
          <p className="text-xs text-gray-400 mt-2">{filtered.length} วัน</p>
        </Card>
      </div>

      {/* Add Holiday Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="เพิ่มวันหยุด" size="sm">
        <form onSubmit={addHoliday} className="space-y-4">
          <div>
            <label className={labelClass}>ชื่อวันหยุด *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={inputClass} placeholder="เช่น วันปีใหม่, วันหยุดชดเชย..." />
          </div>
          <div>
            <label className={labelClass}>วันที่ *</label>
            <input required type="date" value={form.holidayDate}
              onChange={e => setForm(f => ({ ...f, holidayDate: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>ประเภท</label>
            <div className="flex gap-2">
              {HOLIDAY_TYPES.map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, holidayType: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.holidayType === t
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full justify-center">
            {saving ? 'กำลังบันทึก...' : 'เพิ่มวันหยุด'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
