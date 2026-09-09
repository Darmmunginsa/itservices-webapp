// เทียบไฟล์ที่ Add-in "ทำสำเนา" ไว้ กับต้นฉบับใน webapp
//
// ทำไมต้องมี: สองโปรเจกต์ build แยกกัน แชร์ไฟล์ตรง ๆ ไม่ได้ จึงต้องทำสำเนา
// และสำเนาก็เพี้ยนจริง — SLA_TEXT ของ Add-in คืนค่าว่างอยู่หลายเดือน ขณะที่ webapp
// แก้เป็น 'ไม่ได้กำหนด' ไปแล้ว ผลคืออีเมลจาก Add-in มีช่องว่างกลางตาราง
// ไม่มีใครรู้จนกว่าจะไปเปิดดูเทียบทีละบรรทัด
//
// ตรวจ "ตรรกะ" เท่านั้น (ตัดคอมเมนต์กับบรรทัดว่างออก) เพราะคำอธิบายในสำเนา
// ควรต่างได้ — ตัวสำเนามีหมายเหตุว่าเป็นสำเนา ซึ่งต้นฉบับไม่มี

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const webapp = resolve(here, '..')
// วางเป็นโปรเจกต์พี่น้องในโฟลเดอร์เดียวกัน
const addin = resolve(webapp, '..', 'itservices-addin')

/** ไฟล์ที่ต้องเหมือนกันทั้งดุ้น (ตรรกะ) */
const MIRRORED = ['emailQuote.ts', 'incidentMail.ts']

/** ไฟล์ที่ Add-in เอาไปแค่บางส่วน — เทียบเฉพาะบรรทัดที่มีทั้งสองฝั่ง */
const PARTIAL = ['sla.ts']

const logic = (src) =>
  src
    // ล้าง \r ก่อน — ไฟล์เป็น CRLF และจุด . ใน JS ไม่ข้าม \r
    // regex ตัดคอมเมนต์จึงไม่ match ถึงท้ายบรรทัด แล้วคอมเมนต์รอดมาทั้งบรรทัด
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, '').trimEnd())
    .filter(l => l.trim() && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    .join('\n')

if (!existsSync(addin)) {
  console.log(`ข้าม: ไม่พบ ${addin} (ไม่ได้เช็คเอาต์ Add-in ไว้)`)
  process.exit(0)
}

let bad = 0

for (const name of MIRRORED) {
  const a = join(addin, 'src', name)
  const w = join(webapp, 'src', 'utils', name)
  if (!existsSync(a) || !existsSync(w)) { console.log(`ข้าม ${name}: ไม่มีไฟล์ฝั่งใดฝั่งหนึ่ง`); continue }
  const la = logic(readFileSync(a, 'utf8'))
  const lw = logic(readFileSync(w, 'utf8'))
  if (la === lw) { console.log(`OK   ${name}`); continue }
  bad++
  console.log(`ต่างกัน ${name}`)
  const A = la.split('\n'), Wl = lw.split('\n')
  // แสดงไม่เกิน 8 จุด — พอชี้ให้เห็นว่าต่างที่ไหน ไม่ต้องเทข้อความทั้งไฟล์
  let shown = 0
  for (let i = 0; i < Math.max(A.length, Wl.length) && shown < 8; i++) {
    if (A[i] !== Wl[i]) {
      shown++
      console.log(`  บรรทัด ~${i + 1}`)
      console.log(`    add-in: ${A[i] ?? '(ไม่มี)'}`)
      console.log(`    webapp: ${Wl[i] ?? '(ไม่มี)'}`)
    }
  }
}

for (const name of PARTIAL) {
  const a = join(addin, 'src', name)
  const w = join(webapp, 'src', 'utils', name)
  if (!existsSync(a) || !existsSync(w)) { console.log(`ข้าม ${name}: ไม่มีไฟล์ฝั่งใดฝั่งหนึ่ง`); continue }
  // ชื่อ+ลำดับพารามิเตอร์ของฟังก์ชันที่ทั้งสองฝั่งมี ต้องตรงกัน
  // เคยต่างกันจริง: computeSlaDue ตัวที่สองเป็น now ฝั่งหนึ่ง เป็น createdIso อีกฝั่ง
  const sig = (src) => {
    const out = new Map()
    for (const m of src.replace(/\r/g, '').matchAll(/export function (\w+)\(([\s\S]*?)\)\s*:/g)) {
      // ตัดค่า default และจุลภาคท้าย — เทียบชื่อกับลำดับพารามิเตอร์ล้วน ๆ
      out.set(m[1], m[2]
        .replace(/=\s*new Date\(\)/g, '')
        .replace(/\s+/g, ' ')
        .replace(/,\s*$/, '')
        .trim())
    }
    return out
  }
  const sa = sig(readFileSync(a, 'utf8'))
  const sw = sig(readFileSync(w, 'utf8'))
  let ok = true
  for (const [fn, params] of sa) {
    // ฟังก์ชันที่มีแค่ฝั่ง Add-in เป็นเรื่องปกติ (helper ของหน้าจอตัวเอง) ไม่ใช่การเพี้ยน
    if (!sw.has(fn)) continue
    if (sw.get(fn) !== params) {
      console.log(`ต่างกัน ${name}: ${fn}() พารามิเตอร์ไม่ตรง`)
      console.log(`    add-in: (${params})`)
      console.log(`    webapp: (${sw.get(fn)})`)
      ok = false; bad++
    }
  }
  if (ok) console.log(`OK   ${name} (เทียบเฉพาะส่วนที่ Add-in เอาไปใช้)`)
}

if (bad) {
  console.log(`\n${bad} จุดไม่ตรงกัน — แก้ให้ตรงทั้งสองฝั่ง หรืออัปเดตสำเนาใน Add-in`)
  process.exit(1)
}
console.log('\nสำเนาใน Add-in ตรงกับต้นฉบับทั้งหมด')
