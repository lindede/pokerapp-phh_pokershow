import { computed, onUnmounted, reactive } from "vue";
import type {
  ByActionEvent,
  CommentaryActionItem,
  CommentaryReplayMeta,
  HandCommentaryPayload,
  PlayerPayload,
  PlayerState,
  Street,
} from "@/types/commentary";
import type { EquityByActionEvent } from "@/types/commentaryEquity";
import { adaptCommentaryResponse } from "@/utils/commentary2Adapter";
import {
  adaptEquityResponse,
  buildEquityStepView,
} from "@/utils/commentaryEquityAdapter";
import {
  computeReplaySnapshot,
} from "@/utils/replayByAction";
import {
  buildReplayCumulativeMs,
  durationForByActionStep,
  stepIndexFromElapsedMs,
} from "@/utils/replayTiming";
import { DEFAULT_PLAYERS, SAMPLE_PAYLOAD } from "@/mock/sample-commentary";
import type {
  CommentaryVoicePlayer,
  VoiceIndexMap,
  VoiceListResponse,
} from "@/types/commentaryVoice";
// #ifdef H5
import {
  createRecordingVoicePlayer,
  isWebVideoCaptureEnvironment,
  scheduleRecordingAwareTimeout,
  whenCaptureStarted,
} from "@/utils/commentaryVoiceRecording";
// #endif
import { isReviewLaunchMode, parseLaunchQuery } from "@/utils/launchQuery";
import { cancelScheduledFrame, scheduleFrame } from "@/utils/animationFrame";

let VOICE_START_TIMEOUT_MS: number;
// #ifdef MP-WEIXIN
VOICE_START_TIMEOUT_MS = 30000;
// #endif
// #ifndef MP-WEIXIN
VOICE_START_TIMEOUT_MS = 6000;
// #endif

/** 语音 list 过慢时仍先开视觉回放，避免首屏一直停在第 0 步 */
const VOICE_LIST_AUTOPLAY_MAX_WAIT_MS = 4000;
/** 语音步进兜底：未知时长用上限；已知时长 = 音频 + 尾缓冲 */
const VOICE_STEP_FALLBACK_MAX_MS = 120_000;
const VOICE_END_TAIL_MS = 400;
/** 忽略过早 native ended（H5 常提前触发） */
const VOICE_ENDED_MIN_ELAPSED_MS = 800;

function computeVoiceStepWaitMs(durationHintMs: number): number {
  if (durationHintMs > 0) {
    return Math.min(
      VOICE_STEP_FALLBACK_MAX_MS,
      durationHintMs + VOICE_END_TAIL_MS,
    );
  }
  return VOICE_STEP_FALLBACK_MAX_MS;
}

function buildVoiceIndexMap(list: [string, string][]): VoiceIndexMap {
  const map: VoiceIndexMap = new Map();
  for (const pair of list) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const key = String(pair[0] ?? "").trim();
    const file = String(pair[1] ?? "").trim();
    if (key && file) map.set(key, file);
  }
  return map;
}

function voiceListKeyForEventIndex(eventIndex: number): string | null {
  if (!Number.isFinite(eventIndex)) return null;
  return String(Math.floor(eventIndex)).padStart(2, "0");
}

function resolveVoiceFilename(
  eventIndex: number,
  indexMap: VoiceIndexMap,
): string | null {
  if (!indexMap.size) return null;
  const key = voiceListKeyForEventIndex(eventIndex);
  if (key == null) return null;
  return indexMap.get(key) ?? null;
}

function fetchVoiceList(
  listApiUrl: string,
  datasetKey: string,
  handIndex: string | number,
): Promise<VoiceIndexMap> {
  const url =
    `${listApiUrl.trim()}?k=${encodeURIComponent(datasetKey)}&i=${encodeURIComponent(String(handIndex))}&_t=${Date.now()}`;
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: "GET",
      timeout: 30000,
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300 || res.data == null) {
          reject(new Error(`voice list HTTP ${res.statusCode ?? "?"}`));
          return;
        }
        const body = res.data as VoiceListResponse;
        if (body.error) {
          reject(new Error(String(body.error)));
          return;
        }
        const list = Array.isArray(body.list) ? body.list : [];
        resolve(buildVoiceIndexMap(list));
      },
      fail: (err) => reject(err),
    });
  });
}

function buildVoiceDataUrl(
  dataApiUrl: string,
  datasetKey: string,
  handIndex: string | number,
  filename: string,
): string {
  return `${dataApiUrl.trim()}?k=${encodeURIComponent(datasetKey)}&i=${encodeURIComponent(String(handIndex))}&n=${encodeURIComponent(filename)}`;
}

function readInnerAudioDurationMs(audio: UniApp.InnerAudioContext): number {
  const sec = audio.duration;
  if (typeof sec === "number" && Number.isFinite(sec) && sec > 0) {
    return Math.round(sec * 1000);
  }
  return 0;
}

