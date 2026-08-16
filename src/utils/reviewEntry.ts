import type { ByActionEvent, SeatPositionKey, Street } from "@/types/commentary";
import type { ReviewActionKind } from "@/types/review";
import type { ReviewHandDraft } from "@/types/review";
import { unicodeCardsToCodes } from "@/utils/unicodeCards";

export const REVIEW_SEAT_COUNT = 6;
export const REVIEW_SEAT_KEYS: SeatPositionKey[] = [
  "SB",
  "BB",
  "UTG",
  "MP",
  "CO",
  "BTN",
];
export const REVIEW_SEAT_LABEL_ZH: Record<SeatPositionKey, string> = {
  SB: "小盲",
  BB: "大盲",
  UTG: "枪口",
  MP: "中位",
  CO: "关煞",
  BTN: "庄位",
};

/** 录入步骤：座位 → 手牌（自动发牌）→ 下注各街 → 摊牌 */
export type ReviewEntryStep =
  | "hero_seat"
  | "hero_cards"
  | "actions"
  | "showdown";

export const REVIEW_ENTRY_STEPS: ReviewEntryStep[] = [
  "hero_seat",
  "hero_cards",
  "actions",
  "showdown",
];

export function entryStepIndexOf(step: ReviewEntryStep): number {
  return REVIEW_ENTRY_STEPS.indexOf(step);
}

export const CARD_RANKS = [
  "A",
  "K",
  "Q",
  "J",
  "T",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
] as const;
export const CARD_SUITS = [
  { key: "s", label: "♠", red: false },
  { key: "h", label: "♥", red: true },
  { key: "d", label: "♦", red: true },
  { key: "c", label: "♣", red: false },
] as const;

export function seatLabelZh(seat: number): string {
  const k = REVIEW_SEAT_KEYS[seat];
  return k ? REVIEW_SEAT_LABEL_ZH[k] : `座位${seat}`;
}

export function nextEventIndex(byAction: ByActionEvent[]): number {
  if (!byAction.length) return 0;
  return Math.max(...byAction.map((e) => e.event_index)) + 1;
}

function makeEvent(
  draft: ReviewHandDraft,
  partial: Omit<ByActionEvent, "event_index" | "seat_name"> & {
    seat_index: number | null;
  },
): ByActionEvent {
  const si = partial.seat_index;
  return {
    event_index: nextEventIndex(draft.byAction),
    seat_index: si,
    seat_name: si == null ? "" : `p${si}`,
    action: partial.action,
    street: partial.street,
    cards: partial.cards ?? null,
    text: partial.text ?? "",
    chips: partial.chips,
  };
}

/** 翻前行动顺序：枪口起，顺时针到大盲 */
export function preflopActionOrder(seatCount = REVIEW_SEAT_COUNT): number[] {
  const order: number[] = [];
  for (let i = 0; i < seatCount; i++) {
    order.push((2 + i) % seatCount);
  }
  return order;
}

export function postflopActionOrder(seatCount = REVIEW_SEAT_COUNT): number[] {
  const order: number[] = [];
  for (let i = 0; i < seatCount; i++) {
    order.push(i % seatCount);
  }
  return order;
}

function isDecisionAction(action: string): boolean {
  const a = (action || "").toLowerCase();
  return (
    a === "fold" ||
    a === "check" ||
    a === "call" ||
    a === "bet" ||
    a === "raise" ||
    a === "all_in" ||
    a === "allin" ||
    /^\d+bet$/.test(a)
  );
}

