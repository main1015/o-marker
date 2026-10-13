'use client'

import { Compass, Link2, Trash2, Star } from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

interface SidebarNavProps {
  activeFilter: string
  activeCollection?: string
  activeTag?: string
  totalActiveCount: number
  unclassifiedCount: number
  trashCount: number
  favoritesCount?: number
}

export default function SidebarNav({
  activeFilter,
  activeCollection,
  activeTag,
  totalActiveCount,
  unclassifiedCount,
  trashCount,
  favoritesCount = 0,
}: SidebarNavProps) {
  const { t } = useI18n()

  const getMenuClass = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
      isActive
        ? 'bg-white shadow-sm text-blue-600 font-medium'
        : 'text-slate-600 hover:bg-slate-200/50'
    }`

  return (
    <div className="space-y-1">
      <a
        href="/"
        className={getMenuClass(activeFilter === 'all' && !activeCollection && !activeTag)}
      >
        <Compass className="w-4 h-4" />
        <span className="flex-1 text-sm">{t('all_bookmarks')}</span>
        <span className="text-xs opacity-60">{totalActiveCount}</span>
      </a>
      <a
        href="/?filter=favorites"
        className={getMenuClass(activeFilter === 'favorites')}
      >
        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        <span className="flex-1 text-sm">{t('favorites')}</span>
        <span className="text-xs opacity-60">{favoritesCount}</span>
      </a>
      <a
        href="/?filter=unclassified"
        className={getMenuClass(activeFilter === 'unclassified')}
      >
        <Link2 className="w-4 h-4" />
        <span className="flex-1 text-sm">{t('unclassified')}</span>
        <span className="text-xs opacity-60">{unclassifiedCount}</span>
      </a>
      <a
        href="/?filter=trash"
        className={getMenuClass(activeFilter === 'trash')}
      >
        <Trash2 className="w-4 h-4" />
        <span className="flex-1 text-sm">{t('trash')}</span>
        {trashCount > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
            {trashCount}
          </span>
        )}
      </a>
    </div>
  )
}