function createCommentaryVoicePlayer(): CommentaryVoicePlayer {
  let ctx: UniApp.InnerAudioContext | null = null;
  let onEndedCb: (() => void) | null = null;
  let onErrorCb: (() => void) | null = null;
  let onStartCb: ((durationMs: number) => void) | null = null;
  let onDurationReviseCb: ((durationMs: number) => void) | null = null;
  let playAttemptId = 0;
  let playStarted = false;
  let startWatchId: ReturnType<typeof setTimeout> | null = null;

  function clearStartWatch() {
    if (startWatchId != null) {
      clearTimeout(startWatchId);
      startWatchId = null;
    }
  }

  function fireError(attemptId: number) {
    if (attemptId !== playAttemptId) return;
    clearStartWatch();
    onErrorCb?.();
  }

  function disposeCtx() {
    if (!ctx) return;
    try {
      ctx.stop();
      ctx.destroy();
    } catch {
      /* ignore */
    }
    ctx = null;
  }

  function notifyDurationIfReady(audio: UniApp.InnerAudioContext) {
    const dur = readInnerAudioDurationMs(audio);
    if (dur > 0) onDurationReviseCb?.(dur);
  }

  function tryStartPlayback(attemptId: number) {
    if (attemptId !== playAttemptId || playStarted || !ctx) return;
    try {
      const ret = ctx.play() as void | Promise<void>;
      if (ret != null && typeof (ret as Promise<void>).catch === "function") {
        (ret as Promise<void>).catch(() => fireError(attemptId));
      }
    } catch {
      fireError(attemptId);
    }
  }

  function bindCtxHandlers(audio: UniApp.InnerAudioContext) {
    audio.onPlay(() => {
      playStarted = true;
      clearStartWatch();
      onStartCb?.(readInnerAudioDurationMs(audio));
      notifyDurationIfReady(audio);
    });
    audio.onCanplay(() => {
      if (playStarted) {
        notifyDurationIfReady(audio);
        return;
      }
      tryStartPlayback(playAttemptId);
    });
    audio.onEnded(() => {
      clearStartWatch();
      onEndedCb?.();
    });
    audio.onError(() => {
      fireError(playAttemptId);
    });
  }

  function ensureCtx(): UniApp.InnerAudioContext {
    if (ctx) return ctx;
    const audio = uni.createInnerAudioContext();
    audio.autoplay = false;
    // #ifdef MP-WEIXIN
    audio.obeyMuteSwitch = false;
    // #endif
    bindCtxHandlers(audio);
    ctx = audio;
    return audio;
  }

  return {
    play(
      url: string,
      opts?: {
        onEnded?: () => void;
        onError?: () => void;
        onStart?: (durationMs: number) => void;
        onDurationRevise?: (durationMs: number) => void;
      },
    ) {
      const attemptId = ++playAttemptId;
      playStarted = false;
      clearStartWatch();
      onEndedCb = opts?.onEnded ?? null;
      onErrorCb = opts?.onError ?? null;
      onStartCb = opts?.onStart ?? null;
      onDurationReviseCb = opts?.onDurationRevise ?? null;
      const audio = ensureCtx();
      try {
        audio.stop();
      } catch {
        /* ignore */
      }
      audio.src = url;
      tryStartPlayback(attemptId);
      startWatchId = setTimeout(() => {
        if (attemptId !== playAttemptId || playStarted) return;
        fireError(attemptId);
      }, VOICE_START_TIMEOUT_MS);
    },
    stop() {
      playAttemptId += 1;
      clearStartWatch();
      onEndedCb = null;
      onErrorCb = null;
      onStartCb = null;
      onDurationReviseCb = null;
      if (ctx) ctx.stop();
    },
    destroy() {
      playAttemptId += 1;
      clearStartWatch();
      onEndedCb = null;
      onErrorCb = null;
      onStartCb = null;
      onDurationReviseCb = null;
      disposeCtx();
    },
  };
}

/** 解说 / 语音 API：条件编译，避免独立 config 模块在小程序里被错误注入 require('url') */
let COMMENTARY_API_URL: string;
let VOICE_LIST_API_URL: string;
let VOICE_DATA_API_URL: string;
let EQUITY_API_URL: string;
// #ifdef H5
/** H5 开发 / 生产均走同源 /v1、/v2（开发靠 Vite 代理，生产靠 Nginx 反代） */
COMMENTARY_API_URL = "/v1/CommentaryLite";
VOICE_LIST_API_URL = "/v2/Commentary/voice/list";
VOICE_DATA_API_URL = "/v2/Commentary/voice/data";
EQUITY_API_URL = "/v2/Commentary/additional/equity";
// #endif
// #ifndef H5
COMMENTARY_API_URL = "https://www.pokershow.top/v1/CommentaryLite";
VOICE_LIST_API_URL = "https://www.pokershow.top/v2/Commentary/voice/list";
VOICE_DATA_API_URL = "https://www.pokershow.top/v2/Commentary/voice/data";
EQUITY_API_URL = "https://www.pokershow.top/v2/Commentary/additional/equity";
// #endif

const DEV_COMMENTARY_DATASET_KEY = "all";
const DEV_COMMENTARY_HAND_INDEX = "-1";

/** 语音 list/data 须用 CommentaryLite 返回的 meta.i；占位 -1 仅用于首屏请求，不能拉语音 */
function isVoiceHandIndexReady(handIndex: string | number): boolean {
  const i = String(handIndex).trim();
  return Boolean(i && i !== DEV_COMMENTARY_HAND_INDEX);
}