/** 从时间线推导当前街各座位状态（录入用，轻量） */
export function deriveEntryTableState(draft: ReviewHandDraft) {
  const seatCount = REVIEW_SEAT_COUNT;
  const folded = Array.from({ length: seatCount }, () => false);
  const streetBets = Array.from({ length: seatCount }, () => 0);
  const holes: [string | null, string | null][] = Array.from(
    { length: seatCount },
    () => [null, null],
  );
  let street: Street = "preflop";
  let pot = 0;
  const blinds = draft.blindsOrStraddles;

  for (let i = 0; i < seatCount; i++) {
    const b = blinds[i] ?? 0;
    if (b > 0) {
      streetBets[i] = b;
      pot += b;
    }
  }

  for (const e of draft.byAction) {
    street = (e.street as Street) || street;
    const a = (e.action || "").toLowerCase();
    const si = e.seat_index;

    if (a === "deal_board") {
      streetBets.fill(0);
      continue;
    }
    if (a === "deal_hole" && si != null && si >= 0 && si < seatCount) {
      const raw = (e.cards || "").trim();
      if (raw.length >= 4) {
        holes[si] = [raw.slice(0, 2), raw.slice(2, 4)];
      } else {
        holes[si] = [null, null];
      }
      continue;
    }
    if (si == null || si < 0 || si >= seatCount) continue;
    if (a === "fold") {
      folded[si] = true;
      continue;
    }
    if (a === "check") continue;
    if (
      a === "post" ||
      a === "sb" ||
      a === "bb" ||
      a === "call" ||
      a === "bet" ||
      a === "raise" ||
      a === "all_in" ||
      a === "allin" ||
      /^\d+bet$/.test(a)
    ) {
      const chips = typeof e.chips === "number" ? e.chips : 0;
      if (chips > streetBets[si]) {
        pot += chips - streetBets[si];
        streetBets[si] = chips;
      }
    }
  }

  const maxFacing = Math.max(0, ...streetBets);
  return { folded, streetBets, holes, street, pot, maxFacing };
}

export function hasDealtHoles(draft: ReviewHandDraft): boolean {
  return draft.byAction.some(
    (e) => (e.action || "").toLowerCase() === "deal_hole",
  );
}

export function hasPostedBlinds(draft: ReviewHandDraft): boolean {
  return draft.byAction.some((e) => {
    const a = (e.action || "").toLowerCase();
    return a === "post" || a === "sb" || a === "bb";
  });
}

/**
 * 当前该谁行动。翻前从 UTG 起；已 fold 跳过；
 * 本街已对齐 maxFacing 且每人至少行动过一轮则返回 null（街结束）。
 */
export function findNextActorSeat(draft: ReviewHandDraft): number | null {
  if (!hasDealtHoles(draft)) return null;
  const { folded, streetBets, street, maxFacing } = deriveEntryTableState(draft);
  const order =
    street === "preflop"
      ? preflopActionOrder()
      : postflopActionOrder();

  const actedThisStreet = new Set<number>();
  for (const e of draft.byAction) {
    if ((e.street as Street) !== street) continue;
    if (e.seat_index == null) continue;
    if (!isDecisionAction(e.action)) continue;
    actedThisStreet.add(e.seat_index);
  }

  const alive = folded.map((f) => !f);
  const aliveCount = alive.filter(Boolean).length;
  if (aliveCount <= 1) return null;

  // 每人至少行动一次且街注对齐 → 街结束
  const allActedAligned = alive.every((ok, i) => {
    if (!ok) return true;
    return actedThisStreet.has(i) && streetBets[i] === maxFacing;
  });
  if (allActedAligned && actedThisStreet.size > 0) return null;

  // 优先：还没行动的人
  for (const seat of order) {
    if (folded[seat]) continue;
    if (!actedThisStreet.has(seat)) return seat;
  }
  // 再：面对注额未对齐的人
  for (const seat of order) {
    if (folded[seat]) continue;
    if (streetBets[seat] < maxFacing) return seat;
  }
  return null;
}

export function countAliveSeats(draft: ReviewHandDraft): number {
  const { folded } = deriveEntryTableState(draft);
  return folded.filter((f) => !f).length;
}

export function getNextStreet(street: Street): Street | null {
  if (street === "preflop") return "flop";
  if (street === "flop") return "turn";
  if (street === "turn") return "river";
  return null;
}

export function boardCardsNeeded(street: Street): number {
  if (street === "flop") return 3;
  if (street === "turn" || street === "river") return 1;
  return 0;
}

