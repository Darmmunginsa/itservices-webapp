export type TicketStatus = 'Open' | 'In Progress' | 'Pending' | 'Resolved' | 'Closed'
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Ticket {
  id: number
  Title: string
  TicketNumber: string
  Status: TicketStatus
  Priority: TicketPriority
  Category: string
  Department?: string
  Description: string
  AssignedToName: string
  AssignedEmail: string
  CustomerEmail: string
  CustomerName: string
  IsAcknowledged: boolean
  AcknowledgedBy?: string
  AcknowledgedDate?: string
  IsEscalated?: boolean
  DueDate?: string
  ResolvedDate?: string
  ResolutionNote?: string
  Created: string
  Modified: string
  CreatedByEmail?: string   // not present in SP list schema — read-only, may be absent
  Author?: { Title: string; EMail?: string }  // SP Created By — expanded via $expand=Author (ผู้แจ้งตัวจริง)
}

export interface TicketComment {
  id: number
  TicketID: number
  CommentText: string
  CommentType: 'Internal' | 'External'
  CommentDate: string
  LikedBy?: string            // JSON array of emails who liked — multi-line text column
  ParentID?: number           // Id of parent comment for threaded replies (0/empty = top-level)
  Author?: { Title: string }  // SP Created By — expanded via $expand=Author
  AttachmentFiles?: { FileName: string; ServerRelativeUrl: string }[]  // รูป/ไฟล์แนบของ comment
}

export interface TicketMember {
  id: number
  Title: string        // AgentName
  TicketID: number
  TicketTitle: string
  TicketNumber: string
  AgentEmail: string
  AddedBy: string
}

export interface Contract {
  id: number
  Title: string
  CustomerEmail: string
  Phone: string
  Company: string
  Status: 'Active' | 'Inactive' | 'Expired'
}
