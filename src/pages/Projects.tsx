import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, FolderOpen, Plus } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { useT } from '../i18n/useT'
import { Button } from '../components/common/Button'
import { SkeletonCard } from '../components/common/Skeleton'
import { Modal } from '../components/common/Modal'
import { OptionSelect } from '../components/common/OptionSelect'
import { spGet, spCreate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Project, ProjectStatus } from '../types/project'
import { formatDate } from '../utils/dateUtils'

const PROJECT_GROUPS = ['Internal', 'External', 'R&D', 'Maintenance', 'อื่นๆ']
const PROJECT_STATUSES: ProjectStatus[] = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']
const ACTIVE_STATUSES: ProjectStatus[] = ['Planning', 'Active', 'On Hold']

const EMPTY_FORM = {
  title: '', company: '', projectGroup: 'Internal',
  status: 'Planning', startDate: '', endDate: '', daysCount: '',
  progress: '0', comment: '', description: '',
}

// Status column config
const STATUS_COLUMNS: { status: ProjectStatus; color: string; dot: string }[] = [
  { status: 'Planning',  color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',    dot: 'bg-gray-400' },
  { status: 'Active',    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
  { status: 'On Hold',   color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', dot: 'bg-yellow-500' },
  { status: 'Completed', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',  dot: 'bg-blue-500' },
  { status: 'Cancelled', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',      dot: 'bg-red-400' },
]

export default function Projects() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [creating, setCreating] = useState(false)
  // สรุปบอร์ด (จาก ClientBoard ผ่าน PM_BoardSummary) — key = ProjectRef
  const [boards, setBoards] = useState<Record<number, { progress: number; openCards: number; boardUrl?: string }>>({})

  function fetchProjects() {
    setLoading(true)
    spGet<Project>('PM_Projects', undefined, undefined, 'Modified desc')
      .then(setProjects).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProjects()
    spGet<{ ProjectRef?: number; Progress?: number; OpenCards?: number; BoardUrl?: string }>(
      'PM_BoardSummary', undefined, 'Id,ProjectRef,Progress,OpenCards,BoardUrl', undefined, 500)
      .then(rows => {
        const m: Record<number, { progress: number; openCards: number; boardUrl?: string }> = {}
        for (const r of rows) if (r.ProjectRef != null) m[r.ProjectRef] = { progress: r.Progress ?? 0, openCards: r.OpenCards ?? 0, boardUrl: r.BoardUrl }
        setBoards(m)
      }).catch(() => {})
  }, [])

  const set = (key: keyof typeof EMPTY_FORM, val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  const computedEndDate = () => {
    if (form.daysCount && Number(form.daysCount) > 0 && form.startDate) {
      const d = new Date(form.startDate)
      d.setDate(d.getDate() + Number(form.daysCount))
      return d.toISOString().slice(0, 10)
    }
    return form.endDate || undefined
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setCreating(true)
    try {
      await spCreate('PM_Projects', {
        Title: form.title,
        Company: form.company,
        ProjectGroup: form.projectGroup,
        Progress: Number(form.progress),
        StartDate: form.startDate || undefined,
        EndDate: computedEndDate() ?? null,
        Status: form.status,
        CreatedByEmail: user.email,
        Comment: form.comment || undefined,
      })
      addToast('success', 'สร้างโครงการเรียบร้อย')
      setShowCreate(false)
      setForm({ ...EMPTY_FORM })
      fetchProjects()
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด')
    } finally {
      setCreating(false)
    }
  }

  const baseFiltered = projects.filter(p =>
    (!search || p.Title.toLowerCase().includes(search.toLowerCase()) || p.Company?.toLowerCase().includes(search.toLowerCase())) &&
    (!groupFilter || p.ProjectGroup === groupFilter)
  )

  const columns = STATUS_COLUMNS
    .filter(col => showCompleted || ACTIVE_STATUSES.includes(col.status))
    .map(col => ({
      ...col,
      items: baseFiltered.filter(p => p.Status === col.status),
    }))

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const canCreate = ['Admin', 'Boss', 'Supervisor'].includes(user?.role ?? '')

  const totalActive = baseFiltered.filter(p => ACTIVE_STATUSES.includes(p.Status)).length
  const totalDone = baseFiltered.filter(p => !ACTIVE_STATUSES.includes(p.Status)).length

  return (
    <div>
      <Header title={tr('projects.header')} />
      <div className="p-4 md:p-6 space-y-4">

        {/* Filters row */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder={tr('projects.search')} value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">{tr('projects.allGroups')}</option>
            {PROJECT_GROUPS.map(g => <option key={g}>{g}</option>)}
          </select>
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="text-xs text-primary-600 underline whitespace-nowrap"
          >
            {showCompleted ? `ซ่อน Completed/Cancelled` : `ดูทั้งหมด (+${totalDone} รายการ)`}
          </button>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus size={14} /> สร้างโครงการ
            </Button>
          )}
        </div>

        {/* Kanban columns */}
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {ACTIVE_STATUSES.map(s => (
              <div key={s} className="flex-shrink-0 w-72 space-y-3">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
                {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
            {columns.map(col => (
              <div key={col.status} className="flex-shrink-0 w-72">
                {/* Column header */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{col.status}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${col.color}`}>{col.items.length}</span>
                </div>

                {/* Project cards */}
                <div className="space-y-3 min-h-[120px]">
                  {col.items.length === 0
                    ? (
                      <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
                        <FolderOpen size={20} className="mx-auto mb-1 text-gray-300 dark:text-gray-600" />
                        <p className="text-xs text-gray-400">{tr('projects.none')}</p>
                      </div>
                    )
                    : col.items.map(p => (
                        <Link key={p.id} to={`/projects/${p.id}`}
                          className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-md group">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 flex-1 group-hover:text-primary-600 transition-colors">
                              {p.Title}
                            </h3>
                          </div>
                          {p.Company && <p className="text-xs text-gray-400 mb-1 truncate">{p.Company}</p>}
                          {p.ProjectGroup && (
                            <span className="inline-block text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded mb-2">
                              {p.ProjectGroup}
                            </span>
                          )}
                          {/* Progress bar */}
                          <div className="mb-2">
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                              <span>{tr('projects.progress')}</span>
                              <span className="font-medium">{p.Progress ?? 0}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                              <div className="bg-primary-600 h-1.5 rounded-full transition-all" style={{ width: `${p.Progress ?? 0}%` }} />
                            </div>
                          </div>
                          {boards[p.id] && (
                            <div className="flex items-center gap-1 mb-2 text-xs">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                                🗂 {tr('board.label')} {boards[p.id].progress}%
                                {boards[p.id].openCards > 0 && <span>· {tr('board.open')} {boards[p.id].openCards}</span>}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>{formatDate(p.StartDate)}</span>
                            <span>{formatDate(p.EndDate)}</span>
                          </div>
                        </Link>
                      ))
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400">{totalActive} โครงการที่ดำเนินการ{showCompleted ? ` · ${totalDone} เสร็จ/ยกเลิก` : ''}</p>
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={tr('projects.create')} size="md">
        <form onSubmit={createProject} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className={labelClass}>{tr('projects.name')} *</label>
            <input required value={form.title} onChange={e => set('title', e.target.value)} className={inputClass} placeholder={tr('projects.namePlaceholder')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{tr('projects.company')}</label>
              <OptionSelect category="ProjectCompany" defaults={[]} value={form.company} onChange={v => set('company', v)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{tr('projects.group')}</label>
              <OptionSelect category="ProjectGroup" defaults={[...PROJECT_GROUPS]} value={form.projectGroup} onChange={v => set('projectGroup', v)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{tr('projects.startStatus')}</label>
              <OptionSelect category="ProjectStatus" defaults={[...PROJECT_STATUSES]} value={form.status} onChange={v => set('status', v)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{tr('projects.progressPct')}</label>
              <div className="flex items-center gap-2">
                <input type="range" min="0" max="100" value={form.progress}
                  onChange={e => set('progress', e.target.value)}
                  className="flex-1 accent-primary-600" />
                <span className="text-sm font-medium w-8 text-right">{form.progress}</span>
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>{tr('projects.startDate')}</label>
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{tr('projects.endDate')}</label>
              <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
                disabled={!!form.daysCount} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{tr('projects.daysFromStart')}</label>
              <input type="number" min="1" placeholder={tr('projects.daysEg')} value={form.daysCount}
                onChange={e => set('daysCount', e.target.value)} className={inputClass} />
            </div>
          </div>
          {form.daysCount && Number(form.daysCount) > 0 && form.startDate && (
            <p className="text-xs text-primary-600">📅 End date: {computedEndDate()}</p>
          )}
          <div>
            <label className={labelClass}>{tr('projects.descNote')}</label>
            <textarea value={form.comment} onChange={e => set('comment', e.target.value)} className={inputClass} rows={3} placeholder={tr('projects.descPlaceholder')} />
          </div>
          <Button type="submit" disabled={creating} className="w-full justify-center">{creating ? 'กำลังสร้าง...' : 'สร้างโครงการ'}</Button>
        </form>
      </Modal>
    </div>
  )
}
