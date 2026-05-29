export type Role = 'EndUser' | 'Agent' | 'Supervisor' | 'Boss' | 'Admin'

export interface UserProfile {
  id: string
  displayName: string
  email: string
  role: Role
  agentProfile?: AgentProfile
}

export interface AgentProfile {
  id: number
  Title: string
  AgentEmail: string
  EmailText: string
  Role: Role
  SupportGroup: string
  IsAvailable: boolean
}

export interface Announcement {
  id: number
  Title: string
  Message: string
  IsActive: boolean
  SortOrder: number
}

export interface Holiday {
  id: number
  Title: string
  HolidayDate: string
  HolidayType: 'ราชการ' | 'บริษัท'
}

export interface LeaveRequest {
  id: number
  Title: string
  LeaveDate: string
  LeaveType: string
  RequestedBy: string
  RequestedByEmail: string
  ApproverEmail: string
  Status: 'Pending' | 'Approved' | 'Rejected'
  ApprovalComment?: string
  Created: string
}

export interface FocusItem {
  id: number
  Title: string
  RefID: string
  FocusType: 'Ticket' | 'Task' | 'Project'
  FocusedBy: string
  FocusedEmail: string
  DueDate?: string
  Status: string
}

export interface TrackingItem {
  id: number
  Title: string
  TrackingType: 'Ticket' | 'Task'
  RefID: string
  TrackedBy: string
  AssignedTo: string
  Status: string
  IsAcknowledged: boolean
}
