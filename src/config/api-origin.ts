/**
 * API 根地址。
 * - 开发：同源（Vite 代理 /v1 /v2 /v3 → 9000）
 * - 生产 H5 / 小程序：`VITE_API_ORIGIN` 或默认 https://api.pokershow.top
 */

const DEFAULT_API_ORIGIN = "https://api.pokershow.top";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** 不含路径的 API 根，如 https://api.pokershow.top */
export function getApiOrigin(): string {
  const envOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();
  if (envOrigin) return trimSlash(envOrigin);

  if (import.meta.env.DEV) {
    if (typeof location !== "undefined" && location.origin) {
      return trimSlash(location.origin);
    }
  }

  return trimSlash(DEFAULT_API_ORIGIN);
}

/** 拼绝对 API URL，path 须以 / 开头 */
export function apiAbsoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiOrigin()}${p}`;
}
