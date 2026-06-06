import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { spCreate, spGet } from '../../services/sharepoint'
import { createCalendarEvent } from '../../services/graph'
import { SearchMultiSelect } from './SearchSelect'
import type { AgentProfile } from '../../types/common'
import type { Contract } from '../../types/ticket'

export function DateTaskModal() {
  const { dateTaskModal, closeDateTaskModal, user, addToast } = useAppStore()

  const [mode, setMode] = useState<'personal' | 'project'>('personal')
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: number; Title: string; Status?: string }[]>([])
  const [activeProjectsOnly, setActiveProjectsOnly] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOnlineMeeting, setIsOnlineMeeting] = useState(false)
  const [externalAttendees, setExternalAttendees] = useState('')
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [internalEmails, setInternalEmails] = useState<string[]>([])
  const [customerEmails, setCustomerEmails] = useState<string[]>([])

  // Load master data once
  useEffect(() => {
    spGet<{ id: number; Title: string; Status?: string }>('PM_Projects', undefined, 'Id,Title,Status', 'Title asc')
      .then(setProjects).catch(() => {})
    spGet<AgentProfile>('HD_AgentProfiles', undefined, undefined, 'Title asc').then(setAgents).catch(() => {})
    spGet<Contract>('HD_Contracts', "Status ne 'Expired'", undefined, 'Title asc').then(setContracts).catch(() => {})
  }, [])

  const internalOptions = agents.map(a => ({ value: a.EmailText ?? '', label: `${a.Title}${a.SupportGroup ? ` · ${a.SupportGroup}` : ''}` })).filter(o => o.value)
  const customerOptions = contracts.filter(c => c.CustomerEmail).map(c => ({ value: c.CustomerEmail ?? '', label: `${c.Title}${c.Company ? ` (${c.Company})` : ''}` })).filter(o => o.value)

  // Reset when modal opens
  useEffect(() => {
    if (dateTaskModal) {
      setMode('personal')
      setTitle('')
      setProjectId('')
      setIsOnlineMeeting(false)
      setExternalAttendees('')
      setInternalEmails([])
      setCustomerEmails([])
    }
  }, [dateTaskModal])

  if (!dateTaskModal) return null

  const match = dateTaskModal

  async function handleSave() {
    if (!user || !title.trim()) return
    setSaving(true)
    const dates = match.allDates ?? [match.isoDate]
    const endHour = String(Math.min(parseInt(match.time.split(':')[0]) + 1, 23)).padStart(2, '0')
    const endMin = match.time.split(':')[1]
    const attendeeList = [...internalEmails, ...customerEmails, ...externalAttendees.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)]
    try {
      if (mode === 'project') {
        await Promise.all(dates.map(d => spCreate('PM_Tasks', {
          Title: dates.length > 1 ? `${title.trim()} (${d})` : title.trim(),
          DueDate: `${d}T${match.time}:00`,
          AssignedTo: user.displayName,
          AssignedEmail: user.email,
          IsCompleted: false,
          IsAcknowledged: false,
          ...(projectId ? { ProjectID: Number(projectId) } : {}),
        })))
        // ถ้าติ๊กประชุม Teams → สร้าง Calendar event ของ Task ด้วย
        if (isOnlineMeeting || attendeeList.length > 0) {
          await Promise.all(dates.map(d => createCalendarEvent({
            subject: dates.length > 1 ? `${title.trim()} (${d})` : title.trim(),
            start: `${d}T${match.time}:00`,
            end: `${d}T${endHour}:${endMin}:00`,
            body: `Task: ${title.trim()}`,
            attendees: attendeeList,
            isOnlineMeeting,
          })))
        }
        addToast('success', dates.length > 1 ? `สร้าง ${dates.length} Task แล้ว` : 'สร้าง Task แล้ว')
      } else {
        await Promise.all(dates.map(d => createCalendarEvent({
          subject: dates.length > 1 ? `${title.trim()} (${d})` : title.trim(),
          start: `${d}T${match.time}:00`,
          end: `${d}T${endHour}:${endMin}:00`,
          body: `สร้างจาก: ${match.text}`,
          attendees: attendeeList,
          isOnlineMeeting,
        })))
        addToast('success', dates.length > 1 ? `เพิ่ม ${dates.length} นัดหมายใน Calendar แล้ว` : 'เพิ่มใน Calendar แล้ว')
      }
      closeDateTaskModal()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) closeDateTaskModal() }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">สร้างจากวันที่ที่พบ</h3>
          <button onClick={closeDateTaskModal} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Detected date badge */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          <div className="font-medium">📅 {match.text}</div>
          {match.allDates && match.allDates.length > 1 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {match.allDates.map(d => (
                <span key={d} className="bg-amber-200 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200 text-xs px-2 py-0.5 rounded-full">{d}</span>
              ))}
              <span className="text-xs text-amber-600 dark:text-amber-400 self-center">→ จะสร้าง {match.allDates.length} รายการ</span>
            </div>
          )}
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-sm">
          <button
            type="button"
            onClick={() => setMode('personal')}
            className={`flex-1 py-2 font-medium transition-colors ${mode === 'personal'
              ? 'bg-primary-600 text-white'
              : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            📅 ส่วนตัว
          </button>
          <button
            type="button"
            onClick={() => setMode('project')}
            className={`flex-1 py-2 font-medium transition-colors ${mode === 'project'
              ? 'bg-primary-600 text-white'
              : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            📋 Project
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {mode === 'personal' ? 'ชื่อนัดหมาย' : 'ชื่อ Task'} *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
              placeholder={mode === 'personal' ? 'ชื่อนัดหมายใน Calendar...' : 'ชื่อ Task...'}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">วันที่</label>
              <input type="date" value={match.isoDate} readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">เวลา</label>
              <input type="time" value={match.time} readOnly
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500" />
            </div>
          </div>

          {mode === 'project' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">โครงการ (ถ้ามี)</label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={activeProjectsOnly} onChange={e => setActiveProjectsOnly(e.target.checked)} className="w-3 h-3 accent-primary-600" />
                  เฉพาะ Active
                </label>
              </div>
              <select value={projectId} onChange={e => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">-- ไม่ระบุ --</option>
                {(activeProjectsOnly ? projects.filter(p => p.Status === 'Active') : projects)
                  .map(p => <option key={p.id} value={p.id}>{p.Title}{p.Status !== 'Active' ? ` [${p.Status}]` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Teams meeting — both modes */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={isOnlineMeeting} onChange={e => setIsOnlineMeeting(e.target.checked)} className="rounded accent-primary-600" />
            💻 เพิ่มการประชุมออนไลน์ (Teams)
          </label>

          {/* Attendees — shown only after checking Teams */}
          {isOnlineMeeting && (<>
            <SearchMultiSelect label="ผู้เข้าร่วม Internal" options={internalOptions} selected={internalEmails}
              onToggle={v => setInternalEmails(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])} />
            <SearchMultiSelect label="ผู้เข้าร่วม ลูกค้า" options={customerOptions} selected={customerEmails}
              onToggle={v => setCustomerEmails(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])} />
            <input value={externalAttendees} onChange={e => setExternalAttendees(e.target.value)}
              placeholder="Email ภายนอก (คั่นด้วย , )"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </>)}

          {mode === 'personal' && (
            <p className="text-xs text-gray-400">จะเพิ่มเป็นนัดหมายใน Outlook Calendar ของคุณ ไม่บันทึกลง SharePoint</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button onClick={closeDateTaskModal}
            className="flex-1 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="flex-1 px-4 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors">
            {saving ? 'กำลังสร้าง...' : mode === 'personal' ? 'เพิ่มใน Calendar' : 'สร้าง Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