/** 本街下注结束，且还能进下一街（多人存活、未到河牌后） */
export function canAdvanceToNextStreet(draft: ReviewHandDraft): boolean {
  if (!hasDealtHoles(draft)) return false;
  if (findNextActorSeat(draft) != null) return false;
  if (countAliveSeats(draft) <= 1) return false;
  const { street } = deriveEntryTableState(draft);
  return getNextStreet(street) != null;
}

/**
 * 全部街的下注已结束，且仍有 ≥2 人未弃牌 → 应进入摊牌。
 * （河牌打完，或中途无法再进下一街但仍多人在池）
 */
export function shouldEnterShowdown(draft: ReviewHandDraft): boolean {
  if (!hasDealtHoles(draft)) return false;
  if (findNextActorSeat(draft) != null) return false;
  if (countAliveSeats(draft) <= 1) return false;
  const { street } = deriveEntryTableState(draft);
  return getNextStreet(street) == null;
}

/** 手牌已无法继续下注（可结束录入 / 进摊牌或直接复盘） */
export function isHandActionFinished(draft: ReviewHandDraft): boolean {
  if (!hasDealtHoles(draft)) return false;
  if (findNextActorSeat(draft) != null) return false;
  return !canAdvanceToNextStreet(draft);
}

export function appendDealBoard(
  draft: ReviewHandDraft,
  street: Street,
  cardCodes: string[],
): void {
  const need = boardCardsNeeded(street);
  if (cardCodes.length < need) return;
  draft.byAction.push(
    makeEvent(draft, {
      seat_index: null,
      action: "deal_board",
      street,
      cards: cardCodes.slice(0, need).join(""),
      text: "",
    }),
  );
}

export interface EntryLegalAction {
  kind: ReviewActionKind;
  /** 写入 by_action.chips：本街累计投入（raise-to / call-to） */
  chips?: number;
  label: string;
  /** 需要用户再填金额 */
  needsAmount?: boolean;
}

export function listLegalEntryActions(
  draft: ReviewHandDraft,
  seat: number,
): EntryLegalAction[] {
  const { streetBets, maxFacing, folded } = deriveEntryTableState(draft);
  if (folded[seat]) return [];
  const mine = streetBets[seat] ?? 0;
  const toCall = Math.max(0, maxFacing - mine);
  const stack = draft.startingStacks[seat] ?? 0;
  const remaining = Math.max(0, stack - mine);
  const out: EntryLegalAction[] = [];

  if (toCall <= 0) {
    out.push({ kind: "check", label: "过牌" });
    out.push({
      kind: "bet",
      label: "下注",
      needsAmount: true,
      chips: Math.min(remaining, Math.max(draft.blindsOrStraddles[1] ?? 100, 1)),
    });
  } else {
    out.push({ kind: "fold", label: "弃牌" });
    const callTo = Math.min(maxFacing, mine + remaining);
    out.push({
      kind: "call",
      label: remaining <= toCall ? `全下 ${mine + remaining}` : `跟注 ${toCall}`,
      chips: callTo,
    });
    if (remaining > toCall) {
      out.push({
        kind: "raise",
        label: "加注",
        needsAmount: true,
        chips: Math.min(mine + remaining, maxFacing * 2 || maxFacing + (draft.blindsOrStraddles[1] ?? 100)),
      });
    }
  }
  if (remaining > 0) {
    out.push({
      kind: "all_in",
      label: `全下 ${mine + remaining}`,
      chips: mine + remaining,
    });
  }
  return out;
}

export function appendBlindPosts(draft: ReviewHandDraft): void {
  if (hasPostedBlinds(draft)) return;
  const sb = draft.blindsOrStraddles[0] ?? 0;
  const bb = draft.blindsOrStraddles[1] ?? 0;
  if (sb > 0) {
    draft.byAction.push(
      makeEvent(draft, {
        seat_index: 0,
        action: "post",
        street: "preflop",
        cards: null,
        text: "",
        chips: sb,
      }),
    );
  }
  if (bb > 0) {
    draft.byAction.push(
      makeEvent(draft, {
        seat_index: 1,
        action: "post",
        street: "preflop",
        cards: null,
        text: "",
        chips: bb,
      }),
    );
  }
}

