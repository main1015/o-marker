'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  X, Check, Folder, Tag as TagIcon, ExternalLink, Star, 
  Loader2, FolderInput, FileText, Pencil, AlertCircle
} from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

export type BookmarkItem = {
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

export type CollectionOption = {
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

export type DrawerTab = 'details' | 'folder' | 'tags'

interface BookmarkEditDrawerProps {
  isOpen: boolean
  onClose: () => void
  bookmark: BookmarkItem
  collections: CollectionOption[]
  onSaved?: (updated: BookmarkItem) => void
  isTrashView?: boolean
  initialSection?: DrawerTab
}

export default function BookmarkEditDrawer({
  isOpen,
  onClose,
  bookmark,
  collections,
  onSaved,
  isTrashView = false,
  initialSection = 'details',
}: BookmarkEditDrawerProps) {
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)

  // 当前独立的选项卡模式
  const [activeTab, setActiveTab] = useState<DrawerTab>(initialSection)

  // 1. 基本信息表单状态
  const [title, setTitle] = useState(bookmark.title || '')
  const [url, setUrl] = useState(bookmark.url || '')
  const [description, setDescription] = useState(bookmark.description || '')

  // 2. 所属文件夹状态
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(bookmark.collectionId || null)

  // 3. 标签状态
  const [tags, setTags] = useState<{ id: string; name: string }[]>(bookmark.tags || [])
  const [newTagInput, setNewTagInput] = useState('')

  // 收藏状态
  const [isFavorite, setIsFavorite] = useState(Boolean(bookmark.isFavorite))

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 打开抽屉时初始化各项数据
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialSection)
      setTitle(bookmark.title || '')
      setUrl(bookmark.url || '')
      setDescription(bookmark.description || '')
      setSelectedCollectionId(bookmark.collectionId || null)
      setTags(bookmark.tags || [])
      setNewTagInput('')
      setIsFavorite(Boolean(bookmark.isFavorite))
      setErrorMsg(null)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, bookmark, initialSection, onClose])

  const flatCollections = flattenCollectionOptions(collections)

  // 1. 保存基本信息 (标题、网址、备注)
  const handleSaveDetails = async () => {
    if (!url.trim()) {
      setErrorMsg(t('action_failed'))
      return
    }

    setSaving(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          url: url.trim(),
          description: description.trim() || null,
        }),
      })

      const data = await res.json()
      if (data.success && data.data) {
        onSaved?.(data.data)
        onClose()
      } else {
        setErrorMsg(data.error || t('action_failed'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    } finally {
      setSaving(false)
    }
  }

  // 2. 保存所属文件夹移动
  const handleSaveCollection = async () => {
    setSaving(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: selectedCollectionId,
        }),
      })

      const data = await res.json()
      if (data.success && data.data) {
        onSaved?.(data.data)
        onClose()
      } else {
        setErrorMsg(data.error || t('action_failed'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    } finally {
      setSaving(false)
    }
  }

  // 3. 标签操作与保存
  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newTagInput.trim()
    if (!trimmed) return

    const names = trimmed.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    const existingSet = new Set(tags.map(t => t.name.toLowerCase()))

    const toAdd = names
      .filter(n => !existingSet.has(n.toLowerCase()))
      .map(n => ({ id: `temp-${Date.now()}-${n}`, name: n }))

    if (toAdd.length > 0) {
      setTags([...tags, ...toAdd])
    }
    setNewTagInput('')
  }

  const handleRemoveTag = (tagIdOrName: string) => {
    setTags(tags.filter(t => t.id !== tagIdOrName && t.name !== tagIdOrName))
  }

  const handleSaveTags = async () => {
    setSaving(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: tags.map(t => t.name),
        }),
      })

      const data = await res.json()
      if (data.success && data.data) {
        onSaved?.(data.data)
        onClose()
      } else {
        setErrorMsg(data.error || t('action_failed'))
      }
    } catch {
      setErrorMsg(t('network_error'))
    } finally {
      setSaving(false)
    }
  }

  // 快速收藏切换
  const handleToggleFavorite = async () => {
    const nextVal = !isFavorite
    setIsFavorite(nextVal)
    try {
      await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: nextVal }),
      })
    } catch {
      setIsFavorite(!nextVal)
    }
  }

  if (!mounted || !isOpen) return null

  const drawerContent = (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* 半透明遮罩 (不点击关闭，只能点右上角 × 退出) */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" />

      {/* 右侧滑入抽屉主体 */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full animate-in slide-in-from-right duration-200 z-10">
        
        {/* 顶部标题栏 */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
              {bookmark.coverImg ? (
                <img src={bookmark.coverImg} alt="" className="w-5 h-5 object-contain" />
              ) : (
                <FileText className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-800 truncate">
                {activeTab === 'details' && t('edit_bookmark')}
                {activeTab === 'folder' && t('move_to_folder')}
                {activeTab === 'tags' && t('manage_tags')}
              </h3>
              <p className="text-[11px] text-slate-400 truncate max-w-[240px]">{url}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isTrashView && (
              <button
                type="button"
                onClick={handleToggleFavorite}
                title={t('favorites')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isFavorite 
                    ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' 
                    : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
                }`}
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
              </button>
            )}

            {/* 专属 × 退出按钮 */}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title={t('cancel')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 顶部功能切换选项卡 (三者各自分立，互不掺杂) */}
        <div className="flex border-b border-slate-100 bg-slate-50/60 px-5 pt-2 gap-5 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('details'); setErrorMsg(null); }}
            className={`pb-2 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{t('basic_info')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('folder'); setErrorMsg(null); }}
            className={`pb-2 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'folder'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FolderInput className="w-3.5 h-3.5" />
            <span>{t('collections')}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('tags'); setErrorMsg(null); }}
            className={`pb-2 flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'tags'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TagIcon className="w-3.5 h-3.5" />
            <span>{t('tags')}</span>
            <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded-full font-mono">
              {tags.length}
            </span>
          </button>
        </div>

        {/* 错误提示条 */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            独立面板内容区 (按 activeTab 单独展示，纯净专注)
            ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto folder-scroll p-5">
          
          {/* 面板 1：基本信息 (标题、网址、备注) */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{t('title')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('untitled')}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-slate-50/40 text-slate-800 font-medium transition-all"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">{t('url')}</label>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium hover:underline"
                  >
                    <span>{t('open_in_new_tab')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-slate-50/40 text-slate-700 font-mono transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span>📝</span>
                  <span>{t('note_label')}</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('note_placeholder')}
                  rows={6}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-slate-50/40 text-slate-700 transition-all leading-relaxed resize-y min-h-[140px]"
                />
              </div>
            </div>
          )}

          {/* 面板 2：所属文件夹选择 (独立大视窗树状列表) */}
          {activeTab === 'folder' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>{t('move_to_folder')}</span>
                <span className="font-semibold text-blue-600">
                  {t('current_label')}: {selectedCollectionId ? (collections.find(c => c.id === selectedCollectionId)?.name || '') : t('unclassified')}
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30 divide-y divide-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedCollectionId(null)}
                  className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    selectedCollectionId === null ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>📂</span>
                    <span>{t('remove_from_folder')}</span>
                  </span>
                  {selectedCollectionId === null && <Check className="w-4 h-4 text-blue-600" />}
                </button>

                <div className="max-h-[380px] overflow-y-auto folder-scroll divide-y divide-slate-50">
                  {flatCollections.map(({ col, level, path }) => {
                    const isSelected = selectedCollectionId === col.id
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => setSelectedCollectionId(col.id)}
                        title={path}
                        className={`w-full text-left py-2.5 pr-3.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        style={{ paddingLeft: `${14 + level * 14}px` }}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {level > 0 ? (
                            <span className="text-[10px] text-slate-400 font-mono shrink-0 select-none">└─</span>
                          ) : null}
                          <span className="shrink-0">{level > 0 ? '📁' : '📂'}</span>
                          <span className="truncate">{col.name}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-1.5" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 面板 3：标签管理 (独立标签池与输入) */}
          {activeTab === 'tags' && (
            <div className="space-y-4">
              {/* 添加输入框 */}
              <form onSubmit={handleAddTag} className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder={t('add_tag_placeholder')}
                  className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                />
                <button
                  type="submit"
                  disabled={!newTagInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {t('add_tag')}
                </button>
              </form>

              {/* 当前已有标签列表 */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">{t('tags')} ({tags.length})</label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50/50 border border-slate-200 rounded-xl min-h-[120px] content-start">
                  {tags.length > 0 ? (
                    tags.map(tItem => (
                      <div
                        key={tItem.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-2xs hover:border-blue-300"
                      >
                        <span>#{tItem.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tItem.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-0.5 cursor-pointer"
                          title={t('delete_tag')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="w-full text-center py-8 text-xs text-slate-400 italic">
                      {t('no_tags')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部固定操作栏 (针对当前面板独立保存，清晰简洁) */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            {t('cancel')}
          </button>

          {activeTab === 'details' && (
            <button
              type="button"
              onClick={handleSaveDetails}
              disabled={saving || !url.trim()}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{t('save')}</span>
            </button>
          )}

          {activeTab === 'folder' && (
            <button
              type="button"
              onClick={handleSaveCollection}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{t('save')}</span>
            </button>
          )}

          {activeTab === 'tags' && (
            <button
              type="button"
              onClick={handleSaveTags}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-40 cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{t('save')}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  )

  return createPortal(drawerContent, document.body)
}
