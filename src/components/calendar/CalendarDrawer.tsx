import { useState } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { OutlookCalendar } from './OutlookCalendar'
import { CompanyCalendar } from './CompanyCalendar'
import { AssetCalendar } from './AssetCalendar'
import { useT } from '../../i18n/useT'

interface Props {
  open: boolean
  onClose: () => void
}

export function CalendarDrawer({ open, onClose }: Props) {
  const tr = useT()
  const [calTab, setCalTab] = useState<'outlook' | 'company' | 'asset'>('outlook')

  return (
    <>
      {/* Backdrop — mobile only */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer panel — slides up from bottom */}
      <div
        className={`fixed inset-x-0 bottom-0 md:inset-x-auto md:right-4 md:bottom-0 md:w-[26rem] z-50 transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t border-x border-gray-200 dark:border-gray-800 max-h-[82vh] md:max-h-[80vh] flex flex-col">

          {/* Header / pull handle */}
          <div
            className="relative flex items-center justify-between px-4 pt-4 pb-3 cursor-pointer select-none"
            onClick={onClose}
          >
            {/* Drag handle pill */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-primary-600" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{tr('cal.calendar')}</span>
            </div>
            <ChevronDown size={16} className="text-gray-400" />
          </div>

          {/* Tab selector */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mx-4 mb-3 flex-shrink-0">
            <button
              onClick={() => setCalTab('outlook')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                calTab === 'outlook'
                  ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-500'
              }`}
            >
              📅 Outlook
            </button>
            <button
              onClick={() => setCalTab('company')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                calTab === 'company'
                  ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-500'
              }`}
            >
              {tr('cal.company')}
            </button>
            <button
              onClick={() => setCalTab('asset')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                calTab === 'asset'
                  ? 'bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-500'
              }`}
            >
              🖥 Asset
            </button>
          </div>

          {/* Scrollable calendar content */}
          <div className="flex-1 overflow-y-auto px-4 pb-safe pb-6">
            {calTab === 'outlook' ? <OutlookCalendar /> : calTab === 'company' ? <CompanyCalendar /> : <AssetCalendar />}
          </div>
        </div>
      </div>
    </>
  )
}
