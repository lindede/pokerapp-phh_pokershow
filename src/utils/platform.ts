/** H5 PC 浏览器（排除手机与触屏平板） */
export function isPcH5Browser(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return false;
  }
  if (/iPad/i.test(ua)) return false;
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return false;

  try {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return true;
    }
  } catch {
    /* ignore */
  }

  return window.innerWidth >= 1024;
}
