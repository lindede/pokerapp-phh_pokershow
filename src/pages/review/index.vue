<template>
  <view class="page-root">
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="false">
      <view class="page-inner">
        <view class="panel panel-board">
          <view class="board-row">
            <view class="board-pot-col">
              <view class="pot-bar">
                <text class="pot-text">底池 {{ displayPot }}</text>
              </view>
              <text v-if="blindsLevelText" class="blinds-level">{{
                blindsLevelText
              }}</text>
              <text v-if="bbRealAnchorText" class="bb-real-anchor">{{
                bbRealAnchorText
              }}</text>
            </view>
            <view class="community-row">
              <PokerCard
                v-for="(c, idx) in boardSlots"
                :key="'b-' + idx"
                :code="c"
                size="lg"
              />
            </view>
          </view>
        </view>

        <view class="panel panel-players">
          <view
            v-for="p in tablePlayers"
            :key="p.id"
            class="player-card"
            :class="{
              focus: p.isFocus,
              'replay-folded': p.folded,
              'player-card--hero': p.isHero,
            }"
            @tap="onTapRow(p.seatIndex)"
          >
            <view class="player-top player-top--trail-row">
              <view class="player-info">
                <view class="title-line">
                  <view
                    class="pos-badge"
                    :class="`pos-badge--${p.positionKey}`"
                  >
                    <text class="pos-badge-txt">{{ p.positionLabel }}</text>
                  </view>
                  <text class="p-name">{{ p.name }}</text>
                </view>
                <view class="p-meta-line">
                  <view class="p-meta-group">
                    <view class="p-chip-ico p-chip-ico--stack" aria-hidden="true"></view>
                    <text class="p-meta-val">{{ p.stack }}</text>
                  </view>
                  <text class="p-meta-sep">·</text>
                  <view class="p-meta-group">
                    <view class="p-chip-ico p-chip-ico--bet" aria-hidden="true"></view>
                    <text
                      class="p-bet-inline p-meta-val"
                      :class="{ 'bet-on': p.bet > 0 }"
                      >{{ p.bet }}</text
                    >
                  </view>
                </view>
              </view>
              <view
                class="player-action-trail player-action-trail--street"
                :class="`player-action-trail--street-cols-${actionTrailStreetColumns.length}`"
              >
                <view
                  class="action-trail-street-grid"
                  :style="actionTrailStreetGridStyle"
                >
                  <view
                    v-for="stCol in actionTrailStreetColumns"
                    :key="'stcol-' + p.id + '-' + stCol"
                    class="action-trail-street-col"
                  >
                    <view
                      v-for="(item, ti) in actionTrailByStreet(p, stCol)"
                      :key="'at-' + p.id + '-' + stCol + '-' + ti"
                      class="action-trail-item action-trail-item--stacked"
                    >
                      <text class="action-trail-label">{{ item.labelZh }}</text>
                      <text v-if="item.chipsLine" class="action-trail-chips">{{
                        item.chipsLine
                      }}</text>
                    </view>
                  </view>
                </view>
              </view>
              <view class="player-cards-block" @tap.stop="onTapHole(p.seatIndex)">
                <view class="hole-row">
                  <PokerCard :code="p.hole[0]" size="lg" />
                  <PokerCard :code="p.hole[1]" size="lg" />
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="panel panel-narration panel-work">
          <template v-if="phase === 'reviewing'">
            <view class="nar-head-row">
              <view
                class="nar-step-hit"
                :class="{ 'nar-step-hit--disabled': !hasPrevDecision }"
                @tap.stop="goPrevDecision"
              >
                <text class="nar-step-glyph">‹</text>
              </view>
              <view class="nar-head-center-wrap">
                <text class="nar-head nar-head-center nar-head-inline">{{
                  stepHeadline
                }}</text>
              </view>
              <view
                class="nar-step-hit"
                :class="{ 'nar-step-hit--disabled': !hasNextDecision }"
                @tap.stop="goNextDecision"
              >
                <text class="nar-step-glyph">›</text>
              </view>
            </view>
          </template>
          <text v-else class="work-head">{{ stepHeadline }}</text>
          <text v-if="errorMessage" class="warn-line">{{ errorMessage }}</text>

          <view class="nar-body-wrap">
          <template v-if="phase === 'entry' && entryStep === 'hero_seat'">
            <text class="work-body">点击列表行选择 Hero 座位，选完自动进入选手牌。</text>
            <view class="street-advance" :class="{ 'street-advance--busy': loading }" @tap="openPastePhh">
              <text class="street-advance-txt">粘贴 PHH 导入</text>
            </view>
          </template>

          <template v-else-if="phase === 'entry' && entryStep === 'hero_cards'">
            <text class="work-body"
              >点击右侧手牌弹出选牌；两张选齐后自动发牌并进入下注。也可用「下一步」。</text
            >
          </template>

          <template v-else-if="phase === 'entry' && entryStep === 'actions'">
            <template v-if="nextActorSeat != null">
              <view class="amount-row">
                <text class="amount-label">金额</text>
                <input
                  class="amount-input"
                  type="number"
                  v-model="amountDraft"
                  placeholder="下注/加注筹码"
                />
              </view>
              <view class="action-grid">
                <view
                  v-for="act in legalActions"
                  :key="act.kind"
                  class="action-btn"
                  :class="`action-btn--${act.kind}`"
                  @tap="onActionTap(act.kind)"
                >
                  <text>{{ act.label }}</text>
                </view>
              </view>
            </template>
            <template v-else-if="nextStreetToDeal">
              <text class="work-body"
                >本街行动已齐。点「发{{ nextStreetLabel }}」或「下一步」选择公牌进入下一街。</text
              >
              <view class="street-advance" @tap="openBoardPicker">
                <text class="street-advance-txt"
                  >发{{ nextStreetLabel }}（选{{
                    nextStreetToDeal === "flop" ? 3 : 1
                  }}张）</text
                >
              </view>
            </template>
            <template v-else-if="canEnterShowdown">
              <text class="work-body"
                >全部街已结束。进入摊牌阶段后，才能点对手手牌录入。</text
              >
              <view class="street-advance" @tap="enterShowdownPhase">
                <text class="street-advance-txt">进入摊牌</text>
              </view>
            </template>
            <text v-else class="work-body">本手结束（无人摊牌），可开始复盘。</text>
          </template>

          <template v-else-if="phase === 'entry' && entryStep === 'showdown'">
            <text class="work-body"
              >摊牌阶段：点击未弃牌对手的手牌区，录入其亮出的两张牌。已有 Hero 决策时可随时点开始复盘。</text
            >
          </template>

          <template v-else-if="phase === 'reviewing' && !reviews.length">
            <text class="nar-body nar-muted">点评未加载。</text>
          </template>

          <template v-else-if="phase === 'reviewing' && currentReview">
            <view class="review-head-row">
              <text
                v-if="currentReview.kind !== 'summary'"
                class="verdict-pill"
                :class="`verdict-pill--${currentReview.verdict}`"
                >{{ verdictZh(currentReview.verdict) }}</text
              >
              <text v-else class="review-progress">整手总结</text>
            </view>
            <text v-if="analyzeWarnings.length" class="warn-line">{{
              analyzeWarnings.join("；")
            }}</text>
            <template v-if="currentReview.kind === 'summary'">
              <text
                v-if="currentReview.outcome_zh"
                class="nar-body"
                >{{ currentReview.outcome_zh }}</text
              >
              <text
                v-if="currentReview.opponent_shown"
                class="nar-body"
                >对手亮牌 {{ currentReview.opponent_shown }}</text
              >
            </template>
            <template v-else>
              <text class="nar-body"
                >实际 {{ currentReview.actual.label }}</text
              >
              <text class="nar-body nar-rec"
                >推荐 {{ currentReview.recommend.label }}</text
              >
              <view v-if="currentReview.options?.length" class="options-row">
                <text
                  v-for="(opt, i) in currentReview.options"
                  :key="'opt-' + i"
                  class="option-pill"
                  :class="{
                    'option-pill--rec':
                      opt.label === currentReview.recommend.label,
                  }"
                  >{{ opt.label }}</text
                >
              </view>
            </template>
            <text
              v-for="(r, i) in currentReview.reasons"
              :key="'reason-' + i"
              class="nar-body"
              >{{ r }}</text
            >
            <view v-if="currentReview.balance?.notes?.length" class="balance-block">
              <text class="balance-head">平衡视角（混合 / 诈唬）</text>
              <text
                v-if="currentReview.balance.alt?.label"
                class="nar-body"
                >混合可选 {{ currentReview.balance.alt.label }}</text
              >
              <text
                v-for="(b, j) in currentReview.balance.notes"
                :key="'bal-' + j"
                class="nar-body"
                >{{ b }}</text
              >
            </view>
          </template>

          <template v-else-if="phase === 'reviewing'">
            <text class="nar-body">{{
              replayActionSummary || "此步无行动摘要"
            }}</text>
          </template>
          </view>
        </view>

        <view class="scroll-pad"></view>
      </view>
    </scroll-view>

    <!-- 粘贴 PHH（与选牌同一套底部绿 sheet） -->
    <view
      v-if="pastePhhVisible"
      class="picker-mask"
      @tap="closePastePhh"
    >
      <view class="picker-sheet paste-phh-sheet" @tap.stop>
        <view class="picker-top">
          <text class="picker-title">粘贴 PHH / PHHS</text>
          <text class="picker-close" @tap="closePastePhh">关闭</text>
        </view>
        <text class="paste-phh-hint"
          >粘贴整段牌谱文本（含 actions、players、blinds…），导入后可再微调并开始复盘。</text
        >
        <textarea
          class="paste-phh-area"
          v-model="pastePhhText"
          placeholder="粘贴 PHH 全文，例如 hero_seat = 1 ..."
          :maxlength="-1"
        />
        <button
          class="picker-confirm"
          :disabled="loading || !pastePhhText.trim()"
          :loading="loading"
          @tap="confirmPastePhh"
        >
          导入牌谱
        </button>
      </view>
    </view>

    <view
      v-if="cardPickerVisible"
      class="picker-mask"
      @tap="closeCardPicker"
    >
      <view class="picker-sheet" @tap.stop>
        <view class="picker-top">
          <text class="picker-title">{{ pickerTitle }}</text>
          <text class="picker-close" @tap="closeCardPicker">关闭</text>
        </view>

        <view class="picker-slots">
          <template v-if="cardPickerMode === 'hole'">
            <view class="picker-slot" @tap="clearHeroCard(0)">
              <PokerCard :code="pendingHeroCards[0]" size="lg" />
            </view>
            <view class="picker-slot" @tap="clearHeroCard(1)">
              <PokerCard :code="pendingHeroCards[1]" size="lg" />
            </view>
          </template>
          <template v-else-if="cardPickerMode === 'showdown'">
            <view class="picker-slot" @tap="clearShowdownCard(0)">
              <PokerCard :code="pendingShowdownCards[0]" size="lg" />
            </view>
            <view class="picker-slot" @tap="clearShowdownCard(1)">
              <PokerCard :code="pendingShowdownCards[1]" size="lg" />
            </view>
          </template>
          <template v-else>
            <view
              v-for="(c, i) in pendingBoardCards"
              :key="'pb-' + i"
              class="picker-slot"
              @tap="clearBoardCard(i)"
            >
              <PokerCard :code="c" size="lg" />
            </view>
          </template>
          <text class="picker-slot-hint">再点已选牌可取消</text>
        </view>

        <view class="suit-tabs">
          <view
            v-for="s in suits"
            :key="s.key"
            class="suit-tab"
            :class="{ on: pickerSuit === s.key, red: s.red }"
            @tap="pickerSuit = s.key"
          >
            <text>{{ s.label }}</text>
          </view>
        </view>

        <view class="rank-grid">
          <view
            v-for="rank in ranks"
            :key="pickerSuit + rank"
            class="rank-cell"
            :class="{
              red: currentSuitRed,
              used: isRankUsed(rank),
              on: isRankPicked(rank),
            }"
            @tap="onPickRank(rank)"
          >
            <text class="rank-cell-txt">{{ rank }}</text>
          </view>
        </view>

        <button
          class="picker-confirm"
          :disabled="!pickerConfirmReady"
          @tap="confirmCardPicker"
        >
          确定
        </button>
      </view>
    </view>

    <AppTabBar active="review">
      <template v-if="phase === 'entry'">
        <view class="dock-row">
          <button class="dock-btn dock-btn--ghost" @tap="requestReset">
            重置
          </button>
          <button
            class="dock-btn dock-btn--ghost"
            :disabled="!canGoPrev"
            @tap="goPrevStep"
          >
            上一步
          </button>
          <button
            v-if="
              entryStep === 'hero_seat' ||
              entryStep === 'hero_cards' ||
              (entryStep === 'actions' && (nextStreetToDeal || canEnterShowdown))
            "
            class="dock-btn dock-btn--primary"
            :disabled="!canGoNext"
            @tap="goNextStep"
          >
            {{
              entryStep === "actions" && nextStreetToDeal
                ? `发${nextStreetLabel}`
                : entryStep === "actions" && canEnterShowdown
                  ? "进入摊牌"
                  : "下一步"
            }}
          </button>
          <button
            v-else
            class="dock-btn dock-btn--primary"
            :disabled="!canStartReview"
            :loading="loading"
            @tap="startReview"
          >
            开始复盘
          </button>
        </view>
        <button
          v-if="entryStep === 'actions'"
          class="dock-btn dock-btn--secondary"
          @tap="undoLastAction"
        >
          撤销上一行动
        </button>
      </template>
      <view v-else class="dock-review-bar">
        <text class="dock-back-link" @tap="backToEntry">← 返回录入</text>
      </view>
    </AppTabBar>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppTabBar from "@/components/AppTabBar.vue";
