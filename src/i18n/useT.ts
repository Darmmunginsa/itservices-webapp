import { useAppStore } from '../store/useAppStore'
import { TRANSLATIONS } from './translations'

// hook คืนฟังก์ชัน t(key) ที่ re-render ตามภาษาปัจจุบัน
export function useT() {
  const lang = useAppStore(s => s.lang)
  return (key: string) => TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.th[key] ?? key
}
