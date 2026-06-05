import { useEffect, useState } from 'react'
import { Plus, Trash2, CalendarDays, Megaphone, Pencil, ToggleLeft, ToggleRight, Plane } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Card } from '../components/common/Card'
import { Modal } from '../components/common/Modal'
import { SkeletonRow } from '../components/common/Skeleton'
import { spGet, spCreate, spDelete, spUpdate } from '../services/sharepoint'
import { createCalendarEvent, deleteCalendarEvent } from '../services/graph'
import { useAppStore } from '../store/useAppStore'
import type { Holiday, Announcement, AgentProfile, LeaveQuota } from '../types/common'
import { formatDate } from '../utils/dateUtils'

const HOLIDAY_TYPES: Holiday['HolidayType'][] = ['ราชการ', 'บริษัท']
const EMPTY_FORM = { title: '', holidayDate: '', holidayType: 'บริษัท' as Holiday['HolidayType'] }

const EMPTY_ANN = { title: '', message: '', isActive: true, sortOrder: 0 }

export default function Admin() {
  const { addToast } = useAppStore()

  // Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()))

  // Announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [annLoading, setAnnLoading] = useState(true)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null)
  const [annForm, setAnnForm] = useState({ ...EMPTY_ANN })
  const [savingAnn, setSavingAnn] = useState(false)

  function load() {
    setLoading(true)
    spGet<Holiday>('HD_Holidays', undefined, undefined, 'HolidayDate asc', 200)
      .then(setHolidays).catch(() => {}).finally(() => setLoading(false))
  }

  function loadAnn() {
    setAnnLoading(true)
    spGet<Announcement>('HD_Announcements', undefined, undefined, 'SortOrder asc', 200)
      .then(setAnnouncements).catch(() => {}).finally(() => setAnnLoading(false))
  }

  // Leave quota state (per-employee)
  const [agentsList, setAgentsList] = useState<AgentProfile[]>([])
  const [quotaEmail, setQuotaEmail] = useState('')      // พนักงานที่เลือก
  const [quotas, setQuotas] = useState<LeaveQuota[]>([]) // โควต้าของพนักงานที่เลือก
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [qForm, setQForm] = useState({ title: '', days: '' })
  const [savingQuota, setSavingQuota] = useState(false)

  const LEAVE_TYPES = ['ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'ลาคลอด', 'ลาอื่นๆ']

  function loadAgentsList() {
    spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText,Role', 'Title asc', 500)
      .then(setAgentsList).catch(() => {})
  }

  function loadQuotas(email: string) {
    if (!email) { setQuotas([]); return }
    setQuotaLoading(true)
    spGet<LeaveQuota>('HD_LeaveQuota', `EmployeeEmail eq '${email}'`, 'Id,Title,Days,EmployeeEmail', 'Title asc', 100)
      .then(setQuotas).catch(() => {}).finally(() => setQuotaLoading(false))
  }

  async function addQuota(e: React.FormEvent) {
    e.preventDefault()
    if (!quotaEmail) { addToast('error', 'เลือกพนักงานก่อน'); return }
    if (!qForm.title.trim() || qForm.days === '') return
    if (quotas.some(q => q.Title === qForm.title.trim())) { addToast('error', 'ประเภทนี้มีอยู่แล้ว'); return }
    setSavingQuota(true)
    try {
      await spCreate('HD_LeaveQuota', { Title: qForm.title.trim(), Days: Number(qForm.days), EmployeeEmail: quotaEmail })
      setQForm({ title: '', days: '' })
      addToast('success', 'เพิ่มโควต้าวันลาแล้ว')
      loadQuotas(quotaEmail)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingQuota(false) }
  }

  async function updateQuotaDays(q: LeaveQuota, days: number) {
    if (days === q.Days) return
    setQuotas(prev => prev.map(x => x.id === q.id ? { ...x, Days: days } : x))
    try { await spUpdate('HD_LeaveQuota', q.id, { Days: days }) }
    catch { addToast('error', 'บันทึกไม่สำเร็จ'); loadQuotas(quotaEmail) }
  }

  async function deleteQuota(id: number, title: string) {
    if (!window.confirm(`ลบโควต้า "${title}"?`)) return
    try {
      await spDelete('HD_LeaveQuota', id)
      setQuotas(prev => prev.filter(q => q.id !== id))
      addToast('success', 'ลบแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  // คัดลอกโควต้าเริ่มต้นให้พนักงานที่เลือก (เฉพาะประเภทที่ยังไม่มี)
  async function applyDefaultQuota() {
    if (!quotaEmail) { addToast('error', 'เลือกพนักงานก่อน'); return }
    const defaults: Record<string, number> = { 'ลาพักร้อน': 6, 'ลาป่วย': 30, 'ลากิจ': 3 }
    const missing = Object.entries(defaults).filter(([t]) => !quotas.some(q => q.Title === t))
    if (missing.length === 0) { addToast('error', 'มีครบแล้ว'); return }
    setSavingQuota(true)
    try {
      for (const [title, days] of missing) {
        await spCreate('HD_LeaveQuota', { Title: title, Days: days, EmployeeEmail: quotaEmail })
      }
      addToast('success', `เพิ่มโควต้าเริ่มต้น ${missing.length} ประเภทแล้ว`)
      loadQuotas(quotaEmail)
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingQuota(false) }
  }

  // Home video (HD_Options Category=HomeVideo, single row)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoRowId, setVideoRowId] = useState<number | null>(null)
  const [savingVideo, setSavingVideo] = useState(false)

  function loadVideo() {
    spGet<{ id: number; Title: string; Category: string }>('HD_Options', "Category eq 'HomeVideo'", 'Id,Title,Category')
      .then(rows => { if (rows[0]) { setVideoRowId(rows[0].id); setVideoUrl(rows[0].Title || '') } })
      .catch(() => {})
  }

  async function saveVideo() {
    setSavingVideo(true)
    try {
      if (videoRowId) await spUpdate('HD_Options', videoRowId, { Title: videoUrl })
      else {
        const res = await spCreate('HD_Options', { Title: videoUrl, Category: 'HomeVideo', SortOrder: 0 })
        setVideoRowId(res.id)
      }
      addToast('success', 'บันทึกวิดีโอหน้าหลักแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingVideo(false) }
  }

  useEffect(() => { load(); loadAnn(); loadVideo(); loadAgentsList() }, [])
  useEffect(() => { loadQuotas(quotaEmail) }, [quotaEmail])

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

      // สร้าง Calendar event + invite ทีมทั้งหมด
      try {
        const agents = await spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText')
        const attendees = agents.map(a => a.EmailText).filter(Boolean)

        // all-day event: end = วันถัดไป
        const startDate = new Date(form.holidayDate)
        const endDate = new Date(form.holidayDate)
        endDate.setDate(endDate.getDate() + 1)
        const toISO = (d: Date) => d.toISOString().split('T')[0] + 'T00:00:00'

        const calEvent = await createCalendarEvent({
          subject: `🏖 ${form.holidayType === 'ราชการ' ? '[วันหยุดราชการ]' : '[วันหยุดบริษัท]'} ${form.title}`,
          start: toISO(startDate),
          end: toISO(endDate),
          attendees,
          isAllDay: true,
          body: `วันหยุด${form.holidayType}: ${form.title}\nวันที่: ${form.holidayDate}`,
        })
        // บันทึก CalendarEventId กลับ SP เพื่อใช้ตอนลบ
        if (calEvent?.id) {
          const latest = await spGet<Holiday>('HD_Holidays',
            `Title eq '${form.title}' and HolidayDate eq '${form.holidayDate}'`)
          if (latest[0]) await spUpdate('HD_Holidays', latest[0].id, { CalendarEventId: calEvent.id })
        }
        addToast('success', `เพิ่มวันหยุดและส่ง Calendar invite ให้ทีม ${attendees.length} คนแล้ว`)
      } catch {
        addToast('success', 'เพิ่มวันหยุดสำเร็จ (Calendar invite ไม่สำเร็จ)')
      }

      setForm({ ...EMPTY_FORM })
      setShowAdd(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  async function deleteHoliday(id: number, title: string, calEventId?: string) {
    if (!window.confirm(`ลบ "${title}"?\nจะยกเลิก Calendar event ของทีมด้วย`)) return
    try {
      // ลบ Calendar event (ส่ง cancellation ให้ attendees อัตโนมัติ)
      if (calEventId) {
        try { await deleteCalendarEvent(calEventId) } catch { /* non-critical */ }
      }
      await spDelete('HD_Holidays', id)
      setHolidays(prev => prev.filter(h => h.id !== id))
      addToast('success', calEventId ? 'ลบวันหยุดและยกเลิก Calendar event แล้ว' : 'ลบวันหยุดแล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  function openNewAnn() {
    setEditingAnn(null)
    setAnnForm({ ...EMPTY_ANN })
    setShowAnnModal(true)
  }

  function openEditAnn(ann: Announcement) {
    setEditingAnn(ann)
    setAnnForm({ title: ann.Title, message: ann.Message, isActive: ann.IsActive, sortOrder: ann.SortOrder })
    setShowAnnModal(true)
  }

  async function saveAnn(e: React.FormEvent) {
    e.preventDefault()
    if (!annForm.title.trim() || !annForm.message.trim()) return
    setSavingAnn(true)
    const payload = {
      Title: annForm.title,
      Message: annForm.message,
      IsActive: annForm.isActive,
      SortOrder: Number(annForm.sortOrder),
    }
    try {
      if (editingAnn) {
        await spUpdate('HD_Announcements', editingAnn.id, payload)
        addToast('success', 'บันทึกสำเร็จ')
      } else {
        await spCreate('HD_Announcements', payload)
        addToast('success', 'เพิ่มประกาศสำเร็จ')
      }
      setShowAnnModal(false)
      loadAnn()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSavingAnn(false) }
  }

  async function toggleAnn(ann: Announcement) {
    try {
      await spUpdate('HD_Announcements', ann.id, { IsActive: !ann.IsActive })
      setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, IsActive: !a.IsActive } : a))
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  async function deleteAnn(id: number, title: string) {
    if (!window.confirm(`ลบ "${title}"?`)) return
    try {
      await spDelete('HD_Announcements', id)
      setAnnouncements(prev => prev.filter(a => a.id !== id))
      addToast('success', 'ลบประกาศแล้ว')
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

        {/* Announcements Management */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Megaphone size={18} className="text-primary-600" />
            <h2 className="text-sm font-semibold">ข้อความวิ่ง (HD_Announcements)</h2>
            <div className="ml-auto">
              <Button size="sm" onClick={openNewAnn}><Plus size={14} /> เพิ่มประกาศ</Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
            {annLoading
              ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
              : announcements.length === 0
                ? <p className="text-center text-sm text-gray-400 py-10">ไม่มีประกาศ</p>
                : announcements.map(ann => (
                    <div key={ann.id} className="flex items-start gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{ann.Title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{ann.Message}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-400 mr-1">#{ann.SortOrder}</span>
                        <Badge className={ann.IsActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'}>
                          {ann.IsActive ? 'แสดง' : 'ซ่อน'}
                        </Badge>
                        <button onClick={() => toggleAnn(ann)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                          {ann.IsActive ? <ToggleRight size={16} className="text-primary-600" /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => openEditAnn(ann)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteAnn(ann.id, ann.Title)}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
            }
          </div>
          <p className="text-xs text-gray-400 mt-2">{announcements.length} ประกาศ</p>
        </Card>

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
                      <button onClick={() => deleteHoliday(h.id, h.Title, h.CalendarEventId)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
            }
          </div>
          <p className="text-xs text-gray-400 mt-2">{filtered.length} วัน</p>
        </Card>

        {/* Leave Quota Management (per-employee) */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <Plane size={18} className="text-primary-600" />
            <h2 className="text-sm font-semibold">โควต้าวันลารายบุคคล (HD_LeaveQuota)</h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">เลือกพนักงานแล้วกำหนดจำนวนวันลาที่ใช้ได้ต่อปีในแต่ละประเภท — พนักงานจะกดตรวจสอบวันคงเหลือของตัวเองในฟอร์มขอลาได้</p>

          {/* Employee selector */}
          <div className="mb-3">
            <label className={labelClass}>พนักงาน</label>
            <select value={quotaEmail} onChange={e => setQuotaEmail(e.target.value)} className={inputClass}>
              <option value="">-- เลือกพนักงาน --</option>
              {agentsList.map(a => <option key={a.id} value={a.EmailText}>{a.Title} ({a.Role})</option>)}
            </select>
          </div>

          {quotaEmail && (
            <>
              {/* Add row */}
              <form onSubmit={addQuota} className="flex gap-2 mb-3">
                <select value={qForm.title} onChange={e => setQForm(f => ({ ...f, title: e.target.value }))} className={`flex-1 ${inputClass}`}>
                  <option value="">-- ประเภท --</option>
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="number" min={0} value={qForm.days} onChange={e => setQForm(f => ({ ...f, days: e.target.value }))}
                  placeholder="วัน/ปี" className={`w-24 ${inputClass}`} />
                <Button type="submit" size="sm" disabled={savingQuota}><Plus size={14} /> เพิ่ม</Button>
              </form>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                {quotaLoading
                  ? Array.from({ length: 2 }).map((_, i) => <SkeletonRow key={i} />)
                  : quotas.length === 0
                    ? <div className="text-center py-8">
                        <p className="text-sm text-gray-400 mb-3">ยังไม่ได้กำหนดโควต้าให้พนักงานคนนี้</p>
                        <Button size="sm" variant="secondary" onClick={applyDefaultQuota} disabled={savingQuota}>ใช้ค่าเริ่มต้น (พักร้อน 6 / ป่วย 30 / กิจ 3)</Button>
                      </div>
                    : quotas.map(q => (
                        <div key={q.id} className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{q.Title}</span>
                          <input type="number" min={0} defaultValue={q.Days}
                            onBlur={e => updateQuotaDays(q, Number(e.target.value))}
                            className="w-20 px-2 py-1 text-sm text-right border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                          <span className="text-xs text-gray-400 w-10">วัน/ปี</span>
                          <button onClick={() => deleteQuota(q.id, q.Title)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                }
              </div>
              <p className="text-xs text-gray-400 mt-2">แก้จำนวนวันแล้วคลิกออกจากช่องเพื่อบันทึกอัตโนมัติ</p>
            </>
          )}
        </Card>

        {/* Home Video */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-red-600" />
            <h2 className="text-sm font-semibold">วิดีโอหน้าหลัก (YouTube)</h2>
          </div>
          <p className="text-xs text-gray-400 mb-2">วางลิงก์ YouTube (เช่น https://youtu.be/xxxx หรือ https://www.youtube.com/watch?v=xxxx) — เว้นว่างเพื่อซ่อน</p>
          <div className="flex gap-2">
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://youtu.be/..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <Button size="sm" onClick={saveVideo} disabled={savingVideo}>{savingVideo ? '...' : 'บันทึก'}</Button>
          </div>
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

      {/* Add/Edit Announcement Modal */}
      <Modal open={showAnnModal} onClose={() => setShowAnnModal(false)}
        title={editingAnn ? 'แก้ไขประกาศ' : 'เพิ่มประกาศ'} size="sm">
        <form onSubmit={saveAnn} className="space-y-4">
          <div>
            <label className={labelClass}>ชื่อประกาศ *</label>
            <input required value={annForm.title}
              onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))}
              className={inputClass} placeholder="เช่น ประกาศปิดระบบ..." />
          </div>
          <div>
            <label className={labelClass}>ข้อความวิ่ง *</label>
            <textarea required rows={3} value={annForm.message}
              onChange={e => setAnnForm(f => ({ ...f, message: e.target.value }))}
              className={inputClass} placeholder="ข้อความที่จะแสดงบนแถบวิ่ง..." />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={labelClass}>ลำดับ (SortOrder)</label>
              <input type="number" min={0} value={annForm.sortOrder}
                onChange={e => setAnnForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className={inputClass} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>สถานะ</label>
              <div className="flex gap-2 mt-1">
                {[true, false].map(v => (
                  <button key={String(v)} type="button"
                    onClick={() => setAnnForm(f => ({ ...f, isActive: v }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      annForm.isActive === v
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                    {v ? 'แสดง' : 'ซ่อน'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button type="submit" disabled={savingAnn} className="w-full justify-center">
            {savingAnn ? 'กำลังบันทึก...' : editingAnn ? 'บันทึก' : 'เพิ่มประกาศ'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
