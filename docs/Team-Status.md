# สถานะทีม (Team Status)

หน้า "ใครว่าง ใครไม่ว่าง ตอนนี้" ของทีม — ตั้งสถานะตัวเองได้ในคลิกเดียว ทีมเห็นทันที (รีเฟรชทุก 30 วิ)
พร้อมไทม์ไลน์รายวัน และซ้อนประชุมจากปฏิทิน Outlook ให้โดยไม่ต้องกรอกซ้ำ

```
สถานะของฉัน   🟢 ว่าง — ทีมติดต่อได้                      [แจ้งว่าไม่ว่าง]
วันนี้  ◀ ▶                                   ว่าง 4/7 คน
 ● สมชาย (ฉัน)   ว่าง
 ● อารีย์         ประชุม · ประชุมลูกค้า · เหลืออีก 40 นาที
 ● บอส           📅 Weekly sync · ถึง 11:00        ← จาก Outlook
ไทม์ไลน์  08:00 ──── 12:00 ──── 20:00   | เส้นแดง = ตอนนี้
```

| สถานะ | ว่างไหม |
|---|---|
| ว่าง · พัก | ว่าง |
| ไม่ว่าง · ประชุม · ออกไซต์ · เลิกงาน/ลา | ไม่ว่าง |

ตั้งสถานะ = เลือกชนิด + เหตุผล (มีตัวเลือกบ่อย ๆ) + นาน 15 นาที…ถึงสิ้นวัน (20:00) · กด **เสร็จแล้ว / ว่าง** จบก่อนกำหนดได้
ไม่มี slot ครอบเวลาตอนนี้ = ว่างโดยปริยาย · ใช้ชุดเดียวกับแอปมือถือ (`itservices-helpdesk-phone`)

## ต้องสร้างใน SharePoint

**1. ลิสต์ `HD_TeamStatus`**

| คอลัมน์ | ชนิด |
|---|---|
| Title | เหตุผลสั้น ๆ (มีอยู่แล้ว) |
| UserEmail · UserName | Single line |
| StatusType | Choice: `Available` `Busy` `Meeting` `OnSite` `Break` `Off` |
| StartTime · EndTime | Date and Time (รวมเวลา) — **index EndTime** ถ้าแถวจะเกิน 5,000 |
| Note | Multiple lines (plain) |

**2. `HD_AgentProfiles` เพิ่ม `ShowInTeamStatus`** (Yes/No, default Yes) — Admin › แท็บ "สถานะทีม" ปิดสวิตช์เพื่อซ่อนคน (เช่น ผู้บริหาร)
ยังไม่สร้างคอลัมน์ = แสดงทุกคน (โค้ด fallback ให้)

**3. สิทธิ์หน้า** — หน้าใหม่ `team-status` (กลุ่มหน้าหลัก) · คนที่มีแถวสิทธิ์อยู่แล้ว**ยังไม่เห็น** จนกว่า Admin จะติ๊กให้ที่ "สิทธิ์การเข้าถึงหน้า"

## ซ้อนประชุมจาก Outlook — ต้องตั้งใน Azure AD

ใช้ Graph `getSchedule` ด้วย scope **`Calendars.Read.Shared`** (ขอ token แยกใบ แบบ silent เท่านั้น)
→ App registration › API permissions › เพิ่ม delegated `Calendars.Read.Shared` › **Grant admin consent**

ยังไม่ consent = หน้าใช้ได้ปกติ แค่ไม่มีแถบ Outlook (ไม่ขึ้น error) · เห็นหัวข้อประชุมเฉพาะปฏิทินที่เรามีสิทธิ์ดูรายละเอียด ที่เหลือขึ้น "ประชุม (Outlook)"

## โค้ด

`src/pages/TeamStatus.tsx` · `src/services/teamStatus.ts` · `src/types/teamStatus.ts` (ตรงกับฝั่งมือถือ) · `getSchedule` ใน `services/graph.ts` · Admin แท็บ "สถานะทีม"
