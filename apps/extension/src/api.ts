export const DEFAULT_SERVER_URL = "http://localhost:7364";
const STORAGE_KEY = "omarker_server_url";

let cachedServerUrl: string | null = null;

/**
 * 获取当前配置的服务端基础地址
 */
export async function getServerUrl(): Promise<string> {
  if (cachedServerUrl) return cachedServerUrl;

  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      const res = await chrome.storage.local.get([STORAGE_KEY]);
      if (res && res[STORAGE_KEY]) {
        cachedServerUrl = (res[STORAGE_KEY] as string).trim().replace(/\/+$/, "");
        return cachedServerUrl;
      }
    } else if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        cachedServerUrl = saved.trim().replace(/\/+$/, "");
        return cachedServerUrl;
      }
    }
  } catch (e) {
    console.warn("Failed to get server url from storage:", e);
  }

  cachedServerUrl = DEFAULT_SERVER_URL;
  return cachedServerUrl;
}

/**
 * 更新并持久化服务端基础地址
 */
export async function setServerUrl(url: string): Promise<string> {
  const cleanUrl = url.trim().replace(/\/+$/, "") || DEFAULT_SERVER_URL;
  cachedServerUrl = cleanUrl;

  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: cleanUrl });
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, cleanUrl);
    }
  } catch (e) {
    console.error("Failed to persist server url:", e);
  }

  return cleanUrl;
}

/**
 * 连通性测试
 */
export async function testServerConnection(url: string): Promise<{ success: boolean; message?: string }> {
  const target = (url.trim().replace(/\/+$/, "") || DEFAULT_SERVER_URL) + "/api/collections";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(target, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success !== undefined) {
        return { success: true };
      }
      return { success: true };
    }
    return { success: false, message: `HTTP ${res.status} ${res.statusText}` };
  } catch (err: any) {
    return { 
      success: false, 
      message: err.name === "AbortError" ? "连接超时 (Timeout)" : (err.message || "Network Error") 
    };
  }
}

/**
 * 封装的 API 发起函数，自动附加已配置的 base URL
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = await getServerUrl();
  const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanPath}`;
  return fetch(fullUrl, options);
}
