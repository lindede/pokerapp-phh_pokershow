import type {
  ByActionEvent,
  CommentaryReplayMeta,
  ReplayActionTrailItem,
  Street,
} from "@/types/commentary";
import { unicodeCardsToCodes } from "@/utils/unicodeCards";

const ACTION_ZH: Record<string, string> = {
  deal_hole: "发底牌",
  deal_board: "发公共牌",
  raise: "加注",
  fold: "弃牌",
  call: "跟注",
  check: "过牌",
  bet: "下注",
  post: "下盲注",
  straddle: "抓头",
  sb: "下盲注",
  bb: "下盲注",
  small_blind: "下盲注",
  big_blind: "下盲注",
  ante: "前注",
};

function isBlindPostAction(action: string): boolean {
  const a = (action || "").toLowerCase();
  return (
    a === "post" ||
    a === "straddle" ||
    a === "sb" ||
    a === "bb" ||
    a === "small_blind" ||
    a === "big_blind" ||
    a === "ante"
  );
}

/** raise / bet / 3bet / 4bet …（CommentaryLite 翻前再加注用 Nbet 动作名） */
function isWagerAction(action: string): boolean {
  const a = (action || "").toLowerCase();
  if (a === "raise" || a === "bet") return true;
  return /^\d+bet$/.test(a);
}

function actionLabelZh(action: string): string {
  const a = (action || "").toLowerCase();
  if (ACTION_ZH[a]) return ACTION_ZH[a];
  const m = /^(\d+)bet$/.exec(a);
  if (m) return `${m[1]}bet`;
  return action ? String(action) : "";
}

function normStreet(s: string): Street {
  const x = (s || "").toLowerCase();
  if (x === "flop" || x === "turn" || x === "river" || x === "preflop") {
    return x as Street;
  }
  return "preflop";
}

function initStreetFromBlinds(
  streetBets: number[],
  handBets: number[],
  blinds: number[] | undefined,
  seatCount: number,
): { pot: number; maxFacing: number } {
  let pot = 0;
  let maxFacing = 0;
  streetBets.fill(0);
  handBets.fill(0);
  if (!blinds?.length) return { pot: 0, maxFacing: 0 };
  for (let i = 0; i < seatCount; i++) {
    const b =
      i < blinds.length ? Math.max(0, Number(blinds[i]) || 0) : 0;
    streetBets[i] = b;
    handBets[i] = b;
    pot += b;
    maxFacing = Math.max(maxFacing, b);
  }
  return { pot, maxFacing };
}

/**
 * 从整条时间线里「街道为 preflop」的 post/straddle 等事件提取各座位盲注（不按顺序提前截断，避免 post 排在 call/raise 之后时漏采）。
 */
function extractPreflopBlindsFromTimeline(
  timeline: ByActionEvent[],
  seatCount: number,
): number[] {
  const blinds = Array.from({ length: seatCount }, () => 0);
  for (const e of timeline) {
    if (normStreet(e.street) !== "preflop") continue;
    const act = (e.action || "").toLowerCase();
    if (act === "deal_board") continue;
    if (!isBlindPostAction(act)) continue;
    const si = e.seat_index;
    const ch =
      e.chips != null && Number.isFinite(Number(e.chips))
        ? Number(e.chips)
        : null;
    if (
      si != null &&
      si >= 0 &&
      si < seatCount &&
      ch != null &&
      ch > blinds[si]
    ) {
      blinds[si] = ch;
    }
  }
  return blinds;
}

/** meta 盲注与 time line post 按座位取较大值合并，避免只展示盲注数组却未写入 replayMeta 时漏算 */
function mergeBlindsForInit(
  meta: number[] | undefined,
  fromPosts: number[],
  seatCount: number,
): number[] {
  return Array.from({ length: seatCount }, (_, i) => {
    const mv =
      meta != null && i < meta.length ? Math.max(0, Number(meta[i]) || 0) : 0;
    const pv =
      i < fromPosts.length ? Math.max(0, Number(fromPosts[i]) || 0) : 0;
    return Math.max(mv, pv);
  });
}

