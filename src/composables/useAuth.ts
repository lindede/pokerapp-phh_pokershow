import { ref, computed } from "vue";
import {
  AUTH_TOKEN_STORAGE_KEY,
  getCreditsBalanceUrl,
  getUserMeUrl,
  getWxMiniLoginUrl,
  getWebConfirmUrl,
  getWebPollUrl,
  getWebTicketUrl,
  getCreditsRedeemUrl,
  type AuthLoginResponse,
  type PlatformUser,
} from "@/config/auth-api";

const token = ref<string>(loadToken());
const user = ref<PlatformUser | null>(null);
const loading = ref(false);

function loadToken(): string {
  try {
    return uni.getStorageSync(AUTH_TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveToken(value: string) {
  token.value = value;
  if (value) {
    uni.setStorageSync(AUTH_TOKEN_STORAGE_KEY, value);
  } else {
    uni.removeStorageSync(AUTH_TOKEN_STORAGE_KEY);
  }
}

export function authHeaders(): Record<string, string> {
  const t = token.value || loadToken();
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

export function useAuth() {
  const isLoggedIn = computed(() => Boolean(token.value));

  async function fetchProfile(): Promise<boolean> {
    if (!token.value) {
      user.value = null;
      return false;
    }
    loading.value = true;
    try {
      const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
        uni.request({
          url: getUserMeUrl(),
          method: "GET",
          header: authHeaders(),
          timeout: 15000,
          success: resolve,
          fail: reject,
        });
      });
      if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
        user.value = res.data as PlatformUser;
        return true;
      }
      if (res.statusCode === 401) {
        logout();
      }
      return false;
    } catch {
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function loginWxMini(): Promise<boolean> {
    loading.value = true;
    try {
      const code = await new Promise<string>((resolve, reject) => {
        uni.login({
          provider: "weixin",
          success: (r) => {
            if (r.code) resolve(r.code);
            else reject(new Error("no code"));
          },
          fail: reject,
        });
      });
      const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
        uni.request({
          url: getWxMiniLoginUrl(),
          method: "POST",
          header: { "Content-Type": "application/json" },
          data: { code },
          timeout: 20000,
          success: resolve,
          fail: reject,
        });
      });
      if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
        const body = res.data as AuthLoginResponse;
        saveToken(body.access_token);
        user.value = body.user;
        uni.showToast({ title: `欢迎 ${body.user.display_id}`, icon: "none" });
        return true;
      }
      const detail =
        res.data && typeof res.data === "object" && "detail" in res.data
          ? String((res.data as { detail?: string }).detail)
          : `登录失败 HTTP ${res.statusCode}`;
      uni.showToast({ title: detail.slice(0, 40), icon: "none" });
      return false;
    } catch (e) {
      uni.showToast({ title: "微信登录失败", icon: "none" });
      return false;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    saveToken("");
    user.value = null;
  }

  async function refreshBalance(): Promise<number | null> {
    if (!token.value) return null;
    try {
      const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
        uni.request({
          url: getCreditsBalanceUrl(),
          method: "GET",
          header: authHeaders(),
          timeout: 10000,
          success: resolve,
          fail: reject,
        });
      });
      if (res.statusCode >= 200 && res.statusCode < 300 && res.data && user.value) {
        const body = res.data as {
          balance?: number;
          effective_balance?: number;
          credits_expire_at?: string | null;
        };
        const bal = body.balance;
        if (typeof bal === "number") {
          user.value = {
            ...user.value,
            credit_balance: bal,
            effective_balance:
              typeof body.effective_balance === "number"
                ? body.effective_balance
                : user.value.effective_balance,
            credits_expire_at:
              body.credits_expire_at !== undefined
                ? body.credits_expire_at
                : user.value.credits_expire_at,
          };
          return bal;
        }
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /** H5：创建 Ticket 并轮询（小程序扫码确认后完成） */
  async function pollWebTicket(ticket: string, maxMs = 120_000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
        uni.request({
          url: getWebPollUrl(ticket),
          method: "GET",
          timeout: 10000,
          success: resolve,
          fail: reject,
        });
      });
      const body = res.data as { status?: string; access_token?: string };
      if (body?.status === "ok" && body.access_token) {
        saveToken(body.access_token);
        await fetchProfile();
        return true;
      }
      if (body?.status === "expired") break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }

  async function confirmWebTicketForMini(ticket: string): Promise<boolean> {
    if (!token.value) {
      uni.showToast({ title: "请先登录小程序", icon: "none" });
      return false;
    }
    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: getWebConfirmUrl(),
        method: "POST",
        header: { "Content-Type": "application/json", ...authHeaders() },
        data: { ticket },
        timeout: 15000,
        success: resolve,
        fail: reject,
      });
    });
    if (res.statusCode >= 200 && res.statusCode < 300) {
      uni.showToast({ title: "已确认电脑端登录", icon: "success" });
      return true;
    }
    uni.showToast({ title: "确认失败", icon: "none" });
    return false;
  }

  async function requestWebTicket(): Promise<{ ticket: string; qr_url: string } | null> {
    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: getWebTicketUrl(),
        method: "POST",
        timeout: 15000,
        success: resolve,
        fail: reject,
      });
    });
    if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
      const d = res.data as { ticket?: string; qr_url?: string };
      if (d.ticket && d.qr_url) return { ticket: d.ticket, qr_url: d.qr_url };
    }
    return null;
  }

  async function redeemVoucher(code: string): Promise<boolean> {
    if (!token.value) {
      uni.showToast({ title: "请先登录", icon: "none" });
      return false;
    }
    const trimmed = code.trim();
    if (!trimmed) {
      uni.showToast({ title: "请输入卡密", icon: "none" });
      return false;
    }
    loading.value = true;
    try {
      const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
        uni.request({
          url: getCreditsRedeemUrl(),
          method: "POST",
          header: { "Content-Type": "application/json", ...authHeaders() },
          data: { code: trimmed },
          timeout: 15000,
          success: resolve,
          fail: reject,
        });
      });
      if (res.statusCode >= 200 && res.statusCode < 300 && res.data) {
        const body = res.data as { credited?: number; balance?: number };
        if (user.value && typeof body.balance === "number") {
          user.value = { ...user.value, credit_balance: body.balance };
        }
        uni.showToast({
          title: `兑换成功 +${body.credited ?? "?"}`,
          icon: "success",
        });
        return true;
      }
      const detail =
        res.data && typeof res.data === "object" && "detail" in res.data
          ? String((res.data as { detail?: string }).detail)
          : `兑换失败 HTTP ${res.statusCode}`;
      uni.showToast({ title: detail.slice(0, 40), icon: "none" });
      return false;
    } catch {
      uni.showToast({ title: "兑换失败", icon: "none" });
      return false;
    } finally {
      loading.value = false;
    }
  }

  return {
    token,
    user,
    loading,
    isLoggedIn,
    loginWxMini,
    logout,
    fetchProfile,
    refreshBalance,
    pollWebTicket,
    confirmWebTicketForMini,
    requestWebTicket,
    redeemVoucher,
    authHeaders,
  };
}
