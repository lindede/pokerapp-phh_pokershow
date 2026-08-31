/**
 * API 根地址。
 * - H5 开发：强制同源（Vite 代理 /v1 /v2 /v3 → 9000）
 * - 小程序：读 `project.config.json` 的 `apiOrigin`（构建时注入为 VITE_API_ORIGIN）
 * - 生产默认：https://api.pokershow.top
 */

const DEFAULT_API_ORIGIN = "https://api.pokershow.top";

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isH5DevSameOrigin(): boolean {
  if (!import.meta.env.DEV) return false;
  const platform = String(import.meta.env.UNI_PLATFORM || "");
  if (platform && platform !== "h5") return false;
  return typeof location !== "undefined" && Boolean(location.origin);
}

/** 不含路径的 API 根，如 https://api.pokershow.top */
export function getApiOrigin(): string {
  if (isH5DevSameOrigin()) {
    return trimSlash(location.origin);
  }

  const envOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();
  if (envOrigin) return trimSlash(envOrigin);

  if (import.meta.env.DEV && typeof location !== "undefined" && location.origin) {
    return trimSlash(location.origin);
  }

  return trimSlash(DEFAULT_API_ORIGIN);
}

/** 拼绝对 API URL，path 须以 / 开头 */
export function apiAbsoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiOrigin()}${p}`;
}
