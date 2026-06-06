/**
 * 解说接口路径（不含 query）。请求示例：
 * `{COMMENTARY_API_URL}?k=all&i=2`
 *
 * - **H5 开发**（`npm run dev`）：使用 `/v1/commentary2`，由 Vite 代理到 127.0.0.1:9000，避免 CORS。
 * - **发行 / 小程序**：使用下方完整 URL（本机服务需可访问；小程序需配合法域名或真机调试用内网穿透）。
 */
const REMOTE_COMMENTARY_BASE = "http://127.0.0.1:9000/v1/commentary2";

export const COMMENTARY_API_URL: string =
  typeof import.meta !== "undefined" && import.meta.env?.DEV
    ? "/v1/commentary2"
    : REMOTE_COMMENTARY_BASE;

/** 开发用：列表名称 k（目前仅 all） */
export const DEV_COMMENTARY_DATASET_KEY = "all";

/** 开发用：手牌编号 i；-1 表示随机/当前局 */
export const DEV_COMMENTARY_HAND_INDEX = "-1";
