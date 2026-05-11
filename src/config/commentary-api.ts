/**
 * 解说接口路径（不含 query）。洗牌请求：
 * `{COMMENTARY_API_URL}?k=&i=`
 *
 * 完整示例：
 * http://127.0.0.1:9000/v1/commentary2?k=v1_NLH_BB100_NoAnte_SixMax_part000001&i=2
 *
 * - **H5 开发**（`npm run dev`）：使用 `/v1/commentary2`，由 Vite 代理到 127.0.0.1:9000，避免 CORS。
 * - **发行 / 小程序**：使用下方完整 URL（本机服务需可访问；小程序需配合法域名或真机调试用内网穿透）。
 */
const REMOTE_COMMENTARY_BASE = "http://127.0.0.1:9000/v1/commentary2";

export const COMMENTARY_API_URL: string =
  typeof import.meta !== "undefined" && import.meta.env?.DEV
    ? "/v1/commentary2"
    : REMOTE_COMMENTARY_BASE;

/** 开发用：数据集 k */
export const DEV_COMMENTARY_DATASET_KEY =
  "v1_NLH_BB100_NoAnte_SixMax_part000001";

/** 开发用：手牌编号 i */
export const DEV_COMMENTARY_HAND_INDEX = "2";
