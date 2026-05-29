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
  // General
  Note?: string
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
  CourseLink?: string
  Note?: string
  Created: string
}
