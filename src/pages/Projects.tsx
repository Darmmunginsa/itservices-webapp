import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, FolderOpen, Plus } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Badge } from '../components/common/Badge'
import { Button } from '../components/common/Button'
import { SkeletonCard } from '../components/common/Skeleton'
import { Modal } from '../components/common/Modal'
import { spGet, spCreate } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import type { Project } from '../types/project'
import { getStatusColor } from '../utils/colorUtils'
import { formatDate } from '../utils/dateUtils'

export default function Projects() {
  const { user, addToast } = useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', company: '', startDate: '', endDate: '', description: '' })
  const [creating, setCreating] = useState(false)

  function fetchProjects() {
    setLoading(true)
    spGet<Project>('PM_Projects', undefined, undefined, 'Modified desc')
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchProjects() }, [])

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setCreating(true)
    try {
      await spCreate('PM_Projects', {
        Title: form.title,
        Company: form.company,
        Progress: 0,
        StartDate: form.startDate,
        EndDate: form.endDate,
        Status: 'Planning',
        CreatedByEmail: user.email,
        Description: form.description,
      })
      addToast('success', 'สร้างโครงการเรียบร้อย')
      setShowCreate(false)
      setForm({ title: '', company: '', startDate: '', endDate: '', description: '' })
      fetchProjects()
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด')
    } finally {
      setCreating(false)
    }
  }

  const filtered = projects.filter(p =>
    (!search || p.Title.toLowerCase().includes(search.toLowerCase()) || p.Company?.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || p.Status === statusFilter) &&
    (showAll || ['Admin', 'Boss', 'Supervisor'].includes(user?.role ?? '') || p.CreatedByEmail === user?.email)
  )

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
  const canCreate = ['Admin', 'Boss', 'Supervisor'].includes(user?.role ?? '')

  return (
    <div>
      <Header title="โครงการ" />
      <div className="p-4 md:p-6 space-y-4">

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="ค้นหาโครงการ..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
            <option value="">สถานะทั้งหมด</option>
            {['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
          </select>
          {['Admin', 'Boss', 'Supervisor'].includes(user?.role ?? '') && (
            <button onClick={() => setShowAll(s => !s)} className="text-xs text-primary-600 underline">
              {showAll ? 'ดูเฉพาะของฉัน' : 'ดูทั้งหมด'}
            </button>
          )}
          {canCreate && (
            <Button onClick={() => setShowCreate(true)} size="sm">
              <Plus size={14} /> สร้างโครงการ
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filtered.length === 0
              ? <div className="col-span-3 text-center py-16 text-gray-400"><FolderOpen size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm">ไม่มีโครงการ</p></div>
              : filtered.map(p => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-md">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">{p.Title}</h3>
                      <Badge className={getStatusColor(p.Status)}>{p.Status}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">{p.Company}</p>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>ความคืบหน้า</span>
                        <span>{p.Progress ?? 0}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                        <div className="bg-primary-600 h-1.5 rounded-full transition-all" style={{ width: `${p.Progress ?? 0}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{formatDate(p.StartDate)}</span>
                      <span>{formatDate(p.EndDate)}</span>
                    </div>
                  </Link>
                ))
          }
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="สร้างโครงการใหม่" size="md">
        <form onSubmit={createProject} className="space-y-4">
          <div><label className={labelClass}>ชื่อโครงการ *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} /></div>
          <div><label className={labelClass}>บริษัท/ลูกค้า</label><input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelClass}>วันเริ่มต้น</label><input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputClass} /></div>
            <div><label className={labelClass}>วันสิ้นสุด</label><input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={inputClass} /></div>
          </div>
          <div><label className={labelClass}>รายละเอียด</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputClass} rows={3} /></div>
          <Button type="submit" disabled={creating} className="w-full justify-center">{creating ? 'กำลังสร้าง...' : 'สร้างโครงการ'}</Button>
        </form>
      </Modal>
    </div>
  )
}
