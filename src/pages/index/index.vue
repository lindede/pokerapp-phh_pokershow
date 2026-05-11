<template>
  <view class="page-root">
    <!-- 牌桌 → 玩家 → 解说顺序排在同一纵向滚动里，不再与玩家区分栏抢占高度 -->
    <scroll-view class="page-scroll" scroll-y :show-scrollbar="false">
      <view class="page-inner">
        <view class="panel panel-board">
          <view class="community-row">
            <PokerCard
              v-for="(c, idx) in state.board"
              :key="idx"
              :code="c"
              size="lg"
            />
          </view>
          <view class="pot-bar">
            <text class="pot-text">$ 底池 {{ state.pot }}</text>
          </view>
        </view>

        <view class="panel panel-players">
          <view
            v-for="p in state.players"
            :key="p.id"
            class="player-card"
            :class="{
              focus: state.focusPlayerId === p.id,
              'replay-folded': p.folded,
            }"
          >
            <view class="player-top">
              <view class="player-left">
                <view class="player-head">
                  <view class="title-line">
                    <text class="pos-ico">{{ positionIcon(p.positionKey) }}</text>
                    <text class="pos-lab">{{ p.positionLabel }}</text>
                    <text class="p-name">{{ p.name }}</text>
                  </view>
                </view>
                <view class="p-meta-line">
                  <text class="p-meta-bit">筹 {{ p.stack }}</text>
                  <text class="p-meta-sep">·</text>
                  <text class="p-meta-bit">注 </text>
                  <text
                    class="p-bet-inline"
                    :class="{ 'bet-on': p.bet > 0 }"
                  >{{ p.bet }}</text>
                </view>
              </view>
              <view class="player-cards-block">
                <view
                  class="player-tags-beside-holes"
                  :class="{ 'action-trail-grid': replayActive }"
                >
                  <template v-if="replayActive">
                    <view
                      v-for="st in ACTION_TRAIL_STREETS"
                      :key="'col-' + p.id + '-' + st"
                      class="action-trail-col"
                    >
                      <view class="action-trail-col-stack">
                        <view
                          v-for="(item, ti) in actionTrailForStreet(p, st)"
                          :key="'at-' + p.id + '-' + st + '-' + ti"
                          class="action-trail-item"
                        >
                          <text class="action-trail-label">{{ item.labelZh }}</text>
                          <text
                            v-if="item.chipsLine"
                            class="action-trail-chips"
                          >{{ item.chipsLine }}</text>
                        </view>
                        <view
                          v-if="st === 'river' && showWinsTag(p)"
                          class="action-trail-item action-wins-tag"
                        >
                          <text class="action-trail-label">WINS</text>
                        </view>
                      </view>
                    </view>
                  </template>
                  <template v-else>
                    <view v-if="p.action" class="action-pill">
                      <text class="action-txt">{{ p.action }}</text>
                    </view>
                    <view v-if="showWinsTag(p)" class="action-trail-item action-wins-tag">
                      <text class="action-trail-label">WINS</text>
                    </view>
                  </template>
                </view>
                <view class="hole-row">
                  <PokerCard :code="p.hole[0]" size="sm" />
                  <PokerCard :code="p.hole[1]" size="sm" />
                </view>
              </view>
            </view>
            <view
              v-if="joinAnalysis(p)"
              class="analysis-box"
            >
              <text class="azh">{{ joinAnalysis(p) }}</text>
            </view>
          </view>
        </view>

        <view
          v-if="narrationVisible"
          class="narration-block"
          @touchstart="onNarrationTouchStart"
          @touchmove="onNarrationTouchMove"
          @touchend="onNarrationTouchEnd"
          @touchcancel="onNarrationTouchCancel"
        >
          <view class="panel panel-narration panel-narration-fill">
            <template v-if="replayActive">
                <view class="nar-head-row">
                  <view class="nar-step-hit" @tap.stop="onTapPrevAction">
                    <text class="nar-step-glyph">‹</text>
                  </view>
                  <view class="nar-head-center-wrap">
                    <text class="nar-head nar-head-center">{{ state.replayHeadline }}</text>
                    <text
                      v-if="state.replayHeadlineChips"
                      class="nar-head-chips"
                    >{{ state.replayHeadlineChips }}</text>
                  </view>
                  <view class="nar-step-hit" @tap.stop="onTapNextAction">
                    <text class="nar-step-glyph">›</text>
                  </view>
                </view>
              <text v-if="state.replayDetailText" class="nar-body">{{ state.replayDetailText }}</text>
              <text v-else class="nar-body nar-muted">此步无解说正文</text>
            </template>
            <template v-else>
              <text v-if="state.serverSummary" class="nar-summary">{{ state.serverSummary }}</text>
              <text
                v-for="(a, i) in state.serverByAction"
                v-show="a.text && a.text.trim()"
                :key="'srv-' + i"
                class="nar-action"
              >{{ a.text }}</text>
              <text
                v-if="!state.serverSummary && !serverByActionHasText"
                class="nar-empty"
              >暂无解说文案</text>
            </template>
          </view>
        </view>

        <view class="scroll-pad" />
      </view>
    </scroll-view>

    <view class="dock">
      <view class="replay-dock">
        <view class="replay-row">
          <text
            class="nav-hand"
            :class="{ 'nav-disabled': state.loading }"
            @tap="onTapPrevHand"
          >上一局</text>
          <view class="replay-center">
            <view v-if="replayActive" class="replay-controls">
              <view class="play-toggle" @tap="toggleReplayPlay">
                <text class="play-glyph">{{ state.replayPlaying ? "⏸" : "▶" }}</text>
              </view>
              <slider
                class="replay-slider"
                :value="replaySliderPercent"
                activeColor="#38bdf8"
                backgroundColor="#475569"
                block-color="#f8fafc"
                block-size="14"
                @changing="onReplaySliderChanging"
                @change="onReplaySliderChange"
              />
              <text class="replay-remain">{{ formatMs(replayRemainingMs) }}</text>
            </view>
          </view>
          <text
            class="nav-hand"
            :class="{ 'nav-disabled': state.loading }"
            @tap="onTapNextHand"
          >下一局</text>
        </view>
      </view>

      <view class="dock-safe" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import PokerCard from "@/components/PokerCard.vue";
