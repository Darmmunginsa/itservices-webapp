import { useEffect, useRef, useState } from 'react'
import { Moon, Sun, LogOut } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { AccentColor } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'

const ACCENT_OPTIONS: { value: AccentColor; bg: string; label: string }[] = [
  { value: 'blue',   bg: '#0F4C81', label: 'Blue'   },
  { value: 'teal',   bg: '#0d9488', label: 'Teal'   },
  { value: 'violet', bg: '#7c3aed', label: 'Violet' },
  { value: 'rose',   bg: '#e11d48', label: 'Rose'   },
  { value: 'amber',  bg: '#d97706', label: 'Amber'  },
]

export function ProfileMenu() {
  const { user, isDarkMode, toggleDarkMode, accentColor, setAccentColor, customAccent, customBg, setCustomAccent, setCustomBg, cardBg, cardOpacity, setCardStyle } = useAppStore()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-primary-300 transition-all"
        title="โปรไฟล์ & ตั้งค่า"
      >
        {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Profile header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.displayName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role}</p>
            </div>
          </div>

          {/* Theme controls */}
          <div className="px-4 py-3 space-y-3">
            <div>
              <p className="text-[10px] text-gray-400 mb-1.5">สีธีม</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {ACCENT_OPTIONS.map(opt => (
                  <button key={opt.value} title={opt.label}
                    onClick={() => { setCustomAccent(null); setAccentColor(opt.value) }}
                    className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                    style={{ backgroundColor: opt.bg, boxShadow: (!customAccent && accentColor === opt.value) ? `0 0 0 2px white, 0 0 0 3px ${opt.bg}` : undefined }} />
                ))}
                <label title="เลือกสีเอง" className="relative w-5 h-5 rounded-full cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600"
                  style={{ background: customAccent ?? 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' }}>
                  <input type="color" value={customAccent ?? '#0F4C81'} onChange={e => setCustomAccent(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">พื้นหลัง</span>
              <label title="เลือกสีพื้นหลัง" className="relative w-5 h-5 rounded cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600"
                style={{ background: customBg ?? '#f8fafc' }}>
                <input type="color" value={customBg ?? '#f8fafc'} onChange={e => setCustomBg(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              {(customAccent || customBg) && (
                <button onClick={() => { setCustomAccent(null); setCustomBg(null) }}
                  className="text-[10px] text-gray-400 hover:text-red-500 underline">รีเซ็ต</button>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">การ์ด</span>
                <label title="สีพื้นหลังการ์ด" className="relative w-5 h-5 rounded cursor-pointer overflow-hidden border border-gray-300 dark:border-gray-600"
                  style={{ background: cardBg ?? '#ffffff' }}>
                  <input type="color" value={cardBg ?? '#ffffff'} onChange={e => setCardStyle(e.target.value, cardOpacity)}
                    className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
                {cardBg && (
                  <button onClick={() => setCardStyle(null, 100)} className="text-[10px] text-gray-400 hover:text-red-500 underline">รีเซ็ต</button>
                )}
              </div>
              {cardBg && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-9">ทึบ</span>
                  <input type="range" min={20} max={100} value={cardOpacity}
                    onChange={e => setCardStyle(cardBg, Number(e.target.value))}
                    className="flex-1 accent-primary-600 h-1" />
                  <span className="text-[10px] text-gray-400 w-7 text-right">{cardOpacity}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-1.5">
            <button onClick={toggleDarkMode}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10">
              <LogOut size={16} />
              ออกจากระบบ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
