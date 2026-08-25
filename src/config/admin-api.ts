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
}

export async function adminFetch<T>(
  path: string,
  opts?: { method?: "GET" | "POST" | "PATCH"; data?: unknown },
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
  const detail =
    res.data && typeof res.data === "object" && "detail" in res.data
      ? String((res.data as { detail?: string }).detail)
      : `HTTP ${res.statusCode}`;
  uni.showToast({ title: detail.slice(0, 40), icon: "none" });
  throw new Error(detail);
}
