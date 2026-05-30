/** H5 录屏（m=rv + WebVideoCreator）：DOM capture 音频，与 WVC 虚拟时间轴对齐 */

import type { CommentaryVoicePlayer } from "@/types/commentaryVoice";

function voiceVirtualMs(): number {
  try {
    const w = window as Window & { captureCtx?: { currentTime?: number } };
    if (w.captureCtx?.currentTime != null) {
      return Math.round(w.captureCtx.currentTime);
    }
  } catch {
    /* ignore */
  }
  return Math.round(typeof performance !== "undefined" ? performance.now() : Date.now());
}

function voiceLog(phase: string, detail: Record<string, unknown>) {
  console.log(`[h5voice][${phase}] t=${voiceVirtualMs()}ms`, JSON.stringify(detail));
}

function isCaptureStarted(): boolean {
  try {
    const w = window as Window & { captureCtx?: { startFlag?: boolean } };
    return Boolean(w.captureCtx?.startFlag);
  } catch {
    return false;
  }
}

/** WVC / Puppeteer 录屏环境（有 captureCtx 或无头浏览器） */
export function isWebVideoCaptureEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as Window & { captureCtx?: unknown };
    if (w.captureCtx) return true;
  } catch {
    /* ignore */
  }
  if (typeof navigator !== "undefined") {
    if (navigator.webdriver) return true;
    if (/HeadlessChrome/i.test(navigator.userAgent ?? "")) return true;
  }
  return false;
}

function realSetTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const w = window as Window & { ____setTimeout?: typeof setTimeout };
  return (w.____setTimeout ?? setTimeout)(fn, ms);
}

/** WVC 逐帧录屏已开始后再执行（避免录屏前真实时间误触发 setTimeout 提前步进） */
export function whenCaptureStarted(cb: () => void): void {
  if (!isWebVideoCaptureEnvironment()) {
    cb();
    return;
  }
  if (isCaptureStarted()) {
    cb();
    return;
  }
  realSetTimeout(() => whenCaptureStarted(cb), 32);
}

/**
 * 录屏环境：capture 开始后再用真实 setTimeout 调度（勿用页面侧普通 setTimeout 步进语音）。
 */
export function scheduleRecordingAwareTimeout(
  delayMs: number,
  fn: () => void,
): void {
  const ms = Math.max(0, Math.round(delayMs));
  if (!isWebVideoCaptureEnvironment()) {
    setTimeout(fn, ms);
    return;
  }
  whenCaptureStarted(() => {
    realSetTimeout(fn, ms);
  });
}

/** 录屏步进缓冲（毫秒），略晚于 MP3 时长再切步，避免与 WVC 音轨错位 */
const RECORDING_VOICE_TAIL_MS = 400;

function voiceDurationMs(audio: HTMLAudioElement): number {
  const sec = audio.duration;
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return Math.max(0, Math.round(sec * 1000));
}

/**
 * m=rv 录屏：向 DOM 注入带 capture 的 <audio>，供 WebVideoCreator 抓取并合成音轨。
 * 步进只认虚拟时间轴上的 MP3 时长（+ 小缓冲）；无头里 native ended 常提前，不可信。
 */
