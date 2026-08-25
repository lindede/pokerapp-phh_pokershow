/**
 * 复盘分析 / 粘贴 PHH 接口。
 * 开发时 Vite 将 `/v2` 代理到 9000；生产请求 api.pokershow.top。
 */

import { apiAbsoluteUrl } from "@/config/api-origin";

const REVIEW_ANALYZE_PATH = "/v2/Review/analyze";
const REVIEW_PARSE_PHH_PATH = "/v2/Review/parse_phh";
/** 多决策点 + 总结常需 4～5 分钟，须大于服务端 LLM 总耗时 */
export const REVIEW_ANALYZE_TIMEOUT_MS = 360_000;

export function getReviewAnalyzeApiUrl(): string {
  return apiAbsoluteUrl(REVIEW_ANALYZE_PATH);
}

export function getReviewParsePhhApiUrl(): string {
  return apiAbsoluteUrl(REVIEW_PARSE_PHH_PATH);
}

export function getReviewArtifactApiUrl(artifactId: string): string {
  const id = encodeURIComponent(artifactId.trim());
  return apiAbsoluteUrl(`/v2/Review/artifacts/${id}`);
}

/** 兼容常量读取；实际请求请优先用 getReviewAnalyzeApiUrl() */
export const REVIEW_ANALYZE_API_URL: string = getReviewAnalyzeApiUrl();
