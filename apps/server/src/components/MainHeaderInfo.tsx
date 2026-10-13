'use client'

import { useI18n } from '@/lib/useI18n'

interface MainHeaderInfoProps {
  searchQuery?: string
  activeFilter: string
  activeCollection?: string
  activeCollectionName?: string
  activeTag?: string
  totalCount: number
}

export default function MainHeaderInfo({
  searchQuery,
  activeFilter,
  activeCollection,
  activeCollectionName,
  activeTag,
  totalCount,
}: MainHeaderInfoProps) {
  const { t } = useI18n()

  const getTitle = () => {
    if (searchQuery) return `${t('search_result_for')}"${searchQuery}"`
    if (activeFilter === 'unclassified') return t('unclassified')
    if (activeFilter === 'trash') return t('trash')
    if (activeCollection) return activeCollectionName || t('collections')
    if (activeTag) return `#${activeTag}`
    return t('all_bookmarks')
  }

  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-2xl font-bold text-slate-800">{getTitle()}</h2>
      <span className="text-sm text-slate-500">
        {t('total_items_prefix')}
        {totalCount}
        {t('total_items_suffix')}
      </span>
    </div>
  )
}
