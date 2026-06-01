import { useState, useCallback } from 'react'
import { getCalendarRange, createCalendarEvent } from '../services/graph'
import type { OutlookEvent } from '../services/graph'

export function useOutlook() {
  const [events, setEvents] = useState<OutlookEvent[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRange = useCallback(async (start: Date, end: Date) => {
    setLoading(true)
    try {
      const data = await getCalendarRange(start, end)
      setEvents(data)
    } catch (e) {
      console.error('Outlook fetch failed', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchWeekly = useCallback(async () => {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay() + 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return fetchRange(start, end)
  }, [fetchRange])

  const createEvent = useCallback(async (params: Parameters<typeof createCalendarEvent>[0]) => {
    return createCalendarEvent(params)
  }, [])

  return { events, loading, fetchRange, fetchWeekly, createEvent }
}