import PokerCard from "@/components/PokerCard.vue";
import { useHandReview } from "@/composables/useHandReview";
import type { ReplayActionTrailItem, Street } from "@/types/commentary";
import type { ReviewActionKind, ReviewVerdict } from "@/types/review";
import {
  CARD_RANKS,
  CARD_SUITS,
  deriveEntryTableState,
  seatLabelZh,
} from "@/utils/reviewEntry";

const ACTION_TRAIL_STREET_ORDER: Street[] = [
  "preflop",
  "flop",
  "turn",
  "river",
];
const ACTION_TRAIL_STREET_GAP_RPX = 6;

const ranks = CARD_RANKS;
const suits = CARD_SUITS;

const pastePhhVisible = ref(false);
const pastePhhText = ref("");

const {
  phase,
  entryStep,
  draft,
  pendingHeroCards,
  pendingBoardCards,
  pendingShowdownCards,
  pendingShowdownSeat,
  amountDraft,
  loading,
  errorMessage,
  reviews,
  analyzeWarnings,
  heroCardsReady,
  showdownCardsReady,
  canGoPrev,
  canGoNext,
  canStartReview,
  canEnterShowdown,
  nextStreetToDeal,
  nextStreetLabel,
  currentReview,
  hasPrevDecision,
  hasNextDecision,
  snapshot,
  tablePlayers,
  blindsLevelText,
  bbRealAnchorText,
  stepHeadline,
  replayActionSummary,
  nextActorSeat,
  legalActions,
  usedCardCodes,
  cardPickerVisible,
  cardPickerMode,
  pickerSuit,
  selectHeroSeat,
  openCardPicker,
  openShowdownPicker,
  openBoardPicker,
  enterShowdownPhase,
  closeCardPicker,
  pickCard,
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
  importFromPhh,
  startReview,
  loadReviewHand,
  goPrevDecision,
  goNextDecision,
  backToEntry,
} = useHandReview({ useMock: false });

