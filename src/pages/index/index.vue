<template>
  <LaunchIntroModal :skip="skipIntroModal" />
  <view
    class="page-root"
    :class="{
      'page-root--rv': skipIntroModal && !isLandscapeMode,
      'page-root--ls': isLandscapeMode,
    }"
  >
    <scroll-view
      class="page-scroll"
      :class="{ 'page-scroll--ls': isLandscapeMode }"
      :scroll-y="!isLandscapeMode"
      :show-scrollbar="false"
      :style="scrollViewStyle"
    >
      <view class="page-inner" :class="{ 'page-inner--ls': isLandscapeMode }">
        <view class="ls-layout" :class="{ 'ls-layout--row': isLandscapeMode }">
          <view class="ls-col ls-col--table">
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
                :size="pokerCardSize"
                :highlight="boardHighlightSet.has(idx)"
              />
            </view>
          </view>
        </view>

        <view class="panel panel-players">
          <view class="ls-players-sync">
            <view v-if="isLandscapeMode" class="ls-player-head" aria-hidden="true"></view>
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
                  <PokerCard :code="p.hole[0]" :size="pokerCardSize" />
                  <PokerCard :code="p.hole[1]" :size="pokerCardSize" />
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
        </view>
          </view>

          <view class="ls-col ls-col--side">
        <view
          v-if="narrationVisible || isLandscapeMode"
          class="narration-block"
          :class="{ 'narration-block--ls': isLandscapeMode }"
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

        <view v-if="isLandscapeMode" class="ls-stats-panel">
          <view class="ls-equity-table">
            <view class="ls-equity-head">
              <text class="ls-equity-th">原始权益</text>
              <text class="ls-equity-th">平均权益</text>
              <text class="ls-equity-th">底池赔率</text>
            </view>
            <view
              v-for="(p, idx) in state.players"
              :key="'eq-' + p.id"
              class="ls-equity-row"
              :class="{ focus: state.focusPlayerId === p.id }"
            >
              <view class="ls-equity-td">
                <text class="ls-equity-val">{{ equityStepView.rows[idx]?.rawEquity ?? '--' }}</text>
                <text
                  v-if="equityStepView.rows[idx]?.rawEquityTrend === 'up'"
                  :key="'raw-up-' + idx + '-' + state.replayStep"
                  class="ls-equity-trend ls-equity-trend--up"
                >▲</text>
                <text
                  v-if="equityStepView.rows[idx]?.rawEquityTrend === 'down'"
                  :key="'raw-down-' + idx + '-' + state.replayStep"
                  class="ls-equity-trend ls-equity-trend--down"
                >▼</text>
              </view>
              <view class="ls-equity-td">
                <text class="ls-equity-val">{{ equityStepView.rows[idx]?.averageEquity ?? '--' }}</text>
                <text
                  v-if="equityStepView.rows[idx]?.averageEquityTrend === 'up'"
                  :key="'avg-up-' + idx + '-' + state.replayStep"
                  class="ls-equity-trend ls-equity-trend--up"
                >▲</text>
                <text
                  v-if="equityStepView.rows[idx]?.averageEquityTrend === 'down'"
                  :key="'avg-down-' + idx + '-' + state.replayStep"
                  class="ls-equity-trend ls-equity-trend--down"
                >▼</text>
              </view>
              <text class="ls-equity-td ls-equity-td--plain">{{ equityStepView.rows[idx]?.potOdds ?? '--' }}</text>
            </view>
          </view>
          <view class="ls-detail-area">
            <view class="ls-detail-head">
              <text class="ls-detail-head-title">详细信息</text>
            </view>
            <scroll-view class="ls-detail-scroll" scroll-y :show-scrollbar="false">
              <view v-if="!equityStepView.detailSections.length" class="ls-detail-empty">
                <text class="ls-detail-empty-text">此步暂无详细分布数据</text>
              </view>
              <view v-else class="ls-detail-panels">
                <view
                  v-for="(sec, si) in equityStepView.detailSections"
                  :key="'eq-sec-' + si"
                  class="ls-detail-panel"
                >
                  <view class="ls-detail-panel-head">
                    <text class="ls-detail-panel-caption">{{ sec.title }}({{ sec.subtitle }})</text>
                  </view>
                  <view class="ls-detail-bars">
                    <view
                      v-for="(item, bi) in sec.items"
                      :key="'eq-bar-' + si + '-' + bi"
                      class="ls-detail-bar-row"
                    >
                      <text class="ls-detail-bar-name">{{ item.name }}</text>
                      <view class="ls-detail-bar-track">
                        <view
                          class="ls-detail-bar-fill"
                          :style="{ width: (item.ratio * 100) + '%' }"
                        ></view>
                      </view>
                      <text class="ls-detail-bar-pct">{{ item.pct }}</text>
                    </view>
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
          </view>
        </view>

        <view v-if="!isLandscapeMode" class="scroll-pad" />
      </view>
    </scroll-view>

    <view v-if="!skipIntroModal" class="dock" :class="{ 'dock--ls': isLandscapeMode }">
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
                :activeColor="replaySliderActiveColor"
                backgroundColor="#475569"
                block-color="#f8fafc"
                block-size="14"
                @changing="onReplaySliderChanging"
                @change="onReplaySliderChange"
              ></slider>
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

      <view class="dock-safe"></view>
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
  applyLandscapeLaunchViewport,
  applyReviewLaunchViewport,
  getLandscapeViewportHeight,
  hasLaunchHandParams,
  isLandscapeLaunchMode,
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
const isLandscapeMode = isLandscapeLaunchMode(launchQuery);
const skipIntroModal = isReviewLaunchMode(launchQuery);
const pokerCardSize = computed(() => (isLandscapeMode ? "xl" : "lg"));
const isMpWeixin = process.env.UNI_PLATFORM === "mp-weixin";