function clonePlayers(base: PlayerState[]): PlayerState[] {
  return JSON.parse(JSON.stringify(base)) as PlayerState[];
}

/** 最近一次成功应用解说数据后的界面快照（重置时从此恢复，不发请求） */
export interface CommentaryUISnapshot {
  datasetKey: string;
  handIndex: string;
  /** 语音 list 就绪后的 meta.i（与 voiceListHandIndex 同步，供下一局等 UI 逻辑） */
  voiceHandIndex?: string;
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
}

export interface LoadCommentaryOptions {
  /** 为 true 时不弹出「已更新」提示（仍弹出错误提示） */
  silentToast?: boolean;
  /**
   * 指定本次 CommentaryLite 请求的 i（如「下一局」= meta.i+1）。
   * 在响应成功前不写入 state.handIndex，避免语音 data 与 list 的 i 错位。
   */
  requestHandIndex?: string;
  /**
   * false：有回放时间线时停在第 0 步且不自动播（供特殊入口使用）；
   * 默认 true：从第 0 步自动播完整条时间线。
   */
  replayAutoplay?: boolean;
  /** 请求失败时载入本地示例（用于首屏或接口不可达） */
  fallbackSampleOnFail?: boolean;
  /** 失败时不弹 toast（首屏已展示示例时可静默） */
  silentOnFail?: boolean;
  /** 首屏指定 k（与 initialHandIndex 同时提供时生效） */
  initialDatasetKey?: string;
  /** 首屏指定 i（与 initialDatasetKey 同时提供时生效） */
  initialHandIndex?: string;
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
  let equityRequestId = 0;
  /** cumulativeMs.length === timeline.length + 1 */
  let replayCumulativeMs: number[] = [0];
  let rafId = 0;
  let progressRafId = 0;
  let voiceStepWallStartMs = 0;
  let lastRafTs = 0;

  /** 本会话内每次成功请求使用的 k/i（用于「上一局」按浏览历史回退） */
  interface NavRequestKey {
    datasetKey: string;
    handIndex: string;
  }
  let handNavHistory: NavRequestKey[] = [];
  let pendingBackNavigation = false;
  /** 「上一局」请求失败时恢复点击前的 k/i */
  let backNavRestoreOnFail: NavRequestKey | null = null;
  let voiceIndexMap: VoiceIndexMap = new Map();
  /** 与 voiceIndexMap 绑定的 k/i，list/data 必须一致 */
  let voiceListDatasetKey: string | null = null;
  let voiceListHandIndex: string | null = null;
  let voiceListRequestId = 0;
  let replaySessionId = 0;
  let lastVoiceEventIndex: number | null = null;
  let replayAdvanceTimer: ReturnType<typeof setTimeout> | null = null;
  let replayVoiceGated = false;
  /** 每段语音步进唯一令牌，防止 onEnded / 定时器 / 错误回调重复步进 */
  let voiceAdvanceGeneration = 0;
  let voiceStepPlayStartedAt = 0;
  let voiceStepExpectedDurationMs = 0;

  function createVoicePlayer() {
    // #ifdef H5
    if (
      typeof window !== "undefined" &&
      isReviewLaunchMode(parseLaunchQuery()) &&
      isWebVideoCaptureEnvironment()
    ) {
      return createRecordingVoicePlayer();
    }
    // #endif
    return createCommentaryVoicePlayer();
  }

  function shouldWaitCaptureBeforeReplay(): boolean {
    // #ifdef H5
    return (
      typeof window !== "undefined" &&
      isReviewLaunchMode(parseLaunchQuery()) &&
      isWebVideoCaptureEnvironment()
    );
    // #endif
    // #ifndef H5
    return false;
    // #endif
  }

  /** m=rv 录屏：步进由 createRecordingVoicePlayer 虚拟时长 → onEnded，不用页面侧兜底定时器 */
  function isRecordingVoiceReplay(): boolean {
    return shouldWaitCaptureBeforeReplay();
  }

  const voicePlayer = createVoicePlayer();

  function usesVoiceGatedReplay(): boolean {
    return state.voiceOpen && voiceIndexMap.size > 0;
  }

  function clearAdvanceTimerOnly() {
    if (replayAdvanceTimer != null) {
      clearTimeout(replayAdvanceTimer);
      replayAdvanceTimer = null;
    }
  }

  function clearReplayAdvanceTimer() {
    clearAdvanceTimerOnly();
    replayVoiceGated = false;
  }

  function durationForCurrentReplayStep(): number {
    const ev = state.byActionTimeline[state.replayStep];
    return ev ? durationForByActionStep(ev) : 0;
  }

  function cancelVoiceGatedProgressRaf() {
    if (progressRafId) {
      cancelScheduledFrame(progressRafId);
      progressRafId = 0;
    }
  }

  function resetVoiceStepWallClock() {
    voiceStepWallStartMs = Date.now();
  }