function openPastePhh() {
  pastePhhVisible.value = true;
}

function closePastePhh() {
  pastePhhVisible.value = false;
}

async function confirmPastePhh() {
  const ok = await importFromPhh(pastePhhText.value);
  if (ok) {
    pastePhhVisible.value = false;
    pastePhhText.value = "";
  }
}

onLoad((options) => {
  const artifact = (options?.artifact as string) || "";
  if (artifact) {
    loadReviewHand(artifact);
  }
});

const boardSlots = computed(() => {
  const b = snapshot.value?.board;
  if (!b || b.length < 5) return [null, null, null, null, null];
  return b;
});

const displayPot = computed(() => {
  if (snapshot.value) return snapshot.value.pot;
  return deriveEntryTableState(draft).pot;
});

/** 按当前街推进列数：preflop → +flop → +turn → +river（与讲解页一致） */
const actionTrailStreetColumns = computed((): Street[] => {
  const street = (snapshot.value?.street ?? "preflop") as Street;
  const idx = ACTION_TRAIL_STREET_ORDER.indexOf(street);
  if (idx < 0) return ["preflop"];
  return ACTION_TRAIL_STREET_ORDER.slice(0, idx + 1);
});

function actionTrailStreetColWRpx(colCount: number): number {
  if (colCount <= 2) return 72;
  if (colCount === 3) return 62;
  return 58;
}