/** chips = 该座位在本投注街结束此 action 后的总投入（raise-to / call 至 facing） */
function applyChipsAction(
  e: ByActionEvent,
  streetBets: number[],
  handBets: number[],
  potRef: { v: number },
  maxFacingRef: { v: number },
  seatCount: number,
): void {
  const si = e.seat_index;
  if (si == null || si < 0 || si >= seatCount) return;

  const action = (e.action || "").toLowerCase();
  const chipsRaw = e.chips;
  const chips =
    chipsRaw != null && Number.isFinite(Number(chipsRaw))
      ? Number(chipsRaw)
      : null;

  const addToPot = (delta: number, streetTotal: number) => {
    if (delta <= 0) return;
    potRef.v += delta;
    handBets[si] += delta;
    streetBets[si] = streetTotal;
  };

  if (isWagerAction(action)) {
    if (chips != null) {
      const delta = chips - streetBets[si];
      if (delta > 0) {
        addToPot(delta, chips);
        maxFacingRef.v = Math.max(maxFacingRef.v, chips);
      }
    }
    return;
  }

  if (action === "call") {
    if (chips != null) {
      const street = streetBets[si];
      const mf = maxFacingRef.v;
      const sumInc = street + chips;
      /** 与本面对齐：chips 为本轮「追加」筹码（street + chips === facing） */
      const looksLikeIncrement =
        mf > 0 &&
        Math.round(sumInc) === Math.round(mf) &&
        chips > 0 &&
        chips <= mf + 1e-6;
      if (looksLikeIncrement) {
        if (chips > 0) {
          potRef.v += chips;
          handBets[si] += chips;
          streetBets[si] = mf;
        }
      } else {
        const delta = chips - street;
        if (delta >= 0) {
          addToPot(delta, chips);
          maxFacingRef.v = Math.max(maxFacingRef.v, chips);
        }
      }
    } else {
      const delta = maxFacingRef.v - streetBets[si];
      if (delta > 0) {
        addToPot(delta, maxFacingRef.v);
      }
    }
    return;
  }

  if (isBlindPostAction(action)) {
    if (chips != null) {
      const delta = chips - streetBets[si];
      if (delta > 0) {
        addToPot(delta, chips);
        maxFacingRef.v = Math.max(maxFacingRef.v, chips);
      }
    }
  }
}

/** 盲注倍数显示上限；超过则改用相对底池比例 */
const BLIND_MULT_DISPLAY_MAX = 99;

function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * 从各座位已下盲注/straddle 推断大盲单位（升序后取第二小；仅一档则取该档）。
 */
function inferBigBlindUnit(blinds: number[] | undefined): number {
  if (!blinds?.length) return 0;
  const uniq = [
    ...new Set(
      blinds
        .map((x) => Math.max(0, Math.round(Number(x) || 0)))
        .filter((x) => x > 0),
    ),
  ].sort((a, b) => a - b);
  if (uniq.length === 0) return 0;
  if (uniq.length === 1) return uniq[0];
  return uniq[1];
}

function formatBMultiple(mult: number): string {
  const ir = Math.round(mult);
  if (Math.abs(mult - ir) < 1e-4) return `${ir}B`;
  const t = Math.round(mult * 10) / 10;
  return `${t}B`;
}

/** chips 相对当前底池的既约分数 a/b，后缀 P */
function formatPotPortion(chips: number, pot: number): string | null {
  if (pot <= 0 || chips <= 0) return null;
  const g = gcdInt(chips, pot);
  const a = Math.round(chips / g);
  const b = Math.round(pot / g);
  if (a <= 0 || b <= 0) return null;
  return `${a}/${b}P`;
}

/**
 * 动作筹码展示：优先盲注倍数 xxB / x.xB；倍数过大或无盲注参照时改为底池比例 a/bP；再退回绝对数值。
 */
function formatActionChipsLine(
  chipsRaw: unknown,
  potAfter: number,
  bbUnit: number,
): string | undefined {
  if (chipsRaw == null) return undefined;
  const chips = Number(chipsRaw);
  if (!Number.isFinite(chips) || chips <= 0) return undefined;

  if (bbUnit > 0) {
    const mult = chips / bbUnit;
    if (mult > 0 && mult <= BLIND_MULT_DISPLAY_MAX) {
      return formatBMultiple(mult);
    }
  }

  const potLine = formatPotPortion(chips, potAfter);
  if (potLine != null) return potLine;

  return String(Math.round(chips));
}