  function tickVoiceGatedProgress() {
    if (!state.replayPlaying || !usesVoiceGatedReplay()) {
      cancelVoiceGatedProgressRaf();
      return;
    }
    const stepStart = replayCumulativeMs[state.replayStep] ?? 0;
    const stepEnd =
      state.replayStep + 1 < replayCumulativeMs.length
        ? replayCumulativeMs[state.replayStep + 1]!
        : state.replayTotalMs;
    const stepDur = Math.max(1, stepEnd - stepStart);
    if (voiceStepWallStartMs <= 0) resetVoiceStepWallClock();
    const elapsedInStep = Math.min(
      stepDur,
      Math.max(0, Date.now() - voiceStepWallStartMs),
    );
    state.replayElapsedMs = stepStart + elapsedInStep;
    progressRafId = scheduleFrame(tickVoiceGatedProgress);
  }

  function ensureVoiceGatedProgressTick() {
    if (!state.replayPlaying || !usesVoiceGatedReplay()) return;
    if (!progressRafId) {
      if (voiceStepWallStartMs <= 0) resetVoiceStepWallClock();
      progressRafId = scheduleFrame(tickVoiceGatedProgress);
    }
  }

  function scheduleReplayStepTimer(delayMs: number) {
    clearAdvanceTimerOnly();
    replayAdvanceTimer = setTimeout(advanceReplayOneStep, delayMs);
  }

  function invalidateVoiceAdvanceSession() {
    voiceAdvanceGeneration += 1;
    voiceStepPlayStartedAt = 0;
    voiceStepExpectedDurationMs = 0;
    clearAdvanceTimerOnly();
  }

  function armVoiceStepEndTimer(gen: number, waitMs: number) {
    clearAdvanceTimerOnly();
    if (!state.replayPlaying || gen !== voiceAdvanceGeneration) return;
    const delay = Math.max(0, Math.round(waitMs));
    replayAdvanceTimer = setTimeout(() => {
      completeVoiceGatedStep(gen, "timer");
    }, delay);
  }

  /**
   * 语音步唯一出口：忽略过早 ended；步进前先作废令牌并 stop，避免叠播。
   */
  function completeVoiceGatedStep(gen: number, source: string) {
    if (gen !== voiceAdvanceGeneration || !state.replayPlaying) return;

    if (
      source === "ended" &&
      voiceStepExpectedDurationMs > 0 &&
      voiceStepPlayStartedAt > 0
    ) {
      const elapsed = Date.now() - voiceStepPlayStartedAt;
      const minElapsed = Math.max(
        VOICE_ENDED_MIN_ELAPSED_MS,
        voiceStepExpectedDurationMs - 800,
        Math.floor(voiceStepExpectedDurationMs * 0.88),
      );
      if (elapsed < minElapsed) {
        console.warn(
          `[h5voice][ended-early-ignore]`,
          JSON.stringify({
            step: state.replayStep,
            elapsed,
            expectedMs: voiceStepExpectedDurationMs,
            minElapsed,
          }),
        );
        return;
      }
    }

    invalidateVoiceAdvanceSession();
    voicePlayer.stop();
    replayVoiceGated = false;
    console.log(
      `[h5voice][step-advance]`,
      JSON.stringify({
        fromStep: state.replayStep,
        reason: source,
        recording: isRecordingVoiceReplay(),
      }),
    );
    advanceReplayOneStep();
  }

  function onVoiceStepStarted(gen: number, durationMs: number) {
    if (gen !== voiceAdvanceGeneration || !state.replayPlaying) return;
    replayVoiceGated = true;
    voiceStepPlayStartedAt = Date.now();
    voiceStepExpectedDurationMs = durationMs > 0 ? durationMs : 0;
    if (!isRecordingVoiceReplay()) {
      armVoiceStepEndTimer(gen, computeVoiceStepWaitMs(durationMs));
    }
    ensureVoiceGatedProgressTick();
  }

  function onVoiceStepDurationRevise(gen: number, durationMs: number) {
    if (gen !== voiceAdvanceGeneration || !state.replayPlaying) return;
    if (durationMs <= 0 || durationMs <= voiceStepExpectedDurationMs) return;
    voiceStepExpectedDurationMs = durationMs;
    if (!isRecordingVoiceReplay()) {
      armVoiceStepEndTimer(gen, computeVoiceStepWaitMs(durationMs));
    }
  }

  function onVoiceStepEnded(gen: number) {
    completeVoiceGatedStep(gen, "ended");
  }

  function onVoiceStepFailed(gen: number) {
    if (gen !== voiceAdvanceGeneration || !state.replayPlaying) return;
    lastVoiceEventIndex = null;
    voicePlayer.stop();
    replayVoiceGated = true;
    if (isRecordingVoiceReplay()) {
      scheduleRecordingAwareTimeout(durationForCurrentReplayStep(), () => {
        completeVoiceGatedStep(gen, "record-error");
      });
      return;
    }
    armVoiceStepEndTimer(gen, computeVoiceStepWaitMs(0));
    ensureVoiceGatedProgressTick();
  }

  function beginVoiceGatedStepPlayback() {
    invalidateVoiceAdvanceSession();
    const gen = voiceAdvanceGeneration;
    replayVoiceGated = true;
    const started = playVoiceForCurrentStep({
      onStart: (dur) => onVoiceStepStarted(gen, dur),
      onDurationRevise: (dur) => onVoiceStepDurationRevise(gen, dur),
      onEnded: () => onVoiceStepEnded(gen),
      onError: () => onVoiceStepFailed(gen),
      force: true,
    });
    if (!started) {
      invalidateVoiceAdvanceSession();
      replayVoiceGated = false;
      scheduleReplayStepTimer(durationForCurrentReplayStep());
    }
  }

