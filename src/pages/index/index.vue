<template>
  <LaunchIntroModal :skip="skipIntroModal" />
  <view class="page-root" :class="{ 'page-root--rv': skipIntroModal }">
    <!-- 牌桌 → 玩家 → 解说顺序排在同一纵向滚动里，不再与玩家区分栏抢占高度 -->
    <scroll-view
      class="page-scroll"
      scroll-y
      :show-scrollbar="false"
      :style="scrollViewStyle"
    >
      <view class="page-inner">
        <view class="panel panel-board">
          <view class="board-row">
            <view class="board-pot-col">
              <view class="pot-bar">
                <view class="pot-chip-ico" aria-hidden="true">
                  <view class="pot-chip-disc pot-chip-disc--back"></view>
                  <view class="pot-chip-disc pot-chip-disc--front"></view>
                </view>
                <text class="pot-text">底池 {{ state.pot }}</text>
              </view>
              <text v-if="blindsLevelText" class="blinds-level">{{ blindsLevelText }}</text>
            </view>
            <view class="community-row">
              <PokerCard
                v-for="(c, idx) in state.board"
                :key="idx"
                :code="c"
                size="lg"
                :highlight="boardHighlightSet.has(idx)"
              />
            </view>
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
                    <view
                      class="pos-badge"
                      :class="`pos-badge--${p.positionKey}`"
                    >
                      <text class="pos-badge-txt">{{ positionNameZh(p) }}</text>
                    </view>
                    <text class="p-name">{{ p.name }}</text>
                  </view>
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
                    >{{ p.bet }}</text>
                  </view>
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
                          :class="{ 'action-wins-tag--celebrate': winsTagCelebrate(p) }"
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
                    <view
                      v-if="showWinsTag(p)"
                      class="action-trail-item action-wins-tag"
                      :class="{ 'action-wins-tag--celebrate': winsTagCelebrate(p) }"
                    >
                      <text class="action-trail-label">WINS</text>
                    </view>
                  </template>
                </view>
                <view class="hole-row">
                  <PokerCard :code="p.hole[0]" size="lg" />
                  <PokerCard :code="p.hole[1]" size="lg" />
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
                    <text class="nar-head nar-head-center nar-head-inline">
                      {{ state.replayHeadline }}<text
                        v-if="state.replayHeadlineChips"
                        class="nar-head-chips"
                      > {{ state.replayHeadlineChips }}</text>
                    </text>
                  </view>
                  <view class="nar-step-hit" @tap.stop="onTapNextAction">
                    <text class="nar-step-glyph">›</text>
                  </view>
                </view>
              <text v-if="state.replayDetailText" class="nar-body" user-select>{{ state.replayDetailText }}</text>
              <text v-else class="nar-body nar-muted">此步无解说正文</text>
            </template>
            <template v-else>
              <text v-if="state.serverSummary" class="nar-summary" user-select>{{ state.serverSummary }}</text>
              <text
                v-for="(a, i) in state.serverByAction"
                v-show="a.text && a.text.trim()"
                :key="'srv-' + i"
                class="nar-action"
                user-select
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

    <view v-if="!skipIntroModal" class="dock">
      <text v-if="!isMpWeixin" class="icp-record" @tap="openBeianLink">琼ICP备2026007033号</text>
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
          <view
            class="voice-toggle"
            :class="{ 'voice-toggle--off': !state.voiceOpen }"
            @tap="toggleVoiceOpen"
          >
            <text class="voice-glyph">{{ state.voiceOpen ? "🔊" : "🔇" }}</text>
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
import { computed, onMounted, ref } from "vue";
// #ifdef MP-WEIXIN
import { onLoad, onShareAppMessage } from "@dcloudio/uni-app";
// #endif
import LaunchIntroModal from "@/components/LaunchIntroModal.vue";
import PokerCard from "@/components/PokerCard.vue";
import { useCommentaryHand } from "@/composables/useCommentaryHand";
import { boardIndicesForDealBoardStep } from "@/utils/replayByAction";
import { getWindowMetrics } from "@/utils/layout";
import {
  applyReviewLaunchViewport,
  hasLaunchHandParams,
  isReviewLaunchMode,
  parseLaunchQuery,
  parseMpLaunchOptions,
} from "@/utils/launchQuery";
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

