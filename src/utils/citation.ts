// สร้างข้อความอ้างอิงจากข้อมูลที่ทีมกรอกไว้ — ให้ก็อปไปวางในรายงาน/เอกสารได้เลย
// รูปแบบอิง APA อย่างหลวม ๆ : ผู้แต่ง. (ปี). ชื่อเรื่อง (ครั้งที่พิมพ์). สำนักพิมพ์. เลขอ้างอิง. ตำแหน่ง. URL
// ช่องไหนไม่ได้กรอกก็หายไปทั้งช่อง ไม่ทิ้งจุดหรือวงเล็บเปล่าค้างไว้

export interface CitationParts {
  Title?: string
  Authors?: string
  Year?: string | number
  Publisher?: string
  Edition?: string
  Identifier?: string   // ISBN / DOI / RFC xxxx
  Locator?: string      // บทที่ / หน้า
  URL?: string
}

const clean = (v: unknown): string => String(v ?? '').trim()

export function formatCitation(r: CitationParts): string {
  const parts: string[] = []

  const authors = clean(r.Authors)
  if (authors) parts.push(authors.endsWith('.') ? authors : `${authors}.`)

  const year = clean(r.Year)
  if (year) parts.push(`(${year}).`)

  const title = clean(r.Title)
  const edition = clean(r.Edition)
  if (title) parts.push(edition ? `${title} (${edition}).` : `${title}.`)

  const publisher = clean(r.Publisher)
  if (publisher) parts.push(`${publisher}.`)

  const identifier = clean(r.Identifier)
  if (identifier) parts.push(`${identifier}.`)

  const locator = clean(r.Locator)
  if (locator) parts.push(`${locator}.`)

  const url = clean(r.URL)
  if (url) parts.push(url)

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** บรรณานุกรมทั้งชุด เรียงตามตัวอักษรของบรรทัดที่ได้ — ก็อปไปต่อท้ายรายงานได้ทันที */
export function formatBibliography(rows: CitationParts[]): string {
  return rows
    .map(formatCitation)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'th'))
    .map((line, i) => `${i + 1}. ${line}`)
    .join('\n')
}
