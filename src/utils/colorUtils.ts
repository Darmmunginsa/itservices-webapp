import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// คำจำกัดความสถานะ Ticket — แสดงเป็น tooltip ใน dropdown และ badge
export const TICKET_STATUS_DESC: Record<string, { th: string; desc: string }> = {
  'Open':        { th: 'Open',        desc: 'Ticket ถูกสร้างแล้ว รอ Agent รับงาน' },
  'In Progress': { th: 'In Progress', desc: 'Agent รับงานแล้วและกำลังดำเนินการแก้ไข' },
  'Pending':     { th: 'Pending',     desc: 'รอปัจจัยภายนอก เช่น รอลูกค้าตอบ / รอ Vendor / รอ Approve' },
  'Resolved':    { th: 'Resolved',    desc: 'แก้ไขแล้ว รอลูกค้ายืนยันก่อนปิด' },
  'Closed':      { th: 'Closed',      desc: 'ปิดงานสมบูรณ์ ลูกค้ายืนยันหรือผ่านเวลากำหนดแล้ว' },
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'Critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'High':     return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'Medium':   return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Low':      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    default:         return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Open':        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'In Progress': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'Pending':     return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Resolved':    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'Closed':      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    case 'Active':      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'Planning':    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'On Hold':     return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Completed':   return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    case 'Cancelled':   return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'Approved':    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    case 'Rejected':    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    default:            return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'Critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'High':     return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'Medium':   return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Low':      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    default:         return 'bg-gray-100 text-gray-600'
  }
}
