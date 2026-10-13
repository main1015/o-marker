import { useEffect, useState, useRef, useCallback } from "react"
import "./style.css"
import LanguageSelector from "./LanguageSelector"
import { getExtTranslation, type Locale } from "./i18n"
import { apiFetch, getServerUrl } from "./api"
import TagInput from "./components/TagInput"
import FolderPicker, { type Collection } from "./components/FolderPicker"
import SettingsDrawer from "./components/SettingsDrawer"
import BookmarkSearchPanel from "./components/BookmarkSearchPanel"

type BookmarkData = {
  id: string
  url: string
  title: string
  description?: string
  coverImg?: string
  collectionId?: string
  tags?: { name: string }[] | string[]
  isFavorite?: boolean
  status?: string
  createdAt?: string
  lastVisitedAt?: string
}

function formatDateTime(dateStr: string | null | undefined, locale: Locale): string {
  if (!dateStr) return ""
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ""

    if (locale === "zh" || locale === "zh-TW") {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      const hours = String(d.getHours()).padStart(2, "0")
      const minutes = String(d.getMinutes()).padStart(2, "0")
      return `${year}年${month}月${day}日 ${hours}:${minutes}`
    }

    const localeMap: Record<string, string> = {
      en: "en-US",
      ja: "ja-JP",
      ko: "ko-KR",
      de: "de-DE",
      fr: "fr-FR",
      es: "es-ES",
      it: "it-IT",
      pt: "pt-PT",
      ru: "ru-RU",
      ar: "ar-SA",
      hi: "hi-IN",
      vi: "vi-VN",
      id: "id-ID",
      th: "th-TH",
      nl: "nl-NL",
      pl: "pl-PL"
    }

    return new Intl.DateTimeFormat(localeMap[locale] || "zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(d)
  } catch {
    return ""
  }
}

