import { useState, useEffect, useRef } from 'react'
import { LANGUAGES, type Locale } from './i18n'

export default function LanguageSelector({
  locale,
  onLocaleChange
}: {
  locale: Locale
  onLocaleChange: (loc: Locale) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const currentLang = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0]

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-400 rounded-full hover:bg-slate-50 transition-all shadow-xs"
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.name}</span>
        <span className="text-[9px] text-slate-500">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-36 max-h-64 overflow-y-auto bg-white border border-slate-300 rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans">
          {LANGUAGES.map((item) => {
            const isSelected = item.code === locale
            return (
              <button
                key={item.code}
                onClick={() => {
                  onLocaleChange(item.code)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1 text-xs text-left transition-colors ${
                  isSelected
                    ? 'bg-[#E65100] text-white font-bold'
                    : 'text-slate-800 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="text-sm">{item.flag}</span>
                <span>{item.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