import { useCommentaryHand } from "@/composables/useCommentaryHand";
import type {
  PlayerState,
  ReplayActionTrailItem,
  SeatPositionKey,
  Street,
} from "@/types/commentary";

const ACTION_TRAIL_STREETS: Street[] = [
  "preflop",
  "flop",
  "turn",
  "river",
];

function actionTrailForStreet(
  p: PlayerState,
  st: Street,
): ReplayActionTrailItem[] {
  const trail = p.actionTrail ?? [];
  return trail.filter((x) => (x.street ?? "preflop") === st);
}

const {
  state,
  loadApi,
  loadPrevHand,
  loadNextHand,
  toggleReplayPlay,
  seekReplayPercent,
  seekReplayStepDelta,
} = useCommentaryHand();

let narrTouchStartX = 0;
let narrTouchStartY = 0;
let narrMaxAbsDx = 0;
let narrMaxAbsDy = 0;

function touchXY(t: Touch): { x: number; y: number } {
  if (typeof t.pageX === "number" && typeof t.pageY === "number") {
    return { x: t.pageX, y: t.pageY };
  }
  return { x: t.clientX, y: t.clientY };
}

function onNarrationTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  if (!t) return;
  const p = touchXY(t);
  narrTouchStartX = p.x;
  narrTouchStartY = p.y;
  narrMaxAbsDx = 0;
  narrMaxAbsDy = 0;
}

function onNarrationTouchMove(e: TouchEvent) {
  const t = e.touches[0];
  if (!t) return;
  const p = touchXY(t);
  narrMaxAbsDx = Math.max(narrMaxAbsDx, Math.abs(p.x - narrTouchStartX));
  narrMaxAbsDy = Math.max(narrMaxAbsDy, Math.abs(p.y - narrTouchStartY));
}

function onNarrationTouchCancel() {
  narrMaxAbsDx = 0;
  narrMaxAbsDy = 0;
}

function onNarrationTouchEnd(e: TouchEvent) {
  if (!replayActive.value) return;
  const t = e.changedTouches[0];
  if (!t) return;
  const p = touchXY(t);
  const dx = p.x - narrTouchStartX;
  const dy = p.y - narrTouchStartY;
  const adx = Math.max(Math.abs(dx), narrMaxAbsDx);
  const ady = Math.max(Math.abs(dy), narrMaxAbsDy);
  const minSwipe = 36;
  if (adx < minSwipe) return;
  if (adx <= ady * 0.92) return;
  if (dx < 0) seekReplayStepDelta(1);
  else seekReplayStepDelta(-1);
}

function onTapPrevAction() {
  if (!replayActive.value) return;
  seekReplayStepDelta(-1);
}

function onTapNextAction() {
  if (!replayActive.value) return;
  seekReplayStepDelta(1);
}

onMounted(() => {
  loadApi({ silentToast: true });
});

