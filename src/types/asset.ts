export type AssetCategory = 'Computer' | 'Server' | 'VM' | 'Network' | 'Certificate' | 'Other'
export type AssetStatus = 'Active' | 'Inactive' | 'Maintenance' | 'Retired'

export interface Asset {
  id: number
  Title: string
  Category: AssetCategory
  Status: AssetStatus
  WarrantyDate?: string
  OS?: string
  IPAddress?: string
  Username?: string
  Password?: string
  Owner?: string
  Location?: string
  SerialNumber?: string
  Model?: string
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
  Created: string
}
