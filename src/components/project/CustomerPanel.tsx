import { useEffect, useState } from 'react'
import { Plus, Trash2, Users } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { spGet, spCreate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { customersOf, type ProjectCustomer } from '../../utils/customerGroups'

const LIST = 'PM_ProjectCustomers'

interface Props {
  projectId: number
  projectTitle: string
  canEdit: boolean
}

/**
 * ผู้ติดต่อฝั่งลูกค้าของโครงการ
 *
 * ตั้งไว้ที่นี่ครั้งเดียว แล้วตอนสร้าง Ticket/Task เลือกเป็นกลุ่มได้ทั้งชุด
 * ไม่ต้องไล่ติ๊กทีละคนทุกครั้ง ซึ่งเป็นจังหวะที่คนตกหล่นบ่อยที่สุด
 */
export function CustomerPanel({ projectId, projectTitle, canEdit }: Props) {
  const { addToast } = useAppStore()
  const [rows, setRows] = useState<ProjectCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', company: '' })
  const [saving, setSaving] = useState(false)

  // ไม่ตั้ง loading ตรงนี้ — ค่าเริ่มต้นเป็น true อยู่แล้ว และการ setState ตรง ๆ ใน effect
  // ทำให้ render ซ้อนกันโดยเปล่าประโยชน์
  function load() {
    spGet<ProjectCustomer>(LIST, `ProjectID eq ${projectId}`, '*', 'Title asc', 500)
      .then(r => { setRows(r); setMissing(false) })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [projectId])

  const members = customersOf(rows, projectId)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const email = form.email.trim()
    if (!email) return
    // เชิญคนเดิมซ้ำในกลุ่มไม่มีประโยชน์ และทำให้จำนวนในกลุ่มหลอกตา
    if (members.some(m => (m.CustomerEmail ?? '').toLowerCase() === email.toLowerCase())) {
      addToast('info', 'อีเมลนี้อยู่ในโครงการแล้ว')
      return
    }
    setSaving(true)
    try {
      await spCreate(LIST, {
        Title: form.name.trim() || email,
        CustomerEmail: email,
        Company: form.company.trim() || undefined,
        ProjectID: projectId,
      })
      setForm({ name: '', email: '', company: '' })
      setAdding(false)
      load()
      addToast('success', 'เพิ่มผู้ติดต่อแล้ว')
    } catch { addToast('error', 'เพิ่มไม่สำเร็จ') } finally { setSaving(false) }
  }

  async function remove(m: ProjectCustomer) {
    if (!window.confirm(`เอา "${m.Title || m.CustomerEmail}" ออกจากกลุ่มลูกค้าของโครงการนี้?`)) return
    try {
      await spDelete(LIST, m.id)
      setRows(prev => prev.filter(r => r.id !== m.id))
      addToast('success', 'เอาออกแล้ว')
    } catch { addToast('error', 'เอาออกไม่สำเร็จ') }
  }

  if (missing) {
    return (
      <Card>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          ยังไม่ได้สร้างลิสต์ <code className="text-xs">PM_ProjectCustomers</code> ใน SharePoint —
          ดูขั้นตอนใน <code className="text-xs">docs/Customer-Groups.md</code>
        </p>
      </Card>
    )
  }

  const ic = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="space-y-3">
      {canEdit && !adding && (
        <Button size="sm" onClick={() => setAdding(true)}><Plus size={14} /> เพิ่มผู้ติดต่อ</Button>
      )}

      {adding && (
        <Card>
          <form onSubmit={add} className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ชื่อผู้ติดต่อ" className={ic} />
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="อีเมล *" className={ic} />
              <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                placeholder="บริษัท" className={ic} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'เพิ่ม'}</Button>
              <Button size="sm" variant="secondary" type="button" onClick={() => setAdding(false)}>ยกเลิก</Button>
            </div>
          </form>
        </Card>
      )}

      {members.length > 0 && (
        <p className="text-xs text-gray-400">
          <Users size={12} className="inline mr-1" />
          ตอนสร้าง Ticket / Task เลือก <span className="font-medium">{projectTitle}</span> ในช่อง
          "ผู้เข้าร่วม ลูกค้า" ได้ทีเดียวครบ {members.length} คน
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-6 text-center">กำลังโหลด...</p>
      ) : members.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-10">
          ยังไม่มีผู้ติดต่อฝั่งลูกค้าในโครงการนี้
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map(m => (
            <Card key={m.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{m.Title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.CustomerEmail}</p>
                {m.Company && <p className="text-xs text-gray-400 truncate">{m.Company}</p>}
              </div>
              {canEdit && (
                <button type="button" onClick={() => remove(m)} title="เอาออกจากกลุ่ม"
                  className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
