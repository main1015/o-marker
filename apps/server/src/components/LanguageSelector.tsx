'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { LANGUAGES, Locale } from '@/lib/i18n'

export default function LanguageSelector() {
  const [locale, setLocale] = useState<Locale>('zh')
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('omarker_locale') as Locale
    if (saved && LANGUAGES.some(l => l.code === saved)) {
      setLocale(saved)
    } else {
      // 默认尝试匹配浏览器语言
      const navLang = navigator.language.toLowerCase()
      if (navLang.startsWith('zh')) setLocale('zh')
      else if (navLang.startsWith('ja')) setLocale('ja')
      else if (navLang.startsWith('de')) setLocale('de')
      else if (navLang.startsWith('fr')) setLocale('fr')
      else if (navLang.startsWith('es')) setLocale('es')
      else if (navLang.startsWith('ru')) setLocale('ru')
      else setLocale('en')
    }
  }, [])

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selectLanguage = (code: Locale) => {
    setLocale(code)
    localStorage.setItem('omarker_locale', code)
    window.dispatchEvent(new Event('omarker_locale_changed'))
    setIsOpen(false)
  }

  const currentLang = LANGUAGES.find(l => l.code === locale) || LANGUAGES[0]

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* 药丸形触发按钮 (精准对齐用户截图风格) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-700/80 rounded-full hover:bg-slate-50 transition-all shadow-sm focus:outline-none"
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.name}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
      </button>

      {/* 垂直下拉菜单 (精准对齐用户截图风格) */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-40 max-h-80 overflow-y-auto bg-white border border-slate-300 rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans divide-y divide-slate-50">
          {LANGUAGES.map((item) => {
            const isSelected = item.code === locale
            return (
              <button
                key={item.code}
                onClick={() => selectLanguage(item.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ${
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
