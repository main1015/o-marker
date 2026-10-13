'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Folder, Link2, Trash2, RotateCcw, Tag as TagIcon, X, Check, FolderInput, Pencil, Star, Clock, Eye } from 'lucide-react'
import { useI18n } from '@/lib/useI18n'
import BookmarkEditDrawer from './BookmarkEditDrawer'

// 鼠标悬停平滑跑马灯组件
function MarqueeText({
  text,
  className = '',
  innerClassName = '',
}: {
  text: string
  className?: string
  innerClassName?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflowDistance, setOverflowDistance] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseEnter = () => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const textWidth = textRef.current.scrollWidth
      if (textWidth > containerWidth) {
        setOverflowDistance(textWidth - containerWidth)
        setIsHovered(true)
      } else {
        setOverflowDistance(0)
      }
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  // 速度自适应计算：每秒平移约 45px，保证平滑优雅
  const duration = Math.min(8, Math.max(1.2, overflowDistance / 45))

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`overflow-hidden whitespace-nowrap block relative ${className}`}
      title={text}
    >
      <span
        ref={textRef}
        style={{
          transform: isHovered && overflowDistance > 0 ? `translateX(-${overflowDistance + 8}px)` : 'translateX(0)',
          transition: isHovered && overflowDistance > 0 ? `transform ${duration}s linear` : 'transform 0.25s ease-out',
        }}
        className={`inline-block whitespace-nowrap will-change-transform ${innerClassName}`}
      >
        {text}
      </span>
    </div>
  )
}

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

interface FlatCollectionOption {
  col: CollectionOption
  level: number
  path: string
}

type TreeNode = CollectionOption & { children: TreeNode[] }

