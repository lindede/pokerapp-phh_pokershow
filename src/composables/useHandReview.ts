import { computed, reactive, ref } from "vue";
import type { CommentaryReplayMeta, SeatPositionKey } from "@/types/commentary";
import { getReviewAnalyzeApiUrl, getReviewParsePhhApiUrl, getReviewArtifactApiUrl, REVIEW_ANALYZE_TIMEOUT_MS } from "@/config/review-api";
import type {
  HeroDecisionReview,
  ReviewActionKind,
  ReviewAnalyzeRequest,
  ReviewAnalyzeResponse,
  ReviewHandDraft,
  ReviewParsePhhResponse,
  ReviewPhase,
  ReviewVerdict,
} from "@/types/review";
import { HERO_DECISION_ACTION_KEYS } from "@/types/review";
import {
  computeReplaySnapshot,
  type ReplaySnapshot,
} from "@/utils/replayByAction";
import {
  REVIEW_ENTRY_STEPS,
  REVIEW_SEAT_COUNT,
  REVIEW_SEAT_KEYS,
  REVIEW_SEAT_LABEL_ZH,
  appendDealBoard,
  appendDealHoles,
  appendPlayerAction,
  appendShowdownHole,
  boardCardsNeeded,
  canAdvanceToNextStreet,
  collectUsedCardCodes,
  defaultRaiseToAmount,
  deriveEntryTableState,
  entryStepIndexOf,
  findNextActorSeat,
  getNextStreet,
  hasDealtHoles,
  listLegalEntryActions,
  seatLabelZh,
  shouldEnterShowdown,
  type ReviewEntryStep,
  undoLastEntryEvent,
} from "@/utils/reviewEntry";
import type { Street } from "@/types/commentary";
import { unicodeCardsToCodes } from "@/utils/unicodeCards";

export type { ReviewEntryStep };

export interface ReviewTablePlayer {
  id: string;
  seatIndex: number;
  positionKey: SeatPositionKey;
  positionLabel: string;
  name: string;
  stack: number;
  bet: number;
  hole: [string | null, string | null];
  folded: boolean;
  isHero: boolean;
  isFocus: boolean;
  actionTrail: ReplaySnapshot["playerActionTrail"][number];
}

const DEFAULT_STACK = 10000;
const DEFAULT_SB = 50;
const DEFAULT_BB = 100;

function isHeroDecisionAction(action: string): boolean {
  const a = (action || "").trim().toLowerCase();
  if (!a) return false;
  if ((HERO_DECISION_ACTION_KEYS as readonly string[]).includes(a)) return true;
  return /^\d+bet$/.test(a);
}

export function listHeroDecisionEventIndices(
  byAction: ReviewHandDraft["byAction"],
  heroSeatIndex: number,
): number[] {
  if (heroSeatIndex < 0) return [];
  const out: number[] = [];
  for (const e of byAction) {
    if (e.seat_index !== heroSeatIndex) continue;
    if (!isHeroDecisionAction(e.action)) continue;
    out.push(e.event_index);
  }
  return out;
}

function createEmptyDraft(): ReviewHandDraft {
  return {
    heroSeatIndex: 0,
    startingStacks: Array.from(
      { length: REVIEW_SEAT_COUNT },
      () => DEFAULT_STACK,
    ),
    blindsOrStraddles: [DEFAULT_SB, DEFAULT_BB, 0, 0, 0, 0],
    byAction: [],
  };
}

function buildMockAnalyzeResponse(
  draft: ReviewHandDraft,
): ReviewAnalyzeResponse {
  const indices = listHeroDecisionEventIndices(
    draft.byAction,
    draft.heroSeatIndex,
  );
  return {
    reviews: indices.map((event_index) => {
      const ev = draft.byAction.find((e) => e.event_index === event_index);
      const chips = ev?.chips ?? undefined;
      const act = (ev?.action || "raise").toLowerCase();
      const kind: ReviewActionKind =
        act === "fold" ||
        act === "check" ||
        act === "call" ||
        act === "bet" ||
        act === "raise" ||
        act === "all_in" ||
        act === "allin"
          ? act === "allin"
            ? "all_in"
            : act
          : "raise";
      const actualLabel =
        kind === "fold"
          ? "弃牌"
          : kind === "check"
            ? "过牌"
            : kind === "call"
              ? `跟注${chips != null ? ` ${chips}` : ""}`
              : kind === "bet"
                ? `下注${chips != null ? ` ${chips}` : ""}`
                : kind === "all_in"
                  ? `全下${chips != null ? ` ${chips}` : ""}`
                  : `加注到${chips != null ? ` ${chips}` : ""}`;
      return {
        event_index,
        actual: { kind, chips, label: actualLabel },
        options: [
          { kind: "fold", label: "弃牌" },
          { kind: "call", label: "跟注" },
          { kind: "raise", label: "加注" },
          { kind: "all_in", label: "全下" },
        ],
        recommend: { kind: "call", label: "跟注" },
        verdict: "suboptimal" as ReviewVerdict,
        reasons: ["示例点评：此处跟注通常更稳。", "完整理由由后端模型返回。"],
      };
    }),
  };
}

