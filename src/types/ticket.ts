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
}

export interface TicketComment {
  id: number
  TicketID: number          // Number field in SP — no quotes in filter
  CommentText: string
  CommentBy: string         // CommentByEmail does NOT exist in SP schema
  CommentType: 'Internal' | 'External'
  CommentDate: string
}

export interface Contract {
  id: number
  Title: string
  CustomerEmail: string
  Phone: string
  Company: string
  Status: 'Active' | 'Inactive' | 'Expired'
}
