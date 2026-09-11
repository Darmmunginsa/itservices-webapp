# ตรวจสอบระบบอีเมลทั้งระบบ — และสิ่งที่แก้

ตรวจทุกจุดที่เรียก `sendTemplateEmail` (12 จุดใน webapp + 3 ทางใน Add-in), ตัวส่งจริง
(`graph.sendMail`), ตัวหา template, ตัวแปรที่ส่งเข้า template เทียบกับเอกสาร และฝั่งรับ

## หลักที่ยึดตอนแก้

1. **เมลไม่ออกต้องมีคนรู้** — ทุกทางต้อง `await` และรายงานผลด้วยเหตุจริง
2. **ตัวแปรเป็นข้อความเสมอ** — หนีอักขระเป็นค่าเริ่มต้น ตัวที่เป็น HTML ต้องห่อ `html()` ที่จุดเรียก
3. **กฎเดียว ที่เดียว** — ลิงก์ · ข้อความแจ้งเตือน · การหา template · ผู้รับ Incident

## ที่พบและแก้แล้ว

### 🔴 เมลไม่ถึงแล้วไม่มีใครรู้

| จุด | เดิม | ตอนนี้ |
|---|---|---|
| `Submit` ticket_created | ยิงแล้วไม่รอผล — template หาย/Graph ล้ม ลูกค้าไม่ได้เมล หน้าจอบอกสำเร็จ | `await` + toast บอกเหตุจริง |
| `CompanyCalendar` leave_requested | ยิงแล้วไม่รอผล · **ยังไม่ได้ตั้งผู้อนุมัติ** → คืน no-recipient เงียบ แต่ toast บอก "รอการอนุมัติ" | บอกตรง ๆ ว่ายังไม่มีผู้อนุมัติ ให้ Admin ตั้ง |
| `Home` leave_decision | ยิงแล้วไม่รอผล | `await` + toast |
| **Add-in** `sendTemplateEmail` | ไม่เช็ค `res.ok` และครอบ `catch {}` — ทุกเมลจาก Add-in ล้มเหลวได้แบบไม่มีร่องรอย | คืน `boolean` · ผู้เรียกแสดง toast แดงเมื่อไม่ออก |
| **Add-in** `_tplCache` | ไม่มีวันหมดอายุ — แก้ template แล้ว Add-in ส่งเนื้อเดิมจนรีสตาร์ท Outlook | TTL 5 นาที เท่า webapp |

### 🔴 ฉีด HTML เข้าเมล / เมลเพี้ยน

รากอยู่ที่ `render()` แทนค่าตรง ๆ — ทุกตัวแปรถือเป็น HTML พิมพ์ `<3` เมลก็เพี้ยน และเป็นช่องให้
ใส่ HTML ที่ตัวเองเลือกเข้าเมลที่ส่งในนามบริษัท

**แก้ที่ราก**: `renderTemplate()` ใน [`src/utils/emailTemplate.ts`](../src/utils/emailTemplate.ts)
หนีอักขระเป็นค่าเริ่มต้น ตัวที่เป็น HTML จริงต้องห่อ `html()` / `textToHtml()` ให้เห็นชัดที่จุดเรียก

| ตัวแปรที่เคยดิบ | จุด |
|---|---|
| `description` `ticket_title` `customer_name` | Submit ticket_created · Add-in ticket_created |
| `resolutionNote` (ปิดงานพร้อมตอบลูกค้า) | TicketDetail — ทางคอมเมนต์ปกติหนีแล้ว แต่ทางนี้ตกไป |
| `title` `description` `resolution` ของ Incident | `incidentVars` — และ**ไม่แปลง `\n`→`<br>`** คำอธิบายหลายบรรทัดยุบเป็นบรรทัดเดียว |

Subject แยกตัว render (`renderSubject`) — เป็นข้อความล้วน ไม่หนีอักขระ แต่ตัดแท็กจากตัวแปร HTML ทิ้ง

### 🟠 ลิงก์ในเมลพาไปผิดที่

6 จุดใช้ `window.location.origin` → `https://itservices.co.th` **ไม่มี `/helpdesk/`**
อีก 2 จุดใช้ `origin + pathname` ซึ่งถูก — สองมาตรฐานในโปรเจกต์เดียว

ตอนนี้ `appLink(route)` ตัวเดียว · ลิงก์ในเมล comment พาเข้า ticket นั้นตรง ๆ (`#/tickets/12`)
ไม่ใช่หน้าแรก

### 🟠 Template

