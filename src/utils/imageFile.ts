/**
 * crop กลางภาพให้เป็นจัตุรัส + ย่อเป็น size px แล้วคืนเป็น PNG File
 * ใช้ก่อนอัปโหลดรูปเล็ก (ไอคอนโครงการ / รูปพนักงาน) — ผู้ใช้มักตัดมาจาก screenshot ใหญ่
 * ย่อฝั่ง client ทำให้โหลดไว ไม่กินพื้นที่ SharePoint และลดโอกาสโดน throttle
 */
export async function makeSquareImageFile(src: File, size: number, prefix: string): Promise<File> {
  const bitmap = await createImageBitmap(src)
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
  bitmap.close?.()
  const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'))
  // ห้ามขึ้นต้นด้วย '_' — SharePoint ปฏิเสธ (ArgumentOutOfRangeException: fileName)
  return new File([blob], `${prefix}${Date.now()}.png`, { type: 'image/png' })
}
