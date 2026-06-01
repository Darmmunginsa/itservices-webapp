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
  Modified: string
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
}

export interface ProjectLink {
  id: number
  Title: string
  ProjectID: number          // Number field in SP — no quotes in filter
  URL: string | { Url: string; Description?: string }
  LinkType?: string          // e.g. 'GitHub', 'Docs', 'Drive', 'Other'
  LinkNote?: string
}
