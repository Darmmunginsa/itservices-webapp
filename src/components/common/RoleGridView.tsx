import { Link } from 'react-router-dom'
import { Users, AlertTriangle } from 'lucide-react'
import { Card } from './Card'
import { Badge } from './Badge'
import { ROLE_BADGE } from '../../utils/roleBadge'
import { buildRoleGrid, UNASSIGNED_ROLE, type PersonRoles, type ProjectLike } from '../../utils/projectRoles'

interface Props {
  people: PersonRoles[]
  /** โครงการที่ยังเดินอยู่แต่ไม่มีใครเป็น Manager */
  gaps: ProjectLike[]
  totalPeople: number
}

const DONE = ['Completed', 'Cancelled']

/**
 * ตารางบทบาท — โครงการเป็นแถว บทบาทเป็นคอลัมน์
 *
 * มุมมองการ์ดตอบว่า "คนนี้ถืออะไร" แต่ตอบไม่ได้ว่า "โครงการนี้ทีมครบไหม"
 * เพราะคนของโครงการเดียวกันกระจายอยู่หลายการ์ด
 * ตารางกลับด้านให้: อ่านทีละแถวก็เห็นทั้งทีม และช่องว่างคือช่องที่ยังไม่มีคน
 */
export function RoleGridView({ people, gaps, totalPeople }: Props) {
  const { roles, rows } = buildRoleGrid(people)
  const gapIds = new Set(gaps.map(g => g.id))

  if (rows.length === 0) {
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
    <div className="space-y-3">
      {/* ตารางกว้างได้ — ให้เลื่อนในกรอบของตัวเอง ไม่ให้ทั้งหน้าเลื่อนซ้ายขวา */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60">
              {/* ชื่อโครงการค้างซ้ายไว้ — เลื่อนไปดูคอลัมน์ขวาแล้วยังรู้ว่าแถวไหน */}
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 text-left font-semibold px-3 py-2 border-b border-r border-gray-200 dark:border-gray-700 min-w-40">
                โครงการ
              </th>
              {roles.map(r => (
                <th key={r} className="px-3 py-2 border-b border-r last:border-r-0 border-gray-200 dark:border-gray-700 text-left font-semibold min-w-36">
                  <Badge className={`${ROLE_BADGE[r] ?? ROLE_BADGE.default} !text-[10px]`}>{r}</Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const done = DONE.includes(row.projectStatus ?? '')
              return (
                <tr key={row.projectId}
                  className={`align-top hover:bg-gray-50 dark:hover:bg-gray-800/40 ${done ? 'opacity-55' : ''}`}>
                  <th className="sticky left-0 z-10 bg-white dark:bg-gray-900 text-left font-normal px-3 py-2 border-b border-r border-gray-200 dark:border-gray-700">
                    <Link to={`/projects/${row.projectId}`}
                      className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:text-primary-600">
                      {row.projectTitle}
                    </Link>
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      {row.projectStatus ?? '—'} · {row.total} ที่นั่ง
                    </span>
                    {/* ช่องว่างที่สำคัญที่สุดคือไม่มีคนตัดสินใจ — บอกที่แถวนั้นเลย */}
                    {gapIds.has(row.projectId) && (
                      <span className="inline-flex items-center gap-0.5 mt-1 text-[10px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle size={9} /> ยังไม่มี Manager
                      </span>
                    )}
                  </th>
                  {roles.map(r => {
                    const cell = row.cells[r] ?? []
                    return (
                      <td key={r} className="px-3 py-2 border-b border-r last:border-r-0 border-gray-200 dark:border-gray-700">
                        {cell.length === 0
                          ? <span className="text-gray-200 dark:text-gray-700">—</span>
                          : (
                            <div className="space-y-1">
                              {cell.map(person => (
                                <div key={person.email} className="min-w-0">
                                  <p className="text-[11px] text-gray-800 dark:text-gray-200 truncate" title={person.email}>
                                    {person.name}
                                  </p>
                                  {person.responsibility && (
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                                      {person.responsibility}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        {rows.length} โครงการ × {roles.length} บทบาท · {people.length} คน (จากพนักงานทั้งหมด {totalPeople} คน) ·
        คอลัมน์มีเฉพาะบทบาทที่มีคนถืออยู่จริง · ขีด — คือยังไม่มีคนในบทบาทนั้น
        {roles.includes(UNASSIGNED_ROLE) && ` · คอลัมน์ "${UNASSIGNED_ROLE}" คือคนที่อยู่ในทีมแต่ยังไม่ได้ระบุหน้าที่`}
      </p>
    </div>
  )
}