  function shouldGateStepOnVoice(step: number): boolean {
    if (!usesVoiceGatedReplay()) return false;
    const ev = state.byActionTimeline[step];
    if (!ev) return false;
    return resolveVoiceFilename(ev.event_index, voiceIndexMap) != null;
  }

  function advanceReplayOneStep() {
    invalidateVoiceAdvanceSession();
    clearReplayAdvanceTimer();
    if (!state.replayPlaying) return;
    const tl = state.byActionTimeline;
    if (state.replayStep >= tl.length - 1) {
      state.replayElapsedMs = state.replayTotalMs;
      pauseReplayInternal();
      return;
    }
    state.replayStep += 1;
    state.replayElapsedMs = replayCumulativeMs[state.replayStep] ?? state.replayElapsedMs;
    syncReplayFromTimeline({ skipVoice: usesVoiceGatedReplay() });
    scheduleAdvanceFromCurrentStep();
  }

  function scheduleAdvanceFromCurrentStep() {
    clearReplayAdvanceTimer();
    if (!state.replayPlaying) return;

    if (usesVoiceGatedReplay()) {
      resetVoiceStepWallClock();
      ensureVoiceGatedProgressTick();
      const stepMs = durationForCurrentReplayStep();
      if (shouldGateStepOnVoice(state.replayStep)) {
        beginVoiceGatedStepPlayback();
        return;
      }
      scheduleReplayStepTimer(stepMs);
      return;
    }

    cancelVoiceGatedProgressRaf();
    voiceStepWallStartMs = 0;
    replayVoiceGated = false;
    if (!rafId) {
      lastRafTs = 0;
      rafId = scheduleFrame(replayTick);
    }
  }

  function switchToVoiceGatedReplayIfNeeded() {
    if (!state.replayPlaying || !usesVoiceGatedReplay()) return;
    if (rafId) {
      cancelScheduledFrame(rafId);
      rafId = 0;
    }
    lastRafTs = 0;
    invalidateVoiceAdvanceSession();
    clearReplayAdvanceTimer();
    scheduleAdvanceFromCurrentStep();
  }

  const state = reactive({
    datasetKey: DEV_COMMENTARY_DATASET_KEY,
    handIndex: DEV_COMMENTARY_HAND_INDEX,
    /** 语音 list 就绪后与 voiceListHandIndex 同步，供「下一局」等读取 */
    voiceHandIndex: DEV_COMMENTARY_HAND_INDEX,
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
    /** 解说语音：open 时随 action 步进播放 */
    voiceOpen: true,
    equityHdNames: [] as string[],
    equityByAction: [] as EquityByActionEvent[],
  });

  const equityStepView = computed(() => {
    let eventIndex = 0;
    let prevEventIndex: number | null = null;
    const tl = state.byActionTimeline;
    if (tl.length > 0) {
      const ev = tl[state.replayStep];
      if (ev?.event_index != null) eventIndex = ev.event_index;
      if (state.replayStep > 0) {
        const prev = tl[state.replayStep - 1];
        if (prev?.event_index != null) prevEventIndex = prev.event_index;
      }
    } else if (state.equityByAction.length > 0) {
      eventIndex =
        state.equityByAction[state.equityByAction.length - 1].event_index;
    }
    return buildEquityStepView(
      state.equityByAction,
      state.equityHdNames,
      state.players.length,
      eventIndex,
      prevEventIndex,
    );
  });

