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
/** Hero 模式：发牌/摊牌/他人弃牌等快进（尽量短，约 1 帧） */
export const REPLAY_HERO_MODE_FAST_MS = 16;
/** 非 Hero 模式：发牌/弃牌默认停留（有语音时由语音步进覆盖） */
export const REPLAY_NON_HERO_DEAL_FOLD_MS = 1000;

export interface ReplayStepDurationOptions {
  heroSeatIndex?: number | null;
}

function normStreetForTiming(s: string): string {
  return (s || "").toLowerCase();
}

/** Hero 模式：发牌/摊牌/无关动作尽快跳过 */
export function isHeroModeFastStep(
  e: ByActionEvent,
  heroSeatIndex: number | null | undefined,
): boolean {
  if (heroSeatIndex == null || heroSeatIndex < 0) return false;
  const action = (e.action || "").toLowerCase().trim();
  const si = e.seat_index;

  if (action === "deal_hole" || action === "deal_board" || action === "showdown") {
    return true;
  }

  if (si != null && si !== heroSeatIndex && action === "fold") return true;

  if (
    action === "unknown" &&
    !(e.text ?? "").trim() &&
    normStreetForTiming(e.street) === "preflop" &&
    si == null
  ) {
    return true;
  }

  return false;
}

/** 非 Hero 模式（meta 无 hero_seat_index）：发牌/弃牌固定 1s，有语音时由语音步进决定 */
export function isNonHeroModeDealFoldStep(
  e: ByActionEvent,
  heroSeatIndex: number | null | undefined,
): boolean {
  if (heroSeatIndex != null && heroSeatIndex >= 0) return false;
  const action = (e.action || "").toLowerCase().trim();
  return action === "deal_hole" || action === "deal_board" || action === "fold";
}

/**
 * 单步时长 = clamp(BASE + len(text)×MS_PER_CHAR)，无 text 时用 MIN_SILENT，
 * 最后统一不低于 {@link REPLAY_MIN_STEP_MS}（Hero 快进 / 非 Hero 发牌弃牌等除外）。
 */
export function durationForByActionStep(
  e: ByActionEvent,
  opts?: ReplayStepDurationOptions,
): number {
  if (isHeroModeFastStep(e, opts?.heroSeatIndex)) {
    return REPLAY_HERO_MODE_FAST_MS;
  }
  if (isNonHeroModeDealFoldStep(e, opts?.heroSeatIndex)) {
    return REPLAY_NON_HERO_DEAL_FOLD_MS;
  }
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

export function buildReplayCumulativeMs(
  timeline: ByActionEvent[],
  opts?: ReplayStepDurationOptions,
): {
  durationsMs: number[];
  cumulativeMs: number[];
  totalMs: number;
} {
  const durationsMs = timeline.map((e) => durationForByActionStep(e, opts));
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
