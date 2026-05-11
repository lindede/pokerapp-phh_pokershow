import { onUnmounted, reactive } from "vue";
import type {
  ByActionEvent,
  CommentaryActionItem,
  CommentaryReplayMeta,
  HandCommentaryPayload,
  PlayerPayload,
  PlayerState,
  Street,
} from "@/types/commentary";
import { adaptCommentaryResponse } from "@/utils/commentary2Adapter";
import {
  computeReplaySnapshot,
} from "@/utils/replayByAction";
import {
  buildReplayCumulativeMs,
  stepIndexFromElapsedMs,
} from "@/utils/replayTiming";
import {
  COMMENTARY_API_URL,
  DEV_COMMENTARY_DATASET_KEY,
  DEV_COMMENTARY_HAND_INDEX,
} from "@/config/commentary-api";
import { DEFAULT_PLAYERS, SAMPLE_PAYLOAD } from "@/mock/sample-commentary";

function clonePlayers(base: PlayerState[]): PlayerState[] {
  return JSON.parse(JSON.stringify(base)) as PlayerState[];
}

/** 最近一次成功应用解说数据后的界面快照（重置时从此恢复，不发请求） */
export interface CommentaryUISnapshot {
  datasetKey: string;
  handIndex: string;
  pot: number;
  board: (string | null)[];
  street: Street;
  players: PlayerState[];
  focusPlayerId: string | null;
  serverSummary: string;
  serverByAction: CommentaryActionItem[];
  /** 旧快照可能缺省 */
  byActionTimeline?: ByActionEvent[];
  replayMeta?: CommentaryReplayMeta | null;
  /** 重置时回到的时间位置（毫秒，沿整条 action 时间线） */
  replayRestoreElapsedMs?: number;
  /** 兼容旧快照：仅有步号时推导 elapsed */
  replayRestoreStep?: number;
}

export interface LoadCommentaryOptions {
  /** 为 true 时不弹出「已更新」提示（仍弹出错误提示） */
  silentToast?: boolean;
}

function mergePlayers(target: PlayerState[], incoming: PlayerPayload[]) {
  incoming.forEach((inc) => {
    const byId = inc.id != null ? target.find((p) => p.id === inc.id) : undefined;
    const bySeat =
      inc.seat != null && inc.seat >= 0 && inc.seat < target.length
        ? target[inc.seat]
        : undefined;
    const t = byId ?? bySeat;
    if (!t) return;
    if (inc.position != null) t.positionLabel = inc.position;
    if (inc.positionKey != null) t.positionKey = inc.positionKey;
    if (inc.name != null) t.name = inc.name;
    if (inc.stack != null) t.stack = inc.stack;
    if (inc.bet != null) t.bet = inc.bet;
    if (inc.hole != null) {
      t.hole = [
        inc.hole[0] ?? null,
        inc.hole[1] ?? null,
      ] as [string | null, string | null];
    }
    if (inc.action != null) t.action = inc.action;
    if (inc.analysisZh != null) t.analysisZh = inc.analysisZh;
    if (inc.analysisZhDetail != null) t.analysisZhDetail = inc.analysisZhDetail;
    if (inc.analysisEn != null) t.analysisEn = inc.analysisEn;
    if (inc.winner != null) t.winner = inc.winner;
    if (inc.folded != null) t.folded = inc.folded;
  });
}