const launchQuery = parseLaunchQuery();
const skipIntroModal = isReviewLaunchMode(launchQuery);
const isMpWeixin = process.env.UNI_PLATFORM === "mp-weixin";

// #ifdef H5
if (skipIntroModal) {
  applyReviewLaunchViewport();
}
// #endif

const BEIAN_URL = "https://beian.miit.gov.cn";

function openBeianLink() {
  // #ifdef H5
  window.open(BEIAN_URL, "_blank");
  // #endif
  // #ifndef H5
  uni.setClipboardData({
    data: BEIAN_URL,
    success: () => {
      uni.showToast({ title: "链接已复制，请在浏览器打开", icon: "none" });
    },
  });
  // #endif
}

function actionTrailForStreet(
  p: PlayerState,
  st: Street,
): ReplayActionTrailItem[] {
  const trail = p.actionTrail ?? [];
  return trail.filter((x) => (x.street ?? "preflop") === st);
}

const {
  state,
  loadFresh,
  loadSample,
  loadPrevHand,
  loadNextHand,
  toggleReplayPlay,
  seekReplayPercent,
  seekReplayStepDelta,
  toggleVoiceOpen,
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
  if (dx < 0) seekReplayStepDelta(-1);
  else seekReplayStepDelta(1);
}

function onTapPrevAction() {
  if (!replayActive.value) return;
  seekReplayStepDelta(-1);
}

function onTapNextAction() {
  if (!replayActive.value) return;
  seekReplayStepDelta(1);
}

/** 小程序 scroll-view 必须明确高度（px），不能用 H5 的 flex+height:0 */
const scrollHeightPx = ref(0);
const scrollViewStyle = computed(() =>
  scrollHeightPx.value > 0 ? { height: `${scrollHeightPx.value}px` } : {},
);

function updateScrollHeight() {
  const sys = getWindowMetrics();
  const dockRpx = skipIntroModal ? 0 : 150;
  const dockPx = (dockRpx * sys.windowWidth) / 750;
  scrollHeightPx.value = Math.max(200, Math.floor(sys.windowHeight - dockPx));
}

function scheduleRemoteLoad(mpLaunch?: ReturnType<typeof parseMpLaunchOptions>) {
  loadFresh({
    silentToast: true,
    fallbackSampleOnFail: true,
    silentOnFail: true,
    ...(mpLaunch && hasLaunchHandParams(mpLaunch)
      ? {
          initialDatasetKey: mpLaunch.k!.trim(),
          initialHandIndex: mpLaunch.i!.trim(),
        }
      : {}),
  });
}

// #ifdef MP-WEIXIN
onLoad((options) => {
  const mpLaunch = parseMpLaunchOptions(options);
  loadSample({ silent: true });
  setTimeout(() => scheduleRemoteLoad(mpLaunch), 400);
});

onShareAppMessage(() => {
  const k = state.datasetKey?.trim() || "all";
  const i = state.handIndex?.trim() ?? "-1";
  return {
    title: "博弈技术学习",
    path: `/pages/index/index?k=${encodeURIComponent(k)}&i=${encodeURIComponent(i)}`,
  };
});
// #endif

