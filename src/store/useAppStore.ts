import { create } from 'zustand'
import type { UserProfile } from '../types/common'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface AppState {
  user: UserProfile | null
  isDarkMode: boolean
  toasts: Toast[]
  setUser: (user: UserProfile | null) => void
  toggleDarkMode: () => void
  addToast: (type: Toast['type'], message: string) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isDarkMode: localStorage.getItem('darkMode') === 'true',
  toasts: [],

  setUser: (user) => set({ user }),

  toggleDarkMode: () => set((s) => {
    const next = !s.isDarkMode
    localStorage.setItem('darkMode', String(next))
    if (next) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    return { isDarkMode: next }
  }),

  addToast: (type, message) => set((s) => {
    const id = crypto.randomUUID()
    setTimeout(() => {
      s.removeToast(id)
    }, 4000)
    return { toasts: [...s.toasts, { id, type, message }] }
  }),

  removeToast: (id) => set((s) => ({
    toasts: s.toasts.filter(t => t.id !== id),
  })),
}))
