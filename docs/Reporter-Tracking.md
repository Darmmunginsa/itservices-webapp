# หน้าแจ้งงาน — คนแจ้งสำรอง + Track/ปฏิทินสำหรับ Incident

## 1. คนแจ้งสำรอง (ทั้ง Ticket / Task / Incident)

### ปัญหา

ทีมส่วนใหญ่**รับเรื่องจากคนนอก** (ลูกค้า คู่ค้า) แล้วมาเปิดเคสเอง ระบบจึงเห็นแต่ "คนกดสร้าง"
ซึ่งเป็นคนใน พอจะถามว่าเรื่องนี้ใครเป็นเจ้าของปัญหาจริง ต้องไปหาในเมลเก่า

### ที่เพิ่ม

ทุกชนิดมีกล่อง **🙋 คนแจ้งสำรอง** เหมือนกัน (เฉพาะ agent):

- เลือกจาก**ทะเบียนลูกค้า** (HD_Contracts) หรือ**พิมพ์ชื่อ/อีเมลเอง** — คนนอกที่ไม่อยู่ในทะเบียนมีเสมอ
- ว่างไว้ = คุณเป็นผู้แจ้งเอง (พฤติกรรมเดิม)
- ระบุแล้ว: ขึ้นเป็น **"แจ้งแทน: ชื่อ (อีเมล)"** ในหน้า Incident และการ์ด Task
  และ**ได้เมลด้วย**ตอนเปิด/มอบหมาย/ปิด Incident — เจ้าของปัญหาจริงต้องรู้ เหมือนลูกค้าของ Ticket

### ที่เก็บ

| ชนิด | คอลัมน์ | หมายเหตุ |
|---|---|---|
| Ticket | `CustomerName` / `CustomerEmail` | **ของเดิม** — ไม่สร้างซ้ำ เมลถึงลูกค้าและรายงานทำงานเหมือนเดิม |
| Task | `ReporterName` / `ReporterEmail` | **ต้องเพิ่มใน `PM_Tasks`** (Single line of text ทั้งคู่) |
| Incident | `ReporterName` / `ReporterEmail` | **ต้องเพิ่มใน `PM_Incidents`** |

ฟอร์มใช้ช่องกรอกชุดเดียว แล้ว `reporterFields(kind, …)` แปลงชื่อคอลัมน์ตอนบันทึก —
กฎอยู่ที่เดียว ([`src/utils/reporter.ts`](../src/utils/reporter.ts), 14 เทสต์)

**ยังไม่ได้เพิ่มคอลัมน์ก็ยังสร้างงานได้** — SharePoint จะปฏิเสธทั้งรายการเมื่อมีฟิลด์ที่ไม่รู้จัก
ระบบจึงสร้างซ้ำโดยไม่ใส่คนแจ้งสำรอง แล้ว toast บอกชื่อคอลัมน์ที่ต้องไปเพิ่ม
งานต้องถูกสร้างได้เสมอ คอลัมน์ที่ขาดเป็นเรื่องรอง

## 2. Incident: Track + Outlook Calendar

Ticket กับ Task มีสองอย่างนี้มานาน Incident ไม่มี — ทั้งที่เป็นงานที่ต้องนัดและตามมากกว่า

- ☑ **Track Incident นี้** → `HD_Tracking` แถวใหม่ `TrackingType = 'Incident'`
  หน้า My Tracking รองรับแล้ว: Sync สถานะจาก `PM_Incidents`, ลิงก์เข้า `/incidents/:id`, กรองชนิด Incident ได้
- ☑ **เพิ่มใน Outlook Calendar** → นัดหมายหัวข้อ `[Incident] …` ผู้เข้าร่วมชุดเดียวกับ Ticket/Task
  สร้างนัดไม่สำเร็จ = Incident ยังถูกบันทึก แค่ toast บอก

## ที่แก้พลอยได้

`CalendarSection` (ของเดิม) และ `ReporterSection` เคยประกาศเป็น **component ในตัวฟังก์ชัน render**
→ ถูกสร้างใหม่ทุกครั้งที่พิมพ์ **ช่องกรอกหลุดโฟกัสทีละตัวอักษร** เปลี่ยนเป็นฟังก์ชันคืน JSX
lint ของหน้านี้จาก 2 error → 0

## ต้องทำใน SharePoint

- `PM_Tasks`: เพิ่ม `ReporterName`, `ReporterEmail` (Single line of text)
- `PM_Incidents`: เพิ่ม `ReporterName`, `ReporterEmail` (Single line of text)
- `HD_Tracking.TrackingType` ถ้าเป็น Choice: เพิ่มค่า `Incident` (ถ้าเป็น Text ไม่ต้องทำอะไร)
