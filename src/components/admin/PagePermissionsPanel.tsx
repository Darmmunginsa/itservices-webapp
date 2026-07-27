import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Search, Save, RotateCcw, Plus } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { spGet } from '../../services/sharepoint'
import { getAllPagePerms, savePagePerms, clearPagePerms, type PagePermRow } from '../../services/permissions'
import { PAGES } from '../../config/pages'
import { useAppStore } from '../../store/useAppStore'
import { useT } from '../../i18n/useT'
import type { AgentProfile } from '../../types/common'

// ── Admin: กำหนดสิทธิ์เข้าถึงหน้า "รายคน" (HD_PagePermissions) ──
// ผู้ที่ยังไม่ถูกกำหนด = เข้าได้เฉพาะหน้าหลัก ; role Admin = เข้าได้ทุกหน้าเสมอ (กันล็อกตัวเอง)
const MANAGED = PAGES.filter(p => !p.always)   // หน้าหลักเข้าได้เสมอ ไม่ต้องกำหนด

interface UserRow { email: string; name: string; role?: string }

export function PagePermissionsPanel() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [users, setUsers] = useState<UserRow[]>([])
  const [perms, setPerms] = useState<Map<string, PagePermRow>>(new Map())
  const [draft, setDraft] = useState<Map<string, Set<string>>>(new Map())  // email → page keys
  const [loading, setLoading] = useState(true)
  const [savingEmail, setSavingEmail] = useState('')
  const [search, setSearch] = useState('')
  const [newEmail, setNewEmail] = useState('')

  async function load() {
    setLoading(true)
    const [profiles, rows] = await Promise.all([
      spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText,Role', 'Title asc', 500).catch(() => []),
      getAllPagePerms().catch(() => [] as PagePermRow[]),
    ])
    const permMap = new Map<string, PagePermRow>()
    for (const r of rows) if (r.UserEmail) permMap.set(r.UserEmail.toLowerCase(), r)

    // รายชื่อ = คนใน AgentProfiles + คนที่มีแถวสิทธิ์อยู่แล้ว (เผื่อไม่มี profile)
    const byEmail = new Map<string, UserRow>()
    for (const p of profiles) {
      const em = (p.EmailText ?? '').toLowerCase()
      if (em) byEmail.set(em, { email: p.EmailText, name: p.Title, role: p.Role })
    }
    for (const [em, r] of permMap) if (!byEmail.has(em)) byEmail.set(em, { email: r.UserEmail, name: r.UserEmail })

    const list = [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name))
    const d = new Map<string, Set<string>>()
    for (const u of list) {
      const row = permMap.get(u.email.toLowerCase())
      d.set(u.email.toLowerCase(), new Set((row?.AllowedPages ?? '').split(',').map(s => s.trim()).filter(Boolean)))
    }
    setUsers(list); setPerms(permMap); setDraft(d); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() =>
    users.filter(u => [u.name, u.email].some(s => (s ?? '').toLowerCase().includes(search.toLowerCase()))),
    [users, search])

  function toggle(email: string, key: string) {
    setDraft(prev => {
      const next = new Map(prev)
      const s = new Set(next.get(email.toLowerCase()) ?? [])
      s.has(key) ? s.delete(key) : s.add(key)
      next.set(email.toLowerCase(), s)
      return next
    })
  }

  function setAll(email: string, on: boolean) {
    setDraft(prev => {
      const next = new Map(prev)
      next.set(email.toLowerCase(), new Set(on ? MANAGED.map(p => p.key) : []))
      return next
    })
  }

  async function save(u: UserRow) {
    setSavingEmail(u.email)
    try {
      const keys = [...(draft.get(u.email.toLowerCase()) ?? [])]
      const existing = perms.get(u.email.toLowerCase())
      await savePagePerms(u.email, keys, existing?.id)
      addToast('success', `บันทึกสิทธิ์ของ ${u.name} แล้ว`)
      load()
    } catch { addToast('error', tr('common.error')) } finally { setSavingEmail('') }
  }

  async function reset(u: UserRow) {
    const existing = perms.get(u.email.toLowerCase())
    if (!existing) return
    if (!window.confirm(`ล้างสิทธิ์ของ ${u.name}? (จะกลับไปเป็น "ยังไม่ถูกกำหนด" = เข้าได้เฉพาะหน้าหลัก)`)) return
    try { await clearPagePerms(existing.id); addToast('success', 'ล้างสิทธิ์แล้ว'); load() }
    catch { addToast('error', tr('common.error')) }
  }

  function addUser() {
    const em = newEmail.trim().toLowerCase()
    if (!em || !em.includes('@')) { addToast('error', 'กรุณาใส่อีเมลให้ถูกต้อง'); return }
    if (users.some(u => u.email.toLowerCase() === em)) { addToast('info', 'มีผู้ใช้นี้อยู่แล้ว'); return }
    setUsers(prev => [...prev, { email: em, name: em }].sort((a, b) => a.name.localeCompare(b.name)))
    setDraft(prev => new Map(prev).set(em, new Set()))
    setNewEmail('')
  }

  // เฉพาะ Admin เท่านั้นที่แก้สิทธิ์คนอื่นได้
  if (user?.role !== 'Admin') return null

  return (
    <Card>
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck size={18} className="text-primary-600" />
        <h2 className="text-sm font-semibold">สิทธิ์การเข้าถึงหน้า (รายคน)</h2>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        ติ๊กเพื่อกำหนดว่าผู้ใช้แต่ละคนเห็นหน้าไหนได้บ้าง · คนที่ยังไม่ถูกกำหนดจะเข้าได้เฉพาะหน้าหลัก ·
        ผู้ใช้ role <b>Admin</b> เข้าได้ทุกหน้าเสมอ (ป้องกันล็อกตัวเองออกจากระบบ)
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / อีเมล"
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
        </div>
        <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUser() } }}
          placeholder="เพิ่มผู้ใช้ด้วยอีเมล..."
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-56" />
        <Button size="sm" variant="secondary" onClick={addUser}><Plus size={14} /> เพิ่ม</Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-6 text-center">{tr('comp.loading')}</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl">
          <table className="text-xs min-w-max">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 text-left px-3 py-2 font-semibold border-r border-gray-200 dark:border-gray-800 min-w-52">ผู้ใช้</th>
                {MANAGED.map(p => (
                  <th key={p.key} className="px-2 py-2 font-medium text-gray-500 whitespace-nowrap">{tr(p.labelKey)}</th>
                ))}
                <th className="px-3 py-2 font-semibold whitespace-nowrap border-l border-gray-200 dark:border-gray-800">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const em = u.email.toLowerCase()
                const sel = draft.get(em) ?? new Set<string>()
                const row = perms.get(em)
                const isAdminUser = u.role === 'Admin'
                return (
                  <tr key={em} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-950 px-3 py-2 border-r border-gray-200 dark:border-gray-800">
                      <p className="font-medium text-gray-800 dark:text-gray-100 truncate max-w-48">{u.name}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-48">{u.email}</p>
                      {isAdminUser
                        ? <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Admin — เข้าได้ทุกหน้า</span>
                        : !row && <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">ยังไม่กำหนด</span>}
                    </td>
                    {MANAGED.map(p => (
                      <td key={p.key} className="text-center px-2 py-2">
                        <input type="checkbox" disabled={isAdminUser}
                          checked={isAdminUser || sel.has(p.key)}
                          onChange={() => toggle(u.email, p.key)}
                          className="w-4 h-4 accent-primary-600 disabled:opacity-40" />
                      </td>
                    ))}
                    <td className="px-3 py-2 border-l border-gray-200 dark:border-gray-800 whitespace-nowrap">
                      {!isAdminUser && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setAll(u.email, true)} title="เลือกทั้งหมด"
                            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-600">ทั้งหมด</button>
                          <button onClick={() => setAll(u.email, false)} title="ล้างการเลือก"
                            className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-600">ล้าง</button>
                          <button onClick={() => save(u)} disabled={savingEmail === u.email} title="บันทึก"
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-primary-600 disabled:opacity-40"><Save size={13} /></button>
                          {row && (
                            <button onClick={() => reset(u)} title="ล้างสิทธิ์ (กลับเป็นยังไม่กำหนด)"
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500"><RotateCcw size={13} /></button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={MANAGED.length + 2} className="text-center text-gray-400 py-6">ไม่พบผู้ใช้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