/** 截至当前步，各座位动作标签时间序累加（deal_board / deal_hole 不入列） */
function recordPlayerActionTrail(
  e: ByActionEvent,
  trails: ReplayActionTrailItem[][],
  seatCount: number,
  potAfter: number,
  bbUnit: number,
): void {
  const action = (e.action || "").toLowerCase();
  if (action === "deal_board" || action === "deal_hole") return;

  const si = e.seat_index;
  if (si == null || si < 0 || si >= seatCount) return;

  const chipsLine = formatActionChipsLine(e.chips, potAfter, bbUnit);
  const labelZh = actionLabelZh(action);
  if (!labelZh) return;

  const st = normStreet(e.street);

  if (action === "fold" || action === "check") {
    trails[si].push({ labelZh, street: st });
    return;
  }

  trails[si].push({
    labelZh,
    street: st,
    ...(chipsLine != null ? { chipsLine } : {}),
  });
}

/** 顶部解说条：本步含筹码时在下一行展示 */
function formatStepHeadlineChips(
  e: ByActionEvent | undefined,
  potAfter: number,
  bbUnit: number,
): string {
  if (!e) return "";
  const action = (e.action || "").toLowerCase();
  if (
    !isWagerAction(action) &&
    !["call", "post", "straddle", "sb", "bb", "small_blind", "big_blind", "ante"].includes(
      action,
    )
  ) {
    return "";
  }
  return formatActionChipsLine(e.chips, potAfter, bbUnit) ?? "";
}

/** 当前 deal_board 事件推断本次发出的公牌槽位（0–4） */
export function boardIndicesForDealBoardStep(
  e: ByActionEvent | undefined,
): number[] {
  if (!e || (e.action || "").toLowerCase() !== "deal_board") return [];
  const st = normStreet(e.street);
  if (st === "flop") return [0, 1, 2];
  if (st === "turn") return [3];
  if (st === "river") return [4];
  if (e.cards) {
    const n = unicodeCardsToCodes(e.cards).length;
    if (n >= 3) return [0, 1, 2];
    if (n === 1) return [3];
  }
  return [];
}

export interface ReplaySnapshot {
  board: (string | null)[];
  street: Street;
  holes: [string | null, string | null][];
  stacks: number[];
  folded: boolean[];
  /** 当前投注街各座位投入（用于 facing；发新公共牌后清零） */
  streetBets: number[];
  /** 整手牌各座位累计投入（界面「注」：逐 action 累加，换街不清零） */
  handBets: number[];
  /** 底池：盲注 + 各街下注增量累计 */
  pot: number;
  /** 各座位截至当前步的动作标签序列 */
  playerActionTrail: ReplayActionTrailItem[][];
  stepSeatFocus: number | null;
  stepActionKey: string;
  stepActionZh: string;
  /** 与 stepActionZh 配套的筹码行（加注/下注等），用于解说头条第二行 */
  stepHeadlineChipsLine: string;
  stepSeatName: string;
  stepDetailText: string;
  /** 当前步为 deal_board 时，本次新发的公牌索引 */
  boardHighlightIndices: number[];
}

