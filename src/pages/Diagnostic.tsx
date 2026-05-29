import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Card } from '../components/common/Card'
import { spGet } from '../services/sharepoint'

const ALL_LISTS = [
  'HD_AgentProfiles',
  'HD_Announcements',
  'HD_Tickets',
  'HD_TicketComments',
  'HD_Focus',
  'HD_LeaveRequests',
  'HD_Holidays',
  'HD_Tracking',
  'HD_Contracts',
  'HD_Skills',
  'IT_Assets',
  'PM_Projects',
  'PM_Tasks',
  'PM_Notes',
  'PM_Incidents',
]

type Status = 'pending' | 'ok' | 'error'

interface Result {
  list: string
  status: Status
  count?: number
  error?: string
}

async function testList(name: string): Promise<Result> {
  try {
    const items = await spGet<Record<string, unknown>>(name, undefined, 'Id', undefined, 1)
    return { list: name, status: 'ok', count: items.length }
  } catch (e) {
    return { list: name, status: 'error', error: (e as Error).message }
  }
}

export default function Diagnostic() {
  const [results, setResults] = useState<Result[]>(ALL_LISTS.map(l => ({ list: l, status: 'pending' })))
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const name of ALL_LISTS) {
        if (cancelled) break
        const r = await testList(name)
        if (!cancelled) {
          setResults(prev => prev.map(x => x.list === name ? r : x))
        }
      }
      if (!cancelled) setDone(true)
    })()
    return () => { cancelled = true }
  }, [])

  const ok = results.filter(r => r.status === 'ok').length
  const fail = results.filter(r => r.status === 'error').length
  const pending = results.filter(r => r.status === 'pending').length

  return (
    <div>
      <Header title="SharePoint Diagnostic" subtitle="ทดสอบการเข้าถึง SharePoint Lists ทั้งหมด" />
      <div className="p-4 md:p-6 space-y-4">

        <div className="flex gap-4 text-sm font-medium">
          <span className="text-green-600">{ok} OK</span>
          <span className="text-red-500">{fail} FAIL</span>
          {pending > 0 && <span className="text-gray-400">{pending} กำลังทดสอบ...</span>}
          {done && <span className="text-gray-500 font-normal">เสร็จสิ้น</span>}
        </div>

        <Card className="divide-y divide-gray-100 dark:divide-gray-800">
          {results.map(r => (
            <div key={r.list} className="flex items-center gap-3 py-2.5 px-1 text-sm">
              {r.status === 'pending' && <Loader size={16} className="animate-spin text-gray-400 flex-shrink-0" />}
              {r.status === 'ok' && <CheckCircle size={16} className="text-green-500 flex-shrink-0" />}
              {r.status === 'error' && <XCircle size={16} className="text-red-500 flex-shrink-0" />}
              <span className="font-mono font-medium w-52 flex-shrink-0">{r.list}</span>
              {r.status === 'ok' && (
                <span className="text-green-600 text-xs">เข้าถึงได้ (ดึง {r.count} item ทดสอบ)</span>
              )}
              {r.status === 'error' && (
                <span className="text-red-500 text-xs truncate">{r.error}</span>
              )}
              {r.status === 'pending' && (
                <span className="text-gray-400 text-xs">กำลังทดสอบ...</span>
              )}
            </div>
          ))}
        </Card>

        {done && fail > 0 && (
          <div className="text-sm text-gray-500 space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-300">สาเหตุที่พบบ่อย:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>List ยังไม่ถูกสร้างใน SharePoint (ชื่อผิด หรือยังไม่มี)</li>
              <li>Permission ไม่เพียงพอ (ต้อง Grant Admin Consent ใน Azure Portal)</li>
              <li>URL ของ SharePoint Site ผิด (ตรวจสอบใน config/msal.ts)</li>
            </ul>
            <p className="text-xs mt-2 text-gray-400">
              ดูรายละเอียด error เพิ่มเติมได้ที่ Browser Console (F12 → Console) ค้นหา <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">[SP]</code>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
