export interface Portal {
  id: number
  Title: string          // ชื่อ Portal
  URL?: string           // ลิงก์เข้าใช้งาน
  Category?: string      // หมวด เช่น Vendor, Cloud, Internal
  Username?: string      // บัญชี/ชื่อผู้ใช้ (อ้างอิง — ไม่เก็บรหัสผ่าน)
  Note?: string
  Created?: string
  Modified?: string
}
