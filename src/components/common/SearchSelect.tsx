import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useT } from '../../i18n/useT'

export interface SelectOption {
  value: string
  label: string
}

// ── Single-value searchable select ──────────────────────────────────────────
interface SearchSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  className?: string
  disabled?: boolean
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder: placeholderProp,
  emptyLabel: emptyLabelProp,
  className = '',
  disabled = false,
}: SearchSelectProps) {
  const tr = useT()
  const placeholder = placeholderProp ?? tr('ss.placeholder')
  const emptyLabel = emptyLabelProp ?? tr('ss.empty')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  // Close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function pick(val: string) {
    onChange(val)
    setOpen(false)
    setQuery('')
  }

  const borderClass = open
    ? 'border-primary-500 ring-2 ring-primary-500'
    : 'border-gray-200 dark:border-gray-700'

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <div
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-900 ${borderClass} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => { if (!disabled) setOpen(o => !o) }}
      >
        {selected ? (
          <>
            <span className="flex-1 truncate text-gray-900 dark:text-gray-100 text-sm">{selected.label}</span>
            {!disabled && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onChange(''); setQuery('') }}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={13} />
              </button>
            )}
          </>
        ) : (
          <>
            <span className="flex-1 text-gray-400 text-sm">{placeholder}</span>
            <ChevronDown size={13} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="relative z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tr('ss.search')}
              className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            <div
              className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800"
              onMouseDown={e => { e.preventDefault(); pick('') }}
            >
              {emptyLabel}
            </div>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">{tr('ss.noItems')}</p>
            ) : (
              filtered.map(o => (
                <div
                  key={o.value}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 truncate ${
                    o.value === value
                      ? 'text-primary-600 font-medium bg-primary-50 dark:bg-primary-900/10'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                  onMouseDown={e => { e.preventDefault(); pick(o.value) }}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Multi-value searchable select (replaces MultiCheckList) ──────────────────
interface SearchMultiSelectProps {
  label: string
  options: SelectOption[]
  selected: string[]
  onToggle: (value: string) => void
}

export function SearchMultiSelect({ label, options, selected, onToggle }: SearchMultiSelectProps) {
  const tr = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-left"
      >
        <span className="text-gray-600 dark:text-gray-400 truncate">
          {selected.length > 0 ? `${label}: ${selected.length} ${tr('ss.persons')}` : `${tr('ss.select')}${label}...`}
        </span>
        <ChevronDown size={13} className={`text-gray-400 flex-shrink-0 transition-transform ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="relative z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={tr('ss.search')}
              className="w-full px-2 py-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">{tr('ss.noItems')}</p>
            ) : (
              filtered.map(item => (
                <label key={item.value} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.value)}
                    onChange={() => onToggle(item.value)}
                    className="rounded accent-primary-600 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{item.label}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
              {tr('ss.selectedPre')} {selected.length} {tr('ss.persons')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
