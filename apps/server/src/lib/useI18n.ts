'use client'

import { useState, useEffect } from 'react'
import { Locale, getTranslation } from './i18n'

export function useI18n() {
  const [locale, setLocale] = useState<Locale>('zh')

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem('omarker_locale') as Locale
      if (saved) setLocale(saved)
    }
    sync()
    window.addEventListener('omarker_locale_changed', sync)
    return () => window.removeEventListener('omarker_locale_changed', sync)
  }, [])

  const t = (key: string) => getTranslation(locale, key)

  return { locale, t }
}
