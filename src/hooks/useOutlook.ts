import { useState, useCallback } from 'react'
import { getWeeklyCalendar, createCalendarEvent } from '../services/graph'
import type { OutlookEvent } from '../services/graph'

export function useOutlook() {
  const [events, setEvents] = useState<OutlookEvent[]>([])
  const [loading, setLoading] = useState(false)

  const fetchWeekly = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getWeeklyCalendar()
      setEvents(data)
    } catch (e) {
      console.error('Outlook fetch failed', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const createEvent = useCallback(async (params: Parameters<typeof createCalendarEvent>[0]) => {
    return createCalendarEvent(params)
  }, [])

  return { events, loading, fetchWeekly, createEvent }
}
