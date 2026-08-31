/**
 * 解说实验室 API（H5 走 Vite /v2 代理）。
 */

import { apiAbsoluteUrl } from "@/config/api-origin";

export function commentaryLabCasesUrl(): string {
  return apiAbsoluteUrl("/v2/CommentaryLab/cases");
}

export function commentaryLabCaseUrl(id: string): string {
  return apiAbsoluteUrl(`/v2/CommentaryLab/cases/${encodeURIComponent(id)}`);
}

export function commentaryLabPromptsUrl(id: string): string {
  return apiAbsoluteUrl(`/v2/CommentaryLab/cases/${encodeURIComponent(id)}/prompts`);
}

export function commentaryLabResetPromptsUrl(id: string): string {
  return apiAbsoluteUrl(
    `/v2/CommentaryLab/cases/${encodeURIComponent(id)}/prompts/reset`,
  );
}

export function commentaryLabRefreshFactUrl(id: string): string {
  return apiAbsoluteUrl(
    `/v2/CommentaryLab/cases/${encodeURIComponent(id)}/prompts/refresh-fact`,
  );
}

export function commentaryLabRunUrl(id: string): string {
  return apiAbsoluteUrl(`/v2/CommentaryLab/cases/${encodeURIComponent(id)}/run`);
}

export function commentaryLabWayUrl(id: string): string {
  return apiAbsoluteUrl(`/v2/CommentaryLab/cases/${encodeURIComponent(id)}/way`);
}

export function commentaryLabPromptTemplateUrl(): string {
  return apiAbsoluteUrl("/v2/CommentaryLab/prompt-template");
}

export function commentaryLabModelsUrl(): string {
  return apiAbsoluteUrl("/v2/CommentaryLab/models");
}

export function commentaryLabWaysUrl(): string {
  return apiAbsoluteUrl("/v2/CommentaryLab/generation-ways");
}

export function commentaryLabTtsVoicesUrl(): string {
  return apiAbsoluteUrl("/v2/CommentaryLab/tts/voices");
}

export function commentaryLabTtsUrl(): string {
  return apiAbsoluteUrl("/v2/CommentaryLab/tts");
}
