'use client'

import { useState, useEffect } from 'react'
import { PanelLeftClose, PanelLeft } from 'lucide-react'
import { useI18n } from '@/lib/useI18n'

interface AppLayoutProps {
  sidebarContent: React.ReactNode
  sidebarFooter: React.ReactNode
  headerSearch: React.ReactNode
  headerActions: React.ReactNode
  children: React.ReactNode
}

export default function AppLayout({
  sidebarContent,
  sidebarFooter,
  headerSearch,
  headerActions,
  children,
}: AppLayoutProps) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('omarker_sidebar_collapsed')
    if (saved !== null) {
      setCollapsed(saved === 'true')
    }
  }, [])

  // 快捷键支持 (Ctrl + B 或 Cmd + B 切换侧边栏)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        // 如果在输入框内则不拦截
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('omarker_sidebar_collapsed', String(next))
      return next
    })
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      
      {/* ─────────────────────────────────────────────────────────────
          左侧边栏 (支持平滑收缩折叠，最外层滚动条彻底隐藏)
          ───────────────────────────────────────────────────────────── */}
      <aside
        className={`bg-slate-100/50 border-r border-slate-200 flex flex-col shrink-0 transition-all duration-300 ease-in-out select-none relative ${
          collapsed 
            ? 'w-0 border-r-0 overflow-hidden opacity-0 pointer-events-none' 
            : 'w-64 opacity-100'
        }`}
      >
        <div className="w-64 flex flex-col h-full">
          
          {/* 侧边栏顶部：Logo 与 收起按钮 */}
          <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200/50 shrink-0">
            <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                o
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-800 truncate">
                o-marker
              </h1>
            </a>

            {/* 收起侧边栏按钮 */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer shrink-0"
              title={`${t('collapse')} (Ctrl+B)`}
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
          
          {/* 侧边栏内容滚动区 (去除最外层粗丑滚动条，保留滚轮滚动能力) */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-2 space-y-6">
            {sidebarContent}
          </div>

          {/* 底部设置与分类管理 */}
          <div className="p-3 border-t border-slate-200 space-y-1 shrink-0 bg-slate-100/30">
            {sidebarFooter}
          </div>

        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          右侧主内容区
          ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        
        {/* 顶部工具栏 (Header) */}
        <header className="h-16 border-b border-slate-100 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
            {/* 当侧边栏收起时展示一键展开按钮 */}
            {collapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 animate-in fade-in duration-200"
                title={`${t('expand')} (Ctrl+B)`}
              >
                <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  o
                </div>
                <PanelLeft className="w-4 h-4 text-slate-600" />
              </button>
            )}

            {headerSearch}
          </div>

          <div className="shrink-0">
            {headerActions}
          </div>
        </header>

        {/* 页面主视图内容 */}
        {children}

      </main>

    </div>
  )
}
