'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Settings, X, Download, Upload, Database, Info, 
  Sliders, Trash2, Sparkles, RefreshCw
} from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

export default function SettingsModal({
  stats
}: {
  stats: {
    totalBookmarks: number
    totalCollections: number
    totalTags: number
    trashCount?: number
  }
}) {
  const router = useRouter()
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'about'>('general')

  // 可配置项（与 localStorage 绑定）
  const [openInNewTab, setOpenInNewTab] = useState(true)
  const [showUrl, setShowUrl] = useState(true)
  const [compactView, setCompactView] = useState(false)

  // 维护状态
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 读取已保存的设置
  useEffect(() => {
    const savedNewTab = localStorage.getItem('omarker_new_tab')
    if (savedNewTab !== null) setOpenInNewTab(savedNewTab === 'true')

    const savedShowUrl = localStorage.getItem('omarker_show_url')
    if (savedShowUrl !== null) setShowUrl(savedShowUrl === 'true')

    const savedCompact = localStorage.getItem('omarker_compact_view')
    if (savedCompact !== null) setCompactView(savedCompact === 'true')
  }, [])

  // 保存设置并分发事件
  const handleToggleNewTab = () => {
    const newVal = !openInNewTab
    setOpenInNewTab(newVal)
    localStorage.setItem('omarker_new_tab', String(newVal))
    window.dispatchEvent(new Event('omarker_settings_changed'))
  }

  const handleToggleShowUrl = () => {
    const newVal = !showUrl
    setShowUrl(newVal)
    localStorage.setItem('omarker_show_url', String(newVal))
    window.dispatchEvent(new Event('omarker_settings_changed'))
  }

  const handleToggleCompact = () => {
    const newVal = !compactView
    setCompactView(newVal)
    localStorage.setItem('omarker_compact_view', String(newVal))
    window.dispatchEvent(new Event('omarker_settings_changed'))
  }

  // ESC 快捷键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // 1. 导出书签
  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/export')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `o-marker-bookmarks-${new Date().toISOString().slice(0, 10)}.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  // 2. 导入书签 (HTML)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        router.refresh()
      } else {
        alert(data.error || '导入失败')
      }
    } catch {
      alert(t('network_error'))
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 3. 一键查重合并
  const handleDeduplicate = async () => {
    setCleaning(true)
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduplicate' })
      })
      const data = await res.json()
      alert(data.message)
      if (data.success) router.refresh()
    } catch {
      alert(t('network_error'))
    } finally {
      setCleaning(false)
    }
  }

  // 4. 清空废纸篓
  const handleEmptyTrash = async () => {
    if (!confirm(t('confirm_empty_trash'))) return

    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'empty_trash' })
      })
      const data = await res.json()
      alert(data.message)
      if (data.success) router.refresh()
    } catch {
      alert(t('action_failed'))
    }
  }

  return (
    <>
      {/* 隐藏的本地文件上传选择器 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".html,.htm"
        className="hidden"
      />

      {/* 底部设置触发按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-200/50 rounded-lg cursor-pointer transition-colors text-left"
      >
        <Settings className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium">{t('settings')}</span>
      </button>

      {/* 模态框遮罩与面板 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          >
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-800">{t('preferences_title')}</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 选项卡导航 */}
            <div className="flex border-b border-slate-100 bg-slate-50 px-6 pt-2 gap-6 text-sm font-medium">
              <button
                onClick={() => setActiveTab('general')}
                className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === 'general'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sliders className="w-4 h-4" />
                {t('tab_general')}
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === 'data'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Database className="w-4 h-4" />
                {t('tab_data')}
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
                  activeTab === 'about'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Info className="w-4 h-4" />
                {t('tab_about')}
              </button>
            </div>

            {/* 内容区 */}
            <div className="p-6 space-y-4 max-h-[440px] overflow-y-auto">
              
              {/* 常规标签页：真正可点击、可生效的开关 */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  
                  {/* 开关 1: 新标签页打开 */}
                  <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{t('open_in_new_tab')}</div>
                      <div className="text-xs text-slate-400">{t('new_tab_desc')}</div>
                    </div>
                    <button
                      onClick={handleToggleNewTab}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        openInNewTab ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        openInNewTab ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {/* 开关 2: 显示网址 */}
                  <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{t('show_url')}</div>
                      <div className="text-xs text-slate-400">{t('show_url_desc')}</div>
                    </div>
                    <button
                      onClick={handleToggleShowUrl}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        showUrl ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showUrl ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {/* 开关 3: 紧凑高密度模式 */}
                  <div className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{t('compact_mode')}</div>
                      <div className="text-xs text-slate-400">{t('compact_mode_desc')}</div>
                    </div>
                    <button
                      onClick={handleToggleCompact}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        compactView ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        compactView ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                </div>
              )}

              {/* 数据维护标签页：导入/导出/清理/查重 */}
              {activeTab === 'data' && (
                <div className="space-y-4">
                  {/* 数据看板 */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{t('stats_overview')}</h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="text-base font-bold text-blue-600">{stats.totalBookmarks}</div>
                        <div className="text-[10px] text-slate-400">{t('stats_active')}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="text-base font-bold text-slate-700">{stats.totalCollections}</div>
                        <div className="text-[10px] text-slate-400">{t('stats_collections')}</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="text-base font-bold text-slate-700">{stats.totalTags}</div>
                        <div className="text-[10px] text-slate-400">{t('stats_tags')}</div>
                      </div>
                    </div>
                  </div>

                  {/* 数据迁移与操作 */}
                  <div className="space-y-3 pt-1">
                    
                    {/* 导入 Chrome HTML */}
                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{t('import_bookmarks')}</div>
                        <div className="text-xs text-slate-400">{t('import_bookmarks_desc')}</div>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {importing ? t('importing') : t('select_file_import')}
                      </button>
                    </div>

                    {/* 导出全部 HTML */}
                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{t('export_bookmarks')}</div>
                        <div className="text-xs text-slate-400">{t('export_bookmarks_desc')}</div>
                      </div>
                      <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {exporting ? t('exporting') : t('export_bookmarks')}
                      </button>
                    </div>

                    {/* 书签一键去重与体检 */}
                    <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{t('deduplicate')}</div>
                        <div className="text-xs text-slate-400">{t('deduplicate_desc')}</div>
                      </div>
                      <button
                        onClick={handleDeduplicate}
                        disabled={cleaning}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {cleaning ? t('deduplicating') : t('deduplicate')}
                      </button>
                    </div>

                    {/* 清空废纸篓 */}
                    <div className="flex items-center justify-between p-3 bg-red-50/40 border border-red-100 rounded-xl">
                      <div>
                        <div className="text-sm font-medium text-red-800">{t('empty_trash_action')}</div>
                        <div className="text-xs text-red-500">{t('empty_trash_desc')}</div>
                      </div>
                      <button
                        onClick={handleEmptyTrash}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('empty_trash_action')}
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* 关于系统 */}
              {activeTab === 'about' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                      o
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{t('about_title')}</div>
                      <div className="text-xs text-slate-400">{t('about_version')}</div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-2 p-1 leading-relaxed">
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-400">{t('about_desc')}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-500">{t('about_status')}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* 底部按钮 */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors shadow-sm"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