export default function IndexPopup() {
  const [locale, setLocale] = useState<Locale>("zh")
  const t = (key: string) => getExtTranslation(locale, key)

  // 国际化持久化
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["omarker_locale"], (res) => {
        if (res.omarker_locale) setLocale(res.omarker_locale)
      })
    } else {
      const saved = localStorage.getItem("omarker_locale") as Locale
      if (saved) setLocale(saved)
    }
  }, [])

  const handleLocaleChange = (newLoc: Locale) => {
    setLocale(newLoc)
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ omarker_locale: newLoc })
    }
    localStorage.setItem("omarker_locale", newLoc)
  }

  // 通知后台 Service Worker 切换当前标签页的小图标 (亮色/暗色)
  const notifyTabIcon = (tabId: number | undefined, isSaved: boolean) => {
    if (typeof chrome !== "undefined" && chrome.runtime && tabId) {
      chrome.runtime.sendMessage({
        type: "SET_TAB_BOOKMARK_STATUS",
        tabId,
        isSaved
      }).catch(() => {})
    }
  }

  // 当前网页标签
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null)

  // 核心书签数据与状态
  const [bookmarkId, setBookmarkId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [note, setNote] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [collectionId, setCollectionId] = useState<string | undefined>(undefined)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [lastVisitedAt, setLastVisitedAt] = useState<string | null>(null)
  const [isInternalPage, setIsInternalPage] = useState(false)
  const [internalPageType, setInternalPageType] = useState<"dashboard" | "browser">("dashboard")

  // 同步状态
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [serverUrl, setServerUrlState] = useState("http://localhost:7364")
  const [isSearching, setIsSearching] = useState(false)
  const isRtl = locale === "ar"

  // 会话快照状态
  const [sessionSaving, setSessionSaving] = useState(false)
  const [sessionSuccess, setSessionSuccess] = useState(false)

  // 防抖计时器
  const isInitialMount = useRef(true)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 加载文件夹集合
  const loadCollections = useCallback(async () => {
    try {
      const res = await apiFetch("/api/collections")
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setCollections(data.data)
      }
    } catch (e) {
      console.warn("Failed to fetch collections:", e)
    }
  }, [])

  // 初始加载当前服务地址
  useEffect(() => {
    getServerUrl().then(setServerUrlState)
  }, [])

  // 1. 初始化检查当前标签页状态
  useEffect(() => {
    const checkCurrentTab = async () => {
      let tab: chrome.tabs.Tab | null = null

      if (typeof chrome !== "undefined" && chrome.tabs) {
        const queryTabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, resolve)
        })
        if (queryTabs && queryTabs.length > 0) {
          tab = queryTabs[0]
        }
      }

      if (!tab) {
        tab = {
          url: "https://example.com/demo",
          title: "示例文档 - 极简高雅的书签体验",
          favIconUrl: "https://example.com/favicon.ico"
        } as chrome.tabs.Tab
      }

      setCurrentTab(tab)
      setTitle(tab.title || "")
      setUrl(tab.url || "")

      await loadCollections()

      const targetUrl = tab.url || ""
      if (!targetUrl) {
        setSyncStatus("error")
        setErrorMessage("无法获取当前页面 URL")
        return
      }

      // 判断是否为浏览器内部或 o-marker 控制台页面
      const isInternalBrowser = targetUrl.startsWith("chrome://") || 
                               targetUrl.startsWith("chrome-extension://") || 
                               targetUrl.startsWith("edge://") || 
                               targetUrl.startsWith("about:")
      const isDashboard = targetUrl.includes("localhost:7364") || 
                          (serverUrl && targetUrl.startsWith(serverUrl.replace(/\/+$/, "")))

      if (isInternalBrowser || isDashboard) {
        setIsInternalPage(true)
        setInternalPageType(isDashboard ? "dashboard" : "browser")
        setSyncStatus("idle")
        if (tab.id) notifyTabIcon(tab.id, false)
        return
      }

      setIsInternalPage(false)

      // 精准探测当前网页在服务端的已有状态 (ACTIVE 或 TRASH)
      setSyncStatus("saving")
      try {
        const checkRes = await apiFetch(`/api/bookmarks?url=${encodeURIComponent(targetUrl)}`)
        const checkData = await checkRes.json()

        if (checkData.success && checkData.data) {
          const item: BookmarkData = checkData.data
          setBookmarkId(item.id)
          setTitle(item.title || tab.title || "")
          setUrl(item.url || tab.url || "")
          setNote(item.description || "")
          if (item.collectionId) setCollectionId(item.collectionId)
          if (Array.isArray(item.tags)) {
            setTags(item.tags.map((t: any) => (typeof t === "string" ? t : t.name)))
          }
          setIsFavorite(!!item.isFavorite)
          setCreatedAt(item.createdAt || null)
          setLastVisitedAt(item.lastVisitedAt || null)

          if (item.status === "TRASH") {
            setIsDeleted(true)
            if (tab.id) notifyTabIcon(tab.id, false)
          } else {
            setIsDeleted(false)
            if (tab.id) notifyTabIcon(tab.id, true)
          }
          setSyncStatus("saved")
        } else {
          // 尚未保存：填充当前页面的真实标题和网址
          setBookmarkId(null)
          setTitle(tab.title || "")
          setUrl(tab.url || "")
          setNote("")
          setCreatedAt(null)
          setLastVisitedAt(null)
          setIsDeleted(false)
          setSyncStatus("idle")
          if (tab.id) notifyTabIcon(tab.id, false)
        }
      } catch (err: any) {
        console.error("Check bookmark error:", err)
        setTitle(tab.title || "")
        setUrl(tab.url || "")
        setSyncStatus("error")
        setErrorMessage(t("network_error"))
      }
    }

    checkCurrentTab()
  }, [])

  // 2. 主动保存新网页
  const handleSaveNewBookmark = async () => {
    let finalUrl = (url || currentTab?.url || "").trim()
    if (!finalUrl) {
      setSyncStatus("error")
      setErrorMessage("URL 不能为空")
      return
    }

    // 协议自动补全容错
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`
      setUrl(finalUrl)
    }

    setSyncStatus("saving")
    try {
      const res = await apiFetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: finalUrl,
          title: title.trim() || currentTab?.title || "Untitled",
          description: note.trim() || undefined,
          coverImg: currentTab?.favIconUrl || "",
          collectionId: collectionId || undefined,
          tags: tags.length > 0 ? tags : undefined
        })
      })
      const data = await res.json()
      if (data.success && data.data) {
        const item: BookmarkData = data.data
        setBookmarkId(item.id)
        setTitle(item.title || title || currentTab?.title || "")
        setUrl(item.url || finalUrl)
        setNote(item.description || "")
        setIsFavorite(!!item.isFavorite)
        setIsDeleted(false)
        setCreatedAt(item.createdAt || new Date().toISOString())
        setLastVisitedAt(item.lastVisitedAt || new Date().toISOString())
        setSyncStatus("saved")
        setShowSuccessToast(true)
        if (currentTab?.id) notifyTabIcon(currentTab.id, true)
        setTimeout(() => setShowSuccessToast(false), 2500)
      } else {
        throw new Error(data.error || "Save error")
      }
    } catch (err: any) {
      console.error("Save new bookmark error:", err)
      setSyncStatus("error")
      setErrorMessage(err.message || t("network_error"))
    }
  }

  // 3. 原地属性即时同步与防抖同步 (仅在已保存有效书签状态下触发)
  const syncNow = useCallback(
    async (newTitle: string, newUrl: string, newNote: string, newTags: string[], newCollectionId?: string, newFav?: boolean) => {
      if (!bookmarkId || isDeleted || isInternalPage) return

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }

      setSyncStatus("saving")
      try {
        const res = await apiFetch(`/api/bookmarks/${bookmarkId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTitle.trim(),
            url: newUrl.trim(),
            description: newNote.trim(),
            tags: newTags,
            collectionId: newCollectionId || null,
            isFavorite: newFav
          })
        })
        const data = await res.json()
        if (data.success) {
          setSyncStatus("saved")
        } else {
          throw new Error(data.error || "Patch failed")
        }
      } catch (err: any) {
        console.error("Sync failed:", err)
        setSyncStatus("error")
      }
    },
    [bookmarkId, isDeleted, isInternalPage]
  )

  const triggerAutoSync = useCallback(
    (newTitle: string, newUrl: string, newNote: string, newTags: string[], newCollectionId?: string, newFav?: boolean) => {
      if (!bookmarkId || isDeleted || isInternalPage) return

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      setSyncStatus("saving")
      debounceTimerRef.current = setTimeout(() => {
        syncNow(newTitle, newUrl, newNote, newTags, newCollectionId, newFav)
      }, 200)
    },
    [bookmarkId, isDeleted, isInternalPage, syncNow]
  )

  const latestDataRef = useRef({ title, url, note, tags, collectionId, isFavorite, bookmarkId, isDeleted, isInternalPage })
  useEffect(() => {
    latestDataRef.current = { title, url, note, tags, collectionId, isFavorite, bookmarkId, isDeleted, isInternalPage }
  }, [title, url, note, tags, collectionId, isFavorite, bookmarkId, isDeleted, isInternalPage])

  // 页面关闭或切走前保证立即保存未落地的防抖数据
  useEffect(() => {
    const handlePageHide = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
        const current = latestDataRef.current
        if (current.bookmarkId && !current.isDeleted && !current.isInternalPage) {
          getServerUrl().then(serverUrl => {
            fetch(`${serverUrl}/api/bookmarks/${current.bookmarkId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: current.title.trim(),
                url: current.url.trim(),
                description: current.note.trim(),
                tags: current.tags,
                collectionId: current.collectionId || null,
                isFavorite: current.isFavorite
              }),
              keepalive: true
            }).catch(() => {})
          })
        }
      }
    }
    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("beforeunload", handlePageHide)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("beforeunload", handlePageHide)
    }
  }, [])

  useEffect(() => {
    if (isInitialMount.current) {
      if (bookmarkId) {
        isInitialMount.current = false
      }
      return
    }
    if (bookmarkId && !isDeleted && !isInternalPage) {
      triggerAutoSync(title, url, note, tags, collectionId, isFavorite)
    }
  }, [title, url, note, tags, collectionId, isFavorite, isDeleted, isInternalPage, triggerAutoSync, bookmarkId])

  // 4. 移入废纸篓
  const handleDelete = async () => {
    if (!bookmarkId) return
    try {
      setSyncStatus("saving")
      const res = await apiFetch(`/api/bookmarks/${bookmarkId}`, {
        method: "DELETE"
      })
      const data = await res.json()
      if (data.success) {
        setIsDeleted(true)
        setSyncStatus("saved")
        if (currentTab?.id) notifyTabIcon(currentTab.id, false)
      }
    } catch (e) {
      console.error("Delete failed:", e)
    }
  }

  // 5. 从废纸篓恢复
  const handleRestore = async () => {
    if (!bookmarkId) return
    try {
      setSyncStatus("saving")
      const res = await apiFetch(`/api/bookmarks/${bookmarkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" })
      })
      const data = await res.json()
      if (data.success) {
        setIsDeleted(false)
        setSyncStatus("saved")
        if (currentTab?.id) notifyTabIcon(currentTab.id, true)
      }
    } catch (e) {
      console.error("Restore failed:", e)
    }
  }

  // 6. 打包保存窗口所有标签 (前置过滤与防重)
  const handleSaveWindowTabs = async () => {
    if (sessionSaving) return
    setSessionSaving(true)
    try {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ currentWindow: true }, async (tabs) => {
          // 仅提交有效的外部网页
          const validTabs = tabs.filter(
            (t) => t.url && (t.url.startsWith("http://") || t.url.startsWith("https://"))
          )

          const res = await apiFetch("/api/bookmarks/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tabs: validTabs })
          })
          const data = await res.json()
          if (data.success) {
            setSessionSuccess(true)
            if (data.data?.collection) {
              loadCollections()
            }
            setTimeout(() => setSessionSuccess(false), 2500)
          }
          setSessionSaving(false)
        })
      } else {
        setSessionSaving(false)
      }
    } catch (err) {
      console.error("Session save failed:", err)
      setSessionSaving(false)
    }
  }

  // 7. 打开 Web 控制台
  const handleOpenDashboard = () => {
    const cleanBase = serverUrl ? serverUrl.replace(/\/+$/, "") : "http://localhost:7364"
    const url = `${cleanBase}/`
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url })
    } else {
      window.open(url, "_blank")
    }
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        width: isSearching ? "760px" : "360px",
        height: isSearching ? "580px" : "550px",
        minWidth: isSearching ? "760px" : "360px",
        minHeight: isSearching ? "580px" : "550px"
      }}
      className={`relative flex flex-col font-sans bg-slate-50 text-slate-800 overflow-hidden select-none transition-all duration-150 ${
        isSearching ? "w-[760px] h-[580px]" : "w-[360px] h-[550px]"
      }`}
    >
      {/* 云端与服务设置抽屉 */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        t={t}
        onSaved={(newUrl) => {
          setServerUrlState(newUrl)
          loadCollections()
        }}
      />

      {isSearching ? (
        <BookmarkSearchPanel
          locale={locale}
          t={t}
          onClose={() => setIsSearching(false)}
          formatDateTime={formatDateTime}
          onOpenDashboard={handleOpenDashboard}
          collections={collections}
        />
      ) : (
        <>
          {/* 保存成功浮动 Toast */}
          {showSuccessToast && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <span>✓</span>
              <span>{t("saved_btn")}</span>
            </div>
          )}

          {/* 顶栏操作条 (紧凑不折行，各元素空间自适应) */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-slate-100 shadow-2xs h-11 shrink-0">
        {/* 左侧：状态徽章与快捷动作 */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
          {isInternalPage ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium border border-slate-200 truncate">
              <span>{internalPageType === "dashboard" ? "🖥️" : "🌐"}</span>
              <span className="truncate">
                {internalPageType === "dashboard" ? t("badge_dashboard") : t("badge_internal")}
              </span>
            </div>
          ) : isDeleted ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200 shrink-0">
              <span>🗑️</span>
              <span>{t("status_trash")}</span>
            </div>
          ) : syncStatus === "saving" ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
              <span>{t("saving")}</span>
            </div>
          ) : syncStatus === "error" ? (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold border border-rose-200 cursor-pointer shrink-0 truncate hover:bg-rose-100 transition-colors"
              onClick={() => setIsSettingsOpen(true)}
              title={errorMessage}
            >
              <span>✕ {t("offline_click_config") || "离线"}</span>
            </div>
          ) : !bookmarkId ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-medium border border-slate-200 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>{t("status_unsaved")}</span>
            </div>
          ) : syncStatus === "saved" ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200 shrink-0 animate-in fade-in duration-150">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>✓ {t("saved")}</span>
            </div>
          ) : null}

          {/* 垃圾桶删除按钮 (仅在正常已保存时显示) */}
          {bookmarkId && !isDeleted && !isInternalPage && (
            <button
              type="button"
              onClick={handleDelete}
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md transition-colors shrink-0"
              title={t("remove_bookmark")}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>

        {/* 右侧：标星、搜索、设置齿轮与多语言选择器 */}
        <div className="flex items-center gap-1 shrink-0">
          {/* 搜索书签入口 */}
          <button
            type="button"
            onClick={() => setIsSearching(true)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title={t("search_tooltip")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>

          {/* 星标收藏 (仅对已保存书签显示) */}
          {bookmarkId && !isDeleted && !isInternalPage && (
            <button
              type="button"
              onClick={() => setIsFavorite(!isFavorite)}
              className={`p-1 rounded-md transition-colors ${
                isFavorite ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100"
              }`}
              title={t("favorite_btn")}
            >
              <svg
                className="w-4 h-4 fill-current"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={isFavorite ? "0" : "2"}
              >
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </button>
          )}

          {/* 设置齿轮 */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title={t("settings_title")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* 18 语种选择器 */}
          <LanguageSelector locale={locale} onLocaleChange={handleLocaleChange} />
        </div>
      </div>

      {/* 主体交互区域 (按状态精准展现) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
        {/* 情况 1：处于 o-marker 控制台或浏览器内置系统页面 */}
        {isInternalPage ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shadow-inner">
              {internalPageType === "dashboard" ? "🖥️" : "🌐"}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {internalPageType === "dashboard" ? t("dashboard_title") : t("browser_internal_title")}
              </h2>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-[250px]">
                {internalPageType === "dashboard" ? t("dashboard_desc") : t("browser_internal_desc")}
              </p>
            </div>
            {internalPageType === "dashboard" && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 text-left leading-relaxed max-w-[260px]">
                <span className="font-semibold text-slate-700 block mb-0.5">
                  {t("dashboard_how_to_use_title")}
                </span>
                {t("dashboard_how_to_use_desc")}
              </div>
            )}
          </div>
        ) : isDeleted ? (
          /* 情况 2：当前网页已在废纸篓中 */
          <div className="h-full flex flex-col justify-between p-4 bg-white rounded-2xl border border-amber-200/80 shadow-2xs animate-in fade-in duration-150">
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-xs font-medium">
                <span className="text-base">🗑️</span>
                <span>{t("trash_banner_desc")}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <h3 className="text-xs font-bold text-slate-700 truncate" title={title}>
                  {title || t("untitled")}
                </h3>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{currentTab?.url}</p>
                {note && (
                  <p className="text-xs text-slate-500 mt-2 bg-white p-2 rounded-lg border border-slate-200/60">
                    {note}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleRestore}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>↩️</span>
              <span>{t("restore_bookmark")}</span>
            </button>
          </div>
        ) : !bookmarkId ? (
          /* 情况 3：当前网页尚未收藏 (未保存态，支持编辑标题、URL、备忘、文件夹与标签) */
          <div className="h-full flex flex-col justify-between p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs animate-in fade-in duration-150">
            <div className="space-y-3">
              {/* 头部：Favicon + 标题输入 + URL输入 + 备忘笔记 */}
              <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-start gap-2.5">
                  {currentTab?.favIconUrl ? (
                    <img
                      src={currentTab.favIconUrl}
                      alt="fav"
                      className="w-5 h-5 rounded shrink-0 mt-0.5 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none"
                      }}
                    />
                  ) : (
                    <div className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      ✦
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t("title_placeholder")}
                      className="w-full text-xs font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors bg-transparent py-0.5 leading-tight"
                    />
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={t("url_placeholder")}
                      className="w-full text-[11px] text-slate-400 hover:text-slate-600 focus:text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors bg-transparent py-0.5 truncate mt-0.5"
                      title={url}
                    />
                  </div>
                </div>

                {/* 备忘笔记 Note 文本域 */}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("note_placeholder")}
                  rows={2}
                  className="w-full p-2 text-xs bg-white border border-slate-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400 text-slate-700 placeholder:text-slate-400 resize-none transition-all"
                />
              </div>

              {/* 文件夹选择 */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  {t("collection_label")}
                </label>
                <FolderPicker
                  collections={collections}
                  selectedId={collectionId}
                  onChange={setCollectionId}
                  onCollectionCreated={(newCol) => setCollections([newCol, ...collections])}
                  t={t}
                />
              </div>

              {/* 标签 */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  {t("tags_label")}
                </label>
                <TagInput tags={tags} onChange={setTags} placeholder={t("add_tag_chip")} t={t} />
              </div>
            </div>

            {/* 错误提示横幅 */}
            {syncStatus === "error" && errorMessage && (
              <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200/80 rounded-xl text-rose-700 text-[11px] flex items-center justify-between gap-1.5 animate-in fade-in duration-150">
                <span className="truncate">⚠️ {errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="shrink-0 text-blue-600 hover:underline font-semibold"
                >
                  ⚙️
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={syncStatus === "saving"}
              onClick={handleSaveNewBookmark}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 mt-3"
            >
              <span>＋</span>
              <span>{syncStatus === "saving" ? t("saving") : t("save_to_omarker")}</span>
            </button>
          </div>
        ) : (
          /* 情况 4：正常已保存书签 (支持原地编辑标题、URL、备忘与防抖同步) */
          <>
            {/* 头部：Favicon + 原地标题输入 + 原地URL输入 */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-start gap-2.5">
                {currentTab?.favIconUrl ? (
                  <img
                    src={currentTab.favIconUrl}
                    alt="fav"
                    className="w-5 h-5 rounded shrink-0 mt-0.5 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none"
                    }}
                  />
                ) : (
                  <div className="w-5 h-5 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    ✦
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => syncNow(title, url, note, tags, collectionId, isFavorite)}
                    placeholder={t("title_placeholder")}
                    className="w-full text-xs font-semibold text-slate-800 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors bg-transparent py-0.5 leading-tight"
                  />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onBlur={() => syncNow(title, url, note, tags, collectionId, isFavorite)}
                    placeholder={t("url_placeholder")}
                    className="w-full text-[11px] text-slate-400 hover:text-slate-600 focus:text-slate-700 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none transition-colors bg-transparent py-0.5 truncate mt-0.5"
                    title={url}
                  />
                </div>
                {/* 实时同步状态指示 */}
                <div className="shrink-0 pt-0.5">
                  {syncStatus === "saving" && (
                    <span className="text-[10px] text-blue-500 font-mono animate-pulse">●</span>
                  )}
                  {syncStatus === "saved" && (
                    <span className="text-[10px] text-emerald-600 font-medium">✓</span>
                  )}
                </div>
              </div>

              {/* 备忘笔记 Note 文本域 */}
              <div className="relative">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => syncNow(title, url, note, tags, collectionId, isFavorite)}
                  placeholder={t("note_placeholder")}
                  rows={2}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400 text-slate-700 placeholder:text-slate-400 resize-none transition-all"
                />
              </div>
            </div>

            {/* 文件夹抽屉 Folder Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {t("collection_label")}
              </label>
              <FolderPicker
                collections={collections}
                selectedId={collectionId}
                onChange={setCollectionId}
                onCollectionCreated={(newCol) => setCollections([newCol, ...collections])}
                t={t}
              />
            </div>

            {/* 标签胶囊 Tag Chips */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {t("tags_label")}
              </label>
              <TagInput tags={tags} onChange={setTags} placeholder={t("add_tag_chip")} t={t} />
            </div>

            {/* 时间元信息条 (参考 Raindrop.io：固定双行规整堆叠排版，杜绝不同语言长度导致的跳行) */}
            {(createdAt || lastVisitedAt) && (
              <div className="pt-2 pb-0.5 border-t border-slate-100/80 flex flex-col gap-1 text-[11px] text-slate-400 select-none animate-in fade-in duration-150">
                {createdAt && (
                  <div className="flex items-center gap-1.5 min-w-0" title={`${t("saved_at_prefix")}: ${formatDateTime(createdAt, locale)}`}>
                    <span className="shrink-0 text-[10px]">🕒</span>
                    <span className="truncate">{t("saved_at_prefix")} {formatDateTime(createdAt, locale)}</span>
                  </div>
                )}
                {lastVisitedAt && (
                  <div className="flex items-center gap-1.5 min-w-0" title={`${t("last_visited_prefix")}: ${formatDateTime(lastVisitedAt, locale)}`}>
                    <span className="shrink-0 text-[10px]">👁️</span>
                    <span className="truncate">{t("last_visited_prefix")} {formatDateTime(lastVisitedAt, locale)}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部极简动作栏 (自适应弹性排版，防止长文案折行变形) */}
      <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2 text-xs shrink-0 overflow-hidden">
        <button
          type="button"
          onClick={handleSaveWindowTabs}
          disabled={sessionSaving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all whitespace-nowrap shrink-0 max-w-[230px] ${
            sessionSuccess
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          }`}
          title={t("save_window_tabs")}
        >
          <span>📦</span>
          <span className="truncate">
            {sessionSuccess ? t("packed_btn") : t("save_window_tabs")}
          </span>
        </button>

        {/* 若当前已经是控制台页面，隐藏右侧重复的“打开控制台”；否则展示紧凑链接 */}
        {internalPageType !== "dashboard" && (
          <button
            type="button"
            onClick={handleOpenDashboard}
            className="flex items-center gap-1 text-slate-400 hover:text-blue-600 font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <span>{t("dashboard_short")}</span>
            <span className="text-xs">↗</span>
          </button>
        )}
      </div>
        </>
      )}
    </div>
  )
}
