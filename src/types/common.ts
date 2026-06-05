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
  AgentEmail: string        // People Picker field (read-only from SP)
  EmailText: string         // Plain text email — ใช้ filter ตรงนี้
  Role: Role
  SupportGroup: string      // e.g. 'L1', 'L2'
  SpecialtyCategory?: string
  MaxTicketLoad?: number
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
  CalendarEventId?: string
}

export interface LeaveRequest {
  id: number
  Title: string
  LeaveDate: string
  LeaveType: string
  RequestedBy: string
  RequestedEmail: string      // SP column name (was RequestedByEmail — wrong)
  ApproverEmail: string
  ApproverName?: string
  Status: 'Pending' | 'Approved' | 'Rejected'
  Note?: string               // SP column name (was ApprovalComment — wrong)
  RejectReason?: string
  ApprovedDate?: string
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
  RefID: number           // Numeric SP ID of the referenced ticket/task
  TrackedBy: string       // Display name of who is tracking
  TrackedEmail: string    // Email of who is tracking — use this for filter
  AssignedTo: string
  Status: string
  IsAcknowledged: boolean
}

export interface SLAConfig {
  id: number
  Title: string
  Priority: 'Low' | 'Medium' | 'High' | 'Critical'
  ResponseTimeHours: number
  ResolutionTimeHours: number
}
