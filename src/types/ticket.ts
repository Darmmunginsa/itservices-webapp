export type TicketStatus = 'Open' | 'In Progress' | 'Pending' | 'Resolved' | 'Closed'
export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Ticket {
  id: number
  Title: string
  TicketNumber: string
  Status: TicketStatus
  Priority: TicketPriority
  Category: string
  Description: string
  AssignedToName: string
  AssignedEmail: string
  CustomerEmail: string
  CustomerName: string
  IsAcknowledged: boolean
  AcknowledgedBy?: string
  AcknowledgedDate?: string
  DueDate?: string
  Created: string
  Modified: string
  CreatedByEmail: string
}

export interface TicketComment {
  id: number
  TicketID: string
  CommentText: string
  CommentBy: string
  CommentByEmail: string
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