// #ifdef H5
if (isLandscapeMode) {
  applyLandscapeLaunchViewport();
} else if (skipIntroModal) {
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
  equityStepView,
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
  if (isLandscapeMode) {
    const pageH = Math.min(
      getLandscapeViewportHeight(),
      sys.windowHeight,
      (sys.windowWidth * 9) / 16,
    );
    scrollHeightPx.value = Math.max(200, Math.floor(pageH - dockPx));
    return;
  }
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
  if (isLandscapeMode) {
    applyLandscapeLaunchViewport();
    updateScrollHeight();
  } else if (skipIntroModal) {
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

const replaySliderActiveColor = computed(() =>
  isLandscapeMode ? "#26a69a" : "#38bdf8",
);

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

/* 宽屏 ls=1：Simple GTO 色彩风格 */
$ls-bg: #0a0a0a;
$ls-surface: #1e1e1e;
$ls-surface-2: #262626;
$ls-border: rgba(255, 255, 255, 0.08);
$ls-teal: #26a69a;
$ls-teal-light: #4db6ac;
$ls-text-muted: #888888;
$ls-sync-head-h: 56rpx;
$ls-top-row-h: 15%;
$ls-top-row-gap: 10rpx;

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

.page-root.page-root--ls {
  max-width: 1280px;
  width: 100%;
  height: 720px;
  max-height: 100vh;
  background-color: $ls-bg;
}

.page-scroll--ls {
  overflow: hidden;
  background-color: $ls-bg;
}

.page-inner--ls {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 10rpx 16rpx 0;
  box-sizing: border-box;
  background-color: $ls-bg;
}

.ls-layout {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.ls-layout--row {
  flex-direction: row;
  align-items: stretch;
  gap: 14rpx;
  height: 100%;
  min-height: 0;
}

.ls-col {
  min-width: 0;
}

.ls-col--table {
  flex: 1;
  min-height: 0;
}

.ls-layout--row .ls-col--table {
  flex: 0 0 40%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.ls-col--side {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ls-layout--row .ls-col--side {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 宽屏顶行：公牌区与解说区同高、同间距、同内边距 */
.ls-layout--row .panel-board,
.ls-layout--row .narration-block--ls {
  flex: 0 0 $ls-top-row-h;
  height: $ls-top-row-h;
  min-height: 0;
  max-height: $ls-top-row-h;
  margin-bottom: $ls-top-row-gap;
  box-sizing: border-box;
  overflow: hidden;
}

.ls-layout--row .panel-board {
  padding: 10rpx 14rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.ls-layout--row .narration-block--ls {
  padding: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  border: none;
}

.ls-layout--row .narration-block--ls .panel-narration {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 10rpx 14rpx;
  box-sizing: border-box;
  overflow-y: auto;
}

.ls-layout--row .panel-narration-fill {
  min-height: 0;
}

.ls-layout--row .panel-players,
.ls-layout--row .ls-stats-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.ls-equity-head,
.ls-detail-head,
.ls-player-head {
  flex: 0 0 $ls-sync-head-h;
  height: $ls-sync-head-h;
  min-height: $ls-sync-head-h;
  max-height: $ls-sync-head-h;
  background: rgba(38, 166, 154, 0.18);
  border-bottom: 1rpx solid rgba(38, 166, 154, 0.28);
  box-sizing: border-box;
}

.page-inner--ls .panel.panel-players {
  margin-bottom: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

.page-inner--ls .ls-players-sync {
  flex: 1;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  border-top: 1rpx solid transparent;
}

.page-inner--ls .player-card {
  flex: 1 1 0;
  min-height: 0;
  margin-bottom: 0;
  padding: 0 12rpx;
  border-radius: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.page-inner--ls .analysis-box {
  display: none;
}

.narration-block--ls {
  margin-bottom: 0;
}

.page-inner--ls .ls-layout--row .panel.panel-board {
  margin-bottom: $ls-top-row-gap;
}

.narration-block--ls .panel-narration {
  background: $ls-surface;
  border-color: rgba(38, 166, 154, 0.35);
  margin-bottom: 0;
}

.ls-stats-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  gap: 10rpx;
  box-sizing: border-box;
}

.ls-equity-table {
  flex: 0 0 42%;
  display: flex;
  flex-direction: column;
  background: $ls-surface;
  border: 1rpx solid $ls-border;
  border-radius: 16rpx;
  overflow: hidden;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
}

.ls-equity-head,
.ls-equity-row {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.ls-equity-th,
.ls-equity-td {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #f5f5f5;
  padding: 0 8rpx;
  box-sizing: border-box;
  min-height: 0;
}

.ls-equity-th,
.ls-detail-head-title {
  font-weight: 700;
  font-size: 30rpx;
  color: $ls-teal-light;
}

.ls-equity-th {
  height: 100%;
  line-height: 1.2;
}

.ls-equity-row {
  flex: 1 1 0;
  min-height: 0;
  box-sizing: border-box;
}

.ls-equity-td {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  font-size: 36rpx;
  font-weight: 600;
  color: rgba(245, 245, 245, 0.95);
  box-sizing: border-box;
  min-height: 0;
}

.ls-equity-td--plain {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ls-equity-val {
  line-height: 1.1;
}

.ls-equity-trend {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.ls-equity-trend--up {
  color: #4ade80;
  animation: ls-equity-trend-up 0.55s ease-out;
}

.ls-equity-trend--down {
  color: #f87171;
  animation: ls-equity-trend-down 0.55s ease-out;
}

@keyframes ls-equity-trend-up {
  0% {
    opacity: 0;
    transform: translateY(8rpx) scale(0.55);
  }
  55% {
    opacity: 1;
    transform: translateY(-6rpx) scale(1.2);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes ls-equity-trend-down {
  0% {
    opacity: 0;
    transform: translateY(-8rpx) scale(0.55);
  }
  55% {
    opacity: 1;
    transform: translateY(6rpx) scale(1.2);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.ls-detail-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  background: $ls-surface-2;
  border: 1rpx solid $ls-border;
  border-radius: 16rpx;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.ls-detail-head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.ls-detail-head-title {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  text-align: center;
  line-height: 1;
}

.ls-detail-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 10rpx 12rpx;
  box-sizing: border-box;
}

.ls-detail-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80rpx;
}

.ls-detail-empty-text {
  font-size: 32rpx;
  color: $ls-text-muted;
}

.ls-detail-panels {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding-bottom: 4rpx;
}

.ls-detail-panel {
  background: rgba(0, 0, 0, 0.22);
  border: 1rpx solid $ls-border;
  border-radius: 12rpx;
  padding: 10rpx 12rpx;
  box-sizing: border-box;
}

.ls-detail-panel-head {
  margin-bottom: 6rpx;
  padding-bottom: 6rpx;
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.06);
}

.ls-detail-panel-caption {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: rgba(245, 245, 245, 0.88);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ls-detail-bars {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.ls-detail-bar-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  min-height: 42rpx;
}

.ls-detail-bar-name {
  flex: 0 0 108rpx;
  font-size: 30rpx;
  color: rgba(245, 245, 245, 0.92);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ls-detail-bar-track {
  flex: 1;
  min-width: 0;
  height: 20rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8rpx;
  overflow: hidden;
}

.ls-detail-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, $ls-teal 0%, $ls-teal-light 100%);
  border-radius: 8rpx;
}

.ls-detail-bar-pct {
  flex: 0 0 88rpx;
  text-align: right;
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}

.ls-detail-placeholder {
  font-size: 22rpx;
  color: $ls-text-muted;
}

.dock--ls {
  padding: 16rpx 24rpx 0;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}

/* 宽屏主题：面板 / 玩家 / 控件 */
.page-root--ls .panel {
  background-color: $ls-surface;
  border-color: $ls-border;
}

.page-root--ls .player-card {
  background: $ls-surface-2;
  border: 2rpx solid transparent;
  border-bottom: 1rpx solid $ls-border;
}

.page-root--ls .player-card:last-child:not(.focus) {
  border-bottom: none;
}

.page-root--ls .player-card.focus {
  border: 2rpx solid $ls-teal;
  box-shadow: 0 0 0 2rpx rgba(38, 166, 154, 0.35);
}

.page-root--ls .ls-equity-row {
  border: 2rpx solid transparent;
  border-bottom: 1rpx solid $ls-border;
}

.page-root--ls .ls-equity-row.focus {
  border: 2rpx solid $ls-teal;
  box-shadow: 0 0 0 2rpx rgba(38, 166, 154, 0.35);
}

.page-root--ls .ls-equity-row:last-child:not(.focus) {
  border-bottom: none;
}

.page-root--ls .pot-bar {
  border-color: $ls-teal;
  background: rgba(38, 166, 154, 0.1);
}

.page-root--ls .pot-text {
  color: $ls-teal-light;
}

.page-root--ls .blinds-level {
  color: $ls-text-muted;
}

.page-root--ls .nar-step-glyph {
  color: $ls-teal;
}

.page-root--ls .nar-head-chips {
  color: $ls-teal-light;
}

.page-root--ls .nar-body,
.page-root--ls .nar-summary,
.page-root--ls .nar-head {
  color: #f5f5f5;
}

.page-root--ls .nar-action {
  color: rgba(245, 245, 245, 0.82);
}

.page-root--ls .nar-muted {
  color: $ls-text-muted;
}

.page-root--ls .action-trail-item {
  background: rgba(38, 166, 154, 0.82);
}

.page-root--ls .action-pill {
  background: rgba(38, 166, 154, 0.82);
}

.page-root--ls .nav-hand {
  color: $ls-teal-light;
}

.page-root--ls .play-toggle,
.page-root--ls .voice-toggle {
  background: #2a2a2a;
}

.page-root--ls .icp-record {
  color: $ls-text-muted;
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

.page-root.page-root--ls .dock,
.dock.dock--ls {
  background: #141414;
  border-top-color: $ls-border;
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
