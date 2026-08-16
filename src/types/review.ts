import type { ByActionEvent } from "@/types/commentary";

/** 复盘分析用的有限动作种类（录入仍用具体 chips + by_action.action） */
export type ReviewActionKind =
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all_in";

export type ReviewVerdict = "good" | "acceptable" | "suboptimal" | "bad";

export type ReviewPhase = "entry" | "reviewing";

/** 离散选项 / 实际 / 推荐；label 优先信后端（含 nnn(2/3底池)） */
export interface ReviewActionChoice {
  kind: ReviewActionKind;
  /** 具体筹码；fold/check 可省略 */
  chips?: number;
  /** 展示文案，如 `450(2/3底池)` 或 `80` */
  label: string;
}

export interface HeroDecisionReview {
  event_index: number;
  /** decision=单点点评；summary=摊牌后整手总结 */
  kind?: "decision" | "summary";
  actual: ReviewActionChoice;
  /** 该决策点可选的有限集合；总结条目可为空 */
  options: ReviewActionChoice[];
  recommend: ReviewActionChoice;
  verdict: ReviewVerdict;
  /** 中文理由 */
  reasons: string[];
  /** 总结专用：摊牌输赢 */
  outcome?: "hero_won" | "hero_lost" | "chop" | "unknown";
  outcome_zh?: string;
  /** 总结专用：对手亮牌文案 */
  opponent_shown?: string;
}

export interface ReviewAnalyzeRequest {
  hero_seat_index: number;
  starting_stacks: number[];
  blinds_or_straddles?: number[];
  /** 与现网同结构；chips 为具体筹码 */
  by_action: ByActionEvent[];
}

export interface ReviewAnalyzeResponse {
  reviews: HeroDecisionReview[];
  /** 落盘 PHH / 复盘产物 id，可供解说复用 */
  artifact_id?: string;
  warnings?: string[];
}

/** 粘贴 PHH 解析结果（与 Analyze 请求体同形 + warnings） */
export interface ReviewParsePhhResponse {
  hero_seat_index: number;
  starting_stacks: number[];
  blinds_or_straddles?: number[];
  by_action: ByActionEvent[];
  warnings?: string[];
}

/** 录入态草稿（完整或前缀时间线） */
export interface ReviewHandDraft {
  heroSeatIndex: number;
  startingStacks: number[];
  blindsOrStraddles: number[];
  byAction: ByActionEvent[];
}

/** 视为 Hero「决策点」的动作（用于 canStartReview / 步进） */
export const HERO_DECISION_ACTION_KEYS = [
  "fold",
  "check",
  "call",
  "bet",
  "raise",
  "all_in",
  "allin",
] as const;
