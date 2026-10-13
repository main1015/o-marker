'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, RotateCcw, CheckSquare, Square, X, Loader2 } from 'lucide-react'
import BookmarkCard from './BookmarkCard'
import { useI18n } from '@/lib/useI18n'
import { DEFAULT_PAGE_SIZE } from '@/lib/constants'

type BookmarkItem = {
  id: string
  url: string
  title: string | null
  description?: string | null
  coverImg: string | null
  status: string
  isFavorite?: boolean
  collectionId: string | null
  collection?: { id: string; name: string } | null
  tags: { id: string; name: string }[]
  createdAt?: string | Date
  lastVisitedAt?: string | Date | null
}

type CollectionOption = {
  id: string
  name: string
  parentId?: string | null
}

interface BookmarkGridProps {
  initialBookmarks: BookmarkItem[]
  collections: CollectionOption[]
  isTrashView?: boolean
  totalCount: number
  pageSize?: number
  activeFilter?: string
  activeCollectionId?: string
  activeTag?: string
  searchQuery?: string
}

export default function BookmarkGrid({
  initialBookmarks,
  collections,
  isTrashView = false,
  totalCount,
  pageSize = DEFAULT_PAGE_SIZE,
  activeFilter = 'all',
  activeCollectionId,
  activeTag,
  searchQuery,
}: BookmarkGridProps) {
  const router = useRouter()
  const { t } = useI18n()
  
  // 书签分页增量数据
  const [items, setItems] = useState<BookmarkItem[]>(initialBookmarks)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialBookmarks.length < totalCount)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // 当外部筛选条件或初始列表变动时重置
  useEffect(() => {
    setItems(initialBookmarks)
    setPage(1)
    setHasMore(initialBookmarks.length < totalCount)
    setSelectedIds(new Set())
  }, [initialBookmarks, totalCount, activeFilter, activeCollectionId, activeTag, searchQuery])

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isActionLoading, setIsActionLoading] = useState(false)

  // 只要有选中的项目，卡片即处于可选择状态
  const isSelectable = selectedIds.size > 0

  // 监听键盘 Esc 快捷键取消选择
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectable) {
        setSelectedIds(new Set())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelectable])

  // 增量加载下一页
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const params = new URLSearchParams()
      params.set('page', String(nextPage))
      params.set('limit', String(pageSize))
      if (activeFilter) params.set('filter', activeFilter)
      if (activeCollectionId) params.set('collectionId', activeCollectionId)
      if (activeTag) params.set('tag', activeTag)
      if (searchQuery) params.set('q', searchQuery)

      const res = await fetch(`/api/bookmarks?${params.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id))
          const newItems = json.data.filter((i: BookmarkItem) => !existingIds.has(i.id))
          return [...prev, ...newItems]
        })
        setPage(nextPage)
        setHasMore(Boolean(json.pagination?.hasMore))
      } else {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Failed to load more bookmarks:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, page, activeFilter, activeCollectionId, activeTag, searchQuery])

  // IntersectionObserver 视口哨兵检测 (提前 250px 预加载)
  useEffect(() => {
    if (!hasMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '250px' }
    )

    const el = sentinelRef.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasMore, isLoadingMore, loadMore])

  // 切换单个书签勾选
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // 全选当前已加载的所有书签
  const handleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(items.map((b) => b.id)))
    }
  }

  // 取消所有选择
  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  // 批量移入废纸篓 / 批量彻底删除
  const handleBatchDelete = async (permanent: boolean = false) => {
    if (selectedIds.size === 0) return

    const count = selectedIds.size
    const confirmMsg = permanent
      ? t('confirm_batch_delete').replace('{count}', String(count))
      : t('confirm_batch_trash').replace('{count}', String(count))

    if (!window.confirm(confirmMsg)) return

    setIsActionLoading(true)
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          permanent,
        }),
      })
      const data = await res.json()
      if (data.success) {
        // 乐观剔除已删除的书签
        setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)))
        setSelectedIds(new Set())
        router.refresh()
      } else {
        alert(data.error || t('action_failed'))
      }
    } catch {
      alert(t('network_error'))
    } finally {
      setIsActionLoading(false)
    }
  }

  // 批量从废纸篓恢复
  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return

    setIsActionLoading(true)
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: 'restore',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)))
        setSelectedIds(new Set())
        router.refresh()
      } else {
        alert(data.error || t('action_failed'))
      }
    } catch {
      alert(t('network_error'))
    } finally {
      setIsActionLoading(false)
    }
  }

  return (
    <div className="relative">
      {/* 顶部快速全选 / 取消全选操作区 */}
      {items.length > 0 && (
        <div className="flex items-center justify-end gap-2 mb-4">
          {selectedIds.size > 0 && selectedIds.size < items.length && (
            <button
              type="button"
              onClick={handleDeselectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all whitespace-nowrap cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t('deselect_all')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSelectAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shadow-2xs cursor-pointer ${
              selectedIds.size === items.length
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : selectedIds.size > 0
                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            {selectedIds.size === items.length ? (
              <CheckSquare className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            <span>
              {selectedIds.size === items.length
                ? t('deselect_all')
                : t('select_all')}
            </span>
          </button>
        </div>
      )}

      {/* 书签瀑布流网格 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {items.map((bm) => (
          <BookmarkCard
            key={bm.id}
            bookmark={bm}
            collections={collections}
            isTrashView={isTrashView}
            selectable={isSelectable}
            selected={selectedIds.has(bm.id)}
            onToggleSelect={handleToggleSelect}
          />
        ))}
      </div>

      {/* 滚动监听哨兵与底部加载状态 */}
      <div ref={sentinelRef} className="py-8 flex items-center justify-center">
        {isLoadingMore ? (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-slate-200 shadow-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            <span>{t('loading_more')}</span>
          </div>
        ) : !hasMore && items.length > 0 ? (
          <div className="text-[11px] text-slate-400 tracking-wider">
            · {t('all_loaded').replace('{count}', String(items.length))} ·
          </div>
        ) : null}
      </div>

      {/* 底部浮动批量操作条 (Bulk Action Floating Bar) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 px-5 py-3 bg-slate-900/90 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/50">
            {/* 已选择计数 */}
            <div className="flex items-center gap-2 pr-3 border-r border-slate-700 whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs font-semibold tracking-wide">
                {t('selected_items').replace('{count}', String(selectedIds.size))}
              </span>
            </div>

            {/* 全选 / 反选 */}
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-slate-300 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {selectedIds.size === items.length ? t('deselect_all') : t('select_all')}
            </button>

            {/* 动作按钮组 */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-700 shrink-0">
              {isTrashView ? (
                <>
                  {/* 废纸篓视图下：批量恢复 */}
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleBatchRestore}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium transition-all shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('batch_restore')}</span>
                  </button>

                  {/* 废纸篓视图下：彻底删除 */}
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => handleBatchDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-medium transition-all shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('batch_delete_permanently')}</span>
                  </button>
                </>
              ) : (
                /* 常规视图下：批量移入废纸篓 */
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={() => handleBatchDelete(false)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-medium transition-all shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('batch_trash')}</span>
                </button>
              )}
            </div>

            {/* 取消 / 关闭 */}
            <button
              type="button"
              onClick={handleDeselectAll}
              title={t('exit_selection')}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
