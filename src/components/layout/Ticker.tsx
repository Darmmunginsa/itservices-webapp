import { useEffect, useState } from 'react'
import { Megaphone } from 'lucide-react'
import { spGet } from '../../services/sharepoint'
import type { Announcement } from '../../types/common'

export function Ticker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  useEffect(() => {
    spGet<Announcement>('HD_Announcements', undefined, undefined, 'SortOrder asc')
      .then(setAnnouncements)
      .catch(() => {})
  }, [])

  const active = announcements.filter(a => a.IsActive)
  if (!active.length) return null

  const text = active.map(a => a.Message).join('   •   ')

  return (
    <div className="sticky top-0 z-30 bg-primary-600 text-white text-xs py-1.5 px-4 flex items-center gap-2 overflow-hidden">
      <Megaphone size={13} className="flex-shrink-0" />
      <div className="flex-1 overflow-hidden">
        <span className="inline-block ticker-scroll whitespace-nowrap">{text}</span>
      </div>
    </div>
  )
}
