// ส่งข้อความแชท (ออฟฟิศ / ส่วนตัว) พร้อมตอบกลับ + ไฟล์แนบ
// ตั้งชื่อไฟล์ก่อน → ฝังชื่อในข้อความ → สร้างแถว → แนบไฟล์ด้วยชื่อนั้น (ชื่อในข้อความตรงกับไฟล์จริงเสมอ)

import { safeAttachmentName, spUploadAttachment, spWaitForItem } from './sharepoint'
import { encodeMsg, type ChatReply } from '../utils/chatMeta'

export async function sendWithFiles(
  list: string, create: (raw: string) => Promise<{ id: number }>,
  text: string, files: File[], reply: ChatReply | null,
): Promise<{ id: number; raw: string; failed: string[] }> {
  const names = files.map(f => safeAttachmentName(f.name, f.type))
  const raw = encodeMsg(text.trim(), { reply: reply ?? undefined, files: names })
  const res = await create(raw)
  const failed: string[] = []
  if (files.length) {
    await spWaitForItem(list, res.id)
    for (let i = 0; i < files.length; i++) {
      try { await spUploadAttachment(list, res.id, files[i], names[i]) } catch { failed.push(files[i].name) }
    }
  }
  return { id: res.id, raw, failed }
}
