# Claude Memory — Helpdesk (itservices.co.th)

> สรุปความรู้/ข้อตกลงที่สะสมระหว่างทำงานกับ Claude — ใช้สำรอง และนำไปใส่เป็น system prompt ตอนใช้ Claude API ได้ทันที
> อัปเดตล่าสุด: 2026-11-02

## 1. ผู้ใช้และวิธีทำงานที่ต้องการ
- ผู้ใช้: วิศวกรของ iTServices (engineer@itservices.co.th) — เรียกตัวเองว่า "พี่" · ตอบเป็น **ภาษาไทย** สั้น กระชับ
- ชอบให้ **ลงมือทำเลย** แล้วรายงานผล — ไม่ต้องถามซ้ำเรื่องที่ตัดสินใจได้เอง
- รายงานตามจริง: บอกชัดว่า **ตรวจอะไรแล้ว / ยังไม่ได้ตรวจ** (เช่น "ยังไม่ได้ดูในออฟฟิศจริง")
- งานภาพ/3D: ผู้ใช้ส่งภาพอ้างอิง (เช่น ลูกบีเกิล กระต่ายแคระ) → ทำให้ใกล้ภาพที่สุด ตรวจด้วยหน้าทดสอบใน dev-preview ก่อนส่ง
- ถ้าทำไม่ได้ทางเทคนิค (เช่น เปิดหน้าต่างลอยเองโดยไม่มีการคลิก, ปิดหน้าหลักแล้วสายไม่หลุด) → บอกตรง ๆ + เสนอทางที่ใกล้เคียงที่สุดแล้วทำให้

## 2. ระบบ
- **Webapp**: `C:\Users\darmm\Desktop\itservices-webapp` — React 19 + TypeScript + Vite + Tailwind + Zustand บน SharePoint Online · deploy เป็น `helpdesk.zip` (ผู้ใช้อัปโหลดเอง)
- **Outlook Add-in**: `C:\Users\darmm\Desktop\itservices-addin` — Vite + TS · deploy โฟลเดอร์ `dist/`
- **ClientBoard**: ต้องเป็นไซต์แยก (แยกสิทธิ์ SharePoint) · สะพานข้อมูลทางเดียว
- ข้อห้ามถาวร: ห้ามเก็บรหัสผ่านลูกค้าแบบ plaintext · ห้ามใส่ LINE Channel Access Token ใน JS ฝั่งเบราว์เซอร์

## 3. ขั้นตอนตรวจและปล่อยงาน (ทุกครั้ง)
Webapp:
1. `npx tsc --noEmit -p tsconfig.app.json` (ห้ามใช้ `-p .` — ไม่ตรวจอะไรเลย)
2. `npx eslint <ไฟล์ที่แก้>` — กฎ React compiler: ห้าม setState ตรง ๆ ใน effect, ห้ามใช้ตัวแปรก่อนประกาศ, ไฟล์ .tsx export ได้เฉพาะ component · บางไฟล์มี error เดิมอยู่แล้ว (ProjectDetail, Admin, CompanyCalendar) — เทียบกับ HEAD ก่อนสรุปว่าเราทำพัง
3. `timeout 240 npx tsx scripts/check-report-metrics.ts` (ต้องผ่าน 1257)
4. `npm run build` → `powershell -NoProfile -File /c/tmp/zip.ps1`
5. commit งาน → commit "chore: rebuild helpdesk.zip" → push · ท้าย commit: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

Add-in: `npm run build` → commit → push → ผู้ใช้นำ `dist/` ขึ้นโฮสต์

Preview (ตรวจภาพ): launch config `office-preview` พอร์ต 5179 → `/helpdesk/dev-preview/index.html`
หน้าทดสอบเดี่ยว: `waterfall.html`, `koi.html`, `pets.html?side&kind=dog|rabbit`, `duck.html`, `garden.html`, `chair.html`, `swing.html`
mock อยู่ใน `dev-preview/` (alias ใน `vite.preview.config.ts`) · ทดสอบ 3D เวลากลางวัน: localStorage `hd-3d-hour = 10`

เคล็ดลับเครื่องมือ: สคริปต์ยาวให้เขียนไฟล์ด้วย Write แล้วรัน python (heredoc ยาว ๆ ใน bash พัง) · Python บน Windows มองไม่เห็น `/tmp` ให้ใช้ path Windows

