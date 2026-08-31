/** 底部主导航 Tab 高度（rpx），用于 scroll / dock 留白计算 */
// #ifdef H5
/** H5 含 ICP 行 */
export const APP_TAB_BAR_HEIGHT_RPX = 128;
// #endif
// #ifndef H5
export const APP_TAB_BAR_HEIGHT_RPX = 88;
// #endif

export type AppTabKey = "commentary" | "review" | "profile";

export const APP_TAB_ITEMS: ReadonlyArray<{
  key: AppTabKey;
  label: string;
  url: string;
}> = [
  { key: "commentary", label: "讲解", url: "/pages/index/index" },
  { key: "review", label: "复盘", url: "/pages/review/index" },
  { key: "profile", label: "我", url: "/pages/profile/index" },
];

/** Tab reLaunch 前写入；介绍弹窗读到则跳过（刷新没有此标记仍会弹） */
export const TAB_SWITCH_FLAG_KEY = "pokershow_tab_switch";

export function markTabSwitchNavigation() {
  try {
    // #ifdef H5
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(TAB_SWITCH_FLAG_KEY, "1");
    }
    // #endif
    uni.setStorageSync(TAB_SWITCH_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearTabSwitchFlag() {
  try {
    // #ifdef H5
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(TAB_SWITCH_FLAG_KEY);
    }
    // #endif
    uni.removeStorageSync(TAB_SWITCH_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

/** 若来自 Tab 切换则消费标记并返回 true */
export function consumeTabSwitchFlag(): boolean {
  let hit = false;
  try {
    // #ifdef H5
    if (
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(TAB_SWITCH_FLAG_KEY) === "1"
    ) {
      sessionStorage.removeItem(TAB_SWITCH_FLAG_KEY);
      hit = true;
    }
    // #endif
    if (String(uni.getStorageSync(TAB_SWITCH_FLAG_KEY) || "") === "1") {
      uni.removeStorageSync(TAB_SWITCH_FLAG_KEY);
      hit = true;
    }
  } catch {
    /* ignore */
  }
  return hit;
}
