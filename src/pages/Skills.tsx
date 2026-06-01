import { useEffect, useState } from 'react'
import { ExternalLink, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { Modal } from '../components/common/Modal'
import { SkeletonCard } from '../components/common/Skeleton'
import { AttachmentSection } from '../components/common/AttachmentSection'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Skill } from '../types/asset'
import { formatDate } from '../utils/dateUtils'

const EMPTY_FORM = {
  title: '', level: 'Beginner', status: 'Learning',
  startDate: '', endDate: '', courseLink: '', note: '',
}

function resolveUrl(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'object') return (raw as { Url?: string }).Url ?? ''
  return raw as string
}

export default function Skills() {
  const { user, addToast } = useAppStore()
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Skill | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [attachKey, setAttachKey] = useState<number | null>(null)

  function load() {
    if (!user) return
    setLoading(true)
    spGet<Skill>('HD_Skills', `LearnerEmail eq '${user.email}'`, undefined, 'Title asc')
      .then(setSkills).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [user])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(skill: Skill) {
    setEditing(skill)
    setForm({
      title: skill.Title,
      level: skill.Level,
      status: skill.Status,
      startDate: skill.StartDate ?? '',
      endDate: skill.EndDate ?? '',
      courseLink: resolveUrl(skill.CourseLink),
      note: skill.Note ?? '',
    })
    setShowModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    // Map form keys → SP column names (PascalCase)
    const payload = {
      Title: form.title,
      Level: form.level,
      Status: form.status,
      StartDate: form.startDate || undefined,
      EndDate: form.endDate || undefined,
      CourseLink: form.courseLink ? { Url: form.courseLink, Description: form.courseLink } : undefined,
      Note: form.note || undefined,
    }
    try {
      if (editing) {
        await spUpdate('HD_Skills', editing.id, payload)
        addToast('success', 'อัปเดต Skill แล้ว')
      } else {
        await spCreate('HD_Skills', {
          ...payload,
          Learner: user.displayName,
          LearnerEmail: user.email,
        })
        addToast('success', 'เพิ่ม Skill แล้ว')
      }
      setShowModal(false)
      load()
    } catch { addToast('error', 'เกิดข้อผิดพลาด') } finally { setSaving(false) }
  }

  async function deleteSkill(id: number) {
    if (!window.confirm('ลบ Skill นี้?')) return
    try {
      await spDelete('HD_Skills', id)
      setSkills(prev => prev.filter(s => s.id !== id))
      addToast('success', 'ลบ Skill แล้ว')
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
  }

  const filtered = skills.filter(s =>
    (!levelFilter || s.Level === levelFilter) &&
    (!statusFilter || s.Status === statusFilter)
  )

  const levelColors: Record<string, string> = {
    Beginner:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    Intermediate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Advanced:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Expert:       'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }
  const statusColors: Record<string, string> = {
    Learning:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Planned:   'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  }
  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const set = (key: keyof typeof EMPTY_FORM, val: string) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div>
      <Header title="ทักษะของฉัน" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">Level ทั้งหมด</option>
            {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map(l => <option key={l}>{l}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">สถานะทั้งหมด</option>
            {['Learning', 'Completed', 'Planned'].map(s => <option key={s}>{s}</option>)}
          </select>
          <Button size="sm" onClick={openCreate}><Plus size={14} /> เพิ่ม Skill</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.length === 0
              ? <div className="col-span-3 text-center py-12 text-gray-400 text-sm">ไม่มี Skill</div>
              : filtered.map(skill => (
                  <div key={skill.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1">{skill.Title}</h3>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setAttachKey(prev => prev === skill.id ? null : skill.id)}
                          title="Certificate / ไฟล์แนบ"
                          className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${attachKey === skill.id ? 'text-primary-600' : 'text-gray-400'}`}>
                          <Paperclip size={13} />
                        </button>
                        <button onClick={() => openEdit(skill)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => deleteSkill(skill.id)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <Badge className={levelColors[skill.Level]}>{skill.Level}</Badge>
                      <Badge className={statusColors[skill.Status]}>{skill.Status}</Badge>
                    </div>
                    {(skill.StartDate || skill.EndDate) && (
                      <p className="text-xs text-gray-400 mb-1">
                        {skill.StartDate ? formatDate(skill.StartDate) : '?'} → {skill.EndDate ? formatDate(skill.EndDate) : 'ต่อเนื่อง'}
                      </p>
                    )}
                    {skill.Note && <p className="text-xs text-gray-500 italic mb-2">{skill.Note}</p>}
                    {resolveUrl(skill.CourseLink) && (
                      <a href={resolveUrl(skill.CourseLink)} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1 mb-2">
                        <ExternalLink size={10} /> Course Link
                      </a>
                    )}
                    {attachKey === skill.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <AttachmentSection listName="HD_Skills" itemId={skill.id} />
                      </div>
                    )}
                  </div>
                ))
          }
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'แก้ไข Skill' : 'เพิ่ม Skill'}>
        <form onSubmit={save} className="space-y-4">
          <div><label className={labelClass}>ชื่อ Skill *</label>
            <input required value={form.title} onChange={e => set('title', e.target.value)} className={inputClass} placeholder="เช่น React, Python, Azure..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>Level</label>
              <select value={form.level} onChange={e => set('level', e.target.value)} className={inputClass}>
                {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div><label className={labelClass}>สถานะ</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inputClass}>
                {['Learning', 'Completed', 'Planned'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>วันที่เริ่ม</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputClass} />
            </div>
            <div><label className={labelClass}>วันที่เสร็จ</label>
              <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inputClass} />
            </div>
          </div>
          <div><label className={labelClass}>Course Link (URL)</label>
            <input type="url" value={form.courseLink} onChange={e => set('courseLink', e.target.value)} className={inputClass} placeholder="https://..." />
          </div>
          <div><label className={labelClass}>หมายเหตุ</label>
            <textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2} className={inputClass} placeholder="บันทึกเพิ่มเติม..." />
          </div>
          <Button type="submit" disabled={saving} className="w-full justify-center">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </form>
      </Modal>
    </div>
  )
}
