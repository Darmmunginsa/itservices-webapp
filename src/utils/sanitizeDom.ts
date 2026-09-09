// กรอง HTML ด้วย DOM ของเบราว์เซอร์ตามนโยบายใน utils/richComment
//
// ใช้ DOMParser ไม่ใช่ regex — HTML ที่วางมาจากเมลและ Word มีรูปแบบพิสดารได้มาก
// (แท็กไม่ปิด, attribute ไม่มีเครื่องหมายคำพูด, ความเห็นแบบมีเงื่อนไขของ Word)
// การแกะด้วย regex จะพลาด แล้วสิ่งที่พลาดคือช่องให้รันโค้ด
//
// ตัวไฟล์นี้ต้องมี DOM จึงทดสอบใน node ไม่ได้ — ตัวนโยบาย (แท็ก/attribute/URL ไหน
// ผ่าน) จึงถูกแยกไปอยู่ใน utils/richComment ซึ่งเป็นฟังก์ชันบริสุทธิ์และมีเทสต์

import { isAllowedTag, isDropWhole, isAllowedAttr, safeHref, safeImgSrc } from './richComment'

export interface SanitizeResult {
  html: string
  /** รูปที่แสดงไม่ได้เพราะชี้ไปเครื่องคนวาง — ต้องบอก ไม่ใช่ปล่อยกรอบรูปแตก */
  droppedImages: number
}

/** ปิดช่องที่คนวางฝังโค้ดมาได้ แล้วคืน HTML ที่เอาไปแสดงได้ */
export function sanitizeHtml(input: string): SanitizeResult {
  if (!input?.trim()) return { html: '', droppedImages: 0 }

  // DOMParser แยก parse ออกจากหน้าปัจจุบัน — สคริปต์ในนี้ไม่ทำงาน
  // และรูปยังไม่ถูกโหลด จึงไม่มีคำขอออกไปหาเซิร์ฟเวอร์ของคนอื่นตอนกรอง
  const doc = new DOMParser().parseFromString(`<div id="hd-root">${input}</div>`, 'text/html')
  const root = doc.getElementById('hd-root')
  if (!root) return { html: '', droppedImages: 0 }

  let droppedImages = 0

  const walk = (node: Element) => {
    // เดินถอยหลัง เพราะการลบ/แทนที่ลูกจะทำให้ index ที่เหลือเลื่อน
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes[i]

      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue }
      if (child.nodeType !== Node.ELEMENT_NODE) continue

      const el = child as Element
      const tag = el.tagName.toLowerCase()

      // ทิ้งทั้งก้อน — เนื้อในของ <script>/<style> ไม่ใช่เนื้อหาที่คนอยากอ่าน
      if (isDropWhole(tag)) { el.remove(); continue }

      if (!isAllowedTag(tag)) {
        // แท็กที่ไม่รู้จัก: เก็บลูกไว้ ทิ้งแต่เปลือก ไม่งั้นข้อความข้างในหายไปด้วย
        walk(el)
        while (el.firstChild) node.insertBefore(el.firstChild, el)
        el.remove()
        continue
      }

      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase()
        if (!isAllowedAttr(tag, name)) { el.removeAttribute(attr.name); continue }
        if (name === 'href') {
          const safe = safeHref(attr.value)
          if (safe) el.setAttribute('href', safe)
          else el.removeAttribute('href')
        }
        if (name === 'src') {
          const safe = safeImgSrc(attr.value)
          if (safe) el.setAttribute('src', safe)
          else el.removeAttribute('src')
        }
      }

      if (tag === 'img' && !el.getAttribute('src')) {
        // รูปที่ชี้ไปเครื่องคนวาง — แทนด้วยข้อความ ให้รู้ว่าตรงนี้เคยมีรูป
        droppedImages++
        const note = doc.createElement('span')
        note.setAttribute('data-hd-dropped-img', '1')
        note.textContent = '🖼️ (รูปในเนื้อหาไม่ได้ถูกคัดลอกมา)'
        node.replaceChild(note, el)
        continue
      }

      if (tag === 'a') {
        // ลิงก์ไปเว็บนอกเปิดแท็บใหม่ และไม่ส่ง referrer ออกไป
        const href = el.getAttribute('href') ?? ''
        if (/^https?:/i.test(href)) {
          el.setAttribute('target', '_blank')
          el.setAttribute('rel', 'noopener noreferrer nofollow')
        }
      }
      if (tag === 'img') el.setAttribute('referrerpolicy', 'no-referrer')

      walk(el)
    }
  }

  walk(root)
  return { html: root.innerHTML, droppedImages }
}