/** 一步：Hero 亮牌 + 其他座位发未知底牌 */
export function appendDealHoles(
  draft: ReviewHandDraft,
  heroCards: [string, string],
): void {
  appendBlindPosts(draft);
  const hero = draft.heroSeatIndex;
  draft.byAction.push(
    makeEvent(draft, {
      seat_index: hero,
      action: "deal_hole",
      street: "preflop",
      cards: `${heroCards[0]}${heroCards[1]}`,
      text: "",
    }),
  );
  for (let seat = 0; seat < REVIEW_SEAT_COUNT; seat++) {
    if (seat === hero) continue;
    draft.byAction.push(
      makeEvent(draft, {
        seat_index: seat,
        action: "deal_hole",
        street: "preflop",
        cards: null,
        text: "",
      }),
    );
  }
}

/** 对手摊牌：亮出两张底牌（写入 showdown，回放引擎会揭牌） */
export function appendShowdownHole(
  draft: ReviewHandDraft,
  seat: number,
  cardCodes: [string, string],
): void {
  const { street } = deriveEntryTableState(draft);
  draft.byAction.push(
    makeEvent(draft, {
      seat_index: seat,
      action: "showdown",
      street,
      cards: `${cardCodes[0]}${cardCodes[1]}`,
      text: "",
    }),
  );
}

export function appendPlayerAction(
  draft: ReviewHandDraft,
  seat: number,
  kind: ReviewActionKind,
  chips?: number,
): void {
  const { street } = deriveEntryTableState(draft);
  const action = kind === "all_in" ? "all_in" : kind;
  draft.byAction.push(
    makeEvent(draft, {
      seat_index: seat,
      action,
      street,
      cards: null,
      text: "",
      chips: kind === "fold" || kind === "check" ? undefined : chips,
    }),
  );
}

export function undoLastEntryEvent(draft: ReviewHandDraft): ByActionEvent | null {
  return draft.byAction.pop() ?? null;
}

/** 撤销到发牌之前（回到可重发） */
export function stripDealAndActions(draft: ReviewHandDraft): void {
  draft.byAction = draft.byAction.filter((e) => {
    const a = (e.action || "").toLowerCase();
    return a === "post" || a === "sb" || a === "bb";
  });
}

export function collectUsedCardCodes(
  draft: ReviewHandDraft,
  pendingHero?: [string | null, string | null],
  pendingBoard?: (string | null)[],
  pendingShowdown?: [string | null, string | null],
): Set<string> {
  const used = new Set<string>();
  for (const e of draft.byAction) {
    for (const code of unicodeCardsToCodes(e.cards || "")) {
      used.add(code);
    }
  }
  if (pendingHero?.[0]) used.add(pendingHero[0]);
  if (pendingHero?.[1]) used.add(pendingHero[1]);
  if (pendingBoard) {
    for (const c of pendingBoard) {
      if (c) used.add(c);
    }
  }
  if (pendingShowdown?.[0]) used.add(pendingShowdown[0]);
  if (pendingShowdown?.[1]) used.add(pendingShowdown[1]);
  return used;
}

export function defaultRaiseToAmount(draft: ReviewHandDraft, seat: number): number {
  const { streetBets, maxFacing } = deriveEntryTableState(draft);
  const mine = streetBets[seat] ?? 0;
  const bb = draft.blindsOrStraddles[1] ?? 100;
  const stack = draft.startingStacks[seat] ?? 0;
  const suggested =
    maxFacing <= 0 ? Math.max(bb, Math.round(bb * 2.5)) : Math.max(maxFacing * 2, maxFacing + bb);
  return Math.min(stack, Math.max(mine + 1, suggested));
}
