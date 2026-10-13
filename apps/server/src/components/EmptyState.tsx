'use client'

import { Compass } from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

export default function EmptyState({ searchQuery }: { searchQuery?: string }) {
  const { t } = useI18n()

  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <Compass className="w-12 h-12 mb-4 opacity-20" />
      <p>
        {searchQuery
          ? `${t('empty_search_prefix')}${searchQuery}${t('empty_search_suffix')}`
          : t('empty_bookmarks')}
      </p>
    </div>
  )
}
