/**
 * 复盘实验室 API（H5 走 Vite /v2 代理）。
 */

function absUrl(path: string): string {
  if (typeof location !== "undefined" && location.origin) {
    return `${location.origin}${path}`;
  }
  return `http://127.0.0.1:9000${path}`;
}

export function labCasesUrl(): string {
  return absUrl("/v2/ReviewLab/cases");
}

export function labCaseUrl(id: string): string {
  return absUrl(`/v2/ReviewLab/cases/${encodeURIComponent(id)}`);
}

export function labPromptsUrl(id: string): string {
  return absUrl(`/v2/ReviewLab/cases/${encodeURIComponent(id)}/prompts`);
}

export function labResetPromptsUrl(id: string): string {
  return absUrl(`/v2/ReviewLab/cases/${encodeURIComponent(id)}/prompts/reset`);
}

export function labRefreshFactUrl(id: string): string {
  return absUrl(
    `/v2/ReviewLab/cases/${encodeURIComponent(id)}/prompts/refresh-fact`
  );
}

export function labRunUrl(id: string): string {
  return absUrl(`/v2/ReviewLab/cases/${encodeURIComponent(id)}/run`);
}

export function labPromptTemplateUrl(): string {
  return absUrl("/v2/ReviewLab/prompt-template");
}

export function labModelsUrl(): string {
  return absUrl("/v2/ReviewLab/models");
}
