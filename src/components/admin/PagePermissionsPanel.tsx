import { useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Search, Save, RotateCcw, Plus, Copy, CheckCheck } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { spGet } from '../../services/sharepoint'
import { getAllPagePerms, savePagePerms, clearPagePerms, type PagePermRow } from '../../services/permissions'
import { PAGES } from '../../config/pages'
import { useAppStore } from '../../store/useAppStore'
import { useT } from '../../i18n/useT'
import { parseKeys, dirtyEmails, GROUP_LABEL, groupPages } from '../../utils/pagePerms'
import type { AgentProfile } from '../../types/common'

// ── Admin: กำหนดสิทธิ์เข้าถึงหน้า "รายคน" (HD_PagePermissions) ──
//
// เดิมเป็นตารางคน × หน้า (21 คอลัมน์) ต้องเลื่อนแนวนอนจนสุดถึงจะเห็นครบ
// และบันทึกได้ทีละคน แก้ 10 คนต้องกด 10 ครั้ง
//
// ตอนนี้: ซ้ายเลือกคน ขวาเห็นหน้าทั้งหมดจัดกลุ่มในจอเดียว ไม่มีแนวนอน
// แก้กี่คนก็ได้แล้วกด "บันทึกที่แก้ทั้งหมด" ครั้งเดียว · คัดลอกสิทธิ์จากคนอื่นได้
//
// ผู้ที่ยังไม่ถูกกำหนด = เข้าได้เฉพาะหน้าหลัก ; role Admin = เข้าได้ทุกหน้าเสมอ (กันล็อกตัวเอง)
const MANAGED = PAGES.filter(p => !p.always)
const GROUPED = groupPages(MANAGED)

interface UserRow { email: string; name: string; role?: string }

