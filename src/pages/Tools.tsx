import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, Notebook, Pin } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { OptionSelect } from '../components/common/OptionSelect'
import { Modal } from '../components/common/Modal'
import { SkeletonCard } from '../components/common/Skeleton'
import { spGet, spCreate, spUpdate, spDelete } from '../services/sharepoint'
import { useAppStore } from '../store/useAppStore'
import { formatDate } from '../utils/dateUtils'
import type { FocusItem } from '../types/common'
import { useT } from '../i18n/useT'

interface ToolNote {
  id: number
  Title: string
  NoteContent: string
  Category?: string
  CreatedByEmail: string
  Modified: string
  Created: string
}

const EMPTY_FORM = { title: '', category: '', noteContent: '' }

const CATEGORY_COLORS: Record<string, string> = {
  'งานทั่วไป':   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'เทคนิค':      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'ลูกค้า':      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'อื่นๆ':       'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}
const CATEGORIES = Object.keys(CATEGORY_COLORS)

function categoryColor(cat?: string) {
  return cat ? (CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['อื่นๆ']) : CATEGORY_COLORS['อื่นๆ']
}

export default function Tools() {
  const { user, addToast } = useAppStore()
  const tr = useT()
  const [notes, setNotes] = useState<ToolNote[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('ทั้งหมด')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ToolNote | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const [viewing, setViewing] = useState<ToolNote | null>(null)
  const [focusNotes, setFocusNotes] = useState<FocusItem[]>([])
  const [pinBusy, setPinBusy] = useState<number | null>(null)

  async function load() {
    if (!user) return
    setLoading(true)
    try {
      const data = await spGet<ToolNote>(
        'IT_Tools',
        `CreatedByEmail eq '${user.email}'`,
        undefined,
        'Modified desc',
      )
      setNotes(data)
    } catch {
      addToast('error', 'โหลดข้อมูล Tools ไม่ได้')
    } finally {
      setLoading(false)
    }
  }

  async function loadFocus() {
    if (!user) return
    try {
      const f = await spGet<FocusItem>('HD_Focus', `FocusedEmail eq '${user.email}' and FocusType eq 'Note'`)
      setFocusNotes(f)
    } catch { /* ignore */ }
  }

  useEffect(() => { load(); loadFocus() }, [user])

  // เปิด note อัตโนมัติเมื่อมาจากลิงก์ Focus (/tools?note=<id>)
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const noteId = searchParams.get('note')
    if (!noteId || notes.length === 0) return
    const target = notes.find(n => String(n.id) === noteId)
    if (target) {
      setViewing(target)
      searchParams.delete('note')
      setSearchParams(searchParams, { replace: true })
    }
  }, [notes, searchParams, setSearchParams])

  // set ของ note id ที่ pin แล้ว (RefID เก็บเป็น string)
  const pinnedSet = new Set(focusNotes.map(f => String(f.RefID)))

  async function togglePin(note: ToolNote, e: React.MouseEvent) {
    e.stopPropagation()
    if (!user) return
    setPinBusy(note.id)
    try {
      const existing = focusNotes.find(f => String(f.RefID) === String(note.id))
      if (existing) {
        await spDelete('HD_Focus', existing.id)
        setFocusNotes(prev => prev.filter(f => f.id !== existing.id))
        addToast('success', 'เอาออกจาก Focus แล้ว')
      } else {
        const res = await spCreate('HD_Focus', {
          Title: note.Title,
          RefID: String(note.id),
          FocusType: 'Note',
          FocusedBy: user.displayName,
          FocusedEmail: user.email,
          Status: 'Note',
        })
        setFocusNotes(prev => [...prev, {
          id: res.id, Title: note.Title, RefID: String(note.id),
          FocusType: 'Note', FocusedBy: user.displayName, FocusedEmail: user.email, Status: 'Note',
        }])
        addToast('success', 'Pin ไว้ที่ Focus แล้ว')
      }
    } catch { addToast('error', 'เกิดข้อผิดพลาด') }
    finally { setPinBusy(null) }
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(note: ToolNote) {
    setEditing(note)
    setForm({ title: note.Title, category: note.Category ?? '', noteContent: note.NoteContent })
    setShowModal(true)
    setViewing(null)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.noteContent.trim()) return
    setSaving(true)
    const payload = {
      Title: form.title.trim(),
      NoteContent: form.noteContent,
      Category: form.category || undefined,
    }
    try {
      if (editing) {
        await spUpdate('IT_Tools', editing.id, payload)
        addToast('success', 'อัปเดต Note แล้ว')
      } else {
        await spCreate('IT_Tools', { ...payload, CreatedByEmail: user!.email })
        addToast('success', 'บันทึก Note แล้ว')
      }
      setShowModal(false)
      load()
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  async function remove(note: ToolNote) {
    if (!window.confirm(`ลบ "${note.Title}"?`)) return
    try {
      await spDelete('IT_Tools', note.id)
      setNotes(prev => prev.filter(n => n.id !== note.id))
      if (viewing?.id === note.id) setViewing(null)
      addToast('success', 'ลบ Note แล้ว')
    } catch {
      addToast('error', 'เกิดข้อผิดพลาด')
    }
  }

  const allCats = ['ทั้งหมด', ...CATEGORIES]
  const filtered = notes.filter(n => {
    const matchSearch = n.Title.toLowerCase().includes(search.toLowerCase()) ||
      n.NoteContent.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'ทั้งหมด' || n.Category === catFilter
    return matchSearch && matchCat
  })

  const ic = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const lc = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div className="min-h-screen">
      <Header title="Tools & Notes" />
      <div className="p-4 md:p-6">

        {/* Title */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Notebook size={20} className="text-primary-600" /> Tools &amp; Notes
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">{tr('tools.subtitle')}</p>
          </div>
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus size={15} /> {tr('tools.create')}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tr('tools.search')}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {allCats.map(c => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  catFilter === c
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Notebook size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{notes.length === 0 ? tr('tools.createNote') : '-'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(note => (
              <div
                key={note.id}
                onClick={() => setViewing(note)}
                className="subpanel bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-1 flex-1">
                    {note.Title}
                  </h3>
                  <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={e => togglePin(note, e)} disabled={pinBusy === note.id} title={pinnedSet.has(String(note.id)) ? 'เอาออกจาก Focus' : 'Pin ไว้ที่ Focus'}
                      className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${pinnedSet.has(String(note.id)) ? 'text-primary-600' : 'text-gray-400 hover:text-primary-600 opacity-0 group-hover:opacity-100'}`}>
                      <Pin size={13} className={pinnedSet.has(String(note.id)) ? 'fill-current' : ''} />
                    </button>
                    <button onClick={() => openEdit(note)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => remove(note)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {note.Category && (
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-2 font-medium ${categoryColor(note.Category)}`}>
                    {note.Category}
                  </span>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-4 whitespace-pre-wrap leading-relaxed">
                  {note.NoteContent}
                </p>
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-3 text-right">
                  {formatDate(note.Modified)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── View Note Modal ── */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.Title ?? ''} size="lg">
        {viewing && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              {viewing.Category && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(viewing.Category)}`}>
                  {viewing.Category}
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{tr('tools.lastEdit')}: {formatDate(viewing.Modified)}</span>
            </div>
            <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-[55vh] overflow-y-auto font-sans">
              {viewing.NoteContent}
            </pre>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setViewing(null)}>{tr('common.close')}</Button>
              <Button onClick={() => openEdit(viewing)} className="flex items-center gap-2">
                <Pencil size={14} /> {tr('common.edit')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create / Edit Modal ── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? tr('tools.editNote') : tr('tools.createNote')}
        size="lg"
      >
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className={lc}>{tr('tools.noteName')} *</label>
            <input
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className={ic}
              placeholder={tr('tools.namePlaceholder')}
            />
          </div>
          <div>
            <label className={lc}>{tr('common.category')}</label>
            <OptionSelect category="ToolNoteCategory" defaults={[...CATEGORIES]} value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} className={ic} />
          </div>
          <div>
            <label className={lc}>{tr('tools.content')} *</label>
            <textarea
              required
              value={form.noteContent}
              onChange={e => setForm(f => ({ ...f, noteContent: e.target.value }))}
              className={ic}
              rows={14}
              placeholder={tr('tools.contentPlaceholder')}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>{tr('common.cancel')}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? tr('common.saving') : editing ? tr('common.saveEdit') : tr('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
