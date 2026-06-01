import { create } from 'zustand'
import type { UserProfile } from '../types/common'

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
  toasts: Toast[]
  setUser: (user: UserProfile | null) => void
  toggleDarkMode: () => void
  setAccentColor: (color: AccentColor) => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
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

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isDarkMode: localStorage.getItem('darkMode') === 'true',
  accentColor: (() => {
    const saved = (localStorage.getItem('accent') as AccentColor) ?? 'blue'
    applyAccent(saved)
    return saved
  })(),
  toasts: [],

  setUser: (user) => {
    set({ user })
    // Re-load accent keyed by email once user is known
    if (user?.email) {
      const color = loadAccent(user.email)
      applyAccent(color)
      set({ accentColor: color })
    }
  },

  toggleDarkMode: () => set((s) => {
    const next = !s.isDarkMode
    localStorage.setItem('darkMode', String(next))
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    return { isDarkMode: next }
  }),

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
}))
