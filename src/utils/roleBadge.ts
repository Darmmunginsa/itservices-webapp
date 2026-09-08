// สีป้ายบทบาทในโครงการ — ใช้ร่วมกันทั้งหน้าโครงการและหน้าผังองค์กร
// อยู่ที่เดียวเพื่อให้คนคนเดียวกันมีสีเดียวกันทุกหน้า ไม่ต้องจำว่าสีไหนคืออะไรใหม่

export const ROLE_BADGE: Record<string, string> = {
  Manager:   'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  Assistant: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Support:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Publisher: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Reviewer:  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  Observer:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  // ยังไม่กำหนด — สีเตือนอ่อน ๆ เพราะเป็นสิ่งที่ต้องไปตามให้ครบ ไม่ใช่สถานะปกติ
  default:   'bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900',
}