function actionTrailGridColumnWidthsRpx(streets: Street[]): number[] {
  const colW = actionTrailStreetColWRpx(streets.length);
  return streets.map(() => colW);
}

function actionTrailGridTotalWidthRpx(colWidths: number[]): number {
  if (colWidths.length === 0) return 0;
  return (
    colWidths.reduce((sum, w) => sum + w, 0) +
    (colWidths.length - 1) * ACTION_TRAIL_STREET_GAP_RPX
  );
}

const actionTrailStreetGridStyle = computed(() => {
  const streets = actionTrailStreetColumns.value;
  const colWidths = actionTrailGridColumnWidthsRpx(streets);
  return {
    width: `${actionTrailGridTotalWidthRpx(colWidths)}rpx`,
    gridTemplateColumns: colWidths.map((w) => `${w}rpx`).join(" "),
    columnGap: `${ACTION_TRAIL_STREET_GAP_RPX}rpx`,
  };
});

function actionTrailByStreet(
  p: { actionTrail: ReplayActionTrailItem[] },
  st: Street,
): ReplayActionTrailItem[] {
  return (p.actionTrail ?? []).filter((x) => (x.street ?? "preflop") === st);
}

const currentSuitRed = computed(() => {
  const s = suits.find((x) => x.key === pickerSuit.value);
  return Boolean(s?.red);
});

