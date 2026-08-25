/**
 * 复盘实验室 API（H5 走 Vite /v2 代理；生产走 api 子域）。
 */

import { apiAbsoluteUrl } from "@/config/api-origin";

export function labCasesUrl(): string {
  return apiAbsoluteUrl("/v2/ReviewLab/cases");
}

export function labCaseUrl(id: string): string {
  return apiAbsoluteUrl(`/v2/ReviewLab/cases/${encodeURIComponent(id)}`);
}

export function labPromptsUrl(id: string): string {
  return apiAbsoluteUrl(`/v2/ReviewLab/cases/${encodeURIComponent(id)}/prompts`);
}

export function labResetPromptsUrl(id: string): string {
  return apiAbsoluteUrl(`/v2/ReviewLab/cases/${encodeURIComponent(id)}/prompts/reset`);
}

export function labRefreshFactUrl(id: string): string {
  return apiAbsoluteUrl(
    `/v2/ReviewLab/cases/${encodeURIComponent(id)}/prompts/refresh-fact`,
  );
}

export function labRunUrl(id: string): string {
  return apiAbsoluteUrl(`/v2/ReviewLab/cases/${encodeURIComponent(id)}/run`);
}

export function labPromptTemplateUrl(): string {
  return apiAbsoluteUrl("/v2/ReviewLab/prompt-template");
}

export function labModelsUrl(): string {
  return apiAbsoluteUrl("/v2/ReviewLab/models");
}
