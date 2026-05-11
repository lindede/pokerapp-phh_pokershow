import type { ByActionEvent } from "@/types/commentary";

/** 每步基础停留（保证读得清动作本身） */
export const REPLAY_BASE_MS = 520;
/** 解说字段 `text` 每字额外毫秒（越长停越久） */
export const REPLAY_MS_PER_CHAR = 22;
/** 单步上限，避免极长段落拖垮整条时间线 */
export const REPLAY_MAX_STEP_MS = 9000;
/** 无解说文案时的基准时长（发牌、silent fold 等），最终仍会不低于 MIN_STEP */
export const REPLAY_MIN_SILENT_MS = 320;
/** 每一步最短停留（秒级下限） */
export const REPLAY_MIN_STEP_MS = 2000;

/**
 * 单步时长 = clamp(BASE + len(text)×MS_PER_CHAR)，无 text 时用 MIN_SILENT，
 * 最后统一不低于 {@link REPLAY_MIN_STEP_MS}。
 */
export function durationForByActionStep(e: ByActionEvent): number {
  const len = (e.text ?? "").trim().length;
  let ms: number;
  if (len === 0) {
    ms = REPLAY_MIN_SILENT_MS;
  } else {
    const raw = REPLAY_BASE_MS + len * REPLAY_MS_PER_CHAR;
    ms = Math.min(REPLAY_MAX_STEP_MS, Math.max(REPLAY_BASE_MS, raw));
  }
  return Math.max(REPLAY_MIN_STEP_MS, ms);
}

export function buildReplayCumulativeMs(timeline: ByActionEvent[]): {
  durationsMs: number[];
  cumulativeMs: number[];
  totalMs: number;
} {
  const durationsMs = timeline.map(durationForByActionStep);
  const cumulativeMs: number[] = [0];
  let acc = 0;
  for (const d of durationsMs) {
    acc += d;
    cumulativeMs.push(acc);
  }
  return { durationsMs, cumulativeMs, totalMs: acc };
}

/** cumulativeMs 长度 n+1，第 i 步占用 [cumulativeMs[i], cumulativeMs[i+1]) */
export function stepIndexFromElapsedMs(
  elapsedMs: number,
  cumulativeMs: number[],
): number {
  const n = cumulativeMs.length - 1;
  if (n <= 0) return 0;
  const total = cumulativeMs[n];
  const clamped = Math.min(Math.max(0, elapsedMs), total);
  let step = 0;
  for (let i = 0; i < n; i++) {
    if (clamped >= cumulativeMs[i + 1]) step = i + 1;
  }
  return Math.min(step, n - 1);
}
