export interface Vendor {
  id: number
  Title: string            // ชื่อ Vendor / บริษัท
  ContactName?: string     // ผู้ติดต่อ
  Phone?: string
  Email?: string
  ContractNo?: string      // เลขสัญญา
  ContractStart?: string
  ContractEnd?: string
  SupportScope?: string    // ขอบเขตบริการ / SLA
  Note?: string
  PortalURL?: string       // เว็บ/Portal แจ้งงาน
  Created?: string
  Modified?: string
}
