// แอปพลิเคชัน = ผลงานที่ส่งมอบให้ลูกค้าแล้ว (ผลลัพธ์ของโครงการ)
// ส่วนใหญ่เป็น "ตัวผูก" ไปหาของที่มีอยู่แล้ว: โครงการ · Asset · Ticket · Incident · Portal
// รายการที่ผูกเก็บเป็น id คั่นด้วยจุลภาค (Multiple lines of text) — ไม่ต้องสร้างลิสต์เชื่อมเพิ่ม

export type AppStatus = 'Active' | 'Maintenance' | 'Retired'

export interface Application {
  id: number
  Title: string
  URL?: string
  Note?: string
  Customer?: string
  Status?: AppStatus
  ProjectID?: number | null
  AssetIDs?: string
  TicketIDs?: string
  IncidentIDs?: string
  PortalIDs?: string
  Created?: string
  Modified?: string
}

export const parseIds = (s?: string | null): number[] =>
  (s ?? '').split(/[,\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0)

export const joinIds = (ids: number[]): string => [...new Set(ids)].join(',')
