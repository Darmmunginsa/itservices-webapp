import { useEffect, useState } from 'react'
import { Plus, Trash2, Users, Search, UserPlus } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { spGet, spCreate, spDelete } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { customersOf, availableContacts, type ProjectCustomer } from '../../utils/customerGroups'
import type { Contract } from '../../types/ticket'

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
  // เลือกจากทะเบียนลูกค้าที่มีอยู่แล้ว ดีกว่าให้พิมพ์อีเมลเอง — พิมพ์ผิดตัวเดียวก็ไม่ถึงคนรับ
  const [contacts, setContacts] = useState<Contract[]>([])
  const [picking, setPicking] = useState(false)
  const [pickQuery, setPickQuery] = useState('')
  const [picked, setPicked] = useState<string[]>([])

  // ไม่ตั้ง loading ตรงนี้ — ค่าเริ่มต้นเป็น true อยู่แล้ว และการ setState ตรง ๆ ใน effect
  // ทำให้ render ซ้อนกันโดยเปล่าประโยชน์
  function load() {
    spGet<ProjectCustomer>(LIST, `ProjectID eq ${projectId}`, '*', 'Title asc', 500)
      .then(r => { setRows(r); setMissing(false) })
      .catch(() => setMissing(true))
      .finally(() => setLoading(false))
  }
  useEffect(load, [projectId])

  useEffect(() => {
    spGet<Contract>('HD_Contracts', "Status ne 'Expired'", undefined, 'Title asc', 2000)
      .then(setContacts).catch(() => {})
  }, [])

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

  // คนที่ยังไม่ได้อยู่ในโครงการนี้เท่านั้น — โชว์คนที่เพิ่มไปแล้วให้กดซ้ำได้ก็หลอกตาเปล่า ๆ
  const pickable = availableContacts(contacts, members, pickQuery)

  async function addPicked() {
    if (picked.length === 0) return
    setSaving(true)
    let ok = 0
    let failed = 0
    for (const email of picked) {
      const c = contacts.find(x => (x.CustomerEmail ?? '').toLowerCase() === email.toLowerCase())
      try {
        await spCreate(LIST, {
          Title: c?.Title || email,
          CustomerEmail: email,
          Company: c?.Company || undefined,
          ProjectID: projectId,
        })
        ok++
      } catch { failed++ }
    }
    setPicked([])
    setPickQuery('')
    setPicking(false)
    setSaving(false)
    load()
    // บอกจำนวนที่พลาดด้วย ไม่งั้นคนคิดว่าเพิ่มครบแล้วทั้งที่ขาดไป
    if (failed) addToast('error', `เพิ่มได้ ${ok} คน · ไม่สำเร็จ ${failed} คน`)
    else addToast('success', `เพิ่ม ${ok} คนแล้ว`)
  }

  async function remove(m: ProjectCustomer) {
    if (!window.confirm(`เอา "${m.Title || m.CustomerEmail}" ออกจากกลุ่มลูกค้าของโครงการนี้?`)) return
    try {
      await spDelete(LIST, m.id)
      setRows(prev => prev.filter(r => r.id !== m.id))
      addToast('success', 'เอาออกแล้ว')
    } catch { addToast('error', 'เอาออกไม่สำเร็จ') }
  }

  const ic = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'

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

  return (
    <div className="space-y-3">
      {canEdit && !adding && !picking && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setPicking(true)}><UserPlus size={14} /> เลือกจากทะเบียนลูกค้า</Button>
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus size={14} /> พิมพ์เอง</Button>
        </div>
      )}

      {picking && (
        <Card>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={pickQuery} onChange={e => setPickQuery(e.target.value)}
              placeholder="ค้นหาชื่อ / อีเมล / บริษัท" className={ic + ' pl-8'} />
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              ยังไม่มีข้อมูลในทะเบียนลูกค้า — เพิ่มได้ที่หน้า "ลูกค้า / Contacts" หรือกด "พิมพ์เอง"
            </p>
          ) : pickable.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              {pickQuery ? 'ไม่พบลูกค้าที่ค้นหา' : 'ลูกค้าในทะเบียนถูกเพิ่มเข้าโครงการนี้ครบแล้ว'}
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto -mx-1">
              {pickable.map(c => {
                const email = c.CustomerEmail ?? ''
                const on = picked.includes(email)
                return (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                    <input type="checkbox" checked={on} className="rounded accent-primary-600 flex-shrink-0"
                      onChange={() => setPicked(prev => on ? prev.filter(e => e !== email) : [...prev, email])} />
                    <span className="min-w-0">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{c.Title}</span>
                      <span className="text-xs text-gray-400 ml-2">{email}{c.Company ? ` · ${c.Company}` : ''}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={addPicked} disabled={saving || picked.length === 0}>
              {saving ? 'กำลังเพิ่ม...' : `เพิ่ม ${picked.length} คน`}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setPicking(false); setPicked([]); setPickQuery('') }}>ยกเลิก</Button>
          </div>
        </Card>
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
