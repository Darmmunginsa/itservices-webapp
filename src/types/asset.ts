export type AssetCategory = 'Computer' | 'Server' | 'VM' | 'Network' | 'Certificate' | 'Software' | 'Other'
export type AssetStatus = 'Active' | 'Inactive' | 'Maintenance' | 'Retired'

export interface Asset {
  id: number
  Title: string
  AssetCode?: string
  Category: AssetCategory
  Status: AssetStatus
  OS?: string
  IPAddress?: string
  Username?: string
  Password?: string
  SerialNumber?: string
  Spec?: string
  Vendor?: string
  // Ownership
  OwnerType?: string          // e.g. Company / Department / User
  AssignedTo?: string
  AssignedEmail?: string
  // Financials
  PurchaseDate?: string
  Price?: number
  // Warranty / Support
  WarrantyDate?: string
  // Software / Certificate specific
  AppName?: string
  AccessMethod?: string
  ExpiryDate?: string
  LicenseType?: string
  PortalURL?: string
  MonitorUrl?: string   // ลิงก์หน้า monitor ใน Uptime Kuma (อ้างอิงเฉยๆ)
  VendorID?: number     // ผูกกับ Vendor Contract (IT_Vendors)
  PortalID?: number     // ผูกกับ Portal (IT_Portals)
  // การแจ้งเตือนราย Item (เก็บค่า — ส่งจริงทำภายหลัง)
  AlertEnabled?: boolean // เปิด/ปิดการแจ้งเตือนหมดประกัน/ใบอนุญาต
  AlertDays?: number     // แจ้งล่วงหน้ากี่วันก่อนหมด
  AlertEmail?: string    // อีเมลผู้รับแจ้งเตือน (คั่นด้วย ,)
  // General
  Note?: string
  QuotationRef?: string   // อ้างอิงใบเสนอราคาจาก SalePro (เลขที่ QT)
  Created: string
  Modified: string
}

export interface Skill {
  id: number
  Title: string
  Level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
  Status: 'Learning' | 'Completed' | 'Planned'
  Learner: string
  LearnerEmail: string
  StartDate?: string
  EndDate?: string
  CourseLink?: string | { Url: string; Description?: string }
  Note?: string
  Created: string
}
