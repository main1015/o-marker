import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { apiFetch } from "../api"
import type { Locale } from "../i18n"
import { flattenCollectionTree, type Collection } from "./FolderPicker"

export interface SearchBookmarkItem {
  id: string
  url: string
  title: string
  description?: string
  coverImg?: string
  isFavorite?: boolean
  status?: string
  collectionId?: string
  collection?: { id: string; name: string }
  tags?: { id: string; name: string }[] | string[]
  createdAt?: string
  lastVisitedAt?: string
}

interface BookmarkSearchPanelProps {
  locale: Locale
  t: (key: string) => string
  onClose: () => void
  formatDateTime: (dateStr: string | null | undefined, locale: Locale) => string
  onOpenDashboard: () => void
  collections?: Collection[]
}

const PAGE_SIZE = 30

function getHostname(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, "")
  } catch {
    return urlStr
  }
}

function BookmarkVisual({
  coverImg,
  hostname,
  title
}: {
  coverImg?: string
  hostname: string
  title: string
}) {
  const [imgError, setImgError] = useState(false)
  const iconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`

  if (coverImg && !imgError) {
    return (
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200/60 shadow-2xs">
        <img
          src={coverImg}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100/80 shrink-0 border border-slate-200/60 flex items-center justify-center shadow-2xs group-hover:bg-blue-50/50 transition-colors">
      <img
        src={iconUrl}
        alt=""
        className="w-5 h-5 object-contain"
        onError={(e) => {
          (e.target as HTMLElement).style.display = "none"
        }}
      />
    </div>
  )
}

export default function BookmarkSearchPanel({
  locale,
  t,
  onClose,
  formatDateTime,
  onOpenDashboard,
  collections = []
}: BookmarkSearchPanelProps) {
  const [query, setQuery] = useState("")

  // 分类过滤
  const [activeCategory, setActiveCategory] = useState<{
    type: "nav" | "collection" | "tag"
    id: string
    name?: string
  }>({ type: "nav", id: "all" })

  // 排序方式: 'newest' | 'visited'
  const [sortBy, setSortBy] = useState<"newest" | "visited">("newest")

  // 分页数据与状态
  const [bookmarks, setBookmarks] = useState<SearchBookmarkItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 统计概览
  const [globalCounts, setGlobalCounts] = useState<{
    totalActive: number
    unclassified: number
    favorites: number
    trash: number
    colMap: Record<string, number>
    tagList: { name: string; count: number }[]
  }>({
    totalActive: 0,
    unclassified: 0,
    favorites: 0,
    trash: 0,
    colMap: {},
    tagList: []
  })

  const flatCollections = useMemo(() => flattenCollectionTree(collections), [collections])
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(false)
  const [isTagsCollapsed, setIsTagsCollapsed] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // 监听 Escape 键退出宽屏搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // 拉取全局分类与标签统计（轻量元数据请求）
  const fetchOverviewCounts = useCallback(async () => {
    try {
      const [resAll, resTrash] = await Promise.all([
        apiFetch("/api/bookmarks?limit=300"),
        apiFetch("/api/bookmarks?filter=trash&limit=100")
      ])

      let allItems: SearchBookmarkItem[] = []
      let trashCount = 0

      if (resAll.ok) {
        const json = await resAll.json()
        if (json && json.success && Array.isArray(json.data)) {
          allItems = json.data
        }
      }

      if (resTrash.ok) {
        const jsonTrash = await resTrash.json()
        if (jsonTrash && jsonTrash.success) {
          trashCount = jsonTrash.pagination?.total ?? (jsonTrash.data?.length || 0)
        }
      }

      const totalActive = allItems.length
      const unclassified = allItems.filter((b) => !b.collectionId && !b.collection).length
      const favorites = allItems.filter((b) => b.isFavorite).length

      const colMap: Record<string, number> = {}
      collections.forEach((c) => {
        colMap[c.id] = allItems.filter(
          (b) => b.collectionId === c.id || b.collection?.id === c.id
        ).length
      })

      const tagCountMap: Record<string, number> = {}
      allItems.forEach((b) => {
        if (Array.isArray(b.tags)) {
          b.tags.forEach((tg) => {
            const name = typeof tg === "string" ? tg : tg.name
            if (name) {
              tagCountMap[name] = (tagCountMap[name] || 0) + 1
            }
          })
        }
      })

      const tagList = Object.entries(tagCountMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      setGlobalCounts({
        totalActive,
        unclassified,
        favorites,
        trash: trashCount,
        colMap,
        tagList
      })
    } catch (err) {
      console.warn("Failed to fetch overview counts:", err)
    }
  }, [collections])

  useEffect(() => {
    fetchOverviewCounts()
  }, [fetchOverviewCounts])

  // 执行分页拉取请求
  const loadPageData = useCallback(
    async (
      targetPage: number,
      targetQuery: string,
      targetCategory = activeCategory,
      targetSort = sortBy,
      isInitial = false
    ) => {
      if (isInitial) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const params = new URLSearchParams()
        params.set("page", String(targetPage))
        params.set("limit", String(PAGE_SIZE))

        if (targetCategory.type === "nav") {
          if (targetCategory.id === "favorites") params.set("filter", "favorites")
          else if (targetCategory.id === "unclassified") params.set("filter", "unclassified")
          else if (targetCategory.id === "trash") params.set("filter", "trash")
        } else if (targetCategory.type === "collection") {
          params.set("collectionId", targetCategory.id)
        } else if (targetCategory.type === "tag") {
          params.set("tag", targetCategory.id)
        }

        const qText = targetQuery.trim()
        if (qText) {
          params.set("q", qText)
        }

        const res = await apiFetch(`/api/bookmarks?${params.toString()}`)
        if (res.ok) {
          const json = await res.json()
          if (json && json.success && Array.isArray(json.data)) {
            let list: SearchBookmarkItem[] = json.data

            // 客户端精准辅助排序
            if (targetSort === "visited") {
              list.sort((a, b) => {
                const timeA = a.lastVisitedAt ? new Date(a.lastVisitedAt).getTime() : 0
                const timeB = b.lastVisitedAt ? new Date(b.lastVisitedAt).getTime() : 0
                return timeB - timeA
              })
            }

            if (isInitial || targetPage === 1) {
              setBookmarks(list)
            } else {
              setBookmarks((prev) => {
                const existingIds = new Set(prev.map((item) => item.id))
                const uniqueNewItems = list.filter((item) => !existingIds.has(item.id))
                return [...prev, ...uniqueNewItems]
              })
            }

            setPage(targetPage)
            setHasMore(Boolean(json.pagination?.hasMore))
            setTotalCount(json.pagination?.total ?? list.length)
          } else {
            if (isInitial) setBookmarks([])
            setHasMore(false)
          }
        }
      } catch (err) {
        console.warn("Failed to load bookmarks page:", err)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [activeCategory, sortBy]
  )

  // 当分类或排序变更时，重置并拉取第一页
  useEffect(() => {
    setPage(1)
    listContainerRef.current?.scrollTo({ top: 0 })
    loadPageData(1, query, activeCategory, sortBy, true)
  }, [activeCategory, sortBy])

  // 输入防抖请求
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      setPage(1)
      listContainerRef.current?.scrollTo({ top: 0 })
      loadPageData(1, value, activeCategory, sortBy, true)
    }, 250)
  }

  const handleClear = () => {
    setQuery("")
    setPage(1)
    loadPageData(1, "", activeCategory, sortBy, true)
    inputRef.current?.focus()
  }

  // 触底流式加载更多
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    // 距底部小于 60px 时触发追加下一页
    if (scrollHeight - scrollTop - clientHeight < 60) {
      if (hasMore && !loadingMore && !loading) {
        loadPageData(page + 1, query, activeCategory, sortBy, false)
      }
    }
  }

  // 即时本地全字段模糊匹配过滤 (Instant Search)
  const displayedBookmarks = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return bookmarks

    return bookmarks.filter((b) => {
      const matchTitle = b.title && b.title.toLowerCase().includes(trimmed)
      const matchUrl = b.url && b.url.toLowerCase().includes(trimmed)
      const matchDesc = b.description && b.description.toLowerCase().includes(trimmed)
      const matchCol = b.collection?.name && b.collection.name.toLowerCase().includes(trimmed)
      const matchTags =
        b.tags &&
        Array.isArray(b.tags) &&
        b.tags.some((tg) => {
          const name = typeof tg === "string" ? tg : tg.name
          return name.toLowerCase().includes(trimmed)
        })
      return matchTitle || matchUrl || matchDesc || matchCol || matchTags
    })
  }, [bookmarks, query])

  // 当前分类标题与图标
  const currentCategoryInfo = useMemo(() => {
    if (query.trim()) {
      return {
        icon: "🔍",
        label: `${t("search_results")}: "${query.trim()}"`
      }
    }
    if (activeCategory.type === "nav") {
      if (activeCategory.id === "all") return { icon: "🌐", label: t("all_bookmarks") }
      if (activeCategory.id === "favorites") return { icon: "⭐", label: t("filter_favorites") }
      if (activeCategory.id === "unclassified") return { icon: "📁", label: t("filter_unclassified") }
      if (activeCategory.id === "trash") return { icon: "🗑️", label: t("trash_nav") }
    }
    if (activeCategory.type === "collection") {
      const col = collections.find((c) => c.id === activeCategory.id)
      return { icon: "📁", label: col?.name || activeCategory.name || t("folder_nav") }
    }
    if (activeCategory.type === "tag") {
      return { icon: "#", label: `#${activeCategory.name || activeCategory.id}` }
    }
    return { icon: "🌐", label: t("all_bookmarks") }
  }, [activeCategory, query, collections, t])

  // 打开书签
  const handleOpenBookmark = (item: SearchBookmarkItem) => {
    apiFetch(`/api/bookmarks?url=${encodeURIComponent(item.url)}`).catch(() => {})

    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: item.url })
      window.close()
    } else {
      window.open(item.url, "_blank")
    }
  }

  // 恢复书签（废纸篓中）
  const handleRestore = async (e: React.MouseEvent, item: SearchBookmarkItem) => {
    e.stopPropagation()
    try {
      await apiFetch(`/api/bookmarks/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" })
      })
      loadPageData(1, query, activeCategory, sortBy, true)
      fetchOverviewCounts()
    } catch (err) {
      console.warn("Failed to restore bookmark:", err)
    }
  }

  // 复制链接
  const handleCopyLink = (e: React.MouseEvent, item: SearchBookmarkItem) => {
    e.stopPropagation()
    navigator.clipboard.writeText(item.url)
    setCopiedId(item.id)
    setTimeout(() => {
      setCopiedId((prev) => (prev === item.id ? null : prev))
    }, 1800)
  }

  const toggleSort = () => {
    setSortBy((prev) => (prev === "newest" ? "visited" : "newest"))
  }

  return (
    <div className="flex flex-row h-full w-full bg-white select-none overflow-hidden text-slate-800">
      {/* ================= 左侧侧边栏 (100% 对齐 o-marker 后端系统架构) ================= */}
      <div className="w-[230px] shrink-0 bg-slate-50/80 border-r border-slate-200/80 flex flex-col justify-between">
        <div className="flex-1 overflow-y-auto p-2.5 space-y-3">
          {/* 用户/工作区头部 */}
          <div className="flex items-center justify-between px-2 py-1 text-xs font-bold text-slate-700">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] shrink-0 font-bold">
                o
              </span>
              <span className="truncate">o-marker</span>
            </div>
          </div>

          {/* 1. 核心导航 (全部 / 标星 / 未分类 / 废纸篓) */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveCategory({ type: "nav", id: "all" })}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                activeCategory.type === "nav" && activeCategory.id === "all"
                  ? "bg-white text-blue-600 font-semibold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-200/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🌐</span>
                <span>{t("all_bookmarks")}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {globalCounts.totalActive}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory({ type: "nav", id: "favorites" })}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                activeCategory.type === "nav" && activeCategory.id === "favorites"
                  ? "bg-white text-amber-600 font-semibold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-200/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>⭐</span>
                <span>{t("filter_favorites")}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {globalCounts.favorites}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory({ type: "nav", id: "unclassified" })}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                activeCategory.type === "nav" && activeCategory.id === "unclassified"
                  ? "bg-white text-blue-600 font-semibold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-200/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>📁</span>
                <span>{t("filter_unclassified")}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {globalCounts.unclassified}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategory({ type: "nav", id: "trash" })}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                activeCategory.type === "nav" && activeCategory.id === "trash"
                  ? "bg-white text-rose-600 font-semibold shadow-2xs"
                  : "text-slate-600 hover:bg-slate-200/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🗑️</span>
                <span>{t("trash_nav")}</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {globalCounts.trash}
              </span>
            </button>
          </div>

          {/* 2. 文件夹 (Collections) */}
          {flatCollections.length > 0 && (
            <div className="pt-2 border-t border-slate-200/60 space-y-1">
              <button
                type="button"
                onClick={() => setIsFoldersCollapsed(!isFoldersCollapsed)}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors select-none group"
              >
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 group-hover:text-slate-600 transition-transform">
                    {isFoldersCollapsed ? "▶" : "▼"}
                  </span>
                  <span>{t("folder_nav")}</span>
                  <span className="font-mono text-[9px] text-slate-400 normal-case">
                    ({flatCollections.length})
                  </span>
                </div>
              </button>

              {!isFoldersCollapsed && (
                <div className="max-h-48 overflow-y-auto folder-scroll space-y-0.5 pr-0.5">
                  {flatCollections.map(({ col, level, path }) => (
                    <button
                      key={col.id}
                      type="button"
                      title={path}
                      onClick={() =>
                        setActiveCategory({ type: "collection", id: col.id, name: col.name })
                      }
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                        activeCategory.type === "collection" && activeCategory.id === col.id
                          ? "bg-white text-blue-600 font-semibold shadow-2xs"
                          : "text-slate-600 hover:bg-slate-200/50"
                      }`}
                      style={{ paddingLeft: `${Math.max(10, 10 + level * 12)}px` }}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {level > 0 ? (
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 select-none">└─</span>
                        ) : null}
                        <span className="shrink-0">{level > 0 ? "📁" : "📂"}</span>
                        <span className="truncate">{col.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0 ml-1">
                        {globalCounts.colMap[col.id] || 0}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. 标签云 (Tags) */}
          {globalCounts.tagList.length > 0 && (
            <div className="pt-2 border-t border-slate-200/60 space-y-1">
              <button
                type="button"
                onClick={() => setIsTagsCollapsed(!isTagsCollapsed)}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors select-none group"
              >
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-slate-400 group-hover:text-slate-600 transition-transform">
                    {isTagsCollapsed ? "▶" : "▼"}
                  </span>
                  <span>{t("tags_nav")}</span>
                  <span className="font-mono text-[9px] text-slate-400 normal-case">
                    ({globalCounts.tagList.length})
                  </span>
                </div>
              </button>

              {!isTagsCollapsed && (
                <div className="max-h-36 overflow-y-auto folder-scroll flex flex-wrap gap-1 px-1 py-0.5 pr-0.5">
                  {globalCounts.tagList.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() =>
                        setActiveCategory({ type: "tag", id: tag.name, name: tag.name })
                      }
                      className={`px-2 py-0.5 text-[11px] rounded-md transition-all border ${
                        activeCategory.type === "tag" && activeCategory.id === tag.name
                          ? "bg-blue-100 text-blue-700 border-blue-200 font-medium shadow-2xs"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      #{tag.name} <span className="opacity-50 text-[10px]">{tag.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 侧栏底部：一键返回当前页保存界面 */}
        <div className="p-2 border-t border-slate-200/80 bg-white/60">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span className="rtl:rotate-180">↩</span>
            <span>{t("back_to_save")}</span>
          </button>
        </div>
      </div>

      {/* ================= 右侧主区域 (Raindrop 流式分页列表) ================= */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* 顶部搜索栏 */}
        <div className="p-2.5 border-b border-slate-100 flex items-center gap-2 shrink-0">
          <div className="relative flex-1 flex items-center min-w-0">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 rtl:left-auto rtl:right-2.5 pointer-events-none shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              placeholder={t("search_placeholder")}
              className="w-full pl-8 pr-7 rtl:pl-7 rtl:pr-8 py-1.5 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500/40 rounded-lg outline-none transition-all placeholder:text-slate-400 text-slate-800"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 rtl:right-auto rtl:left-2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors"
                title={t("clear_search")}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* 排序切换器 */}
          <button
            type="button"
            onClick={toggleSort}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors shrink-0 shadow-2xs"
            title={sortBy === "newest" ? t("sort_newest") : t("sort_visited")}
          >
            <span>⇅</span>
            <span className="font-medium">
              {sortBy === "newest" ? t("sort_newest") : t("sort_visited")}
            </span>
          </button>
        </div>

        {/* 状态大标题栏 */}
        <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 truncate">
            <span>{currentCategoryInfo.icon}</span>
            <span className="truncate">{currentCategoryInfo.label}</span>
          </div>
          <span className="text-xs text-slate-400 font-mono shrink-0">
            {totalCount} {t("count_bookmarks_unit")}
          </span>
        </div>

        {/* 结果列表区 (支持触底分页流式监听) */}
        <div
          ref={listContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto divide-y divide-slate-100"
        >
          {loading && bookmarks.length === 0 ? (
            // 首屏骨架屏
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-start gap-3 animate-pulse">
                  <div className="w-11 h-11 bg-slate-200 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedBookmarks.length === 0 ? (
            // 空态提示
            <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-2 animate-in fade-in duration-200">
              <span className="text-4xl opacity-80">🔍</span>
              <p className="text-xs font-semibold text-slate-600">
                {query
                  ? `${t("search_empty_prefix")}${query}${t("search_empty_suffix")}`
                  : t("no_bookmarks")}
              </p>
              <p className="text-[11px] text-slate-400">
                {query ? t("search_empty_tip") : t("search_no_bookmarks_tip")}
              </p>
            </div>
          ) : (
            <>
              {displayedBookmarks.map((item) => {
                const hostname = getHostname(item.url)
                const isCopied = copiedId === item.id
                const isItemTrash = item.status === "TRASH" || activeCategory.id === "trash"

                return (
                  <div
                    key={item.id}
                    onClick={() => !isItemTrash && handleOpenBookmark(item)}
                    className={`group relative flex items-start gap-3 p-3.5 transition-colors ${
                      isItemTrash
                        ? "bg-slate-50/50 opacity-80"
                        : "hover:bg-slate-50/90 active:bg-blue-50/40 cursor-pointer"
                    }`}
                  >
                    {/* 网站图标 / 缩略图 */}
                    <BookmarkVisual
                      coverImg={item.coverImg}
                      hostname={hostname}
                      title={item.title}
                    />

                    {/* 核心文本与元信息 */}
                    <div className="flex-1 min-w-0 pr-8">
                      {/* 第一行：标题与星标 */}
                      <div className="flex items-center gap-1.5">
                        {item.isFavorite && (
                          <span
                            className="text-amber-500 text-xs shrink-0"
                            title={t("filter_favorites")}
                          >
                            ★
                          </span>
                        )}
                        <h4 className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 line-clamp-1 transition-colors leading-snug">
                          {item.title || t("untitled")}
                        </h4>
                      </div>

                      {/* 第二行：Raindrop 招牌高亮引言摘录 (黄色边条) */}
                      {item.description && (
                        <div className="mt-1 text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-amber-50/35 pl-2 pr-2 py-0.5 rounded-r border-l-2 border-amber-400 group-hover:bg-amber-50/60 transition-colors">
                          {item.description}
                        </div>
                      )}

                      {/* 第三行：元信息 (域名 · 时间 · 文件夹 · 标签) */}
                      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                        <span className="font-mono text-slate-500 hover:text-slate-700 truncate max-w-[140px]">
                          {hostname}
                        </span>

                        <span>·</span>

                        {/* 时间 */}
                        {item.lastVisitedAt ? (
                          <span
                            className="flex items-center gap-0.5 shrink-0"
                            title={`${t("last_visited_prefix")}: ${formatDateTime(
                              item.lastVisitedAt,
                              locale
                            )}`}
                          >
                            <span className="text-[10px]">👁️</span>
                            <span>{formatDateTime(item.lastVisitedAt, locale)}</span>
                          </span>
                        ) : item.createdAt ? (
                          <span
                            className="flex items-center gap-0.5 shrink-0"
                            title={`${t("saved_at_prefix")}: ${formatDateTime(
                              item.createdAt,
                              locale
                            )}`}
                          >
                            <span className="text-[10px]">🕒</span>
                            <span>{formatDateTime(item.createdAt, locale)}</span>
                          </span>
                        ) : null}

                        {/* 所属文件夹 */}
                        {item.collection?.name && (
                          <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium truncate max-w-[100px]">
                            📁 {item.collection.name}
                          </span>
                        )}

                        {/* 标签 */}
                        {item.tags &&
                          Array.isArray(item.tags) &&
                          item.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              {item.tags.slice(0, 3).map((tg) => {
                                const name = typeof tg === "string" ? tg : tg.name
                                const key = typeof tg === "string" ? tg : tg.id || tg.name
                                return (
                                  <span
                                    key={key}
                                    className="text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-medium truncate max-w-[80px]"
                                  >
                                    #{name}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* 悬停快捷动作条 */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 absolute top-3 right-3 rtl:right-auto rtl:left-3 bg-white/95 px-1.5 py-0.5 rounded-lg border border-slate-200 shadow-xs">
                      {isItemTrash ? (
                        <button
                          type="button"
                          onClick={(e) => handleRestore(e, item)}
                          className="px-2 py-0.5 text-blue-600 hover:bg-blue-50 rounded transition-colors text-[11px] flex items-center gap-1"
                          title={t("restore")}
                        >
                          <span>↩</span>
                          <span>{t("restore")}</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleCopyLink(e, item)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors text-[11px]"
                            title={isCopied ? t("copied") : t("copy_link")}
                          >
                            {isCopied ? "✓" : "📋"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenBookmark(item)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors text-[11px]"
                            title={t("open_in_new_tab")}
                          >
                            ↗
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* 触底流式加载更多微动画 */}
              {loadingMore && (
                <div className="py-3 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>{t("loading_more")}</span>
                </div>
              )}

              {/* 已加载完毕提示 */}
              {!hasMore && bookmarks.length >= 15 && (
                <div className="py-3 text-center text-[11px] text-slate-300">
                  {t("no_more_bookmarks")}
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部栏 (像 Raindrop 一样居中展示统计) */}
        <div className="py-2.5 px-4 bg-white border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="w-16" />

          <span className="font-medium text-slate-500">
            {totalCount} {t("count_bookmarks_unit")}
          </span>

          <button
            type="button"
            onClick={onOpenDashboard}
            className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-0.5 text-[11px]"
            title={t("open_dashboard")}
          >
            <span>{t("dashboard_short")}</span>
            <span>↗</span>
          </button>
        </div>
      </div>
    </div>
  )
}
