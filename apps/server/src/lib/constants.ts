/**
 * o-marker 系统全局核心配置常量
 * 单一真实来源 (Single Source of Truth, SSOT)
 */

/** 书签瀑布流分批加载默认条数 */
export const DEFAULT_PAGE_SIZE = 20;

/** 单次分页拉取的最大安全条数限制 */
export const MAX_PAGE_SIZE = 100;

/** MVP 阶段通用用户标识 (待统一登录鉴权接入前全局复用) */
export const MOCK_USER_ID = "mock-user-id";

/** 默认服务监听端口与本地服务地址 */
export const DEFAULT_SERVER_PORT = 7364;
export const DEFAULT_SERVER_URL = `http://localhost:${DEFAULT_SERVER_PORT}`;