function flattenCollectionOptions(collections: CollectionOption[]): FlatCollectionOption[] {
  const itemMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  collections.forEach(c => {
    itemMap.set(c.id, { ...c, children: [] })
  })

  collections.forEach(c => {
    const node = itemMap.get(c.id)!
    if (c.parentId && itemMap.has(c.parentId)) {
      itemMap.get(c.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const result: FlatCollectionOption[] = []

  function traverse(nodes: TreeNode[], level: number, parentPath: string) {
    for (const node of nodes) {
      const currentPath = parentPath ? `${parentPath} / ${node.name}` : node.name
      result.push({ col: node, level, path: currentPath })
      if (node.children && node.children.length > 0) {
        traverse(node.children, level + 1, currentPath)
      }
    }
  }

  traverse(roots, 0, '')
  return result
}

function formatShortDate(dateVal?: string | Date | null): string {
  if (!dateVal) return ''
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const isCurrentYear = d.getFullYear() === now.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    if (isCurrentYear) {
      return `${m}-${day} ${h}:${min}`
    }
    return `${d.getFullYear()}-${m}-${day}`
  } catch {
    return ''
  }
}

function formatFullDate(dateVal?: string | Date | null): string {
  if (!dateVal) return ''
  try {
    const d = new Date(dateVal)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    const s = String(d.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}:${s}`
  } catch {
    return ''
  }
}

export default function BookmarkCard({
  bookmark,
  collections = [],
  isTrashView = false,
  onStatusChange,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  bookmark: BookmarkItem
  collections?: CollectionOption[]
  isTrashView?: boolean
  onStatusChange?: (id: string) => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [removed, setRemoved] = useState(false)
  const [currentCollection, setCurrentCollection] = useState(bookmark.collection)

  const flatCollections = useMemo(() => {
    return flattenCollectionOptions(collections)
  }, [collections])

  const currentCollectionPath = useMemo(() => {
    if (!currentCollection) return ''
    const match = flatCollections.find(f => f.col.id === currentCollection.id)
    return match ? match.path : currentCollection.name
  }, [currentCollection, flatCollections])
  
  // 偏好设置
  const [openInNewTab, setOpenInNewTab] = useState(true)
  const [showUrl, setShowUrl] = useState(true)
  const [compactView, setCompactView] = useState(false)

  useEffect(() => {
    const sync = () => {
      const savedNewTab = localStorage.getItem('omarker_new_tab')
      if (savedNewTab !== null) setOpenInNewTab(savedNewTab === 'true')
      const savedShowUrl = localStorage.getItem('omarker_show_url')
      if (savedShowUrl !== null) setShowUrl(savedShowUrl === 'true')
      const savedCompact = localStorage.getItem('omarker_compact_view')
      if (savedCompact !== null) setCompactView(savedCompact === 'true')
    }
    sync()
    window.addEventListener('omarker_settings_changed', sync)
    return () => window.removeEventListener('omarker_settings_changed', sync)
  }, [])

  // 标题与网址、备注响应式状态
  const [title, setTitle] = useState(bookmark.title || '')
  const [url, setUrl] = useState(bookmark.url)
  const [description, setDescription] = useState(bookmark.description || '')
  const [isFavorite, setIsFavorite] = useState(Boolean(bookmark.isFavorite))

  // 响应父级 props 更新
  useEffect(() => {
    setTitle(bookmark.title || '')
    setUrl(bookmark.url)
    setDescription(bookmark.description || '')
    setIsFavorite(Boolean(bookmark.isFavorite))
  }, [bookmark.title, bookmark.url, bookmark.description, bookmark.isFavorite])

  // 右侧统一书签编辑抽屉状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerSection, setDrawerSection] = useState<'details' | 'folder' | 'tags'>('details')

  const openDrawer = (section: 'details' | 'folder' | 'tags' = 'details') => {
    setDrawerSection(section)
    setIsDrawerOpen(true)
  }

  // 标签状态
  const [tags, setTags] = useState(bookmark.tags)
  const [loading, setLoading] = useState(false)

  // 切换收藏
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const nextVal = !isFavorite
    setIsFavorite(nextVal)
    try {
      await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: nextVal })
      })
      router.refresh()
    } catch {
      setIsFavorite(!nextVal)
    }
  }

  if (removed) return null

  // 移入回收站
  const handleMoveToTrash = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t('confirm_trash'))) return

    setLoading(true)
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setRemoved(true)
        onStatusChange?.(bookmark.id)
        router.refresh()
      } else {
        alert(data.error || t('action_failed'))
      }
    } catch {
      alert(t('network_error'))
    } finally {
      setLoading(false)
    }
  }

  // 从回收站恢复
  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setLoading(true)
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      })
      const data = await res.json()
      if (data.success) {
        setRemoved(true)
        onStatusChange?.(bookmark.id)
        router.refresh()
      } else {
        alert(data.error || t('action_failed'))
      }
    } catch {
      alert(t('network_error'))
    } finally {
      setLoading(false)
    }
  }

  // 彻底删除
  const handlePermanentDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t('confirm_delete'))) return

    setLoading(true)
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}?permanent=true`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setRemoved(true)
        onStatusChange?.(bookmark.id)
        router.refresh()
      } else {
        alert(data.error || t('delete_failed'))
      }
    } catch {
      alert(t('network_error'))
    } finally {
      setLoading(false)
    }
  }

  // 删除已有标签
  const handleRemoveTag = async (e: React.MouseEvent, tagId: string) => {
    e.preventDefault()
    e.stopPropagation()

    const remainingNames = tags.filter(t => t.id !== tagId).map(t => t.name)
    setLoading(true)
    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: remainingNames })
      })
      const data = await res.json()
      if (data.success && data.data) {
        setTags(data.data.tags)
        router.refresh()
      } else {
        alert(data.error || t('delete_failed'))
      }
    } catch {
      alert(t('network_error'))
    } finally {
      setLoading(false)
    }
  }

  // 卡片点击逻辑 (多选模式下直接勾选)
  const handleCardClick = (e: React.MouseEvent) => {
    if (selectable) {
      // 若点击的是链接或按钮，则不覆盖其原生行为
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('a')) return
      e.preventDefault()
      onToggleSelect?.(bookmark.id)
    }
  }

  // 复选框元素
  const renderCheckbox = () => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggleSelect?.(bookmark.id)
      }}
      className={`z-20 w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
        selected
          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30'
          : selectable
          ? 'bg-white/90 border border-slate-300 text-transparent hover:border-blue-500 shadow-xs'
          : 'opacity-0 group-hover:opacity-100 bg-white/90 border border-slate-300 text-transparent hover:border-blue-500 shadow-xs'
      }`}
      title={selected ? t('deselect_all') : t('select_all')}
    >
      <Check className={`w-3.5 h-3.5 stroke-[3] ${selected ? 'block' : 'hidden'}`} />
    </button>
  )

  const targetAttr = openInNewTab ? "_blank" : "_self"

  // 悬浮工具栏
  const renderActions = () => (
    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white/95 backdrop-blur px-2 py-1 rounded-xl shadow-md border border-slate-100">
      {!isTrashView ? (
        <>
          <button
            onClick={handleToggleFavorite}
            title={t('favorites')}
            className={`p-1.5 rounded-lg transition-colors ${
              isFavorite ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500' : ''}`} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              openDrawer('details')
            }}
            title={t('edit_bookmark')}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              openDrawer('folder')
            }}
            title={t('move_to_folder')}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <FolderInput className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              openDrawer('tags')
            }}
            title={t('tags')}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <TagIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleMoveToTrash}
            title={t('move_to_trash')}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <button
            onClick={handleRestore}
            title={t('restore')}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('restore')}</span>
          </button>
          <button
            onClick={handlePermanentDelete}
            title={t('delete_permanently')}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  )


  // 标签胶囊列表 (严格单行展示，左侧固定添加按钮，右侧微型精致滚动条)
  const renderTags = () => (
    <div className="flex items-center gap-1.5 w-full min-w-0">
      {/* 最左边固定的添加标签按钮 */}
      {!isTrashView && (
        <button
          type="button"
          onClick={() => openDrawer('tags')}
          className="shrink-0 w-5 h-5 flex items-center justify-center text-xs font-bold bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-md transition-colors border border-slate-200/80 cursor-pointer"
          title={t('add_tag')}
        >
          +
        </button>
      )}

      {/* 右侧微型极细滚动条标签列表 (绝不换行撑高) */}
      <div
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY
          }
        }}
        className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto tag-scroll pb-[2px] pt-0.5"
      >
        {tags.map(tagItem => (
          <div
            key={tagItem.id}
            className="group/tag inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md hover:bg-blue-100 hover:text-blue-700 transition-colors shrink-0 whitespace-nowrap"
          >
            <a href={`/?tag=${encodeURIComponent(tagItem.name)}`}>
              #{tagItem.name}
            </a>
            {!isTrashView && (
              <button
                type="button"
                onClick={(e) => handleRemoveTag(e, tagItem.id)}
                title={t('delete_tag')}
                className="opacity-0 group-hover/tag:opacity-100 hover:text-red-500 p-0.2 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  // 右侧统一书签详情与编辑抽屉
  const renderDrawer = () => (
    <BookmarkEditDrawer
      isOpen={isDrawerOpen}
      onClose={() => setIsDrawerOpen(false)}
      bookmark={{
        ...bookmark,
        title,
        url,
        description,
        collectionId: currentCollection?.id || null,
        tags,
        isFavorite,
      }}
      collections={collections}
      onSaved={(updated) => {
        setTitle(updated.title || '')
        setUrl(updated.url)
        setDescription(updated.description || '')
        setCurrentCollection(updated.collection || null)
        setTags(updated.tags)
        setIsFavorite(Boolean(updated.isFavorite))
        router.refresh()
      }}
      isTrashView={isTrashView}
      initialSection={drawerSection}
    />
  )

  // ─────────────────────────────────────────────────────────────
  // 模式 A：紧凑精简布局 (按用户设计参考图深度定制)
  // ─────────────────────────────────────────────────────────────
  if (compactView) {
    return (
      <div
        onClick={handleCardClick}
        className={`group relative flex flex-col justify-between bg-gradient-to-r from-white via-white to-blue-50/30 rounded-2xl border transition-all duration-300 p-4 min-h-[110px] overflow-hidden ${
          selected
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20'
            : 'border-indigo-100/80 hover:border-blue-300 hover:shadow-lg'
        } ${selectable ? 'cursor-pointer' : ''} ${loading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        
        {/* 常驻星标徽章 */}
        {isFavorite && !isTrashView && (
          <div className="absolute top-2 right-2 z-[5] text-amber-500 group-hover:opacity-0 transition-opacity">
            <Star className="w-4 h-4 fill-amber-500" />
          </div>
        )}

        {/* 右上角半透明水印大图标 */}
        {bookmark.coverImg ? (
          <img
            src={bookmark.coverImg}
            alt=""
            className="w-16 h-16 absolute -top-1 -right-1 opacity-[0.07] pointer-events-none object-contain select-none"
          />
        ) : (
          <Link2 className="w-16 h-16 absolute -top-1 -right-1 text-slate-400 opacity-[0.06] pointer-events-none" />
        )}

        {/* 悬浮操作栏 */}
        {renderActions()}

        {/* 顶部行：复选框 + 圆形 Logo + 标题 */}
        <div className="flex items-center gap-2 mb-2">
          {/* 复选框 */}
          <div className="shrink-0 mr-0.5">
            {renderCheckbox()}
          </div>

          <a href={url} target={targetAttr} rel="noreferrer" className="shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center p-1.5 shadow-sm group-hover:scale-105 transition-transform overflow-hidden">
              {bookmark.coverImg ? (
                <img src={bookmark.coverImg} alt="" className="w-full h-full object-contain filter brightness-105" />
              ) : (
                <span className="font-bold text-xs uppercase leading-none">
                  {(title || 'O').charAt(0)}
                </span>
              )}
            </div>
          </a>

          <a href={url} target={targetAttr} rel="noreferrer" className="flex-1 min-w-0 pr-8">
            <MarqueeText
              text={title || t('untitled')}
              className="font-bold text-sm text-slate-800 hover:text-blue-600 transition-colors"
            />
          </a>
        </div>

        {/* 中间简介行 */}
        <a href={url} target={targetAttr} rel="noreferrer" className="block mb-2.5">
          {description && description.trim() ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-700" title={description}>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded shrink-0 select-none flex items-center gap-0.5 border border-amber-200/60">
                <span>📝</span>
                <span>{t('note_label')}</span>
              </span>
              <span className="text-slate-700 font-medium truncate">{description}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 truncate" title={url}>
              {showUrl ? url : t('no_description')}
            </p>
          )}
        </a>

        {/* 底部信息区：文件夹标识、时间戳与标签 */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100/60 mt-auto gap-2">
          <div className="flex items-center gap-2 min-w-0 truncate">
            {currentCollection ? (
              <span
                title={currentCollectionPath}
                className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0"
              >
                <Folder className="w-2.5 h-2.5" />
                {currentCollection.name}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 px-1.5 py-0.5 shrink-0">{t('unclassified')}</span>
            )}

            {/* 紧凑时间戳 */}
            {bookmark.createdAt && (
              <span
                className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0"
                title={`${t('saved_prefix')}: ${formatFullDate(bookmark.createdAt)}`}
              >
                <Clock className="w-2.5 h-2.5 text-slate-400" />
                <span>{formatShortDate(bookmark.createdAt)}</span>
              </span>
            )}
            {bookmark.lastVisitedAt && (
              <span
                className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0"
                title={`${t('visited_prefix')}: ${formatFullDate(bookmark.lastVisitedAt)}`}
              >
                <Eye className="w-2.5 h-2.5 text-slate-400" />
                <span>{formatShortDate(bookmark.lastVisitedAt)}</span>
              </span>
            )}
          </div>
          {renderTags()}
        </div>

        {renderDrawer()}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // 模式 B：标准大卡片网格布局（用户深度定制排版：左侧图标 + 跑马灯 + 5/4/3 顺序 + 统一等高对齐）
  // ─────────────────────────────────────────────────────────────
  return (
    <div
      onClick={handleCardClick}
      className={`group relative flex flex-col justify-between bg-white border rounded-2xl p-3.5 transition-all duration-300 min-h-[175px] ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xl bg-blue-50/10'
          : 'border-slate-200/90 hover:border-blue-300 hover:shadow-xl hover:-translate-y-0.5'
      } ${selectable ? 'cursor-pointer' : ''} ${loading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      {/* 悬浮快捷操作栏 */}
      {renderActions()}

      <div className="flex-1 flex flex-col">
        {/* 顶栏：复选框 + 文件夹徽章 + 常驻星标 */}
        <div className="flex items-center justify-between mb-2.5 gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {renderCheckbox()}
            {currentCollection ? (
              <span
                title={currentCollectionPath}
                className="text-[10px] font-semibold text-blue-600 bg-blue-50/80 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 border border-blue-100/90 max-w-[200px] truncate"
              >
                <Folder className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{currentCollection.name}</span>
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 bg-slate-100/70 px-1.5 py-0.5 rounded-md shrink-0 border border-slate-100">
                {t('unclassified')}
              </span>
            )}
          </div>

          {isFavorite && !isTrashView && (
            <div className="text-amber-500 shrink-0 group-hover:opacity-0 transition-opacity">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
            </div>
          )}
        </div>

        {/* 核心区：左侧放大图标 + 右侧 3 行 (标题、URL、备注) */}
        <div className="flex items-center gap-3 shrink-0">
          {/* 左侧放大图标容器 */}
          <a href={url} target={targetAttr} rel="noreferrer" className="shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 shadow-2xs flex items-center justify-center p-2.5 group-hover:scale-105 group-hover:border-blue-200 transition-all overflow-hidden">
              {bookmark.coverImg ? (
                <img src={bookmark.coverImg} alt={title || ''} className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="w-full h-full rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg select-none">
                  {(title || 'O').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </a>

          {/* 右侧：第 1 行标题 + 第 2 行 URL + 第 3 行备注 (与图标齐平) */}
          <div className="flex-1 min-w-0 flex flex-col justify-between h-14">
            {/* 第 1 行：标题 (鼠标悬停跑马灯滚动) */}
            <a href={url} target={targetAttr} rel="noreferrer" className="block">
              <MarqueeText
                text={title || t('untitled')}
                className="font-semibold text-sm text-slate-800 hover:text-blue-600 transition-colors leading-tight"
              />
            </a>

            {/* 第 2 行：网址 URL (鼠标悬停跑马灯滚动) */}
            <a href={url} target={targetAttr} rel="noreferrer" className="block">
              <MarqueeText
                text={url}
                className="text-xs text-slate-400 hover:text-slate-600 font-mono leading-tight"
              />
            </a>

            {/* 第 3 行：备注 (与标题、URL 同在图标右侧，单行紧凑展示) */}
            <div className="h-[18px] flex items-center min-w-0">
              {description && description.trim() ? (
                <div className="flex items-center gap-1.5 text-xs text-slate-700 min-w-0 w-full" title={description}>
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-semibold px-1 py-0.2 rounded shrink-0 select-none flex items-center gap-0.5 border border-amber-200/60 leading-none">
                    <span>📝</span>
                    <span>{t('note_label')}</span>
                  </span>
                  <span className="text-[11px] text-slate-600 truncate font-normal flex-1" title={description}>
                    {description}
                  </span>
                </div>
              ) : (
                <div className="h-full" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>

        {/* 标签列表 (严格单行，底部留足间距，与下方时间横线彻底分离绝不重合) */}
        <div className="mt-3 mb-2 h-[24px] flex items-center shrink-0">
          {renderTags()}
        </div>
      </div>

      {/* 时间元数据底栏 (与标签栏间距清晰，横线彻底独立) */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-auto pt-2 border-t border-slate-100/80 select-none shrink-0">
        {bookmark.createdAt ? (
          <div
            className="flex items-center gap-1 min-w-0"
            title={`${t('saved_prefix')}: ${formatFullDate(bookmark.createdAt)}`}
          >
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{t('saved_prefix')} {formatShortDate(bookmark.createdAt)}</span>
          </div>
        ) : <div />}
        {bookmark.lastVisitedAt && (
          <div
            className="flex items-center gap-1 shrink-0"
            title={`${t('visited_prefix')}: ${formatFullDate(bookmark.lastVisitedAt)}`}
          >
            <Eye className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{t('visited_prefix')} {formatShortDate(bookmark.lastVisitedAt)}</span>
          </div>
        )}
      </div>

      {renderDrawer()}
    </div>
  )
}
