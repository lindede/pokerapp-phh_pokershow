/**
 * 平台 API（用户 / 登录 / 信用）
 */

import { apiAbsoluteUrl } from "@/config/api-origin";

const AUTH_BASE_PATH = "/v3";

export function getWxMiniLoginUrl(): string {
  return apiAbsoluteUrl(`${AUTH_BASE_PATH}/auth/wx-mini/login`);
}

export function getUserMeUrl(): string {
  return apiAbsoluteUrl(`${AUTH_BASE_PATH}/user/me`);
}

export function getCreditsBalanceUrl(): string {
  return apiAbsoluteUrl(`${AUTH_BASE_PATH}/credits/balance`);
}

export function getWebTicketUrl(): string {
  return apiAbsoluteUrl(`${AUTH_BASE_PATH}/auth/web/ticket`);
}

export function getWebPollUrl(ticket: string): string {
  const q = encodeURIComponent(ticket);
  return apiAbsoluteUrl(`${AUTH_BASE_PATH}/auth/web/poll?ticket=${q}`);
}

export function getWebConfirmUrl(): string {
  return apiAbsoluteUrl(`${AUTH_BASE_PATH}/auth/web/confirm`);
}

export function getCreditsRedeemUrl(): string {
  return apiAbsoluteUrl(`${AUTH_BASE_PATH}/credits/redeem`);
}

export const AUTH_TOKEN_STORAGE_KEY = "platform_access_token";

export interface PlatformUser {
  id: number;
  public_id: number;
  display_id: string;
  nickname: string;
  avatar_url: string;
  credit_balance: number;
  effective_balance?: number;
  credits_expire_at?: string | null;
  is_beta_tester?: boolean;
  status: string;
}

export interface AuthLoginResponse {
  access_token: string;
  expires_at: string;
  user: PlatformUser;
}
