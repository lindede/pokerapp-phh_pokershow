/**
 * 管理端 API（H5 only，请求 api 子域 /v3/admin）
 */

import { getApiOrigin } from "@/config/api-origin";

const ADMIN_TOKEN_KEY = "platform_admin_token";

function baseUrl(): string {
  return getApiOrigin();
}

export function getAdminToken(): string {
  try {
    return uni.getStorageSync(ADMIN_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAdminToken(token: string) {
  uni.setStorageSync(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  try {
    uni.removeStorageSync(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export type AdminTokenCheck = {
  ok: boolean;
  status: number;
  detail: string;
};

/** 用候选 Token 打一次需鉴权接口，不写入本地、不弹 toast。 */
export async function verifyAdminToken(token: string): Promise<AdminTokenCheck> {
  const trimmed = token.trim();
  if (!trimmed) {
    return { ok: false, status: 0, detail: "请填写 Admin Token" };
  }
  try {
    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: `${baseUrl()}/v3/admin/config`,
        method: "GET",
        header: { "X-Admin-Token": trimmed },
        timeout: 15000,
        success: resolve,
        fail: reject,
      });
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return { ok: true, status: res.statusCode, detail: "" };
    }
    const detail =
      res.statusCode === 403
        ? "Token 不正确"
        : res.statusCode === 503
          ? "服务器未配置管理员口令"
          : res.data && typeof res.data === "object" && "detail" in res.data
            ? String((res.data as { detail?: string }).detail)
            : `HTTP ${res.statusCode}`;
    return { ok: false, status: res.statusCode, detail };
  } catch {
    return { ok: false, status: 0, detail: "无法连接 API" };
  }
}

let onUnauthorized: (() => void) | null = null;

export function setAdminUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export interface ContentItem {
  id: number;
  kind: string;
  external_key: string;
  artifact_path: string;
  status: string;
  meta: Record<string, unknown>;
}

export interface JobItem {
  id: number;
  job_type: string;
  status: string;
  progress: number;
  progress_total: number;
  error_message?: string;
  result?: Record<string, unknown>;
}

export interface CommentaryModelItem {
  id: string;
  label: string;
  kind: string;
}

export interface CommentaryModelList {
  default: string;
  models: CommentaryModelItem[];
}

export interface CategoryPricingItem {
  category_code: string;
  display_name: string;
  access_threshold: number;
  is_experience: boolean;
  in_catalog: boolean;
  hand_count: number;
  taxonomy_id?: string;
  parent?: string;
  position?: string;
  starting_hand?: string;
}

export interface CatalogTaxonomyItem {
  id: string;
  kind: string;
  label: string;
  member_grain?: string;
  roles?: string[];
  index?: string;
  buckets_path?: string;
  parent_taxonomy?: string | null;
  dimensions?: string[];
  positions?: string[] | null;
  starting_hands?: number | null;
}

export interface CatalogMeta {
  schema: string;
  description?: string;
  primary_taxonomy: string;
  spots?: string | null;
  taxonomies: CatalogTaxonomyItem[];
}

export interface AdminSpotItem {
  code: string;
  display_name: string;
  parent: string;
  position: string;
  starting_hand: string;
  hand_count: number;
}

export interface AdminSpotList {
  positions: string[];
  starting_hands: number;
  spot_rows: number;
  bucket_count: number;
  buckets: AdminSpotItem[];
}

export interface AdminSpotHand {
  phhs_key: string;
  i: number;
  hero_seat: number;
}

export interface AdminSpotDetail {
  code: string;
  display_name: string;
  parent: string;
  position: string;
  starting_hand: string;
  hand_count: number;
  offset: number;
  limit: number;
  hands: AdminSpotHand[];
}

export interface AdminConfig {
  credit_new_user_grant: number;
  credit_review_analyze_cost: number;
}

export interface AdminUser {
  id: number;
  public_id: number;
  display_id: string;
  nickname: string;
  credit_balance: number;
  effective_balance: number;
  credits_expire_at?: string | null;
  is_beta_tester: boolean;
  status: string;
}

export async function adminFetch<T>(
  path: string,
  opts?: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; data?: unknown },
): Promise<T> {
  const token = getAdminToken();
  if (!token) {
    uni.showToast({ title: "请先填写 Admin Token", icon: "none" });
    throw new Error("no admin token");
  }
  const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
    uni.request({
      url: `${baseUrl()}${path}`,
      method: opts?.method || "GET",
      data: opts?.data,
      header: {
        "Content-Type": "application/json",
        "X-Admin-Token": token,
      },
      timeout: 60000,
      success: resolve,
      fail: reject,
    });
  });
  if (res.statusCode >= 200 && res.statusCode < 300) {
    return res.data as T;
  }
  if (res.statusCode === 403) {
    onUnauthorized?.();
  }
  const detail =
    res.statusCode === 403
      ? "Token 已失效，请重新登录"
      : res.data && typeof res.data === "object" && "detail" in res.data
        ? String((res.data as { detail?: string }).detail)
        : `HTTP ${res.statusCode}`;
  uni.showToast({ title: detail.slice(0, 40), icon: "none" });
  throw new Error(detail);
}
