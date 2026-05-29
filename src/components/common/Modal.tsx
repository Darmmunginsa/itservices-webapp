import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/colorUtils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  // Use portal so CSS transforms on parent components (e.g. CalendarDrawer's
  // translate-y animation) don't create a new containing block for this fixed element.
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full border border-gray-200 dark:border-gray-700 flex flex-col max-h-[calc(100vh-2rem)]',
        sizes[size]
      )}>
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body
  )
}
