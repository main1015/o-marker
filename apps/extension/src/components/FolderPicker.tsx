import { useState, useRef, useEffect, useMemo } from "react"
import { apiFetch } from "../api"

export type Collection = {
  id: string
  name: string
  parentId?: string | null
  description?: string
}

interface FolderPickerProps {
  collections: Collection[]
  selectedId?: string
  onChange: (id: string | undefined) => void
  onCollectionCreated: (newCol: Collection) => void
  t: (key: string) => string
}

type CollectionNode = Collection & { children: CollectionNode[] }

export function flattenCollectionTree(
  collections: Collection[],
  filterQuery: string = ""
): { col: Collection; level: number; path: string }[] {
  const itemMap = new Map<string, CollectionNode>()
  const roots: CollectionNode[] = []

  collections.forEach((c) => {
    itemMap.set(c.id, { ...c, children: [] })
  })

  collections.forEach((c) => {
    const node = itemMap.get(c.id)!
    if (c.parentId && itemMap.has(c.parentId)) {
      itemMap.get(c.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const result: { col: Collection; level: number; path: string }[] = []

  function traverse(
    nodes: CollectionNode[],
    level: number,
    parentPath: string
  ) {
    for (const node of nodes) {
      const currentPath = parentPath ? `${parentPath} / ${node.name}` : node.name
      result.push({ col: node, level, path: currentPath })
      if (node.children && node.children.length > 0) {
        traverse(node.children, level + 1, currentPath)
      }
    }
  }

  traverse(roots, 0, "")

  if (!filterQuery) return result
  const q = filterQuery.toLowerCase().trim()
  return result.filter((item) => item.path.toLowerCase().includes(q))
}

export default function FolderPicker({
  collections,
  selectedId,
  onChange,
  onCollectionCreated,
  t
}: FolderPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filterQuery, setFilterQuery] = useState("")
  const [newFolderName, setNewFolderName] = useState("")
  const [createAsSub, setCreateAsSub] = useState(false)
  const [targetParentId, setTargetParentId] = useState<string | null>(selectedId || null)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 当外部 selectedId 变动且未处于建子文件夹模式时，同步默认父级
  useEffect(() => {
    if (!createAsSub) {
      setTargetParentId(selectedId || null)
    }
  }, [selectedId, createAsSub])

  // 获得完整的平铺树
  const flattened = useMemo(
    () => flattenCollectionTree(collections, filterQuery),
    [collections, filterQuery]
  )

  const currentItem = useMemo(() => {
    const allFlattened = flattenCollectionTree(collections, "")
    return allFlattened.find((item) => item.col.id === selectedId)
  }, [collections, selectedId])

  const targetParentCol = useMemo(() => {
    if (!targetParentId) return null
    return collections.find((c) => c.id === targetParentId) || null
  }, [collections, targetParentId])

  // 点击外部自动收起
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const handleCreate = async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return

    const parentId = createAsSub ? (targetParentId || selectedId || null) : null

    // 检查同一父级下是否已存在同名文件夹
    const isDuplicate = collections.some(
      (c) =>
        (c.parentId || null) === (parentId || null) &&
        c.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (isDuplicate) {
      setCreateError(t("folder_name_exists"))
      return
    }

    setIsCreating(true)
    setCreateError(null)
    try {
      const res = await apiFetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, parentId })
      })
      const data = await res.json()
      if (data.success && data.data) {
        onCollectionCreated(data.data)
        onChange(data.data.id)
        setNewFolderName("")
        setCreateAsSub(false)
        setCreateError(null)
        setIsOpen(false)
      } else {
        setCreateError(data.error || "创建文件夹失败")
      }
    } catch {
      setCreateError("网络异常")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* 触发下拉按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl hover:bg-slate-100/60 transition-colors text-xs text-slate-700"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-sm">📁</span>
          <span className="font-medium truncate">
            {currentItem ? currentItem.path : t("no_folder")}
          </span>
        </span>
        <span className="text-slate-400 text-[10px] ml-2">▼</span>
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-56">
          {/* 搜索/过滤文件夹输入框 */}
          <div className="p-2 border-b border-slate-100 shrink-0">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={t("search_folder")}
              className="w-full px-2.5 py-1 text-xs bg-slate-100/70 rounded-lg border border-transparent focus:border-blue-500/40 focus:bg-white outline-none"
              autoFocus
            />
          </div>

          {/* 选项列表 (保留专属细滚动条) */}
          <div className="max-h-36 overflow-y-auto p-1 space-y-0.5 folder-scroll">
            {/* 未分类选项 */}
            <button
              type="button"
              onClick={() => {
                onChange(undefined)
                setCreateAsSub(false)
                setIsOpen(false)
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors ${
                !selectedId
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <span>📁</span> {t("no_folder")}
              </span>
              {!selectedId && <span className="text-blue-600 font-bold">✓</span>}
            </button>

            {/* 多级文件夹树形列表 */}
            {flattened.map(({ col, level, path }) => {
              const isParentSelected = createAsSub && col.id === targetParentId
              const isBookmarkSelected = !createAsSub && col.id === selectedId
              const isSelected = isParentSelected || isBookmarkSelected
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => {
                    if (createAsSub) {
                      setTargetParentId(col.id)
                    } else {
                      onChange(col.id)
                      setTargetParentId(col.id)
                      setIsOpen(false)
                    }
                  }}
                  style={{ paddingLeft: `${8 + level * 14}px` }}
                  className={`w-full flex items-center justify-between pr-2.5 py-1.5 text-xs rounded-lg text-left transition-colors ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {level > 0 ? (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 select-none">└─</span>
                    ) : null}
                    <span className="shrink-0">{level > 0 ? "📁" : "📂"}</span>
                    <span className="truncate">{col.name}</span>
                  </div>
                  {isParentSelected && (
                    <span className="text-[10px] text-blue-600 font-semibold bg-blue-100/80 px-1.5 py-0.5 rounded shrink-0 ml-1">
                      ✓ 父级
                    </span>
                  )}
                  {isBookmarkSelected && <span className="text-blue-600 font-bold shrink-0 ml-1">✓</span>}
                </button>
              )
            })}
          </div>

          {/* 底部新建文件夹 / 新建子文件夹 */}
          <div className="p-2 border-t border-slate-100 bg-slate-50 space-y-1.5 shrink-0">
            {collections.length > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={createAsSub}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setCreateAsSub(checked)
                    if (checked && !targetParentId) {
                      setTargetParentId(selectedId || collections[0]?.id || null)
                    }
                    if (createError) setCreateError(null)
                  }}
                  className="rounded text-blue-600 focus:ring-0 w-3 h-3"
                />
                <span className="truncate">
                  {targetParentCol
                    ? `${t("as_subfolder") || "作为子文件夹"} (${targetParentCol.name})`
                    : (t("as_subfolder") || "作为当前选中的子文件夹")}
                </span>
              </label>
            )}
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value)
                  if (createError) setCreateError(null)
                }}
                placeholder={
                  createAsSub && targetParentCol
                    ? `${t("subfolder_placeholder") || "子文件夹名称"} (${targetParentCol.name})`
                    : (createAsSub ? t("subfolder_placeholder") : t("new_folder_placeholder"))
                }
                className={`flex-1 px-2.5 py-1 text-xs border rounded-lg outline-none bg-white transition-colors ${
                  createError
                    ? "border-rose-400 focus:border-rose-500 bg-rose-50/30"
                    : "border-slate-200 focus:border-blue-500"
                }`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating || !newFolderName.trim()}
                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap"
              >
                {isCreating ? "..." : t("create_btn")}
              </button>
            </div>
            {createError && (
              <div className="text-[11px] text-rose-500 font-medium px-1 flex items-center gap-1 animate-in fade-in">
                <span>⚠️</span>
                <span className="truncate">{createError}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