const pickerTitle = computed(() => {
  if (cardPickerMode.value === "board") {
    return `发${nextStreetLabel.value} · 选公牌`;
  }
  if (cardPickerMode.value === "showdown") {
    const seat = pendingShowdownSeat.value;
    return seat != null
      ? `${seatLabelZh(seat)} · 摊牌`
      : "对手摊牌";
  }
  return `${seatLabelZh(draft.heroSeatIndex)} · Hero 手牌`;
});

const pickerConfirmReady = computed(() => {
  if (cardPickerMode.value === "board") {
    return (
      pendingBoardCards.value.length > 0 &&
      pendingBoardCards.value.every((c) => Boolean(c))
    );
  }
  if (cardPickerMode.value === "showdown") {
    return showdownCardsReady.value;
  }
  return heroCardsReady.value;
});

function onTapRow(seat: number) {
  if (phase.value !== "entry") return;
  if (entryStep.value === "hero_seat" || entryStep.value === "hero_cards") {
    selectHeroSeat(seat);
  }
}

function onTapHole(seat: number) {
  if (phase.value !== "entry") return;
  if (entryStep.value === "hero_seat" || entryStep.value === "hero_cards") {
    openCardPicker(seat);
    return;
  }
  if (entryStep.value === "showdown") {
    openShowdownPicker(seat);
  }
}

function codeForRank(rank: string) {
  return `${rank}${pickerSuit.value}`;
}

function isRankUsed(rank: string) {
  const code = codeForRank(rank);
  return usedCardCodes.value.has(code) && !isRankPicked(rank);
}

function isRankPicked(rank: string) {
  const code = codeForRank(rank);
  if (cardPickerMode.value === "board") {
    return pendingBoardCards.value.includes(code);
  }
  if (cardPickerMode.value === "showdown") {
    return (
      pendingShowdownCards.value[0] === code ||
      pendingShowdownCards.value[1] === code
    );
  }
  return (
    pendingHeroCards.value[0] === code || pendingHeroCards.value[1] === code
  );
}

function onPickRank(rank: string) {
  if (isRankUsed(rank)) return;
  pickCard(codeForRank(rank));
}

function onActionTap(kind: ReviewActionKind) {
  prepareAmountFor(kind);
  submitAction(kind);
}

function verdictZh(v: ReviewVerdict): string {
  const map: Record<ReviewVerdict, string> = {
    good: "合理",
    acceptable: "可接受",
    suboptimal: "偏弱",
    bad: "错误",
  };
  return map[v] ?? v;
}
</script>

<style scoped lang="scss">
$felt: #0f3d26;
$panel: rgba(255, 255, 255, 0.07);
$panel-border: rgba(255, 255, 255, 0.14);
$pot-yellow: #fbbf24;
// #ifdef H5
$tab-bar-h: 128rpx;
// #endif
// #ifndef H5
$tab-bar-h: 88rpx;
// #endif

.page-root {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: $felt;
  overflow: hidden;
  box-sizing: border-box;
  /* #ifdef MP-WEIXIN */
  min-height: 100vh;
  /* #endif */
}

