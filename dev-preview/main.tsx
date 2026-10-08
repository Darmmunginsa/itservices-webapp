import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { Office2D } from '../src/components/team/Office2D'
import { OfficeMapEditor } from '../src/components/admin/OfficeMapEditor'
import { ZONE_LABEL, DEFAULT_MAP, type Zone } from '../src/utils/officeMap'

function Preview() {
  const [log, setLog] = useState<string[]>([])
  const members = [
    { email: 'me@x', name: 'สมชาย ใจดี', profileId: 1, slot: null },
    { email: 'aree@x', name: 'อารีย์ สุขใจ', profileId: 2, slot: { id: 9, Title: 'ประชุมลูกค้า', UserEmail: 'aree@x', UserName: 'อารีย์', StatusType: 'Meeting' as const, StartTime: '', EndTime: '' } },
    { email: 'boss@x', name: 'บอส ใหญ่', profileId: 3, slot: { id: 8, Title: 'พักเที่ยง', UserEmail: 'boss@x', UserName: 'บอส', StatusType: 'Break' as const, StartTime: '', EndTime: '' } },
    { email: 'kong@x', name: 'ก้อง ทำงาน', profileId: 4, slot: null },
  ]
  return (
    <div className="p-4 max-w-6xl mx-auto space-y-3">
      <h1 className="text-sm font-semibold">Office2D preview (mock)</h1>
      <Office2D mapRows={DEFAULT_MAP} members={members} meEmail="me@x" meName="สมชาย ใจดี"
        onZoneChange={(z: Zone) => setLog(l => [...l, `zone → ${ZONE_LABEL[z]}`])}
        onError={m => setLog(l => [...l, `ERROR ${m}`])} />
      <pre id="log" className="text-xs text-gray-500">{log.join('\n')}</pre>
      <OfficeMapEditor />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>)
