// แหล่งอ้างอิงความรู้ที่ผูกกับโครงการ (SharePoint list: PM_References)
// ใช้ตอนทีมต้องบอกได้ว่า "ที่ตัดสินใจแบบนี้ อ้างอิงจากอะไร"
export interface ProjectReference {
  id: number
  Title: string              // ชื่อหนังสือ / มาตรฐาน / บทความ
  ProjectID: number          // Number field ใน SP — ไม่ต้องใส่ quote ใน filter
  RefType?: string           // Book, Standard, RFC, Article, Vendor doc, Video, Course, Internal, Other
  Authors?: string           // ผู้แต่ง / องค์กรผู้ออกมาตรฐาน
  Year?: string              // เก็บเป็นข้อความ รองรับ "2019", "ค.ศ. 2019", "n.d."
  Publisher?: string
  Edition?: string           // ครั้งที่พิมพ์ / เวอร์ชัน
  Identifier?: string        // ISBN / DOI / RFC 5322
  Locator?: string           // บทที่ / หน้า ที่อ้างถึงจริง
  URL?: string
  Summary?: string           // สรุปสาระ หรือข้อความที่ยกมา
  AppliedTo?: string         // เอาไปใช้กับเรื่องอะไรในโครงการนี้
  Created?: string
  Author?: { Title: string }  // SP Created By — ใครเป็นคนเพิ่ม
}

export const REF_TYPES = [
  'Book', 'Standard', 'RFC', 'Article', 'Vendor doc', 'Video', 'Course', 'Internal', 'Other',
] as const

export const REF_TYPE_TH: Record<string, string> = {
  Book: 'หนังสือ',
  Standard: 'มาตรฐาน',
  RFC: 'RFC',
  Article: 'บทความ',
  'Vendor doc': 'เอกสารผู้ผลิต',
  Video: 'วิดีโอ',
  Course: 'คอร์ส/อบรม',
  Internal: 'เอกสารภายใน',
  Other: 'อื่นๆ',
}

export const REF_TYPE_ICON: Record<string, string> = {
  Book: '📕', Standard: '📐', RFC: '📄', Article: '📰', 'Vendor doc': '🏭',
  Video: '🎬', Course: '🎓', Internal: '🗂️', Other: '🔖',
}
