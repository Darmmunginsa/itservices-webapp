import { create } from 'zustand'
import type { UserProfile } from '../types/common'
import type { DateMatch } from '../utils/detectDates'

export type AccentColor = 'blue' | 'teal' | 'violet' | 'rose' | 'amber'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface AppState {
  user: UserProfile | null
  isDarkMode: boolean
  accentColor: AccentColor
  customAccent: string | null
  customBg: string | null
  cardBg: string | null
  cardOpacity: number
  mobileNavOpen: boolean
  toasts: Toast[]
  setUser: (user: UserProfile | null) => void
  toggleDarkMode: () => void
  setAccentColor: (color: AccentColor) => void
  setCustomAccent: (hex: string | null) => void
  setCustomBg: (hex: string | null) => void
  setCardStyle: (hex: string | null, opacity: number) => void
  setMobileNavOpen: (open: boolean) => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
  dateTaskModal: DateMatch | null
  openDateTaskModal: (match: DateMatch) => void
  closeDateTaskModal: () => void
}

function applyAccent(color: AccentColor) {
  if (color === 'blue') {
    document.documentElement.removeAttribute('data-accent')
  } else {
    document.documentElement.setAttribute('data-accent', color)
  }
}

function loadAccent(email?: string): AccentColor {
  const key = email ? `accent_${email}` : 'accent'
  return (localStorage.getItem(key) as AccentColor) ?? 'blue'
}

