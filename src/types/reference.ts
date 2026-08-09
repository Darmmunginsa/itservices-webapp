// คลังแหล่งอ้างอิงความรู้ขององค์กร (SharePoint list: PM_References)
// เป็นคลังกลาง ไม่ผูกกับโครงการใดโครงการหนึ่ง — หนังสือเล่มเดียวใช้ได้หลายโครงการ
// การผูกเข้าโครงการอยู่ที่ลิสต์เชื่อม PM_ProjectReferences (ดู ProjectReferenceLink)
export interface ProjectReference {
  id: number
  Title: string              // ชื่อหนังสือ / มาตรฐาน / บทความ
  RefType?: string           // Book, Standard, RFC, Article, Vendor doc, Video, Course, Internal, Other
  Authors?: string           // ผู้แต่ง / องค์กรผู้ออกมาตรฐาน
  Year?: string              // เก็บเป็นข้อความ รองรับ "2019", "ค.ศ. 2019", "n.d."
  Publisher?: string
  Edition?: string           // ครั้งที่พิมพ์ / เวอร์ชัน
  Identifier?: string        // ISBN / DOI / RFC 5322
  Locator?: string           // บทที่ / หน้า ที่มักอ้างถึง (ค่าตั้งต้น — ระบุเจาะจงต่อโครงการได้ตอนผูก)
  URL?: string
  Summary?: string           // สรุปสาระ หรือข้อความที่ยกมา
  Topics?: string            // หัวข้อ/แท็ก คั่นด้วยจุลภาค เช่น "SRE, SLO, Monitoring"
  Created?: string
  Author?: { Title: string }  // SP Created By — ใครเป็นคนเพิ่มเข้าคลัง
}

// ลิสต์เชื่อมโครงการ ↔ แหล่งอ้างอิง (PM_ProjectReferences) — แบบเดียวกับ PM_ProjectAssets
// AppliedTo/Locator อยู่ที่นี่ เพราะ "อ้างถึงหน้าไหน ใช้กับเรื่องอะไร" ต่างกันไปตามโครงการ
export interface ProjectReferenceLink {
  id: number
  Title: string              // ชื่อแหล่งอ้างอิง ณ ตอนผูก (ไว้โชว์เร็ว ๆ ถ้าคลังโหลดไม่ทัน)
  ProjectID: number          // Number field ใน SP
  ReferenceID: number        // Number field ใน SP
  Locator?: string           // บทที่/หน้า ที่โครงการนี้อ้างถึง
  AppliedTo?: string         // ใช้กับเรื่องอะไรในโครงการนี้
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
