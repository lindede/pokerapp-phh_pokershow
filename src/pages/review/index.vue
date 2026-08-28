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
              <text class="street-tag">{{ streetZh }}</text>
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
            <view class="player-top">
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
                  <text class="p-meta-val">{{ p.stack }}</text>
                  <text class="p-meta-sep">·</text>
                  <text class="p-meta-val" :class="{ 'bet-on': p.bet > 0 }">{{
                    p.bet
                  }}</text>
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
              <!-- 点手牌：定 Hero + 弹选牌 -->
              <view class="hole-row" @tap.stop="onTapHole(p.seatIndex)">
                <PokerCard :code="p.hole[0]" size="lg" />
                <PokerCard :code="p.hole[1]" size="lg" />
              </view>
            </view>
          </view>
        </view>

        <view class="panel panel-work">
          <text class="work-head">{{ stepHeadline }}</text>
          <text v-if="errorMessage" class="warn-line">{{ errorMessage }}</text>

          <template v-if="phase === 'entry' && entryStep === 'hero_seat'">
            <text class="work-body">点击列表行选择 Hero 座位，选完自动进入选手牌。</text>
            <view class="street-advance" :class="{ 'street-advance--busy': loading }" @tap="openPastePhh">
              <text class="street-advance-txt">粘贴 PHH 导入</text>
            </view>
            <view class="street-advance" :class="{ 'street-advance--busy': loading }" @tap="openArtifactLoad">
              <text class="street-advance-txt">按产物 ID 加载点评</text>
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

          <template v-else-if="phase === 'reviewing' && !currentReview">
            <text class="work-body"
              >点评未加载（共 {{ reviews.length }} 条）。若分析已在服务端完成，请用「按产物 ID
              加载点评」。</text
            >
          </template>

          <template v-else-if="phase === 'reviewing' && currentReview">
            <view class="review-head-row">
              <text
                class="verdict-pill"
                :class="`verdict-pill--${currentReview.verdict}`"
                >{{ verdictZh(currentReview.verdict) }}</text
              >
              <text class="review-progress"
                >{{ reviewCursor + 1 }} / {{ reviews.length }}</text
              >
            </view>
            <text v-if="analyzeWarnings.length" class="warn-line">{{
              analyzeWarnings.join("；")
            }}</text>
            <template v-if="currentReview.kind === 'summary'">
              <text class="actual-line">整手总结</text>
              <text
                v-if="currentReview.outcome_zh"
                class="rec-line"
                >{{ currentReview.outcome_zh }}</text
              >
              <text
                v-if="currentReview.opponent_shown"
                class="rec-line"
                >对手亮牌 {{ currentReview.opponent_shown }}</text
              >
            </template>
            <template v-else>
              <text class="actual-line"
                >实际 {{ currentReview.actual.label }}</text
              >
              <text class="rec-line"
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
            <view v-if="currentReview.balance?.notes?.length" class="balance-block">
              <text class="balance-head">平衡视角（混合 / 诈唬）</text>
              <text
                v-if="currentReview.balance.alt?.label"
                class="balance-alt-line"
                >混合可选 {{ currentReview.balance.alt.label }}</text
              >
              <text
                v-for="(b, j) in currentReview.balance.notes"
                :key="'bal-' + j"
                class="balance-line"
                >{{ b }}</text
              >
            </view>
            <text
              v-for="(r, i) in currentReview.reasons"
              :key="'reason-' + i"
              class="reason-line"
              >{{ r }}</text
            >
          </template>
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
      v-if="artifactLoadVisible"
      class="picker-mask"
      @tap="closeArtifactLoad"
    >
      <view class="picker-sheet paste-phh-sheet" @tap.stop>
        <view class="picker-top">
          <text class="picker-title">加载已有点评</text>
          <text class="picker-close" @tap="closeArtifactLoad">关闭</text>
        </view>
        <text class="paste-phh-hint"
          >输入落盘目录名（如
          20260823010950_f47300219aa7d451acb3bf16），从服务端读取 review.json。</text
        >
        <textarea
          class="paste-phh-area paste-phh-area--single"
          v-model="artifactIdDraft"
          placeholder="YYYYMMDDHHMMSS_xxxxxxxxxxxxxxxxxxxxxxxx"
          :maxlength="64"
        />
        <button
          class="picker-confirm"
          :disabled="loading || !artifactIdDraft.trim()"
          :loading="loading"
          @tap="confirmArtifactLoad"
        >
          加载点评
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

    <view class="dock">
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
      <template v-else>
        <view class="dock-row">
          <button
            class="dock-btn dock-btn--ghost"
            :disabled="!hasPrevDecision"
            @tap="goPrevDecision"
          >
            上一决策
          </button>
          <button
            class="dock-btn dock-btn--ghost"
            :disabled="!hasNextDecision"
            @tap="goNextDecision"
          >
            下一决策
          </button>
        </view>
        <button class="dock-btn dock-btn--secondary" @tap="backToEntry">
          返回录入
        </button>
      </template>
      <AppTabBar active="review" />
      <view class="dock-safe"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
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
const artifactLoadVisible = ref(false);
const artifactIdDraft = ref("");

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
  reviewCursor,
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
  streetZh,
  stepHeadline,
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
  loadReviewArtifact,
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