export function createRecordingVoicePlayer(): CommentaryVoicePlayer {
  let current: HTMLAudioElement | null = null;
  let attemptId = 0;

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
      const id = ++attemptId;
      const file = (() => {
        try {
          return new URL(url, window.location.href).searchParams.get("n") ?? url;
        } catch {
          return url;
        }
      })();
      voiceLog("record-play-queued", { id, file, url });
      if (current) {
        current.pause();
        current.remove();
        current = null;
      }

      whenCaptureStarted(() => {
        if (id !== attemptId) return;

        const audio = document.createElement("audio");
        audio.setAttribute("capture", "");
        audio.src = url;
        audio.preload = "auto";
        audio.volume = 1;
        audio.style.cssText =
          "position:fixed;width:0;height:0;opacity:0;pointer-events:none";

        let captureStartMs = 0;
        let scheduledDurMs = 0;
        let advanced = false;
        let virtualTimer: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
          if (id !== attemptId) return;
          if (virtualTimer != null) {
            clearTimeout(virtualTimer);
            virtualTimer = null;
          }
          audio.remove();
          if (current === audio) current = null;
        };

        const advanceOnce = (driver: "virtual-timeout" | "metadata-fallback") => {
          if (advanced || id !== attemptId) return;
          advanced = true;
          voiceLog("record-ended", {
            id,
            file,
            elapsedMs: voiceVirtualMs() - captureStartMs,
            scheduledDurMs,
            driver,
          });
          cleanup();
          opts?.onEnded?.();
        };

        const clearVirtualTimer = () => {
          if (virtualTimer != null) {
            clearTimeout(virtualTimer);
            virtualTimer = null;
          }
        };

        const scheduleStepAfter = (durMs: number) => {
          const waitMs = durMs + RECORDING_VOICE_TAIL_MS;
          clearVirtualTimer();
          scheduledDurMs = waitMs;
          virtualTimer = setTimeout(
            () => advanceOnce("virtual-timeout"),
            waitMs,
          );
        };

        /** metadata 就绪后再 append，让 WVC 登记时已有 start/end */
        const armTimeline = (reason: string) => {
          if (advanced || id !== attemptId) return false;
          const durMs = voiceDurationMs(audio);
          if (durMs <= 0) return false;

          captureStartMs = voiceVirtualMs();
          const endMs = captureStartMs + durMs;
          audio.setAttribute("start-time", String(captureStartMs));
          audio.setAttribute("end-time", String(endMs));

          if (!audio.isConnected) {
            document.body.appendChild(audio);
            current = audio;
          }

          scheduleStepAfter(durMs);
          opts?.onStart?.(durMs);
          voiceLog("record-play", {
            id,
            file,
            reason,
            durMs,
            tailMs: RECORDING_VOICE_TAIL_MS,
            startMs: captureStartMs,
            endMs,
          });

          void audio.play().catch(() => {
            voiceLog("record-play-warn", {
              id,
              file,
              note: "play() rejected in headless; step still follows virtual duration",
            });
          });
          return true;
        };

        const tryExtendSchedule = () => {
          if (advanced || id !== attemptId || captureStartMs <= 0) return;
          const durMs = voiceDurationMs(audio);
          if (durMs <= scheduledDurMs - RECORDING_VOICE_TAIL_MS) return;
          const elapsed = voiceVirtualMs() - captureStartMs;
          const remaining = durMs + RECORDING_VOICE_TAIL_MS - elapsed;
          if (remaining <= 0) return;
          voiceLog("record-duration-revised", {
            id,
            file,
            durMs,
            remainingMs: remaining,
          });
          scheduleStepAfter(Math.max(0, durMs - elapsed));
          opts?.onDurationRevise?.(durMs);
        };

        audio.addEventListener(
          "loadedmetadata",
          () => {
            if (!armTimeline("loadedmetadata")) {
              voiceLog("record-bad-duration", {
                id,
                file,
                duration: audio.duration,
              });
            }
          },
          { once: true },
        );
        audio.addEventListener("durationchange", () => tryExtendSchedule());
        audio.addEventListener("ended", () => {
          voiceLog("record-native-ended-ignored", {
            id,
            file,
            atMs: captureStartMs > 0 ? voiceVirtualMs() - captureStartMs : 0,
            durationMs: voiceDurationMs(audio),
          });
        });
        audio.addEventListener("error", () => {
          voiceLog("record-error", { id, file });
          cleanup();
          (opts?.onError ?? opts?.onEnded)?.();
        });

        audio.load();
      });
    },
    stop() {
      attemptId += 1;
      if (current) {
        voiceLog("record-stop", { src: current.src });
        current.pause();
        current.remove();
        current = null;
      }
    },
    destroy() {
      this.stop();
    },
  };
}
