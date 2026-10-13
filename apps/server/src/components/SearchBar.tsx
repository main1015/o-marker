'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

export default function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { t } = useI18n()

  const currentQ = searchParams.get('q') || ''
  const [value, setValue] = useState(currentQ)

  // 同步 URL 参数到输入框
  useEffect(() => {
    setValue(currentQ)
  }, [currentQ])

  // 执行搜索
  const handleSearch = (newVal: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = newVal.trim()
    if (trimmed) {
      params.set('q', trimmed)
    } else {
      params.delete('q')
    }

    startTransition(() => {
      router.push(`/?${params.toString()}`)
    })
  }

  // 防抖自动搜索 (300ms)
  useEffect(() => {
    if (value === currentQ) return
    const timer = setTimeout(() => {
      handleSearch(value)
    }, 300)
    return () => clearTimeout(timer)
  }, [value])

  // 清空搜索
  const handleClear = () => {
    setValue('')
    handleSearch('')
  }

  return (
    <div className="flex items-center bg-slate-100 rounded-full px-4 py-2 w-96 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all border border-transparent focus-within:border-blue-500/30">
      {isPending ? (
        <Loader2 className="w-4 h-4 text-blue-500 animate-spin mr-2 shrink-0" />
      ) : (
        <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSearch(value)
        }}
        placeholder={t('search_placeholder')}
        className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder-slate-400"
      />
      {value && (
        <button
          onClick={handleClear}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
          title="清空搜索"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
