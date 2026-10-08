// "ดึงออกไปอีกจอ" — เปิดหน้าในหน้าต่างใหม่แบบไม่มีเมนูข้าง ไว้วางคู่กับงานอื่น
//
// ใช้ HashRouter: ลิงก์คือ  <origin><pathname>#/team-status?popout=1
// ตัว ?popout=1 อยู่หลัง # จึงไม่ไปรบกวน redirect ของ MSAL (ซึ่งดู query หน้า #)
// MSAL เก็บ token ใน localStorage → หน้าต่างใหม่ล็อกอินให้เองไม่ต้องกรอกซ้ำ

export const POPOUT_PARAM = 'popout'
export const POPOUT_WINDOW_NAME = 'hd-popout'

/** search ของ react-router (เช่น '?popout=1') บอกว่าเป็นหน้าต่างที่ดึงออกมาไหม */
export function isPopout(search: string): boolean {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get(POPOUT_PARAM) === '1'
}

/** URL เต็มสำหรับ window.open — route เป็นเส้นทางในแอป เช่น '/team-status' */
export function popoutUrl(route: string, loc: { origin: string; pathname: string } = window.location): string {
  const r = route.startsWith('/') ? route : `/${route}`
  const sep = r.includes('?') ? '&' : '?'
  return `${loc.origin}${loc.pathname}#${r}${sep}${POPOUT_PARAM}=1`
}

/** ขนาดหน้าต่าง — กว้างพอให้แผนที่ + แชทอยู่ข้างกัน แต่ไม่เต็มจอ จะได้วางคู่งานอื่นได้ */
export function popoutFeatures(screenW = window.screen.availWidth, screenH = window.screen.availHeight): string {
  const w = Math.min(1180, Math.max(720, Math.floor(screenW * 0.6)))
  const h = Math.min(860, Math.max(560, Math.floor(screenH * 0.8)))
  const left = Math.max(0, screenW - w - 24)
  const top = Math.max(0, Math.floor((screenH - h) / 2))
  return `popup=yes,width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
}

/** เปิด (หรือโฟกัสหน้าต่างเดิมถ้ายังเปิดอยู่ — ใช้ชื่อหน้าต่างเดียวกัน) · คืน false ถ้าเบราว์เซอร์บล็อก */
export function openPopout(route: string): boolean {
  const w = window.open(popoutUrl(route), POPOUT_WINDOW_NAME, popoutFeatures())
  if (!w) return false
  w.focus()
  return true
}

/** ชื่อแท็บตอนมีข้อความใหม่ที่ยังไม่ได้อ่าน — "(3) สถานะทีม" */
export function unreadTitle(base: string, unread: number): string {
  return unread > 0 ? `(${unread > 99 ? '99+' : unread}) ${base}` : base
}