## 4. ข้อมูล SharePoint ที่ต้องรู้
- `HD_OfficeDecor` 1 แถว/คน: คอลัมน์ Data (JSON: desk, items, pets), Sound, Avatar, ReadState
- `HD_OfficePresence.Room` เข้ารหัส `zone[|f][|v][|sX,Y][:mic|:muted]`
- `HD_OfficeChat` (ห้อง "robot" = คำขอทำความสะอาด/กาแฟ), `HD_OfficeDM` (แชทส่วนตัว + ขอคุยเสียง), `HD_LeaveRequests`, `HD_AgentProfiles.ShowInTeamStatus`
- `HD_Holidays`: Title, HolidayDate, HolidayType (ราชการ/บริษัท), **CalendarEventId (ต้องเพิ่มคอลัมน์ Single line of text)** — ใช้จำว่าส่ง invite แล้ว
- สิทธิ์รายหน้า: `AllowedPages` เก็บ `key` และ `key:edit` / `admin.<tool>:edit` · ในโค้ดใช้ `useCanEdit(pageKey, roles)` แทนการเช็ก role ตรง ๆ

## 5. ฟีเจอร์หลักที่ทำแล้ว (ช่วงล่าสุด)
- **ออฟฟิศเสมือน 2D/3D** (three@0.186.1, lazy-load): GTAO/bloom/SMAA, แสงตามเวลาจริง, หญ้าพลิ้วลม+ดอกไม้ป่า, ทางเดินแผ่นหิน, น้ำตก+บ่อปลาคาร์ฟ (`waterfall3d.ts`), ปลาคาร์ฟในลำธาร, เป็ด (ดำน้ำ/มุดหัว/ไซ้ขน/กระพือปีก), ชิงช้าตัว A
- **สัตว์เลี้ยง** (`pets3d.ts`, `PetSprite.tsx`, `utils/officePets.ts`): หมา (บีเกิล) + กระต่าย (แมวเอาออกจากตัวเลือกแล้ว) · ขนแบบ shell · วิ่งตาม/นอนที่โต๊ะ (ปุ่มลัดบนแถบเครื่องมือ) · ในสวนวิ่งเล่นอิสระ (สุ่มจากเวลา ทุกเครื่องเห็นตรงกัน) · เจ้าของนั่ง → นั่งหน้าที่นั่ง
- **เก้าอี้รับแขก** (ของแต่งโต๊ะ ใครก็นั่งได้)
- **ใกล้กันแบบ Gather** (`NearbyTalkBar.tsx`): เข้าระยะ 2.5 ช่อง → แถบ "ขอคุยด้วยเสียง" + "แชร์จอ" กลางบน (2D/3D/หน้าต่างลอย) · คนถูกขอได้ยินกระดิ่งเบา ๆ ทุก 8 วิ (`softChime.ts`, ≤1 นาที)
- **หน้าต่างลอย (Document PiP)**: คลิกแผนที่เพื่อเดิน, เมนู "ไปหา…" · 📌 ลอยอัตโนมัติ (เปิดตอนคลิกครั้งแรก) · กำลังเชื่อมต่ออยู่แล้วปิดหน้าหลัก → เบราว์เซอร์ถามยืนยัน
- **วันหยุด**: แถบวันหยุดบนไทม์ไลน์ Team Status · ส่ง Calendar invite (ไม่อยู่ทั้งวัน) ให้ทุกคนล่วงหน้า 30 วัน โดย Admin/Boss ที่เปิดเว็บ (`utils/holidayInvites.ts`)
- **โครงการ**: คนที่ได้สิทธิ์ ✓ แก้ไข "โครงการ" หรือเป็นเจ้าของ/สมาชิก สร้าง Task ได้
- **Add-in**: ไม่ติ๊ก CC → ตอบกลับเฉพาะผู้ส่ง (`createReply`) แทน Reply All

## 6. งานค้าง / ข้อเสนอที่ผู้ใช้ยังไม่ตัดสินใจ
- เพิ่มคอลัมน์ `CalendarEventId` ใน HD_Holidays (ถ้ายังไม่ได้ทำ)
- เพิ่มคอลัมน์ Sound / Avatar / ReadState ใน HD_OfficeDecor · ให้สิทธิ์ Contribute HD_Options/HD_AgentProfiles กับผู้จัดการที่ได้รับมอบหมาย
- ไม่ส่ง invite วันหยุดในวันนั้นเอง (เสนอแล้ว รอคำตอบ)
- ให้ออฟฟิศ (เสียง/ตำแหน่ง) รันเบื้องหลังทุกหน้าของ Helpdesk เพื่อเปิดหน้าต่างลอยตั้งแต่หน้าแรก (เสนอแล้ว รอคำตอบ)
- การ์ดตอบรับ "ขอคุยเสียง" ในหน้าต่างลอย
- Azure Web PubSub / TURN สำหรับเสียง realtime — รองบประมาณ (ปัจจุบันเสียง P2P ฟรี)
