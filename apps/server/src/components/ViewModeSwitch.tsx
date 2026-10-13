'use client'

import { useState, useEffect } from 'react'
import { LayoutGrid, Rows } from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

export default function ViewModeSwitch() {
  const { t } = useI18n()
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem('omarker_compact_view')
      if (saved !== null) setCompact(saved === 'true')
    }
    sync()
    window.addEventListener('omarker_settings_changed', sync)
    return () => window.removeEventListener('omarker_settings_changed', sync)
  }, [])

  const setMode = (isCompact: boolean) => {
    setCompact(isCompact)
    localStorage.setItem('omarker_compact_view', String(isCompact))
    window.dispatchEvent(new Event('omarker_settings_changed'))
  }

  return (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
      <button
        onClick={() => setMode(false)}
        title={t('all_bookmarks')}
        className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
          !compact 
            ? 'bg-white shadow-sm text-blue-600' 
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => setMode(true)}
        title={t('compact_mode')}
        className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
          compact 
            ? 'bg-white shadow-sm text-blue-600' 
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Rows className="w-4 h-4" />
      </button>
    </div>
  )
}