| | เดิม | ตอนนี้ |
|---|---|---|
| **Add-in** หา EventKey | ตรงตัวเป๊ะ (บั๊กเดียวกับที่ webapp เพิ่งแก้) | ใช้ `findTemplate` ตัวเดียวกับ webapp |
| toast "ยังไม่ได้เปิด template" | ยังโกหกอยู่ **6 จุด** | `mailFailText()` ตัวเดียว บอกเหตุจริงจาก `detail` |
| `{{ตัวแปรที่ไม่รู้จัก}}` | โผล่เป็นตัวหนังสือในเมลถึงลูกค้า | ลบทิ้ง + `console.warn` + **Diagnostic ชี้ให้เห็น**ก่อนส่งจริง |
| เอกสาร | มี `incident_created` **สองเวอร์ชัน** และ template ที่โค้ดไม่เคยส่ง 4 ตัว | ตัดออก เหลือ 9 ตัวที่ส่งจริง ตรงกับ `EVENT_VARS` |
| Diagnostic | ตรวจ 7 key ตายตัว | อ่านจาก `KNOWN_EVENTS` · **เทียบตัวแปรใน template กับที่โค้ดส่ง** · ชี้แถวที่ระบบไม่มีเหตุการณ์ชื่อนั้น |

### 🟡 ผู้รับ Incident ไม่สอดคล้อง

หน้าโครงการ CC **สมาชิกทีมทั้งหมด** แต่หน้า Incident / แจ้งงาน / Dashboard CC **เจ้าของโครงการเท่านั้น**
— เหตุการณ์เดียวกัน คนได้เมลต่างกันแล้วแต่กดจากหน้าไหน

ตอนนี้ทุกหน้า: **To = ผู้รับผิดชอบ · CC = ผู้แจ้ง + เจ้าของโครงการ** (ตัดฝั่งที่เกิน ไม่ใช่เพิ่มฝั่งที่ขาด —
น้อยฉบับแต่ตรงกัน ดีกว่ามากฉบับที่ไม่มีใครรู้ว่าใครควรได้)

## ที่ตรวจแล้ว **ปกติดี**

`graph.sendMail` เช็ค `res.ok` และ throw · dedupe To/CC ไม่สนตัวพิมพ์ · ตัด CC ที่ซ้ำ To ·
ตัดคนกดเองออก (incident/ack) · Admin ล้าง cache ทุกครั้งที่บันทึก · `incidentBanner` เปลี่ยนสีตามเหตุการณ์ ·
`work_acknowledged`/`work_assigned` ผ่านทางเดียว

## ที่ยืนยันจากโค้ดไม่ได้ — ต้องดูจากของจริง

| | ทำไม |
|---|---|
| **เธรดเมลฝั่ง webapp** | `comment_added` ส่งเป็น**เมลใหม่หัวข้อเดิม** Outlook จัดเธรดด้วย conversation header ไม่ใช่หัวข้ออย่างเดียว ลูกค้าอาจเห็นแยกเธรด · Add-in ทำถูก (`createReplyAll`) แต่ webapp ไม่มีทางนี้ — ถ้าเจอจริงค่อยทำ reply-in-thread ฝั่ง webapp |
| **header `จาก: ชื่อ (เวลา)`** ที่ `parseRelayed` รอ | ไม่มีโค้ดใน repo ไหนเขียน — มาจาก Power Automate ถ้ารูปแบบเพี้ยน คอมเมนต์ลูกค้าจะโผล่เป็นของ agent |
| **Send As** บัญชีกลาง | ถ้าไม่มีสิทธิ์ Graph ตอบ 403 → webapp toast แดง · Add-in ตอนนี้ก็บอกแล้ว |

## ยังไม่ได้ทำ (ตั้งใจ)

- Admin `TPL_DEFAULTS` มีร่างให้แค่ `comment_added` — สร้าง key อื่นได้แต่ได้เนื้อว่าง (Diagnostic จะบอกว่า "Body ว่าง") ถ้าอยากได้ร่างครบ 9 ตัวบอกได้
- `engineer@` / `support@` hardcode สองที่ — ย้ายเข้า `HD_Options` ได้ แต่แตะทั้ง 2 repo ไม่ใช่เรื่องของรอบนี้

## ตัวเลข

790 เทสต์ผ่าน (+34 สำหรับ render/escape/appLink/mailFailText/EVENT_VARS) · `check:addin` ตรวจ `emailTemplate.ts` เพิ่มด้วย
· lint ไม่เพิ่ม error · **ไม่ต้องแก้ SharePoint**
