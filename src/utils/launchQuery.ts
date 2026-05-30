/** H5 主页 URL 启动参数：?k=…&i=…&m=…（hash 路由下可在 # 后） */

export interface LaunchQueryParams {
  k?: string;
  i?: string;
  m?: string;
}

function mergeSearchInto(target: URLSearchParams, search: string) {
  if (!search) return;
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return;
  const part = new URLSearchParams(raw);
  part.forEach((value, key) => target.set(key, value));
}

/** 从 location.search 与 location.hash 的 query 段读取 k / i / m */
export function parseLaunchQuery(): LaunchQueryParams {
  if (typeof window === "undefined" || !window.location) return {};

  const merged = new URLSearchParams();
  mergeSearchInto(merged, window.location.search);

  const hash = window.location.hash ?? "";
  const qInHash = hash.indexOf("?");
  if (qInHash >= 0) {
    mergeSearchInto(merged, hash.slice(qInHash));
  }

  const pick = (key: string) => {
    const v = merged.get(key);
    return v != null && v !== "" ? v : undefined;
  };

  return { k: pick("k"), i: pick("i"), m: pick("m") };
}

/** 小程序 onLoad(options) 启动参数 */
export function parseMpLaunchOptions(
  options?: Record<string, string | undefined> | null,
): LaunchQueryParams {
  if (!options) return {};
  const pick = (key: string) => {
    const v = options[key];
    return v != null && v !== "" ? String(v).trim() : undefined;
  };
  return { k: pick("k"), i: pick("i"), m: pick("m") };
}

/** 同时有 k、i 时首屏 CommentaryLite 用 URL 参数，否则默认 all / -1 */
export function hasLaunchHandParams(q: LaunchQueryParams): boolean {
  const k = q.k?.trim();
  const i = q.i?.trim();
  return Boolean(k && i !== undefined && i !== "");
}

/** m=rv：复盘嵌入 / 录屏模式，不弹介绍框 */
export function isReviewLaunchMode(q: LaunchQueryParams): boolean {
  return q.m?.trim().toLowerCase() === "rv";
}

const REVIEW_VIEWPORT_WIDTH = 540;

export function getReviewViewportWidth(): number {
  return REVIEW_VIEWPORT_WIDTH;
}

/** m=rv：固定 viewport（index.html 已抢先设置；此处再同步以防热更新） */
export function applyReviewLaunchViewport(): void {
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "viewport");
    document.head.appendChild(meta);
  }
  meta.setAttribute(
    "content",
    `width=${REVIEW_VIEWPORT_WIDTH}, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, viewport-fit=cover`,
  );
}
