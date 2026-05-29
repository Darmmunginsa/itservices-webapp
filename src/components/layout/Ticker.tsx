import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { spGet } from '../../services/sharepoint'
import type { Announcement } from '../../types/common'

export function Ticker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    spGet<Announcement>('HD_Announcements', 'IsActive eq true', undefined, 'SortOrder asc')
      .then(setAnnouncements)
      .catch(() => {})
  }, [])

  if (!announcements.length) return null

  const text = announcements.map(a => a.Message).join('   •   ')

  return (
    <div className="bg-primary-600 text-white text-xs py-1.5 px-4 flex items-center gap-2 overflow-hidden">
      <Megaphone size={13} className="flex-shrink-0" />
      <div className="flex-1 overflow-hidden">
        <span className="inline-block ticker-scroll whitespace-nowrap">{text}</span>
      </div>
    </div>
  )
}
