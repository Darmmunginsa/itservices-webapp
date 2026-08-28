// ดูจาก "ไบต์แรกของไฟล์" ว่าเป็นรูปหรือไม่
//
// ทำไมต้องดูถึงระดับไบต์: ชื่อไฟล์เชื่อไม่ได้ (image001.jfif, .heic, ไม่มีนามสกุล)
// และ SharePoint คืน Content-Type เป็น application/octet-stream ให้ไฟล์แนบเกือบทุกไฟล์
// เหลือทางเดียวที่ตอบได้แน่จริงคือดูลายเซ็นในไฟล์เอง

const ascii = (b: Uint8Array, from: number, len: number): string => {
  let s = ''
  for (let i = from; i < from + len && i < b.length; i++) s += String.fromCharCode(b[i])
  return s
}

const startsWith = (b: Uint8Array, sig: number[]): boolean =>
  sig.length <= b.length && sig.every((v, i) => b[i] === v)

/**
 * คืน MIME ของรูปถ้าไบต์ที่ให้มาเป็นรูป — ไม่ใช่รูปคืน null
 * รับแค่ช่วงต้นไฟล์ก็พอ (32 ไบต์แรกครอบคลุมทุกชนิดที่ตรวจ)
 */
export function sniffImage(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (startsWith(bytes, [0x42, 0x4d])) return 'image/bmp'
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return 'image/tiff'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp'
  // ตระกูล ISO-BMFF: ...ftypheic / ftypavif — รูปจาก iPhone และ AVIF
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (brand.startsWith('hei') || brand === 'mif1' || brand === 'msf1') return 'image/heic'
  }
  // SVG เป็นข้อความ — ดูว่าขึ้นต้นเป็น XML/แท็ก svg ไหม
  const head = ascii(bytes, 0, 32).replace(/^\uFEFF/, '').trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('svg'))) return 'image/svg+xml'
  return null
}

/** เบราว์เซอร์ทั่วไปวาดรูปชนิดนี้ไม่ได้ — รู้ล่วงหน้าดีกว่าปล่อยให้กรอบรูปพัง */
export const browserCanRender = (mime: string): boolean =>
  mime !== 'image/heic' && mime !== 'image/tiff'
