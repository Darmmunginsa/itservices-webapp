# คู่มือสร้าง Index ใน SharePoint List

> ⚠️ **ทำตอนนี้เลย** ขณะที่ list ยังมีข้อมูลน้อยกว่า 5000 รายการ
> ถ้าเกิน 5000 แล้วจะสร้าง index ไม่ได้

---

## วิธีเข้าหน้าสร้าง Index (ทำเหมือนกันทุก list)

1. เปิด SharePoint site
2. เข้า list ที่ต้องการ (เช่น `HD_Tickets`)
3. กดฟันเฟือง ⚙️ มุมขวาบน → **List settings**
4. เลื่อนลงหา **Columns** → กด **Indexed columns**
5. กด **Create a new index**
6. เลือก **Primary column** = column ที่ต้องการ index
7. กด **Create**
8. ทำซ้ำสำหรับแต่ละ column ในตารางด้านล่าง

---

## รายการ List + Column ที่ต้องสร้าง Index

### 1. HD_Tickets 🔥 (สำคัญสุด — โตเร็ว)
- [ ] `AssignedEmail`
- [ ] `CustomerEmail`
- [ ] `Status`

### 2. HD_TicketComments 🔥 (โตเร็วที่สุด)
- [ ] `TicketID`

### 3. PM_Tasks
- [ ] `AssignedEmail`
- [ ] `ProjectID`

### 4. PM_Incidents
- [ ] `AssignedEmail`
- [ ] `ProjectID`

### 5. HD_LeaveRequests
- [ ] `ApproverEmail`
- [ ] `Status`

### 6. HD_TicketMembers
- [ ] `AgentEmail`
- [ ] `TicketID`

### 7. HD_Focus
- [ ] `FocusedEmail`

### 8. HD_Tracking
- [ ] `TrackedEmail`

### 9. PM_Notes
- [ ] `ProjectID`

### 10. PM_Links
- [ ] `ProjectID`

### 11. HD_Skills
- [ ] `LearnerEmail`

---

## หมายเหตุ

- List เล็กที่ไม่ต้องทำ: `HD_AgentProfiles`, `HD_Holidays`, `HD_Announcements`,
  `HD_Categories`, `HD_Contracts`, `PM_Projects`, `IT_Assets`
  (ข้อมูลไม่โตเกิน 5000 ในเวลาอันใกล้)
- SharePoint สร้าง index ได้สูงสุด **20 index ต่อ list**
- column ประเภท Single line / Number / Date / Choice → index ได้
- column ประเภท Multiple lines (textarea) → index **ไม่ได้** (ไม่ต้องกังวล เพราะเราไม่ filter ด้วย column พวกนี้)
