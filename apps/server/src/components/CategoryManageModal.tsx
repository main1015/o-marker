'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FolderCog, X, Folder, Tag as TagIcon, Plus, Pencil, 
  Trash2, Check, Search, Sparkles, FolderPlus, ArrowRight,
  ChevronRight, ChevronDown
} from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

interface CollectionNode {
  id: string
  name: string
  parentId: string | null
  createdAt?: string
  _count: {
    bookmarks: number
    children?: number
  }
}

interface TagItem {
  id: string
  name: string
  _count: {
    bookmarks: number
  }
}

export default function CategoryManageModal() {
  const router = useRouter()
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'folders' | 'tags'>('folders')

  // 文件夹状态
  const [collections, setCollections] = useState<CollectionNode[]>([])
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [folderSearch, setFolderSearch] = useState("")
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState("")
  const [creatingParentId, setCreatingParentId] = useState<string | null | 'ROOT'>(null)
  const [newFolderName, setNewFolderName] = useState("")

  // 父文件夹折叠状态 (记录已折叠的父文件夹 ID)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  // 标签状态
  const [tags, setTags] = useState<TagItem[]>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [tagSearch, setTagSearch] = useState("")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")
  const [newTagName, setNewTagName] = useState("")
  const [cleaningTags, setCleaningTags] = useState(false)

  // 通用错误提示
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 1. 加载文件夹数据
  const loadCollections = async () => {
    setLoadingFolders(true)
    try {
      const res = await fetch('/api/collections')
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setCollections(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingFolders(false)
    }
  }

  // 2. 加载标签数据
  const loadTags = async () => {
    setLoadingTags(true)
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setTags(data.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingTags(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadCollections()
      loadTags()
      setErrorMsg(null)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false)
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  interface CollectionTreeNode extends CollectionNode {
    children: CollectionTreeNode[]
  }

  // 查找所有拥有子文件夹的父文件夹 ID 集合
  const parentFolderIds = useMemo(() => {
    const set = new Set<string>()
    collections.forEach(c => {
      if (c.parentId) set.add(c.parentId)
    })
    return set
  }, [collections])

  // 是否已全部折叠
  const isAllCollapsed = parentFolderIds.size > 0 && Array.from(parentFolderIds).every(id => collapsedIds.has(id))

  // 切换全部展开 / 全部折叠
  const toggleCollapseAll = () => {
    if (isAllCollapsed) {
      setCollapsedIds(new Set())
    } else {
      setCollapsedIds(new Set(parentFolderIds))
    }
  }

  // 切换单个文件夹折叠 / 展开
  const toggleCollapse = (id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 构建平铺树供文件夹展示
  const flatFolderTree = useMemo(() => {
    const itemMap = new Map<string, CollectionTreeNode>()
    const roots: CollectionTreeNode[] = []

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

    const isSearching = folderSearch.trim().length > 0
    const q = folderSearch.toLowerCase().trim()

    const result: {
      col: CollectionNode
      level: number
      path: string
      hasChildren: boolean
      isCollapsed: boolean
    }[] = []

    function traverse(nodes: CollectionTreeNode[], level: number, parentPath: string) {
      for (const node of nodes) {
        const currentPath = parentPath ? `${parentPath} / ${node.name}` : node.name
        const hasChildren = node.children.length > 0
        const isCollapsed = collapsedIds.has(node.id)

        result.push({
          col: node,
          level,
          path: currentPath,
          hasChildren,
          isCollapsed
        })

        // 递归遍历子节点：
        // 搜索模式下遍历全部节点供后续匹配过滤；非搜索模式下仅当未折叠时遍历其子节点
        if (hasChildren && (isSearching || !isCollapsed)) {
          traverse(node.children, level + 1, currentPath)
        }
      }
    }
    traverse(roots, 0, '')

    if (!isSearching) return result
    return result.filter(item => item.path.toLowerCase().includes(q))
  }, [collections, folderSearch, collapsedIds])

  // 过滤后的标签
  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return tags
    const q = tagSearch.toLowerCase().trim()
    return tags.filter(t => t.name.toLowerCase().includes(q))
  }, [tags, tagSearch])

  // ================= 文件夹操作 =================
  // 新建文件夹（根级或子级）
  const handleCreateFolder = async (parentId: string | null) => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return

    setErrorMsg(null)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, parentId })
      })
      const data = await res.json()
      if (data.success) {
        setNewFolderName("")
        setCreatingParentId(null)
        await loadCollections()
        router.refresh()
      } else {
        setErrorMsg(data.error || t('folder_name_exists'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    }
  }

  // 重命名文件夹
  const handleRenameFolder = async (id: string) => {
    const trimmed = editingFolderName.trim()
    if (!trimmed) return

    setErrorMsg(null)
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      })
      const data = await res.json()
      if (data.success) {
        setEditingFolderId(null)
        setEditingFolderName("")
        await loadCollections()
        router.refresh()
      } else {
        setErrorMsg(data.error || t('folder_name_exists'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    }
  }

  // 删除文件夹
  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(`${t('delete_folder_confirm_prefix')}${name}${t('delete_folder_confirm_suffix')}`)) return

    setErrorMsg(null)
    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        await loadCollections()
        router.refresh()
      } else {
        setErrorMsg(data.error || t('delete_failed'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    }
  }

  // ================= 标签操作 =================
  // 新建标签
  const handleCreateTag = async () => {
    const trimmed = newTagName.trim().replace(/^#/, '')
    if (!trimmed) return

    setErrorMsg(null)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      })
      const data = await res.json()
      if (data.success) {
        setNewTagName("")
        await loadTags()
        router.refresh()
      } else {
        setErrorMsg(data.error || t('tag_name_exists'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    }
  }

  // 重命名标签
  const handleRenameTag = async (id: string) => {
    const trimmed = editingTagName.trim().replace(/^#/, '')
    if (!trimmed) return

    setErrorMsg(null)
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      })
      const data = await res.json()
      if (data.success) {
        setEditingTagId(null)
        setEditingTagName("")
        await loadTags()
        router.refresh()
      } else {
        setErrorMsg(data.error || t('tag_name_exists'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    }
  }

  // 删除标签
  const handleDeleteTag = async (id: string, name: string) => {
    if (!confirm(t('confirm_delete_tag').replace('{name}', name))) return

    setErrorMsg(null)
    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        await loadTags()
        router.refresh()
      } else {
        setErrorMsg(data.error || t('action_failed'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    }
  }

  // 一键清理无用标签
  const handleCleanUnusedTags = async () => {
    if (!confirm(t('clean_unused_tags_confirm'))) return

    setCleaningTags(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/tags?unused=true', { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        await loadTags()
        router.refresh()
      } else {
        setErrorMsg(data.error || t('action_failed'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    } finally {
      setCleaningTags(false)
    }
  }

  return (
    <>
      {/* 侧栏触发入口按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/50 rounded-lg cursor-pointer transition-colors text-left group"
      >
        <FolderCog className="w-4 h-4 text-slate-500 group-hover:text-blue-600 transition-colors" />
        <span className="text-sm font-medium group-hover:text-slate-900 transition-colors">{t('manage_categories')}</span>
      </button>

      {/* 管理中心右侧滑出抽屉侧边栏 */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200"
        >
          {/* 半透明背景遮罩 (不绑定点击关闭，必须点击×才能关闭) */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
          />

          {/* 右侧滑入抽屉主体 */}
          <div 
            className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full animate-in slide-in-from-right duration-200 z-10"
          >
            {/* 头部标题与关闭 */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <FolderCog className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">{t('category_management_title')}</h3>
                  <p className="text-xs text-slate-400">
                    {activeTab === 'folders' 
                      ? `${collections.length} ${t('tab_folders').toLowerCase()}`
                      : `${tags.length} ${t('tab_tags').toLowerCase()}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 选项卡导航 */}
            <div className="flex border-b border-slate-100 bg-slate-50/70 px-6 pt-2 gap-6 text-sm font-semibold shrink-0">
              <button
                onClick={() => {
                  setActiveTab('folders')
                  setErrorMsg(null)
                }}
                className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'folders'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Folder className="w-4 h-4" />
                <span>{t('tab_folders')}</span>
                <span className="text-xs bg-slate-200/60 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                  {collections.length}
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('tags')
                  setErrorMsg(null)
                }}
                className={`pb-2.5 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'tags'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <TagIcon className="w-4 h-4" />
                <span>{t('tab_tags')}</span>
                <span className="text-xs bg-slate-200/60 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
                  {tags.length}
                </span>
              </button>
            </div>

            {/* 错误提示横幅 */}
            {errorMsg && (
              <div className="mx-6 mt-3 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between shrink-0 animate-in fade-in">
                <span>⚠️ {errorMsg}</span>
                <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-600 font-bold">×</button>
              </div>
            )}

            {/* 内容区 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 folder-scroll">
              {/* ===================== TAB 1: 文件夹管理 ===================== */}
              {activeTab === 'folders' && (
                <div className="space-y-3.5">
                  {/* 顶部工具条：搜索 + 折叠控制 + 新建根文件夹 */}
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={folderSearch}
                        onChange={(e) => setFolderSearch(e.target.value)}
                        placeholder={`${t('search_folder')}...`}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {parentFolderIds.size > 0 && !folderSearch.trim() && (
                        <button
                          type="button"
                          onClick={toggleCollapseAll}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer"
                          title={isAllCollapsed ? t('expand_all') : t('collapse_all')}
                        >
                          {isAllCollapsed ? (
                            <>
                              <ChevronRight className="w-3.5 h-3.5" />
                              <span>{t('expand_all')}</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>{t('collapse_all')}</span>
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setCreatingParentId(creatingParentId === 'ROOT' ? null : 'ROOT')
                          setNewFolderName("")
                          setErrorMsg(null)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('new_folder')}</span>
                      </button>
                    </div>
                  </div>

                  {/* 新建根文件夹表单 */}
                  {creatingParentId === 'ROOT' && (
                    <div className="p-3 bg-blue-50/50 border border-blue-200/70 rounded-xl flex items-center gap-2 animate-in fade-in">
                      <Folder className="w-4 h-4 text-blue-600 shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder={t('new_folder_placeholder')}
                        className="flex-1 px-2.5 py-1 text-xs border border-blue-300 rounded-lg outline-none bg-white focus:ring-1 focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateFolder(null)
                        }}
                      />
                      <button
                        onClick={() => handleCreateFolder(null)}
                        disabled={!newFolderName.trim()}
                        className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40"
                      >
                        {t('create_btn')}
                      </button>
                      <button
                        onClick={() => setCreatingParentId(null)}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* 文件夹列表 */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                    {flatFolderTree.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        {t('empty_folders')}
                      </div>
                    ) : (
                      flatFolderTree.map(({ col, level, path, hasChildren, isCollapsed }) => (
                        <div key={col.id} className="flex flex-col">
                          <div 
                            style={{ paddingLeft: `${12 + level * 16}px` }}
                            className="group flex items-center justify-between pr-3 py-2 text-xs hover:bg-slate-50 transition-colors"
                          >
                            {/* 左侧：折叠箭头 + 层级标识 + 图标 + 名称 */}
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-3">
                              {/* 父文件夹展开/收起按钮 */}
                              {hasChildren ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleCollapse(col.id)
                                  }}
                                  title={isCollapsed ? t('expand') : t('collapse')}
                                  className="p-1 -ml-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-5.5 -ml-1 inline-block shrink-0" />
                              )}

                              {level > 0 ? (
                                <span className="text-[10px] text-slate-400 font-mono select-none shrink-0">└─</span>
                              ) : null}
                              <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />

                              {editingFolderId === col.id ? (
                                <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingFolderName}
                                    onChange={(e) => setEditingFolderName(e.target.value)}
                                    className="flex-1 px-2 py-0.5 text-xs border border-blue-400 rounded-md outline-none bg-white"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameFolder(col.id)
                                    }}
                                  />
                                  <button
                                    onClick={() => handleRenameFolder(col.id)}
                                    className="p-1 text-blue-600 hover:text-blue-800"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setEditingFolderId(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="font-medium text-slate-700 truncate" title={path}>
                                  {col.name}
                                </span>
                              )}
                            </div>

                            {/* 右侧：书签计数 + 动作按钮 */}
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[11px] text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded-full">
                                {col._count.bookmarks} {t('bookmarks_count')}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreatingParentId(creatingParentId === col.id ? null : col.id)
                                    setNewFolderName("")
                                    setErrorMsg(null)
                                    if (collapsedIds.has(col.id)) {
                                      setCollapsedIds(prev => {
                                        const next = new Set(prev)
                                        next.delete(col.id)
                                        return next
                                      })
                                    }
                                  }}
                                  title={t('create_subfolder')}
                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                                >
                                  <FolderPlus className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingFolderId(col.id)
                                    setEditingFolderName(col.name)
                                    setErrorMsg(null)
                                  }}
                                  title={t('rename')}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFolder(col.id, col.name)}
                                  title={t('delete_folder')}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* 行内新建子文件夹输入框 */}
                          {creatingParentId === col.id && (
                            <div 
                              style={{ paddingLeft: `${24 + level * 16}px` }}
                              className="py-2 pr-3 bg-blue-50/40 border-t border-slate-100 flex items-center gap-2 animate-in fade-in"
                            >
                              <span className="text-[10px] text-blue-500 font-mono">└─</span>
                              <input
                                type="text"
                                autoFocus
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder={t('subfolder_placeholder')}
                                className="flex-1 px-2.5 py-1 text-xs border border-blue-300 rounded-lg outline-none bg-white focus:ring-1 focus:ring-blue-500"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCreateFolder(col.id)
                                }}
                              />
                              <button
                                onClick={() => handleCreateFolder(col.id)}
                                disabled={!newFolderName.trim()}
                                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40"
                              >
                                {t('create_btn')}
                              </button>
                              <button
                                onClick={() => setCreatingParentId(null)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ===================== TAB 2: 标签管理 ===================== */}
              {activeTab === 'tags' && (
                <div className="space-y-4">
                  {/* 顶部工具条：搜索 + 清理无用标签 + 快速新建标签 */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder={`${t('tag_name')}...`}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={cleaningTags}
                      onClick={handleCleanUnusedTags}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all shrink-0 disabled:opacity-50"
                      title={t('clean_unused_tags')}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t('clean_unused_tags')}</span>
                    </button>
                  </div>

                  {/* 快速新建标签表单 */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2">
                    <TagIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder={t('add_tag')}
                      className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg outline-none bg-white focus:border-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateTag()
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                      className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      {t('create_btn')}
                    </button>
                  </div>

                  {/* 标签网格列表 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredTags.length === 0 ? (
                      <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                        {t('empty_tags')}
                      </div>
                    ) : (
                      filteredTags.map((tag) => (
                        <div 
                          key={tag.id}
                          className="flex items-center justify-between p-2.5 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all shadow-2xs group"
                        >
                          {editingTagId === tag.id ? (
                            <div className="flex items-center gap-1.5 flex-1 mr-2">
                              <input
                                type="text"
                                autoFocus
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                className="flex-1 px-2 py-0.5 text-xs border border-blue-400 rounded-md outline-none bg-white"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameTag(tag.id)
                                }}
                              />
                              <button
                                onClick={() => handleRenameTag(tag.id)}
                                className="p-1 text-blue-600 hover:text-blue-800"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingTagId(null)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                              <span className="text-blue-500 font-semibold text-xs shrink-0">#</span>
                              <span className="text-xs font-semibold text-slate-700 truncate" title={tag.name}>
                                {tag.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.2 rounded-md shrink-0">
                                {tag._count.bookmarks}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 shrink-0">
                            {editingTagId !== tag.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTagId(tag.id)
                                  setEditingTagName(tag.name)
                                  setErrorMsg(null)
                                }}
                                title={t('rename')}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteTag(tag.id, tag.name)}
                              title={t('delete')}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