onMounted(() => {
  updateScrollHeight();
  // #ifdef H5
  if (skipIntroModal) {
    applyReviewLaunchViewport();
    updateScrollHeight();
  }
  // #endif
  // #ifndef MP-WEIXIN
  loadFresh({
    silentToast: true,
    fallbackSampleOnFail: true,
    ...(hasLaunchHandParams(launchQuery)
      ? {
          initialDatasetKey: launchQuery.k!.trim(),
          initialHandIndex: launchQuery.i!.trim(),
        }
      : {}),
  });
  // #endif
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

const boardHighlightSet = computed(() => {
  if (!replayActive.value) return new Set<number>();
  const e = state.byActionTimeline[state.replayStep];
  return new Set(boardIndicesForDealBoardStep(e));
});

/** 小盲/大盲，如 50/100；来自 replayMeta.blindsOrStraddles 与各座位位次 */
const blindsLevelText = computed(() => {
  const blinds = state.replayMeta?.blindsOrStraddles;
  if (!blinds?.length) return "";

  const uniqPos = [
    ...new Set(
      blinds
        .map((x) => Math.max(0, Math.round(Number(x) || 0)))
        .filter((x) => x > 0),
    ),
  ].sort((a, b) => a - b);

  const sbSeat = state.players.findIndex((p) => p.positionKey === "SB");
  const bbSeat = state.players.findIndex((p) => p.positionKey === "BB");
  const sbFromSeat = sbSeat >= 0 ? Math.round(blinds[sbSeat] ?? 0) : 0;
  const bbFromSeat = bbSeat >= 0 ? Math.round(blinds[bbSeat] ?? 0) : 0;

  if (sbFromSeat > 0 && bbFromSeat > 0) {
    return `${sbFromSeat}/${bbFromSeat}`;
  }
  if (uniqPos.length >= 2) {
    return `${uniqPos[0]}/${uniqPos[1]}`;
  }
  return "";
});

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

/** 回放最后一动：WINS 标签高亮动效 */
function winsTagCelebrate(p: PlayerState): boolean {
  return showWinsTag(p) && replayShowWinnerWinsTag.value;
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

function positionNameZh(p: PlayerState): string {
  const fromKey: Record<SeatPositionKey, string> = {
    SB: "小盲",
    BB: "大盲",
    UTG: "枪口",
    MP: "中位",
    CO: "关煞",
    BTN: "庄位",
  };
  if (p.positionKey && fromKey[p.positionKey]) {
    return fromKey[p.positionKey];
  }
  return (p.positionLabel || "").replace(/[()]/g, "").trim() || "—";
}
</script>

<style lang="scss" scoped>
$felt: #0f3d26;
$panel: rgba(255, 255, 255, 0.07);
$panel-border: rgba(255, 255, 255, 0.14);
$pot-yellow: #fbbf24;
$dock-bg: rgba(15, 61, 38, 0.96);

.page-root {
  width: 100%;
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  background-color: $felt;
  /* #ifdef MP-WEIXIN */
  min-height: 100vh;
  /* #endif */
}

.page-root.page-root--rv {
  max-width: 540px;
}

.page-scroll {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  /* H5：与底部 dock 分栏；小程序高度由 scrollViewStyle 指定 */
  /* #ifndef MP-WEIXIN */
  height: 0;
  min-height: 0;
  /* #endif */
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
}

.nar-head-inline {
  white-space: normal;
  word-break: break-word;
}

.nar-head-chips {
  display: inline;
  font-size: 28rpx;
  font-weight: 700;
  color: #fde047;
  line-height: inherit;
  white-space: nowrap;
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
  font-size: 30rpx;
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
  font-size: 28rpx;
  color: #cbd5e1;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.nar-summary {
  display: block;
  font-size: 30rpx;
  color: #f8fafc;
  line-height: 1.55;
  margin-bottom: 10rpx;
}

.nar-action {
  display: block;
  font-size: 28rpx;
  color: #cbd5e1;
  line-height: 1.5;
  margin-bottom: 8rpx;
}

.nar-empty {
  font-size: 26rpx;
  color: #94a3b8;
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

.blinds-level {
  font-size: 20rpx;
  font-weight: 600;
  color: rgba(226, 232, 240, 0.88);
  letter-spacing: 0.04em;
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

.pot-bar {
  flex-shrink: 0;
  border: 2rpx solid $pot-yellow;
  border-radius: 12rpx;
  padding: 6rpx 14rpx;
  background: rgba(0, 0, 0, 0.18);
  align-items: center;
  justify-content: center;
  display: flex;
  flex-direction: row;
  gap: 10rpx;
}

.pot-chip-ico {
  position: relative;
  width: 40rpx;
  height: 36rpx;
  flex-shrink: 0;
}

.pot-chip-disc {
  position: absolute;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  border: 3rpx solid rgba(0, 0, 0, 0.28);
  box-sizing: border-box;
}

.pot-chip-disc--back {
  left: 0;
  bottom: 0;
  background: linear-gradient(160deg, #b45309 0%, #78350f 100%);
  box-shadow: inset 0 2rpx 4rpx rgba(255, 255, 255, 0.2);
}

.pot-chip-disc--front {
  right: 0;
  top: 0;
  background: linear-gradient(160deg, #fde047 0%, #d97706 55%, #b45309 100%);
  box-shadow:
    inset 0 2rpx 5rpx rgba(255, 255, 255, 0.45),
    0 2rpx 4rpx rgba(0, 0, 0, 0.25);
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
  padding: 14rpx 12rpx;
  margin-bottom: 10rpx;
  border: 2rpx solid transparent;
  min-height: 108rpx;
  box-sizing: border-box;
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
  align-items: center;
  min-height: 88rpx;
}

.player-left {
  flex: 1;
  padding-right: 12rpx;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8rpx;
}

.player-head {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex-wrap: nowrap;
  gap: 6rpx;
  margin-bottom: 0;
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

.action-wins-tag--celebrate {
  animation: wins-tag-pop 0.55s ease-out, wins-tag-glow 1.4s ease-in-out 0.55s infinite;
  transform-origin: center center;
}

@keyframes wins-tag-pop {
  0% {
    transform: scale(0.72);
    opacity: 0.55;
  }
  65% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes wins-tag-glow {
  0%,
  100% {
    box-shadow:
      0 0 0 0 rgba(253, 224, 71, 0.35),
      0 2rpx 6rpx rgba(0, 0, 0, 0.2);
    border-color: rgba(253, 224, 71, 0.55);
  }
  50% {
    box-shadow:
      0 0 16rpx 4rpx rgba(253, 224, 71, 0.55),
      0 0 28rpx 6rpx rgba(250, 204, 21, 0.28);
    border-color: rgba(254, 240, 138, 0.95);
  }
}

.action-wins-tag--celebrate .action-trail-label {
  animation: wins-label-shine 1.4s ease-in-out 0.55s infinite;
}

@keyframes wins-label-shine {
  0%,
  100% {
    color: #fff;
  }
  50% {
    color: #fef08a;
  }
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

/** 筹码量：青绿 */
.p-chip-ico--stack {
  background: linear-gradient(145deg, #6ee7b7 0%, #059669 55%, #047857 100%);
  box-shadow:
    inset 0 1rpx 3rpx rgba(255, 255, 255, 0.4),
    0 1rpx 2rpx rgba(0, 0, 0, 0.2);
}

/** 当前注：玫红 */
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
  gap: 14rpx;
  flex-shrink: 0;
}

.analysis-box {
  margin-top: 10rpx;
  padding: 8rpx 10rpx;
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
  position: relative;
  background: $dock-bg;
  border-top: 1rpx solid rgba(255, 255, 255, 0.12);
  padding: 16rpx 24rpx 0;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

.replay-dock {
  position: relative;
  z-index: 1;
  margin-bottom: 14rpx;
}

.icp-record {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(6rpx + 3px);
  z-index: 0;
  text-align: center;
  font-size: 19rpx;
  color: #94a3b8;
  line-height: 1;
  text-decoration: underline;
}

.replay-row {
  position: relative;
  z-index: 1;
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
  position: relative;
  z-index: 1;
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

.voice-toggle {
  flex-shrink: 0;
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  background: #334155;
  align-items: center;
  justify-content: center;
  display: flex;
}

.voice-toggle--off {
  background: #1e293b;
  opacity: 0.72;
}

.voice-glyph {
  font-size: 28rpx;
  line-height: 1;
}

.dock-safe {
  height: 8rpx;
}
</style>
