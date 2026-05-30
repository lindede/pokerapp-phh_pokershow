/** 布局用窗口尺寸（优先新 API，减少 getSystemInfo 提示） */
export function getWindowMetrics(): {
  windowWidth: number;
  windowHeight: number;
} {
  try {
    const g = globalThis as {
      uni?: {
        getWindowInfo?: () => { windowWidth?: number; windowHeight?: number };
        getSystemInfoSync?: () => {
          windowWidth?: number;
          windowHeight?: number;
        };
      };
    };
    if (typeof g.uni?.getWindowInfo === "function") {
      const w = g.uni.getWindowInfo();
      if (w.windowWidth && w.windowHeight) {
        return { windowWidth: w.windowWidth, windowHeight: w.windowHeight };
      }
    }
    if (typeof g.uni?.getSystemInfoSync === "function") {
      const s = g.uni.getSystemInfoSync();
      return {
        windowWidth: s.windowWidth ?? 375,
        windowHeight: s.windowHeight ?? 667,
      };
    }
  } catch {
    /* fall through */
  }
  return { windowWidth: 375, windowHeight: 667 };
}