export function useHandReview(opts?: { useMock?: boolean }) {
  const useMock = opts?.useMock !== false;
  const phase = ref<ReviewPhase>("entry");
  const entryStep = ref<ReviewEntryStep>("hero_seat");
  /** 曾到达的最远步骤（回改完成后跳回这里） */
  const furthestStep = ref<ReviewEntryStep>("hero_seat");
  const draft = reactive<ReviewHandDraft>(createEmptyDraft());
  const pendingHeroCards = ref<[string | null, string | null]>([null, null]);
  /** 是否已明确点选过座位（避免默认 seat0 被当成已完成） */
  const heroSeatChosen = ref(false);
  const amountDraft = ref("");
  const loading = ref(false);
  const errorMessage = ref("");
  const reviews = ref<HeroDecisionReview[]>([]);
  const reviewCursor = ref(0);
  const analyzeWarnings = ref<string[]>([]);

  const cardPickerVisible = ref(false);
  /** hole = Hero 手牌；board = 发公牌；showdown = 对手摊牌 */
  const cardPickerMode = ref<"hole" | "board" | "showdown">("hole");
  const pickerSuit = ref<"s" | "h" | "d" | "c">("s");
  const pendingBoardCards = ref<(string | null)[]>([]);
  const pendingBoardStreet = ref<Street | null>(null);
  const pendingShowdownSeat = ref<number | null>(null);
  const pendingShowdownCards = ref<[string | null, string | null]>([
    null,
    null,
  ]);

  const entryStepIndex = computed(() => entryStepIndexOf(entryStep.value));
  const furthestStepIndex = computed(() =>
    entryStepIndexOf(furthestStep.value),
  );

  const heroDecisionIndices = computed(() =>
    listHeroDecisionEventIndices(draft.byAction, draft.heroSeatIndex),
  );

  const heroCardsReady = computed(
    () => Boolean(pendingHeroCards.value[0] && pendingHeroCards.value[1]),
  );

  const canGoPrev = computed(
    () => phase.value === "entry" && entryStepIndex.value > 0,
  );

  const canGoNext = computed(() => {
    if (phase.value !== "entry") return false;
    if (entryStep.value === "hero_seat") return heroSeatChosen.value;
    if (entryStep.value === "hero_cards") return heroCardsReady.value;
    if (entryStep.value === "actions") {
      if (canAdvanceToNextStreet(draft)) return true;
      // 全部街结束且需摊牌 → 下一步进摊牌
      return shouldEnterShowdown(draft);
    }
    return false;
  });

  const streetComplete = computed(
    () =>
      entryStep.value === "actions" &&
      findNextActorSeat(draft) == null &&
      hasDealtHoles(draft),
  );

  const nextStreetToDeal = computed(() => {
    if (entryStep.value !== "actions") return null;
    if (!canAdvanceToNextStreet(draft)) return null;
    return getNextStreet(deriveEntryTableState(draft).street);
  });

  const nextStreetLabel = computed(() => {
    const s = nextStreetToDeal.value;
    if (s === "flop") return "翻牌";
    if (s === "turn") return "转牌";
    if (s === "river") return "河牌";
    return "";
  });

  const canEnterShowdown = computed(
    () => entryStep.value === "actions" && shouldEnterShowdown(draft),
  );

  /** 录入中任意时刻：至少 1 个 Hero 决策即可开始复盘（允许只录前缀） */
  const canStartReview = computed(() => {
    if (phase.value !== "entry" || loading.value) return false;
    return heroDecisionIndices.value.length > 0;
  });

  const currentReview = computed(() => {
    if (phase.value !== "reviewing") return null;
    return reviews.value[reviewCursor.value] ?? null;
  });

  const hasPrevDecision = computed(
    () => phase.value === "reviewing" && reviewCursor.value > 0,
  );

  const hasNextDecision = computed(
    () =>
      phase.value === "reviewing" &&
      reviewCursor.value < reviews.value.length - 1,
  );

  const replayMeta = computed<CommentaryReplayMeta>(() => ({
    startingStacks: [...draft.startingStacks],
    finishingStacks: [...draft.startingStacks],
    blindsOrStraddles: [...draft.blindsOrStraddles],
  }));

  const tableStepIndex = computed(() => {
    if (!draft.byAction.length) return -1;
    if (phase.value === "reviewing" && currentReview.value) {
      const review = currentReview.value;
      // 总结：看完整时间线
      if (review.kind === "summary") {
        return draft.byAction.length - 1;
      }
      // 优先按 event_index 对齐（手动录入未重编号时）
      const byEi = draft.byAction.findIndex(
        (e) => e.event_index === review.event_index,
      );
      if (byEi >= 0) return byEi;

      // analyze 会重建 PHH → HandIR，packet 的 event_index 可能与草稿不一致；
      // 按「第几个 Hero 决策」映射，避免回退到最后一条摊牌。
      let decisionOrd = 0;
      for (let i = 0; i < reviewCursor.value; i++) {
        if (reviews.value[i]?.kind !== "summary") decisionOrd += 1;
      }
      const heroEi = heroDecisionIndices.value[decisionOrd];
      if (heroEi != null) {
        const byHero = draft.byAction.findIndex((e) => e.event_index === heroEi);
        if (byHero >= 0) return byHero;
      }
      return draft.byAction.length - 1;
    }
    return draft.byAction.length - 1;
  });

  const snapshot = computed<ReplaySnapshot | null>(() => {
    if (tableStepIndex.value < 0) return null;
    return computeReplaySnapshot(
      draft.byAction,
      tableStepIndex.value,
      replayMeta.value,
      REVIEW_SEAT_COUNT,
    );
  });

  const nextActorSeat = computed(() =>
    entryStep.value === "actions" ? findNextActorSeat(draft) : null,
  );

  const legalActions = computed(() => {
    if (nextActorSeat.value == null) return [];
    return listLegalEntryActions(draft, nextActorSeat.value);
  });

  const usedCardCodes = computed(() =>
    collectUsedCardCodes(
      draft,
      pendingHeroCards.value,
      pendingBoardCards.value,
      pendingShowdownCards.value,
    ),
  );

  const showdownCardsReady = computed(
    () =>
      Boolean(pendingShowdownCards.value[0] && pendingShowdownCards.value[1]),
  );

  const tablePlayers = computed<ReviewTablePlayer[]>(() => {
    const snap = snapshot.value;
    const hero = draft.heroSeatIndex;
    const pending = pendingHeroCards.value;
    return Array.from({ length: REVIEW_SEAT_COUNT }, (_, seat) => {
      const positionKey = REVIEW_SEAT_KEYS[seat];
      let hole: [string | null, string | null] =
        snap?.holes[seat] ?? [null, null];
      if (
        seat === hero &&
        (!hole[0] || !hole[1]) &&
        pending[0] &&
        pending[1]
      ) {
        hole = [pending[0], pending[1]];
      }
      const showHole = seat === hero || Boolean(hole[0] || hole[1]);
      let isFocus = false;
      if (entryStep.value === "hero_seat" || entryStep.value === "hero_cards") {
        isFocus = seat === hero && heroSeatChosen.value;
      } else if (entryStep.value === "actions") {
        isFocus = nextActorSeat.value === seat;
      } else if (entryStep.value === "showdown") {
        const isFolded = snap?.folded[seat] ?? false;
        isFocus = !isFolded && seat !== hero;
      } else {
        isFocus = snap?.stepSeatFocus === seat;
      }
      return {
        id: `p${seat}`,
        seatIndex: seat,
        positionKey,
        positionLabel: REVIEW_SEAT_LABEL_ZH[positionKey],
        name:
          seat === hero && heroSeatChosen.value
            ? "Hero"
            : seatLabelZh(seat),
        stack:
          snap?.stacks[seat] ?? draft.startingStacks[seat] ?? DEFAULT_STACK,
        bet:
          snap?.handBets[seat] ??
          (hasDealtHoles(draft) ? 0 : draft.blindsOrStraddles[seat] ?? 0),
        hole: showHole ? hole : [null, null],
        folded: snap?.folded[seat] ?? false,
        isHero: seat === hero && heroSeatChosen.value,
        isFocus: Boolean(isFocus),
        actionTrail: snap?.playerActionTrail[seat] ?? [],
      };
    });
  });

  const blindsLevelText = computed(() => {
    const sb = draft.blindsOrStraddles[0] ?? 0;
    const bb = draft.blindsOrStraddles[1] ?? 0;
    if (!sb && !bb) return "";
    return `${sb}/${bb}`;
  });

  const streetZh = computed(() => {
    const map: Record<string, string> = {
      preflop: "翻前",
      flop: "翻牌",
      turn: "转牌",
      river: "河牌",
    };
    return map[snapshot.value?.street ?? "preflop"] ?? "翻前";
  });

  const stepHeadline = computed(() => {
    if (phase.value === "reviewing") {
      const snap = snapshot.value;
      if (!snap) return "复盘";
      const seat =
        snap.stepSeatFocus != null
          ? REVIEW_SEAT_LABEL_ZH[REVIEW_SEAT_KEYS[snap.stepSeatFocus]]
          : "";
      return [seat, snap.stepActionZh || snap.stepActionKey]
        .filter(Boolean)
        .join(" · ");
    }
    if (entryStep.value === "hero_seat") {
      return heroSeatChosen.value
        ? `已选 ${seatLabelZh(draft.heroSeatIndex)}`
        : "点击座位选择 Hero";
    }
    if (entryStep.value === "hero_cards") {
      return heroCardsReady.value
        ? `手牌 ${pendingHeroCards.value[0]}${pendingHeroCards.value[1]}`
        : "点手牌区选择两张牌";
    }
    if (nextActorSeat.value != null) {
      return `轮到 ${seatLabelZh(nextActorSeat.value)}`;
    }
    if (entryStep.value === "showdown") {
      return "摊牌 · 点对手手牌录入";
    }
    if (nextStreetToDeal.value) {
      return `本街结束 · 发${nextStreetLabel.value}`;
    }
    if (canEnterShowdown.value) {
      return "全部街结束 · 进入摊牌";
    }
    return "本手结束，可开始复盘";
  });

  function markFurthest(step: ReviewEntryStep) {
    if (entryStepIndexOf(step) > furthestStepIndex.value) {
      furthestStep.value = step;
    }
  }

  /** 时间线里 Hero 已发出的两张底牌 */
  function heroHoleFromDraft(): [string | null, string | null] {
    const hero = draft.heroSeatIndex;
    for (const e of draft.byAction) {
      if ((e.action || "").toLowerCase() !== "deal_hole") continue;
      if (e.seat_index !== hero) continue;
      const codes = unicodeCardsToCodes(e.cards || "");
      if (codes.length >= 2) return [codes[0], codes[1]];
    }
    return [null, null];
  }

  function sameHolePair(
    a: [string | null, string | null],
    b: [string | null, string | null],
  ): boolean {
    if (!a[0] || !a[1] || !b[0] || !b[1]) return false;
    return (
      (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])
    );
  }

  /** 手牌相对已发牌是否有改动（未发过视为需要重发） */
  function heroCardsDirtyVsDealt(): boolean {
    const dealt = heroHoleFromDraft();
    if (!dealt[0] || !dealt[1]) return true;
    return !sameHolePair(pendingHeroCards.value, dealt);
  }

  function resumeFurthestAfterCardsOk() {
    const target =
      furthestStep.value === "showdown" ? "showdown" : "actions";
    entryStep.value = target;
  }

  function jumpAfterEditComplete() {
    // 调完当前步：若曾到过更远步骤，直接回到最远；否则进下一步
    const nextIdx = entryStepIndex.value + 1;
    const targetIdx = Math.max(nextIdx, furthestStepIndex.value);
    const target =
      REVIEW_ENTRY_STEPS[Math.min(targetIdx, REVIEW_ENTRY_STEPS.length - 1)];
    if (target === "actions" || target === "showdown") {
      // 已发牌且手牌未改：只跳回最远步，保留已录动作
      if (hasDealtHoles(draft) && !heroCardsDirtyVsDealt()) {
        resumeFurthestAfterCardsOk();
        return;
      }
      // 手牌变更或尚未发牌：重发并清空后续行动
      applyDealAndEnterActions();
      if (furthestStep.value === "showdown") {
        furthestStep.value = "actions";
      }
      return;
    }
    entryStep.value = target;
    markFurthest(target);
  }

  function applyDealAndEnterActions() {
    const [a, b] = pendingHeroCards.value;
    if (!a || !b) {
      uni.showToast({ title: "请先选两张手牌", icon: "none" });
      return;
    }
    // 重新发牌：清掉旧时间线再写入
    draft.byAction = [];
    appendDealHoles(draft, [a, b]);
    entryStep.value = "actions";
    markFurthest("actions");
    amountDraft.value = "";
    const seat = findNextActorSeat(draft);
    if (seat != null) {
      amountDraft.value = String(defaultRaiseToAmount(draft, seat));
    }
  }

  /** 点座位行 → 选 Hero；选完自动下一步 */
  function selectHeroSeat(seat: number) {
    if (phase.value !== "entry") return;
    if (entryStep.value !== "hero_seat" && entryStep.value !== "hero_cards") {
      return;
    }
    // 仅在座位/手牌步允许改座位；在手牌步改座位也允许
    if (entryStep.value !== "hero_seat" && entryStep.value !== "hero_cards") {
      return;
    }
    if (seat < 0 || seat >= REVIEW_SEAT_COUNT) return;
    draft.heroSeatIndex = seat;
    heroSeatChosen.value = true;
    if (entryStep.value === "hero_seat") {
      // 一步完整 → 自动下一步；若在回改则跳最远
      markFurthest("hero_seat");
      jumpAfterEditComplete();
    }
  }

  function openCardPicker(seat: number) {
    if (phase.value !== "entry") return;
    if (entryStep.value !== "hero_seat" && entryStep.value !== "hero_cards") {
      return;
    }
    if (seat < 0 || seat >= REVIEW_SEAT_COUNT) return;
    draft.heroSeatIndex = seat;
    heroSeatChosen.value = true;
    if (entryStep.value === "hero_seat") {
      markFurthest("hero_seat");
      entryStep.value = "hero_cards";
      markFurthest("hero_cards");
    }
    cardPickerMode.value = "hole";
    cardPickerVisible.value = true;
  }

  function enterShowdownPhase() {
    if (!shouldEnterShowdown(draft)) return;
    entryStep.value = "showdown";
    markFurthest("showdown");
    cardPickerVisible.value = false;
  }

  /** 点对手手牌区 → 仅摊牌阶段可录入 */
  function openShowdownPicker(seat: number) {
    if (phase.value !== "entry" || entryStep.value !== "showdown") return;
    if (!hasDealtHoles(draft)) return;
    if (seat === draft.heroSeatIndex) return;
    if (seat < 0 || seat >= REVIEW_SEAT_COUNT) return;
    const folded = snapshot.value?.folded[seat] ?? false;
    if (folded) {
      uni.showToast({ title: "已弃牌座位无需摊牌", icon: "none" });
      return;
    }
    pendingShowdownSeat.value = seat;
    const existing = snapshot.value?.holes[seat];
    pendingShowdownCards.value = [
      existing?.[0] ?? null,
      existing?.[1] ?? null,
    ];
    cardPickerMode.value = "showdown";
    cardPickerVisible.value = true;
  }

  function openBoardPicker() {
    if (phase.value !== "entry" || entryStep.value !== "actions") return;
    const next = nextStreetToDeal.value;
    if (!next) {
      uni.showToast({ title: "当前无法进入下一街", icon: "none" });
      return;
    }
    const need = boardCardsNeeded(next);
    pendingBoardStreet.value = next;
    pendingBoardCards.value = Array.from({ length: need }, () => null);
    cardPickerMode.value = "board";
    cardPickerVisible.value = true;
  }

  function closeCardPicker() {
    cardPickerVisible.value = false;
    if (cardPickerMode.value === "board") {
      pendingBoardCards.value = [];
      pendingBoardStreet.value = null;
    }
    if (cardPickerMode.value === "showdown") {
      pendingShowdownSeat.value = null;
      pendingShowdownCards.value = [null, null];
    }
  }

  function pickHeroCard(code: string) {
    if (!cardPickerVisible.value || cardPickerMode.value !== "hole") return;
    const pending = pendingHeroCards.value;
    if (usedCardCodes.value.has(code) && !pending.includes(code)) return;

    const [c0, c1] = pending;
    if (code === c0) {
      pendingHeroCards.value = [null, c1];
      return;
    }
    if (code === c1) {
      pendingHeroCards.value = [c0, null];
      return;
    }
    if (!c0) {
      pendingHeroCards.value = [code, c1];
      return;
    }
    if (!c1) {
      pendingHeroCards.value = [c0, code];
      cardPickerVisible.value = false;
      markFurthest("hero_cards");
      jumpAfterEditComplete();
      return;
    }
    pendingHeroCards.value = [c0, code];
  }

  function pickShowdownCard(code: string) {
    if (!cardPickerVisible.value || cardPickerMode.value !== "showdown") return;
    const pending = pendingShowdownCards.value;
    if (usedCardCodes.value.has(code) && !pending.includes(code)) return;

    const [c0, c1] = pending;
    if (code === c0) {
      pendingShowdownCards.value = [null, c1];
      return;
    }
    if (code === c1) {
      pendingShowdownCards.value = [c0, null];
      return;
    }
    if (!c0) {
      pendingShowdownCards.value = [code, c1];
      return;
    }
    if (!c1) {
      pendingShowdownCards.value = [c0, code];
      confirmShowdownPicker();
      return;
    }
    pendingShowdownCards.value = [c0, code];
  }

  function pickBoardCard(code: string) {
    if (!cardPickerVisible.value || cardPickerMode.value !== "board") return;
    const slots = [...pendingBoardCards.value];
    const existing = slots.indexOf(code);
    if (existing >= 0) {
      slots[existing] = null;
      pendingBoardCards.value = slots;
      return;
    }
    if (usedCardCodes.value.has(code)) return;
    const empty = slots.findIndex((c) => !c);
    if (empty < 0) {
      slots[slots.length - 1] = code;
      pendingBoardCards.value = slots;
      return;
    }
    slots[empty] = code;
    pendingBoardCards.value = slots;
    if (slots.every((c) => Boolean(c))) {
      confirmBoardPicker();
    }
  }

  function clearHeroCard(slot: 0 | 1) {
    const next = [...pendingHeroCards.value] as [string | null, string | null];
    next[slot] = null;
    pendingHeroCards.value = next;
  }

  function clearShowdownCard(slot: 0 | 1) {
    const next = [...pendingShowdownCards.value] as [
      string | null,
      string | null,
    ];
    next[slot] = null;
    pendingShowdownCards.value = next;
  }

  function clearBoardCard(slot: number) {
    const slots = [...pendingBoardCards.value];
    if (slot < 0 || slot >= slots.length) return;
    slots[slot] = null;
    pendingBoardCards.value = slots;
  }

  function confirmCardPicker() {
    if (cardPickerMode.value === "board") {
      confirmBoardPicker();
      return;
    }
    if (cardPickerMode.value === "showdown") {
      confirmShowdownPicker();
      return;
    }
    if (!heroCardsReady.value) {
      uni.showToast({ title: "请选两张手牌", icon: "none" });
      return;
    }
    cardPickerVisible.value = false;
    markFurthest("hero_cards");
    jumpAfterEditComplete();
  }

  function confirmShowdownPicker() {
    const seat = pendingShowdownSeat.value;
    const [a, b] = pendingShowdownCards.value;
    if (seat == null || !a || !b) {
      uni.showToast({ title: "请选两张摊牌", icon: "none" });
      return;
    }
    appendShowdownHole(draft, seat, [a, b]);
    pendingShowdownSeat.value = null;
    pendingShowdownCards.value = [null, null];
    cardPickerVisible.value = false;
  }

  function confirmBoardPicker() {
    const street = pendingBoardStreet.value;
    if (!street) return;
    const need = boardCardsNeeded(street);
    const codes = pendingBoardCards.value.filter(Boolean) as string[];
    if (codes.length < need) {
      uni.showToast({
        title: `请选满 ${need} 张公牌`,
        icon: "none",
      });
      return;
    }
    appendDealBoard(draft, street, codes);
    pendingBoardCards.value = [];
    pendingBoardStreet.value = null;
    cardPickerVisible.value = false;
    amountDraft.value = "";
    const seat = findNextActorSeat(draft);
    if (seat != null) {
      amountDraft.value = String(defaultRaiseToAmount(draft, seat));
    }
  }

  function pickCard(code: string) {
    if (cardPickerMode.value === "board") pickBoardCard(code);
    else if (cardPickerMode.value === "showdown") pickShowdownCard(code);
    else pickHeroCard(code);
  }

  function goPrevStep() {
    if (!canGoPrev.value) return;
    cardPickerVisible.value = false;
    if (entryStep.value === "showdown") {
      entryStep.value = "actions";
      return;
    }
    if (entryStep.value === "actions") {
      // 只退回「选手牌」步骤，保留已录时间线；改牌确认后才会重发清空
      const dealt = heroHoleFromDraft();
      if (dealt[0] && dealt[1]) {
        pendingHeroCards.value = dealt;
      }
      entryStep.value = "hero_cards";
      return;
    }
    if (entryStep.value === "hero_cards") {
      entryStep.value = "hero_seat";
    }
  }

  function goNextStep() {
    if (entryStep.value === "actions") {
      if (canAdvanceToNextStreet(draft)) {
        openBoardPicker();
        return;
      }
      if (shouldEnterShowdown(draft)) {
        enterShowdownPhase();
        return;
      }
      uni.showToast({ title: "当前无法进入下一步", icon: "none" });
      return;
    }
    if (!canGoNext.value) {
      if (entryStep.value === "hero_seat" && !heroSeatChosen.value) {
        uni.showToast({ title: "请先选择 Hero 座位", icon: "none" });
      } else if (entryStep.value === "hero_cards" && !heroCardsReady.value) {
        uni.showToast({ title: "请先选两张手牌", icon: "none" });
      }
      return;
    }
    if (entryStep.value === "hero_seat") {
      markFurthest("hero_seat");
      jumpAfterEditComplete();
      return;
    }
    if (entryStep.value === "hero_cards") {
      markFurthest("hero_cards");
      jumpAfterEditComplete();
    }
  }

  function submitAction(kind: ReviewActionKind) {
    const seat = nextActorSeat.value;
    if (seat == null) return;
    const legal = listLegalEntryActions(draft, seat).find(
      (x) => x.kind === kind,
    );
    if (!legal) return;
    let chips = legal.chips;
    if (legal.needsAmount) {
      const raw = amountDraft.value.trim();
      const n = raw ? Number(raw) : defaultRaiseToAmount(draft, seat);
      if (!Number.isFinite(n) || n <= 0) {
        uni.showToast({ title: "请输入有效筹码", icon: "none" });
        return;
      }
      chips = Math.round(n);
    }
    appendPlayerAction(draft, seat, kind, chips);
    amountDraft.value = "";
    if (nextActorSeat.value != null) {
      amountDraft.value = String(
        defaultRaiseToAmount(draft, nextActorSeat.value),
      );
      return;
    }
    if (canAdvanceToNextStreet(draft)) {
      openBoardPicker();
      return;
    }
    if (shouldEnterShowdown(draft)) {
      enterShowdownPhase();
    }
  }

  function prepareAmountFor(kind: ReviewActionKind) {
    const seat = nextActorSeat.value;
    if (seat == null) return;
    if ((kind === "bet" || kind === "raise") && !amountDraft.value.trim()) {
      amountDraft.value = String(defaultRaiseToAmount(draft, seat));
    }
  }

  function undoLastAction() {
    if (entryStep.value !== "actions") return;
    const last = draft.byAction[draft.byAction.length - 1];
    if (!last) return;
    const a = (last.action || "").toLowerCase();
    // 不撤发牌/盲注，那些靠上一步
    if (
      a === "deal_hole" ||
      a === "post" ||
      a === "sb" ||
      a === "bb"
    ) {
      return;
    }
    undoLastEntryEvent(draft);
  }

  function requestReset() {
    uni.showModal({
      title: "确认重置",
      content: "将清空当前录入的座位、手牌与行动，确定吗？",
      confirmText: "重置",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) restartEntry();
      },
    });
  }

  function restartEntry() {
    Object.assign(draft, createEmptyDraft());
    pendingHeroCards.value = [null, null];
    pendingBoardCards.value = [];
    pendingBoardStreet.value = null;
    pendingShowdownSeat.value = null;
    pendingShowdownCards.value = [null, null];
    amountDraft.value = "";
    entryStep.value = "hero_seat";
    furthestStep.value = "hero_seat";
    heroSeatChosen.value = false;
    phase.value = "entry";
    reviews.value = [];
    reviewCursor.value = 0;
    analyzeWarnings.value = [];
    errorMessage.value = "";
    cardPickerVisible.value = false;
    cardPickerMode.value = "hole";
  }

  function applyParsedPhhDraft(res: ReviewParsePhhResponse) {
    const stacks = Array.isArray(res.starting_stacks)
      ? res.starting_stacks.map((x) => Number(x) || 0)
      : [...draft.startingStacks];
    while (stacks.length < REVIEW_SEAT_COUNT) stacks.push(0);
    const blinds = Array.isArray(res.blinds_or_straddles)
      ? res.blinds_or_straddles.map((x) => Number(x) || 0)
      : [...draft.blindsOrStraddles];
    while (blinds.length < REVIEW_SEAT_COUNT) blinds.push(0);

    draft.heroSeatIndex = Math.max(
      0,
      Math.min(REVIEW_SEAT_COUNT - 1, Number(res.hero_seat_index) || 0),
    );
    draft.startingStacks = stacks.slice(0, REVIEW_SEAT_COUNT);
    draft.blindsOrStraddles = blinds.slice(0, REVIEW_SEAT_COUNT);
    draft.byAction = Array.isArray(res.by_action)
      ? res.by_action.map((e) => ({ ...e }))
      : [];

    heroSeatChosen.value = true;
    pendingHeroCards.value = [null, null];
    pendingBoardCards.value = [];
    pendingBoardStreet.value = null;
    pendingShowdownSeat.value = null;
    pendingShowdownCards.value = [null, null];
    amountDraft.value = "";
    phase.value = "entry";
    reviews.value = [];
    reviewCursor.value = 0;
    analyzeWarnings.value = [];
    errorMessage.value = "";
    cardPickerVisible.value = false;

    if (shouldEnterShowdown(draft) || draft.byAction.some((e) => e.action === "showdown")) {
      entryStep.value = "showdown";
      furthestStep.value = "showdown";
    } else if (hasDealtHoles(draft)) {
      entryStep.value = "actions";
      furthestStep.value = "actions";
    } else {
      entryStep.value = "hero_cards";
      furthestStep.value = "hero_cards";
    }
  }

  /** 粘贴 PHH 文本灌入录入草稿；成功返回 true */
  function importFromPhh(phhText: string): Promise<boolean> {
    const text = (phhText || "").trim();
    if (!text) {
      uni.showToast({ title: "请粘贴 PHH 文本", icon: "none" });
      return Promise.resolve(false);
    }
    loading.value = true;
    errorMessage.value = "";
    return new Promise((resolve) => {
      uni.request({
        url: getReviewParsePhhApiUrl(),
        method: "POST",
        data: { phh_text: text },
        timeout: 60000,
        success: (res) => {
          const body = res.data as ReviewParsePhhResponse & {
            detail?: string;
          };
          if (res.statusCode >= 200 && res.statusCode < 300 && body?.by_action) {
            applyParsedPhhDraft(body);
            const warns = Array.isArray(body.warnings) ? body.warnings : [];
            if (warns.length) {
              uni.showToast({
                title: warns[0].slice(0, 40),
                icon: "none",
                duration: 2800,
              });
            } else {
              uni.showToast({ title: "已导入牌谱", icon: "success" });
            }
            resolve(true);
          } else {
            const detail =
              typeof body?.detail === "string"
                ? body.detail
                : `解析失败 HTTP ${res.statusCode ?? "?"}`;
            errorMessage.value = detail;
            uni.showToast({ title: detail.slice(0, 40), icon: "none" });
            resolve(false);
          }
        },
        fail: (err) => {
          const msg =
            err && typeof err === "object" && "errMsg" in err
              ? String((err as { errMsg?: string }).errMsg ?? "网络错误")
              : "网络错误";
          errorMessage.value = msg;
          uni.showToast({ title: msg, icon: "none" });
          resolve(false);
        },
        complete: () => {
          loading.value = false;
        },
      });
    });
  }

  function buildRequest(): ReviewAnalyzeRequest {
    return {
      hero_seat_index: draft.heroSeatIndex,
      starting_stacks: [...draft.startingStacks],
      blinds_or_straddles: [...draft.blindsOrStraddles],
      by_action: draft.byAction.map((e) => ({ ...e })),
    };
  }

  function parseAnalyzeResponseBody(data: unknown): ReviewAnalyzeResponse | null {
    if (data == null) return null;
    let body: unknown = data;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return null;
      }
    }
    if (typeof body !== "object" || body === null) return null;
    const reviews = (body as ReviewAnalyzeResponse).reviews;
    if (!Array.isArray(reviews) || reviews.length === 0) return null;
    return body as ReviewAnalyzeResponse;
  }

  function applyAnalyzeResponse(res: ReviewAnalyzeResponse) {
    const list = Array.isArray(res.reviews) ? res.reviews : [];
    if (!list.length) {
      errorMessage.value = "分析结果为空，请重试或按产物 ID 加载";
      uni.showToast({ title: errorMessage.value, icon: "none", duration: 2800 });
      return;
    }
    reviews.value = list;
    analyzeWarnings.value = Array.isArray(res.warnings) ? res.warnings : [];
    reviewCursor.value = 0;
    phase.value = "reviewing";
    errorMessage.value = "";
    const hasBal = reviews.value.some((r) => (r.balance?.notes?.length ?? 0) > 0);
    if (hasBal) {
      uni.showToast({ title: "已加载点评（含平衡视角）", icon: "none", duration: 1500 });
    } else {
      uni.showToast({ title: "已加载点评", icon: "success", duration: 1200 });
    }
  }

  function requestReviewJson(
    url: string,
    options: { method: "GET" | "POST"; data?: ReviewAnalyzeRequest },
  ): Promise<ReviewAnalyzeResponse> {
    return new Promise((resolve, reject) => {
      uni.request({
        url,
        method: options.method,
        data: options.data,
        header:
          options.method === "POST"
            ? { "Content-Type": "application/json" }
            : undefined,
        timeout: REVIEW_ANALYZE_TIMEOUT_MS,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const body = parseAnalyzeResponseBody(res.data);
            if (body) {
              resolve(body);
              return;
            }
            reject(new Error(`分析结果无效 HTTP ${res.statusCode ?? "?"}`));
            return;
          }
          reject(new Error(`分析失败 HTTP ${res.statusCode ?? "?"}`));
        },
        fail: (err) => {
          const msg =
            err && typeof err === "object" && "errMsg" in err
              ? String((err as { errMsg?: string }).errMsg ?? "网络错误")
              : "网络错误";
          reject(new Error(msg));
        },
      });
    });
  }

  function startReview(): void {
    if (!canStartReview.value) {
      uni.showToast({
        title: "请先录完 Hero 至少一次行动",
        icon: "none",
        duration: 2200,
      });
      return;
    }
    if (useMock) {
      applyAnalyzeResponse(buildMockAnalyzeResponse(draft));
      return;
    }
    loading.value = true;
    errorMessage.value = "";
    requestReviewJson(getReviewAnalyzeApiUrl(), {
      method: "POST",
      data: buildRequest(),
    })
      .then((body) => {
        applyAnalyzeResponse(body);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "网络错误";
        const timedOut = /timeout|超时/i.test(msg);
        errorMessage.value = timedOut
          ? "分析超时（本手可能需 4～5 分钟）。若服务端已完成，可用产物 ID 加载结果。"
          : msg;
        uni.showToast({
          title: timedOut ? "分析超时，可尝试加载产物" : msg.slice(0, 40),
          icon: "none",
          duration: timedOut ? 3200 : 2200,
        });
      })
      .finally(() => {
        loading.value = false;
      });
  }

  function loadReviewArtifact(artifactId: string): Promise<boolean> {
    const id = (artifactId || "").trim();
    if (!id) {
      uni.showToast({ title: "请输入产物 ID", icon: "none" });
      return Promise.resolve(false);
    }
    loading.value = true;
    errorMessage.value = "";
    return requestReviewJson(getReviewArtifactApiUrl(id), { method: "GET" })
      .then((body) => {
        applyAnalyzeResponse(body);
        return true;
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "加载失败";
        errorMessage.value = msg;
        uni.showToast({ title: msg.slice(0, 40), icon: "none" });
        return false;
      })
      .finally(() => {
        loading.value = false;
      });
  }

  function goPrevDecision() {
    if (!hasPrevDecision.value) return;
    reviewCursor.value -= 1;
  }

  function goNextDecision() {
    if (!hasNextDecision.value) return;
    reviewCursor.value += 1;
  }

  function backToEntry() {
    phase.value = "entry";
    reviews.value = [];
    reviewCursor.value = 0;
    analyzeWarnings.value = [];
    errorMessage.value = "";
    if (furthestStep.value === "showdown" || entryStep.value === "showdown") {
      entryStep.value = "showdown";
    } else if (hasDealtHoles(draft)) {
      entryStep.value = "actions";
    } else {
      entryStep.value = "hero_seat";
    }
  }

  return {
    phase,
    entryStep,
    furthestStep,
    draft,
    pendingHeroCards,
    heroSeatChosen,
    amountDraft,
    loading,
    errorMessage,
    reviews,
    reviewCursor,
    analyzeWarnings,
    heroDecisionIndices,
    heroCardsReady,
    canGoPrev,
    canGoNext,
    canEnterShowdown,
    canStartReview,
    streetComplete,
    nextStreetToDeal,
    nextStreetLabel,
    currentReview,
    hasPrevDecision,
    hasNextDecision,
    snapshot,
    tablePlayers,
    blindsLevelText,
    streetZh,
    stepHeadline,
    nextActorSeat,
    legalActions,
    usedCardCodes,
    cardPickerVisible,
    cardPickerMode,
    pickerSuit,
    pendingBoardCards,
    pendingBoardStreet,
    pendingShowdownSeat,
    pendingShowdownCards,
    showdownCardsReady,
    selectHeroSeat,
    openCardPicker,
    openShowdownPicker,
    openBoardPicker,
    enterShowdownPhase,
    closeCardPicker,
    pickCard,
    pickHeroCard,
    clearHeroCard,
    clearShowdownCard,
    clearBoardCard,
    confirmCardPicker,
    goPrevStep,
    goNextStep,
    submitAction,
    prepareAmountFor,
    undoLastAction,
    requestReset,
    restartEntry,
    importFromPhh,
    startReview,
    loadReviewArtifact,
    goPrevDecision,
    goNextDecision,
    backToEntry,
    buildRequest,
  };
}