export function PagePermissionsPanel() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [users, setUsers] = useState<UserRow[]>([])
  const [perms, setPerms] = useState<Map<string, PagePermRow>>(new Map())
  const [draft, setDraft] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [selected, setSelected] = useState('')
  const [copyFrom, setCopyFrom] = useState('')

  // ตั้ง state ใน .then เท่านั้น — ไม่มี setState ตรง ๆ ระหว่าง effect
  function load() {
    Promise.all([
      spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText,Role', 'Title asc', 500).catch(() => [] as AgentProfile[]),
      getAllPagePerms().catch(() => [] as PagePermRow[]),
    ]).then(([profiles, rows]) => {
      const permMap = new Map<string, PagePermRow>()
      for (const r of rows) if (r.UserEmail) permMap.set(r.UserEmail.toLowerCase(), r)

      // รายชื่อ = คนใน AgentProfiles + คนที่มีแถวสิทธิ์อยู่แล้ว (เผื่อไม่มี profile)
      const byEmail = new Map<string, UserRow>()
      for (const p of profiles) {
        const em = (p.EmailText ?? '').toLowerCase()
        if (em) byEmail.set(em, { email: p.EmailText, name: p.Title, role: p.Role })
      }
      for (const [em, r] of permMap) if (!byEmail.has(em)) byEmail.set(em, { email: r.UserEmail, name: r.UserEmail })

      const list = [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name, 'th'))
      const d = new Map<string, Set<string>>()
      for (const u of list) d.set(u.email.toLowerCase(), new Set(parseKeys(permMap.get(u.email.toLowerCase())?.AllowedPages)))
      setUsers(list); setPerms(permMap); setDraft(d); setLoading(false)
      // เลือกคนแรกให้ ไม่ปล่อยฝั่งขวาว่าง
      setSelected(prev => (prev && list.some(u => u.email.toLowerCase() === prev) ? prev : (list[0]?.email.toLowerCase() ?? '')))
    })
  }
  useEffect(() => { load() }, [])

  const saved = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const [em, r] of perms) m.set(em, new Set(parseKeys(r.AllowedPages)))
    return m
  }, [perms])
  // คนที่แก้แล้วยังไม่บันทึก — โชว์จุดที่ชื่อ และเป็นชุดที่ "บันทึกทั้งหมด" จะเขียน
  const dirty = useMemo(() => dirtyEmails(draft, saved), [draft, saved])

  const filtered = useMemo(() =>
    users.filter(u => [u.name, u.email].some(s => (s ?? '').toLowerCase().includes(search.toLowerCase()))),
    [users, search])

  const cur = users.find(u => u.email.toLowerCase() === selected)
  const curSel = draft.get(selected) ?? new Set<string>()
  const curIsAdmin = cur?.role === 'Admin'

  function setKeys(email: string, keys: Set<string>) {
    setDraft(prev => new Map(prev).set(email.toLowerCase(), keys))
  }
  function toggle(key: string) {
    const s = new Set(curSel)
    if (s.has(key)) s.delete(key); else s.add(key)
    setKeys(selected, s)
  }
  function toggleGroup(keys: string[], on: boolean) {
    const s = new Set(curSel)
    for (const k of keys) { if (on) s.add(k); else s.delete(k) }
    setKeys(selected, s)
  }

  async function saveMany(emails: string[]) {
    if (!emails.length) return
    setSaving(true)
    let ok = 0, fail = 0
    // ทีละคนตามลำดับ — กัน SharePoint throttle เมื่อกดบันทึก 20 คนพร้อมกัน
    for (const em of emails) {
      const u = users.find(x => x.email.toLowerCase() === em)
      if (!u) continue
      try {
        await savePagePerms(u.email, [...(draft.get(em) ?? [])], perms.get(em)?.id)
        ok++
      } catch { fail++ }
    }
    setSaving(false)
    if (fail) addToast('error', `บันทึกได้ ${ok} คน ไม่สำเร็จ ${fail} คน — ลองใหม่อีกครั้ง`)
    else addToast('success', emails.length === 1 ? `บันทึกสิทธิ์ของ ${users.find(x => x.email.toLowerCase() === emails[0])?.name} แล้ว` : `บันทึกสิทธิ์ ${ok} คนแล้ว`)
    load()
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
    if (users.some(u => u.email.toLowerCase() === em)) { addToast('info', 'มีผู้ใช้นี้อยู่แล้ว'); setSelected(em); return }
    setUsers(prev => [...prev, { email: em, name: em }].sort((a, b) => a.name.localeCompare(b.name, 'th')))
    setDraft(prev => new Map(prev).set(em, new Set()))
    setSelected(em)
    setNewEmail('')
  }

  // คัดลอกสิทธิ์จากคนอื่นมาเป็นร่าง — ตั้งคนใหม่ให้เหมือนคนในทีมเดียวกันได้ทันที ไม่ต้องติ๊ก 21 ช่อง
  function copyPerms() {
    if (!copyFrom || copyFrom === selected) return
    setKeys(selected, new Set(draft.get(copyFrom) ?? []))
    setCopyFrom('')
  }

  // เฉพาะ Admin เท่านั้นที่แก้สิทธิ์คนอื่นได้
  if (user?.role !== 'Admin') return null

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <ShieldCheck size={18} className="text-primary-600" />
        <h2 className="text-sm font-semibold">สิทธิ์การเข้าถึงหน้า (รายคน)</h2>
        {/* บันทึกทุกคนที่แก้ — ปุ่มเดียว ไม่ต้องกดทีละคน */}
        <div className="ml-auto flex items-center gap-2">
          {dirty.length > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400">แก้แล้วยังไม่บันทึก {dirty.length} คน</span>
          )}
          <Button size="sm" onClick={() => saveMany(dirty)} disabled={saving || dirty.length === 0}>
            <CheckCheck size={14} /> {saving ? 'กำลังบันทึก…' : `บันทึกที่แก้ทั้งหมด${dirty.length ? ` (${dirty.length})` : ''}`}
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        เลือกคนทางซ้าย แล้วติ๊กหน้าที่ให้เข้าทางขวา · คนที่ยังไม่ถูกกำหนดเข้าได้เฉพาะหน้าหลัก ·
        role <b>Admin</b> เข้าได้ทุกหน้าเสมอ (ป้องกันล็อกตัวเองออกจากระบบ)
      </p>

      {loading ? (
        <p className="text-sm text-gray-400 py-6 text-center">{tr('comp.loading')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
          {/* ── ซ้าย: รายชื่อ ── */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / อีเมล"
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 w-full" />
            </div>
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-[28rem] overflow-y-auto">
              {filtered.map(u => {
                const em = u.email.toLowerCase()
                const isDirty = dirty.includes(em)
                const isAdminUser = u.role === 'Admin'
                const count = (draft.get(em) ?? new Set()).size
                return (
                  <button key={em} onClick={() => setSelected(em)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors ${
                      selected === em ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                    <div className="flex items-center gap-1.5">
                      {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="แก้แล้วยังไม่บันทึก" />}
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{u.name}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                    <p className="text-[10px] mt-0.5">
                      {isAdminUser
                        ? <span className="text-violet-600 dark:text-violet-300">Admin — ทุกหน้า</span>
                        : !perms.has(em)
                          ? <span className="text-amber-600 dark:text-amber-400">ยังไม่กำหนด</span>
                          : <span className="text-gray-400">เข้าได้ {count}/{MANAGED.length} หน้า</span>}
                    </p>
                  </button>
                )
              })}
              {filtered.length === 0 && <p className="text-center text-xs text-gray-400 py-6">ไม่พบผู้ใช้</p>}
            </div>
            <div className="flex gap-1">
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUser() } }}
                placeholder="เพิ่มผู้ใช้ด้วยอีเมล..."
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 min-w-0" />
              <Button size="sm" variant="secondary" onClick={addUser}><Plus size={14} /></Button>
            </div>
          </div>

          {/* ── ขวา: หน้าของคนที่เลือก จัดกลุ่ม ไม่มีเลื่อนแนวนอน ── */}
          {!cur ? (
            <p className="text-sm text-gray-400 py-10 text-center">เลือกผู้ใช้ทางซ้าย</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{cur.name}</p>
                  <p className="text-xs text-gray-400 truncate">{cur.email}</p>
                </div>
                {!curIsAdmin && (
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    <button onClick={() => setKeys(selected, new Set(MANAGED.map(p => p.key)))}
                      className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400">ทั้งหมด</button>
                    <button onClick={() => setKeys(selected, new Set())}
                      className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400">ล้าง</button>
                    <select value={copyFrom} onChange={e => setCopyFrom(e.target.value)}
                      className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 max-w-44">
                      <option value="">คัดลอกสิทธิ์จาก…</option>
                      {users.filter(u => u.email.toLowerCase() !== selected && u.role !== 'Admin').map(u => (
                        <option key={u.email} value={u.email.toLowerCase()}>{u.name}</option>
                      ))}
                    </select>
                    <button onClick={copyPerms} disabled={!copyFrom} title="คัดลอก"
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-600 disabled:opacity-40"><Copy size={13} /></button>
                    <Button size="sm" onClick={() => saveMany([selected])} disabled={saving || !dirty.includes(selected)}>
                      <Save size={14} /> บันทึกคนนี้
                    </Button>
                    {perms.has(selected) && (
                      <button onClick={() => reset(cur)} title="ล้างสิทธิ์ (กลับเป็นยังไม่กำหนด)"
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500"><RotateCcw size={14} /></button>
                    )}
                  </div>
                )}
              </div>

              {curIsAdmin ? (
                <p className="text-sm text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 rounded-lg px-3 py-2">
                  role Admin เข้าได้ทุกหน้าเสมอ — ไม่ต้องกำหนด และกำหนดไม่ได้ (กันล็อกตัวเองออก)
                </p>
              ) : (
                GROUPED.map(g => {
                  const keys = g.pages.map(p => p.key)
                  const on = keys.filter(k => curSel.has(k)).length
                  return (
                    <div key={g.group} className="border border-gray-200 dark:border-gray-800 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{GROUP_LABEL[g.group]}</p>
                        <span className="text-[10px] text-gray-400">{on}/{keys.length}</span>
                        <button onClick={() => toggleGroup(keys, on < keys.length)}
                          className="ml-auto text-[10px] text-primary-600 hover:underline">
                          {on < keys.length ? 'เลือกทั้งกลุ่ม' : 'ล้างกลุ่ม'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {g.pages.map(p => (
                          <label key={p.key} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer text-xs select-none ${
                            curSel.has(p.key)
                              ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-800 text-gray-800 dark:text-gray-100'
                              : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300'}`}>
                            <input type="checkbox" checked={curSel.has(p.key)} onChange={() => toggle(p.key)}
                              className="w-3.5 h-3.5 accent-primary-600" />
                            <span className="truncate">{tr(p.labelKey)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