function onTapPrevHand() {
  if (state.loading) return;
  loadPrevHand();
}

function onTapNextHand() {
  if (state.loading) return;
  loadNextHand();
}

const replayActive = computed(() => state.byActionTimeline.length > 0);

/** 回放未到最后一手动作时不展示 WINS，避免中途提前剧透 */
const replayShowWinnerWinsTag = computed(() => {
  const tl = state.byActionTimeline;
  if (!tl.length) return true;
  return state.replayStep >= tl.length - 1;
});

function showWinsTag(p: PlayerState): boolean {
  if (!p.winner) return false;
  if (!replayActive.value) return true;
  return replayShowWinnerWinsTag.value;
}

const serverByActionHasText = computed(() =>
  state.serverByAction.some((x) => x.text && x.text.trim()),
);

const narrationVisible = computed(
  () =>
    replayActive.value ||
    !!state.serverSummary ||
    serverByActionHasText.value,
);

const replaySliderPercent = computed(() => {
  if (!state.replayTotalMs) return 0;
  return (state.replayElapsedMs / state.replayTotalMs) * 100;
});

const replayRemainingMs = computed(() =>
  Math.max(0, state.replayTotalMs - state.replayElapsedMs),
);

function onReplaySliderChanging(e: { detail?: { value?: number } }) {
  seekReplayPercent(Number(e.detail?.value ?? 0));
}