  function loadEquityForHand(datasetKey: string, handIndex: string) {
    if (!EQUITY_API_URL?.trim()) return;
    const k = datasetKey.trim();
    const i = handIndex.trim();
    if (!k || !i) return;
    const reqId = ++equityRequestId;
    uni.request({
      url: `${EQUITY_API_URL.trim()}?k=${encodeURIComponent(k)}&i=${encodeURIComponent(i)}&_t=${Date.now()}`,
      method: "GET",
      timeout: 60000,
      success: (res) => {
        if (reqId !== equityRequestId) return;
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data != null) {
          const parsed = adaptEquityResponse(res.data);
          if (parsed) {
            state.equityHdNames = parsed.hdNames;
            state.equityByAction = parsed.byAction;
          }
        } else {
          state.equityHdNames = [];
          state.equityByAction = [];
        }
      },
      fail: () => {
        if (reqId !== equityRequestId) return;
        state.equityHdNames = [];
        state.equityByAction = [];
      },
    });
  }

  function pauseReplayInternal() {
    state.replayPlaying = false;
    invalidateVoiceAdvanceSession();
    if (rafId) {
      cancelScheduledFrame(rafId);
      rafId = 0;
    }
    cancelVoiceGatedProgressRaf();
    voiceStepWallStartMs = 0;
    lastRafTs = 0;
    clearReplayAdvanceTimer();
    voicePlayer.stop();
  }

  function resetVoiceState() {
    voiceIndexMap = new Map();
    voiceListDatasetKey = null;
    voiceListHandIndex = null;
    lastVoiceEventIndex = null;
    voicePlayer.stop();
  }

  function loadVoiceListForHand(
    datasetKey: string,
    handIndex: string | number,
    opts?: { skipAutoPlay?: boolean },
  ): Promise<void> {
    if (!VOICE_LIST_API_URL?.trim()) return Promise.resolve();
    const capturedK = String(datasetKey).trim();
    const capturedI = String(handIndex).trim();
    if (!capturedK || !isVoiceHandIndexReady(capturedI)) return Promise.resolve();
    const reqId = ++voiceListRequestId;
    resetVoiceState();
    return fetchVoiceList(VOICE_LIST_API_URL, capturedK, capturedI)
      .then((map) => {
        if (reqId !== voiceListRequestId) return;
        voiceListDatasetKey = capturedK;
        voiceListHandIndex = capturedI;
        voiceIndexMap = map;
        state.voiceHandIndex = capturedI;
        lastVoiceEventIndex = null;
        console.log(
          `[h5voice][voice-list-ready]`,
          JSON.stringify({ k: capturedK, i: capturedI, count: map.size }),
        );
        if (state.replayPlaying) {
          switchToVoiceGatedReplayIfNeeded();
        } else if (!opts?.skipAutoPlay) {
          playVoiceForCurrentStep();
        }
      })
      .catch((err) => {
        if (reqId !== voiceListRequestId) return;
        voiceIndexMap = new Map();
        voiceListDatasetKey = null;
        voiceListHandIndex = null;
        console.warn(
          "[h5voice][voice-list-fail]",
          JSON.stringify({ k: capturedK, i: capturedI, err: String(err) }),
        );
      });
  }

  /** 语音 list 就绪后再开自动回放，避免生产包先跑完若干步才切到语音模式 */
  function beginReplayAutoplayWhenReady(
    voicePromise: Promise<void>,
    sessionId: number,
  ) {
    if (!state.byActionTimeline.length || state.replayPlaying) return;
    const waitVoice =
      state.voiceOpen && Boolean(VOICE_LIST_API_URL?.trim());
    if (waitVoice) {
      let started = false;
      const startOnce = () => {
        if (started || sessionId !== replaySessionId) return;
        if (!state.byActionTimeline.length || state.replayPlaying) return;
        started = true;
        startReplayPlayback();
      };
      const waitTimer = setTimeout(
        startOnce,
        VOICE_LIST_AUTOPLAY_MAX_WAIT_MS,
      );
      void voicePromise.finally(() => {
        clearTimeout(waitTimer);
        startOnce();
      });
      return;
    }
    startReplayPlayback();
  }

  function playVoiceForCurrentStep(opts?: {
    onStart?: (durationMs: number) => void;
    onDurationRevise?: (durationMs: number) => void;
    onEnded?: () => void;
    onError?: () => void;
    force?: boolean;
  }): boolean {
    if (!state.voiceOpen || !voiceIndexMap.size) return false;
    const tl = state.byActionTimeline;
    const ev = tl[state.replayStep];
    if (!ev) return false;
    if (!opts?.force && ev.event_index === lastVoiceEventIndex) return false;
    const filename = resolveVoiceFilename(ev.event_index, voiceIndexMap);
    if (!filename) return false;
    lastVoiceEventIndex = ev.event_index;
    if (!VOICE_DATA_API_URL?.trim()) return false;
    const voiceK = voiceListDatasetKey ?? state.datasetKey;
    const voiceI = voiceListHandIndex;
    if (!voiceI) return false;
    const url = buildVoiceDataUrl(
      VOICE_DATA_API_URL,
      voiceK,
      voiceI,
      filename,
    );
    console.log(
      `[h5voice][fetch-data-play] t=${typeof performance !== "undefined" ? Math.round(performance.now()) : 0}ms`,
      JSON.stringify({
        step: state.replayStep,
        eventIndex: ev.event_index,
        file: filename,
        totalSteps: tl.length,
      }),
    );
    voicePlayer.play(url, {
      onStart: opts?.onStart,
      onDurationRevise: opts?.onDurationRevise,
      onEnded: opts?.onEnded,
      onError: opts?.onError,
    });
    return true;
  }

  function setVoiceOpen(open: boolean) {
    state.voiceOpen = open;
    if (!open) {
      lastVoiceEventIndex = null;
      voicePlayer.stop();
      replayVoiceGated = false;
      if (replayAdvanceTimer != null) {
        clearTimeout(replayAdvanceTimer);
        replayAdvanceTimer = null;
      }
      cancelVoiceGatedProgressRaf();
      voiceStepWallStartMs = 0;
      if (state.replayPlaying && !rafId) {
        lastRafTs = 0;
        rafId = scheduleFrame(replayTick);
      }
      return;
    }
    lastVoiceEventIndex = null;
    if (state.replayPlaying) {
      if (rafId) {
        cancelScheduledFrame(rafId);
        rafId = 0;
        lastRafTs = 0;
      }
      if (replayAdvanceTimer != null) {
        clearTimeout(replayAdvanceTimer);
        replayAdvanceTimer = null;
      }
      scheduleAdvanceFromCurrentStep();
      return;
    }
    playVoiceForCurrentStep({ force: true });
  }

  function toggleVoiceOpen() {
    setVoiceOpen(!state.voiceOpen);
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

  function syncReplayFromTimeline(options?: { skipVoice?: boolean }) {
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

    state.focusPlayerId =
      snap.stepSeatFocus != null ? `p${snap.stepSeatFocus}` : null;

    const tot = tl.length;
    const n = state.replayStep + 1;
    state.replayHeadline =
      snap.stepSeatFocus != null
        ? `${n}/${tot} · ${snap.stepSeatName || `座位${snap.stepSeatFocus + 1}`} · ${snap.stepActionZh}`
        : `${n}/${tot} · ${snap.stepActionZh}`;
    state.replayHeadlineChips = snap.stepHeadlineChipsLine ?? "";
    state.replayDetailText = snap.stepDetailText;
    if (
      !options?.skipVoice &&
      (!state.replayPlaying || !usesVoiceGatedReplay())
    ) {
      playVoiceForCurrentStep({ force: true });
    }
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
    if (!state.replayPlaying || usesVoiceGatedReplay()) return;
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
    rafId = scheduleFrame(replayTick);
  }

  /** 从当前 elapsed/step 开始自动播放（会先停掉上一轮的 rAF） */
  function startReplayPlayback() {
    if (!state.byActionTimeline.length || !state.replayTotalMs) return;
    const run = () => {
      pauseReplayInternal();
      state.replayPlaying = true;
      if (usesVoiceGatedReplay()) {
        scheduleAdvanceFromCurrentStep();
        return;
      }
      lastRafTs = 0;
      rafId = scheduleFrame(replayTick);
    };
    if (shouldWaitCaptureBeforeReplay()) {
      whenCaptureStarted(run);
      return;
    }
    run();
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
      voiceHandIndex: state.voiceHandIndex,
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
    };
  }

  /** 解说返回后：清空旧语音，再用 meta.k / meta.i 拉 list */
  function loadVoiceForCommentaryMeta(
    payload: HandCommentaryPayload,
    opts?: { skipAutoPlay?: boolean },
  ): Promise<void> {
    const k = payload.datasetKey ?? state.datasetKey;
    const i = payload.handIndex;
    if (i == null || String(k).trim() === "" || !isVoiceHandIndexReady(i)) {
      return Promise.resolve();
    }
    return loadVoiceListForHand(String(k), String(i), opts);
  }

  function applyPayload(
    payload: HandCommentaryPayload,
    applyOpts?: { replayAutoplay?: boolean; skipVoice?: boolean },
  ) {
    const sessionId = ++replaySessionId;
    if (payload.datasetKey != null) state.datasetKey = payload.datasetKey;
    if (payload.handIndex != null) {
      state.handIndex = String(payload.handIndex);
    }
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

    const replayAutoplay = applyOpts?.replayAutoplay !== false;
    const willAutoplay = replayAutoplay && state.byActionTimeline.length > 0;
    const voicePromise = applyOpts?.skipVoice
      ? Promise.resolve()
      : loadVoiceForCommentaryMeta(payload, {
          skipAutoPlay: willAutoplay && state.voiceOpen,
        });

    if (state.byActionTimeline.length > 0) {
      if (!replayAutoplay) {
        state.replayStep = 0;
        state.replayElapsedMs = replayCumulativeMs[0] ?? 0;
        syncReplayFromTimeline();
      } else {
        syncReplayFromTimeline();
      }
      captureSnapshot();
      if (willAutoplay) {
        beginReplayAutoplayWhenReady(voicePromise, sessionId);
      }
    } else {
      captureSnapshot();
    }
  }

  /** 页面刷新 / 首屏：默认 k=all、i=-1；也可由 URL 传入 initial k/i */
  function loadFresh(opts?: LoadCommentaryOptions) {
    clearNavHistory();
    const k = opts?.initialDatasetKey?.trim();
    const i = opts?.initialHandIndex?.trim();
    if (k && i !== undefined && i !== "") {
      state.datasetKey = k;
      state.handIndex = i;
    } else {
      state.datasetKey = DEV_COMMENTARY_DATASET_KEY;
      state.handIndex = DEV_COMMENTARY_HAND_INDEX;
    }
    loadApi(opts);
  }

  /** 开发调试用：载入内置示例快照 */
  function loadSample(opts?: { silent?: boolean }) {
    handNavHistory = [];
    pendingBackNavigation = false;
    backNavRestoreOnFail = null;
    state.equityHdNames = [];
    state.equityByAction = [];
    applyPayload(SAMPLE_PAYLOAD, { skipVoice: true, replayAutoplay: false });
    if (!opts?.silent) {
      uni.showToast({ title: "已载入示例", icon: "none" });
    }
  }

  function clearNavHistory() {
    handNavHistory = [];
    pendingBackNavigation = false;
    backNavRestoreOnFail = null;
  }

  function rollbackBackNavigationIfNeeded() {
    if (pendingBackNavigation && backNavRestoreOnFail) {
      state.datasetKey = backNavRestoreOnFail.datasetKey;
      state.handIndex = backNavRestoreOnFail.handIndex;
    }
    pendingBackNavigation = false;
    backNavRestoreOnFail = null;
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
    const requestHandIndex = opts?.requestHandIndex ?? String(state.handIndex);
    const sentKey: NavRequestKey = {
      datasetKey: state.datasetKey,
      handIndex: requestHandIndex,
    };
    state.loading = true;
    const url =
      `${COMMENTARY_API_URL.trim()}?k=${encodeURIComponent(state.datasetKey)}&i=${encodeURIComponent(requestHandIndex)}&_t=${Date.now()}`;
    const endLoading = () => {
      state.loading = false;
    };

    uni.request({
      url,
      method: "GET",
      timeout: 60000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300 && res.data != null) {
          const payload = adaptCommentaryResponse(res.data);
          if (!payload) {
            rollbackBackNavigationIfNeeded();
            uni.showToast({
              title: "返回数据无法解析",
              icon: "none",
              duration: 2500,
            });
            return;
          }
          if (pendingBackNavigation) {
            pendingBackNavigation = false;
            backNavRestoreOnFail = null;
            if (handNavHistory.length >= 1) {
              handNavHistory.pop();
            }
          } else {
            const last = handNavHistory[handNavHistory.length - 1];
            const dup =
              last &&
              last.datasetKey === sentKey.datasetKey &&
              last.handIndex === sentKey.handIndex;
            if (!dup) {
              handNavHistory.push({ ...sentKey });
            }
          }
          applyPayload(payload, { replayAutoplay: opts?.replayAutoplay });
          loadEquityForHand(
            payload.datasetKey ?? state.datasetKey,
            payload.handIndex != null
              ? String(payload.handIndex)
              : requestHandIndex,
          );
          if (!opts?.silentToast) {
            uni.showToast({ title: "已更新", icon: "none" });
          }
        } else {
          rollbackBackNavigationIfNeeded();
          uni.showToast({
            title: `请求失败 HTTP ${res.statusCode ?? "?"}`,
            icon: "none",
          });
        }
      },
      fail: (err) => {
        rollbackBackNavigationIfNeeded();
        const msg =
          err && typeof err === "object" && "errMsg" in err
            ? String((err as { errMsg?: string }).errMsg ?? "")
            : "";
        if (opts?.fallbackSampleOnFail) {
          handNavHistory = [];
          pendingBackNavigation = false;
          backNavRestoreOnFail = null;
          applyPayload(SAMPLE_PAYLOAD, {
            skipVoice: true,
            replayAutoplay: false,
          });
          captureSnapshot();
          if (!opts?.silentOnFail) {
            const hint = /timeout|超时/i.test(msg) ? "接口超时" : "接口不可用";
            uni.showToast({
              title: `${hint}，已载入示例`,
              icon: "none",
              duration: 2800,
            });
          }
          return;
        }
        if (opts?.silentOnFail) return;
        const title = /timeout|超时/i.test(msg)
          ? "请求超时，请检查网络或服务器"
          : msg
            ? msg.slice(0, 72)
            : "网络错误";
        uni.showToast({
          title,
          icon: "none",
          duration: 3200,
        });
      },
      complete: () => {
        endLoading();
      },
    });
  }

  /** 上一局：按本会话成功请求栈回退并重新拉取 */
  function loadPrevHand() {
    if (handNavHistory.length < 2) {
      uni.showToast({ title: "已在浏览起点", icon: "none" });
      return;
    }
    const target = handNavHistory[handNavHistory.length - 2];
    backNavRestoreOnFail = {
      datasetKey: state.datasetKey,
      handIndex: String(state.handIndex),
    };
    state.datasetKey = target.datasetKey;
    state.handIndex = target.handIndex;
    pendingBackNavigation = true;
    loadApi({ silentToast: true });
  }

  /** 下一局：i = 当前 meta.i + 1 取解说，返回后用新 meta.i 取语音 */
  function loadNextHand() {
    const s = String(state.handIndex).trim();
    if (!s || s === DEV_COMMENTARY_HAND_INDEX) {
      uni.showToast({ title: "暂无 meta.i", icon: "none" });
      return;
    }
    const cur = Number(s);
    if (!Number.isFinite(cur)) {
      uni.showToast({ title: "手牌编号不是数字，无法切换", icon: "none" });
      return;
    }
    loadApi({ silentToast: true, requestHandIndex: String(cur + 1) });
  }

  /** 重置：不请求网络，用最近一次成功加载的快照重新初始化 UI */
  function resetTable() {
    pauseReplayInternal();
    clearNavHistory();
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
    state.voiceHandIndex = snap.voiceHandIndex ?? snap.handIndex;
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
      const sessionId = ++replaySessionId;
      const voicePromise = loadVoiceListForHand(
        snap.datasetKey,
        snap.voiceHandIndex ?? snap.handIndex,
        { skipAutoPlay: state.voiceOpen },
      );
      beginReplayAutoplayWhenReady(voicePromise, sessionId);
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
    voicePlayer.destroy();
  });

  return {
    state,
    equityStepView,
    /** 供 WebSocket / 轮询拿到 JSON 后直接刷新界面 */
    applyPayload,
    loadSample,
    loadApi,
    loadFresh,
    resetTable,
    loadPrevHand,
    loadNextHand,
    toggleReplayPlay,
    seekReplayPercent,
    seekReplayToStep,
    seekReplayStepDelta,
    toggleVoiceOpen,
    setVoiceOpen,
  };
}
