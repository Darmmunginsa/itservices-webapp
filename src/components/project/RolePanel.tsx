import { useState } from 'react'
import { Users, Check, X, Pencil, AlertTriangle } from 'lucide-react'
import { Card } from '../common/Card'
import { Button } from '../common/Button'
import { Badge } from '../common/Badge'
import { OptionSelect } from '../common/OptionSelect'
import { spUpdate } from '../../services/sharepoint'
import { useAppStore } from '../../store/useAppStore'
import { membersOf, PROJECT_ROLES, UNASSIGNED_ROLE, type MemberLike } from '../../utils/projectRoles'
import { ROLE_BADGE } from '../../utils/roleBadge'

interface Props {
  projectId: number
  members: MemberLike[]
  canEdit: boolean
  /** เรียกหลังบันทึก เพื่อให้หน้าโครงการโหลดสมาชิกใหม่ */
  onSaved: () => void
}

/**
 * บทบาทและความรับผิดชอบของทีมในโครงการ
 *
 * ใช้คนที่ถูก invite เข้ามาอยู่แล้ว ไม่ต้องเพิ่มคนซ้ำ — แค่กำหนดว่าใครทำหน้าที่อะไร
 * เพราะ "อยู่ในทีม" ไม่ได้บอกว่าใครตัดสินใจ ใครลงมือ ใครแค่ดูอยู่
 */
export function RolePanel({ projectId, members, canEdit, onSaved }: Props) {
  const { addToast } = useAppStore()
  const [editing, setEditing] = useState<number | null>(null)
  const [role, setRole] = useState('')
  const [resp, setResp] = useState('')
  const [saving, setSaving] = useState(false)

  const team = membersOf(members, projectId)
  const noManager = team.length > 0 && !team.some(m => (m.Role ?? '').trim() === 'Manager')

  function open(m: MemberLike) {
    setEditing(m.id)
    setRole((m.Role ?? '').trim())
    setResp(m.Responsibility ?? '')
  }

  async function save(m: MemberLike) {
    setSaving(true)
    try {
      await spUpdate('PM_ProjectMembers', m.id, {
        Role: role || undefined,
        Responsibility: resp || undefined,
      })
      setEditing(null)
      onSaved()
      addToast('success', 'บันทึกบทบาทแล้ว')
    } catch {
      // คอลัมน์ยังไม่มีก็บันทึกไม่ได้ — บอกให้ตรงจุด ไม่ใช่ "เกิดข้อผิดพลาด"
      addToast('error', 'บันทึกไม่สำเร็จ — ตรวจว่ามีคอลัมน์ Role และ Responsibility ใน PM_ProjectMembers แล้ว')
    } finally { setSaving(false) }
  }

  const ic = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500'

  if (team.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-400 text-center py-8">
          ยังไม่มีใครในทีมโครงการนี้ — เชิญคนเข้าทีมก่อน แล้วค่อยกำหนดบทบาท
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* ไม่มีคนตัดสินใจคือช่องว่างที่ควรรู้ ไม่ใช่ปล่อยให้ค้นพบตอนมีปัญหา */}
      {noManager && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>โครงการนี้ยังไม่มีใครเป็น <strong>Manager</strong> — ยังไม่มีคนตัดสินใจแทนทีม</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {team.map(m => {
          const isEditing = editing === m.id
          const current = (m.Role ?? '').trim()
          return (
            <Card key={m.id} className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{m.Title || m.AgentEmail}</p>
                  <p className="text-xs text-gray-400 truncate">{m.AgentEmail}</p>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge className={ROLE_BADGE[current] ?? ROLE_BADGE.default}>
                      {current || UNASSIGNED_ROLE}
                    </Badge>
                    {canEdit && (
                      <button type="button" onClick={() => open(m)} title="กำหนดบทบาท"
                        className="text-gray-300 hover:text-primary-600 transition-colors">
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="mt-3 space-y-2">
                  <OptionSelect category="ProjectRole" defaults={[...PROJECT_ROLES]}
                    value={role} onChange={setRole} className={ic} />
                  <textarea value={resp} onChange={e => setResp(e.target.value)} rows={3}
                    placeholder="รับผิดชอบอะไรในโครงการนี้ (เช่น ดูแล VDA รายวัน · อนุมัติการเปลี่ยนแปลง)"
                    className={ic} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => save(m)} disabled={saving}>
                      <Check size={13} /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
                      <X size={13} /> ยกเลิก
                    </Button>
                  </div>
                </div>
              ) : m.Responsibility?.trim() ? (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{m.Responsibility}</p>
              ) : (
                <p className="mt-2 text-xs text-gray-400 italic">ยังไม่ได้ระบุความรับผิดชอบ</p>
              )}
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <Users size={12} />
        ดูภาพรวมทุกคนทุกโครงการได้ที่หน้า <span className="font-medium">ผังองค์กร → มุมมองบทบาท</span>
      </p>
    </div>
  )
}