function openArtifactLoad() {
  artifactLoadVisible.value = true;
}

function closeArtifactLoad() {
  artifactLoadVisible.value = false;
}

async function confirmArtifactLoad() {
  const ok = await loadReviewArtifact(artifactIdDraft.value);
  if (ok) artifactLoadVisible.value = false;
}

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
$dock-bg: rgba(15, 61, 38, 0.96);
$tab-bar-h: 88rpx;

.page-root {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: $felt;
  overflow: hidden;
}

.page-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
}

.page-inner {
  padding: 16rpx 24rpx 0;
  padding-bottom: calc(200rpx + #{$tab-bar-h} + env(safe-area-inset-bottom));
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

.panel-players {
  padding: 12rpx 14rpx;
}

.panel-work {
  padding: 20rpx 22rpx 24rpx;
}

.board-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.board-pot-col {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.pot-bar {
  border: 2rpx solid $pot-yellow;
  border-radius: 12rpx;
  padding: 6rpx 14rpx;
  background: rgba(0, 0, 0, 0.18);
}

.pot-text {
  font-size: 26rpx;
  font-weight: 700;
  color: $pot-yellow;
}

.blinds-level,
.street-tag {
  font-size: 20rpx;
  font-weight: 600;
  color: rgba(226, 232, 240, 0.88);
}

.bb-real-anchor {
  font-size: 18rpx;
  font-weight: 500;
  color: rgba(148, 163, 184, 0.92);
}

.street-tag {
  color: #86efac;
}

.community-row {
  display: flex;
  flex: 1;
  justify-content: flex-end;
  gap: 10rpx;
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
  background: rgba(0, 0, 0, 0.18);
  border-radius: 16rpx;
  padding: 14rpx 12rpx;
  margin-bottom: 10rpx;
  border: 1rpx solid transparent;
}

.player-card:last-child {
  margin-bottom: 0;
}

.player-card.focus {
  border-color: rgba(251, 191, 36, 0.55);
}

.player-card--hero {
  background: rgba(46, 125, 50, 0.28);
}

.player-card.replay-folded {
  opacity: 0.45;
}

.player-top {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
}

.player-info {
  flex: 0 0 160rpx;
  min-width: 0;
}

.title-line {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 6rpx;
}

.pos-badge {
  border-radius: 8rpx;
  padding: 2rpx 8rpx;
  background: #334155;
}

.pos-badge-txt {
  font-size: 18rpx;
  font-weight: 700;
  color: #f8fafc;
}

.pos-badge--SB {
  background: #0369a1;
}
.pos-badge--BB {
  background: #b45309;
}
.pos-badge--UTG {
  background: #4c1d95;
}
.pos-badge--MP {
  background: #0f766e;
}
.pos-badge--CO {
  background: #9f1239;
}
.pos-badge--BTN {
  background: #a16207;
}

.p-name {
  font-size: 24rpx;
  font-weight: 600;
  color: #e2e8f0;
}

.p-meta-line {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.p-meta-val {
  font-size: 22rpx;
  color: #cbd5e1;
}

.p-meta-val.bet-on {
  color: $pot-yellow;
  font-weight: 700;
}

.p-meta-sep {
  color: #64748b;
}

.player-action-trail {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.player-action-trail--street {
  flex-shrink: 0;
  max-width: none;
}

.action-trail-street-grid {
  display: grid;
  align-items: start;
  box-sizing: border-box;
}

.action-trail-street-col {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4rpx;
  min-width: 0;
}

.action-trail-item {
  display: flex;
  background: #2563eb;
  border-radius: 8rpx;
  padding: 4rpx 6rpx;
  box-sizing: border-box;
  width: 100%;
}

.action-trail-item--stacked {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
}

.action-trail-label {
  font-size: 18rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1.15;
  text-align: center;
}

.action-trail-chips {
  font-size: 16rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.1;
  text-align: center;
}

.player-action-trail--street-cols-3 .action-trail-label,
.player-action-trail--street-cols-4 .action-trail-label {
  font-size: 16rpx;
}

.player-action-trail--street-cols-3 .action-trail-chips,
.player-action-trail--street-cols-4 .action-trail-chips {
  font-size: 14rpx;
}

.hole-row {
  display: flex;
  gap: 8rpx;
  flex-shrink: 0;
  padding: 4rpx;
  border-radius: 10rpx;
}

.work-head {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 10rpx;
}

.work-body {
  display: block;
  font-size: 24rpx;
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
  height: 64rpx;
  padding: 0 16rpx;
  border-radius: 12rpx;
  background: rgba(0, 0, 0, 0.28);
  color: #f8fafc;
  border: 1rpx solid rgba(255, 255, 255, 0.14);
  font-size: 28rpx;
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

.actual-line {
  display: block;
  font-size: 26rpx;
  color: #e2e8f0;
  margin-bottom: 8rpx;
}

.rec-line {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #86efac;
  margin-bottom: 14rpx;
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

.reason-line {
  display: block;
  font-size: 26rpx;
  color: #cbd5e1;
  line-height: 1.55;
  margin-bottom: 8rpx;
}

.balance-block {
  margin: 12rpx 0 16rpx;
  padding: 12rpx 0;
  border-top: 1rpx solid rgba(148, 163, 184, 0.35);
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.35);
}

.balance-head {
  display: block;
  font-size: 24rpx;
  color: #93c5fd;
  margin-bottom: 8rpx;
}

.balance-alt-line {
  display: block;
  font-size: 24rpx;
  color: #a5b4fc;
  margin-bottom: 6rpx;
}

.balance-line {
  display: block;
  font-size: 24rpx;
  color: #94a3b8;
  line-height: 1.5;
  margin-bottom: 6rpx;
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
  min-height: 360rpx;
  max-height: 46vh;
  padding: 16rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
  border-radius: 14rpx;
  background: rgba(6, 40, 22, 0.85);
  border: 1rpx solid rgba(134, 239, 172, 0.35);
  color: #e2e8f0;
  font-size: 24rpx;
  line-height: 1.45;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.paste-phh-area--single {
  min-height: 96rpx;
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

.dock {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 480px;
  box-sizing: border-box;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, $dock-bg 28%);
  z-index: 20;
}

.dock-row {
  display: flex;
  gap: 12rpx;
}

.dock-row .dock-btn {
  flex: 1;
}

.dock-btn {
  margin: 0;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 16rpx;
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
  margin-top: 12rpx;
  width: 100%;
  background: rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
}

.dock-btn--ghost {
  background: rgba(15, 61, 38, 0.9);
  color: #c8e6c9;
  border: 1rpx solid rgba(200, 230, 201, 0.35);
}

.dock-btn--ghost[disabled] {
  opacity: 0.35;
}

.dock-safe {
  height: 4rpx;
}
</style>