export function useCommentaryHand() {
  let serverSnapshot: CommentaryUISnapshot | null = null;
  /** cumulativeMs.length === timeline.length + 1 */
  let replayCumulativeMs: number[] = [0];
  let rafId = 0;
  let lastRafTs = 0;

  const state = reactive({
    datasetKey: DEV_COMMENTARY_DATASET_KEY,
    handIndex: DEV_COMMENTARY_HAND_INDEX,
    pot: 0,
    board: [null, null, null, null, null] as (string | null)[],
    street: "preflop" as Street,
    players: clonePlayers(DEFAULT_PLAYERS),
    focusPlayerId: null as string | null,
    loading: false,
    serverSummary: "",
    serverByAction: [] as CommentaryActionItem[],
    byActionTimeline: [] as ByActionEvent[],
    replayMeta: null as CommentaryReplayMeta | null,
    replayStep: 0,
    replayHeadline: "",
    replayHeadlineChips: "",
    replayDetailText: "",
    replayElapsedMs: 0,
    replayTotalMs: 0,
    replayPlaying: false,
  });

  function pauseReplayInternal() {
    state.replayPlaying = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    lastRafTs = 0;
  }

  function recomputeReplayCumulative() {
    const tl = state.byActionTimeline;
    if (!tl.length) {
      replayCumulativeMs = [0];
      state.replayTotalMs = 0;
      return;
    }
    const { cumulativeMs, totalMs } = buildReplayCumulativeMs(tl);
    replayCumulativeMs = cumulativeMs;
    state.replayTotalMs = totalMs;
  }

  function syncReplayFromTimeline() {
    const tl = state.byActionTimeline;
    if (!tl.length) {
      state.replayHeadline = "";
      state.replayHeadlineChips = "";
      state.replayDetailText = "";
      return;
    }
    const snap = computeReplaySnapshot(
      tl,
      state.replayStep,
      state.replayMeta,
      6,
    );
    state.board.splice(0, 5, ...snap.board);
    state.street = snap.street;
    state.pot = snap.pot;
    snap.holes.forEach((hole, i) => {
      const pl = state.players[i];
      if (!pl) return;
      pl.hole = [hole[0], hole[1]];
      pl.stack = snap.stacks[i];
      pl.folded = snap.folded[i];
      pl.action = "";
      pl.bet = snap.handBets[i] ?? 0;
      pl.actionTrail = snap.playerActionTrail[i]?.map((x) => ({ ...x })) ?? [];
    });

    const atReplayEnd = state.replayStep >= tl.length - 1;
    const winSeat = state.players.findIndex((pl) => pl.winner);
    if (atReplayEnd && winSeat >= 0) {
      state.focusPlayerId = state.players[winSeat]!.id;
    } else {
      state.focusPlayerId =
        snap.stepSeatFocus != null ? `p${snap.stepSeatFocus}` : null;
    }

    const tot = tl.length;
    const n = state.replayStep + 1;
    state.replayHeadline =
      snap.stepSeatFocus != null
        ? `${n}/${tot} · ${snap.stepSeatName || `座位${snap.stepSeatFocus + 1}`} · ${snap.stepActionZh}`
        : `${n}/${tot} · ${snap.stepActionZh}`;
    state.replayHeadlineChips = snap.stepHeadlineChipsLine ?? "";
    state.replayDetailText = snap.stepDetailText;
  }

  function syncReplayStepFromElapsed() {
    const tl = state.byActionTimeline;
    if (!tl.length || !state.replayTotalMs) return;
    const idx = stepIndexFromElapsedMs(state.replayElapsedMs, replayCumulativeMs);
    if (idx !== state.replayStep) {
      state.replayStep = idx;
      syncReplayFromTimeline();
    }
  }

  function replayTick(ts: number) {
    if (!state.replayPlaying) return;
    if (!lastRafTs) lastRafTs = ts;
    const dt = ts - lastRafTs;
    lastRafTs = ts;
    state.replayElapsedMs += dt;
    if (state.replayElapsedMs >= state.replayTotalMs) {
      state.replayElapsedMs = state.replayTotalMs;
      pauseReplayInternal();
      const idx = stepIndexFromElapsedMs(state.replayElapsedMs, replayCumulativeMs);
      if (idx !== state.replayStep) {
        state.replayStep = idx;
        syncReplayFromTimeline();
      }
      return;
    }
    syncReplayStepFromElapsed();
    rafId = requestAnimationFrame(replayTick);
  }

  /** 从当前 elapsed/step 开始自动播放（会先停掉上一轮的 rAF） */
  function startReplayPlayback() {
    if (!state.byActionTimeline.length || !state.replayTotalMs) return;
    pauseReplayInternal();
    state.replayPlaying = true;
    lastRafTs = 0;
    rafId = requestAnimationFrame(replayTick);
  }

  function toggleReplayPlay() {
    const tl = state.byActionTimeline;
    if (!tl.length || !state.replayTotalMs) return;
    if (state.replayPlaying) {
      pauseReplayInternal();
      return;
    }
    if (state.replayElapsedMs >= state.replayTotalMs - 0.5) {
      state.replayElapsedMs = 0;
      state.replayStep = 0;
      syncReplayFromTimeline();
    }
    startReplayPlayback();
  }

  /** 进度条 0–100（拖拽会先暂停自动播放） */
  function seekReplayPercent(percent: number) {
    if (!state.byActionTimeline.length || !state.replayTotalMs) return;
    pauseReplayInternal();
    const p = Math.min(100, Math.max(0, percent));
    state.replayElapsedMs = (p / 100) * state.replayTotalMs;
    const idx = stepIndexFromElapsedMs(state.replayElapsedMs, replayCumulativeMs);
    state.replayStep = idx;
    syncReplayFromTimeline();
  }

  /** 跳到指定 action 步（会暂停自动播放，时间与进度条对齐到该步起点） */
  function seekReplayToStep(step: number) {
    const tl = state.byActionTimeline;
    if (!tl.length || !state.replayTotalMs) return;
    pauseReplayInternal();
    const n = tl.length;
    const s = Math.min(Math.max(0, Math.floor(step)), n - 1);
    state.replayStep = s;
    state.replayElapsedMs = replayCumulativeMs[s] ?? 0;
    syncReplayFromTimeline();
  }

  function seekReplayStepDelta(delta: number) {
    seekReplayToStep(state.replayStep + delta);
  }

  function captureSnapshot() {
    serverSnapshot = {
      datasetKey: state.datasetKey,
      handIndex: state.handIndex,
      pot: state.pot,
      board: [...state.board],
      street: state.street,
      players: clonePlayers(state.players),
      focusPlayerId: state.focusPlayerId,
      serverSummary: state.serverSummary,
      serverByAction: state.serverByAction.map((x) => ({
        event_index: x.event_index,
        text: x.text,
      })),
      byActionTimeline: state.byActionTimeline.map((e) => ({ ...e })),
      replayMeta: state.replayMeta
        ? {
            startingStacks: [...state.replayMeta.startingStacks],
            finishingStacks: [...state.replayMeta.finishingStacks],
            blindsOrStraddles: state.replayMeta.blindsOrStraddles
              ? [...state.replayMeta.blindsOrStraddles]
              : undefined,
          }
        : null,
      replayRestoreElapsedMs: state.replayTotalMs > 0 ? state.replayElapsedMs : 0,
      replayRestoreStep:
        state.byActionTimeline.length > 0
          ? state.byActionTimeline.length - 1
          : 0,
    };
  }

  function applyPayload(payload: HandCommentaryPayload) {
    if (payload.datasetKey != null) state.datasetKey = payload.datasetKey;
    if (payload.handIndex != null) state.handIndex = String(payload.handIndex);
    if (payload.pot != null) state.pot = payload.pot;
    if (payload.board != null) {
      const next = [...payload.board];
      while (next.length < 5) next.push(null);
      state.board.splice(0, 5, ...next.slice(0, 5));
    }
    if (payload.street != null) state.street = payload.street;
    if (payload.focusPlayerId !== undefined) {
      state.focusPlayerId = payload.focusPlayerId;
    }
    if (payload.players != null && payload.players.length > 0) {
      if ("commentarySummary" in payload) {
        state.players.forEach((t) => {
          t.analysisZh = "";
          t.analysisZhDetail = "";
          t.analysisEn = "";
          t.action = "";
          t.actionTrail = [];
          t.winner = false;
          t.folded = false;
        });
      }
      mergePlayers(state.players, payload.players);
    }

    pauseReplayInternal();

    if (payload.byActionTimeline != null && payload.byActionTimeline.length > 0) {
      state.byActionTimeline = payload.byActionTimeline.map((e) => ({ ...e }));
      state.replayMeta = payload.replayMeta
        ? {
            startingStacks: [...payload.replayMeta.startingStacks],
            finishingStacks: [...payload.replayMeta.finishingStacks],
            blindsOrStraddles: payload.replayMeta.blindsOrStraddles
              ? [...payload.replayMeta.blindsOrStraddles]
              : undefined,
          }
        : null;
      recomputeReplayCumulative();
      state.replayElapsedMs = 0;
      state.replayStep = 0;
    } else {
      state.byActionTimeline = [];
      state.replayMeta = null;
      state.replayStep = 0;
      state.replayHeadline = "";
      state.replayHeadlineChips = "";
      state.replayDetailText = "";
      state.replayElapsedMs = 0;
      state.replayTotalMs = 0;
      replayCumulativeMs = [0];
      state.players.forEach((p) => {
        p.folded = false;
        p.actionTrail = [];
      });
    }
    if ("commentarySummary" in payload) {
      state.serverSummary = payload.commentarySummary ?? "";
    }
    if ("commentaryByAction" in payload && payload.commentaryByAction != null) {
      state.serverByAction = payload.commentaryByAction.map((x) => ({
        event_index: x.event_index,
        text: x.text,
      }));
    }

    if (state.byActionTimeline.length > 0) {
      syncReplayFromTimeline();
      captureSnapshot();
      startReplayPlayback();
    } else {
      captureSnapshot();
    }
  }

  /** 开发调试用：载入内置示例快照 */
  function loadSample() {
    applyPayload(SAMPLE_PAYLOAD);
    uni.showToast({ title: "已载入示例", icon: "none" });
  }

  function parseNumericHandIndex(): number | null {
    const s = String(state.handIndex).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /** 请求当前 k / i 下的解说数据 */
  function loadApi(opts?: LoadCommentaryOptions) {
    if (state.loading) return;
    if (!COMMENTARY_API_URL || !COMMENTARY_API_URL.trim()) {
      uni.showToast({
        title: "请配置 COMMENTARY_API_URL",
        icon: "none",
        duration: 2800,
      });
      return;
    }
    state.loading = true;
    const url =
      `${COMMENTARY_API_URL.trim()}?k=${encodeURIComponent(state.datasetKey)}&i=${encodeURIComponent(state.handIndex)}`;
    uni.request({
      url,
      method: "GET",
      success: (res) => {
        state.loading = false;
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data != null) {
          const payload = adaptCommentaryResponse(res.data);
          if (!payload) {
            uni.showToast({
              title: "返回数据无法解析",
              icon: "none",
              duration: 2500,
            });
            return;
          }
          applyPayload(payload);
          if (!opts?.silentToast) {
            uni.showToast({ title: "已更新", icon: "none" });
          }
        } else {
          uni.showToast({
            title: `请求失败 HTTP ${res.statusCode ?? "?"}`,
            icon: "none",
          });
        }
      },
      fail: (err) => {
        state.loading = false;
        const msg =
          err && typeof err === "object" && "errMsg" in err
            ? String((err as { errMsg?: string }).errMsg ?? "")
            : "";
        uni.showToast({
          title: msg ? msg.slice(0, 72) : "网络错误",
          icon: "none",
          duration: 3200,
        });
      },
    });
  }

  function loadPrevHand() {
    const n = parseNumericHandIndex();
    if (n == null) {
      uni.showToast({
        title: "手牌编号不是数字，无法切换",
        icon: "none",
      });
      return;
    }
    if (n <= 0) {
      uni.showToast({ title: "已是第一局", icon: "none" });
      return;
    }
    state.handIndex = String(n - 1);
    loadApi({ silentToast: true });
  }

  function loadNextHand() {
    const n = parseNumericHandIndex();
    if (n == null) {
      uni.showToast({
        title: "手牌编号不是数字，无法切换",
        icon: "none",
      });
      return;
    }
    state.handIndex = String(n + 1);
    loadApi({ silentToast: true });
  }

  /** 重置：不请求网络，用最近一次成功加载的快照重新初始化 UI */
  function resetTable() {
    pauseReplayInternal();
    if (!serverSnapshot) {
      state.pot = 0;
      state.board.splice(0, 5, null, null, null, null, null);
      state.street = "preflop";
      state.players = clonePlayers(DEFAULT_PLAYERS);
      state.focusPlayerId = null;
      state.datasetKey = DEV_COMMENTARY_DATASET_KEY;
      state.handIndex = DEV_COMMENTARY_HAND_INDEX;
      state.serverSummary = "";
      state.serverByAction = [];
      state.byActionTimeline = [];
      state.replayMeta = null;
      state.replayStep = 0;
      state.replayHeadline = "";
      state.replayHeadlineChips = "";
      state.replayDetailText = "";
      state.replayElapsedMs = 0;
      state.replayTotalMs = 0;
      replayCumulativeMs = [0];
      uni.showToast({ title: "暂无缓存，已恢复初始", icon: "none" });
      return;
    }
    const snap = serverSnapshot;
    state.datasetKey = snap.datasetKey;
    state.handIndex = snap.handIndex;
    state.pot = snap.pot;
    state.serverSummary = snap.serverSummary;
    state.serverByAction = snap.serverByAction.map((x) => ({
      event_index: x.event_index,
      text: x.text,
    }));

    const tl = snap.byActionTimeline ?? [];
    if (tl.length > 0 && snap.replayMeta) {
      state.byActionTimeline = tl.map((e) => ({ ...e }));
      state.replayMeta = {
        startingStacks: [...snap.replayMeta.startingStacks],
        finishingStacks: [...snap.replayMeta.finishingStacks],
        blindsOrStraddles: snap.replayMeta.blindsOrStraddles
          ? [...snap.replayMeta.blindsOrStraddles]
          : undefined,
      };
      state.players = clonePlayers(snap.players);
      recomputeReplayCumulative();
      state.replayElapsedMs = 0;
      state.replayStep = 0;
      syncReplayFromTimeline();
      captureSnapshot();
      startReplayPlayback();
    } else {
      state.byActionTimeline = [];
      state.replayMeta = null;
      state.replayStep = 0;
      state.replayHeadline = "";
      state.replayHeadlineChips = "";
      state.replayDetailText = "";
      state.replayElapsedMs = 0;
      state.replayTotalMs = 0;
      replayCumulativeMs = [0];
      state.board.splice(0, 5, ...snap.board);
      state.street = snap.street;
      state.players = clonePlayers(snap.players);
      state.focusPlayerId = snap.focusPlayerId;
    }

    uni.showToast({ title: "已重置", icon: "none" });
  }

  onUnmounted(() => {
    pauseReplayInternal();
  });

  return {
    state,
    /** 供 WebSocket / 轮询拿到 JSON 后直接刷新界面 */
    applyPayload,
    loadSample,
    loadApi,
    resetTable,
    loadPrevHand,
    loadNextHand,
    toggleReplayPlay,
    seekReplayPercent,
    seekReplayToStep,
    seekReplayStepDelta,
  };
}