/** 根据 timeline 前 step+1 条事件推算桌面状态（step 从 0 起） */
export function computeReplaySnapshot(
  timeline: ByActionEvent[],
  step: number,
  meta: CommentaryReplayMeta | null,
  seatCount = 6,
): ReplaySnapshot {
  const board: (string | null)[] = [null, null, null, null, null];
  let street: Street = "preflop";
  const holes: [string | null, string | null][] = Array.from({ length: seatCount }, () => [
    null,
    null,
  ]);
  const folded = Array.from({ length: seatCount }, () => false);
  const streetBets = Array.from({ length: seatCount }, () => 0);
  const handBets = Array.from({ length: seatCount }, () => 0);
  const potRef = { v: 0 };
  const maxFacingRef = { v: 0 };

  const blindsFromPosts = extractPreflopBlindsFromTimeline(timeline, seatCount);
  const blindsMerged = mergeBlindsForInit(
    meta?.blindsOrStraddles,
    blindsFromPosts,
    seatCount,
  );
  const blindInit = initStreetFromBlinds(
    streetBets,
    handBets,
    blindsMerged,
    seatCount,
  );
  potRef.v = blindInit.pot;
  maxFacingRef.v = blindInit.maxFacing;

  const playerActionTrail: ReplayActionTrailItem[][] = Array.from(
    { length: seatCount },
    () => [],
  );

  const bbUnit = inferBigBlindUnit(blindsMerged);

  const maxStep = Math.min(step, timeline.length - 1);
  for (let i = 0; i <= maxStep; i++) {
    const e = timeline[i];
    street = normStreet(e.street);
    const act = (e.action || "").toLowerCase();

    if (act === "deal_board") {
      streetBets.fill(0);
      maxFacingRef.v = 0;
      /* handBets 保留，界面「注」为整手累计 */
      if (e.cards) {
        const codes = unicodeCardsToCodes(e.cards);
        if (e.street === "flop" && codes.length >= 3) {
          board[0] = codes[0];
          board[1] = codes[1];
          board[2] = codes[2];
        } else if (e.street === "turn" && codes.length >= 1) {
          board[3] = codes[0];
        } else if (e.street === "river" && codes.length >= 1) {
          board[4] = codes[0];
        }
      }
      continue;
    }

    switch (act) {
      case "deal_hole": {
        if (e.seat_index != null && e.cards) {
          const codes = unicodeCardsToCodes(e.cards);
          if (codes.length >= 2 && e.seat_index >= 0 && e.seat_index < seatCount) {
            holes[e.seat_index] = [codes[0], codes[1]];
          }
        }
        break;
      }
      case "fold": {
        if (e.seat_index != null && e.seat_index >= 0 && e.seat_index < seatCount) {
          folded[e.seat_index] = true;
        }
        break;
      }
      default:
        applyChipsAction(e, streetBets, handBets, potRef, maxFacingRef, seatCount);
        break;
    }

    recordPlayerActionTrail(e, playerActionTrail, seatCount, potRef.v, bbUnit);
  }

  const last = timeline[maxStep];
  const stepSeatFocus =
    last && last.seat_index != null && last.seat_index >= 0 && last.seat_index < seatCount
      ? last.seat_index
      : null;
  const stepActionKey = last?.action ?? "";
  const stepActionZh = actionLabelZh((last?.action ?? "").toLowerCase());
  const stepSeatName = last?.seat_name ?? "";
  const stepDetailText = last?.text ?? "";
  const stepHeadlineChips = formatStepHeadlineChips(last, potRef.v, bbUnit);
  const boardHighlightIndices = boardIndicesForDealBoardStep(last);

  const atEnd = maxStep >= timeline.length - 1 && timeline.length > 0;
  const stacks = (() => {
    if (meta?.startingStacks?.length === seatCount) {
      if (atEnd && meta.finishingStacks?.length === seatCount) {
        return [...meta.finishingStacks];
      }
      return meta.startingStacks.map((s, i) =>
        Math.max(0, Math.round(s - (handBets[i] ?? 0))),
      );
    }
    if (atEnd && meta?.finishingStacks?.length === seatCount) {
      return [...meta.finishingStacks];
    }
    return Array.from({ length: seatCount }, (_, i) =>
      Math.max(0, Math.round(10000 - (handBets[i] ?? 0))),
    );
  })();

  return {
    board,
    street,
    holes,
    stacks,
    folded,
    streetBets: [...streetBets],
    handBets: [...handBets],
    pot: Math.round(potRef.v),
    playerActionTrail: playerActionTrail.map((row) => row.map((x) => ({ ...x }))),
    stepSeatFocus,
    stepActionKey,
    stepActionZh,
    stepHeadlineChipsLine: stepHeadlineChips,
    stepSeatName,
    stepDetailText,
    boardHighlightIndices,
  };
}
