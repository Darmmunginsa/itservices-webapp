# คุยกับลูกค้าผ่านอีเมลใน Ticket

เอกสารนี้อธิบายว่าคอมเมนต์แบบ **External** ในหน้า Ticket ทำงานอย่างไร
และวิธีตั้ง Power Automate ให้ **เมลที่ลูกค้าตอบกลับ ไหลกลับเข้ามาเป็นคอมเมนต์**

```
Agent พิมพ์คอมเมนต์ External ใน Helpdesk
        │
        ├─► HD_TicketComments (CommentType = External)
        └─► อีเมลถึงลูกค้า — หัวข้อ = ชื่อเรื่องที่ลูกค้าแจ้ง + แถบ "Ticket No."
                │
                ▼
        ลูกค้ากด Reply ในเมลฉบับนั้น
                │
                ▼
        support@itservices.co.th
                │
                ▼
        Power Automate  ── อ่านเลข Ticket จากแถบในเมล ──►  HD_TicketComments
                                                            (External, ขึ้นต้น "จาก: ...")
                │
                ▼
        โผล่ในหน้า Ticket ป้าย "📩 จากลูกค้า"
```

## ส่วนที่ทำเสร็จแล้วในแอป (ขาออก)

- คอมเมนต์ **External** ส่งอีเมลจริงแล้ว — To = `CustomerEmail`, CC = Agent เจ้าของงาน + ผู้แจ้ง + สมาชิก Ticket + `engineer@itservices.co.th`
- **หัวข้อเมลใช้ชื่อเรื่องของลูกค้า** ไม่ใช่เลข Ticket → ไคลเอนต์อีเมลจัดให้อยู่เธรดเดียวกับที่ลูกค้าแจ้งมาแต่แรก (หลักการเดียวกับ Add-in)
- **เลข Ticket อยู่ในแถบบนเนื้อเมล** — เป็นตัวที่ Power Automate ใช้จับคู่กลับเข้า Ticket
- ส่งไม่สำเร็จจะขึ้น toast แดงบอก ไม่เงียบเหมือนเดิม
- คอมเมนต์ **Internal** ไม่ส่งเมล เหมือนเดิม

**ต้องตั้งค่าครั้งเดียวก่อนใช้:** หน้าตั้งค่าระบบ → Email Templates → สร้าง/เปิดใช้ **"Comment Added"**
(กดสร้างจะได้ร่างมาให้พร้อมใช้แล้ว เหลือกด **เปิดใช้งาน**) ถ้ายังไม่เปิด คอมเมนต์จะถูกบันทึกแต่ไม่มีเมลออก และแอปจะเตือน

---

## ขาเข้า — Power Automate

สร้างที่ https://make.powerautomate.com → **Create** → **Automated cloud flow**

### 1. Trigger — เลือกให้ตรงชนิดของกล่องเมล

`support@itservices.co.th` เป็นกล่องแบบไหน เลือก trigger คนละตัว:

| ถ้า support@ คือ | ใช้ trigger | เงื่อนไข |
|---|---|---|
| **Shared mailbox** (ไม่มี license ของตัวเอง) | **When a new email arrives in a shared mailbox (V2)** | บัญชีที่สร้าง flow ต้องมีสิทธิ์ **Full Access** ที่กล่องนั้น และกรอก Mailbox Address = `support@itservices.co.th` |
| **บัญชีผู้ใช้จริง** (มี license, login ได้) | **When a new email arrives (V3)** | ต้อง**สร้าง flow ด้วยบัญชีนั้นเอง** — trigger นี้ฟังกล่องของคนที่เชื่อม connection เท่านั้น |

> เลือกผิดตัวคือสาเหตุที่ flow "รันไม่เคยทำงาน" บ่อยที่สุด — ไม่มี error ให้เห็น มันแค่ไม่ถูก trigger

| ช่อง | ค่า |
|---|---|
| Folder | Inbox |
| Include Attachments | Yes |
| Only with Attachments | No |

### 2. กันเมลของเราเองวนกลับ

**Condition** — ถ้าผู้ส่งเป็นบัญชีเรา ให้จบ flow (ไม่งั้นเมลที่เราส่งออกจะถูกดูดกลับเป็นคอมเมนต์ซ้ำไม่รู้จบ)

```
or(
  contains(toLower(triggerOutputs()?['body/from']), 'support@itservices.co.th'),
  contains(toLower(triggerOutputs()?['body/from']), 'engineer@itservices.co.th')
)
```

เป็น `true` → **Terminate** (Status: Succeeded)

### 3. แปลง HTML เป็นข้อความ

**Html to text** (Content Conversion) → Content = `Body` จาก trigger

### 4. หาเลข Ticket

**Compose** ชื่อ `TicketNo` :

```
trim(first(split(last(split(outputs('Html_to_text')?['body'], 'Ticket No. ')), decodeUriComponent('%0A'))))
```

**Condition** — ถ้าไม่เจอให้จบ (เมลทั่วไปที่ไม่เกี่ยวกับ Ticket):

```
or(
  equals(outputs('TicketNo'), ''),
  not(startsWith(outputs('TicketNo'), 'HD-'))
)
```
เป็น `true` → **Terminate**

### 5. หา Ticket ใน SharePoint

**Get items** — List = `HD_Tickets`

```
Filter Query:  TicketNumber eq '@{outputs('TicketNo')}'
Top Count:     1
```

ถ้า `length(body('Get_items')?['value'])` = 0 → **Terminate**

### 6. เขียนเป็นคอมเมนต์

**Create item** — List = `HD_TicketComments`

