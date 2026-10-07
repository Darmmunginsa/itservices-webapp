/**
 * สถานะความว่างของทีม (HD_TeamStatus) — แต่ละแถวคือ "slot" ช่วงเวลาหนึ่งของคนหนึ่ง
 * ไม่มี slot ครอบเวลาปัจจุบัน = ว่าง (Available) โดยปริยาย
 * ต้องตรงกับฝั่งมือถือ (itservices-helpdesk-phone/src/types/teamStatus.ts)
 */
export type StatusType = 'Available' | 'Busy' | 'Meeting' | 'OnSite' | 'Break' | 'Off'

export interface TeamStatusSlot {
  id: number
  Title: string
  UserEmail: string
  UserName: string
  StatusType: StatusType
  StartTime: string
  EndTime: string
  Note?: string
  Created?: string
}

export interface CalendarBusySlot {
  UserEmail: string
  Title: string
  StartTime: string
  EndTime: string
  Kind: string
}

export const STATUS_META: Record<StatusType, { label: string; color: string; bg: string; free: boolean }> = {
  Available: { label: 'ว่าง', color: '#16a34a', bg: '#dcfce7', free: true },
  Busy: { label: 'ไม่ว่าง', color: '#dc2626', bg: '#fee2e2', free: false },
  Meeting: { label: 'ประชุม', color: '#d97706', bg: '#fef3c7', free: false },
  OnSite: { label: 'ออกไซต์', color: '#7c3aed', bg: '#ede9fe', free: false },
  Break: { label: 'พัก', color: '#0891b2', bg: '#cffafe', free: true },
  Off: { label: 'เลิกงาน/ลา', color: '#6b7280', bg: '#f3f4f6', free: false },
}

export const STATUS_ORDER: StatusType[] = ['Available', 'Busy', 'Meeting', 'OnSite', 'Break', 'Off']

export const REASON_PRESETS: Record<StatusType, string[]> = {
  Available: [],
  Busy: ['โฟกัสงาน', 'แก้ปัญหาด่วน', 'ทำเอกสาร', 'ติดงานลูกค้า'],
  Meeting: ['ประชุมภายใน', 'ประชุมลูกค้า', 'สัมภาษณ์', 'อบรม'],
  OnSite: ['ออกไซต์ลูกค้า', 'ติดตั้งอุปกรณ์', 'ตรวจเช็คระบบ', 'เดินทาง'],
  Break: ['พักเที่ยง', 'พักเบรก'],
  Off: ['ลาพักร้อน', 'ลาป่วย', 'ลากิจ', 'เลิกงานแล้ว'],
}

export const DURATION_PRESETS: { label: string; minutes: number }[] = [
  { label: '15 นาที', minutes: 15 },
  { label: '30 นาที', minutes: 30 },
  { label: '1 ชม.', minutes: 60 },
  { label: '2 ชม.', minutes: 120 },
  { label: '3 ชม.', minutes: 180 },
  { label: 'ถึงสิ้นวัน', minutes: 0 },
]

export const DAY_START_HOUR = 8
export const DAY_END_HOUR = 20
