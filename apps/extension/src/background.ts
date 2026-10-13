import iconActive16 from "url:~assets/icon-active-16.png"
import iconActive32 from "url:~assets/icon-active-32.png"
import iconActive48 from "url:~assets/icon-active-48.png"
import iconDefault16 from "url:~assets/icon-default-16.png"
import iconDefault32 from "url:~assets/icon-default-32.png"
import iconDefault48 from "url:~assets/icon-default-48.png"

import { DEFAULT_SERVER_URL, getServerUrl } from "./api"

/**
 * 动态切换特定标签页的工具栏图标与微标状态
 */
export async function updateTabIcon(tabId: number, isSaved: boolean) {
  try {
    if (isSaved) {
      await chrome.action.setIcon({
        tabId,
        path: {
          16: iconActive16,
          32: iconActive32,
          48: iconActive48
        }
      })
      await chrome.action.setBadgeBackgroundColor({ tabId, color: "#2563eb" })
      await chrome.action.setBadgeText({ tabId, text: "✓" })
    } else {
      await chrome.action.setIcon({
        tabId,
        path: {
          16: iconDefault16,
          32: iconDefault32,
          48: iconDefault48
        }
      })
      await chrome.action.setBadgeText({ tabId, text: "" })
    }
  } catch (err) {
    // 某些内部标签页可能无法设置图标，静默忽略
  }
}

/**
 * 探测某个 URL 是否已保存于服务端
 */
async function checkUrlSaved(targetUrl: string): Promise<boolean> {
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) return false

  // 排除浏览器内部与本地服务
  if (
    targetUrl.startsWith("chrome://") ||
    targetUrl.startsWith("edge://") ||
    targetUrl.startsWith("about:") ||
    targetUrl.includes("localhost:7364")
  ) {
    return false
  }

  try {
    const serverUrl = await getServerUrl()
    const checkRes = await fetch(`${serverUrl}/api/bookmarks?url=${encodeURIComponent(targetUrl)}`)
    const checkData = await checkRes.json()
    if (checkData?.success && checkData?.data && checkData.data.status !== "TRASH") {
      return true
    }
  } catch (err) {
    // 服务端离线或网络异常时不改变状态
  }
  return false
}

// 1. 监听切换标签页事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab && tab.url) {
      const isSaved = await checkUrlSaved(tab.url)
      await updateTabIcon(activeInfo.tabId, isSaved)
    }
  } catch (err) {
    // 忽略标签已关闭的异常
  }
})

// 2. 监听标签页更新/导航完成事件
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const isSaved = await checkUrlSaved(tab.url)
    await updateTabIcon(tabId, isSaved)
  }
})

// 3. 监听来自 Popup 的即时状态更新通知
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SET_TAB_BOOKMARK_STATUS" && typeof message.tabId === "number") {
    updateTabIcon(message.tabId, !!message.isSaved)
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }))
    return true // 保持异步回调通道
  }
})

// 4. 初始化检测当前窗口激活的标签页
const initActiveTabStatus = async () => {
  try {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      if (tabs && tabs[0] && tabs[0].id && tabs[0].url) {
        const isSaved = await checkUrlSaved(tabs[0].url)
        await updateTabIcon(tabs[0].id, isSaved)
      }
    })
  } catch (err) {
    // 静默忽略
  }
}

chrome.runtime.onInstalled.addListener(initActiveTabStatus)
chrome.runtime.onStartup?.addListener(initActiveTabStatus)
initActiveTabStatus()
