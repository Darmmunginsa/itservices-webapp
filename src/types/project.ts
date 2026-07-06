export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Cancelled'
export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Project {
  id: number
  Title: string
  Company: string
  Progress: number
  StartDate: string
  EndDate: string
  Status: ProjectStatus
  SecureNote?: string
  CreatedByEmail: string
  Description?: string
  Comment?: string
  ProjectGroup?: string
  QuotationRef?: string   // อ้างอิงใบเสนอราคาจาก SalePro (เลขที่ QT)
  Modified: string
}

// สมาชิกโปรเจกต์ (PM_ProjectMembers) — invite เพื่อให้สิทธิ์เข้าดู Project Detail
export interface ProjectMember {
  id: number
  Title: string              // ชื่อสมาชิก
  ProjectID: number          // Number field in SP — no quotes in filter
  AgentEmail: string
  AddedBy?: string
}

export interface Task {
  id: number
  Title: string
  ProjectID: number          // Number field in SP — no quotes in filter
  IsCompleted: boolean
  IsAcknowledged: boolean
  AcknowledgedBy?: string
  AcknowledgedDate?: string
  AssignedTo: string
  AssignedEmail?: string
  DueDate?: string
  IsFocused?: boolean
  Priority?: number
  TaskNote?: string
  ApproverName?: string
  Created: string
}

export interface Note {
  id: number
  Title: string
  ProjectID: number          // Number field in SP — no quotes in filter
  NoteText: string
  NoteBy: string
  Created: string
}

export interface ProjectIncident {
  id: number
  Title: string
  ProjectID: number          // Number field in SP — no quotes in filter
  Severity: IncidentSeverity
  Status: 'Open' | 'In Progress' | 'Resolved'
  Description: string
  AssignedTo: string
  AssignedEmail?: string
  IncidentDate?: string
  ResolvedDate?: string
  Resolution?: string
  Created: string
  CreatedByEmail?: string
  Author?: { Title: string; EMail?: string }  // SP Created By — ผู้แจ้ง (expand via $expand=Author)
}

export interface ProjectLink {
  id: number
  Title: string
  ProjectID: number          // Number field in SP — no quotes in filter
  URL: string | { Url: string; Description?: string }
  LinkType?: string          // e.g. 'GitHub', 'Docs', 'Drive', 'Other'
  LinkNote?: string
}

// Many-to-many link between Projects and IT_Assets
export interface ProjectAsset {
  id: number
  Title: string
  ProjectID: number
  AssetID: number
  AssetTitle?: string
  AssetCode?: string
}