function onReplaySliderChange(e: { detail?: { value?: number } }) {
  seekReplayPercent(Number(e.detail?.value ?? 0));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}:${pad2(r)}`;
}

function joinAnalysis(p: PlayerState): string {
  return [p.analysisZh, p.analysisZhDetail, p.analysisEn]
    .filter(Boolean)
    .join(" · ");
}

function positionIcon(k: SeatPositionKey): string {
  const m: Record<SeatPositionKey, string> = {
    SB: "⭕",
    BB: "🎯",
    UTG: "✈",
    MP: "⚓",
    CO: "💵",
    BTN: "👑",
  };
  return m[k] ?? "·";
}
</script>

<style lang="scss" scoped>
$felt: #0f3d26;
$panel: rgba(255, 255, 255, 0.07);
$panel-border: rgba(255, 255, 255, 0.14);
$pot-yellow: #fbbf24;
$dock-bg: rgba(15, 61, 38, 0.96);

.page-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  background-color: $felt;
}

.page-scroll {
  flex: 1;
  height: 0;
  min-height: 0;
  box-sizing: border-box;
}

.narration-block {
  margin-bottom: 16rpx;
}

.nar-head-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8rpx;
  margin-bottom: 10rpx;
}

.nar-step-hit {
  flex-shrink: 0;
  width: 56rpx;
  min-height: 44rpx;
  align-items: center;
  justify-content: center;
  display: flex;
}

.nar-step-glyph {
  font-size: 40rpx;
  font-weight: 700;
  color: #38bdf8;
  line-height: 1;
}

.nar-head-center-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4rpx;
}

.nar-head-center {
  flex: 1;
  min-width: 0;
}

.nar-head-chips {
  display: block;
  font-size: 22rpx;
  font-weight: 700;
  color: #fde047;
  line-height: 1.35;
  word-break: break-all;
}

.page-inner {
  padding: 16rpx 20rpx 0;
  box-sizing: border-box;
}

.scroll-pad {
  height: 12rpx;
}

.panel {
  background-color: $panel;
  border: 1rpx solid $panel-border;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
}

.panel.panel-board {
  padding: 16rpx 18rpx;
  margin-bottom: 14rpx;
}

.panel.panel-players {
  padding: 12rpx 14rpx;
  margin-bottom: 16rpx;
}

.panel.panel-narration {
  padding: 16rpx 18rpx;
  margin-bottom: 18rpx;
}

.panel-narration-fill {
  margin-bottom: 0;
  min-height: 120rpx;
}

.nar-muted {
  color: #64748b;
  font-style: italic;
}

.nar-head {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1.45;
  margin-bottom: 10rpx;
}

.nar-head-row .nar-head {
  margin-bottom: 0;
}

.nar-body {
  display: block;
  font-size: 22rpx;
  color: #cbd5e1;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.nar-summary {
  display: block;
  font-size: 24rpx;
  color: #f8fafc;
  line-height: 1.55;
  margin-bottom: 10rpx;
}

.nar-action {
  display: block;
  font-size: 22rpx;
  color: #cbd5e1;
  line-height: 1.5;
  margin-bottom: 8rpx;
}

.nar-empty {
  font-size: 22rpx;
  color: #94a3b8;
}

.community-row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;
  gap: clamp(10rpx, 2vw, 18rpx);
  margin-bottom: 10rpx;
}

.pot-bar {
  border: 2rpx solid $pot-yellow;
  border-radius: 12rpx;
  padding: 6rpx 14rpx;
  background: rgba(0, 0, 0, 0.18);
  align-items: center;
  justify-content: center;
  display: flex;
}

.pot-text {
  font-size: 24rpx;
  font-weight: 600;
  color: $pot-yellow;
}

.panel-players {
  padding-bottom: 4rpx;
}

.action-trail-grid {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 6rpx;
  flex-shrink: 0;
}

.action-trail-col {
  flex: 0 0 76rpx;
  width: 76rpx;
  min-width: 76rpx;
  max-width: 76rpx;
  box-sizing: border-box;
}

.action-trail-col-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6rpx;
  width: 100%;
}

.player-card {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 12rpx;
  padding: 6rpx 8rpx;
  margin-bottom: 6rpx;
  border: 2rpx solid transparent;
}

.player-card.focus {
  border-color: #facc15;
  box-shadow: 0 0 0 2rpx rgba(250, 204, 21, 0.25);
}

.player-card.replay-folded {
  opacity: 0.52;
}

.player-top {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
}

.player-left {
  flex: 1;
  padding-right: 8rpx;
  min-width: 0;
}

.player-head {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex-wrap: nowrap;
  gap: 6rpx;
  margin-bottom: 2rpx;
}

.player-cards-block {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}

.player-tags-beside-holes {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-start;
  align-content: flex-start;
  gap: 6rpx;
  max-width: 300rpx;
  flex-shrink: 1;
  min-width: 0;
}

.player-tags-beside-holes.action-trail-grid {
  flex-wrap: nowrap;
  max-width: none;
  align-items: flex-start;
}

.action-trail-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  max-width: 100%;
  background: #2563eb;
  border-radius: 6rpx;
  padding: 4rpx 8rpx;
  box-sizing: border-box;
}

.action-trail-label {
  font-size: 17rpx;
  color: #fff;
  line-height: 1.25;
}

.action-trail-chips {
  font-size: 15rpx;
  font-weight: 700;
  color: #fde047;
  line-height: 1.3;
  word-break: break-all;
  margin-top: 2rpx;
}

.action-wins-tag {
  background: linear-gradient(145deg, #ca8a04 0%, #854d0e 100%);
  border: 1rpx solid rgba(253, 224, 71, 0.55);
}

.action-wins-tag .action-trail-label {
  font-weight: 800;
  letter-spacing: 0.06em;
}

.title-line {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4rpx;
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}

.pos-ico {
  font-size: 18rpx;
  flex-shrink: 0;
}

.pos-lab {
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
}

.p-name {
  font-size: 22rpx;
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
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.2;
}

.p-meta-bit {
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

.action-pill {
  flex-shrink: 0;
  align-self: center;
  background: #2563eb;
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
}

.action-txt {
  font-size: 17rpx;
  color: #fff;
}

.hole-row {
  display: flex;
  flex-direction: row;
  gap: 5rpx;
  flex-shrink: 0;
}

.analysis-box {
  margin-top: 4rpx;
  padding: 4rpx 6rpx;
  border-radius: 6rpx;
  background: rgba(30, 41, 59, 0.55);
  overflow: hidden;
}

.azh {
  font-size: 17rpx;
  color: #cbd5e1;
  font-weight: 500;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dock {
  flex-shrink: 0;
  background: $dock-bg;
  border-top: 1rpx solid rgba(255, 255, 255, 0.12);
  padding: 16rpx 24rpx 0;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.replay-dock {
  margin-bottom: 14rpx;
}

.replay-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
}

.nav-hand {
  flex-shrink: 0;
  font-size: 22rpx;
  font-weight: 600;
  color: #38bdf8;
  padding: 12rpx 8rpx;
  max-width: 120rpx;
  text-align: center;
}

.nav-hand.nav-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.replay-center {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
}

.replay-controls {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  flex: 1;
  min-width: 0;
}

.play-toggle {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: #334155;
  align-items: center;
  justify-content: center;
  display: flex;
  flex-shrink: 0;
}

.play-glyph {
  font-size: 32rpx;
  color: #f8fafc;
}

.replay-slider {
  flex: 1;
  min-width: 0;
}

.replay-remain {
  flex-shrink: 0;
  min-width: 72rpx;
  text-align: right;
  font-size: 22rpx;
  font-weight: 600;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}

.dock-safe {
  height: 8rpx;
}
</style>
