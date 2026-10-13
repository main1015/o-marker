'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Folder, Plus, Trash2, Check, X, ChevronRight, ChevronDown } from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

export type CollectionItem = {
  id: string
  name: string
  parentId?: string | null
  _count: { bookmarks: number; children?: number }
  children?: CollectionItem[]
}

export default function SidebarCollections({
  collections,
  activeCollectionId
}: {
  collections: CollectionItem[]
  activeCollectionId?: string
}) {
  const router = useRouter()
  const { t } = useI18n()

  // 新建表单状态：creatingParentId 为 null 表示创建根文件夹；为 id 表示创建该文件夹的子文件夹
  const [creatingParentId, setCreatingParentId] = useState<string | null | 'ROOT'>(null)
  const [newColName, setNewColName] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSectionCollapsed, setIsSectionCollapsed] = useState(false)

  // 展开折叠状态 (默认展开全部有子级的目录)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const set = new Set<string>()
    collections.forEach(c => {
      if (c.parentId) set.add(c.parentId)
    })
    return set
  })

  // 切换折叠/展开
  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 构建多级树形层级
  const collectionTree = useMemo(() => {
    const itemMap = new Map<string, CollectionItem>()
    const roots: CollectionItem[] = []

    // 初始化节点映射
    collections.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] })
    })

    // 组装父子树
    collections.forEach(item => {
      const node = itemMap.get(item.id)!
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId)!.children!.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots
  }, [collections])

  // 新建（根文件夹或子文件夹）
  const handleCreate = async (e: React.FormEvent, parentId: string | null) => {
    e.preventDefault()
    const trimmed = newColName.trim()
    if (!trimmed) return

    // 检查同一父级下是否已存在同名文件夹
    const isDuplicate = collections.some(
      c => (c.parentId || null) === (parentId || null) && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (isDuplicate) {
      alert(t('folder_name_exists'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newColName.trim(),
          parentId: parentId || null
        })
      })
      const data = await res.json()
      if (data.success) {
        setNewColName("")
        setCreatingParentId(null)
        if (parentId) {
          // 自动展开父级
          setExpandedIds(prev => new Set(prev).add(parentId))
        }
        router.refresh()
      } else {
        alert(data.error || t('create_failed'))
      }
    } catch {
      alert(t('network_error'))
    } finally {
      setLoading(false)
    }
  }

  // 删除文件夹
  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`${t('delete_folder_confirm_prefix')}${name}${t('delete_folder_confirm_suffix')}`)) return

    try {
      const res = await fetch(`/api/collections/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        if (activeCollectionId === id) {
          router.push('/')
        } else {
          router.refresh()
        }
      } else {
        alert(data.error || t('delete_failed'))
      }
    } catch {
      alert(t('network_error'))
    }
  }

  // 递归渲染文件夹节点
  const renderTreeNode = (node: CollectionItem, level: number = 0) => {
    const isActive = activeCollectionId === node.id
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    const isCreatingSub = creatingParentId === node.id

    return (
      <div key={node.id} className="space-y-0.5">
        <a
          href={`/?collectionId=${node.id}`}
          style={{ paddingLeft: `${12 + level * 14}px` }}
          className={`group flex items-center gap-2 pr-3 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${
            isActive
              ? "bg-white shadow-xs text-blue-600 font-medium"
              : "text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          {/* 折叠/展开指示器 */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(e, node.id)}
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded transition-transform"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-3 h-3" />
          )}

          <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
          <span className="flex-1 truncate">{node.name}</span>
          <span className="text-[11px] opacity-60 group-hover:hidden font-mono">
            {node._count.bookmarks}
          </span>

          {/* 悬停快捷动作条：新建子文件夹 + 删除 */}
          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setCreatingParentId(node.id)
                setNewColName("")
              }}
              title={t('create_subfolder')}
              className="p-0.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-200/60 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDelete(e, node.id, node.name)}
              title={t('delete_folder')}
              className="p-0.5 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </a>

        {/* 行内新建子文件夹表单 */}
        {isCreatingSub && (
          <form
            onSubmit={(e) => handleCreate(e, node.id)}
            style={{ paddingLeft: `${12 + (level + 1) * 14}px` }}
            className="pr-3 my-1 flex items-center gap-1.5 animate-in fade-in duration-150"
          >
            <input
              type="text"
              autoFocus
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder={t('subfolder_placeholder')}
              className="flex-1 px-2 py-1 text-xs border border-blue-300 rounded-md outline-none focus:border-blue-500 bg-white shadow-2xs"
            />
            <button
              type="submit"
              disabled={loading || !newColName.trim()}
              className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setCreatingParentId(null)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          </form>
        )}

        {/* 渲染子级文件夹 (展开态) */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between px-3 mb-2">
        <button
          type="button"
          onClick={() => setIsSectionCollapsed(!isSectionCollapsed)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors select-none group"
        >
          {isSectionCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-transform" />
          )}
          <span>{t('collections')}</span>
          <span className="text-[10px] text-slate-400 font-mono normal-case">
            ({collections.length})
          </span>
        </button>
        <button
          onClick={() => {
            if (isSectionCollapsed) setIsSectionCollapsed(false)
            setCreatingParentId(creatingParentId === 'ROOT' ? null : 'ROOT')
            setNewColName("")
          }}
          className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
          title={t('new_folder')}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {!isSectionCollapsed && (
        <>
          {/* 新建根文件夹行内输入 */}
          {creatingParentId === 'ROOT' && (
            <form
              onSubmit={(e) => handleCreate(e, null)}
              className="px-3 mb-2 flex items-center gap-1.5 animate-in fade-in duration-150"
            >
              <input
                type="text"
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder={t('new_folder_placeholder')}
                className="flex-1 px-2 py-1 text-xs border border-blue-300 rounded-md outline-none focus:border-blue-500 bg-white shadow-2xs"
              />
              <button
                type="submit"
                disabled={loading || !newColName.trim()}
                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setCreatingParentId(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          )}

          {/* 多级树形文件夹列表 (限制最大高度独立滚动，防止挤压下方标签) */}
          <div className="space-y-0.5 max-h-[38vh] overflow-y-auto pr-1 folder-scroll">
            {collectionTree.map(root => renderTreeNode(root, 0))}
            {collections.length === 0 && creatingParentId !== 'ROOT' && (
              <div className="px-3 text-xs text-slate-400">{t('no_collections')}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