// ── Custom theme (free color picker) ──
function hexToRgb(h: string): [number, number, number] {
  h = h.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function mix([r, g, b]: [number, number, number], t: number, target: number): string {
  const m = (c: number) => Math.round(c + (target - c) * t)
  return `#${[m(r), m(g), m(b)].map(x => x.toString(16).padStart(2, '0')).join('')}`
}
// Generate primary-50..950 from a base color (treated as 600), apply to :root
function applyCustomAccent(hex: string | null) {
  const root = document.documentElement
  const vars = ['--primary-50','--primary-100','--primary-200','--primary-300','--primary-400','--primary-500','--primary-600','--primary-700','--primary-800','--primary-900','--primary-950']
  if (!hex) { vars.forEach(v => root.style.removeProperty(v)); return }
  const rgb = hexToRgb(hex)
  const scale: Record<string, string> = {
    '--primary-50':  mix(rgb, 0.92, 255),
    '--primary-100': mix(rgb, 0.82, 255),
    '--primary-200': mix(rgb, 0.65, 255),
    '--primary-300': mix(rgb, 0.45, 255),
    '--primary-400': mix(rgb, 0.22, 255),
    '--primary-500': mix(rgb, 0.08, 255),
    '--primary-600': hex,
    '--primary-700': mix(rgb, 0.18, 0),
    '--primary-800': mix(rgb, 0.34, 0),
    '--primary-900': mix(rgb, 0.50, 0),
    '--primary-950': mix(rgb, 0.66, 0),
  }
  Object.entries(scale).forEach(([k, v]) => root.style.setProperty(k, v))
}
function applyCustomBg(hex: string | null) {
  const root = document.documentElement
  if (!hex) root.style.removeProperty('--app-bg')
  else root.style.setProperty('--app-bg', hex)
}
// Card background (hex) + opacity (0-100). Sets --card-bg (rgba) + --card-blur.
function applyCardStyle(hex: string | null, opacity: number) {
  const root = document.documentElement
  if (!hex) {
    root.style.removeProperty('--card-bg')
    root.style.removeProperty('--card-blur')
    return
  }
  const [r, g, b] = hexToRgb(hex)
  const a = Math.max(0, Math.min(100, opacity)) / 100
  root.style.setProperty('--card-bg', `rgba(${r},${g},${b},${a})`)
  root.style.setProperty('--card-blur', a < 0.95 ? 'blur(8px)' : 'none')
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isDarkMode: localStorage.getItem('darkMode') === 'true',
  mobileNavOpen: false,
  accentColor: (() => {
    const saved = (localStorage.getItem('accent') as AccentColor) ?? 'blue'
    applyAccent(saved)
    return saved
  })(),
  customAccent: (() => {
    const v = localStorage.getItem('customAccent'); if (v) applyCustomAccent(v); return v
  })(),
  customBg: (() => {
    const v = localStorage.getItem('customBg'); if (v) applyCustomBg(v); return v
  })(),
  cardBg: (() => {
    const v = localStorage.getItem('cardBg') || null
    const op = Number(localStorage.getItem('cardOpacity') ?? '100')
    if (v) applyCardStyle(v, op)
    return v
  })(),
  cardOpacity: Number(localStorage.getItem('cardOpacity') ?? '100'),
  toasts: [],
  dateTaskModal: null,

  setUser: (user) => {
    set({ user })
    // Re-load accent keyed by email once user is known
    if (user?.email) {
      const color = loadAccent(user.email)
      applyAccent(color)
      const ca = localStorage.getItem(`customAccent_${user.email}`) || null
      const cb = localStorage.getItem(`customBg_${user.email}`) || null
      const cardb = localStorage.getItem(`cardBg_${user.email}`) || null
      const cardo = Number(localStorage.getItem(`cardOpacity_${user.email}`) ?? '100')
      applyCustomAccent(ca)
      applyCustomBg(cb)
      applyCardStyle(cardb, cardo)
      set({ accentColor: color, customAccent: ca, customBg: cb, cardBg: cardb, cardOpacity: cardo })
    }
  },

  toggleDarkMode: () => set((s) => {
    const next = !s.isDarkMode
    localStorage.setItem('darkMode', String(next))
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    return { isDarkMode: next }
  }),

  setCustomAccent: (hex) => {
    const email = get().user?.email
    const key = email ? `customAccent_${email}` : 'customAccent'
    if (hex) localStorage.setItem(key, hex); else localStorage.removeItem(key)
    localStorage.setItem('customAccent', hex ?? '')
    if (!hex) localStorage.removeItem('customAccent')
    applyCustomAccent(hex)
    set({ customAccent: hex })
  },

  setCustomBg: (hex) => {
    const email = get().user?.email
    const key = email ? `customBg_${email}` : 'customBg'
    if (hex) localStorage.setItem(key, hex); else localStorage.removeItem(key)
    localStorage.setItem('customBg', hex ?? '')
    if (!hex) localStorage.removeItem('customBg')
    applyCustomBg(hex)
    set({ customBg: hex })
  },

  setCardStyle: (hex, opacity) => {
    const email = get().user?.email
    if (hex) {
      localStorage.setItem('cardBg', hex); localStorage.setItem('cardOpacity', String(opacity))
      if (email) { localStorage.setItem(`cardBg_${email}`, hex); localStorage.setItem(`cardOpacity_${email}`, String(opacity)) }
    } else {
      localStorage.removeItem('cardBg'); localStorage.removeItem('cardOpacity')
      if (email) { localStorage.removeItem(`cardBg_${email}`); localStorage.removeItem(`cardOpacity_${email}`) }
    }
    applyCardStyle(hex, opacity)
    set({ cardBg: hex, cardOpacity: opacity })
  },

  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),

  setAccentColor: (color) => {
    const email = get().user?.email
    const key = email ? `accent_${email}` : 'accent'
    localStorage.setItem(key, color)
    applyAccent(color)
    set({ accentColor: color })
  },

  addToast: (type, message) => set((s) => {
    const id = crypto.randomUUID()
    setTimeout(() => { s.removeToast(id) }, 4000)
    return { toasts: [...s.toasts, { id, type, message }] }
  }),

  removeToast: (id) => set((s) => ({
    toasts: s.toasts.filter(t => t.id !== id),
  })),

  openDateTaskModal: (match) => set({ dateTaskModal: match }),
  closeDateTaskModal: () => set({ dateTaskModal: null }),
}))
