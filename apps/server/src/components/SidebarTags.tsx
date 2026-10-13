'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

interface TagItem {
  id: string
  name: string
  _count: { bookmarks: number }
}

export default function SidebarTags({
  tags,
  activeTag,
}: {
  tags: TagItem[]
  activeTag?: string
}) {
  const { t } = useI18n()
  const [isTagsCollapsed, setIsTagsCollapsed] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between px-3 mb-2">
        <button
          type="button"
          onClick={() => setIsTagsCollapsed(!isTagsCollapsed)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors select-none group"
        >
          {isTagsCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
          )}
          <span>{t('tags')}</span>
          <span className="text-[10px] text-slate-400 font-mono normal-case">
            ({tags.length})
          </span>
        </button>
      </div>

      {!isTagsCollapsed && (
        <div className="max-h-[28vh] overflow-y-auto folder-scroll flex flex-wrap gap-1 px-3 pr-1">
          {tags.map((tag) => (
            <a
              key={tag.id}
              href={`/?tag=${tag.name}`}
              className={`px-2 py-1 text-xs rounded-md transition-colors border ${
                activeTag === tag.name
                  ? 'bg-blue-100 text-blue-700 border-blue-200 font-medium'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              #{tag.name} <span className="opacity-50 ml-1">{tag._count.bookmarks}</span>
            </a>
          ))}
          {tags.length === 0 && (
            <div className="text-xs text-slate-400 w-full">{t('no_tags')}</div>
          )}
        </div>
      )}
    </div>
  )
}