| คอลัมน์ | ค่า |
|---|---|
| Title | `first(take(outputs('Html_to_text')?['body'], 100))` |
| TicketID | `first(body('Get_items')?['value'])?['ID']` |
| CommentType | `External` |
| CommentDate | `utcNow()` |
| ParentID | `0` |
| CommentText | ดูด้านล่าง |

**CommentText** — ต้องขึ้นต้นด้วยบรรทัด `จาก:` เพราะหน้า Ticket ใช้บรรทัดนี้แสดงชื่อลูกค้าตัวจริง แทนบัญชีที่ Power Automate ใช้เขียน:

```
จาก: @{triggerOutputs()?['body/from']} (@{formatDateTime(utcNow(), 'dd/MM/yyyy HH:mm')})

@{outputs('Html_to_text')?['body']}
```

> **ไม่ต้องตัด quote ใน flow แล้ว** — เดิมแนะนำให้ตัดด้วย `split(... 'Ticket No. ')`
> **อย่าทำ** เพราะการตัดใน flow คือการ*ลบ*ข้อมูลตั้งแต่ยังไม่ถึงระบบ กู้ไม่ได้
> ตอนนี้แอปพับเมลเก่าไว้ตอนแสดงผลแทน (ดู Email-Quote-Handling.md) — ส่งเข้ามาทั้งก้อนได้เลย
> คอมเมนต์จะสั้น แต่ของเดิมยังกดดูได้

### 7. ไฟล์แนบ (ควรทำ ไม่ใช่ทางเลือก)

ลูกค้าส่งภาพหน้าจอมาบ่อยกว่าที่คิด และมักเป็นหลักฐานชิ้นเดียวที่มี
ถ้าไม่ต่อขั้นนี้ รูปจะหายไปเงียบ ๆ โดยไม่มีอะไรบอกว่าเคยมี

**Apply to each** บน `Attachments` → **Add attachment** เข้า `HD_TicketComments` item ที่เพิ่งสร้าง

| ช่อง | ค่า |
|---|---|
| List Name | `HD_TicketComments` |
| Id | `Id` ของ Create item ขั้นก่อนหน้า |
| File Name | `Name` (จาก Apply to each) |
| File Content | `ContentBytes` |

**ตั้งค่าสำคัญ**

- ที่ trigger ต้องเปิด **Include Attachments = Yes** (ตั้งไว้แล้วในขั้นที่ 1)
- ที่ Apply to each → **Settings → Concurrency Control = On, Degree = 1**
  ถ้าปล่อยขนานกัน ไฟล์ที่อัปโหลดพร้อมกันจะชนกันเอง

**ข้อควรรู้**

- **รูปที่ลูกค้า paste กลางเนื้อเมลก็มาด้วย** — Power Automate นับเป็น attachment เหมือนกัน
  ผลข้างเคียงคือ**โลโก้ในลายเซ็น**ก็ติดมาด้วย (มักเป็นไฟล์เล็ก ๆ ชื่อ `image001.png`)
  จะกรองก็ใส่ **Condition** ก่อน Add attachment: `length(items('Apply_to_each')?['ContentBytes'])`
  มากกว่า `20000` — เป็นการเดาด้วยขนาด ไม่ใช่กฎตายตัว บางทีตัดภาพหน้าจอเล็ก ๆ ทิ้งได้
  **ถ้าไม่แน่ใจ ไม่ต้องกรอง** — โลโก้เกินมาไม่ทำให้เสียงาน แต่รูปที่หายไปทำ
- **ชื่อไฟล์ซ้ำในคอมเมนต์เดียวกันจะอัปโหลดไม่ผ่าน** — รูป inline ชื่อ `image001.png` ทุกอัน
  ถ้าเจอ ให้ใส่ลำดับต่อท้าย: File Name = `concat(iterationIndexes, '-', items('Apply_to_each')?['Name'])`
- ไฟล์ใหญ่กว่า ~30 MB Power Automate จะไม่ส่งมาให้

### 8. (ทางเลือก) เปิด Ticket ที่ปิดไปแล้วขึ้นมาใหม่

ถ้า Status เป็น `Resolved` / `Closed` → **Update item** เป็น `In Progress`
ลูกค้าตอบกลับหลังปิดเคสจะได้ไม่หายไปเฉย ๆ

---

## ทดสอบ

1. เปิด Ticket ใน Helpdesk → คอมเมนต์ **External** → ลูกค้าต้องได้เมล **ในเธรดเดิม**
2. ตอบกลับเมลนั้นจากเมลลูกค้า
3. ภายใน ~1 นาที คอมเมนต์ต้องโผล่ในหน้า Ticket พร้อมป้าย **📩 จากลูกค้า** และชื่อผู้ส่งจริง

## ข้อควรรู้

- **ไฟล์แนบไม่ไปกับอีเมลขาออก** — เมลจะเขียนบอกว่ามีไฟล์กี่ไฟล์ ให้เปิดดูในระบบ
- **ไฟล์แนบขาเข้ามาครบ** ถ้าต่อขั้นที่ 7 ไว้ — รวมรูปที่ลูกค้า paste กลางเนื้อเมล
- ลูกค้าที่**ตั้งหัวข้อใหม่**เองตอนตอบกลับ ยังจับคู่ได้ เพราะจับจากแถบ Ticket No. ในเนื้อเมล ไม่ได้จับจากหัวข้อ
- ถ้าลูกค้า**ลบข้อความเก่าทิ้งหมด**ก่อนตอบ จะจับคู่ไม่ได้ → เมลจะค้างในกล่อง `support@` เฉย ๆ ไม่หาย แต่ต้องเอาเข้า Ticket เองด้วย Add-in
