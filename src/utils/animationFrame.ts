/** 微信等小程序环境可能没有全局 requestAnimationFrame，做兼容封装 */

type RafCallback = (timestamp: number) => void;

function wxRaf(cb: RafCallback): number {
  const wxApi = (globalThis as { wx?: { requestAnimationFrame?: (fn: RafCallback) => number } }).wx;
  if (wxApi?.requestAnimationFrame) {
    return wxApi.requestAnimationFrame(cb);
  }
  return setTimeout(() => cb(Date.now()), 16) as unknown as number;
}

function wxCancelRaf(id: number): void {
  const wxApi = (globalThis as { wx?: { cancelAnimationFrame?: (id: number) => void } }).wx;
  if (wxApi?.cancelAnimationFrame) {
    wxApi.cancelAnimationFrame(id);
    return;
  }
  clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
}

export function scheduleFrame(cb: RafCallback): number {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(cb);
  }
  return wxRaf(cb);
}

export function cancelScheduledFrame(id: number): void {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(id);
    return;
  }
  wxCancelRaf(id);
}
