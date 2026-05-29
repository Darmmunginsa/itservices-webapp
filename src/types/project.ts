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
  Modified: string
}

export interface Task {
  id: number
  Title: string
  ProjectID: string
  IsCompleted: boolean
  IsAcknowledged: boolean
  AcknowledgedBy?: string
  AcknowledgedDate?: string
  AssignedTo: string
  AssignedEmail?: string
  DueDate?: string
  IsFocused: boolean
  Priority?: number
  Created: string
}

export interface Note {
  id: number
  Title: string
  ProjectID: string
  NoteText: string
  NoteBy: string
  Created: string
}

export interface ProjectIncident {
  id: number
  Title: string
  ProjectID: string
  Severity: IncidentSeverity
  Status: 'Open' | 'In Progress' | 'Resolved'
  Description: string
  AssignedTo: string
  Created: string
}

export interface ProjectLink {
  id: number
  Title: string
  ProjectID: string
  URL: string
  Description?: string
}
