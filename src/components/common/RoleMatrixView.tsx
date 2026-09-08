import { Link } from 'react-router-dom'
import { Users, FolderOpen, AlertTriangle } from 'lucide-react'
import { Card } from './Card'
import { Badge } from './Badge'
import { PersonPhoto } from './PersonPhoto'
import { ROLE_BADGE } from '../../utils/roleBadge'
import { roleTally, UNASSIGNED_ROLE, type PersonRoles, type ProjectLike } from '../../utils/projectRoles'

interface Props {
  people: PersonRoles[]
  /** โครงการที่ยังเดินอยู่แต่ไม่มีใครเป็น Manager */
  gaps: ProjectLike[]
  /** หา id + ไฟล์รูปของคนจากอีเมล เพื่อแสดงรูปเดียวกับผังบังคับบัญชา */
  photoOf: (email: string) => { itemId: number; fileName?: string } | null
  totalPeople: number
}

/**
 * มุมมองบทบาท — เห็นทุกคนว่าทำโครงการอะไร หน้าที่อะไร
 *
 * ผังบังคับบัญชาตอบว่า "ใครรายงานใคร" ซึ่งไม่ใช่คำถามที่ใช้ทำงานประจำวัน
 * คำถามที่ใช้จริงคือ "คนนี้ถืออะไรอยู่" กับ "โครงการนี้ใครตัดสินใจ"
 */
export function RoleMatrixView({ people, gaps, photoOf, totalPeople }: Props) {
  const tally = roleTally(people)

  if (people.length === 0) {
    return (
      <Card className="text-center py-14">
        <Users size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500">ยังไม่มีใครถูกกำหนดบทบาทในโครงการ</p>
        <p className="text-xs text-gray-400 mt-1">
          เชิญคนเข้าทีมโครงการ แล้วกำหนดบทบาทที่ โครงการ → แท็บ 🎭 บทบาท
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* แถบสรุป — นับ "ที่นั่ง" ไม่ใช่จำนวนคน คนเดียวถือได้หลายบทบาท */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-400">ที่นั่งทั้งหมด:</span>
        {tally.map(t => (
          <Badge key={t.role} className={ROLE_BADGE[t.role] ?? ROLE_BADGE.default}>
            {t.role} · {t.count}
          </Badge>
        ))}
      </div>

      {/* โครงการที่ยังไม่มีคนตัดสินใจ — ต้องเห็น ไม่ใช่ค้นพบตอนมีปัญหา */}
      {gaps.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs no-print">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            ยังไม่มี <strong>Manager</strong> อยู่ {gaps.length} โครงการ —{' '}
            {gaps.slice(0, 6).map((g, i) => (
              <span key={g.id}>
                {i > 0 && ', '}
                <Link to={`/projects/${g.id}`} className="underline hover:no-underline">{g.Title}</Link>
              </span>
            ))}
            {gaps.length > 6 && ` และอีก ${gaps.length - 6} โครงการ`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {people.map(p => {
          const photo = photoOf(p.email)
          return (
            <Card key={p.email} className="min-w-0">
              <div className="flex items-start gap-2.5 mb-2.5">
                {photo
                  ? <PersonPhoto itemId={photo.itemId} fileName={photo.fileName} name={p.name} size={36} />
                  : <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </span>}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 truncate">{p.email}</p>
                </div>
                <Badge className={`${ROLE_BADGE[p.topRole] ?? ROLE_BADGE.default} flex-shrink-0`}>{p.topRole}</Badge>
              </div>

              <p className="text-[11px] text-gray-400 mb-1.5">
                {p.activeCount > 0
                  ? `กำลังถืออยู่ ${p.activeCount} โครงการ`
                  : 'ไม่มีโครงการที่ยังเดินอยู่'}
                {p.assignments.length > p.activeCount && ` · จบแล้ว ${p.assignments.length - p.activeCount}`}
              </p>

              <div className="space-y-1.5">
                {p.assignments.map(a => {
                  const done = ['Completed', 'Cancelled'].includes(a.projectStatus ?? '')
                  return (
                    <div key={`${a.projectId}-${a.memberId}`}
                      className={`px-2.5 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800 ${done ? 'opacity-55' : ''}`}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <FolderOpen size={11} className="text-gray-400 flex-shrink-0" />
                        <Link to={`/projects/${a.projectId}`}
                          className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:text-primary-600 truncate">
                          {a.projectTitle}
                        </Link>
                        <Badge className={`${ROLE_BADGE[a.role] ?? ROLE_BADGE.default} !text-[10px] !px-1.5 !py-0`}>
                          {a.role}
                        </Badge>
                        {done && <span className="text-[10px] text-gray-400">({a.projectStatus})</span>}
                      </div>
                      {a.responsibility && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                          {a.responsibility}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-gray-400">
        แสดง {people.length} คนที่อยู่ในทีมโครงการ (จากพนักงานทั้งหมด {totalPeople} คน) ·
        คนที่ยังไม่ถูกเชิญเข้าโครงการไหนจะไม่อยู่ในมุมมองนี้ ·
        กำหนดบทบาทได้ที่ โครงการ → แท็บ 🎭 บทบาท
        {people.some(p => p.topRole === UNASSIGNED_ROLE) && ' · ป้ายสีส้มคือยังไม่ได้กำหนดบทบาท'}
      </p>
    </div>
  )
}
