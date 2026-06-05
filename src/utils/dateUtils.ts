import { format, differenceInDays, isToday, isPast, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'

export function formatDate(dateStr: string | undefined, fmt = 'dd MMM yyyy'): string {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), fmt, { locale: th })
  } catch {
    return '-'
  }
}

export function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '-'
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy HH:mm', { locale: th })
  } catch {
    return '-'
  }
}

// YouTube-style relative time: "เมื่อสักครู่", "5 นาทีที่แล้ว", "2 ชั่วโมงที่แล้ว", "3 วันที่แล้ว"
export function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return ''
  try {
    const d = parseISO(dateStr).getTime()
    const sec = Math.floor((Date.now() - d) / 1000)
    if (sec < 60) return 'เมื่อสักครู่'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min} นาทีที่แล้ว`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`
    const day = Math.floor(hr / 24)
    if (day < 30) return `${day} วันที่แล้ว`
    const mo = Math.floor(day / 30)
    if (mo < 12) return `${mo} เดือนที่แล้ว`
    return `${Math.floor(mo / 12)} ปีที่แล้ว`
  } catch {
    return ''
  }
}

export type DueDateColor = 'red' | 'orange' | 'yellow' | 'gray' | 'normal'

export function getDueDateColor(dueDate: string | undefined, isCompleted = false): DueDateColor {
  if (isCompleted) return 'gray'
  if (!dueDate) return 'normal'
  try {
    const date = parseISO(dueDate)
    if (isPast(date) && !isToday(date)) return 'red'
    if (isToday(date)) return 'orange'
    const diff = differenceInDays(date, new Date())
    if (diff <= 3) return 'yellow'
    return 'normal'
  } catch {
    return 'normal'
  }
}

export function getDueDateBadgeClass(color: DueDateColor): string {
  switch (color) {
    case 'red':    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'orange': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'yellow': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'gray':   return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
    default:       return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
}

export function getDueDateRowClass(color: DueDateColor): string {
  switch (color) {
    case 'red':    return 'border-l-4 border-red-500'
    case 'orange': return 'border-l-4 border-orange-500'
    case 'yellow': return 'border-l-4 border-yellow-500'
    case 'gray':   return 'opacity-60'
    default:       return ''
  }
}

export function getDueDateEmoji(color: DueDateColor): string {
  switch (color) {
    case 'red':    return '🔴'
    case 'orange': return '🟠'
    case 'yellow': return '🟡'
    case 'gray':   return '⬜'
    default:       return ''
  }
}

export function daysUntil(dateStr: string): number {
  try {
    return differenceInDays(parseISO(dateStr), new Date())
  } catch {
    return 999
  }
}

export function isWarrantyExpiringSoon(warrantyDate: string | undefined): boolean {
  if (!warrantyDate) return false
  return daysUntil(warrantyDate) <= 60
}
