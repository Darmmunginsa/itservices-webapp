import { useEffect, useState } from 'react'
import { ToggleLeft, ToggleRight } from 'lucide-react'
import { spGet, spUpdate } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import type { AgentProfile } from '../../types/common'

// ── เลือกว่าใครโชว์ในหน้า "สถานะทีม" — ใช้ทั้งในหน้า Admin และหน้าสถานะทีม (คนที่มีสิทธิ์แก้ไข) ──

export function TeamStatusVisibility() {
  const { addToast } = useAppStore()
  const [list, setList] = useState<AgentProfile[]>([])
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    // ShowInTeamStatus เป็นคอลัมน์ใหม่ — ถ้ายังไม่ได้สร้าง $select จะพัง จึง fallback เป็นชุดเดิม
    spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText,Role,ShowInTeamStatus', 'Title asc', 500)
      .then(setList)
      .catch(() => spGet<AgentProfile>('HD_AgentProfiles', undefined, 'Id,Title,EmailText,Role', 'Title asc', 500).then(setList).catch(() => {}))
  }, [])

  async function toggle(id: number, show: boolean) {
    setSaving(id)
    try {
      await spUpdate('HD_AgentProfiles', id, { ShowInTeamStatus: show })
      setList(prev => prev.map(a => a.id === id ? { ...a, ShowInTeamStatus: show } : a))
      addToast('success', show ? 'แสดงในสถานะทีมแล้ว' : 'ซ่อนจากสถานะทีมแล้ว')
    } catch {
      addToast('error', 'บันทึกไม่สำเร็จ — ตรวจว่ามีคอลัมน์ ShowInTeamStatus (Yes/No) ใน HD_AgentProfiles')
    } finally { setSaving(null) }
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">
        ปิดสวิตช์เพื่อซ่อนคนนั้นจากรายชื่อและไทม์ไลน์ (เช่น ผู้บริหาร หรือคนที่ไม่ได้อยู่ทีมบริการ)
        · ต้องมีคอลัมน์ <code>ShowInTeamStatus</code> (Yes/No) ใน HD_AgentProfiles
      </p>
      <div className="space-y-1.5 max-h-96 overflow-y-auto">
        {list.map(a => {
          const shown = a.ShowInTeamStatus !== false
          return (
            <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {a.Title} <span className="text-xs font-normal text-gray-400">({a.Role})</span>
                </p>
                <p className="text-xs text-gray-400 truncate">{a.EmailText}</p>
              </div>
              <span className={`text-xs ${shown ? 'text-green-600' : 'text-gray-400'}`}>{shown ? 'แสดง' : 'ซ่อน'}</span>
              <button onClick={() => toggle(a.id, !shown)} disabled={saving === a.id}
                title={shown ? 'ซ่อนจากสถานะทีม' : 'แสดงในสถานะทีม'} className="disabled:opacity-50">
                {shown ? <ToggleRight size={26} className="text-green-600" /> : <ToggleLeft size={26} className="text-gray-400" />}
              </button>
            </div>
          )
        })}
        {list.length === 0 && <p className="text-xs text-gray-400 py-3">ยังไม่มีข้อมูลพนักงาน</p>}
      </div>
    </div>
  )
}
