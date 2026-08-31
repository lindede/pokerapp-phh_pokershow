/**
 * 解说接口路径（不含 query）。请求示例：
 * `{getCommentaryApiUrl()}?k=all&i=2`
 */

import { apiAbsoluteUrl } from "@/config/api-origin";

export function getCommentaryApiUrl(): string {
  return apiAbsoluteUrl("/v1/commentary2");
}

/** 开发用：列表名称 k（目前仅 all） */
export const DEV_COMMENTARY_DATASET_KEY = "all";

/** 开发用：手牌编号 i；-1 表示随机/当前局 */
export const DEV_COMMENTARY_HAND_INDEX = "-1";
