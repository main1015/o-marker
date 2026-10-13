import { useEffect, useState } from "react"
import { getServerUrl, setServerUrl, testServerConnection, DEFAULT_SERVER_URL } from "../api"

interface SettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  t: (key: string) => string
  onSaved?: (newUrl: string) => void
}

export default function SettingsDrawer({ isOpen, onClose, t, onSaved }: SettingsDrawerProps) {
  const [urlInput, setUrlInput] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg?: string } | null>(null)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    if (isOpen) {
      getServerUrl().then((url) => {
        setUrlInput(url)
        setTestResult(null)
        setIsSaved(false)
      })
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setIsSaved(false)
    const res = await testServerConnection(urlInput)
    setTesting(false)
    setTestResult({
      ok: res.success,
      msg: res.success ? t("connection_success") : `${t("connection_failed")}${res.message ? ` (${res.message})` : ""}`
    })
  }

  const handleSave = async () => {
    const finalUrl = await setServerUrl(urlInput)
    setUrlInput(finalUrl)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
    if (onSaved) onSaved(finalUrl)
  }

  const handleResetDefault = () => {
    setUrlInput(DEFAULT_SERVER_URL)
    setTestResult(null)
    setIsSaved(false)
  }

  return (
    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col p-4 animate-in fade-in slide-in-from-right-4 duration-150">
      {/* 头部标题与返回按钮 */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-base">⚙️</span>
          <h2 className="text-sm font-bold text-slate-800">{t("settings_title")}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          title={t("close_btn")}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 设置内容区 */}
      <div className="flex-1 py-4 space-y-4 overflow-y-auto">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            {t("server_url_label")}
          </label>
          <div className="relative">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value)
                setTestResult(null)
                setIsSaved(false)
              }}
              placeholder={t("server_url_placeholder")}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-slate-50/50 font-mono text-slate-700"
            />
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            <span>{t("default_prefix")}{DEFAULT_SERVER_URL}</span>
            {urlInput !== DEFAULT_SERVER_URL && (
              <button
                type="button"
                onClick={handleResetDefault}
                className="text-blue-500 hover:underline hover:text-blue-600"
              >
                {t("reset_default")}
              </button>
            )}
          </div>
        </div>

        {/* 测试连通性状态反馈 */}
        {testResult && (
          <div
            className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
              testResult.ok
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            <span className="text-sm font-bold mt-[-1px]">{testResult.ok ? "✓" : "✕"}</span>
            <span className="leading-snug">{testResult.msg}</span>
          </div>
        )}

        {/* 提示说明 */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
          <p className="font-semibold text-slate-600">{t("server_tip_title")}</p>
          <p>{t("server_tip_1")}</p>
          <p>{t("server_tip_2")}</p>
        </div>
      </div>

      {/* 底部按钮区 */}
      <div className="pt-3 border-t border-slate-100 flex gap-2">
        <button
          type="button"
          disabled={testing}
          onClick={handleTest}
          className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {testing ? t("testing") : t("test_connection")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg text-white transition-all shadow-sm ${
            isSaved ? "bg-emerald-600" : "bg-blue-600 hover:bg-blue-700 active:scale-[0.98]"
          }`}
        >
          {isSaved ? `✓ ${t("settings_saved")}` : t("save_settings")}
        </button>
      </div>
    </div>
  )
}
