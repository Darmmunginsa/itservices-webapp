# เมนู Application — ตั้งค่า SharePoint

"Application" คือผลงานของโครงการที่ส่งมอบให้ลูกค้าใช้งานแล้ว — เก็บ URL + บันทึก และ **ผูก** ไปหาของที่มีอยู่แล้ว
(โครงการ · Asset · Ticket · Incident · Portal) เพื่อดูแลหลังส่งมอบได้จากที่เดียว

```
PM_Applications ──ProjectID──▶ PM_Projects
       │  AssetIDs    ─▶ IT_Assets      (id คั่นด้วย , )
       │  TicketIDs   ─▶ HD_Tickets
       │  IncidentIDs ─▶ PM_Incidents
       └  PortalIDs   ─▶ IT_Portals
```

## ลิสต์ — `PM_Applications`

Site contents → New → List → ชื่อ `PM_Applications` แล้วเพิ่มคอลัมน์:

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `Title` | (มีอยู่แล้ว) | ชื่อแอปพลิเคชัน |
| `URL` | Single line of text | **Text ธรรมดา ไม่ใช่ Hyperlink** (Hyperlink คืนค่าเป็น object) |
| `Note` | Multiple lines of text (Plain text) | บันทึกการส่งมอบ / วิธีใช้ / ผู้ติดต่อ |
| `Customer` | Single line of text | ลูกค้า / หน่วยงานที่ใช้งาน |
| `Status` | Single line of text | `Active` / `Maintenance` / `Retired` |
| `ProjectID` | Number | id ของโครงการ (ไม่บังคับ) |
| `AssetIDs` | Multiple lines of text (Plain text) | เช่น `12,45,46` |
| `TicketIDs` | Multiple lines of text (Plain text) | |
| `IncidentIDs` | Multiple lines of text (Plain text) | |
| `PortalIDs` | Multiple lines of text (Plain text) | |

## สิทธิ์
- ลิสต์: ทีมที่ดูแลระบบให้สิทธิ์ **Contribute** (คนดูอย่างเดียวให้ Read)
- หน้าเว็บ: เมนูอยู่กลุ่ม "งาน" — ค่าเริ่มต้นเห็นได้เฉพาะ Agent ขึ้นไป
  ถ้ามีการกำหนดสิทธิ์รายคนไว้แล้ว ให้ Admin ไปติ๊ก **Application** (ดู / แก้ไข) ที่หน้าสิทธิ์การเข้าถึง