.page-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.page-inner {
  padding: 16rpx 20rpx 0;
  padding-bottom: calc(200rpx + #{$tab-bar-h} + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.panel {
  background: $panel;
  border: 1rpx solid $panel-border;
  border-radius: 24rpx;
  margin-bottom: 16rpx;
}

.panel-board {
  padding: 16rpx 18rpx;
}

.panel.panel-players {
  padding: 0;
  margin-bottom: 16rpx;
}

.panel.panel-narration,
.panel-work {
  padding: 16rpx 18rpx;
  margin-bottom: 18rpx;
}

.board-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.board-pot-col {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
  flex-shrink: 0;
}

.pot-bar {
  border: 2rpx solid $pot-yellow;
  border-radius: 12rpx;
  padding: 6rpx 14rpx;
  background: rgba(0, 0, 0, 0.18);
}

.pot-text {
  font-size: 24rpx;
  font-weight: 600;
  color: $pot-yellow;
}

.blinds-level {
  font-size: 20rpx;
  font-weight: 600;
  color: rgba(226, 232, 240, 0.88);
  letter-spacing: 0.04em;
  padding-left: 2rpx;
}

.bb-real-anchor {
  font-size: 18rpx;
  font-weight: 500;
  color: rgba(148, 163, 184, 0.92);
  letter-spacing: 0.02em;
  padding-left: 2rpx;
}

.community-row {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: nowrap;
  gap: 14rpx;
}

.community-row :deep(.pc.lg),
.hole-row :deep(.pc.lg),
.picker-slot :deep(.pc.lg) {
  flex: none;
  width: 64rpx;
  height: 90rpx;
  min-width: 64rpx;
  max-width: 64rpx;
}

.player-card {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 0;
  padding: 14rpx 12rpx;
  margin-bottom: 0;
  border: 2rpx solid transparent;
  min-height: 108rpx;
  box-sizing: border-box;
}

.player-card:first-child {
  border-top-left-radius: 12rpx;
  border-top-right-radius: 12rpx;
}

.player-card:last-child {
  border-bottom-left-radius: 12rpx;
  border-bottom-right-radius: 12rpx;
}

.player-card.focus {
  border-color: #facc15;
  box-shadow: 0 0 0 2rpx rgba(250, 204, 21, 0.25);
}

.player-card--hero {
  background: rgba(250, 204, 21, 0.16);
  border-color: rgba(250, 204, 21, 0.32);
}

.player-card--hero.focus {
  background: rgba(250, 204, 21, 0.22);
}

.player-card.replay-folded {
  opacity: 0.52;
}

.player-top {
  display: grid;
  grid-template-columns: 280rpx 200rpx 1fr;
  align-items: center;
  column-gap: 12rpx;
  min-height: 88rpx;
}

.player-top.player-top--trail-row {
  grid-template-columns: 280rpx auto minmax(156rpx, auto);
  column-gap: 8rpx;
}

.player-info {
  width: 280rpx;
  max-width: 280rpx;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8rpx;
  box-sizing: border-box;
}

.title-line {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8rpx;
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}

.pos-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 26rpx;
  padding: 0 6rpx;
  border-radius: 6rpx;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.pos-badge-txt {
  font-size: 15rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1;
  white-space: nowrap;
}

.pos-badge--SB {
  background: rgba(148, 163, 184, 0.32);
  border-color: rgba(203, 213, 225, 0.42);
}
.pos-badge--BB {
  background: rgba(251, 191, 36, 0.22);
  border-color: rgba(251, 191, 36, 0.48);
}
.pos-badge--UTG {
  background: rgba(56, 189, 248, 0.2);
  border-color: rgba(56, 189, 248, 0.45);
}
.pos-badge--MP {
  background: rgba(99, 102, 241, 0.22);
  border-color: rgba(129, 140, 248, 0.45);
}
.pos-badge--CO {
  background: rgba(52, 211, 153, 0.2);
  border-color: rgba(52, 211, 153, 0.45);
}
.pos-badge--BTN {
  background: rgba(250, 204, 21, 0.22);
  border-color: rgba(250, 204, 21, 0.5);
}

.p-name {
  font-size: 24rpx;
  font-weight: 700;
  color: #fff;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-meta-line {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.45;
}

.p-meta-group {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6rpx;
  flex-shrink: 0;
}

.p-chip-ico {
  width: 22rpx;
  height: 22rpx;
  border-radius: 50%;
  border: 2rpx solid rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
  box-sizing: border-box;
}

.p-chip-ico--stack {
  background: linear-gradient(145deg, #6ee7b7 0%, #059669 55%, #047857 100%);
  box-shadow:
    inset 0 1rpx 3rpx rgba(255, 255, 255, 0.4),
    0 1rpx 2rpx rgba(0, 0, 0, 0.2);
}

.p-chip-ico--bet {
  background: linear-gradient(145deg, #fda4af 0%, #e11d48 55%, #9f1239 100%);
  box-shadow:
    inset 0 1rpx 3rpx rgba(255, 255, 255, 0.35),
    0 1rpx 2rpx rgba(0, 0, 0, 0.2);
}

.p-meta-val {
  flex-shrink: 0;
}

.p-meta-sep {
  margin: 0 6rpx;
  color: rgba(255, 255, 255, 0.35);
  flex-shrink: 0;
}

.p-bet-inline {
  color: rgba(255, 255, 255, 0.78);
}

.p-bet-inline.bet-on {
  color: #fde047;
  font-weight: 700;
}

.player-action-trail {
  width: 200rpx;
  max-width: 200rpx;
  min-width: 0;
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  box-sizing: border-box;
}

.player-action-trail.player-action-trail--street {
  width: auto;
  max-width: none;
  justify-self: start;
  align-self: center;
  flex-shrink: 0;
  margin-left: -52rpx;
  margin-right: 20rpx;
}

.player-action-trail--street .action-trail-street-grid {
  display: grid;
  align-items: start;
  box-sizing: border-box;
}

.player-action-trail--street .action-trail-street-col {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4rpx;
  min-width: 0;
}

.action-trail-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  align-self: flex-start;
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  background: #2563eb;
  border-radius: 8rpx;
  padding: 6rpx 12rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.player-action-trail--street .action-trail-street-col .action-trail-item {
  width: 100%;
  padding: 4rpx 4rpx;
  box-sizing: border-box;
}

.player-action-trail--street .action-trail-item.action-trail-item--stacked {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  padding: 4rpx 4rpx;
  box-sizing: border-box;
}

.action-trail-label {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
  line-height: 1.2;
  white-space: nowrap;
  text-align: left;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-action-trail--street .action-trail-item--stacked .action-trail-label {
  display: block;
  width: 100%;
  font-size: 22rpx;
  line-height: 1.15;
  white-space: nowrap;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-trail-chips {
  display: block;
  width: 100%;
  font-size: 18rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.1;
  white-space: nowrap;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-action-trail--street-cols-3 .action-trail-item--stacked .action-trail-label {
  font-size: 20rpx;
}

.player-action-trail--street-cols-3 .action-trail-chips {
  font-size: 17rpx;
}

.player-action-trail--street-cols-4 .action-trail-item--stacked .action-trail-label {
  font-size: 19rpx;
}

.player-action-trail--street-cols-4 .action-trail-chips {
  font-size: 16rpx;
}

.player-cards-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
  gap: 10rpx;
  min-width: 0;
  width: auto;
}

.hole-row {
  display: flex;
  flex-direction: row;
  gap: 14rpx;
  flex-shrink: 0;
}

.work-head {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1.45;
  margin-bottom: 10rpx;
}

.nar-body-wrap {
  min-height: 120rpx;
  box-sizing: border-box;
}

.nar-body {
  display: block;
  font-size: 28rpx;
  color: #cbd5e1;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 8rpx;
}

.nar-body.nar-rec {
  font-weight: 700;
  color: #86efac;
}

.nar-muted {
  color: #64748b;
  font-style: italic;
}

.work-body {
  display: block;
  font-size: 26rpx;
  color: #94a3b8;
  line-height: 1.5;
}

.amount-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 12rpx 0 16rpx;
}

.amount-label {
  font-size: 24rpx;
  color: #94a3b8;
}

.amount-input {
  flex: 1;
  height: 88rpx;
  min-height: 88rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  border-radius: 12rpx;
  background: rgba(0, 0, 0, 0.28);
  color: #f8fafc;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  font-size: 28rpx;
  line-height: 88rpx;
}

.action-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.action-btn {
  min-width: calc(50% - 6rpx);
  box-sizing: border-box;
  text-align: center;
  padding: 18rpx 12rpx;
  border-radius: 14rpx;
  color: #e2e8f0;
  font-size: 26rpx;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.1);
}

.action-btn--fold {
  background: rgba(127, 29, 29, 0.55);
}
.action-btn--check,
.action-btn--call {
  background: rgba(30, 64, 175, 0.55);
}
.action-btn--bet,
.action-btn--raise,
.action-btn--all_in {
  background: rgba(21, 128, 61, 0.55);
}

.street-advance {
  margin-top: 16rpx;
  padding: 20rpx;
  border-radius: 14rpx;
  text-align: center;
  background: rgba(21, 128, 61, 0.45);
  border: 1rpx solid rgba(134, 239, 172, 0.45);
}

.street-advance-txt {
  font-size: 28rpx;
  font-weight: 700;
  color: #bbf7d0;
}

.review-head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.review-progress {
  font-size: 22rpx;
  color: #94a3b8;
}

.verdict-pill {
  font-size: 22rpx;
  font-weight: 700;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}

.verdict-pill--good {
  background: rgba(34, 197, 94, 0.22);
  color: #86efac;
}
.verdict-pill--acceptable {
  background: rgba(56, 189, 248, 0.2);
  color: #7dd3fc;
}
.verdict-pill--suboptimal {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}
.verdict-pill--bad {
  background: rgba(248, 113, 113, 0.22);
  color: #fca5a5;
}

.options-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 16rpx;
}

.option-pill {
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  border: 1rpx solid rgba(255, 255, 255, 0.12);
}

.option-pill--rec {
  border-color: #86efac;
  color: #bbf7d0;
}

.review-progress {
  font-size: 24rpx;
  color: #94a3b8;
}

.warn-line {
  display: block;
  font-size: 22rpx;
  color: #fcd34d;
  line-height: 1.45;
  margin-bottom: 10rpx;
}

.balance-block {
  margin: 12rpx 0 0;
  padding: 12rpx 0 0;
  border-top: 1rpx solid rgba(148, 163, 184, 0.35);
}

.balance-head {
  display: block;
  font-size: 24rpx;
  color: #93c5fd;
  margin-bottom: 8rpx;
}

.scroll-pad {
  height: 8rpx;
}

/* 选牌弹层 */
.picker-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.paste-phh-sheet {
  max-height: 78vh;
}

.paste-phh-hint {
  display: block;
  font-size: 24rpx;
  color: #bbf7d0;
  line-height: 1.45;
  margin-bottom: 16rpx;
}

.paste-phh-area {
  width: 100%;
  height: 360rpx;
  min-height: 360rpx;
  max-height: 46vh;
  padding: 20rpx 24rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
  border-radius: 14rpx;
  background: rgba(6, 40, 22, 0.85);
  border: 1rpx solid rgba(134, 239, 172, 0.35);
  color: #e2e8f0;
  font-size: 26rpx;
  line-height: 1.5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.paste-phh-area--single {
  height: 120rpx;
  min-height: 120rpx;
  max-height: 120rpx;
}

.street-advance--busy {
  opacity: 0.55;
  pointer-events: none;
}

.picker-sheet {
  width: 100%;
  max-width: 480px;
  box-sizing: border-box;
  background: #14532d;
  border-radius: 28rpx 28rpx 0 0;
  padding: 24rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
}

.picker-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.picker-title {
  font-size: 28rpx;
  font-weight: 700;
  color: #e2e8f0;
}

.picker-close {
  font-size: 26rpx;
  color: #86efac;
  padding: 8rpx 12rpx;
}

.picker-slots {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.picker-slot-hint {
  font-size: 22rpx;
  color: #94a3b8;
}

.suit-tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.suit-tab {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 12rpx;
  background: rgba(0, 0, 0, 0.25);
  font-size: 32rpx;
  color: #e2e8f0;
  border: 2rpx solid transparent;
}

.suit-tab.red {
  color: #f87171;
}

.suit-tab.on {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
}

.rank-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 20rpx;
}

.rank-cell {
  width: calc((100% - 60rpx) / 7);
  box-sizing: border-box;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: #f8fafc;
  color: #0f172a;
}

.rank-cell.red {
  color: #b91c1c;
}

.rank-cell.used {
  opacity: 0.28;
}

.rank-cell.on {
  outline: 4rpx solid #fbbf24;
}

.rank-cell-txt {
  font-size: 28rpx;
  font-weight: 800;
}

.picker-confirm {
  margin: 0;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 16rpx;
  background: #15803d;
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
}

.picker-confirm[disabled] {
  opacity: 0.4;
}

.dock-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.dock-row .dock-btn {
  flex: 1;
}

.dock-btn {
  margin: 0;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 14rpx;
  font-size: 26rpx;
  font-weight: 600;
  border: none;
}

.dock-btn--primary {
  background: #15803d;
  color: #fff;
}

.dock-btn--primary[disabled] {
  opacity: 0.4;
}

.dock-btn--secondary {
  margin-top: 0;
  margin-bottom: 4rpx;
  width: 100%;
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

.dock-btn--ghost {
  background: transparent;
  color: #c8e6c9;
  border: 1rpx solid rgba(200, 230, 201, 0.28);
}

.dock-btn--ghost[disabled] {
  opacity: 0.35;
}

.dock-review-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  min-height: 44rpx;
  padding-bottom: 4rpx;
}

.dock-back-link {
  font-size: 24rpx;
  font-weight: 600;
  color: #38bdf8;
  padding: 8rpx 16rpx;
}

.nar-head-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4rpx;
  margin-bottom: 10rpx;
}

.nar-step-hit {
  flex-shrink: 0;
  width: 48rpx;
  min-width: 48rpx;
  height: 44rpx;
  padding: 0;
  margin: 0;
  align-items: center;
  justify-content: center;
  display: flex;
  box-sizing: border-box;
  background: transparent;
  border: none;
}

.nar-step-hit--disabled {
  opacity: 0.35;
  pointer-events: none;
}

.nar-step-glyph {
  font-size: 36rpx;
  font-weight: 600;
  color: #38bdf8;
  line-height: 1;
}

.nar-head-center-wrap {
  flex: 1;
  min-width: 0;
}

.nar-head {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1.45;
  margin-bottom: 0;
}

.nar-head-inline {
  white-space: normal;
  word-break: break-word;
}
</style>
