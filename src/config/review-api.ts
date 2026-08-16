/**
 * 复盘分析 / 粘贴 PHH 接口。
 * H5 用 `location.origin` 拼绝对 URL，避免部署在子目录时路径被当成相对路径；
 * 开发时 Vite 将 `/v2` 代理到 9000。
 */

const REVIEW_ANALYZE_PATH = "/v2/Review/analyze";
const REVIEW_PARSE_PHH_PATH = "/v2/Review/parse_phh";
const REMOTE_ORIGIN = "https://www.pokershow.top";

function reviewAbsoluteUrl(path: string): string {
  if (typeof location !== "undefined" && location.origin) {
    return `${location.origin}${path}`;
  }
  return `${REMOTE_ORIGIN}${path}`;
}

export function getReviewAnalyzeApiUrl(): string {
  return reviewAbsoluteUrl(REVIEW_ANALYZE_PATH);
}

export function getReviewParsePhhApiUrl(): string {
  return reviewAbsoluteUrl(REVIEW_PARSE_PHH_PATH);
}

/** 兼容常量读取；实际请求请优先用 getReviewAnalyzeApiUrl() */
export const REVIEW_ANALYZE_API_URL: string = getReviewAnalyzeApiUrl();
