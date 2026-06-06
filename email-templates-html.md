# Email Templates (HTML) — Corporate Navy Theme

ธีมองค์กร: header navy เข้ม + แถบบริษัท + section label + callout + footer AUTO NOTIFICATION
table-based + bgcolor → render ถูกทุก client (Outlook / Gmail / mobile)

สีหลัก:
- Navy หลัก `#1c2e4a` · Navy เข้ม `#16263f` · แถบบน `#3b5278`
- Accent callout `#2f6fed` · พื้น section `#f4f6f9` · ตัวอักษร label `#8a94a6`

> วิธีใช้: copy Subject + Body ของแต่ละ Template ไปวาง

---

## 1. Ticket Created — `ticket_created`

> ตัวแปร: `{{ticket_number}}` `{{ticket_title}}` `{{priority}}` `{{category}}` `{{description}}` `{{customer_name}}` `{{assigned_name}}` `{{link}}`

**Subject:**
```
แจ้งรับเรื่อง Ticket: {{ticket_number}}
```

**Body:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="#3b5278" style="padding:8px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:22px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:bold;">ยืนยันการรับเรื่อง</td></tr>
      <tr><td bgcolor="#16263f" style="padding:10px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#9fb0c9;font-size:12px;letter-spacing:1px;">IT SERVICES CO.,LTD. &nbsp;·&nbsp; HELPDESK SYSTEM</td></tr>
      <tr><td style="padding:28px;font-family:'Segoe UI',Arial,sans-serif;color:#333333;font-size:14px;line-height:1.7;">
        <p style="margin:0 0 14px;font-size:15px;">เรียน คุณ <strong>{{customer_name}}</strong></p>
        <p style="margin:0 0 6px;color:#555555;">ทางทีม iT Services ได้รับเรื่องของคุณเรียบร้อยแล้วครับ</p>
        <p style="margin:0 0 24px;color:#555555;">ทีมงานจะดำเนินการตรวจสอบและติดต่อกลับโดยเร็วที่สุด</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
          <tr><td style="padding:14px 18px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;">รายละเอียด TICKET</td></tr>
          <tr><td style="padding:0 18px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
              <tr><td style="padding:5px 0;color:#888888;width:90px;vertical-align:top;">Ticket No.</td><td style="padding:5px 0;color:#1c2e4a;font-weight:bold;">{{ticket_number}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">หัวข้อ</td><td style="padding:5px 0;color:#222222;font-weight:bold;">{{ticket_title}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">ประเภท</td><td style="padding:5px 0;color:#222222;">{{category}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">ความสำคัญ</td><td style="padding:5px 0;color:#c0392b;font-weight:bold;">{{priority}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">ผู้รับผิดชอบ</td><td style="padding:5px 0;color:#222222;">{{assigned_name}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">รายละเอียด</td><td style="padding:5px 0;color:#222222;">{{description}}</td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
          <tr><td bgcolor="#eaf2fb" style="padding:12px 16px;border-left:4px solid #2f6fed;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:13px;line-height:1.6;">หากต้องการติดตามความคืบหน้าหรือมีข้อมูลเพิ่มเติม สามารถ <strong>ตอบกลับอีเมลฉบับนี้</strong>ได้เลยครับ ทีมงานจะดำเนินการต่อทันที</td></tr>
        </table>
        <p style="margin:22px 0 0;color:#555555;">หากมีความคืบหน้า ทางทีมงานจะแจ้งให้ทราบทางอีเมลนี้ครับ</p>
      </td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:6px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td style="padding:18px 28px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:15px;font-weight:bold;">iT Services Co.,Ltd.</td></tr>
      <tr><td style="padding:0 28px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#999999;font-size:12px;">ฝ่ายสนับสนุนด้านเทคนิค</td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; AUTO NOTIFICATION</td></tr>
    </table>
  </td></tr>
</table>
```

---

## 2. Task Assigned — `task_assigned`

> ตัวแปร: `{{task_title}}` `{{assigned_name}}` `{{due_date}}` `{{task_note}}` `{{link}}`

**Subject:**
```
มอบหมายงานใหม่: {{task_title}}
```

**Body:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="#3b5278" style="padding:8px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:22px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:bold;">มอบหมายงานใหม่</td></tr>
      <tr><td bgcolor="#16263f" style="padding:10px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#9fb0c9;font-size:12px;letter-spacing:1px;">IT SERVICES CO.,LTD. &nbsp;·&nbsp; HELPDESK SYSTEM</td></tr>
      <tr><td style="padding:28px;font-family:'Segoe UI',Arial,sans-serif;color:#333333;font-size:14px;line-height:1.7;">
        <p style="margin:0 0 14px;font-size:15px;">เรียน คุณ <strong>{{assigned_name}}</strong></p>
        <p style="margin:0 0 24px;color:#555555;">คุณได้รับมอบหมาย Task ใหม่ กรุณาตรวจสอบและดำเนินการครับ</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
          <tr><td style="padding:14px 18px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;">รายละเอียด TASK</td></tr>
          <tr><td style="padding:0 18px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
              <tr><td style="padding:5px 0;color:#888888;width:90px;vertical-align:top;">เรื่อง</td><td style="padding:5px 0;color:#1c2e4a;font-weight:bold;">{{task_title}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">กำหนดส่ง</td><td style="padding:5px 0;color:#222222;">{{due_date}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">รายละเอียด</td><td style="padding:5px 0;color:#222222;">{{task_note}}</td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
          <tr><td bgcolor="#eaf2fb" style="padding:12px 16px;border-left:4px solid #2f6fed;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:13px;line-height:1.6;">เปิดดูรายละเอียดงานและอัปเดตสถานะได้ที่ระบบ Helpdesk หรือ <strong>ตอบกลับอีเมลฉบับนี้</strong>เพื่อสอบถามเพิ่มเติม</td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:6px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td style="padding:18px 28px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:15px;font-weight:bold;">iT Services Co.,Ltd.</td></tr>
      <tr><td style="padding:0 28px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#999999;font-size:12px;">ฝ่ายสนับสนุนด้านเทคนิค</td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; AUTO NOTIFICATION</td></tr>
    </table>
  </td></tr>
</table>
```

---

## 3. Ticket Status Changed — `ticket_status_changed`

> ตัวแปร: `{{ticket_number}}` `{{ticket_title}}` `{{ticket_status}}` `{{customer_name}}` `{{assigned_name}}` `{{link}}`

**Subject:**
```
อัปเดตสถานะ Ticket: {{ticket_number}} → {{ticket_status}}
```

**Body:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="#3b5278" style="padding:8px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:22px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:bold;">อัปเดตสถานะ Ticket</td></tr>
      <tr><td bgcolor="#16263f" style="padding:10px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#9fb0c9;font-size:12px;letter-spacing:1px;">IT SERVICES CO.,LTD. &nbsp;·&nbsp; HELPDESK SYSTEM</td></tr>
      <tr><td style="padding:28px;font-family:'Segoe UI',Arial,sans-serif;color:#333333;font-size:14px;line-height:1.7;">
        <p style="margin:0 0 20px;color:#555555;">Ticket มีการเปลี่ยนแปลงสถานะ รายละเอียดดังนี้</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td bgcolor="#f4f6f9" align="center" style="padding:18px;">
            <div style="font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:6px;">สถานะปัจจุบัน</div>
            <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:22px;font-weight:bold;">{{ticket_status}}</div>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin-top:18px;">
          <tr><td style="padding:5px 0;color:#888888;width:90px;vertical-align:top;">Ticket No.</td><td style="padding:5px 0;color:#1c2e4a;font-weight:bold;">{{ticket_number}}</td></tr>
          <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">หัวข้อ</td><td style="padding:5px 0;color:#222222;">{{ticket_title}}</td></tr>
          <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">ผู้รับผิดชอบ</td><td style="padding:5px 0;color:#222222;">{{assigned_name}}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
          <tr><td bgcolor="#eaf2fb" style="padding:12px 16px;border-left:4px solid #2f6fed;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:13px;line-height:1.6;">อีเมลภายในทีม — <strong>ตอบกลับอีเมลฉบับนี้</strong>เพื่อสื่อสารต่อในเรื่องนี้ได้เลย</td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:6px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td style="padding:18px 28px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:15px;font-weight:bold;">iT Services Co.,Ltd.</td></tr>
      <tr><td style="padding:0 28px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#999999;font-size:12px;">ฝ่ายสนับสนุนด้านเทคนิค</td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; AUTO NOTIFICATION</td></tr>
    </table>
  </td></tr>
</table>
```

---

## 4. Comment Added — `comment_added`

> ตัวแปร: `{{ticket_number}}` `{{ticket_title}}` `{{customer_name}}` `{{assigned_name}}` `{{comment_text}}` `{{link}}`

**Subject:**
```
ความคืบหน้าใหม่ Ticket: {{ticket_number}}
```

**Body:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="#3b5278" style="padding:8px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:22px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:bold;">ความคืบหน้าใหม่</td></tr>
      <tr><td bgcolor="#16263f" style="padding:10px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#9fb0c9;font-size:12px;letter-spacing:1px;">IT SERVICES CO.,LTD. &nbsp;·&nbsp; HELPDESK SYSTEM</td></tr>
      <tr><td style="padding:28px;font-family:'Segoe UI',Arial,sans-serif;color:#333333;font-size:14px;line-height:1.7;">
        <p style="margin:0 0 16px;color:#555555;"><strong>{{assigned_name}}</strong> ได้เพิ่มความคืบหน้าใหม่ใน Ticket <strong>{{ticket_number}}</strong></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;padding-bottom:6px;">ข้อความ</td></tr>
          <tr><td bgcolor="#eaf2fb" style="padding:14px 16px;border-left:4px solid #2f6fed;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:14px;line-height:1.6;">{{comment_text}}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin-top:18px;">
          <tr><td style="padding:5px 0;color:#888888;width:90px;vertical-align:top;">หัวข้อ</td><td style="padding:5px 0;color:#222222;">{{ticket_title}}</td></tr>
        </table>
        <p style="margin:18px 0 0;color:#888888;font-size:13px;">อีเมลภายในทีม — ตอบกลับเพื่อสื่อสารต่อในเรื่องนี้ได้เลยครับ</p>
      </td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:6px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td style="padding:18px 28px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:15px;font-weight:bold;">iT Services Co.,Ltd.</td></tr>
      <tr><td style="padding:0 28px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#999999;font-size:12px;">ฝ่ายสนับสนุนด้านเทคนิค</td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; AUTO NOTIFICATION</td></tr>
    </table>
  </td></tr>
</table>
```

---

## 4.1 Incident Created — `incident_created`  (แจ้ง Assigned)

> ตัวแปร: `{{incident_title}}` `{{severity}}` `{{incident_status}}` `{{assigned_name}}` `{{description}}` `{{link}}`

**Subject:**
```
แจ้ง Incident ใหม่: {{incident_title}}
```

**Body:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="#3b5278" style="padding:8px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:22px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:bold;">แจ้ง Incident ใหม่</td></tr>
      <tr><td bgcolor="#16263f" style="padding:10px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#9fb0c9;font-size:12px;letter-spacing:1px;">IT SERVICES CO.,LTD. &nbsp;·&nbsp; HELPDESK SYSTEM</td></tr>
      <tr><td style="padding:28px;font-family:'Segoe UI',Arial,sans-serif;color:#333333;font-size:14px;line-height:1.7;">
        <p style="margin:0 0 14px;font-size:15px;">เรียน คุณ <strong>{{assigned_name}}</strong></p>
        <p style="margin:0 0 24px;color:#555555;">คุณได้รับมอบหมายให้ดูแล Incident ใหม่ กรุณาตรวจสอบและดำเนินการครับ</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
          <tr><td style="padding:14px 18px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;">รายละเอียด INCIDENT</td></tr>
          <tr><td style="padding:0 18px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
              <tr><td style="padding:5px 0;color:#888888;width:100px;vertical-align:top;">เรื่อง</td><td style="padding:5px 0;color:#1c2e4a;font-weight:bold;">{{incident_title}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">ความรุนแรง</td><td style="padding:5px 0;color:#c0392b;font-weight:bold;">{{severity}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">สถานะ</td><td style="padding:5px 0;color:#222222;">{{incident_status}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">รายละเอียด</td><td style="padding:5px 0;color:#222222;">{{description}}</td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
          <tr><td bgcolor="#eaf2fb" style="padding:12px 16px;border-left:4px solid #2f6fed;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:13px;line-height:1.6;">เข้าระบบเพื่อดูรายละเอียดและอัปเดตสถานะ หรือ <strong>ตอบกลับอีเมลฉบับนี้</strong>เพื่อสอบถามเพิ่มเติม</td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:6px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td style="padding:18px 28px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:15px;font-weight:bold;">iT Services Co.,Ltd.</td></tr>
      <tr><td style="padding:0 28px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#999999;font-size:12px;">ฝ่ายสนับสนุนด้านเทคนิค</td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; AUTO NOTIFICATION</td></tr>
    </table>
  </td></tr>
</table>
```

---

## 4.2 Incident Status Changed — `incident_status_changed`  (แจ้ง Requester)

> ตัวแปร: `{{incident_title}}` `{{incident_status}}` `{{severity}}` `{{assigned_name}}` `{{resolution}}` `{{link}}`

**Subject:**
```
อัปเดตสถานะ Incident: {{incident_title}} → {{incident_status}}
```

**Body:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="#3b5278" style="padding:8px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:22px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:bold;">อัปเดตสถานะ Incident</td></tr>
      <tr><td bgcolor="#16263f" style="padding:10px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#9fb0c9;font-size:12px;letter-spacing:1px;">IT SERVICES CO.,LTD. &nbsp;·&nbsp; HELPDESK SYSTEM</td></tr>
      <tr><td style="padding:28px;font-family:'Segoe UI',Arial,sans-serif;color:#333333;font-size:14px;line-height:1.7;">
        <p style="margin:0 0 20px;color:#555555;">Incident ที่คุณแจ้งไว้มีการเปลี่ยนแปลงสถานะ รายละเอียดดังนี้</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td bgcolor="#f4f6f9" align="center" style="padding:18px;">
            <div style="font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:6px;">สถานะปัจจุบัน</div>
            <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:22px;font-weight:bold;">{{incident_status}}</div>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin-top:18px;">
          <tr><td style="padding:5px 0;color:#888888;width:100px;vertical-align:top;">เรื่อง</td><td style="padding:5px 0;color:#1c2e4a;font-weight:bold;">{{incident_title}}</td></tr>
          <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">ความรุนแรง</td><td style="padding:5px 0;color:#222222;">{{severity}}</td></tr>
          <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">ผู้รับผิดชอบ</td><td style="padding:5px 0;color:#222222;">{{assigned_name}}</td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
          <tr><td style="font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;padding-bottom:6px;">แนวทางแก้ไข</td></tr>
          <tr><td bgcolor="#eaf2fb" style="padding:14px 16px;border-left:4px solid #2f6fed;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:14px;line-height:1.6;">{{resolution}}</td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:6px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td style="padding:18px 28px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:15px;font-weight:bold;">iT Services Co.,Ltd.</td></tr>
      <tr><td style="padding:0 28px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#999999;font-size:12px;">ฝ่ายสนับสนุนด้านเทคนิค</td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; AUTO NOTIFICATION</td></tr>
    </table>
  </td></tr>
</table>
```

---

## 5. Leave Requested — `leave_requested`

> ตัวแปร: `{{requester_name}}` `{{leave_type}}` `{{leave_date}}` `{{approver_name}}` `{{link}}`

**Subject:**
```
คำขอลารอการอนุมัติ — {{requester_name}}
```

**Body:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="#3b5278" style="padding:8px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:22px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:bold;">คำขอลารอการอนุมัติ</td></tr>
      <tr><td bgcolor="#16263f" style="padding:10px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#9fb0c9;font-size:12px;letter-spacing:1px;">IT SERVICES CO.,LTD. &nbsp;·&nbsp; HELPDESK SYSTEM</td></tr>
      <tr><td style="padding:28px;font-family:'Segoe UI',Arial,sans-serif;color:#333333;font-size:14px;line-height:1.7;">
        <p style="margin:0 0 14px;font-size:15px;">เรียน คุณ <strong>{{approver_name}}</strong></p>
        <p style="margin:0 0 24px;color:#555555;">มีคำขอลาใหม่รอการพิจารณาจากคุณ รายละเอียดดังนี้</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f9;">
          <tr><td style="padding:14px 18px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;">รายละเอียดคำขอลา</td></tr>
          <tr><td style="padding:0 18px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
              <tr><td style="padding:5px 0;color:#888888;width:100px;vertical-align:top;">ผู้ขอลา</td><td style="padding:5px 0;color:#1c2e4a;font-weight:bold;">{{requester_name}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">ประเภทการลา</td><td style="padding:5px 0;color:#222222;">{{leave_type}}</td></tr>
              <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">วันที่ลา</td><td style="padding:5px 0;color:#222222;">{{leave_date}}</td></tr>
            </table>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
          <tr><td bgcolor="#eaf2fb" style="padding:12px 16px;border-left:4px solid #2f6fed;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:13px;line-height:1.6;">กรุณาเข้าระบบเพื่อพิจารณาอนุมัติ/ไม่อนุมัติคำขอลานี้</td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:6px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td style="padding:18px 28px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:15px;font-weight:bold;">iT Services Co.,Ltd.</td></tr>
      <tr><td style="padding:0 28px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#999999;font-size:12px;">ฝ่ายสนับสนุนด้านเทคนิค</td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; AUTO NOTIFICATION</td></tr>
    </table>
  </td></tr>
</table>
```

---

## 6. Leave Approved/Rejected — `leave_decision`

> ตัวแปร: `{{requester_name}}` `{{leave_type}}` `{{leave_date}}` `{{leave_status}}` `{{approver_name}}` `{{link}}`

**Subject:**
```
ผลการพิจารณาคำขอลา — {{leave_status}}
```

**Body:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eef1f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:#ffffff;">
      <tr><td bgcolor="#3b5278" style="padding:8px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:22px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:bold;">ผลการพิจารณาคำขอลา</td></tr>
      <tr><td bgcolor="#16263f" style="padding:10px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#9fb0c9;font-size:12px;letter-spacing:1px;">IT SERVICES CO.,LTD. &nbsp;·&nbsp; HELPDESK SYSTEM</td></tr>
      <tr><td style="padding:28px;font-family:'Segoe UI',Arial,sans-serif;color:#333333;font-size:14px;line-height:1.7;">
        <p style="margin:0 0 14px;font-size:15px;">เรียน คุณ <strong>{{requester_name}}</strong></p>
        <p style="margin:0 0 20px;color:#555555;">คำขอลาของคุณได้รับการพิจารณาจาก <strong>{{approver_name}}</strong> เรียบร้อยแล้ว</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td bgcolor="#f4f6f9" align="center" style="padding:18px;">
            <div style="font-family:'Segoe UI',Arial,sans-serif;color:#8a94a6;font-size:11px;font-weight:bold;letter-spacing:1px;margin-bottom:6px;">ผลการพิจารณา</div>
            <div style="font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:22px;font-weight:bold;">{{leave_status}}</div>
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin-top:18px;">
          <tr><td style="padding:5px 0;color:#888888;width:100px;vertical-align:top;">ประเภทการลา</td><td style="padding:5px 0;color:#222222;">{{leave_type}}</td></tr>
          <tr><td style="padding:5px 0;color:#888888;vertical-align:top;">วันที่ลา</td><td style="padding:5px 0;color:#222222;">{{leave_date}}</td></tr>
        </table>
      </td></tr>
      <tr><td bgcolor="#1c2e4a" style="padding:6px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#dfe6f0;font-size:13px;font-weight:bold;letter-spacing:2px;">iT</td></tr>
      <tr><td style="padding:18px 28px 6px;font-family:'Segoe UI',Arial,sans-serif;color:#1c2e4a;font-size:15px;font-weight:bold;">iT Services Co.,Ltd.</td></tr>
      <tr><td style="padding:0 28px 16px;font-family:'Segoe UI',Arial,sans-serif;color:#999999;font-size:12px;">ฝ่ายสนับสนุนด้านเทคนิค</td></tr>
      <tr><td bgcolor="#f4f6f9" style="padding:12px 28px;font-family:'Segoe UI',Arial,sans-serif;color:#aaaaaa;font-size:11px;">iT Services Co.,Ltd. &nbsp;|&nbsp; ฝ่ายสนับสนุนด้านเทคนิค &nbsp;&nbsp; AUTO NOTIFICATION</td></tr>
    </table>
  </td></tr>
</table>
```

---

**หมายเหตุ:**
- ธีม navy เดียวกันทุก template ต่างกันแค่หัวข้อ
- เปลี่ยนชื่อบริษัท/ฝ่าย ได้ที่ footer (3 จุด: ชื่อบริษัท, ฝ่าย, แถบ AUTO NOTIFICATION)
- ไม่ต้อง deploy code — แก้แค่เนื้อหา template ใน Admin (copy Body ไปวาง)
